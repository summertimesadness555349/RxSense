'use strict';

const { analyzeSymptoms } = require('../agents/symptomAgent.js');

class SymptomController {

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
}

module.exports = SymptomController;
