'use strict';

const { analyzeSymptoms } = require('../agents/symptomAgent.js');
const PatientModel = require('../models/patientModel.js');
const LLMUtils = require('../utils/llmUtils.js');

class SymptomController {
    constructor() {
        this.patientModel = new PatientModel();
        this.llmUtils = new LLMUtils();
    }

    check = async (req, res) => {
        try {
            const userId = req.user?.id;
            const { question, messages = [] } = req.body || {};

            if (!userId)           return res.status(401).json({ success: false, error: 'Auth required' });
            if (!question?.trim()) return res.status(400).json({ success: false, error: 'question field is required' });

            const { reply, emergency } = await analyzeSymptoms({ userId, messages, question });
            return res.status(200).json({ success: true, reply, emergency });

        } catch (err) {
            console.error('[Symptom] Agent error:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    shareSymptoms = async (req, res) => {
        try {
            const userId = req.user?.id;
            const { doctorId, appointmentId, messages = [] } = req.body || {};

            if (!userId) return res.status(401).json({ success: false, error: 'Auth required' });
            if (!doctorId) return res.status(400).json({ success: false, error: 'doctorId is required' });
            if (!messages || messages.length === 0) {
                return res.status(400).json({ success: false, error: 'messages array is required' });
            }

            const identity = await this.patientModel.resolvePatientIdentity(userId);
            const patientId = identity.patientId;
            if (!patientId) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            // 1. Summarize symptoms via LLM (OpenAI)
            const summaryData = await this.llmUtils.summarizeSymptoms(messages);

            // 2. Save to database
            const query = `
                INSERT INTO shared_symptoms (patient_id, doctor_id, appointment_id, key_symptoms, summary)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `;
            const params = [
                patientId,
                doctorId,
                appointmentId || null,
                summaryData.key_symptoms,
                summaryData.summary
            ];
            const result = await this.patientModel.db_connection.query_executor(query, params);
            const sharedSymptom = result.rows[0];

            return res.status(200).json({
                success: true,
                message: 'Symptoms summarized and shared successfully',
                data: sharedSymptom
            });

        } catch (err) {
            console.error('[Symptom] Share error:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };
}

module.exports = SymptomController;

