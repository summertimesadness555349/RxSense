'use strict';

/**
 * Parses medlineplus_scraped_raw.json using OpenAI to extract structured
 * reference ranges and patient-friendly explanations for each lab test.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node extra/parse_medlineplus.js
 *
 * Output: extra/drug_list/medlineplus_parsed.json
 * Supports resuming — already-processed entries are skipped.
 */

const fs   = require('fs');
const path = require('path');
// Resolve openai from backend's node_modules — no separate install needed
const { OpenAI } = require(path.join(__dirname, '../backend/node_modules/openai'));

const INPUT_FILE  = path.join(__dirname, 'medlineplus_scraped_raw.json');
const OUTPUT_FILE = path.join(__dirname, 'drug_list', 'medlineplus_parsed.json');

const CONCURRENCY  = 5;    // parallel OpenAI requests
const BATCH_DELAY  = 300;  // ms between batches (gentle rate-limit buffer)
const RETRY_DELAY  = 2500; // base ms for exponential backoff on 429
const MAX_RETRIES  = 4;

const openai = new OpenAI({
    apiKey: "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" || (() => { throw new Error('OPENAI_API_KEY env var is required'); })(),
});

const SYSTEM_PROMPT = `You are a medical data extractor. Given the name and a description from a MedlinePlus lab test page, extract the following as JSON.
Return ONLY raw JSON — no markdown fences, no explanation.

{
  "reference_range": "Numeric reference range if explicitly stated in the text, e.g. '4.5–11.0 10³/µL' or '<200 mg/dL'. Null if not mentioned.",
  "normal": "1–2 plain-English sentences explaining what a normal/negative result means for the patient. Null if not mentioned.",
  "high": "1–2 plain-English sentences explaining what a high/elevated/positive result may indicate. Null if not mentioned.",
  "low": "1–2 plain-English sentences explaining what a low/below-normal/negative result may indicate. Null if not mentioned."
}

Rules:
- Keep explanations simple — suitable for a patient with no medical background.
- Do NOT copy the source text verbatim; rephrase concisely.
- If a field does not apply to this test (e.g. a qualitative test has no numeric range), return null for that field.
- For qualitative tests (Positive/Negative), use "high" for a Positive result and "low" for a Negative result where it makes sense, otherwise both can be null.`;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function extractOne(entry, attempt = 0) {
    try {
        const userMsg = `Test name: ${entry.name}\n\nDescription:\n${entry.text}`;

        const resp = await openai.chat.completions.create({
            model:       'gpt-4o-mini',
            messages:    [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user',   content: userMsg },
            ],
            max_tokens:  450,
            temperature: 0.2,
        });

        const raw = (resp.choices[0]?.message?.content || '')
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();

        const parsed = JSON.parse(raw);

        return {
            name:            entry.name,
            source:          entry.url,
            reference_range: parsed.reference_range || null,
            normal:          parsed.normal          || null,
            high:            parsed.high            || null,
            low:             parsed.low             || null,
        };

    } catch (err) {
        const isRateLimit = err?.status === 429 || /rate.?limit|too.?many.?requests/i.test(err.message);
        const isRetryable = isRateLimit || err?.status >= 500;

        if (isRetryable && attempt < MAX_RETRIES) {
            const wait = RETRY_DELAY * Math.pow(2, attempt);
            process.stdout.write(`  [retry ${attempt + 1}/${MAX_RETRIES} in ${wait}ms] ${entry.name}\n`);
            await sleep(wait);
            return extractOne(entry, attempt + 1);
        }

        console.error(`  FAILED "${entry.name}": ${err.message}`);
        return {
            name:            entry.name,
            source:          entry.url,
            reference_range: null,
            normal:          null,
            high:            null,
            low:             null,
            _error:          err.message,
        };
    }
}

async function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Input file not found: ${INPUT_FILE}`);
        process.exit(1);
    }

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

    const all = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    console.log(`Input: ${all.length} entries from ${path.basename(INPUT_FILE)}`);

    // Resume support — load existing output
    let done = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        done = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        console.log(`Resuming: ${done.length} already processed, skipping those.`);
    }

    const doneNames = new Set(done.map(r => r.name));
    const todo = all.filter(e => !doneNames.has(e.name));

    if (todo.length === 0) {
        console.log('All entries already processed. Output is up to date.');
        return;
    }

    console.log(`Processing ${todo.length} remaining entries with concurrency=${CONCURRENCY}...\n`);

    const results = [...done];
    let processed = 0;

    for (let i = 0; i < todo.length; i += CONCURRENCY) {
        const batch = todo.slice(i, i + CONCURRENCY);

        const batchResults = await Promise.all(batch.map(e => extractOne(e)));
        results.push(...batchResults);
        processed += batch.length;

        // Save after every batch so progress is never lost
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

        const names = batch.map(e => e.name).join(', ');
        console.log(`[${processed}/${todo.length}] ${names}`);

        if (i + CONCURRENCY < todo.length) {
            await sleep(BATCH_DELAY);
        }
    }

    const errors = results.filter(r => r._error);
    console.log(`\nDone. ${results.length} entries saved → ${OUTPUT_FILE}`);
    if (errors.length > 0) {
        console.log(`${errors.length} entries failed (marked with _error field):`);
        errors.forEach(e => console.log(`  - ${e.name}: ${e._error}`));
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
