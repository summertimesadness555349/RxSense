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

function normalizeDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    // Already ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD-MM-YYYY or DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // MM-DD-YYYY or MM/DD/YYYY
    const mdy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
    // Try native parse as last resort
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
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
        const safeDate = normalizeDate(reportDate);

        await db.query_executor(`
            DELETE FROM patient_report_vector
            WHERE report_id = $1
        `, [reportId]);

        await db.query_executor(`
            INSERT INTO patient_report_vector (patient_id, report_id, report_date, embedding, summary_text, is_public)
            VALUES ($1, $2, $3, $4::vector, $5, true)
        `, [patientId, reportId, safeDate, JSON.stringify(embedding), summaryText]);

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
