'use strict';

/**
 * Inserts drug interactions from CSV into the drug_interactions table.
 * Run once (or re-run safely): node src/database/migrate_drug_interactions.js
 */

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_Connection = require('./db.js');

const CSV_PATH = path.resolve(__dirname, '../../../extra/db_drug_interactions.csv');
const DEFAULT_SEVERITY = process.env.DRUG_INTERACTION_SEVERITY || 'moderate';
const VALID_SEVERITIES = new Set(['mild', 'moderate', 'severe', 'critical']);
const BATCH_SIZE = 500;

const SETUP_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
	CREATE TYPE severity_type AS ENUM ('mild', 'moderate', 'severe', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS drug_interactions (
	interaction_id   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
	drug_a           VARCHAR(300),
	drug_b           VARCHAR(300),
	severity         severity_type NOT NULL,
	description      TEXT,

	CONSTRAINT no_self_interaction CHECK (drug_a NOT ILIKE drug_b),
	UNIQUE (drug_a, drug_b)
);
`;

function parseCsvLine(line) {
	const cells = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];

		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (ch === ',' && !inQuotes) {
			cells.push(current);
			current = '';
			continue;
		}

		current += ch;
	}

	cells.push(current);
	return cells;
}

function parseCsvRows(csvText) {
	const lines = csvText
		.split(/\r?\n/)
		.map(line => line.trimEnd())
		.filter(line => line.length > 0);

	if (!lines.length) {
		return [];
	}

	const rows = [];
	for (let i = 1; i < lines.length; i++) {
		rows.push(parseCsvLine(lines[i]));
	}

	return rows;
}

function buildInsert(batch) {
	const params = [];
	const values = batch.map((row, index) => {
		const base = index * 4;
		params.push(row.drugA, row.drugB, row.severity, row.description);
		return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
	});

	const sql = `
		INSERT INTO drug_interactions (drug_a, drug_b, severity, description)
		VALUES ${values.join(', ')}
		ON CONFLICT (drug_a, drug_b)
		DO UPDATE SET
			severity = EXCLUDED.severity,
			description = EXCLUDED.description
	`;

	return { sql, params };
}

async function run() {
	if (!process.env.DATABASE_URL) {
		console.error('[ERROR] DATABASE_URL not set.');
		process.exit(1);
	}

	if (!VALID_SEVERITIES.has(DEFAULT_SEVERITY)) {
		console.error('[ERROR] Invalid DRUG_INTERACTION_SEVERITY:', DEFAULT_SEVERITY);
		console.error('        Valid values: mild, moderate, severe, critical');
		process.exit(1);
	}

	if (!fs.existsSync(CSV_PATH)) {
		console.error('[ERROR] CSV not found at:', CSV_PATH);
		process.exit(1);
	}

	const csvText = fs.readFileSync(CSV_PATH, 'utf8');
	const csvRows = parseCsvRows(csvText);

	const records = [];
	const seen = new Set();
	let skippedEmpty = 0;
	let skippedSelf = 0;

	for (const row of csvRows) {
		if (row.length < 3) {
			skippedEmpty += 1;
			continue;
		}

		const drugA = (row[0] || '').trim();
		const drugB = (row[1] || '').trim();
		const description = row.slice(2).join(',').trim();

		if (!drugA || !drugB) {
			skippedEmpty += 1;
			continue;
		}

		if (drugA.toLowerCase() === drugB.toLowerCase()) {
			skippedSelf += 1;
			continue;
		}

		const key = `${drugA}|||${drugB}`;
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		records.push({
			drugA,
			drugB,
			severity: DEFAULT_SEVERITY,
			description: description || null,
		});
	}

	const db = DB_Connection.getInstance();
	const client = await db.pool.connect();

	console.log(`[INFO]  Parsed ${csvRows.length} rows, ${records.length} ready for insert.`);
	if (skippedEmpty) console.log(`[INFO]  Skipped ${skippedEmpty} rows with missing fields.`);
	if (skippedSelf) console.log(`[INFO]  Skipped ${skippedSelf} self-interactions.`);

	try {
		await client.query('BEGIN');
		await client.query(SETUP_SQL);

		for (let i = 0; i < records.length; i += BATCH_SIZE) {
			const batch = records.slice(i, i + BATCH_SIZE);
			const { sql, params } = buildInsert(batch);
			await client.query(sql, params);
		}

		await client.query('COMMIT');
		console.log('[OK]    Drug interactions inserted.');
	} catch (err) {
		await client.query('ROLLBACK');
		console.error('[ERROR] Insert failed — rolled back.');
		console.error('        ' + err.message);
		client.release();
		await db.pool.end();
		process.exit(1);
	}

	client.release();
	await db.pool.end();
	console.log('[DONE]');
}

run();
