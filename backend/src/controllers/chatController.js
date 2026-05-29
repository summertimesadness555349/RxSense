const { OpenAI }    = require('openai');
const DB_Connection = require('../database/db.js');
const vectorStore   = require('../rag/vectorStore.js');
const { embedSingle } = require('../rag/embeddings.js');

// Fetch top-3 RAG chunks for a question and format them as a compact reference block.
// Fails silently — if the vector store is empty or throws, chat still works.
async function ragContext(question, userId) {
    try {
        const results = await vectorStore.search({
            query:       question,
            userId,
            sourceTypes: ['medical_book', 'chat_history'],
            topK:        4,
            minScore:    0.28,
        });
        if (!results.length) return '';
        const lines = results.map(r =>
            `[${r.metadata?.book_title || r.source_type} | ${r.metadata?.chapter || r.metadata?.topic || ''}]\n${r.content.slice(0, 400)}`
        ).join('\n\n---\n\n');
        return `\n\nMEDICAL REFERENCE (from Harrison's / MedlinePlus — use this to enrich your answer):\n${lines}`;
    } catch {
        return '';
    }
}

// Persist a completed Q&A pair to rag_documents as chat_history (weight 0.3).
// Called fire-and-forget — never awaited, never blocks the response.
async function persistChatVector(question, reply, userId) {
    try {
        const content   = `Q: ${question.trim()}\nA: ${reply.trim()}`;
        const embedding = await embedSingle(content);
        await vectorStore.upsert({
            content,
            embedding,
            sourceType: 'chat_history',
            userId,
            metadata: { feature: 'prescription', date: new Date().toISOString() },
        });
    } catch { /* silent */ }
}

const db = DB_Connection.getInstance();

async function searchDrugbank(name) {
    try {
        const result = await db.query_executor(
            `SELECT name, indication, pharmacodynamics, mechanism_of_action,
                    toxicity, half_life, absorption, brand_names
             FROM drugbank_drug
             WHERE name % $1
             ORDER BY similarity(name, $1) DESC
             LIMIT 2`,
            [name]
        );
        return result.rows;
    } catch (err) {
        console.warn('[Chat] DrugBank search error:', err.message);
        return [];
    }
}

class ChatController {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    chat = async (req, res) => {
        try {
            const { messages = [], prescription, question } = req.body || {};

            if (!question?.trim()) {
                return res.status(400).json({ success: false, error: 'Question is required' });
            }
            if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
                return res.status(500).json({ success: false, error: 'OPENAI_API_KEY not configured' });
            }

            // Build search terms from brand names + generic names (first word for multi-word generics)
            const allSearchTerms = (prescription?.medications || []).flatMap(m => {
                const terms = [];
                if (m.name) terms.push(m.name);
                if (m.generic) {
                    const firstWord = m.generic.trim().split(/\s+/)[0];
                    if (firstWord && firstWord.length >= 3) terms.push(firstWord);
                }
                return terms;
            });
            const allMedNames = [...new Set(allSearchTerms.filter(Boolean))];

            // If the user mentions a specific drug in their question, prioritise those;
            // otherwise search all drugs in the prescription (up to 6)
            const qLower = question.toLowerCase();
            const mentioned = allMedNames.filter(n =>
                qLower.includes(n.toLowerCase().split(' ')[0])
            );
            const toSearch = mentioned.length > 0 ? mentioned : allMedNames.slice(0, 6);

            // Parallel drugbank lookups
            const raw = await Promise.all(toSearch.map(searchDrugbank));
            const seen = new Set();
            const drugInfo = raw.flat().filter(d => {
                if (seen.has(d.name)) return false;
                seen.add(d.name); return true;
            });

            // ── Build system prompt ─────────────────────────────────────────────
            const rx = prescription || {};
            const medLines = (rx.medications || []).map(m =>
                `  • ${m.name}` +
                (m.generic   ? ` (${m.generic})`   : '') +
                (m.dosage    ? ` — ${m.dosage}`     : '') +
                (m.frequency ? `, ${m.frequency}`   : '') +
                (m.duration  ? `, ${m.duration}`    : '')
            ).join('\n');

