'use strict';

const DB_Connection = require('../database/db.js');
const { generatePredictions, savePredictions } = require('../agents/predictiveAgent.js');
const { computePatientTrends } = require('../utils/trendAnalyzer.js');

class PredictiveController {
    getPredictions = async (req, res) => {
        const userId = req.user?.id;

        try {
            const db = DB_Connection.getInstance();

            const patientResult = await db.query_executor(`
                SELECT p.patient_id
                FROM patient p
                JOIN users u ON u.id = p.user_id
                WHERE u.id = $1
                LIMIT 1
            `, [userId]);

            if (!patientResult.rows.length) {
                return res.status(404).json({ success: false, message: 'Patient not found' });
            }

            const patientId = patientResult.rows[0].patient_id;

            const predictions = await db.query_executor(`
                SELECT *
                FROM (
                    SELECT DISTINCT ON (LOWER(TRIM(predicted_value)))
                        id,
                        report_id,
                        metric_name,
                        prediction_type,
                        confidence,
                        predicted_date,
                        predicted_value,
                        reasoning,
                        comparable_patients,
                        trend_direction,
                        severity_level,
                        created_at
                    FROM patient_predictions
                    WHERE patient_id = $1
                        AND expires_at > NOW()
                    ORDER BY LOWER(TRIM(predicted_value)), created_at DESC, confidence DESC
                ) latest_unique
                ORDER BY
                    CASE severity_level
                        WHEN 'critical' THEN 4
                        WHEN 'high' THEN 3
                        WHEN 'moderate' THEN 2
                        ELSE 1
                    END DESC,
                    confidence DESC,
                    created_at DESC
                LIMIT 6
            `, [patientId]);

            res.json({
                success: true,
                predictions: predictions.rows
            });
        } catch (error) {
            console.error('[PredictiveController] getPredictions error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    getMetricTrend = async (req, res) => {
        const { metricName } = req.params;
        const userId = req.user?.id;

        try {
            const db = DB_Connection.getInstance();

            const patientResult = await db.query_executor(`
                SELECT p.patient_id
                FROM patient p
                JOIN users u ON u.id = p.user_id
                WHERE u.id = $1
                LIMIT 1
            `, [userId]);

            if (!patientResult.rows.length) {
                return res.status(404).json({ success: false, message: 'Patient not found' });
            }

            const patientId = patientResult.rows[0].patient_id;

            const trendResult = await db.query_executor(`
                SELECT
                    id,
                    metric_name,
                    values,
                    trend_slope,
                    volatility,
                    trend_direction,
                    last_computed
                FROM metric_trends
                WHERE patient_id = $1
                    AND metric_name = $2
                LIMIT 1
            `, [patientId, metricName]);

            if (!trendResult.rows.length) {
                return res.status(404).json({ success: false, message: 'No trend data for this metric' });
            }

            res.json({
                success: true,
                trend: trendResult.rows[0]
            });
        } catch (error) {
            console.error('[PredictiveController] getMetricTrend error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    refreshPredictions = async (req, res) => {
        const userId = req.user?.id;

        try {
            const db = DB_Connection.getInstance();

            const patientResult = await db.query_executor(`
                SELECT p.patient_id
                FROM patient p
                JOIN users u ON u.id = p.user_id
                WHERE u.id = $1
                LIMIT 1
            `, [userId]);

            if (!patientResult.rows.length) {
                return res.status(404).json({ success: false, message: 'Patient not found' });
            }

            const patientId = patientResult.rows[0].patient_id;

            const latestReportResult = await db.query_executor(`
                SELECT report_id FROM medical_report
                WHERE patient_id = $1
                ORDER BY uploaded_at DESC
                LIMIT 1
            `, [patientId]);

            const reportId = latestReportResult.rows[0]?.report_id || null;

            const predictions = await generatePredictions(patientId);

            if (!predictions.success) {
                return res.status(500).json({ success: false, message: predictions.error });
            }

            const savedPredictions = await savePredictions(patientId, reportId, predictions);

            res.json({
                success: true,
                predictions: savedPredictions,
                cohortSize: predictions.cohortSize,
                overallRisk: predictions.overallRisk
            });
        } catch (error) {
            console.error('[PredictiveController] refreshPredictions error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    computeTrends = async (req, res) => {
        const userId = req.user?.id;

        try {
            const db = DB_Connection.getInstance();

            const patientResult = await db.query_executor(`
                SELECT p.patient_id
                FROM patient p
                JOIN users u ON u.id = p.user_id
                WHERE u.id = $1
                LIMIT 1
            `, [userId]);

            if (!patientResult.rows.length) {
                return res.status(404).json({ success: false, message: 'Patient not found' });
            }

            const patientId = patientResult.rows[0].patient_id;
            const trends = await computePatientTrends(patientId);

            res.json({
                success: true,
                trends
            });
        } catch (error) {
            console.error('[PredictiveController] computeTrends error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    };
}

module.exports = PredictiveController;
