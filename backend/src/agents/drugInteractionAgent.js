'use strict';

const DB_Connection  = require('../database/db.js');
const { runOpenAIAgent } = require('./openaiAgentRunner.js');

const SYSTEM = `You are a clinical pharmacologist AI embedded in RxSense — a patient health management platform.

Your task: check drug-drug interactions (DDI) for a given list of medications and produce a structured clinical report.

TOOL ORDER — always follow this sequence:
1. call check_local_db with ALL drugs first.
2. For any pair where local DB had no data, call rxnorm_lookup with those drugs.
3. If RxNorm could not identify a specific drug (returned unrecognized), call medscape_lookup for just those drugs.
4. If a drug is STILL unrecognized after Medscape, call web_search with a focused query like "drugA drugB drug interaction clinical".
5. After all tools are done, return your final JSON answer.

FINAL OUTPUT — return ONLY this JSON, no markdown, no prose:
{
  "interactions": [
    {
      "drug_a": "Drug name",
      "drug_b": "Drug name",
      "severity": "mild | moderate | severe | critical",
      "description": "Plain-language clinical description of the interaction",
      "mechanism": "Pharmacological mechanism or null",
      "clinical_action": "What the doctor or patient should do about this",
      "source": "local_db | rxnorm | medscape | web_search"
    }
  ],
  "unrecognized_drugs": ["any drug names not found in any source"],
  "clinical_summary": "2-3 sentence overall safety assessment for the clinician",
  "overall_risk": "safe | low | moderate | high | critical"
}

Only include pairs that have a real interaction. If no interactions exist, return an empty interactions array and overall_risk = "safe".`;

// ── Tool schemas (Anthropic format — runner converts to OpenAI) ───────────────

const TOOLS = [
    {
        name: 'check_local_db',
        description: 'Check the local drug_interactions table for all pairwise combinations of the given drugs. Always call this first.',
        input_schema: {
            type: 'object',
            properties: {
                drugs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of drug names to check pairwise'
                }
            },
            required: ['drugs']
        }
    },
    {
        name: 'rxnorm_lookup',
        description: 'Look up drug-drug interactions via the free NIH RxNorm API. Converts names to RxCUIs then fetches DDI data. Call this for any pair not found locally.',
        input_schema: {
            type: 'object',
            properties: {
                drugs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Drug names to look up on RxNorm'
                }
            },
            required: ['drugs']
        }
    },
    {
        name: 'medscape_lookup',
        description: 'Look up drug interactions using the Medscape reference database. Use only for drugs that RxNorm could not identify.',
        input_schema: {
            type: 'object',
            properties: {
                drugs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Drug names to look up on Medscape'
                }
            },
            required: ['drugs']
        }
    },
    {
        name: 'web_search',
        description: 'Search the internet for drug interaction data using Tavily. Use ONLY as a last resort for drugs not found in any other source.',
        input_schema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Focused search query e.g. "semaglutide metformin drug interaction clinical pharmacology"'
                }
            },
            required: ['query']
        }
    }
];

// ── Executors ─────────────────────────────────────────────────────────────────

async function execCheckLocalDb({ drugs }) {
    const db = DB_Connection.getInstance();
    const results = [];

    for (let i = 0; i < drugs.length; i++) {
        for (let j = i + 1; j < drugs.length; j++) {
            const a = drugs[i];
            const b = drugs[j];
            try {
                const res = await db.query_executor(
                    `SELECT drug_a, drug_b, severity, description
                     FROM drug_interactions
                     WHERE (drug_a ILIKE $1 AND drug_b ILIKE $2)
                        OR (drug_a ILIKE $2 AND drug_b ILIKE $1)
                     LIMIT 1`,
                    [a, b]
                );
                if (res.rows.length) {
                    results.push({ drug_a: a, drug_b: b, found: true, ...res.rows[0], source: 'local_db' });
                } else {
                    results.push({ drug_a: a, drug_b: b, found: false });
                }
            } catch (err) {
                results.push({ drug_a: a, drug_b: b, found: false, error: err.message });
            }
        }
    }

    return results;
}

