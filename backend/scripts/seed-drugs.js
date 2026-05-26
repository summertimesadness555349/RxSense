const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../src/.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = require('pg');
const drugs = require('../../extra/drug_list/drug_name_list_bd.json');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function seed() {
    const client = await pool.connect();
    try {
        console.log('Enabling extensions...');
        await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        await client.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch');

        console.log('Creating drugs table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS drugs (
                id      INTEGER PRIMARY KEY,
                brand   TEXT NOT NULL,
                generic TEXT,
                strength TEXT,
                packsize TEXT,
                form    TEXT,
                company TEXT
            )
        `);

        console.log('Creating trigram indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_drugs_brand_trgm
            ON drugs USING gin (brand gin_trgm_ops)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_drugs_generic_trgm
            ON drugs USING gin (COALESCE(generic, '') gin_trgm_ops)
        `);

        const { rows: existing } = await client.query('SELECT COUNT(*) AS n FROM drugs');
        if (parseInt(existing[0].n) >= drugs.length) {
            console.log(`Already seeded (${existing[0].n} rows). Nothing to do.`);
            return;
        }

        console.log(`Seeding ${drugs.length} drugs in chunks of 500...`);
        const CHUNK = 500;
        let inserted = 0;

        for (let i = 0; i < drugs.length; i += CHUNK) {
            const chunk = drugs.slice(i, i + CHUNK);
            const placeholders = [];
            const values = [];
            let idx = 1;

            for (const d of chunk) {
                placeholders.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`);
                values.push(d.id, d.brand || '', d.generic || null, d.strength || null, d.packsize || null, d.form || null, d.company || null);
            }

            await client.query(
                `INSERT INTO drugs (id, brand, generic, strength, packsize, form, company)
                 VALUES ${placeholders.join(',')}
                 ON CONFLICT (id) DO NOTHING`,
                values
            );

            inserted += chunk.length;
            process.stdout.write(`\r  ${inserted} / ${drugs.length}`);
        }

        const { rows: final } = await client.query('SELECT COUNT(*) AS n FROM drugs');
        console.log(`\nDone. ${final[0].n} drugs in table.`);
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(err => { console.error(err); process.exit(1); });
