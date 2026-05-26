const patientModel = require('../models/patientModel');
const ReportAnalysisUtils = require('../utils/reportAnalysisUtils.js');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class PatientController {
    constructor() {
        this.patientModel = new patientModel();
        this.reportAnalysisUtils = new ReportAnalysisUtils();
    }

    analyzeReport = async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'A PDF or image report file is required'
                });
            }

            const reportType = req.body?.reportType || 'Other';
            const requestedPatientId = req.user?.patient_id || req.user?.uuid || req.body?.patientId || null;
            const patientId = UUID_RE.test(String(requestedPatientId || '')) ? requestedPatientId : null;

            const analysisResult = await this.reportAnalysisUtils.analyze({
                file: req.file,
                reportType
            });

            let reportRecord = null;
            const savedMetrics = [];

            if (patientId) {
                const reportTypeEnum = this.reportAnalysisUtils.getReportTypeEnum(reportType);
                reportRecord = await this.patientModel.createMedicalReport({
                    patientId,
                    reportType: reportTypeEnum,
                    storagePath: `memory://${Date.now()}-${req.file.originalname}`
                });

                const labResults = analysisResult.extracted_data?.lab_results || [];
                for (const metric of labResults) {
                    const dbStatus = this.reportAnalysisUtils.normalizeMetricStatus(metric.status);
                    const saved = await this.patientModel.addReportMetric({
                        reportId: reportRecord.report_id,
                        parameterName: metric.test,
                        value: metric.value,
                        unit: metric.unit,
                        referenceRange: metric.reference_range,
                        status: dbStatus,
                        llmFlagged: dbStatus !== 'normal' || String(metric.status || '').toLowerCase().includes('borderline')
                    });
                    savedMetrics.push(saved);
                }

                await this.patientModel.logLLMQuery({
                    patientId,
                    queryType: 'lab_analysis',
                    inputContext: JSON.stringify({
                        reportType,
                        filename: req.file.originalname,
                        mimeType: req.file.mimetype,
                        size: req.file.size
                    }),
                    outputSummary: analysisResult.summary?.full_plain_text_summary || analysisResult.summary?.clinical_summary?.impression || 'Report analyzed',
                    modelUsed: analysisResult._meta?.model_used || 'unknown',
                    tokensUsed: analysisResult._meta?.tokens_used || 0
                });
            }

            const labResults = analysisResult.extracted_data?.lab_results || [];
            labResults.forEach((metric, index) => {
                if (savedMetrics[index]?.metric_id) {
                    metric.metric_id = savedMetrics[index].metric_id;
                }
            });

            return res.status(200).json({
                success: true,
                saved: Boolean(reportRecord),
                report: this.reportAnalysisUtils.toFrontendResult({ analysisResult, reportRecord })
            });
        } catch (error) {
            console.error('Report analysis failed:', error.message);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to analyze report'
            });
        }
    };

    getProfile = async (req, res) => {
        try {
            console.log('Get patient profile request by user:', req.user);
            const patientId = req.user?.id || req.params.patientId || req.user?.patient_id;

            if (!patientId) {
                return res.status(400).json({
                    success: false,
                    error: 'patientId is required'
                });
            }

            const patient = await this.patientModel.getPatientProfile({ patientId });

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            return res.status(200).json({
                success: true,
                user: patient
            });
        } catch (error) {
            console.error('Get patient profile error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

}

module.exports = PatientController;
