const DB_Connection = require('../database/db.js');
const { fuzzyMatchDrug } = require('./drugMatcher.js');

const db = DB_Connection.getInstance();

function severityToCategory(sev) {
    if (!sev) return 'warning';
    const s = sev.toLowerCase();
    if (s === 'mild') return 'warning';
    if (s === 'moderate') return 'warning';
    if (s === 'severe') return 'danger';
    if (s === 'critical') return 'danger';
    return 'warning';
}

async function getCanonicalName(token) {
    // If token is already a USAN, prefer it (quick exact match)
    try {
        const usanCheck = await db.query_executor(
            `SELECT usan_name FROM drugs WHERE usan_name ILIKE $1 LIMIT 1`,
            [token]
        );
        if (usanCheck && usanCheck.rows && usanCheck.rows.length) {
            const usan = usanCheck.rows[0].usan_name;
            if (usan) return usan;
        }
    } catch (err) {
        // ignore — may not have drugs table or column
    }

    // Try fuzzy match against drugs table and return USAN name when available,
    // otherwise fall back to generic or brand.
    try {
        const rows = await fuzzyMatchDrug(token, 1);
        if (rows && rows.length) {
            const r = rows[0];
            const matchBrand = r.brand || null;
            const matchGeneric = r.generic || null;

            // Check if `drugs` table has an `usan_name` column
            try {
                const colCheck = await db.query_executor(
                    `SELECT 1 FROM information_schema.columns WHERE table_name = 'drugs' AND column_name = 'usan_name' LIMIT 1`
                );
                if (colCheck && colCheck.rowCount) {
                    // Attempt to fetch usan_name for the matched row
                    const q = `SELECT usan_name FROM drugs WHERE (brand ILIKE $1 OR generic ILIKE $1) LIMIT 1`;
                    const params = [matchBrand || matchGeneric];
                    try {
                        const r2 = await db.query_executor(q, params);
                        if (r2 && r2.rows && r2.rows.length) {
                            const usan = r2.rows[0].usan_name;
                            if (usan) return usan;
                        }
                    } catch (err) {
                        // ignore lookup errors
                    }
                }
            } catch (err) {
                // ignore information_schema errors
            }

            return matchGeneric || matchBrand || token;
        }
    } catch (err) {
        // ignore fuzzy match errors
    }

    return token;
}

async function computeInteractions(inputNames) {
    // Map input names to canonical names
    const canonical = [];
    for (const name of inputNames) {
        const c = await getCanonicalName(name);
        canonical.push(c);
    }

    // Prepare pairwise lookups
    const interactions = [];
    const seenPairs = new Set();
    for (let i = 0; i < canonical.length; i++) {
        for (let j = i + 1; j < canonical.length; j++) {
            const a = canonical[i];
            const b = canonical[j];
            const key = `${a.toLowerCase()}|||${b.toLowerCase()}`;
            const revKey = `${b.toLowerCase()}|||${a.toLowerCase()}`;
            if (seenPairs.has(key) || seenPairs.has(revKey)) continue;
            seenPairs.add(key);

            // Query drug_interactions table for either orientation
            const sql = `SELECT interaction_id, drug_a, drug_b, severity, description
                         FROM drug_interactions
                         WHERE (drug_a ILIKE $1 AND drug_b ILIKE $2)
                            OR (drug_a ILIKE $2 AND drug_b ILIKE $1)
                         LIMIT 1`;
            const params = [a, b];
            let found = null;
            try {
                const res = await db.query_executor(sql, params);
                if (res && res.rows && res.rows.length) found = res.rows[0];
            } catch (err) {
                // ignore DB errors for individual lookups
            }

            if (found) {
                interactions.push({
                    id: found.interaction_id,
                    drugA: found.drug_a,
                    drugB: found.drug_b,
                    severity: found.severity,
                    category: severityToCategory(found.severity),
                    description: found.description,
                });
            } else {
                // No interaction recorded
                interactions.push({
                    id: null,
                    drugA: a,
                    drugB: b,
                    severity: null,
                    category: 'safe',
                    description: null,
                });
            }
        }
    }

    // Build summary
    const summary = { safe: 0, warning: 0, danger: 0 };
    for (const it of interactions) {
        if (it.category === 'safe') summary.safe += 1;
        else if (it.category === 'warning') summary.warning += 1;
        else if (it.category === 'danger') summary.danger += 1;
    }

    // Build matrix
    const n = canonical.length;
    const matrix = [];
    const headerRow = [''].concat(canonical);
    matrix.push(headerRow);
    for (let i = 0; i < n; i++) {
        const row = [canonical[i]];
        for (let j = 0; j < n; j++) {
            if (i === j) {
                row.push('-');
                continue;
            }
            const a = canonical[i];
            const b = canonical[j];
            // find pair in interactions
            const pair = interactions.find(p => (
                (p.drugA.toLowerCase() === a.toLowerCase() && p.drugB.toLowerCase() === b.toLowerCase()) ||
                (p.drugA.toLowerCase() === b.toLowerCase() && p.drugB.toLowerCase() === a.toLowerCase())
            ));
            row.push(pair ? pair.category : '-');
        }
        matrix.push(row);
    }

    return {
        summary,
        interactions: interactions.filter(i => i.category !== 'safe'),
        matrix,
        dataSource: 'Local drug interactions database',
        canonical,
    };
}

module.exports = { computeInteractions };
