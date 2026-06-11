const sharp         = require('sharp');
const patientModel  = require('../models/patientModel');
const ReportAnalysisUtils  = require('../utils/reportAnalysisUtils.js');
const { uploadReportBuffer } = require('../utils/cloudinary.js');
const AppointmentModel = require('../models/appointmentModel.js');
const DoctorModel = require('../models/doctorModel.js');
const drugInteractionService = require('../utils/drugInteractionService.js');
const LLMUtils = require('../utils/llmUtils.js');
const { vectorizeReport } = require('../utils/reportVectorizer.js');
const { generatePredictions, savePredictions } = require('../agents/predictiveAgent.js');
const { updateMetricTrends } = require('../utils/trendAnalyzer.js');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Formats Claude cannot handle natively — convert to JPEG first
const UNSUPPORTED_MIMETYPES = new Set([
    'image/avif', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
]);

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

class PatientController {
    constructor() {
        this.patientModel        = new patientModel();
        this.reportAnalysisUtils = new ReportAnalysisUtils();
        this.doctorModel         = new DoctorModel();
        this.appointmentModel    = new AppointmentModel();
        this.llmUtils            = new LLMUtils();
    }

    resolvePatientId = async (userId) => {
        const identity = await this.patientModel.resolvePatientIdentity(userId);
        return identity.patientId || (UUID_RE.test(String(userId || '')) ? userId : null);
    };

