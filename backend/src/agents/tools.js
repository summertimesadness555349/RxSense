'use strict';

const DB_Connection = require('../database/db.js');
const vectorStore   = require('../rag/vectorStore.js');

const db = DB_Connection.getInstance();

// ── Tool schemas (Anthropic tool-use format) ──────────────────────────────────

const SCHEMAS = [
    {
        name: 'rag_search',
        description:
            "Search Harrison's Principles of Internal Medicine and the MedlinePlus " +
            'medical encyclopedia for clinical information about symptoms, diseases, ' +
            'diagnostic criteria, treatments, and reference ranges. ' +
            'Call this for every distinct symptom cluster or condition you need to reason about.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Medical question or symptom description to search' },
                top_k: { type: 'number',  description: 'Number of results to return (default 6, max 10)' },
            },
            required: ['query'],
        },
    },
    {
        name: 'get_patient_profile',
        description:
            "Fetch the patient's age, sex, blood group, active conditions, known allergies, " +
            'and current medications from the health record.',
        input_schema: {
            type: 'object',
            properties: {
                user_id: { type: 'number', description: 'Integer user ID of the patient' },
            },
            required: ['user_id'],
        },
    },
    {
        name: 'get_report_history',
        description:
            'Fetch the most recent lab metrics for a patient — useful for comparing current ' +
            'abnormal values against past trends.',
        input_schema: {
            type: 'object',
            properties: {
                user_id: { type: 'number', description: 'Integer user ID of the patient' },
                limit:   { type: 'number', description: 'Number of recent reports to include (default 3)' },
            },
            required: ['user_id'],
        },
    },
];

// ── Tool executors ────────────────────────────────────────────────────────────

const EXECUTORS = {

    rag_search: async ({ query, top_k = 6 }, userId = null) => {
        const topK   = Math.min(parseInt(top_k) || 6, 10);
        const results = await vectorStore.search({
            query,
            userId,
            sourceTypes: ['medical_book'],   // books + medlineplus only for symptom context
            topK,
            minScore: 0.25,
        });
        if (!results.length) return [{ content: 'No relevant medical literature found for this query.', score: 0 }];
        return results.map(r => ({
            content:  r.content,
            section:  r.metadata?.chapter || r.metadata?.topic || 'General',
            source:   r.metadata?.book_title || r.source_type,
            score:    parseFloat(r.score).toFixed(3),
        }));
    },

    get_patient_profile: async ({ user_id }) => {
        const result = await db.query_executor(`
            SELECT
                u.full_name                         AS name,
                p.date_of_birth,
                p.gender,
                p.blood_group,
                p.height,
                p.weight,
                p.blood_pressure_systolic           AS bp_systolic,
                p.blood_pressure_diastolic          AS bp_diastolic,
                p.smoking_status,
                EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
                (SELECT COALESCE(json_agg(kc.condition_name), '[]'::json)
                 FROM known_condition kc
                 WHERE kc.patient_id = p.patient_id AND kc.status = 'active'
                ) AS active_conditions,
                (SELECT COALESCE(json_agg(json_build_object(
                    'allergen', COALESCE(d.generic_name, d.brand_name, 'Unknown'),
                    'severity', pa.severity,
                    'reaction', pa.reaction_type
                )), '[]'::json)
                 FROM patient_allergy pa
                 LEFT JOIN drug d ON d.drug_id = pa.drug_id
                 WHERE pa.patient_id = p.patient_id
                ) AS allergies,
                (SELECT COALESCE(json_agg(json_build_object(
                    'drug', m.drug_name,
                    'dosage', m.dosage,
                    'frequency', m.frequency
                )), '[]'::json)
                 FROM medication m
                 WHERE m.patient_id = p.patient_id AND m.status = 'active'
                ) AS current_medications
            FROM users u
            LEFT JOIN patient p ON p.user_id = u.id
            WHERE u.id = $1
            LIMIT 1
        `, [user_id]);
        return result.rows[0] || { error: 'Patient profile not found' };
    },

    get_report_history: async ({ user_id, limit = 3 }) => {
        const result = await db.query_executor(`
            SELECT
                mr.report_type,
                mr.report_date,
                mr.overall_impression,
                (SELECT COALESCE(json_agg(json_build_object(
                    'parameter', lm.parameter_name,
                    'value',     lm.value,
                    'unit',      lm.unit,
                    'status',    lm.metric_status,
                    'ref_range', lm.reference_range
                ) ORDER BY lm.metric_status DESC NULLS LAST), '[]'::json)
                 FROM lab_metric lm WHERE lm.report_id = mr.report_id
                ) AS metrics
            FROM medical_report mr
            JOIN patient p ON p.patient_id = mr.patient_id
            WHERE p.user_id = $1
            ORDER BY mr.uploaded_at DESC
            LIMIT $2
        `, [user_id, Math.min(parseInt(limit) || 3, 5)]);
        return result.rows.length ? result.rows : [{ info: 'No past reports found.' }];
    },
};

// Build a bound executor map: each function receives the tool input plus the
// calling userId so rag_search can include user-private vectors in future.
function buildExecutors(userId) {
    return {
        rag_search:          (input) => EXECUTORS.rag_search(input, userId),
        get_patient_profile: (input) => EXECUTORS.get_patient_profile(input),
        get_report_history:  (input) => EXECUTORS.get_report_history(input),
    };
}

module.exports = { SCHEMAS, EXECUTORS, buildExecutors };
