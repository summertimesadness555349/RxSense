'use strict';

const dotenv = require('dotenv');
const path   = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DB_Connection = require('./db.js');

const COLUMNS = [
  `ALTER TABLE patient ADD COLUMN IF NOT EXISTS blood_group              VARCHAR(5)`,
  `ALTER TABLE patient ADD COLUMN IF NOT EXISTS smoking_status           VARCHAR(20)  DEFAULT 'non_smoker'`,
  `ALTER TABLE patient ADD COLUMN IF NOT EXISTS blood_pressure_systolic  SMALLINT`,
  `ALTER TABLE patient ADD COLUMN IF NOT EXISTS blood_pressure_diastolic SMALLINT`,
  `ALTER TABLE patient ADD COLUMN IF NOT EXISTS bp_recorded_at           TIMESTAMPTZ`,
  `ALTER TABLE patient ADD COLUMN IF NOT EXISTS emergency_contact_name   VARCHAR(150)`,
  `ALTER TABLE patient ADD COLUMN IF NOT EXISTS emergency_contact_phone  VARCHAR(20)`,
  `ALTER TABLE patient ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(50)`,
];

async function migrate() {
  const db     = DB_Connection.getInstance();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const stmt of COLUMNS) {
      await client.query(stmt);
      console.log(`✓  ${stmt.replace('ALTER TABLE patient ADD COLUMN IF NOT EXISTS ', '').split(' ')[0]}`);
    }
    await client.query('COMMIT');
    console.log('\n✅  Patient vitals migration complete.');
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
