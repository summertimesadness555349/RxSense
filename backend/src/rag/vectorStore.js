'use strict';

const DB_Connection = require('../database/db.js');
const { embedSingle } = require('./embeddings.js');

// Source types and their fixed weights.
// These are enforced at write-time too (ingestBooks.js, chat vectorization, etc.)
const WEIGHTS = {
    medical_book:    1.0,
    patient_report:  0.7,
    patient_profile: 0.6,
    chat_history:    0.3,
};

/**
 * Semantic search over rag_documents.
 *
 * @param {object}   opts
 * @param {string}   opts.query         — natural-language query to embed
 * @param {number}   [opts.userId]      — include user's private docs (null-safe: books always included)
 * @param {string[]} [opts.sourceTypes] — filter to specific source types; omit for all
 * @param {number}   [opts.topK=8]      — number of results to return
 * @param {number}   [opts.minScore=0]  — minimum weighted score threshold (0–1)
 *
 * @returns {Promise<Array<{ id, content, source_type, metadata, score }>>}
 */
async function search({ query, userId = null, sourceTypes = null, topK = 8, minScore = 0 }) {
    const db       = DB_Connection.getInstance();
    const queryVec = await embedSingle(query);
    const vecStr   = `[${queryVec.join(',')}]`;

    // Build WHERE clause dynamically
    const conditions = ['embedding IS NOT NULL'];
    const params     = [vecStr];
    let   p          = 2;

    // Books are global (user_id IS NULL); user docs are private
    conditions.push(`(user_id IS NULL OR user_id = $${p++})`);
    params.push(userId);

    if (sourceTypes && sourceTypes.length > 0) {
        conditions.push(`source_type = ANY($${p++})`);
        params.push(sourceTypes);
    }

    const where = conditions.join(' AND ');

    const sql = `
        SELECT
            id,
            content,
            source_type,
            metadata,
            (1 - (embedding <=> $1::vector)) * weight AS score
        FROM  rag_documents
        WHERE ${where}
        ORDER BY score DESC
        LIMIT $${p}
    `;
    params.push(topK);

    const result = await db.query_executor(sql, params);
    return result.rows.filter(r => parseFloat(r.score) >= minScore);
}

/**
 * Insert a single document into the vector store.
 * Embedding must already be computed (float array).
 */
async function upsert({ content, embedding, sourceType, userId = null, metadata = {} }) {
    const db     = DB_Connection.getInstance();
    const weight = WEIGHTS[sourceType] ?? 1.0;
    const vecStr = `[${embedding.join(',')}]`;

    await db.query_executor(`
        INSERT INTO rag_documents (content, embedding, source_type, weight, user_id, metadata)
        VALUES ($1, $2::vector, $3, $4, $5, $6::jsonb)
    `, [content, vecStr, sourceType, weight, userId, JSON.stringify(metadata)]);
}

module.exports = { search, upsert, WEIGHTS };
