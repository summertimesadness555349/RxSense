'use strict';

const PatientModel = require('../models/patientModel.js');

const REPORT_TYPE_LABELS = {
    CBC: 'CBC',
    lipid_panel: 'Lipid Panel',
    metabolic_panel: 'Metabolic Panel',
    urine_analysis: 'Urine Analysis',
    thyroid: 'Thyroid Panel',
    other: 'Other',
};

const STATUS_LABELS = {
    critical_low: 'Critical Low',
    critical_high: 'Critical High',
    high: 'High',
    low: 'Low',
    normal: 'Normal',
};

const RISK_URGENCY = {
    low: 'low',
    moderate: 'moderate',
    high: 'high',
    critical: 'high',
};

const parseMaybeJson = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (err) {
            return null;
        }
    }
    return value;
};

const toIso = (value, fallback) => {
    const date = value ? new Date(value) : null;
    if (date && !Number.isNaN(date.getTime())) return date.toISOString();

    const fallbackDate = fallback ? new Date(fallback) : new Date();
    if (!Number.isNaN(fallbackDate.getTime())) return fallbackDate.toISOString();

    return new Date().toISOString();
};

const formatMetricValue = (metric) => {
    const name = metric.parameter_name || 'Value';
    const value = metric.value != null ? String(metric.value) : '';
    const unit = metric.unit ? ` ${metric.unit}` : '';
    return `${name} ${value}${unit}`.trim();
};

const formatMetricWithStatus = (metric) => {
    const base = formatMetricValue(metric);
    const status = STATUS_LABELS[String(metric.status || '').toLowerCase()] || null;
    return status ? `${base} (${status})` : base;
};

const formatReportType = (reportType, rawAnalysis) => {
    if (rawAnalysis?.report_type) return rawAnalysis.report_type;
    if (rawAnalysis?.type) return rawAnalysis.type;
    if (!reportType) return 'Medical Report';
    return REPORT_TYPE_LABELS[reportType] || reportType;
};

const extractSymptoms = (data) => {
    const raw = parseMaybeJson(data);
    if (!raw) return [];

    if (Array.isArray(raw)) {
        return raw.map((s) => String(s).trim()).filter(Boolean);
    }

    const candidates = [
        'symptoms',
        'selectedSymptoms',
        'reportedSymptoms',
        'complaints',
        'items',
    ];

    for (const key of candidates) {
        if (Array.isArray(raw[key])) {
            return raw[key].map((s) => String(s).trim()).filter(Boolean);
        }
    }

    if (typeof raw.symptom === 'string') return [raw.symptom.trim()].filter(Boolean);
    if (typeof raw.primary_symptom === 'string') return [raw.primary_symptom.trim()].filter(Boolean);

    return [];
};

const buildReportUrgency = (abnormalMetrics) => {
    if (!abnormalMetrics.length) return null;
    const hasCritical = abnormalMetrics.some((metric) =>
        String(metric.status || '').toLowerCase().startsWith('critical')
    );
    return hasCritical ? 'high' : 'moderate';
};

class TimelineController {
    constructor() {
        this.patientModel = new PatientModel();
    }

