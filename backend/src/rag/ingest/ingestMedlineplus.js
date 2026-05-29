'use strict';

// Vectorizes the MedlinePlus medical knowledge base already in extra/medlineplus_scraped_raw.json
// Run: node src/rag/ingest/ingestMedlineplus.js
//
// Each entry becomes one chunk with source_type = 'medical_book', weight = 1.0
// so it participates in the same weighted retrieval as book chunks.

const path   = require('path');
const fs     = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const { embedTexts } = require('../embeddings.js');
const DB_Connection  = require('../../database/db.js');

const SOURCE_FILE = path.resolve(__dirname, '../../../../extra/medlineplus_scraped_raw.json');
const EMBED_BATCH  = 100;
const INSERT_BATCH = 300;
const BOOK_SLUG    = 'medlineplus';
const BOOK_TITLE   = 'MedlinePlus Medical Encyclopedia';
const WEIGHT       = 1.0;

function buildContent(entry) {
    // Prepend topic header — same pattern as book chunks so retrieval is uniform
    return `[Source: ${BOOK_TITLE} | Topic: ${entry.name}]\n\n${entry.text.trim()}`;
}

async function bulkInsert(pool, rows) {
    if (!rows.length) return;
    const vals = [];
    const placeholders = rows.map((r, i) => {
        const n = i * 5;
        vals.push(r.content, `[${r.embedding.join(',')}]`, 'medical_book', WEIGHT, JSON.stringify(r.metadata));
        return `($${n+1}, $${n+2}::vector, $${n+3}, $${n+4}, $${n+5}::jsonb)`;
    });
    await pool.query(
        `INSERT INTO rag_documents (content, embedding, source_type, weight, metadata)
         VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
        vals,
    );
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    const db   = DB_Connection.getInstance();
    const pool = db.pool;
    const args = process.argv.slice(2);

    // Skip-if-exists
    if (!args.includes('--force')) {
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS cnt FROM rag_documents
             WHERE source_type = 'medical_book' AND metadata->>'book' = $1`,
            [BOOK_SLUG],
        );
        if (rows[0].cnt > 0) {
            console.log(`⏭  MedlinePlus already in DB (${rows[0].cnt} entries). Use --force to re-ingest.`);
            process.exit(0);
        }
    } else {
        await pool.query(
            `DELETE FROM rag_documents WHERE source_type = 'medical_book' AND metadata->>'book' = $1`,
            [BOOK_SLUG],
        );
    }

    console.log(`▶  Ingesting ${BOOK_TITLE} from ${path.basename(SOURCE_FILE)}`);
    const raw     = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    const entries = Object.values(raw).filter(e => e.name && e.text && e.text.trim().length > 40);
    console.log(`   Entries: ${entries.length}`);

    let rowBuf   = [];
    let inserted = 0;

    for (let i = 0; i < entries.length; i += EMBED_BATCH) {
        const batch   = entries.slice(i, i + EMBED_BATCH);
        const texts   = batch.map(buildContent);
        const vectors = await embedTexts(texts);

        for (let j = 0; j < batch.length; j++) {
            rowBuf.push({
                content:   texts[j],
                embedding: vectors[j],
                metadata:  { book: BOOK_SLUG, book_title: BOOK_TITLE, topic: batch[j].name, url: batch[j].url || null },
            });
        }

        if (rowBuf.length >= INSERT_BATCH) {
            await bulkInsert(pool, rowBuf);
            inserted += rowBuf.length;
            rowBuf = [];
        }

        const pct = Math.round(((i + batch.length) / entries.length) * 100);
        process.stdout.write(`\r   Progress: ${i + batch.length}/${entries.length} (${pct}%)  `);
        await sleep(300);
    }

    if (rowBuf.length) {
        await bulkInsert(pool, rowBuf);
        inserted += rowBuf.length;
    }

    console.log(`\n✅  ${inserted} MedlinePlus entries vectorized and stored.`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Ingestion failed:', err.message);
    process.exit(1);
});
