'use strict';

// One-time CLI script.  Run from the backend/ directory:
//
//   node src/rag/ingest/ingestBooks.js
//   node src/rag/ingest/ingestBooks.js --force          (re-ingest even if chunks exist)
//   node src/rag/ingest/ingestBooks.js --book davidsons (single book)
//
// Progress is printed to stdout.  Safe to interrupt and re-run — the
// skip-if-exists check prevents duplicate chunks.

const path   = require('path');
const dotenv = require('dotenv');

// Load env from backend/.env (two levels up from src/rag/ingest/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const { chunkPdf }   = require('./chunkPdf.js');
const { embedTexts } = require('../embeddings.js');
const DB_Connection  = require('../../database/db.js');

// ── Book registry ─────────────────────────────────────────────────────────────
const BOOKS = [
    {
        slug:  'harrisons',
        title: "Harrison's Principles of Internal Medicine (20th Ed.)",
        path:  path.resolve(__dirname, '../../../../extra/c46528ba033a8197e32c40887c398198.pdf'),
    },
    // Davidson's original file is a scanned PDF (no text layer).
    // Replace the path below with a text-based version when available.
    // {
    //     slug:  'davidsons',
    //     title: "Davidson's Principles and Practice of Medicine",
    //     path:  path.resolve(__dirname, '../../../../extra/davidsons-text.pdf'),
    // },
];

// ── Batching constants ────────────────────────────────────────────────────────
const EMBED_BATCH  = 100;   // texts per OpenAI embedding call
const INSERT_BATCH = 300;   // rows per PostgreSQL multi-row INSERT
const BOOK_WEIGHT  = 1.0;
// Rate limit: text-embedding-3-small is 3000 RPM.
// 100 texts/call → 30 calls/min max → 2 s/call is well inside the limit.
const RATE_DELAY_MS = 500;

// ── DB bulk insert ────────────────────────────────────────────────────────────
// Uses a single multi-row VALUES INSERT per batch.
// Each row: (content, embedding::vector, source_type, weight, metadata::jsonb)
async function bulkInsert(pool, rows) {
    if (!rows.length) return;

    const vals         = [];
    const placeholders = rows.map((r, i) => {
        const n = i * 5;
        vals.push(
            r.content,
            `[${r.embedding.join(',')}]`,   // pgvector text format
            'medical_book',
            BOOK_WEIGHT,
            JSON.stringify(r.metadata),
        );
        return `($${n+1}, $${n+2}::vector, $${n+3}, $${n+4}, $${n+5}::jsonb)`;
    });

    await pool.query(
        `INSERT INTO rag_documents (content, embedding, source_type, weight, metadata)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT DO NOTHING`,
        vals,
    );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function progress(done, total, label = '') {
    const pct  = Math.round((done / total) * 100);
    const bar  = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    process.stdout.write(`\r  [${bar}] ${pct}% (${done}/${total}) ${label}   `);
}

// ── Per-book ingestion ────────────────────────────────────────────────────────
async function ingestBook(pool, book) {
    console.log(`\n▶  ${book.title}`);

    // Check if already ingested
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM rag_documents
         WHERE source_type = 'medical_book' AND metadata->>'book' = $1`,
        [book.slug],
    );
    const existing = rows[0].cnt;
    if (existing > 0) {
        console.log(`   ⏭  Already in DB (${existing} chunks). Pass --force to re-ingest.`);
        return;
    }

    const chunks = await chunkPdf(book.path, book.slug, book.title);
    const total  = chunks.length;

    let rowBuf   = [];
    let inserted = 0;

    for (let i = 0; i < total; i += EMBED_BATCH) {
        const batch   = chunks.slice(i, i + EMBED_BATCH);
        const texts   = batch.map(c => c.content);

        // Embed with retry on rate-limit (429)
        let vectors;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                vectors = await embedTexts(texts);
                break;
            } catch (err) {
                if (err.status === 429 && attempt < 3) {
                    console.warn(`\n   ⚠  Rate limited — waiting 10 s (attempt ${attempt}/3)`);
                    await sleep(10_000);
                } else {
                    throw err;
                }
            }
        }

        for (let j = 0; j < batch.length; j++) {
            rowBuf.push({ content: batch[j].content, embedding: vectors[j], metadata: batch[j].metadata });
        }

        if (rowBuf.length >= INSERT_BATCH) {
            await bulkInsert(pool, rowBuf);
            inserted += rowBuf.length;
            rowBuf    = [];
        }

        progress(i + batch.length, total, `inserted=${inserted}`);
        await sleep(RATE_DELAY_MS);
    }

    // Flush remainder
    if (rowBuf.length) {
        await bulkInsert(pool, rowBuf);
        inserted += rowBuf.length;
    }

    console.log(`\n   ✅  ${inserted} chunks inserted for [${book.slug}]`);
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
    const args        = process.argv.slice(2);
    const force       = args.includes('--force');
    const onlyBook    = args.find(a => a.startsWith('--book='))?.split('=')[1]
                     || (args.includes('--book') ? args[args.indexOf('--book') + 1] : null);

    const db   = DB_Connection.getInstance();
    const pool = db.pool;

    if (force) {
        const target = onlyBook ? ` AND metadata->>'book' = '${onlyBook}'` : '';
        console.log(`⚠  --force: deleting existing medical_book chunks${onlyBook ? ` for [${onlyBook}]` : ''}...`);
        await pool.query(`DELETE FROM rag_documents WHERE source_type = 'medical_book'${target}`);
    }

    const toIngest = onlyBook ? BOOKS.filter(b => b.slug === onlyBook) : BOOKS;

    if (!toIngest.length) {
        console.error(`Unknown book slug: ${onlyBook}. Valid slugs: ${BOOKS.map(b => b.slug).join(', ')}`);
        process.exit(1);
    }

    for (const book of toIngest) {
        await ingestBook(pool, book);
    }

    console.log('\n✅  Ingestion complete.\n');
    process.exit(0);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => {
    console.error('\n❌  Ingestion failed:', err.message);
    process.exit(1);
});
