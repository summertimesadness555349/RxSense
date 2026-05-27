'use strict';

/**
 * Creates the drugbank_drug table.
 * Run once: node migrate_drugbank.js
 */

const dotenv = require('dotenv');
const path   = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_Connection = require('./db.js');

const SQL = `
-- Enable trigram extension for fuzzy name search (may already exist)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS drugbank_drug (
    id                    SERIAL       PRIMARY KEY,
    drugbank_id           VARCHAR(20)  UNIQUE NOT NULL,  -- e.g. DB00001
    drug_type             VARCHAR(50),                   -- biotech | small molecule | etc.
    name                  VARCHAR(300) NOT NULL,
    description           TEXT,
    indication            TEXT,          -- what the drug treats (most useful for patients)
    pharmacodynamics      TEXT,          -- what it does in the body
    mechanism_of_action   TEXT,          -- how it works
    toxicity              TEXT,
    metabolism            TEXT,
    absorption            TEXT,
    half_life             VARCHAR(500),
    protein_binding       TEXT,
    route_of_elimination  TEXT,
    volume_of_distribution TEXT,
    clearance             TEXT,
    state                 VARCHAR(50),  -- liquid | solid | gas | solution
    cas_number            VARCHAR(50),
    unii                  VARCHAR(50),

    -- Array-like data stored as JSONB
    groups                JSONB  NOT NULL DEFAULT '[]',  -- ["approved","investigational"]
    synonyms              JSONB  NOT NULL DEFAULT '[]',  -- ["Hirudin variant-1", ...]
    brand_names           JSONB  NOT NULL DEFAULT '[]',  -- ["Refludan", "Pradaxa", ...]
    categories            JSONB  NOT NULL DEFAULT '[]',  -- [{"name":"Anticoagulants","mesh_id":"D000925"}, ...]
    products              JSONB  NOT NULL DEFAULT '[]',  -- [{name, dosage_form, strength, route}, ...]

    -- Drug classification hierarchy
    classification_kingdom    VARCHAR(200),
    classification_superclass VARCHAR(200),
    classification_class      VARCHAR(200),
    classification_subclass   VARCHAR(200),
    classification_parent     VARCHAR(200),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast exact and prefix lookup by name
CREATE INDEX IF NOT EXISTS idx_dbd_name        ON drugbank_drug (name);
CREATE INDEX IF NOT EXISTS idx_dbd_drugbank_id ON drugbank_drug (drugbank_id);

-- Trigram index for fuzzy name search (used by chatbot drug lookup)
CREATE INDEX IF NOT EXISTS idx_dbd_name_trgm   ON drugbank_drug USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dbd_groups      ON drugbank_drug USING gin (groups);
`;

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error('[ERROR] DATABASE_URL not set.');
        process.exit(1);
    }

    const db     = DB_Connection.getInstance();
    const client = await db.pool.connect();

    console.log('[INFO]  Creating drugbank_drug table...');
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
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'drugbank_drug'
            ORDER BY ordinal_position
        `);
        console.log(`[INFO]  Columns created (${r.rowCount}):`);
        r.rows.forEach(c => console.log(`        ${c.column_name.padEnd(30)} ${c.data_type}`));
    } catch (err) {
        console.warn('[WARN]  Verification failed:', err.message);
    }

    await db.pool.end();
    console.log('[DONE]');
}

run();
