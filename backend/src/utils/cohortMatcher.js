'use strict';

const DB_Connection = require('../database/db.js');

async function findSimilarPatients(patientId, topK = 5) {
    const db = DB_Connection.getInstance();

    try {
        const patientVector = await db.query_executor(`
            SELECT embedding FROM patient_report_vector
            WHERE patient_id = $1
            ORDER BY report_date DESC LIMIT 1
        `, [patientId]);

        if (!patientVector.rows.length) {
            return [];
        }

        const embedding = patientVector.rows[0].embedding;

        const cohort = await db.query_executor(`
            SELECT DISTINCT ON (prv.patient_id)
                prv.patient_id,
                prv.report_id,
                prv.report_date,
                1 - (prv.embedding <=> $1::vector) as similarity,
                prv.summary_text
            FROM patient_report_vector prv
            WHERE prv.is_public = true
                AND prv.patient_id != $2
            ORDER BY prv.patient_id, similarity DESC
            LIMIT $3
        `, [embedding, patientId, topK]);

        return cohort.rows;
    } catch (error) {
        console.error('[cohortMatcher] Error finding similar patients:', error.message);
        return [];
    }
}

async function getCohortOutcomes(cohortPatientIds) {
    if (!cohortPatientIds || cohortPatientIds.length === 0) {
        return {
            complications: [],
            complicationCounts: {},
            totalPatients: 0
        };
    }

    const db = DB_Connection.getInstance();

    try {
        const result = await db.query_executor(`
            SELECT
                kc.condition_name,
                kc.icd_10_code,
                COUNT(*) as count
            FROM known_condition kc
            WHERE kc.patient_id = ANY($1::uuid[])
                AND kc.status IN ('active', 'managed')
            GROUP BY kc.condition_name, kc.icd_10_code
            ORDER BY count DESC
        `, [cohortPatientIds]);

        const complicationCounts = {};
        const complications = [];

        result.rows.forEach(row => {
            complicationCounts[row.condition_name] = row.count;
            complications.push({
                name: row.condition_name,
                icdCode: row.icd_10_code,
                count: row.count,
                percentage: Math.round((row.count / cohortPatientIds.length) * 100)
            });
        });

        return {
            complications,
            complicationCounts,
            totalPatients: cohortPatientIds.length
        };
    } catch (error) {
        console.error('[cohortMatcher] Error getting cohort outcomes:', error.message);
        return {
            complications: [],
            complicationCounts: {},
            totalPatients: cohortPatientIds.length
        };
    }
}

module.exports = {
    findSimilarPatients,
    getCohortOutcomes
};