            let system =
`CRITICAL LANGUAGE RULE — READ THIS FIRST:
You MUST write every response entirely in Bengali (বাংলা) Unicode script.
Banglish is strictly forbidden. Do NOT write Bangla words using English letters (e.g. "apnar", "osudh", "kivabe", "asha kori", "khaben", "doctor er sathe" are all forbidden).
Every single Bangla word must use Bengali Unicode characters (যেমন: আপনার, ওষুধ, কীভাবে, আশা করি, খাবেন, ডাক্তারের সাথে).
Exception: medicine names, brand names, dosages, numeric values, units, and medical/scientific terms may remain in English inside the Bengali sentence.
If the user explicitly writes "please reply in English" or "English-e bolo", only then switch to English.

You are a compassionate medical assistant helping a patient understand their prescription.
Use very simple, everyday language — assume the patient has no medical background.
Be warm, clear, and concise. Always remind the patient to consult their doctor or pharmacist
for personalised medical advice.

PRESCRIPTION DETAILS:
- Date: ${rx.date || 'Unknown'}
- Doctor: ${rx.doctor?.name || 'Unknown'}${rx.doctor?.specialization ? ` (${rx.doctor.specialization})` : ''}
- Clinic/Hospital: ${rx.hospital?.name || 'Unknown'}
- Conditions/Diagnosis: ${(rx.diseases || []).join(', ') || 'Not specified'}
- Required Tests: ${(rx.tests || []).join(', ') || 'None'}

PRESCRIBED MEDICATIONS:
${medLines || '  (none listed)'}
${rx.notes    ? `\nDOCTOR'S NOTES: ${rx.notes}`    : ''}
${rx.followUp ? `FOLLOW-UP: ${rx.followUp}` : ''}`;

            if (drugInfo.length > 0) {
                system += '\n\nDRUG DATABASE (use this to give accurate answers):';
                for (const d of drugInfo) {
                    const brands = Array.isArray(d.brand_names) ? d.brand_names.slice(0, 3).join(', ') : '';
                    system += `\n\n[${d.name}]`;
                    if (brands)                system += `\n  Brand names: ${brands}`;
                    if (d.indication)          system += `\n  Used for: ${d.indication}`;
                    if (d.pharmacodynamics)    system += `\n  How it works: ${d.pharmacodynamics}`;
                    if (d.mechanism_of_action) system += `\n  Mechanism: ${d.mechanism_of_action}`;
                    if (d.toxicity)            system += `\n  Warnings/Side effects: ${d.toxicity}`;
                    if (d.half_life)           system += `\n  Half-life: ${d.half_life}`;
                    if (d.absorption)          system += `\n  Absorption: ${d.absorption}`;
                }
            }

            system += '\n\nIMPORTANT: Keep responses concise (3-5 sentences, or a short bullet list when helpful). Always end with a one-sentence reminder to consult the prescribing doctor or pharmacist.';

            // RAG: inject relevant medical reference chunks
            const userId = req.user?.id || null;
            system += await ragContext(question, userId);

            system += '\n\nREMINDER: Your response must be in Bengali Unicode script only — no Banglish. Use simple everyday Bangla.';

            const completion = await this.openai.chat.completions.create({
                model:       process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: system },
                    ...messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
                    { role: 'user',   content: question },
                ],
                max_tokens:  500,
                temperature: 0.6,
            });

            const reply = completion.choices[0]?.message?.content?.trim()
                || 'Sorry, I could not generate a response.';

            // Persist Q&A pair as a low-weight chat_history vector (fire-and-forget)
            if (userId) persistChatVector(question, reply, userId);

            return res.status(200).json({
                success:       true,
                reply,
                drugs_context: drugInfo.map(d => d.name),
            });

        } catch (error) {
            console.error('[Chat] Error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    };
}

module.exports = ChatController;
