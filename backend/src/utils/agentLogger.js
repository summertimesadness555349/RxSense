'use strict';

// Structured logger for agent calls.
// All output goes to stdout so it flows through Morgan / Winston / Docker logs.
// Format: [AGENT] <event> | <fields as key=value>

const PAD = 18;   // field key padding

function ts() {
    return new Date().toISOString();
}

function kv(obj) {
    return Object.entries(obj)
        .map(([k, v]) => {
            const key   = k.padEnd(PAD);
            const value = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
            return `  ${key} ${value}`;
        })
        .join('\n');
}

function line(char = '─', len = 64) {
    return char.repeat(len);
}

const AgentLogger = {

    // Called when an agent session starts
    sessionStart({ agentName, userId, input }) {
        console.log([
            `\n[AGENT] ┌ ${line()}`,
            `[AGENT] │ START  ${agentName}`,
            `[AGENT] │`,
            kv({ timestamp: ts(), userId, inputLength: input?.length ?? 0 }),
            `[AGENT] │ input: ${String(input ?? '').slice(0, 120)}${input?.length > 120 ? '…' : ''}`,
            `[AGENT] │`,
        ].join('\n'));
    },

    // Called before each Claude API request
    llmCall({ turn, model, tools, messageCount }) {
        console.log([
            `[AGENT] │ ◆ LLM CALL   turn=${turn}  model=${model}  tools=[${tools.join(', ')}]  msgs=${messageCount}`,
        ].join('\n'));
    },

    // Called when Claude decides to use a tool
    toolCall({ turn, toolName, input }) {
        const inputStr = JSON.stringify(input ?? {});
        console.log([
            `[AGENT] │   → TOOL  ${toolName.padEnd(24)} ${inputStr.slice(0, 120)}${inputStr.length > 120 ? '…' : ''}`,
        ].join('\n'));
    },

    // Called after tool execution completes
    toolResult({ toolName, durationMs, resultSummary, error }) {
        if (error) {
            console.log(`[AGENT] │   ✗ TOOL  ${toolName.padEnd(24)} ERROR: ${error}  (${durationMs}ms)`);
        } else {
            console.log(`[AGENT] │   ✓ TOOL  ${toolName.padEnd(24)} ${resultSummary}  (${durationMs}ms)`);
        }
    },

    // Called when agent finishes successfully
    sessionEnd({ agentName, turns, toolCalls, durationMs, outputLength }) {
        console.log([
            `[AGENT] │`,
            kv({
                turns,
                toolCalls:    toolCalls.join(' → ') || '(none)',
                outputLength: `${outputLength} chars`,
                totalTime:    `${durationMs}ms`,
            }),
            `[AGENT] └ END    ${agentName}  ${line('─', 46)}`,
            '',
        ].join('\n'));
    },

    // Called when agent fails
    sessionError({ agentName, turns, durationMs, error }) {
        console.error([
            `[AGENT] │`,
            kv({ turns, totalTime: `${durationMs}ms`, error }),
            `[AGENT] └ FAIL   ${agentName}  ${line('─', 46)}`,
            '',
        ].join('\n'));
    },
};

module.exports = AgentLogger;
