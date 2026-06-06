'use strict';

const { runOpenAIAgent } = require('./openaiAgentRunner.js');
const DB_Connection = require('../database/db.js');
const { computePatientTrends } = require('../utils/trendAnalyzer.js');
const { findSimilarPatients, getCohortOutcomes } = require('../utils/cohortMatcher.js');

const PREDICTION_SYSTEM = `You are a clinical prediction AI that analyzes patient trends and similar patient outcomes to predict future health complications.

Your job is to:
1. Analyze the patient's trend data (how their metrics are changing over time)
2. Review similar patients and what complications they developed
3. Generate probability-based predictions about what this patient might experience
4. Provide evidence-based reasoning linking trends to outcomes

Output ONLY a valid JSON object with no markdown:
{
  "predictions": [
    {
      "metric_name": "HbA1c",
      "trend": "increasing",
      "confidence": 0.82,
      "predicted_complication": "Type 2 Diabetes Progression",
      "reasoning": "Patient HbA1c rising 0.15 points per month. 3 of 5 similar patients developed diabetes complications.",
      "comparable_patients": 3,
      "time_window": "6 months",
      "severity": "high",
      "preventive_action": "Increase medication adherence and reduce carbohydrate intake"
    }
  ],
  "overall_risk_assessment": "Moderate - patient shows concerning trends in 2 key metrics that match patterns in similar patients who developed complications"
}`;

async function generatePredictions(patientId) {
    try {
        const trends = await computePatientTrends(patientId);
        const cohortPatients = await findSimilarPatients(patientId, 5);
        const cohortPatientIds = cohortPatients.map(p => p.patient_id);
        const outcomes = await getCohortOutcomes(cohortPatientIds);

        const trendSummary = Object.entries(trends)
            .slice(0, 5)
            .map(([name, data]) => {
                return `${name}: ${data.direction} (slope: ${data.slope}, current: ${data.current}${data.currentUnit || ''}, status: ${data.currentStatus})`;
            })
            .join('\n');

        const outcomeSummary = outcomes.complications
            .slice(0, 5)
            .map(c => `${c.name}: ${c.count} patients (${c.percentage}%)`)
            .join('\n');

        const userMessage = `Analyze this patient's health predictions:

PATIENT TRENDS (last 6+ months):
${trendSummary || 'No significant trends detected'}

SIMILAR PATIENTS ANALYSIS (${cohortPatientIds.length} patients found):
Complications observed in similar patients:
${outcomeSummary || 'No complications documented'}

Based on these trends and similar patient outcomes, predict what health complications this patient might develop and with what probability.`;

        const response = await runOpenAIAgent({
            agentName: 'PredictionAgent',
            system: PREDICTION_SYSTEM,
            userMessage,
            tools: [],
            executors: {},
            maxTokens: 2048,
            temperature: 0.3
        });

        try {
            const parsed = JSON.parse(response.text);
            return {
                success: true,
                predictions: parsed.predictions || [],
                overallRisk: parsed.overall_risk_assessment || '',
                cohortSize: cohortPatientIds.length,
                trendCount: Object.keys(trends).length
            };
        } catch (parseError) {
            console.warn('[predictiveAgent] Failed to parse LLM response:', parseError.message);
            return {
                success: false,
                error: 'Failed to parse predictions',
                rawResponse: response.text
            };
        }
    } catch (error) {
        console.error('[predictiveAgent] Error generating predictions:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

async function savePredictions(patientId, reportId, predictions) {
    if (!predictions.predictions || predictions.predictions.length === 0) {
        return [];
    }

    const db = DB_Connection.getInstance();
    const savedPredictions = [];

    for (const pred of predictions.predictions) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        try {
            const result = await db.query_executor(`
                INSERT INTO patient_predictions (
                    patient_id,
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
                    created_at,
                    expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
                RETURNING id
            `, [
                patientId,
                reportId,
                pred.metric_name,
                'cohort_risk',
                pred.confidence || 0.5,
                pred.time_window ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
                pred.predicted_complication,
                pred.reasoning,
                pred.comparable_patients || 0,
                pred.trend,
                pred.severity,
                expiresAt.toISOString()
            ]);

            savedPredictions.push({
                id: result.rows[0].id,
                ...pred
            });
        } catch (error) {
            console.error('[predictiveAgent] Error saving prediction:', error.message);
        }
    }

    return savedPredictions;
}

module.exports = {
    generatePredictions,
    savePredictions
};
