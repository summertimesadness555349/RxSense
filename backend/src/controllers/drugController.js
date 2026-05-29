const { computeInteractions } = require('../utils/drugInteractionService.js');

async function checkInteractions(req, res) {
    try {
        const drugs = Array.isArray(req.body.drugs) ? req.body.drugs : [];
        if (!drugs.length) return res.status(400).json({ error: 'Provide an array of drugs in body.drugs' });

        const names = drugs.map(d => (d && d.name) ? d.name : '').filter(Boolean);
        if (!names.length) return res.status(400).json({ error: 'No valid drug names provided' });

        const result = await computeInteractions(names);
        res.json(result);
    } catch (err) {
        console.error('checkInteractions error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = { checkInteractions };
