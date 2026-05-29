const { OpenAI }      = require('openai');
const vectorStore     = require('../rag/vectorStore.js');
const { embedSingle } = require('../rag/embeddings.js');

async function ragContext(question, userId) {
    try {
        const results = await vectorStore.search({
            query:       question,
            userId,
            sourceTypes: ['medical_book', 'patient_report', 'chat_history'],
            topK:        4,
            minScore:    0.28,
        });
        if (!results.length) return '';
        const lines = results.map(r =>
            `[${r.metadata?.book_title || r.source_type} | ${r.metadata?.chapter || r.metadata?.topic || ''}]\n${r.content.slice(0, 400)}`
        ).join('\n\n---\n\n');
        return `\n\nMEDICAL REFERENCE (from Harrison's / MedlinePlus — use this to explain values in clinical context):\n${lines}`;
    } catch {
        return '';
    }
}

async function persistChatVector(question, reply, userId) {
    try {
        const content   = `Q: ${question.trim()}\nA: ${reply.trim()}`;
        const embedding = await embedSingle(content);
        await vectorStore.upsert({
            content,
            embedding,
            sourceType: 'chat_history',
            userId,
            metadata: { feature: 'report', date: new Date().toISOString() },
        });
    } catch { /* silent */ }
}

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

            const system = `CRITICAL LANGUAGE RULE — READ THIS FIRST:
You MUST write every response entirely in Bengali (বাংলা) Unicode script.
Banglish is strictly forbidden. Do NOT write Bangla words using English letters (e.g. "apnar", "kivabe", "asha kori", "rogi", "osudh" are all forbidden).
Every single Bangla word must use Bengali Unicode characters (যেমন: আপনার, কীভাবে, আশা করি, রোগী, ওষুধ).
Exception: medicine names, test names, numeric values, units, and medical/scientific terms may remain in English inside the Bengali sentence.
If the user explicitly writes "please reply in English" or "English-e bolo", only then switch to English.

You are a compassionate medical assistant helping a patient understand their medical report.
Be warm and reassuring. Always remind the patient to consult their doctor.

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

REMINDER: Your response must be in Bengali Unicode script only — no Banglish. Use simple everyday Bangla.`;

            // RAG: inject relevant clinical reference for this question
            const userId = req.user?.id || null;
            const rag    = await ragContext(question, userId);
            const fullSystem = system + rag;

            const completion = await this.openai.chat.completions.create({
                model:    process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: fullSystem },
                    ...messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: question },
                ],
                max_tokens:  500,
                temperature: 0.6,
            });

            const reply = completion.choices[0]?.message?.content?.trim()
                || 'Sorry, I could not generate a response.';

            if (userId) persistChatVector(question, reply, userId);

            return res.status(200).json({ success: true, reply });
        } catch (error) {
            console.error('[ReportChat] Error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };
}

module.exports = ReportChatController;