async function execRxNormLookup({ drugs }) {
    const BASE = 'https://rxnav.nlm.nih.gov/REST';
    const cuisMap = {};

    // Step 1: resolve each name → RxCUI
    for (const name of drugs) {
        try {
            const res  = await fetch(`${BASE}/rxcui.json?name=${encodeURIComponent(name)}&search=2`);
            const json = await res.json();
            const cui  = json?.idGroup?.rxnormId?.[0];
            if (cui) cuisMap[name] = cui;
        } catch { /* ignore individual failures */ }
    }

    const recognized   = Object.keys(cuisMap);
    const unrecognized = drugs.filter(d => !cuisMap[d]);

    if (recognized.length < 2) {
        return { recognized, unrecognized, interactions: [] };
    }

    // Step 2: batch interaction check
    const cuiList = Object.values(cuisMap).join('+');
    const interactions = [];
    try {
        const res  = await fetch(`${BASE}/interaction/list.json?rxcuis=${cuiList}`);
        const json = await res.json();

        for (const group of (json?.fullInteractionTypeGroup || [])) {
            for (const type of (group.fullInteractionType || [])) {
                for (const pair of (type.interactionPair || [])) {
                    const concepts = pair.interactionConcept || [];
                    interactions.push({
                        drug_a:      concepts[0]?.minConceptItem?.name || '',
                        drug_b:      concepts[1]?.minConceptItem?.name || '',
                        severity:    pair.severity   || 'moderate',
                        description: pair.description || '',
                        source:      'rxnorm',
                    });
                }
            }
        }
    } catch (err) {
        return { recognized, unrecognized, interactions, error: err.message };
    }

    return { recognized, unrecognized, interactions };
}

async function execMedscapeLookup({ drugs }) {
    const SEARCH_URL      = 'https://www.medscape.com/api/quickreflookup/LookupService.ashx';
    const INTERACTION_URL = 'https://reference.medscape.com/druginteraction.do';
    const idMap = {};

    // Step 1: resolve names → Medscape drug IDs
    for (const name of drugs) {
        try {
            const params = new URLSearchParams({
                q:         name,
                sz:        '1',
                type:      '10417',
                metadata:  'has-interactions',
                format:    'json',
                jsonp:     'MDICshowResults',
                timestamp: String(Date.now()),
            });
            const res  = await fetch(`${SEARCH_URL}?${params}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const text = await res.text();

            const start = text.indexOf('(');
            const end   = text.lastIndexOf(')');
            if (start === -1 || end === -1) continue;

            const data = JSON.parse(text.slice(start + 1, end));
            const id   = data?.types?.[0]?.references?.[0]?.id;
            if (id) idMap[name] = String(id);
        } catch { /* ignore */ }
    }

    const recognized   = Object.keys(idMap);
    const unrecognized = drugs.filter(d => !idMap[d]);

    if (recognized.length < 2) {
        return { recognized, unrecognized, interactions: [] };
    }

    // Step 2: batch interaction lookup
    const ids = Object.values(idMap).join(',');
    try {
        const res  = await fetch(`${INTERACTION_URL}?action=getMultiInteraction&ids=${ids}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const json = await res.json();
        // Medscape returns a nested structure — pass it raw so the agent can interpret it
        return { recognized, unrecognized, raw_medscape_response: json };
    } catch (err) {
        return { recognized, unrecognized, interactions: [], error: err.message };
    }
}

async function execWebSearch({ query }) {
    const { tavily } = require('@tavily/core');
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

    const result = await client.search(query, {
        searchDepth:    'advanced',
        maxResults:     5,
        includeDomains: [
            'drugs.com',
            'medscape.com',
            'ncbi.nlm.nih.gov',
            'rxlist.com',
            'pubmed.ncbi.nlm.nih.gov',
        ],
    });

    return {
        query,
        results: (result.results || []).map(r => ({
            title:   r.title,
            url:     r.url,
            content: (r.content || '').slice(0, 600),
        })),
    };
}

// ── Public API ─────────────────────────────────────────────────────────────────

async function checkDrugInteractions(drugNames) {
    const userMessage = `Check drug-drug interactions for: ${drugNames.join(', ')}.

Follow the tool order in your instructions. Return the final JSON report once all lookups are complete.`;

    const response = await runOpenAIAgent({
        agentName:   'DrugInteractionAgent',
        system:      SYSTEM,
        userMessage,
        tools:       TOOLS,
        executors: {
            check_local_db:   execCheckLocalDb,
            rxnorm_lookup:    execRxNormLookup,
            medscape_lookup:  execMedscapeLookup,
            web_search:       execWebSearch,
        },
        model:       process.env.OPENAI_AGENT_MODEL || 'gpt-4o-mini',
        maxTokens:   3000,
        temperature: 0.1,
    });

    const clean = response.text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

    try {
        return JSON.parse(clean);
    } catch {
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error('Drug interaction agent returned unparseable response');
    }
}

module.exports = { checkDrugInteractions };
