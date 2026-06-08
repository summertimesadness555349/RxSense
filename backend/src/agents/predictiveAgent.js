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
4. Provide evidence-based reasoning linking trends, patient context, and cohort outcomes

Use plain complication names, not raw lab parameter names. Good examples: "Possible anemia risk", "Possible diabetes risk", "Possible kidney strain", "Possible liver stress", "Possible infection or inflammation pattern". Do not output "Eosinophils", "Monocytes", "Worsening of Hemoglobin", slope values, or cohort debug text as the complication. Return at most 6 strong predictions.

Output ONLY a valid JSON object with no markdown:
{
  "predictions": [
    {
      "metric_name": "HbA1c",
      "trend": "increasing",
      "confidence": 0.82,
      "predicted_complication": "Possible diabetes progression",
      "reasoning": "Blood sugar control appears to be worsening over time, which can increase the chance of diabetes-related problems if it continues.",
      "comparable_patients": 3,
      "time_window": "6 months",
      "severity": "high",
      "preventive_action": "Increase medication adherence and reduce carbohydrate intake"
    }
  ],
  "overall_risk_assessment": "Moderate - patient shows patterns that may need follow-up, but this is not a diagnosis"
}`;

async function generatePredictions(patientId) {
    try {
        const trends = await computePatientTrends(patientId);
        const cohortPatients = await findSimilarPatients(patientId, 5);
        const cohortPatientIds = cohortPatients.map(p => p.patient_id);
        const outcomes = await getCohortOutcomes(cohortPatientIds);
        const context = await getPredictionContext(patientId, cohortPatientIds);

        const trendSummary = Object.entries(trends)
            .slice(0, 10)
            .map(([name, data]) => {
                return `${name}: ${data.direction} (slope: ${data.slope}, current: ${data.current}${data.currentUnit || ''}, status: ${data.currentStatus})`;
            })
            .join('\n');

        const outcomeSummary = outcomes.complications
            .slice(0, 5)
            .map(c => `${c.name}: ${c.count} patients (${c.percentage}%)`)
            .join('\n');

        const userMessage = `Analyze this patient's health predictions:

PATIENT CONTEXT:
${context.patientSummary}

KNOWN CONDITIONS:
${context.conditionSummary || 'No known conditions documented'}

CURRENT / RECENT MEDICATIONS:
${context.medicationSummary || 'No active medications documented'}

LATEST REPORT FINDINGS:
${context.latestMetricSummary || 'No latest lab metrics documented'}

PATIENT TRENDS (last 6+ months):
${trendSummary || 'No significant trends detected'}

SIMILAR PATIENTS ANALYSIS (${cohortPatientIds.length} patients found):
Complications observed in similar patients:
${outcomeSummary || 'No complications documented'}

CANDIDATE COHORT TREND PATTERNS:
${context.cohortTrendSummary || 'No cohort trend patterns documented'}

