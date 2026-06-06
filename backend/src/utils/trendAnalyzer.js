'use strict';

const DB_Connection = require('../database/db.js');

function parseNumericValue(value) {
    if (!value) return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
}

function toTime(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function calculateSlope(values) {
    if (values.length < 2) return 0;

    const n = values.length;
    const xValues = values.map((_, i) => i);
    const yValues = values.map(v => v.numValue);

    const xMean = xValues.reduce((a, b) => a + b) / n;
    const yMean = yValues.reduce((a, b) => a + b) / n;

    const numerator = values.reduce((sum, v, i) => {
        return sum + (i - xMean) * (v.numValue - yMean);
    }, 0);

    const denominator = xValues.reduce((sum, x) => sum + (x - xMean) ** 2, 0);

    return denominator === 0 ? 0 : numerator / denominator;
}

function calculateVolatility(values) {
    if (values.length < 2) return 0;

    const numValues = values.map(v => v.numValue);
    const mean = numValues.reduce((a, b) => a + b) / numValues.length;

    const variance = numValues.reduce((sum, v) => {
        return sum + (v - mean) ** 2;
    }, 0) / numValues.length;

    return Math.sqrt(variance);
}

async function computePatientTrends(patientId) {
    const db = DB_Connection.getInstance();

    const result = await db.query_executor(`
        SELECT
            rm.parameter_name,
            rm.value,
            rm.unit,
            rm.status,
            mr.uploaded_at
        FROM report_metric rm
        JOIN medical_report mr ON mr.report_id = rm.report_id
        WHERE mr.patient_id = $1
        ORDER BY mr.uploaded_at DESC
        LIMIT 100
    `, [patientId]);

    const metricsMap = new Map();

    result.rows.forEach(row => {
        const numValue = parseNumericValue(row.value);
        if (numValue === null) return;

        const key = row.parameter_name;
        if (!metricsMap.has(key)) {
            metricsMap.set(key, []);
        }

        metricsMap.get(key).push({
            numValue,
            date: row.uploaded_at,
            unit: row.unit,
            status: row.status,
            rawValue: row.value
        });
    });

    const trends = {};

    metricsMap.forEach((values, metricName) => {
        if (values.length < 2) return;

        values.sort((a, b) => toTime(a.date) - toTime(b.date));
        const current = values[values.length - 1];

        const slope = calculateSlope(values);
        const volatility = calculateVolatility(values);

        let direction = 'stable';
        if (slope > 0.1) direction = 'increasing';
        else if (slope < -0.1) direction = 'decreasing';

        trends[metricName] = {
            direction,
            slope: parseFloat(slope.toFixed(4)),
            volatility: parseFloat(volatility.toFixed(4)),
            current: current.rawValue,
            currentUnit: current.unit,
            currentStatus: current.status,
            historicalValues: values.map(v => ({
                date: v.date,
                value: v.rawValue,
                unit: v.unit,
                status: v.status
            })),
            dataPoints: values.length
        };
    });

    return trends;
}

async function updateMetricTrends(patientId) {
    const db = DB_Connection.getInstance();
    const trends = await computePatientTrends(patientId);

    for (const [metricName, trendData] of Object.entries(trends)) {
        const values = trendData.historicalValues.map(v => ({
            date: v.date,
            value: v.value,
            unit: v.unit,
            status: v.status
        }));

        const updated = await db.query_executor(`
            UPDATE metric_trends
            SET values = $3::jsonb,
                trend_slope = $4,
                volatility = $5,
                trend_direction = $6,
                last_computed = NOW()
            WHERE patient_id = $1
                AND metric_name = $2
            RETURNING id
        `, [patientId, metricName, JSON.stringify(values), trendData.slope, trendData.volatility, trendData.direction]);

        if (!updated.rows.length) {
            await db.query_executor(`
                INSERT INTO metric_trends (patient_id, metric_name, values, trend_slope, volatility, trend_direction, last_computed)
                VALUES ($1, $2, $3::jsonb, $4, $5, $6, NOW())
            `, [patientId, metricName, JSON.stringify(values), trendData.slope, trendData.volatility, trendData.direction]);
        }
    }

    return trends;
}

module.exports = {
    computePatientTrends,
    updateMetricTrends
};
