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

async function checkNewMedInteractions(req, res) {
    try {
        const patientId = req.params.patientId;
        if (!patientId) {
            return res.status(400).json({ success: false, error: 'patientId is required in url' });
        }

        const drugs = Array.isArray(req.body.drugs) ? req.body.drugs : [];
        if (!drugs.length) {
            return res.status(400).json({ success: false, error: 'Provide proposed drug(s) in body.drugs' });
        }

        const names = drugs
            .map(d => (typeof d === 'string' ? d : d?.name || '').trim())
            .filter(Boolean);

        if (!names.length) {
            return res.status(400).json({ success: false, error: 'Proposed drug name is required' });
        }

        // Fetch patient history
        const PatientModel = require('../models/patientModel.js');
        const patientModel = new PatientModel();
        
        const allergies = await patientModel.getPatientAllergies(patientId);
        const surgeries = await patientModel.getPatientSurgeries(patientId);
        const vaccinations = await patientModel.getPatientVaccinations(patientId);
        
        const rawActive = await patientModel.getActiveMedications(patientId);
        const currentMedications = (rawActive || [])
            .filter((m) => String(m.status || 'active').toLowerCase() === 'active')
            .map((m) => ({
                generic_name: m.generic_name || m.generic || m.brand_name || m.name || 'Unknown',
                brand_name: m.brand_name || m.matched_brand || null,
                drug_class: m.drug_class || null,
                dosage: m.dosage || m.strength || 'Standard',
                frequency: m.frequency || 'As directed',
                instructions: m.instructions || '',
            }));

        const proposedMedications = drugs.map(d => {
            const name = (typeof d === 'string' ? d : d?.name || '').trim();
            const dosage = (typeof d === 'object' ? d?.dosage : '') || 'Standard';
            return {
                name,
                generic_name: name,
                dosage,
                frequency: 'As directed',
                instructions: '',
                status: 'active'
            };
        });

        // Run LLM check
        const LLMUtils = require('../utils/llmUtils.js');
        const llmUtils = new LLMUtils();
        
        const safetyResult = await llmUtils.checkPrescriptionSafety(
            patientId,
            allergies,
            currentMedications,
            proposedMedications,
            surgeries,
            vaccinations
        );

        // Also check pairwise interactions between proposed drugs + current medicines using the standard agent
        const allNamesToCheck = [...names, ...currentMedications.map(m => m.generic_name || m.brand_name || m.name)];
        
        let agentResult = { interactions: [], unrecognized_drugs: [], clinical_summary: '', overall_risk: 'safe' };
        if (allNamesToCheck.length >= 2) {
            try {
                const { checkDrugInteractions } = require('../agents/drugInteractionAgent.js');
                agentResult = await checkDrugInteractions(allNamesToCheck);
            } catch (agentErr) {
                console.error('[DrugController] Standard interaction check failed:', agentErr.message);
            }
        }

        // Map LLM safetyResult.warnings
        const safetyInteractions = (safetyResult?.warnings || []).map((w, idx) => {
            let drugA = 'Clinical Alert';
            let drugB = '';
            
            if (w.type === 'allergy_conflict') {
                drugA = 'Allergy Alert';
                drugB = `${w.drugs_involved?.join(', ') || ''} (Proposed: ${names.join(', ')})`.trim();
            } else if (w.type === 'drug_interaction') {
                const proposedNamesLower = proposedMedications.map(p => p.name.toLowerCase());
                const mappedDrugs = (w.drugs_involved || []).map(d => {
                    const isProposed = proposedNamesLower.includes(d.toLowerCase());
                    return isProposed ? d : `${d} (Current Med)`;
                });
                
                drugA = mappedDrugs[0] || 'Proposed Medication';
                drugB = `${mappedDrugs[1] || 'Current Medication'} (Proposed: ${names.join(', ')})`.trim();
            } else {
                drugA = w.type === 'other_conflict' ? 'Clinical Alert (History)' : 'Clinical Alert';
                drugB = `${w.drugs_involved?.join(', ') || ''} (Proposed: ${names.join(', ')})`.trim();
            }

            return {
                id:              `safety_${w.type}_${idx}_${Date.now()}`,
                drugA,
                drugB,
                severity:        w.severity,
                category:        severityToCategory(w.severity),
                description:     w.description || '',
                mechanism:       null,
                clinical_action: w.recommendation || null,
                source:          'ai',
            };
        });


        // Map standard agent.interactions
        const standardInteractions = (agentResult.interactions || []).map(it => ({
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

        const allInteractions = [...standardInteractions, ...safetyInteractions];

        // Unique filter to avoid duplicate interactions if both checkPrescriptionSafety and checkDrugInteractions catch them
        const seen = new Set();
        const uniqueInteractions = [];
        for (const item of allInteractions) {
            const key = `${item.drugA.toLowerCase()}_${item.drugB.toLowerCase()}_${item.description.toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueInteractions.push(item);
            }
        }

        // Compute final summary counts
        const summary = { safe: 0, warning: 0, danger: 0 };
        for (const it of uniqueInteractions) {
            const cat = severityToCategory(it.severity);
            summary[cat]++;
        }
        const totalItems = names.length + currentMedications.length;
        const totalPairs = (totalItems * (totalItems - 1)) / 2;
        summary.safe = Math.max(0, totalPairs - summary.warning - summary.danger);

        // Determine overall risk
        let overall_risk = agentResult.overall_risk || 'safe';
        if (safetyResult?.has_conflict) {
            const severities = (safetyResult.warnings || []).map(w => w.severity);
            if (severities.includes('critical') || severities.includes('severe')) {
                overall_risk = 'critical';
            } else if (severities.includes('moderate')) {
                if (overall_risk !== 'critical' && overall_risk !== 'high') {
                    overall_risk = 'moderate';
                }
            } else if (severities.includes('mild')) {
                if (overall_risk === 'safe') {
                    overall_risk = 'low';
                }
            }
        }

        // Build matrix
        const allNamesList = [...names, ...currentMedications.map(m => m.generic_name || m.brand_name || m.name)];
        const matrix = buildMatrix(allNamesList, uniqueInteractions.map(it => ({
            drug_a: it.drugA.replace(' (Current Med)', ''),
            drug_b: it.drugB.replace(' (Current Med)', ''),
            severity: it.severity
        })));

        // Combine clinical summaries
        let clinical_summary = agentResult.clinical_summary || '';
        if (safetyResult?.summary) {
            clinical_summary = `${safetyResult.summary} ${clinical_summary}`.trim();
        }

        return res.json({
            success:          true,
            canonical:        names,
            summary,
            matrix,
            interactions:     uniqueInteractions,
            clinical_summary,
            overall_risk,
            unrecognized:     agentResult.unrecognized_drugs || [],
            dataSource:       'AI — RxNorm · Medscape · Web search · Health Profile',
        });

    } catch (err) {
        console.error('[DrugController] Error in checkNewMedInteractions:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = { checkInteractions, checkNewMedInteractions };

