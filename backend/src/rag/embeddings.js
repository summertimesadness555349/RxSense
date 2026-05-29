'use strict';

const { OpenAI } = require('openai');

const MODEL      = 'text-embedding-3-small';
const DIMENSIONS = 1536;

let _client = null;

function getClient() {
    if (!_client) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY not set in environment');
        _client = new OpenAI({ apiKey });
    }
    return _client;
}

// Embed a batch of texts in one API call (max 2048 inputs per call).
async function embedTexts(texts) {
    if (!texts.length) return [];
    const res = await getClient().embeddings.create({
        model:      MODEL,
        input:      texts,
        dimensions: DIMENSIONS,
    });
    // API returns results in the same order as input
    return res.data.map(d => d.embedding);
}

async function embedSingle(text) {
    const [vec] = await embedTexts([text]);
    return vec;
}

module.exports = { embedTexts, embedSingle, DIMENSIONS };
