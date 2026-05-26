const DB_Connection = require('../database/db.js')

class UserModel {
    constructor(){
        this.db_connection = new DB_Connection();
    }

    createMedicalReport = async ({ patientId, doctorId = null, reportType, storagePath = null }) => {
        const query = `
            INSERT INTO medical_report (patient_id, doctor_id, report_type, storage_path)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await this.db_connection.query_executor(query, [patientId, doctorId, reportType, storagePath]);
        return result.rows[0] || null;
    };

    addReportMetric = async ({ reportId, parameterName, value, unit, referenceRange, status, llmFlagged }) => {
        const query = `
            INSERT INTO report_metric (report_id, parameter_name, value, unit, reference_range, status, llm_flagged)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const params = [reportId, parameterName, value, unit, referenceRange, status, llmFlagged];
        const result = await this.db_connection.query_executor(query, params);
        return result.rows[0] || null;
    };

    logLLMQuery = async ({ patientId, queryType, inputContext, outputSummary, modelUsed, tokensUsed = 0 }) => {
        const query = `
            INSERT INTO llm_query_log (patient_id, query_type, input_context, output_summary, model_used, tokens_used)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING query_id;
        `;
        const params = [patientId, queryType, inputContext, outputSummary, modelUsed, tokensUsed];
        const result = await this.db_connection.query_executor(query, params);
        return result.rows[0] || null;
    };

    getReportMetrics = async (reportId) => {
        const query = `
            SELECT *
            FROM report_metric
            WHERE report_id = $1
            ORDER BY created_at ASC;
        `;
        const result = await this.db_connection.query_executor(query, [reportId]);
        return result.rows;
    };

}

module.exports = UserModel;
