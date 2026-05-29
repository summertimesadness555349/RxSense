'use strict';

const { OpenAI } = require('openai');

const MAX_TURNS = 8;

// Convert Anthropic tool schema format → OpenAI function format
function toOpenAITools(anthropicSchemas) {
    return anthropicSchemas.map(t => ({
        type: 'function',
        function: {
            name:        t.name,
            description: t.description,
            parameters:  t.input_schema,
        },
    }));
}

/**
 * Run an OpenAI agent loop with function calling.
 * Accepts tools in Anthropic schema format (same as agentRunner.js) so callers
 * don't need to know which backend is in use.
 *
 * @param {object}  opts
 * @param {string}  opts.agentName
 * @param {number}  opts.userId       — for log correlation
 * @param {string}  opts.system
 * @param {string}  opts.userMessage
 * @param {Array}   opts.tools        — Anthropic-format tool schemas
 * @param {object}  opts.executors    — { [toolName]: async (input) => result }
 * @param {string}  [opts.model]      — defaults to OPENAI_AGENT_MODEL env var or gpt-4o
 * @param {number}  [opts.maxTokens]
 * @param {number}  [opts.temperature]
 *
 * @returns {Promise<{ text: string, turns: number, toolCalls: string[] }>}
 */
async function runOpenAIAgent({
    agentName   = 'Agent',
    userId      = null,
    system,
    userMessage,
    tools,
    executors,
    model       = process.env.OPENAI_AGENT_MODEL || 'gpt-4o',
    maxTokens   = 3000,
    temperature = 0.3,
}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const client      = new OpenAI({ apiKey });
    const openaiTools = toOpenAITools(tools);
    const messages    = [
        { role: 'system', content: system },
        { role: 'user',   content: userMessage },
    ];

    const toolCalls  = [];
    let   turns      = 0;
    const sessionStart = Date.now();

    console.log(`[OPENAI AGENT] ┌ START  ${agentName}  userId=${userId}`);

    try {
        while (turns < MAX_TURNS) {
            turns++;

            const llmStart = Date.now();
            const response = await client.chat.completions.create({
                model,
                max_tokens:  maxTokens,
                temperature,
                tools:       openaiTools,
                tool_choice: 'auto',
                messages,
            });

            const choice  = response.choices[0];
            const message = choice.message;
            const llmMs   = Date.now() - llmStart;

            console.log(`[OPENAI AGENT] │ turn=${turns}  finish=${choice.finish_reason}  (${llmMs}ms)`);

            // Always push the assistant message back into history
            messages.push(message);

            // ── Final answer ───────────────────────────────────────────────
            if (choice.finish_reason === 'stop') {
                const text = message.content || '';
                console.log(`[OPENAI AGENT] └ END  ${agentName}  turns=${turns}  tools=[${toolCalls.join('→')}]  time=${Date.now() - sessionStart}ms`);
                return { text, turns, toolCalls };
            }

            // ── Tool call round ────────────────────────────────────────────
            if (choice.finish_reason === 'tool_calls') {
                const toolMessages = [];

                for (const tc of (message.tool_calls || [])) {
                    const name = tc.function.name;
                    let   input;
                    try { input = JSON.parse(tc.function.arguments); }
                    catch { input = {}; }

                    toolCalls.push(name);
                    console.log(`[OPENAI AGENT] │   → TOOL  ${name}  ${JSON.stringify(input).slice(0, 80)}`);

                    const executor = executors[name];
                    let   content;

                    if (!executor) {
                        content = JSON.stringify({ error: `No executor registered for "${name}"` });
                    } else {
                        const toolStart = Date.now();
                        try {
                            const result = await executor(input);
                            const ms     = Date.now() - toolStart;
                            const summary = JSON.stringify(result);
                            console.log(`[OPENAI AGENT] │   ✓ TOOL  ${name}  ${summary.slice(0, 120)}…  (${ms}ms)`);
                            content = summary;
                        } catch (err) {
                            console.log(`[OPENAI AGENT] │   ✗ TOOL  ${name}  ERROR: ${err.message}`);
                            content = JSON.stringify({ error: err.message });
                        }
                    }

                    toolMessages.push({
                        role:         'tool',
                        tool_call_id: tc.id,
                        content,
                    });
                }

                messages.push(...toolMessages);
                continue;
            }

            // content_filter or other terminal reasons — return whatever text we have
            const text = message.content || '';
            console.log(`[OPENAI AGENT] └ END (${choice.finish_reason})  ${agentName}  turns=${turns}`);
            return { text, turns, toolCalls };
        }

        throw new Error(`Agent did not finish within ${MAX_TURNS} turns`);

    } catch (err) {
        console.error(`[OPENAI AGENT] └ ERROR  ${agentName}: ${err.message}`);
        throw err;
    }
}

module.exports = { runOpenAIAgent };