Based on the patient context, their metric trends, and similar patient outcomes, predict only the strongest possible future complications and with what probability.`;

        try {
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
                const cleanText = response.text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanText);
                const normalized = normalizePredictionList(parsed.predictions || []);
                return {
                    success: true,
                    predictions: normalized,
                    overallRisk: parsed.overall_risk_assessment || '',
                    cohortSize: cohortPatientIds.length,
                    trendCount: Object.keys(trends).length
                };
            } catch (parseError) {
                console.warn('[predictiveAgent] Failed to parse LLM response, falling back to heuristic predictions:', parseError.message);
                console.warn('[predictiveAgent] raw LLM response:', response.text.slice(0, 1000));
                // Fallback: build simple heuristic predictions from trends and cohort outcomes
                const fallback = buildFallbackPredictions(trends, outcomes, cohortPatientIds.length);
                return {
                    success: true,
                    predictions: fallback.predictions || [],
                    overallRisk: fallback.overallRisk,
                    cohortSize: cohortPatientIds.length,
                    trendCount: Object.keys(trends).length,
                    rawResponse: response.text
                };
            }
        } catch (llmError) {
            console.warn('[predictiveAgent] OpenAI agent error, falling back to heuristic predictions:', llmError.message);
            const fallback = buildFallbackPredictions(trends, outcomes, cohortPatientIds.length);
            return {
                success: true,
                predictions: fallback.predictions || [],
                overallRisk: fallback.overallRisk,
                cohortSize: cohortPatientIds.length,
                trendCount: Object.keys(trends).length,
                error: llmError.message
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
    const db = DB_Connection.getInstance();
    const savedPredictions = [];
    const normalizedPredictions = normalizePredictionList(predictions.predictions || []);

    await db.query_executor(`
        DELETE FROM patient_predictions
        WHERE patient_id = $1
            AND (expires_at IS NULL OR expires_at > NOW())
    `, [patientId]);

    if (normalizedPredictions.length === 0) {
        return [];
    }

    for (const pred of normalizedPredictions) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const predictedValue = normalizeComplicationName(pred.predicted_complication || pred.predicted_value, pred.metric_name);
        const reasoning = cleanReasoning(pred.reasoning, pred.metric_name, predictedValue);
        const severity = pred.severity || pred.severity_level || 'moderate';

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
                predictedValue,
                reasoning,
                pred.comparable_patients || 0,
                pred.trend,
                severity,
                expiresAt.toISOString()
            ]);

            savedPredictions.push({
                id: result.rows[0].id,
                report_id: reportId,
                metric_name: pred.metric_name,
                prediction_type: 'cohort_risk',
                confidence: pred.confidence || 0.5,
                predicted_date: pred.time_window ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
                predicted_value: predictedValue,
                reasoning,
                comparable_patients: pred.comparable_patients || 0,
                trend_direction: pred.trend,
                severity_level: severity,
                preventive_action: pred.preventive_action || null
            });
        } catch (error) {
            console.error('[predictiveAgent] Error saving prediction:', error.message);
        }
    }

    return savedPredictions;
}

async function getPredictionContext(patientId, cohortPatientIds) {
    const db = DB_Connection.getInstance();
    const context = {
        patientSummary: 'No patient profile documented',
        conditionSummary: '',
        medicationSummary: '',
        latestMetricSummary: '',
        cohortTrendSummary: ''
    };

    try {
        const patient = await db.query_executor(`
            SELECT
                gender,
                blood_group,
                smoking_status,
                height,
                weight,
                CASE
                    WHEN date_of_birth IS NOT NULL THEN DATE_PART('year', AGE(date_of_birth))::int
                    ELSE NULL
                END AS age
            FROM patient
            WHERE patient_id = $1
            LIMIT 1
        `, [patientId]);

        const row = patient.rows[0];
        if (row) {
            context.patientSummary = [
                row.age != null ? `Age ${row.age}` : null,
                row.gender ? `Gender ${row.gender}` : null,
                row.blood_group ? `Blood group ${row.blood_group}` : null,
                row.smoking_status ? `Smoking status ${row.smoking_status}` : null,
                row.height ? `Height ${row.height}` : null,
                row.weight ? `Weight ${row.weight}` : null
            ].filter(Boolean).join(', ') || context.patientSummary;
        }
    } catch (error) {
        console.warn('[predictiveAgent] Patient context unavailable:', error.message);
    }

    try {
        const conditions = await db.query_executor(`
            SELECT condition_name, status, severity
            FROM known_condition
            WHERE patient_id = $1
            ORDER BY COALESCE(diagnosed_at, created_at) DESC
            LIMIT 8
        `, [patientId]);

        context.conditionSummary = conditions.rows
            .map((condition) => [
                condition.condition_name,
                condition.status ? `status: ${condition.status}` : null,
                condition.severity ? `severity: ${condition.severity}` : null
            ].filter(Boolean).join(' (') + (condition.status || condition.severity ? ')' : ''))
            .join('\n');
    } catch (error) {
        console.warn('[predictiveAgent] Condition context unavailable:', error.message);
    }

    try {
        const medications = await db.query_executor(`
            SELECT
                COALESCE(d.generic_name, d.brand_name, 'Unknown') AS name,
                pi.dosage,
                pi.frequency,
                pi.status
            FROM prescription_item pi
            LEFT JOIN drug d ON d.drug_id = pi.drug_id
            JOIN prescription_scan ps ON ps.scan_id = pi.prescription_id
            WHERE ps.patient_id = $1
                AND COALESCE(pi.status, 'active') = 'active'
            ORDER BY ps.created_at DESC
            LIMIT 8
        `, [patientId]);

        context.medicationSummary = medications.rows
            .map((medication) => [
                medication.name,
                medication.dosage,
                medication.frequency
            ].filter(Boolean).join(' '))
            .join('\n');
    } catch (error) {
        console.warn('[predictiveAgent] Medication context unavailable:', error.message);
    }

    try {
        const latestMetrics = await db.query_executor(`
            SELECT DISTINCT ON (LOWER(TRIM(rm.parameter_name)))
                rm.parameter_name,
                rm.value,
                rm.unit,
                rm.status,
                mr.uploaded_at
            FROM report_metric rm
            JOIN medical_report mr ON mr.report_id = rm.report_id
            WHERE mr.patient_id = $1
            ORDER BY LOWER(TRIM(rm.parameter_name)), mr.uploaded_at DESC
            LIMIT 20
        `, [patientId]);

        context.latestMetricSummary = latestMetrics.rows
            .map((metric) => `${metric.parameter_name}: ${metric.value}${metric.unit ? ' ' + metric.unit : ''}${metric.status ? ` (${metric.status})` : ''}`)
            .join('\n');
    } catch (error) {
        console.warn('[predictiveAgent] Latest metric context unavailable:', error.message);
    }

    if (cohortPatientIds.length > 0) {
        try {
            const cohortTrends = await db.query_executor(`
                SELECT metric_name, trend_direction, COUNT(*)::int AS count
                FROM metric_trends
                WHERE patient_id = ANY($1::uuid[])
                GROUP BY metric_name, trend_direction
                ORDER BY count DESC
                LIMIT 12
            `, [cohortPatientIds]);

            context.cohortTrendSummary = cohortTrends.rows
                .map((trend) => `${trend.metric_name}: ${trend.trend_direction} in ${trend.count} similar patient${trend.count === 1 ? '' : 's'}`)
                .join('\n');
        } catch (error) {
            console.warn('[predictiveAgent] Cohort trend context unavailable:', error.message);
        }
    }

    return context;
}

function normalizePredictionList(predictions) {
    const severityRank = { critical: 4, high: 3, moderate: 2, low: 1 };
    const byComplication = new Map();

    for (const prediction of predictions || []) {
        const predictedValue = normalizeComplicationName(prediction.predicted_complication || prediction.predicted_value, prediction.metric_name);
        const reasoning = cleanReasoning(prediction.reasoning, prediction.metric_name, predictedValue);
        const confidence = normalizeConfidence(prediction.confidence);
        const severity = prediction.severity || prediction.severity_level || (confidence >= 0.75 ? 'high' : confidence >= 0.55 ? 'moderate' : 'low');
        const normalized = {
            ...prediction,
            confidence,
            predicted_complication: predictedValue,
            predicted_value: predictedValue,
            reasoning,
            severity,
            severity_level: severity,
            trend: prediction.trend || prediction.trend_direction || 'stable'
        };
        const key = predictedValue.toLowerCase();
        const existing = byComplication.get(key);
        if (!existing || confidence > existing.confidence || severityRank[severity] > severityRank[existing.severity_level]) {
            byComplication.set(key, normalized);
        }
    }

    return [...byComplication.values()]
        .sort((a, b) => {
            const severityDelta = (severityRank[b.severity_level] || 0) - (severityRank[a.severity_level] || 0);
            if (severityDelta) return severityDelta;
            return (b.confidence || 0) - (a.confidence || 0);
        })
        .slice(0, 6);
}

function normalizeConfidence(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0.5;
    if (parsed > 1) return Math.min(parsed / 100, 1);
    return Math.max(Math.min(parsed, 1), 0);
}

function buildFallbackPredictions(trends, outcomes, cohortSize) {
    const preds = [];
    const trendEntries = Object.entries(trends || {});

    for (const [metric, data] of trendEntries) {
        const slope = Math.abs(Number(data.slope) || 0);
        const direction = data.direction || 'stable';
        const status = String(data.currentStatus || '').toLowerCase();
        const isAbnormal = status && status !== 'normal';
        const isChanging = direction !== 'stable' && slope > 0;

        if (!isAbnormal && !isChanging) continue;

        let confidence = 0.4;
        if (direction === 'increasing') confidence = Math.min(0.6 + Math.min(slope * 0.5, 0.35), 0.95);
        else if (direction === 'decreasing') confidence = Math.min(0.5 + Math.min(slope * 0.25, 0.25), 0.9);
        if (isAbnormal && confidence < 0.55) confidence = 0.55;

        const topOutcome = (outcomes && outcomes.complications && outcomes.complications[0]) || null;
        const mapped = mapMetricToComplication(metric);
        const predicted_complication = topOutcome ? normalizeComplicationName(topOutcome.name, metric) : mapped.title;

        preds.push({
            metric_name: metric,
            trend: direction,
            confidence: Number(confidence.toFixed(2)),
            predicted_complication,
            reasoning: mapped.reason,
            comparable_patients: topOutcome ? topOutcome.count : cohortSize,
            time_window: '6 months',
            severity: (confidence > 0.75) ? 'high' : (confidence > 0.55 ? 'moderate' : 'low'),
            severity_level: (confidence > 0.75) ? 'high' : (confidence > 0.55 ? 'moderate' : 'low')
        });

        if (preds.length >= 5) break;
    }

    const overallRisk = preds.length ? `Moderate - ${preds.length} possible complication pattern${preds.length === 1 ? '' : 's'} found for follow-up` : 'Low - no clear future complication pattern detected';
    return { predictions: preds, overallRisk };
}

function mapMetricToComplication(metric) {
    const name = String(metric || '').toLowerCase();
    const rules = [
        {
            keys: ['hemoglobin', 'hb', 'rbc', 'mcv', 'mch', 'mchc', 'hematocrit', 'pcv'],
            title: 'Possible anemia risk',
            reason: 'Blood count values suggest a pattern that can be seen with anemia or reduced oxygen-carrying capacity.'
        },
        {
            keys: ['hba1c', 'glucose', 'sugar', 'fbs', 'rbs'],
            title: 'Possible diabetes risk',
            reason: 'Sugar-related values suggest a pattern that can increase concern for diabetes or worsening blood sugar control.'
        },
        {
            keys: ['cholesterol', 'ldl', 'hdl', 'triglyceride'],
            title: 'Possible cardiovascular risk',
            reason: 'Cholesterol or lipid values suggest a pattern linked with higher heart and blood vessel risk over time.'
        },
        {
            keys: ['creatinine', 'urea', 'egfr', 'uric acid'],
            title: 'Possible kidney strain',
            reason: 'Kidney-related values suggest a pattern that may reflect reduced filtering capacity or kidney stress.'
        },
        {
            keys: ['alt', 'sgpt', 'ast', 'sgot', 'bilirubin', 'alkaline phosphatase'],
            title: 'Possible liver stress',
            reason: 'Liver-related values suggest a pattern that can appear when liver cells or bile flow are under stress.'
        },
        {
            keys: ['tsh', 't3', 't4', 'thyroid'],
            title: 'Possible thyroid imbalance',
            reason: 'Thyroid values suggest a pattern that can fit overactive or underactive thyroid function.'
        },
        {
            keys: ['wbc', 'neutrophil', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil', 'esr', 'crp'],
            title: 'Possible infection or inflammation pattern',
            reason: 'White blood cell or inflammation values suggest a pattern that can occur with infection, allergy, inflammation, or immune response.'
        },
        {
            keys: ['platelet'],
            title: 'Possible bleeding or clotting concern',
            reason: 'Platelet values suggest a pattern that can matter for bleeding or clotting risk if it changes further.'
        }
    ];

    return rules.find((rule) => rule.keys.some((key) => name.includes(key))) || {
        title: 'Possible health complication',
        reason: 'Report trends suggest a pattern that may need follow-up if it continues or symptoms appear.'
    };
}

function normalizeComplicationName(value, metric) {
    const raw = String(value || '').trim();
    const metricName = String(metric || '').trim().toLowerCase();
    const rawLower = raw.toLowerCase();

    if (!raw || rawLower === metricName || rawLower === `${metricName}s` || rawLower.startsWith('worsening of ')) {
        return mapMetricToComplication(metric).title;
    }

    return raw;
}

function cleanReasoning(reasoning, metric, complication) {
    const raw = String(reasoning || '').trim();
    if (!raw || /\bslope\s*=|\bslope:|\bcohort\b|heuristic/i.test(raw)) {
        const mapped = mapMetricToComplication(metric || complication);
        return mapped.reason;
    }
    return raw;
}

module.exports = {
    generatePredictions,
    savePredictions
};
