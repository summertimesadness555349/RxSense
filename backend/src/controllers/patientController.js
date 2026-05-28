const sharp         = require('sharp');
const patientModel  = require('../models/patientModel');
const ReportAnalysisUtils  = require('../utils/reportAnalysisUtils.js');
const { uploadReportBuffer } = require('../utils/cloudinary.js');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Formats Claude cannot handle natively — convert to JPEG first
const UNSUPPORTED_MIMETYPES = new Set([
    'image/avif', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
]);

class PatientController {
    constructor() {
        this.patientModel        = new patientModel();
        this.reportAnalysisUtils = new ReportAnalysisUtils();
    }

    analyzeReport = async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'A PDF or image report file is required' });
            }

            const userId    = req.user?.id || null;
            const patientId = req.user?.patient_id || req.user?.uuid || req.body?.patientId || null;
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
                this.reportAnalysisUtils.extract({ buffer: apiBuffer, mimetype: apiMimetype, originalname: req.file.originalname }),
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
            const dbAnalysis = this.reportAnalysisUtils.normalizeForDb(extracted, { imageUrl, typeOverride: reportType });

            // Save to DB if we have a valid UUID patient_id
            let reportRecord = null;
            let savedMetrics = [];
            const validPatientId = UUID_RE.test(String(patientId || '')) ? patientId : null;

            if (validPatientId) {
                try {
                    reportRecord = await this.patientModel.createMedicalReport({
                        patientId:      validPatientId,
                        reportType:     this.reportAnalysisUtils.getReportTypeEnum(reportType),
                        imageUrl,
                        imagePublicId,
                        rawAnalysis:    extracted,
                        reportDate:     dbAnalysis.report_date || null,
                        facility:       dbAnalysis.facility    || null,
                        orderingDoctor: dbAnalysis.ordering_doctor || null,
                        patientNameRep: dbAnalysis.patient?.name  || null,
                    });

                    // Save individual lab/vital metrics as report_metric rows
                    for (const m of (dbAnalysis.metrics || [])) {
                        const metric = await this.patientModel.addReportMetric({
                            reportId:       reportRecord.report_id,
                            parameterName:  m.parameterName,
                            value:          m.value,
                            unit:           m.unit || null,
                            referenceRange: m.referenceRange || null,
                            status:         m.status || null,
                            llmFlagged:     Boolean(m.llmFlagged),
                        }).catch(err => {
                            console.warn('[Report] Metric save failed:', err.message);
                            return null;
                        });
                        if (metric) savedMetrics.push(metric);
                    }

                    console.log(`[Report] Saved to DB — report_id: ${reportRecord.report_id}`);
                } catch (dbErr) {
                    console.warn('[Report] DB save failed (non-fatal):', dbErr.message);
                }
            }

            // Return the normalized dbAnalysis as `report` for the frontend
            return res.status(200).json({
                success: true,
                report: dbAnalysis,
            });
        } catch (error) {
            console.error('[Report] Analysis error:', error.message);
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
}

module.exports = PatientController;
