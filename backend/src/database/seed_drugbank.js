'use strict';

/**
 * Streams drugbank.xml and seeds the drugbank_drug table.
 * Run once: node seed_drugbank.js
 *
 * Skips: sequences, drug-interactions, targets, enzymes, carriers,
 *        transporters, reactions, snp-*, calculated/experimental-properties,
 *        prices, packagers, manufacturers, mixtures, patents, references.
 */

const sax    = require('sax');
const fs     = require('fs');
const path   = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DB_Connection = require('./db.js');

// ── Config ────────────────────────────────────────────────────────────────────
const XML_PATH   = path.resolve(__dirname, '../../../extra/drugbank.xml');
const BATCH_SIZE    = 20;   // rows per INSERT — kept small for Neon serverless limits
const BATCH_DELAY   = 150;  // ms pause between batches
const MAX_RETRIES   = 4;    // retries per batch before giving up

// Tags whose subtrees we skip entirely
const SKIP_TAGS = new Set([
    'sequences',
    'general-references',
    'synthesis-reference',
    'mixtures',
    'packagers',
    'manufacturers',
    'prices',
    'patents',
    'food-interactions',
    'drug-interactions',
    'external-identifiers',
    'external-links',
    'calculated-properties',
    'experimental-properties',
    'targets',
    'enzymes',
    'carriers',
    'transporters',
    'reactions',
    'snp-effects',
    'snp-adverse-drug-reactions',
    'international-brands',
    'affected-organisms',
    'ahfs-codes',
    'pdb-entries',
    'atc-codes',
    'salts',
    'salt',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyDrug() {
    return {
        drugbank_id: null, drug_type: null, name: null,
        description: null, indication: null, pharmacodynamics: null,
        mechanism_of_action: null, toxicity: null, metabolism: null,
        absorption: null, half_life: null, protein_binding: null,
        route_of_elimination: null, volume_of_distribution: null,
        clearance: null, state: null, cas_number: null, unii: null,
        groups: [], synonyms: [], brand_names: [], categories: [], products: [],
        classification_kingdom: null, classification_superclass: null,
        classification_class: null, classification_subclass: null,
        classification_parent: null,
    };
}

const COLS = [
    'drugbank_id', 'drug_type', 'name', 'description', 'indication',
    'pharmacodynamics', 'mechanism_of_action', 'toxicity', 'metabolism',
    'absorption', 'half_life', 'protein_binding', 'route_of_elimination',
    'volume_of_distribution', 'clearance', 'state', 'cas_number', 'unii',
    'groups', 'synonyms', 'brand_names', 'categories', 'products',
    'classification_kingdom', 'classification_superclass',
    'classification_class', 'classification_subclass', 'classification_parent',
];
const N_COLS = COLS.length;  // 28

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function insertBatch(db, drugs) {
    if (!drugs.length) return 0;

    const values = [];
    const rows = drugs.map((d, i) => {
        values.push(
            d.drugbank_id, d.drug_type, d.name, d.description, d.indication,
            d.pharmacodynamics, d.mechanism_of_action, d.toxicity, d.metabolism,
            d.absorption, d.half_life, d.protein_binding, d.route_of_elimination,
            d.volume_of_distribution, d.clearance, d.state, d.cas_number, d.unii,
            JSON.stringify(d.groups),      JSON.stringify(d.synonyms),
            JSON.stringify(d.brand_names), JSON.stringify(d.categories),
            JSON.stringify(d.products),
            d.classification_kingdom, d.classification_superclass,
            d.classification_class, d.classification_subclass, d.classification_parent,
        );
        const base = i * N_COLS;
        return '(' + Array.from({ length: N_COLS }, (_, j) => `$${base + j + 1}`).join(', ') + ')';
    });

    const sql = `INSERT INTO drugbank_drug (${COLS.join(', ')})
                 VALUES ${rows.join(',\n')}
                 ON CONFLICT (drugbank_id) DO NOTHING`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await db.query_executor(sql, values);
            return drugs.length;
        } catch (err) {
            const isLast = attempt === MAX_RETRIES;
            if (isLast) {
                console.warn(`\n[SKIP] Batch failed after ${MAX_RETRIES} attempts (${drugs[0]?.drugbank_id}–${drugs[drugs.length-1]?.drugbank_id}): ${err.message}`);
                return 0;
            }
            const wait = attempt * 800;
            process.stdout.write(`\n[RETRY] attempt ${attempt} failed, waiting ${wait}ms…`);
            await sleep(wait);
            // Re-create the DB singleton connection after a connection drop
            db.pool.connect().then(c => c.release()).catch(() => {});
        }
    }
    return 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    if (!fs.existsSync(XML_PATH)) {
        console.error('[ERROR] Not found:', XML_PATH);
        process.exit(1);
    }

    // DB is intentionally NOT opened here — parsing takes ~120s and Neon drops
    // idle connections. We create the pool fresh right before inserting.

    // ── SAX state ─────────────────────────────────────────────────────────────
    let drug         = null;      // drug object being built
    let tagStack     = [];        // stack of open tag names inside <drug>
    let skipDepth    = 0;         // >0 means we're inside a skipped subtree
    let currentText  = '';        // text accumulator for current element
    let isPrimaryId  = false;     // whether current <drugbank-id> has primary="true"

    // Sub-element state
    let inProduct      = false;
    let currentProduct = {};
    let inCategory     = false;
    let currentCategory = {};

    // Collection + counters
    const pending     = [];       // all parsed drug objects
    let parseErrors   = 0;

    // ── Parser ────────────────────────────────────────────────────────────────
    const parser = sax.createStream(true /* strict */, { lowercase: true });

    parser.on('opentag', (node) => {
        const tag = node.name;
        currentText = '';

        // Inside a skipped subtree — just increment depth counter
        if (skipDepth > 0) { skipDepth++; return; }

        // Entering a subtree to skip
        if (SKIP_TAGS.has(tag)) { skipDepth++; return; }

        // Top-level <drug> element — start a new drug object
        if (tag === 'drug' && tagStack.length === 0) {
            drug = emptyDrug();
            drug.drug_type = node.attributes.type || null;
        }

        if (!drug) return;

        // Track primary drugbank-id attribute
        if (tag === 'drugbank-id') {
            isPrimaryId = node.attributes.primary === 'true';
        }

        // Detect entering a <product> or <category> wrapper
        const top = tagStack[tagStack.length - 1];
        if (tag === 'product'  && top === 'products')   { inProduct = true;  currentProduct = {}; }
        if (tag === 'category' && top === 'categories') { inCategory = true; currentCategory = {}; }

        tagStack.push(tag);
    });

    parser.on('text',  (t) => { if (skipDepth === 0 && drug) currentText += t; });
    parser.on('cdata', (t) => { if (skipDepth === 0 && drug) currentText += t; });

    parser.on('closetag', (tag) => {
        if (skipDepth > 0) { skipDepth--; return; }
        if (!drug) return;

        const trimmed = currentText.trim();
        // Determine parent BEFORE popping the stack
        const parent = tagStack.length >= 2 ? tagStack[tagStack.length - 2] : null;
        if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tag) tagStack.pop();

        // Finished a top-level drug
        if (tag === 'drug' && tagStack.length === 0) {
            if (drug.drugbank_id && drug.name) {
                pending.push(drug);
                if (pending.length % 500 === 0)
                    process.stdout.write(`\r  parsed ${pending.length} drugs...`);
            }
            drug = null;
            currentText = '';
            return;
        }

        // ── Nested: inside a <product> ─────────────────────────────────────
        if (inProduct) {
            switch (tag) {
                case 'name':        if (parent === 'product') currentProduct.name = trimmed; break;
                case 'dosage-form': currentProduct.dosage_form = trimmed; break;
                case 'strength':    currentProduct.strength    = trimmed; break;
                case 'route':       currentProduct.route       = trimmed; break;
                case 'product':
                    if (currentProduct.name) {
                        drug.products.push(currentProduct);
                        if (!drug.brand_names.includes(currentProduct.name))
                            drug.brand_names.push(currentProduct.name);
                    }
                    inProduct = false; currentProduct = {};
                    break;
            }

        // ── Nested: inside a <category> ───────────────────────────────────
        } else if (inCategory) {
            switch (tag) {
                case 'category':
                    if (parent === 'category')    currentCategory.name = trimmed;         // inner text element
                    else if (parent === 'categories') {                                    // outer wrapper closing
                        if (currentCategory.name) drug.categories.push(currentCategory);
                        inCategory = false; currentCategory = {};
                    }
                    break;
                case 'mesh-id': currentCategory.mesh_id = trimmed || null; break;
            }

        // ── Direct drug fields ─────────────────────────────────────────────
        } else {
            switch (tag) {
                case 'drugbank-id':
                    if (isPrimaryId && !drug.drugbank_id) drug.drugbank_id = trimmed;
                    break;
                case 'name':
                    if (parent === 'drug' && !drug.name) drug.name = trimmed;
                    break;
                case 'description':
                    if (parent === 'drug') drug.description = trimmed || null;
                    break;
                case 'indication':             drug.indication            = trimmed || null; break;
                case 'pharmacodynamics':       drug.pharmacodynamics      = trimmed || null; break;
                case 'mechanism-of-action':    drug.mechanism_of_action   = trimmed || null; break;
                case 'toxicity':               drug.toxicity              = trimmed || null; break;
                case 'metabolism':             drug.metabolism            = trimmed || null; break;
                case 'absorption':             drug.absorption            = trimmed || null; break;
                case 'half-life':              drug.half_life             = trimmed || null; break;
                case 'protein-binding':        drug.protein_binding       = trimmed || null; break;
                case 'route-of-elimination':   drug.route_of_elimination  = trimmed || null; break;
                case 'volume-of-distribution': drug.volume_of_distribution = trimmed || null; break;
                case 'clearance':              drug.clearance             = trimmed || null; break;
                case 'state':                  drug.state                 = trimmed || null; break;
                case 'cas-number':             drug.cas_number            = trimmed || null; break;
                case 'unii':                   drug.unii                  = trimmed || null; break;
                case 'group':
                    if (parent === 'groups') drug.groups.push(trimmed);
                    break;
                case 'synonym':
                    if (parent === 'synonyms') drug.synonyms.push(trimmed);
                    break;
                case 'direct-parent':
                    if (parent === 'classification') drug.classification_parent     = trimmed || null; break;
                case 'kingdom':
                    if (parent === 'classification') drug.classification_kingdom    = trimmed || null; break;
                case 'superclass':
                    if (parent === 'classification') drug.classification_superclass = trimmed || null; break;
                case 'class':
                    if (parent === 'classification') drug.classification_class      = trimmed || null; break;
                case 'subclass':
                    if (parent === 'classification') drug.classification_subclass   = trimmed || null; break;
            }
        }

        currentText = '';
    });

    parser.on('error', (err) => {
        parseErrors++;
        console.warn('\n[WARN] SAX error (continuing):', err.message);
        // sax createStream doesn't stop on error by default
    });

    // ── Stream the file ───────────────────────────────────────────────────────
    console.log('[INFO]  Streaming', XML_PATH);
    console.log('[INFO]  File size: 670 MB — this will take ~30-60 seconds...\n');
    const t0 = Date.now();

    await new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(XML_PATH, { highWaterMark: 256 * 1024 });
        fileStream.on('error', reject);
        parser.on('end',   resolve);
        parser.on('error', () => {}); // already handled above; suppress unhandled
        fileStream.pipe(parser);
    });

    const parseSecs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n[INFO]  Parse complete: ${pending.length} drugs in ${parseSecs}s (${parseErrors} parse errors)`);

    // ── Open DB now (fresh pool — no idle timeout risk) ──────────────────────
    console.log('[INFO]  Opening database connection...');
    const db = DB_Connection.getInstance();
    // Prevent a dropped idle client from crashing the process
    db.pool.on('error', (err) => {
        console.warn('[pool] idle client error (will retry):', err.message);
    });

    // Warm up — verify the connection works before starting inserts
    await db.query_executor('SELECT 1');
    console.log('[INFO]  DB connection OK.');

    // ── Batch insert ──────────────────────────────────────────────────────────
    console.log('[INFO]  Inserting into database...');
    const t1 = Date.now();
    let inserted = 0;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const chunk = pending.slice(i, i + BATCH_SIZE);
        inserted += await insertBatch(db, chunk);
        process.stdout.write(`\r  ${inserted}/${pending.length} inserted...`);
        await sleep(BATCH_DELAY);
    }

    const insertSecs = ((Date.now() - t1) / 1000).toFixed(1);
    console.log(`\n[OK]    Inserted ${inserted} drugs in ${insertSecs}s`);

    // ── Quick sanity check ────────────────────────────────────────────────────
    const count = await db.query_executor('SELECT COUNT(*) AS n FROM drugbank_drug');
    console.log(`[INFO]  Total rows in drugbank_drug: ${count.rows[0].n}`);

    await db.pool.end();
    console.log('[DONE]');
}

main().catch(err => {
    console.error('\n[FATAL]', err.message);
    process.exit(1);
});
