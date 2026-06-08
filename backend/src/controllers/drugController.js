'use strict';

const { checkDrugInteractions } = require('../agents/drugInteractionAgent.js');

function severityToCategory(sev) {
    const s = String(sev || '').toLowerCase();
    if (s === 'severe' || s === 'critical') return 'danger';
    if (s === 'mild' || s === 'moderate')   return 'warning';
    return 'warning';
}

function buildMatrix(names, interactions) {
    const n   = names.length;
    const rows = [[''].concat(names)];
    for (let i = 0; i < n; i++) {
        const row = [names[i]];
        for (let j = 0; j < n; j++) {
            if (i === j) { row.push('-'); continue; }
            const pair = interactions.find(it => {
                const a = (it.drug_a || '').toLowerCase();
                const b = (it.drug_b || '').toLowerCase();
                return (a === names[i].toLowerCase() && b === names[j].toLowerCase())
                    || (a === names[j].toLowerCase() && b === names[i].toLowerCase());
            });
            row.push(pair ? severityToCategory(pair.severity) : 'safe');
        }
        rows.push(row);
    }
    return rows;
}

async function checkInteractions(req, res) {
    try {
        const drugs = Array.isArray(req.body.drugs) ? req.body.drugs : [];
        if (!drugs.length) {
            return res.status(400).json({ success: false, error: 'Provide an array of drugs in body.drugs' });
        }

        const names = drugs
            .map(d => (typeof d === 'string' ? d : d?.name || '').trim())
            .filter(Boolean);

        if (names.length < 2) {
            return res.status(400).json({ success: false, error: 'At least 2 drug names are required' });
        }

        console.log(`[DrugInteraction] Checking: ${names.join(', ')}`);
        const agent = await checkDrugInteractions(names);

        // Compute summary counts
        const summary = { safe: 0, warning: 0, danger: 0 };
        const totalPairs = (names.length * (names.length - 1)) / 2;
        for (const it of (agent.interactions || [])) {
            const cat = severityToCategory(it.severity);
            summary[cat]++;
        }
        summary.safe = Math.max(0, totalPairs - summary.warning - summary.danger);

        // Normalise interactions to camelCase for the existing frontend mapping
        const interactions = (agent.interactions || []).map(it => ({
            id:              `${it.drug_a}_${it.drug_b}`,
            drugA:           it.drug_a,
            drugB:           it.drug_b,
            severity:        it.severity,
            category:        severityToCategory(it.severity),
            description:     it.description || '',
            mechanism:       it.mechanism   || null,
            clinical_action: it.clinical_action || null,
            source:          it.source || 'ai',
        }));

        return res.json({
            success:          true,
            canonical:        names,
            summary,
            matrix:           buildMatrix(names, agent.interactions || []),
            interactions,
            clinical_summary: agent.clinical_summary || null,
            overall_risk:     agent.overall_risk     || 'safe',
            unrecognized:     agent.unrecognized_drugs || [],
            dataSource:       'AI — RxNorm · Medscape · Web search',
        });

    } catch (err) {
        console.error('[DrugInteraction] Error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = { checkInteractions };
