'use strict';

const dotenv = require('dotenv');
const path   = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_Connection = require('./db.js');

const SQL = `
-- Add share code column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_share_code VARCHAR(12) UNIQUE;

-- Family link table
CREATE TABLE IF NOT EXISTS family_link (
  link_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship  VARCHAR(50) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_link  CHECK (requester_id <> member_id),
  UNIQUE (requester_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_fl_requester ON family_link (requester_id);
CREATE INDEX IF NOT EXISTS idx_fl_member    ON family_link (member_id);
`;

async function migrate() {
    const db     = DB_Connection.getInstance();
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(SQL);
        await client.query('COMMIT');
        console.log('✅  Family migration complete.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌  Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
