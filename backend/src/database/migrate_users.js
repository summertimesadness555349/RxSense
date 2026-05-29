'use strict';

/**
 * Auth restructure migration
 * Adds users table as the central auth store and adds user_id FK
 * columns to patient and doctor tables.
 *
 * Run once: node migrate_users.js
 */

const dotenv = require('dotenv');
const path   = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_Connection = require('./db.js');

const MIGRATION_SQL = `
-- Create users table if it does not exist
CREATE TABLE IF NOT EXISTS users (
    id                   SERIAL        PRIMARY KEY,
    username             VARCHAR(50)   UNIQUE NOT NULL,
    email                VARCHAR(255)  UNIQUE NOT NULL,
    password_hash        VARCHAR(255)  NOT NULL,
    full_name            VARCHAR(255),
    is_active            BOOLEAN       DEFAULT true,
    email_verified       BOOLEAN       DEFAULT true,
    verification_token   VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login           TIMESTAMP,
    login_attempts       INTEGER       DEFAULT 0,
    locked_until         TIMESTAMP,
    refresh_token        TEXT,
    google_id            VARCHAR(100)  UNIQUE,
    provider             VARCHAR(50),
    avatar_url           TEXT,
    subscription_type    VARCHAR(20)   NOT NULL DEFAULT 'free',
    created_at           TIMESTAMP     DEFAULT NOW(),
    updated_at           TIMESTAMP     DEFAULT NOW()
);

-- Add role column if not present (table may already exist without it)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'patient';

CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users (role);

-- Add user_id FK to patient (nullable so existing rows are preserved)
ALTER TABLE patient ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- Add user_id FK to doctor (nullable so existing rows are preserved)
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
`;

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error('[ERROR] DATABASE_URL is not set.');
        process.exit(1);
    }

    const db     = DB_Connection.getInstance();
    const client = await db.pool.connect();

    console.log('[INFO]  Running auth restructure migration...');

    try {
        await client.query('BEGIN');
        await client.query(MIGRATION_SQL);
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
        const result = await db.query_executor(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name IN ('users','patient','doctor')
            ORDER BY table_name
        `);
        console.log('[INFO]  Tables found:', result.rows.map(r => r.table_name).join(', '));

        const cols = await db.query_executor(`
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND ((table_name = 'patient' AND column_name = 'user_id')
                OR (table_name = 'doctor'  AND column_name = 'user_id'))
            ORDER BY table_name
        `);
        cols.rows.forEach(r => console.log(`[OK]    ${r.table_name}.${r.column_name} column present`));
    } catch (err) {
        console.warn('[WARN]  Verification query failed:', err.message);
    }

    await db.pool.end();
    console.log('[DONE]  Auth migration complete.');
}

run();
