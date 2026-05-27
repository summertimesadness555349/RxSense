const { OpenAI } = require('openai');

class ReportChatController {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    chat = async (req, res) => {
        try {
            const { messages = [], report, question } = req.body || {};

            if (!question?.trim()) {
                return res.status(400).json({ success: false, error: 'Question is required' });
            }
            if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
                return res.status(500).json({ success: false, error: 'OPENAI_API_KEY not configured' });
            }

            // Build readable summary of all report sections
            const r = report || {};
            const sectionLines = (r.sections || []).map(section => {
                if ((section.type === 'lab_results' || section.type === 'vitals') && section.entries?.length) {
                    const rows = section.entries.map(e => {
                        let line = `  • ${e.label}: ${e.value ?? ''}${e.unit ? ' ' + e.unit : ''}`;
                        if (e.reference_range) line += ` (ref: ${e.reference_range})`;
                        if (e.flag)            line += ` [${e.flag}]`;
                        if (e.status && e.status !== 'normal') line += ` ← ${e.status.toUpperCase()}`;
                        return line;
                    }).join('\n');
                    return `${section.title}:\n${rows}`;
                }
                if (section.narrative) {
                    return `${section.title}:\n  ${section.narrative}`;
                }
                return null;
            }).filter(Boolean).join('\n\n');

            const system = `You are a compassionate medical assistant helping a patient understand their medical report.
Use very simple, clear language. Be warm and reassuring. Always remind the patient to consult their doctor.

REPORT DETAILS:
- Type: ${r.type || 'Medical Report'}
- Date: ${r.date || 'Unknown'}
- Facility: ${r.facility || 'Unknown'}
- Ordering Doctor: ${r.ordering_doctor || 'Unknown'}
- Patient: ${r.patient?.name || 'Patient'}${r.patient?.age ? ', Age ' + r.patient.age : ''}${r.patient?.gender ? ', ' + r.patient.gender : ''}

REPORT DATA:
${sectionLines || '(no structured data)'}
${r.overall_impression ? '\nOVERALL IMPRESSION: ' + r.overall_impression : ''}
${r.diagnoses?.length   ? '\nDIAGNOSES: ' + r.diagnoses.join(', ') : ''}
${r.recommendations?.length ? '\nRECOMMENDATIONS: ' + r.recommendations.join('; ') : ''}
${r.clinical_notes ? '\nCLINICAL NOTES: ' + r.clinical_notes : ''}
${r.follow_up      ? '\nFOLLOW-UP: ' + r.follow_up : ''}

IMPORTANT: Keep responses concise — 3-5 sentences or a short bullet list. Always end with a reminder to consult their doctor.

LANGUAGE: Always respond in Bengali (Bangla) script. Keep test names, values, units, medical terms, and numbers in English within the Bangla text. Use very simple everyday Bangla that an illiterate rural patient can understand — as if explaining to a village grandmother.`;

            const completion = await this.openai.chat.completions.create({
                model:    process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: system },
                    ...messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: question },
                ],
                max_tokens:  500,
                temperature: 0.6,
            });

            const reply = completion.choices[0]?.message?.content?.trim()
                || 'Sorry, I could not generate a response.';

            return res.status(200).json({ success: true, reply });
        } catch (error) {
            console.error('[ReportChat] Error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };
}

module.exports = ReportChatController;