    analyzeReport = async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'A PDF or image report file is required' });
            }

            const userId    = req.user?.id || null;
            // const patientId = req.user?.patient_id || req.user?.uuid || req.body?.patientId || null;
            const { patientId }  = await this.patientModel.resolvePatientIdentity(userId);
            const reportType = req.body?.reportType || 'Other';

            // Normalize unsupported image formats → JPEG for Claude
            let apiBuffer   = req.file.buffer;
            let apiMimetype = req.file.mimetype;
            if (UNSUPPORTED_MIMETYPES.has(req.file.mimetype?.toLowerCase())) {
                console.log(`[Report] Converting ${req.file.mimetype} → JPEG for Claude`);
                apiBuffer   = await sharp(req.file.buffer).jpeg({ quality: 90 }).toBuffer();
                apiMimetype = 'image/jpeg';
            }

            // Validate that Claude can handle this type
            if (!this.reportAnalysisUtils.isSupportedType(apiMimetype)) {
                return res.status(400).json({
                    success: false,
                    error: `Unsupported file type. Upload PDF, PNG, JPG, WEBP, or GIF.`,
                });
            }

            const isImage = apiMimetype !== 'application/pdf';

            console.log(`[Report] Received: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);
            console.log(`[Report] Starting Cloudinary upload + Claude extraction in parallel...`);

            // Parallel: image upload to Cloudinary + Claude extraction
            const [cloudResult, extracted] = await Promise.all([
                isImage
                    ? uploadReportBuffer(apiBuffer, userId || 'anon').catch(err => {
                        console.warn('[Report] Cloudinary upload failed:', err.message);
                        return null;
                    })
                    : Promise.resolve(null),
                this.reportAnalysisUtils.extract({ buffer: apiBuffer, mimetype: apiMimetype, originalname: req.file.originalname }, reportType),
            ]);

            const imageUrl      = cloudResult?.secure_url || null;
            const imagePublicId = cloudResult?.public_id  || null;

            // Pass 1: fill from local lab_reference_ranges.json + compute status
            this.reportAnalysisUtils.enrichWithReferenceRanges(extracted);

            // Pass 2: DB fallback for entries still missing a reference_range
            const dbTargets = [];
            for (const section of (extracted.sections || [])) {
                if (section.type !== 'lab_results' && section.type !== 'vitals') continue;
                for (const entry of (section.entries || [])) {
                    if (!entry.reference_range) dbTargets.push(entry);
                }
            }
            if (dbTargets.length > 0) {
                await Promise.all(dbTargets.map(async (entry) => {
                    const info = await this.patientModel.findLabTestInfo(
                        entry.label.toLowerCase().trim()
                    );
                    if (info?.reference_range) entry.reference_range = info.reference_range;
                }));
            }

            console.log(`[Report] Extraction complete — type: ${extracted.report_type}, sections: ${extracted.sections?.length || 0}`);

            // Normalize extraction into DB-friendly raw_analysis (metrics list)
            // const dbAnalysis = this.reportAnalysisUtils.normalizeForDb(extracted, { imageUrl, typeOverride: reportType });

            // Save to DB if we have a valid UUID patient_id
            let reportRecord = null;
            let savedMetrics = [];
            const validPatientId = UUID_RE.test(String(patientId || '')) ? patientId : null;

            if (validPatientId) {
                try {
                    reportRecord = await this.patientModel.createMedicalReport({
                        userId:            userId,
                        patientId:         validPatientId,
                        reportType:        this.reportAnalysisUtils.getReportTypeEnum(reportType),
                        imageUrl,
                        imagePublicId,
                        rawAnalysis:       extracted ? JSON.stringify(extracted) : null,
                        reportDate:        extracted.report_date || null,
                        facility:          extracted.facility    || null,
                        orderingDoctor:    extracted.ordering_doctor || null,
                        patientNameRep:    extracted.patient?.name  || null,
                        patientJson:       extracted.patient || null,
                        overallImpression: extracted.overall_impression || null,
                        diagnoses:         extracted.diagnoses ? JSON.stringify(extracted.diagnoses) : null,
                        recommendations:   extracted.recommendations ? JSON.stringify(extracted.recommendations) : null,
                        clinical_notes:    extracted.clinical_notes || null,
                        follow_up:         extracted.follow_up || null,
                    });

                    // Save individual lab/vital metrics as report_metric rows
                    // Save individual lab/vital entries as report_metrics and collect saved rows
                    const sections = extracted.sections || [];
                    for (const section of sections) {
                        if (section.type === 'lab_results' || section.type === 'vitals') {
                            for (const entry of (section.entries || [])) {
                                const metric = await this.patientModel.addReportMetric({
                                    reportId:       reportRecord.report_id,
                                    sectionTitle:   section.title || "RESULTS",
                                    parameterName:  entry.label,
                                    value:          String(entry.value ?? ''),
                                    unit:           entry.unit   || null,
                                    referenceRange: entry.reference_range || null,
                                    status:         this.reportAnalysisUtils.normalizeMetricStatus(entry.status, entry.flag),
                                    llmFlagged:     (entry.status && entry.status !== 'normal') || Boolean(entry.flag),
                                }).catch(err => {
                                    console.warn('[Report] Metric save failed:', err.message);
                                    return null;
                                });
                                if (metric) savedMetrics.push(metric);
                            }
                        }
                    }
                    reportRecord.metrics = savedMetrics;

                    console.log(`[Report] Saved to DB — report_id: ${reportRecord.report_id}`);

                    await vectorizeReport(validPatientId, reportRecord.report_id, savedMetrics, extracted.report_date || new Date()).catch(err => {
                        console.warn('[Report] Vectorization failed:', err.message);
                    });

                    await updateMetricTrends(validPatientId).catch(err => {
                        console.warn('[Report] Trend update failed:', err.message);
                    });

                    try {
                        const predictions = await generatePredictions(validPatientId);
                        if (predictions.success) {
                            const savedPredictions = await savePredictions(validPatientId, reportRecord.report_id, predictions);
                            reportRecord.predictions = savedPredictions;
                            reportRecord.overallRisk = predictions.overallRisk;
                            reportRecord.cohortSize = predictions.cohortSize || 0;
                        }
                    } catch (err) {
                        console.warn('[Report] Prediction generation failed:', err.message);
                    }
} catch (dbErr) {
                    console.warn('[Report] DB save failed (non-fatal):', dbErr.message);
                }
            }

            // Return the normalized dbAnalysis as `report` for the frontend
            return res.status(200).json({
                success: true,
                report: reportRecord || { metrics: [] },
            });
        } catch (error) {
            console.error('[Report] Analysis error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    getReportHistory = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(400).json({ success: false, error: 'Auth required' });

            const reports = await this.patientModel.getPatientReportsByUserId(userId);
            return res.status(200).json({
                success: true,
                reports: reports,
                total: reports.length, 
            });
        } catch (error) {
            console.error('[Patient] getReportHistory error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    saveReport = async (req, res) => {
        try {
            const { reportId } = req.params;
            if (!reportId) {
                return res.status(400).json({ success: false, error: 'reportId is required' });
            }

            const patientId = await this.resolvePatientId(req.user?.id);
            if (!patientId) {
                return res.status(400).json({ success: false, error: 'Unable to resolve patient identity' });
            }

            const report = await this.patientModel.updateReportPatientId(reportId, patientId);
            if (!report) {
                return res.status(404).json({ success: false, error: 'Medical report not found' });
            }

            const reportWithMetrics = await this.patientModel.getReportWithMetricsById(reportId);
            return res.status(200).json({ success: true, report: reportWithMetrics });
        } catch (error) {
            console.error('[PatientController] saveReport error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    removeReport = async (req, res) => {
        try {
            const { reportId } = req.params;
            if (!reportId) {
                return res.status(400).json({ success: false, error: 'reportId is required' });
            }

            const report = await this.patientModel.updateReportPatientId(reportId, null);
            if (!report) {
                return res.status(404).json({ success: false, error: 'Medical report not found' });
            }

            const reportWithMetrics = await this.patientModel.getReportWithMetricsById(reportId);
            return res.status(200).json({ success: true, report: reportWithMetrics });
        } catch (error) {
            console.error('[PatientController] removeReport error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    updateReport = async (req, res) => {
        try {
            const { reportId } = req.params;
            if (!reportId) return res.status(400).json({ success: false, error: 'reportId required' });

            const { patient, metric_edits = [] } = req.body || {};

            const report = await this.patientModel.updateReportData(reportId, {
                patientJson:    patient ? patient : undefined,
                patientNameRep: patient?.name || undefined,
                metricEdits:    metric_edits,
            });

            if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
            return res.status(200).json({ success: true, report });
        } catch (error) {
            console.error('[PatientController] updateReport error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    deleteReport = async (req, res) => {
        try {
            const { reportId } = req.params;
            if (!reportId) {
                return res.status(400).json({ success: false, error: 'reportId is required' });
            }

            const report = await this.patientModel.deleteReportById(reportId);
            if (!report) {
                return res.status(404).json({ success: false, error: 'Medical report not found' });
            }

            return res.status(200).json({ success: true, report });
        } catch (error) {
            console.error('[PatientController] deleteReport error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    getDocuments = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(400).json({ success: false, error: 'Auth required' });

            const identity = await this.patientModel.resolvePatientIdentity(userId);
            const patientId = identity.patientId || (UUID_RE.test(String(userId)) ? userId : null);
            if (!patientId) return res.status(404).json({ success: false, error: 'Patient not found' });

            const { reports, prescriptions } = await this.patientModel.getPatientDocuments(patientId, identity.userId);
            return res.status(200).json({ success: true, reports, prescriptions });
        } catch (error) {
            console.error('[Patient] getDocuments error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    getHealthSummary = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(400).json({ success: false, error: 'Patient ID required' });

            // Resolve integer user ID → UUID patient_id
            const identity = await this.patientModel.resolvePatientIdentity(userId);
            const patientId = identity.patientId || (UUID_RE.test(String(userId)) ? userId : null);
            if (!patientId) return res.status(404).json({ success: false, error: 'Patient not found' });

            const [profile, metrics, activeMeds] = await Promise.all([
                this.patientModel.getPatientProfile({ patientId }),
                this.patientModel.getLatestReportMetrics(patientId),
                this.patientModel.getActiveMedications(patientId),
            ]);

            if (!profile) return res.status(404).json({ success: false, error: 'Patient not found' });

            profile.medications = (activeMeds || []).map(m => ({
                name:      m.brand_name,
                generic:   m.generic_name,
                dosage:    m.dosage,
                frequency: m.frequency,
                duration:  m.duration,
                status:    m.status,
            }));

            return res.status(200).json({ success: true, profile, metrics });
        } catch (error) {
            console.error('[Patient] getHealthSummary error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    getActiveMedications = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(400).json({ success: false, error: 'Patient ID required' });

            const identity = await this.patientModel.resolvePatientIdentity(userId);
            const patientId = identity.patientId || (UUID_RE.test(String(userId)) ? userId : null);
            if (!patientId) return res.status(404).json({ success: false, error: 'Patient not found' });

            const medications = await this.patientModel.getActiveMedications(patientId);
            return res.status(200).json({ success: true, medications });
        } catch (error) {
            console.error('[Patient] getActiveMedications error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    bookAppointment = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(400).json({ success: false, error: 'Patient ID required' });

        const patientId = await this.resolvePatientId(userId);
        if (!patientId) return res.status(404).json({ success: false, error: 'Patient not found' });

        const { doctorId, appointmentDate } = req.body || {};

        if (!doctorId || !appointmentDate) {
            return res.status(400).json({ success: false, error: 'doctorId and appointmentDate are required' });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(appointmentDate))) {
            return res.status(400).json({ success: false, error: 'appointmentDate must be YYYY-MM-DD' });
        }

        const toLocalDateString = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const today = toLocalDateString(new Date());
        const tomorrow = toLocalDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
        if (appointmentDate !== today && appointmentDate !== tomorrow) {
            return res.status(400).json({
                success: false,
                error: 'Appointments can only be booked for today or tomorrow',
            });
        }

        const appointment = await this.patientModel.bookAppointment({
            doctorId,
            patientId,
            appointmentDate,
        });

        return res.status(201).json({ success: true, appointment });
    } catch (error) {
        if (error.code === 'DOCTOR_NOT_FOUND') {
            return res.status(404).json({ success: false, error: 'Doctor not found' });
        }
        if (error.code === 'DAILY_LIMIT_REACHED') {
            return res.status(409).json({ success: false, error: 'Doctor appointment limit reached for this date' });
        }
        if (error.code === 'PATIENT_ALREADY_BOOKED') {
            return res.status(409).json({ success: false, error: 'You already have an appointment with this doctor on this date' });
        }
        console.error('[Patient] bookAppointment error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

    getAppointments = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(400).json({ success: false, error: 'Patient ID required' });

            const patientId = await this.resolvePatientId(userId);
            if (!patientId) return res.status(404).json({ success: false, error: 'Patient not found' });

            const date = req.query?.date || null;
            const appointments = await this.patientModel.getPatientAppointments(patientId, date);
            return res.status(200).json({ success: true, appointments });
        } catch (error) {
            console.error('[Patient] getAppointments error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    markArrival = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(400).json({ success: false, error: 'Auth required' });

            const patientId = await this.resolvePatientId(userId);
            if (!patientId) return res.status(404).json({ success: false, error: 'Patient not found' });

            const { appointmentId } = req.params;
            const updated = await this.appointmentModel.patientMarkArrived(appointmentId, patientId);
            if (!updated) {
                return res.status(404).json({ success: false, error: 'Appointment not found or not eligible' });
            }
            return res.status(200).json({ success: true, appointment: updated });
        } catch (error) {
            console.error('[Patient] markArrival error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    cancelAppointment = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(400).json({ success: false, error: 'Patient ID required' });

            const patientId = await this.resolvePatientId(userId);
            if (!patientId) return res.status(404).json({ success: false, error: 'Patient not found' });

            const { appointmentId } = req.params;
            const updated = await this.patientModel.cancelAppointment(appointmentId, patientId);
            if (!updated) {
                return res.status(404).json({ success: false, error: 'Appointment not found or not eligible' });
            }
            return res.status(200).json({ success: true, appointment: updated });
        } catch (error) {
            console.error('[Patient] cancelAppointment error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    updateProfile = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(400).json({ success: false, error: 'Patient ID required' });

            const identity = await this.patientModel.resolvePatientIdentity(userId);
            const patientId = identity.patientId || (UUID_RE.test(String(userId)) ? userId : null);
            if (!patientId) return res.status(404).json({ success: false, error: 'Patient not found' });

            const updated = await this.patientModel.updatePatientVitals(patientId, req.body);
            if (!updated) return res.status(404).json({ success: false, error: 'Patient not found' });

            return res.status(200).json({ success: true, user: updated });
        } catch (error) {
            console.error('[Patient] updateProfile error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    getProfile = async (req, res) => {
        try {
            const patientId = req.user?.id || req.params.patientId || req.user?.patient_id;

            if (!patientId) {
                return res.status(400).json({ success: false, error: 'patientId is required' });
            }

            const patient = await this.patientModel.getPatientProfile({ patientId });
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            return res.status(200).json({ success: true, user: patient });
        } catch (error) {
            console.error('Get patient profile error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getTimeline = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
            const identity = await this.patientModel.resolvePatientIdentity(userId);

            if (!identity.patientId && !identity.userId) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            const [reports, scans, symptoms, vaccinations, surgeries, conditions] = await Promise.all([
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
                    ? this.patientModel.getPatientSurgeries(identity.patientId)
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
                        reportType: report.report_type || 'Report',
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

                for (const surgery of surgeries) {
                    const surgeon = surgery.surgeon || null;
                    const facility = surgery.facility || null;
                    const performedAt = surgery.date || surgery.performed_at || surgery.created_at || null;
                    const outcome = surgery.outcome || null;
                    const complications = surgery.complications || null;
                    const anaesthesia = surgery.anaesthesiaType || surgery.anaesthesia_type || null;

                    const summary = surgery.name
                        ? `${surgery.name}${outcome ? ' — ' + outcome : ''}`
                        : `Surgery recorded`;

                    entries.push({
                        id: `tl_surgery_${surgery.id}`,
                        date: toIso(performedAt, surgery.created_at),
                        type: 'surgery',
                        title: surgery.name ? 'Surgery Recorded' : 'Surgery',
                        summary,
                        details: {
                            procedure: surgery.name || null,
                            surgeon: surgeon,
                            facility: facility,
                            outcome: outcome,
                            complications: complications,
                            anaesthesiaType: anaesthesia,
                            notes: surgery.notes || null,
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

    medicationSafetyCheck = async (req, res) => {
        try {
            const { medications } = req.body || {};

            if (!medications || !Array.isArray(medications) || medications.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No medications provided for safety check'
                });
            }

            const userId = req.user?.id;
            const patientId = await this.resolvePatientId(userId);

            if (!patientId) {
                return res.status(400).json({ success: false, error: 'Unable to resolve patient identity' });
            }

            // 1. Fetch comprehensive medical history from DB
            const allergies = await this.patientModel.getPatientAllergies(patientId);
            const surgeries = await this.doctorModel.getPatientSurgeries(patientId);
            const vaccinations = await this.doctorModel.getPatientVaccinations(patientId);
            const currentMedications = (await this.patientModel.getActiveMedications(patientId))
                .filter((m) => String(m.status || 'active').toLowerCase() === 'active')
                .map((m) => ({
                    generic_name: m.generic_name || m.generic || m.brand_name || m.name || 'Unknown',
                    brand_name: m.brand_name || m.matched_brand || null,
                    drug_class: m.drug_class || null,
                    dosage: m.dosage || m.strength || 'Standard',
                    frequency: m.frequency || 'As directed',
                    instructions: m.instructions || '',
                }));

            // 2. Map requested medications to LLM format
            const proposedMeds = medications
                .filter((m) => String(m.status || 'active').toLowerCase() === 'active')
                .map(m => ({
                    generic_name: m.name || 'Unknown',
                    dosage: m.dosage || 'Standard',
                    frequency: m.frequency || 'As directed',
                    instructions: m.instructions || '',
                    status: 'active',
                }));

            // 3. Call LLM for a comprehensive safety analysis
            // We treat the whole current list as "proposed" to check for internal consistency and allergy conflicts
            const safetyResult = await this.llmUtils.checkPrescriptionSafety(
                patientId,
                allergies,
                currentMedications,
                proposedMeds,
                surgeries,
                vaccinations
            );

            // 4. Map LLM result to frontend expectations
            // Filter out mild and moderate warnings to prevent patient anxiety
            const warnings = (safetyResult.warnings || []).filter(
                w => w.severity !== 'mild' && w.severity !== 'moderate'
            );
            let overallStatus = 'safe';

            if (warnings.some(w => w.severity === 'critical' || w.severity === 'severe')) {
                overallStatus = 'danger';
            } else if (warnings.length > 0) {
                overallStatus = 'warning';
            }

            const findings = warnings.map(w => ({
                interaction: w.drugs_involved?.join(' + ') || 'Medication',
                severity: (w.severity === 'critical' || w.severity === 'severe') ? 'danger' : 'warning',
                description: w.description,
                recommendation: w.recommendation
            }));

            return res.status(200).json({
                success: true,
                safetyReport: {
                    overallStatus,
                    summary: safetyResult.summary || 'No critical interactions detected. Your current regimen appears safe.',
                    findings
                }
            });
        } catch (error) {
            console.error('[Patient] medicationSafetyCheck error:', error.message);
            return res.status(500).json({ success: false, error: 'Internal server error during safety check' });
        }
    };

    listDoctors = async (req, res) => {
        try {

            const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
            const identity = await this.patientModel.resolvePatientIdentity(userId);

            if (!identity.patientId && !identity.userId) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            const [reports, scans, symptoms, vaccinations, surgeries, conditions] = await Promise.all([
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
                    ? this.patientModel.getPatientSurgeries(identity.patientId)
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
                        reportType: report.report_type || 'Report',
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

                for (const surgery of surgeries) {
                    const surgeon = surgery.surgeon || null;
                    const facility = surgery.facility || null;
                    const performedAt = surgery.date || surgery.performed_at || surgery.created_at || null;
                    const outcome = surgery.outcome || null;
                    const complications = surgery.complications || null;
                    const anaesthesia = surgery.anaesthesiaType || surgery.anaesthesia_type || null;

                    const summary = surgery.name
                        ? `${surgery.name}${outcome ? ' — ' + outcome : ''}`
                        : `Surgery recorded`;

                    entries.push({
                        id: `tl_surgery_${surgery.id}`,
                        date: toIso(performedAt, surgery.created_at),
                        type: 'surgery',
                        title: surgery.name ? 'Surgery Recorded' : 'Surgery',
                        summary,
                        details: {
                            procedure: surgery.name || null,
                            surgeon: surgeon,
                            facility: facility,
                            outcome: outcome,
                            complications: complications,
                            anaesthesiaType: anaesthesia,
                            notes: surgery.notes || null,
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
    
    listDoctors = async (req, res) => {
        try {
            const doctors = await this.doctorModel.getDoctorsForBooking();
            return res.status(200).json({ success: true, doctors });
        } catch (error) {
            console.error('[Doctors] list error:', error.message);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getDoctorAvailability = async (req, res) => {
        try {
            const { doctorId } = req.params || {};
            const date = req.query?.date || null;

            if (!doctorId) {
                return res.status(400).json({ success: false, error: 'doctorId is required' });
            }
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
                return res.status(400).json({ success: false, error: 'date must be YYYY-MM-DD' });
            }

            const availability = await this.doctorModel.getAvailabilityByDate(doctorId, date);

            return res.status(200).json({
                success: true,
                availability
            });
        } catch (error) {
            console.error('[Doctors] availability error:', error.message);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };
}

module.exports = PatientController;
