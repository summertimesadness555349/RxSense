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
    {
        name: 'get_patient_chart_by_id',
        description:
            "Fetch a comprehensive clinical chart for a patient using their patient UUID. " +
            "Returns demographics, active conditions, allergies (with severity), current medications " +
            "from both doctor prescriptions and scanned prescriptions, surgical history, vaccinations, " +
            "and all lab report metrics ordered by severity. Use this as the primary tool for doctor-facing summaries.",
        input_schema: {
            type: 'object',
            properties: {
                patient_id: { type: 'string', description: 'UUID of the patient (from patient table)' },
            },
            required: ['patient_id'],
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
                (SELECT COALESCE(ps.medications, '[]'::jsonb)
                 FROM prescription_scan ps
                 WHERE ps.user_id = u.id
                 ORDER BY ps.created_at DESC
                 LIMIT 1
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
                mr.facility,
                mr.raw_analysis->>'overall_impression' AS overall_impression,
                (SELECT COALESCE(json_agg(json_build_object(
                    'parameter', lm.parameter_name,
                    'value',     lm.value,
                    'unit',      lm.unit,
                    'status',    lm.status,
                    'ref_range', lm.reference_range
                ) ORDER BY CASE lm.status
                    WHEN 'critical_high' THEN 1 WHEN 'critical_low' THEN 2
                    WHEN 'high'          THEN 3 WHEN 'low'          THEN 4
                    ELSE 5 END
                ), '[]'::json)
                 FROM report_metric lm WHERE lm.report_id = mr.report_id
                ) AS metrics
            FROM medical_report mr
            JOIN patient p ON p.patient_id = mr.patient_id
            WHERE p.user_id = $1
            ORDER BY mr.uploaded_at DESC
            LIMIT $2
        `, [user_id, Math.min(parseInt(limit) || 3, 5)]);
        return result.rows.length ? result.rows : [{ info: 'No past reports found.' }];
    },

    get_patient_chart_by_id: async ({ patient_id }) => {
        // Demographics + conditions + allergies + medications + shared symptoms
        const profileRes = await db.query_executor(`
            SELECT
                u.full_name,
                u.email,
                EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
                p.date_of_birth,
                p.gender,
                p.blood_group,
                p.height,
                p.weight,
                p.smoking_status,
                p.blood_pressure_systolic   AS bp_systolic,
                p.blood_pressure_diastolic  AS bp_diastolic,
                p.emergency_contact_name,
                p.emergency_contact_phone,
                -- Active conditions
                (SELECT COALESCE(json_agg(json_build_object(
                    'condition',    kc.condition_name,
                    'icd10',        kc.icd_10_code,
                    'status',       kc.status,
                    'severity',     kc.severity,
                    'diagnosed_at', kc.diagnosed_at,
                    'notes',        kc.notes
                ) ORDER BY kc.diagnosed_at DESC NULLS LAST), '[]'::json)
                 FROM known_condition kc
                 WHERE kc.patient_id = p.patient_id AND kc.status IN ('active','chronic','managed')
                ) AS active_conditions,
                -- Allergies
                (SELECT COALESCE(json_agg(json_build_object(
                    'allergen',  COALESCE(d.generic_name, d.brand_name, 'Unknown'),
                    'severity',  pa.severity,
                    'reaction',  pa.reaction_type
                )), '[]'::json)
                 FROM patient_allergy pa
                 LEFT JOIN drug d ON d.drug_id = pa.drug_id
                 WHERE pa.patient_id = p.patient_id
                ) AS allergies,
                -- Doctor-issued prescriptions (active)
                (SELECT COALESCE(json_agg(json_build_object(
                    'drug',       COALESCE(dr.generic_name, dr.brand_name),
                    'dosage',     pi.dosage,
                    'frequency',  pi.frequency,
                    'duration',   pi.duration_days,
                    'issued_at',  pr.issued_at
                ) ORDER BY pr.issued_at DESC), '[]'::json)
                 FROM prescription pr
                 JOIN prescription_item pi ON pi.prescription_id = pr.prescription_id
                 JOIN drug dr ON dr.drug_id = pi.drug_id
                 WHERE pr.patient_id = p.patient_id AND pr.status = 'active'
                ) AS active_prescriptions,
                -- Latest scanned prescription medications
                (SELECT COALESCE(ps.medications, '[]'::jsonb)
                 FROM prescription_scan ps
                 JOIN users u2 ON u2.id = ps.user_id
                 WHERE u2.id = u.id
                 ORDER BY ps.created_at DESC
                 LIMIT 1
                ) AS scanned_medications,
                -- Surgical history
                (SELECT COALESCE(json_agg(json_build_object(
                    'procedure',    sh.procedure_name,
                    'performed_at', sh.performed_at,
                    'outcome',      sh.outcome,
                    'complications',sh.complications
                ) ORDER BY sh.performed_at DESC NULLS LAST), '[]'::json)
                 FROM surgical_history sh
                 WHERE sh.patient_id = p.patient_id
                ) AS surgical_history,
                -- Recent vaccinations
                (SELECT COALESCE(json_agg(json_build_object(
                    'vaccine',         vr.vaccine_name,
                    'administered_at', vr.administered_at,
                    'dose',            vr.dose_number,
                    'next_due',        vr.next_due_date
                ) ORDER BY vr.administered_at DESC NULLS LAST), '[]'::json)
                 FROM vaccination_record vr
                 WHERE vr.patient_id = p.patient_id
                ) AS vaccinations,
                -- Shared symptoms history (Newly Added)
                (SELECT COALESCE(json_agg(json_build_object(
                    'id',             ss.id,
                    'doctor_id',      ss.doctor_id,
                    'appointment_id', ss.appointment_id,
                    'key_symptoms',   ss.key_symptoms,
                    'summary',        ss.summary,
                    'created_at',     ss.created_at
                ) ORDER BY ss.created_at DESC), '[]'::json)
                 FROM shared_symptoms ss
                 WHERE ss.patient_id = p.patient_id
                ) AS shared_symptoms
            FROM patient p
            JOIN users u ON u.id = p.user_id
            WHERE p.patient_id = $1
            LIMIT 1
        `, [patient_id]);

        // Lab reports with ALL metrics ordered by severity
        const reportsRes = await db.query_executor(`
            SELECT
                mr.report_id,
                mr.report_type,
                mr.report_date,
                mr.facility,
                mr.ordering_doctor,
                mr.uploaded_at,
                mr.raw_analysis->>'overall_impression' AS overall_impression,
                (SELECT COALESCE(json_agg(json_build_object(
                    'parameter',  lm.parameter_name,
                    'value',      lm.value,
                    'unit',       lm.unit,
                    'status',     lm.status,
                    'ref_range',  lm.reference_range,
                    'flagged',    lm.llm_flagged
                ) ORDER BY CASE lm.status
                    WHEN 'critical_high' THEN 1 WHEN 'critical_low' THEN 2
                    WHEN 'high'          THEN 3 WHEN 'low'          THEN 4
                    ELSE 5 END
                ), '[]'::json)
                 FROM report_metric lm WHERE lm.report_id = mr.report_id
                ) AS metrics
            FROM medical_report mr
            WHERE mr.patient_id = $1
            ORDER BY mr.uploaded_at DESC
            LIMIT 5
        `, [patient_id]);

        if (!profileRes.rows.length) return { error: 'Patient not found' };
        return {
            profile:  profileRes.rows[0],
            reports:  reportsRes.rows,
        };
    },
};

// Build a bound executor map: each function receives the tool input plus the
// calling userId so rag_search can include user-private vectors in future.
function buildExecutors(userId) {
    return {
        rag_search:               (input) => EXECUTORS.rag_search(input, userId),
        get_patient_profile:      (input) => EXECUTORS.get_patient_profile(input),
        get_report_history:       (input) => EXECUTORS.get_report_history(input),
        get_patient_chart_by_id:  (input) => EXECUTORS.get_patient_chart_by_id(input),
    };
}

function buildDoctorExecutors() {
    return {
        rag_search:              (input) => EXECUTORS.rag_search(input, null),
        get_patient_chart_by_id: (input) => EXECUTORS.get_patient_chart_by_id(input),
    };
}

module.exports = { SCHEMAS, EXECUTORS, buildExecutors, buildDoctorExecutors };
