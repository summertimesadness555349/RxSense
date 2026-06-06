'use strict';

const AgentLogger = require('../utils/agentLogger.js');

const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL   = 'claude-sonnet-4-6';
const MAX_TURNS       = 8;

function getApiKey() {
    const key = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('CLAUDE_API_KEY / ANTHROPIC_API_KEY not set');
    return key;
}

/**
 * Run a Claude agent loop with tool use.
 *
 * @param {object}   opts
 * @param {string}   opts.agentName    — label used in logs
 * @param {number}   opts.userId       — for log correlation
 * @param {string}   opts.system
 * @param {string}   opts.userMessage
 * @param {Array}    opts.tools        — Anthropic tool schemas
 * @param {object}   opts.executors    — { [toolName]: async (input) => result }
 * @param {string}   [opts.model]
 * @param {number}   [opts.maxTokens]
 * @param {number}   [opts.temperature]
 *
 * @returns {Promise<{ text: string, turns: number, toolCalls: string[] }>}
 */
async function runAgent({
    agentName   = 'Agent',
    userId      = null,
    system,
    userMessage,
    tools,
    executors,
    model       = DEFAULT_MODEL,
    maxTokens   = 2048,
    temperature = 0.3,
}) {
    const sessionStart = Date.now();
    const toolNames    = tools.map(t => t.name);
    const messages     = [{ role: 'user', content: userMessage }];
    const toolCalls    = [];
    let   turns        = 0;

    AgentLogger.sessionStart({ agentName, userId, input: userMessage });

    try {
        while (turns < MAX_TURNS) {
            turns++;

            AgentLogger.llmCall({
                turn:         turns,
                model,
                tools:        toolNames,
                messageCount: messages.length,
            });

            const llmStart = Date.now();
            const res = await fetch(CLAUDE_ENDPOINT, {
                method:  'POST',
                headers: {
                    'Content-Type':      'application/json',
                    'x-api-key':         getApiKey(),
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, tools, messages }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Claude API error (${res.status}): ${text}`);
            }

            const data    = await res.json();
            const llmMs   = Date.now() - llmStart;
            console.log(`[AGENT] │   ◇ LLM response  stop_reason=${data.stop_reason}  (${llmMs}ms)`);

            // ── Final answer ──────────────────────────────────────────────────
            if (data.stop_reason === 'end_turn') {
                const text = (data.content || [])
                    .filter(b => b.type === 'text')
                    .map(b => b.text)
                    .join('\n')
                    .trim();

                AgentLogger.sessionEnd({
                    agentName,
                    turns,
                    toolCalls,
                    durationMs:   Date.now() - sessionStart,
                    outputLength: text.length,
                });

                return { text, turns, toolCalls };
            }

            // ── Tool use round ────────────────────────────────────────────────
            if (data.stop_reason === 'tool_use') {
                messages.push({ role: 'assistant', content: data.content });

                const results = [];
                for (const block of data.content) {
                    if (block.type !== 'tool_use') continue;

                    toolCalls.push(block.name);
                    AgentLogger.toolCall({ turn: turns, toolName: block.name, input: block.input });

                    const executor  = executors[block.name];
                    const toolStart = Date.now();
                    let   content;

                    if (!executor) {
                        const err = `No executor for tool "${block.name}"`;
                        AgentLogger.toolResult({ toolName: block.name, durationMs: 0, error: err });
                        content = JSON.stringify({ error: err });
                    } else {
                        try {
                            const result    = await executor(block.input);
                            const toolMs    = Date.now() - toolStart;
                            const resultStr = JSON.stringify(result);
                            const summary   = resultStr.length > 120
                                ? resultStr.slice(0, 120) + '…'
                                : resultStr;

                            AgentLogger.toolResult({ toolName: block.name, durationMs: toolMs, resultSummary: summary });
                            content = resultStr;
                        } catch (err) {
                            const toolMs = Date.now() - toolStart;
                            AgentLogger.toolResult({ toolName: block.name, durationMs: toolMs, error: err.message });
                            content = JSON.stringify({ error: err.message });
                        }
                    }

                    results.push({ type: 'tool_result', tool_use_id: block.id, content });
                }

                messages.push({ role: 'user', content: results });
                continue;
            }

            // max_tokens — response was cut off; throw so caller knows output is incomplete
            if (data.stop_reason === 'max_tokens') {
                throw new Error(`Agent response truncated by max_tokens limit (${maxTokens}). Increase maxTokens or reduce output schema size.`);
            }

            // Unexpected stop reason — extract any text and return
            const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
            AgentLogger.sessionEnd({ agentName, turns, toolCalls, durationMs: Date.now() - sessionStart, outputLength: text.length });
            return { text, turns, toolCalls };
        }

        throw new Error(`Agent did not finish within ${MAX_TURNS} turns`);

    } catch (err) {
        AgentLogger.sessionError({
            agentName,
            turns,
            durationMs: Date.now() - sessionStart,
            error:      err.message,
        });
        throw err;
    }
}

module.exports = { runAgent };