    getTimeline = async (req, res) => {
        try {
            const userId = req.params.userId || req.user?.id;
            if (!userId) {
                return res.status(400).json({ success: false, error: 'userId is required' });
            }

            const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
            const identity = await this.patientModel.resolvePatientIdentity(userId);

            if (!identity.patientId && !identity.userId) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            const [reports, scans, symptoms, vaccinations, conditions] = await Promise.all([
                identity.patientId
                    ? this.patientModel.getTimelineReports(identity.patientId, limit)
                    : Promise.resolve([]),
                this.patientModel.getTimelinePrescriptionScans({
                    patientId: identity.patientId,
                    userId: identity.userId,
                    limit,
                }),
                identity.patientId
                    ? this.patientModel.getTimelineSymptoms(identity.patientId, limit)
                    : Promise.resolve([]),
                identity.patientId
                    ? this.patientModel.getTimelineVaccinations(identity.patientId, limit)
                    : Promise.resolve([]),
                identity.patientId
                    ? this.patientModel.getTimelineConditions(identity.patientId, limit)
                    : Promise.resolve([]),
            ]);

            let metrics = [];
            if (reports.length) {
                const reportIds = reports.map((report) => report.report_id);
                metrics = await this.patientModel.getTimelineReportMetrics(reportIds);
            }

            const metricsByReport = new Map();
            for (const metric of metrics) {
                const list = metricsByReport.get(metric.report_id) || [];
                list.push(metric);
                metricsByReport.set(metric.report_id, list);
            }

            const entries = [];

            for (const report of reports) {
                const rawAnalysis = parseMaybeJson(report.raw_analysis) || {};
                const reportMetrics = metricsByReport.get(report.report_id) || [];
                const abnormal = reportMetrics.filter(
                    (metric) => metric.llm_flagged || (metric.status && metric.status !== 'normal')
                );

                const abnormalValues = abnormal.length
                    ? abnormal.map(formatMetricValue).slice(0, 6)
                    : null;

                const abnormalSummary = abnormal.length
                    ? abnormal.map(formatMetricWithStatus).slice(0, 3)
                    : [];

                const summary = abnormalSummary.length
                    ? `${abnormal.length} abnormal value${abnormal.length === 1 ? '' : 's'}: ${abnormalSummary.join(', ')}`
                    : 'All values within normal range';

                const aiInsight =
                    rawAnalysis.overall_impression ||
                    rawAnalysis.overallImpression ||
                    rawAnalysis.impression ||
                    rawAnalysis.summary ||
                    null;

                const urgency = buildReportUrgency(abnormal);

                entries.push({
                    id: `tl_report_${report.report_id}`,
                    date: toIso(report.report_date, report.uploaded_at),
                    type: 'report',
                    title: 'Blood Test Analyzed',
                    summary,
                    urgency,
                    linkedId: report.report_id,
                    details: {
                        reportType: formatReportType(report.report_type, rawAnalysis),
                        lab: report.facility || null,
                        abnormalValues,
                    },
                    aiInsight,
                });
            }

            for (const scan of scans) {
                const medsRaw = parseMaybeJson(scan.medications) || [];
                const medications = Array.isArray(medsRaw) ? medsRaw : [];

                const medNames = medications
                    .map((med) =>
                        med.matched_brand ||
                        med.extracted_name ||
                        med.name ||
                        med.generic ||
                        med.brand ||
                        null
                    )
                    .filter(Boolean);

                const medLabels = medications
                    .map((med) => {
                        const name =
                            med.matched_brand ||
                            med.extracted_name ||
                            med.name ||
                            med.generic ||
                            med.brand ||
                            'Medication';
                        const dose =
                            med.dosage_from_prescription ||
                            med.dosage ||
                            med.strength ||
                            null;
                        return dose ? `${name} ${dose}` : name;
                    })
                    .filter(Boolean);

                const summary = medNames.length
                    ? `${medNames.length} medication${medNames.length === 1 ? '' : 's'}: ${medNames.slice(0, 3).join(', ')}`
                    : 'Prescription scanned';

                entries.push({
                    id: `tl_rx_${scan.scan_id}`,
                    date: toIso(scan.rx_date, scan.created_at),
                    type: 'prescription',
                    title: 'Prescription Scanned',
                    summary,
                    linkedId: scan.scan_id,
                    details: {
                        doctor: scan.doctor_name || null,
                        doctorSpecialty: scan.doctor_specialty || null,
                        hospital: scan.hospital_name || null,
                        medications: medLabels.length ? medLabels : null,
                    },
                });
            }

            for (const symptom of symptoms) {
                const symptomList = extractSymptoms(symptom.symptoms_data);
                const riskLevel = String(symptom.risk_level || '').toLowerCase();
                const riskLabel = riskLevel ? riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1) : null;

                let summary = symptomList.length
                    ? `Reported ${symptomList.join(', ')}`
                    : 'Symptom check completed';
                if (riskLabel) summary += ` - Risk: ${riskLabel}`;

                entries.push({
                    id: `tl_symptom_${symptom.log_id}`,
                    date: toIso(symptom.logged_at),
                    type: 'symptom',
                    title: 'Symptom Check',
                    summary,
                    urgency: RISK_URGENCY[riskLevel] || null,
                    details: {
                        symptoms: symptomList.length ? symptomList : null,
                        aiSuggestion: symptom.recommendation || null,
                        bodySystem: symptom.body_system || null,
                    },
                });
            }

            for (const vaccination of vaccinations) {
                const doseLabel =
                    vaccination.dose_number && vaccination.total_doses
                        ? `Dose ${vaccination.dose_number}/${vaccination.total_doses}`
                        : null;

                const summary = doseLabel
                    ? `${vaccination.vaccine_name} - ${doseLabel}`
                    : vaccination.vaccine_name;

                entries.push({
                    id: `tl_vax_${vaccination.vaccination_id}`,
                    date: toIso(vaccination.administered_at),
                    type: 'vaccination',
                    title: 'Vaccination Recorded',
                    summary,
                    linkedId: vaccination.vaccination_id,
                    details: {
                        vaccine: vaccination.vaccine_name,
                        dose: doseLabel,
                        facility: vaccination.facility || null,
                    },
                });
            }

            for (const condition of conditions) {
                const doctorLabel = condition.doctor_name || 'Doctor';
                const summary = condition.condition_name
                    ? `${doctorLabel} - Diagnosis: ${condition.condition_name}`
                    : 'Doctor visit logged';

                entries.push({
                    id: `tl_visit_${condition.condition_id}`,
                    date: toIso(condition.diagnosed_at, condition.created_at),
                    type: 'visit',
                    title: 'Doctor Visit Logged',
                    summary,
                    details: {
                        doctor: condition.doctor_name || null,
                        doctorSpecialty: condition.doctor_specialty || null,
                        diagnosis: condition.condition_name || null,
                        notes: condition.notes || null,
                    },
                });
            }

            const timeline = entries
                .filter(Boolean)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return res.status(200).json({ success: true, timeline });
        } catch (error) {
            console.error('[Timeline] Error:', error.message);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };
}

module.exports = TimelineController;
