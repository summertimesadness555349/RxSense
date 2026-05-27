'use strict';

/**
 * Creates the prescription_scan table.
 * Run once: node migrate_prescription_scan.js
 */

const dotenv = require('dotenv');
const path   = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_Connection = require('./db.js');

const SQL = `
CREATE TABLE IF NOT EXISTS prescription_scan (
    scan_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    patient_id       UUID        REFERENCES patient(patient_id) ON DELETE SET NULL,
    image_url        TEXT        NOT NULL,
    image_public_id  TEXT,
    doctor_name      VARCHAR(200),
    doctor_specialty VARCHAR(200),
    hospital_name    VARCHAR(200),
    patient_name_rx  VARCHAR(200),
    rx_date          TEXT,
    diseases         JSONB       NOT NULL DEFAULT '[]',
    tests            JSONB       NOT NULL DEFAULT '[]',
    medications      JSONB       NOT NULL DEFAULT '[]',
    notes            TEXT,
    follow_up        TEXT,
    confidence       INTEGER,
    models_used      JSONB       NOT NULL DEFAULT '[]',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ps_user_id    ON prescription_scan (user_id);
CREATE INDEX IF NOT EXISTS idx_ps_patient_id ON prescription_scan (patient_id);
CREATE INDEX IF NOT EXISTS idx_ps_created_at ON prescription_scan (created_at DESC);
`;

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error('[ERROR] DATABASE_URL not set.');
        process.exit(1);
    }
    const db     = DB_Connection.getInstance();
    const client = await db.pool.connect();

    console.log('[INFO]  Creating prescription_scan table...');
    try {
        await client.query('BEGIN');
        await client.query(SQL);
        await client.query('COMMIT');
        console.log('[OK]    Done.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ERROR]', err.message);
        client.release();
        await db.pool.end();
        process.exit(1);
    }
    client.release();
    await db.pool.end();
}

run();
