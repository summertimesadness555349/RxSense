'use strict';

const dotenv = require('dotenv');
const path   = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DB_Connection = require('./db.js');

const COLUMNS = [
  `ALTER TABLE prescription_scan ADD COLUMN IF NOT EXISTS rx_status   VARCHAR(20) DEFAULT 'ongoing'`,
  `ALTER TABLE prescription_scan ADD COLUMN IF NOT EXISTS rx_end_date DATE`,
];

async function migrate() {
  const db     = DB_Connection.getInstance();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const stmt of COLUMNS) {
      await client.query(stmt);
      const col = stmt.match(/ADD COLUMN IF NOT EXISTS (\S+)/)[1];
      console.log(`✓  ${col}`);
    }
    await client.query('COMMIT');
    console.log('\n✅  prescription_scan rx_status migration complete.');
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
