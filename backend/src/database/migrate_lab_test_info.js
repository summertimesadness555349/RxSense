'use strict';

/**
 * Creates the lab_test_info table (MedlinePlus-sourced patient-friendly explanations).
 * Run once: node src/database/migrate_lab_test_info.js
 */

const dotenv = require('dotenv');
const path   = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_Connection = require('./db.js');

const SQL = `
-- Trigram extension for fuzzy name matching (may already exist)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS lab_test_info (
    id              SERIAL       PRIMARY KEY,
    name            VARCHAR(400) NOT NULL,
    name_lower      VARCHAR(400) NOT NULL,   -- lowercased name, used for lookups
    source          TEXT,                    -- MedlinePlus URL
    reference_range TEXT,                    -- human-readable range string, or null
    normal_meaning  TEXT,                    -- what a normal result means (patient-friendly)
    high_meaning    TEXT,                    -- what a high/positive result may indicate
    low_meaning     TEXT,                    -- what a low/negative result may indicate
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on lowercased name so upserts are idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_lti_name_lower ON lab_test_info (name_lower);

-- GIN trigram index for fast fuzzy search by label (e.g. "alt" matching "ALT Blood Test")
CREATE INDEX IF NOT EXISTS idx_lti_name_trgm ON lab_test_info USING gin (name_lower gin_trgm_ops);
`;

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error('[ERROR] DATABASE_URL not set.');
        process.exit(1);
    }

    const db     = DB_Connection.getInstance();
    const client = await db.pool.connect();

    console.log('[INFO]  Creating lab_test_info table...');
    try {
        await client.query('BEGIN');
        await client.query(SQL);
        await client.query('COMMIT');
        console.log('[OK]    Migration committed.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ERROR] Migration failed — rolled back.');
        console.error('        ' + err.message);
        client.release();
        await db.pool.end();
        process.exit(1);
    }

    client.release();

    // Verify
    try {
        const r = await db.query_executor(`
            SELECT column_name, data_type
            FROM   information_schema.columns
            WHERE  table_schema = 'public' AND table_name = 'lab_test_info'
            ORDER  BY ordinal_position
        `);
        console.log(`[INFO]  Columns created (${r.rowCount}):`);
        r.rows.forEach(c => console.log(`        ${c.column_name.padEnd(25)} ${c.data_type}`));
    } catch (err) {
        console.warn('[WARN]  Verification failed:', err.message);
    }

    await db.pool.end();
    console.log('[DONE]');
}

run();
