'use strict';

/**
 * Seeds the lab_test_info table from extra/drug_list/medlineplus_parsed.json.
 * Safe to re-run — uses ON CONFLICT DO UPDATE (upsert).
 *
 * Run: node src/database/seed_lab_test_info.js
 */

const dotenv = require('dotenv');
const fs     = require('fs');
const path   = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_Connection = require('./db.js');

const DATA_FILE  = path.resolve(__dirname, '../../../extra/drug_list/medlineplus_parsed.json');
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 100;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function insertBatch(client, rows) {
    if (rows.length === 0) return 0;

    const values = [];
    const params = [];
    let   p      = 1;

    for (const row of rows) {
        values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
        params.push(
            row.name,
            row.name.toLowerCase().trim(),
            row.source          || null,
            row.reference_range || null,
            row.normal          || null,
            row.high            || null,
            row.low             || null,
        );
    }

    const sql = `
        INSERT INTO lab_test_info
            (name, name_lower, source, reference_range, normal_meaning, high_meaning, low_meaning)
        VALUES ${values.join(', ')}
        ON CONFLICT (name_lower) DO UPDATE SET
            name            = EXCLUDED.name,
            source          = EXCLUDED.source,
            reference_range = EXCLUDED.reference_range,
            normal_meaning  = EXCLUDED.normal_meaning,
            high_meaning    = EXCLUDED.high_meaning,
            low_meaning     = EXCLUDED.low_meaning
    `;

    await client.query(sql, params);
    return rows.length;
}

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error('[ERROR] DATABASE_URL not set.');
        process.exit(1);
    }

    if (!fs.existsSync(DATA_FILE)) {
        console.error(`[ERROR] Data file not found:\n        ${DATA_FILE}`);
        console.error('[INFO]  Run  node extra/parse_medlineplus.js  first to generate it.');
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    // Skip entries that errored during parsing
    const entries = raw.filter(e => e.name && !e._error);
    const skipped = raw.length - entries.length;
    if (skipped > 0) console.warn(`[WARN]  Skipping ${skipped} entries that have _error set.`);
    console.log(`[INFO]  ${entries.length} entries to upsert from ${path.basename(DATA_FILE)}`);

    const db     = DB_Connection.getInstance();
    const client = await db.pool.connect();

    let total = 0;
    try {
        await client.query('BEGIN');

        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE);
            const n = await insertBatch(client, batch);
            total += n;
            console.log(`[INFO]  Upserted ${total}/${entries.length} — last: ${batch[batch.length - 1].name}`);
            if (i + BATCH_SIZE < entries.length) await sleep(BATCH_DELAY_MS);
        }

        await client.query('COMMIT');
        console.log(`[OK]    Committed ${total} rows.`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ERROR] Seed failed — rolled back.');
        console.error('        ' + err.message);
        client.release();
        await db.pool.end();
        process.exit(1);
    }

    client.release();

    // Quick row count verification
    try {
        const r = await db.query_executor('SELECT COUNT(*) AS cnt FROM lab_test_info');
        console.log(`[INFO]  lab_test_info now has ${r.rows[0].cnt} rows total.`);
    } catch (err) {
        console.warn('[WARN]  Count check failed:', err.message);
    }

    await db.pool.end();
    console.log('[DONE]');
}

run();
