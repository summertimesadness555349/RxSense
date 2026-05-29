'use strict';

const DB_Connection                                              = require('../database/db.js');
const { generateInsights, generateDoctorSummary, generatePatientSummary } = require('../agents/insightsAgent.js');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

class InsightsController {

    /**
     * GET /api/insights
     * Query param: ?force=true  — bypass the cache and regenerate
     */
    getInsights = async (req, res) => {
        const userId     = req.user.id;
        const forceRegen = req.query.force === 'true';

        try {
            const db = DB_Connection.getInstance();

            // Resolve patient UUID
            const patRow = await db.query_executor(
                `SELECT p.patient_id
                 FROM patient p
                 JOIN users u ON u.id = p.user_id
                 WHERE u.id = $1
                 LIMIT 1`,
                [userId]
            );
            const patientId = patRow.rows[0]?.patient_id ?? null;

            // ── Serve cache ────────────────────────────────────────────────
            if (patientId && !forceRegen) {
                const cached = await db.query_executor(`
                    SELECT insights_json, generated_at
                    FROM patient_insights
                    WHERE patient_id = $1
                      AND expires_at > NOW()
                    ORDER BY generated_at DESC
                    LIMIT 1
                `, [patientId]);

                if (cached.rows.length > 0) {
                    const row = cached.rows[0];
                    return res.json({
                        success:      true,
                        cached:       true,
                        generated_at: row.generated_at,
                        ...row.insights_json,
                    });
                }
            }

            // ── Generate fresh insights ────────────────────────────────────
            const insights   = await generateInsights({ userId });
            const generatedAt = new Date();
            const expiresAt   = new Date(generatedAt.getTime() + CACHE_TTL_MS);

            // Persist to cache (best-effort — don't fail the response if this errors)
            if (patientId) {
                db.query_executor(`
                    INSERT INTO patient_insights (patient_id, generated_at, expires_at, insights_json)
                    VALUES ($1, $2, $3, $4::jsonb)
                `, [patientId, generatedAt.toISOString(), expiresAt.toISOString(), JSON.stringify(insights)])
                .catch(err => console.error('[InsightsController] cache write error:', err.message));
            }

            return res.json({
                success:      true,
                cached:       false,
                generated_at: generatedAt.toISOString(),
                ...insights,
            });

        } catch (err) {
            console.error('[InsightsController] getInsights error:', err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
    };

    /**
     * POST /api/insights/patient-summary
     * Warm, patient-facing health narrative. Not cached server-side (client caches).
     */
    getPatientSummary = async (req, res) => {
        const userId = req.user.id;
        try {
            const summary = await generatePatientSummary({ userId });
            return res.json({ success: true, summary });
        } catch (err) {
            console.error('[InsightsController] getPatientSummary error:', err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
    };

    /**
     * POST /api/insights/doctor-summary
     * On-demand; not cached.
     */
    getDoctorSummary = async (req, res) => {
        const userId = req.user.id;

        try {
            const summary = await generateDoctorSummary({ userId });
            return res.json({ success: true, summary });
        } catch (err) {
            console.error('[InsightsController] getDoctorSummary error:', err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
    };
}

module.exports = InsightsController;
