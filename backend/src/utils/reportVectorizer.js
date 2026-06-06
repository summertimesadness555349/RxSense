'use strict';

const { embedSingle } = require('../rag/embeddings.js');
const DB_Connection = require('../database/db.js');

function buildReportSummary(metrics) {
    if (!metrics || metrics.length === 0) {
        return 'Medical report with no metrics';
    }

    const summaryParts = metrics.map(m => {
        const line = [
            m.parameter_name,
            m.value,
            m.unit || ''
        ].filter(Boolean).join(' ');

        if (m.status && m.status !== 'normal') {
            return `${line} (${m.status})`;
        }
        return line;
    });

    return summaryParts.join(', ');
}

async function vectorizeReport(patientId, reportId, reportData, reportDate) {
    try {
        const metrics = reportData.metrics || reportData || [];
        const summaryText = buildReportSummary(metrics);

        if (!summaryText || summaryText.length === 0) {
            console.warn(`[reportVectorizer] No summary text for report ${reportId}`);
            return null;
        }

        const embedding = await embedSingle(summaryText);

        if (!embedding || !Array.isArray(embedding)) {
            console.warn(`[reportVectorizer] Invalid embedding received for report ${reportId}`);
            return null;
        }

        const db = DB_Connection.getInstance();

        await db.query_executor(`
            INSERT INTO patient_report_vector (patient_id, report_id, report_date, embedding, summary_text, is_public)
            VALUES ($1, $2, $3, $4::vector, $5, true)
            ON CONFLICT DO NOTHING
        `, [patientId, reportId, reportDate, JSON.stringify(embedding), summaryText]);

        return {
            reportId,
            summary: summaryText,
            embeddingDim: embedding.length
        };
    } catch (error) {
        console.error(`[reportVectorizer] Error vectorizing report ${reportId}:`, error.message);
        return null;
    }
}

module.exports = {
    buildReportSummary,
    vectorizeReport
};
