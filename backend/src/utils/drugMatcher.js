const DB_Connection = require('../database/db.js');

const db = DB_Connection.getInstance();

async function fuzzyMatchDrug(token, limit = 5) {
    const result = await db.query_executor(
        `SELECT brand, generic, strength, form, company,
                similarity(brand, $1) AS brand_sim,
                similarity(COALESCE(generic, ''), $1) AS generic_sim
         FROM drugs
         WHERE brand % $1 OR COALESCE(generic, '') % $1
         ORDER BY GREATEST(
             similarity(brand, $1),
             similarity(COALESCE(generic, ''), $1)
         ) DESC
         LIMIT $2`,
        [token, limit]
    );
    return result.rows;
}

async function matchAllTokens(tokens) {
    const candidates = {};
    for (const token of tokens) {
        if (token.length < 3) continue;
        candidates[token] = await fuzzyMatchDrug(token);
    }
    return candidates;
}

module.exports = { fuzzyMatchDrug, matchAllTokens };
