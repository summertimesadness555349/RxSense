'use strict';

const dotenv = require('dotenv');
const path   = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_Connection = require('./db.js');

const SQL = `
ALTER TABLE medical_report ADD COLUMN IF NOT EXISTS image_url       TEXT;
ALTER TABLE medical_report ADD COLUMN IF NOT EXISTS image_public_id TEXT;
ALTER TABLE medical_report ADD COLUMN IF NOT EXISTS raw_analysis    JSONB;
ALTER TABLE medical_report ADD COLUMN IF NOT EXISTS report_date     TEXT;
ALTER TABLE medical_report ADD COLUMN IF NOT EXISTS facility        TEXT;
ALTER TABLE medical_report ADD COLUMN IF NOT EXISTS ordering_doctor TEXT;
ALTER TABLE medical_report ADD COLUMN IF NOT EXISTS patient_name_rep TEXT;
`;

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error('[ERROR] DATABASE_URL is not set.');
        process.exit(1);
    }

    const db     = DB_Connection.getInstance();
    const client = await db.pool.connect();

    console.log('[INFO]  Running medical_report extended migration...');

    try {
        await client.query('BEGIN');
        await client.query(SQL);
        await client.query('COMMIT');
        console.log('[OK]    Migration committed.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ERROR] Migration failed:', err.message);
        client.release();
        await db.pool.end();
        process.exit(1);
    }

    client.release();

    // Verify
    const cols = await db.query_executor(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medical_report'
        ORDER BY ordinal_position
    `);
    console.log('[INFO]  medical_report columns:', cols.rows.map(r => r.column_name).join(', '));

    await db.pool.end();
    console.log('[DONE]  Report extended migration complete.');
}

run();
