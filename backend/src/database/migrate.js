/**
 * RxSense — Neon DB Migration Runner
 * ------------------------------------
 * Uses your existing DB_Connection singleton from db.js.
 *
 * HOW TO USE
 * ----------
 * 1. Place migrate.js, db.js, schema.sql, and .env in the same folder.
 * (adjust the require path on line 20 if db.js lives elsewhere)
 *
 * 2. .env must contain:
 * DATABASE_URL=postgresql://USER:PASS@HOST/DBNAME?sslmode=require
 *
 * 3. npm install pg dotenv   (if not already done)
 *
 * 4. node migrate.js
 */

'use strict';

const dotenv = require('dotenv');
const fs     = require('fs');
const path   = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_Connection = require('./db.js');   // ← adjust path if needed

// ─── Logging ─────────────────────────────────────────────────────
const log = {
  info:    (m) => console.log(`\x1b[36m[INFO]\x1b[0m  ${m}`),
  success: (m) => console.log(`\x1b[32m[OK]\x1b[0m    ${m}`),
  warn:    (m) => console.log(`\x1b[33m[WARN]\x1b[0m  ${m}`),
  error:   (m) => console.error(`\x1b[31m[ERROR]\x1b[0m ${m}`),
  step:    (n, t, m) => console.log(`\x1b[90m  [${n}/${t}]\x1b[0m ${m}`),
};

// ─── SQL splitter ────────────────────────────────────────────────
// Splits schema.sql into individual executable statements.
function splitStatements(sql) {
  // 1. Remove block comments /* ... */
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');

  return sql
    .split(/;\s*(?:\r?\n|$)/)            // works on both \n and \r\n (Windows)
    .map(chunk =>
      chunk
        .split(/\r?\n/)                  // split into lines
        .filter(line => !line.trim().startsWith('--'))  // drop comment lines only
        .join('\n')
        .trim()
    )
    .filter(s => s.length > 0);         // discard blank chunks
}

// ─── Expected tables after migration ────────────────────────────
const EXPECTED_TABLES = [
  'ai_risk_assessment',
  'doctor',
  'doctor_hospital',
  'drug',
  'drug_interaction',
  'hospital',
  'llm_query_log',
  'medical_report',
  'patient',
  'patient_allergy',
  'prescription',
  'prescription_item',
  'report_metric',
  'symptom_log',
];

// ─── Main ────────────────────────────────────────────────────────
async function migrate() {
  if (!process.env.DATABASE_URL) {
    log.error('DATABASE_URL is not set. Add it to your .env file.');
    process.exit(1);
  }

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    log.error(`schema.sql not found at: ${schemaPath}`);
    process.exit(1);
  }
  const schemaSQL  = fs.readFileSync(schemaPath, 'utf8');
  const statements = splitStatements(schemaSQL);

  const db     = DB_Connection.getInstance();
  const client = await db.pool.connect();

  log.info('DB_Connection singleton acquired');
  log.info(`Connected to Neon DB`);
  log.info(`Found ${statements.length} SQL statements\n`);

  // ── Run in a single transaction ──────────────────────────────
  try {
    await client.query('BEGIN');

    for (let i = 0; i < statements.length; i++) {
      const stmt    = statements[i];
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
      log.step(i + 1, statements.length, preview + (stmt.length > 80 ? '…' : ''));

      await client.query(stmt);
    }

    await client.query('COMMIT');
    console.log();
    log.success('Migration committed!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.log();
    log.error('Migration FAILED — rolled back. Nothing was changed.');
    log.error(err.message);
    if (err.position) log.warn(`Near position ${err.position} in schema.sql`);
    
    client.release();
    await db.pool.end();
    process.exit(1);
  }

  client.release();

  // ── Verify ───────────────────────────────────────────────────
  console.log();
  log.info('Verifying tables …');

  try {
    const result = await db.query_executor(`
      SELECT table_name
      FROM   information_schema.tables
      WHERE  table_schema = 'public'
      ORDER  BY table_name;
    `);

    const found  = result.rows.map(r => r.table_name);
    let   allGood = true;

    for (const t of EXPECTED_TABLES) {
      if (found.includes(t)) {
        log.success(`  ✔  ${t}`);
      } else {
        log.warn(`  ✘  ${t} — missing`);
        allGood = false;
      }
    }

    console.log();
    allGood
      ? log.success('All 14 tables verified. RxSense DB is ready! 🎉')
      : log.warn('Some tables are missing — check the output above.');

  } catch (err) {
    log.error(`Verification query failed: ${err.message}`);
  }

  await db.pool.end();
}

migrate();