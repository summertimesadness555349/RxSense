'use strict';

const { runAgent }                              = require('./agentRunner.js');
const { runOpenAIAgent }                        = require('./openaiAgentRunner.js');
const { SCHEMAS, buildExecutors, buildDoctorExecutors } = require('./tools.js');
const DB_Connection               = require('../database/db.js');

const INSIGHTS_TOOLS = SCHEMAS.filter(t =>
    ['get_patient_profile', 'get_report_history', 'rag_search'].includes(t.name)
);

const INSIGHTS_SYSTEM = `You are RxSense Health Analyst — a clinical AI that generates structured health insights from patient medical records.

## Workflow (follow in order)
1. Call get_patient_profile to retrieve demographics, active conditions, allergies, current medications.
2. Call get_report_history to retrieve recent lab reports and metrics.
3. For up to 3 of the most critical/abnormal lab metrics, call rag_search with a focused clinical query to get reference context (e.g. "HbA1c above 7 percent diabetes management clinical significance").
4. After gathering all data, output the insights JSON.

## Output format
Output ONLY a valid JSON object — no markdown fences, no text before or after:
{
  "health_score": {
    "score": <integer 0–100>,
    "label": <"Excellent"|"Good"|"Moderate"|"Poor"|"Critical">,
    "data_points": <number of individual lab metrics analyzed>,
    "period_months": <month span of available report data, minimum 1>
  },
  "trend_alerts": [
    {
      "id": "ins_001",
      "type": <"danger"|"warning"|"success"|"info">,
      "icon": <single relevant emoji>,
      "title": <max 7 words>,
      "body": <2–3 sentences: what the data shows and clinical significance>,
      "action": <1 specific actionable sentence for the patient>,
      "trend_values": [{"date": "<month year>", "value": "<value><unit>"}]
    }
  ],
  "risk_breakdown": [
    {
      "label": <risk category, e.g. "Diabetes Risk">,
      "percentage": <integer 0–100>,
      "level": <"High"|"Moderate"|"Low">
    }
  ],
  "recommended_actions": [
    {
      "id": "ra_001",
      "action": <specific, actionable recommendation>,
      "priority": <"high"|"medium">,
      "due_date": <"YYYY-MM-DD" or null>
    }
  ]
}

## Scoring rules
Start at 100, deduct per finding:
- critical_high or critical_low metric: −15 each
- high or low metric: −8 each
- Uncontrolled chronic condition (diabetes, hypertension, etc.): −10 each
- Active smoking: −5
Minimum score: 5. Labels: 80–100 = Excellent, 65–79 = Good, 45–64 = Moderate, 25–44 = Poor, 0–24 = Critical.

## Constraints
- trend_alerts: max 5, only for clinically significant findings. Use "success" type for positive trends. Empty array [] if nothing notable.
- risk_breakdown: 2–4 items. Only include risks DIRECTLY evidenced by the patient's data. Do NOT invent conditions.
- recommended_actions: 2–5 items. Be specific to THIS patient's actual data.
- If the patient has no lab reports and no conditions: score=50, label="Moderate", empty trend_alerts and risk_breakdown, one recommended_action: { id: "ra_001", action: "Upload your first lab report to unlock personalized AI health insights", priority: "high", due_date: null }.
- Output raw JSON only.`;

/**
 * Run the insights agent for a patient and return structured JSON.
 *
 * @param {object} opts
 * @param {number} opts.userId
 * @returns {Promise<object>} insights JSON
 */
async function generateInsights({ userId }) {
    const userMessage = [
        `Patient user_id: ${userId}`,
        'Generate comprehensive health insights following the workflow in your instructions.',
        'After using the tools, output ONLY the insights JSON object.',
    ].join('\n');

    const { text } = await runAgent({
        agentName:   'InsightsAgent',
        userId,
        system:      INSIGHTS_SYSTEM,
        userMessage,
        tools:       INSIGHTS_TOOLS,
        executors:   buildExecutors(userId),
        maxTokens:   2048,
        temperature: 0.1,
    });

    return extractJSON(text);
}

// ─── Doctor summary ───────────────────────────────────────────────────────────

/**
 * Generate a one-page doctor summary without a full agent loop.
 * Pre-fetches all data from the DB, then makes a single LLM call.
 *
 * @param {object} opts
 * @param {number} opts.userId
 * @returns {Promise<object>} summary JSON
 */
async function generateDoctorSummary({ userId }) {
    const db = DB_Connection.getInstance();

    const profileRes = await db.query_executor(`
        SELECT
            u.full_name,
            EXTRACT(YEAR FROM AGE(p.date_of_birth))::int  AS age,
            p.blood_group,
            p.gender,
            p.emergency_contact_name,
            p.emergency_contact_phone,
            (SELECT COALESCE(json_agg(kc.condition_name), '[]'::json)
             FROM known_condition kc
             WHERE kc.patient_id = p.patient_id AND kc.status = 'active'
            ) AS active_conditions,
            (SELECT COALESCE(json_agg(json_build_object(
                'allergen', COALESCE(d.generic_name, d.brand_name, 'Unknown'),
                'severity', pa.severity
            )), '[]'::json)
             FROM patient_allergy pa
             LEFT JOIN drug d ON d.drug_id = pa.drug_id
             WHERE pa.patient_id = p.patient_id
            ) AS allergies,
            (SELECT COALESCE(ps.medications, '[]'::jsonb)
             FROM prescription_scan ps
             WHERE ps.user_id = u.id
             ORDER BY ps.created_at DESC
             LIMIT 1
            ) AS current_medications
        FROM users u
        LEFT JOIN patient p ON p.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
    `, [userId]);

    const reportsRes = await db.query_executor(`
        SELECT
            mr.report_type,
            mr.report_date,
            (SELECT json_agg(json_build_object(
                'parameter', lm.parameter_name,
                'value',     lm.value,
                'unit',      lm.unit,
                'status',    lm.status
            ))
             FROM report_metric lm
             WHERE lm.report_id = mr.report_id
               AND lm.status NOT IN ('normal')
            ) AS abnormal_metrics
        FROM medical_report mr
        JOIN patient p ON p.patient_id = mr.patient_id
        WHERE p.user_id = $1
        ORDER BY mr.uploaded_at DESC
        LIMIT 2
    `, [userId]);

    const p        = profileRes.rows[0] || {};
    const reports  = reportsRes.rows;
    const today    = new Date().toISOString().slice(0, 10);

    const conditions  = (p.active_conditions  || []);
    const allergies   = (p.allergies          || []);
    const medications = (p.current_medications || []).map(m =>
        [m.name || m.drug, m.dosage, m.frequency].filter(Boolean).join(' ')
    );
    const criticalAllergies = allergies
        .filter(a => ['severe', 'life_threatening'].includes(a.severity))
        .map(a => `${a.allergen} (${a.severity})`);

    const reportsText = reports.length
        ? reports.map(r => {
            const date     = r.report_date ? new Date(r.report_date).toLocaleDateString('en-BD') : 'unknown date';
            const abnormal = (r.abnormal_metrics || [])
                .map(m => `${m.parameter}: ${m.value}${m.unit ? ' ' + m.unit : ''} (${m.status})`)
                .join(', ');
            return `${r.report_type} (${date})${abnormal ? ': ' + abnormal : ''}`;
        }).join('; ')
        : 'No recent reports on file';

    const prompt = `Generate a concise health summary for a new doctor. Output ONLY valid JSON, no markdown.

Patient data:
- Name: ${p.full_name || 'Not provided'}
- Age: ${p.age ?? 'Unknown'}, Blood Group: ${p.blood_group || 'Unknown'}, Gender: ${p.gender || 'Unknown'}
- Active conditions: ${conditions.length ? conditions.join('; ') : 'None documented'}
- Current medications: ${medications.length ? medications.join('; ') : 'None on record'}
- Allergies: ${allergies.length ? allergies.map(a => `${a.allergen} (${a.severity})`).join('; ') : 'None known'}
- Recent abnormal findings: ${reportsText}
- Emergency contact: ${p.emergency_contact_name ? `${p.emergency_contact_name} — ${p.emergency_contact_phone || 'no phone'}` : 'Not provided'}

Output this exact JSON:
{
  "generated_date": "${today}",
  "patient_name": "<full name or 'Not provided'>",
  "age": <integer or null>,
  "blood_group": "<blood group or null>",
  "active_conditions": ["<condition with onset if known>"],
  "current_medications": ["<med name dosage frequency>"],
  "critical_allergies": ["<allergen (severity)>"],
  "recent_reports": "<1–2 sentences summarising key lab findings>",
  "key_insights": "<2–3 sentences: the most important clinical takeaways a new doctor needs to know immediately>",
  "emergency_contact": "<name — phone, or 'Not provided'>"
}`;

    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('CLAUDE_API_KEY not set');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type':      'application/json',
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model:      process.env.CLAUDE_REPORT_MODEL || 'claude-sonnet-4-6',
            max_tokens: 1024,
            temperature: 0.1,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    return extractJSON(text);
}

// ─── Doctor patient summary (agent loop + RAG grounding) ─────────────────────

const DOCTOR_SUMMARY_TOOLS = SCHEMAS.filter(t =>
    ['get_patient_chart_by_id', 'rag_search'].includes(t.name)
);

const DOCTOR_SUMMARY_SYSTEM = `You are RxSense Clinical AI — a senior clinical decision support system generating structured patient summaries for doctors.

## Workflow (follow strictly)
1. Call get_patient_chart_by_id with the patient_id to retrieve the complete clinical chart.
2. Identify the 2–3 most clinically significant abnormal lab values or active conditions.
3. For each significant finding, call rag_search with a focused clinical query to retrieve evidence-based context from Harrison's Principles of Internal Medicine and MedlinePlus.
4. Generate the structured summary using ONLY data retrieved from the tools — never invent values.

## Ground truth rules (CRITICAL — violating these harms patients)
- Every lab value cited must come directly from get_patient_chart_by_id tool result.
- Every clinical recommendation must cite a specific source returned by rag_search (book title + chapter/topic).
- If a tool returns no data for a field, write null or an empty array — never fabricate.
- Do NOT invent conditions, medications, or symptoms not present in the tool results.

## Output format — output ONLY valid JSON after tool calls (no markdown, no text):
{
  "generated_at": "<ISO date string>",
  "patient_summary": {
    "name": "<full name>",
    "age": <integer or null>,
    "gender": "<gender or null>",
    "blood_group": "<blood group or null>",
    "bmi": <calculated from height/weight, rounded to 1 decimal, or null>,
    "bp": "<systolic/diastolic mmHg or null>"
  },
  "active_conditions": [
    { "condition": "<name>", "severity": "<mild|moderate|severe|null>", "since": "<date or null>" }
  ],
  "allergies": [
    { "allergen": "<name>", "severity": "<severity>", "reaction": "<reaction type>" }
  ],
  "current_medications": [
    { "drug": "<name>", "dosage": "<dosage>", "frequency": "<frequency>", "source": "<doctor_prescription|scanned>" }
  ],
  "lab_findings": [
    {
      "parameter": "<name>",
      "value": "<value with unit>",
      "status": "<normal|low|high|critical_low|critical_high>",
      "reference_range": "<range>",
      "clinical_significance": "<1 sentence: what this value means clinically, grounded in RAG>",
      "rag_source": "<book title and chapter from rag_search result>"
    }
  ],
  "risk_flags": [
    {
      "flag": "<short risk label>",
      "level": "<high|moderate|low>",
      "basis": "<1 sentence citing specific data from the chart>",
      "rag_reference": "<clinical guideline or book chapter from rag_search>"
    }
  ],
  "surgical_history": [
    { "procedure": "<name>", "date": "<date or null>", "outcome": "<outcome or null>" }
  ],
  "vaccinations": [
    { "vaccine": "<name>", "last_dose": "<date>", "next_due": "<date or null>" }
  ],
  "clinical_recommendations": [
    {
      "recommendation": "<specific, actionable recommendation>",
      "priority": "<urgent|high|medium>",
      "evidence_basis": "<cite specific RAG source: book + chapter>"
    }
  ],
  "key_clinical_notes": "<2–3 sentences: the most important things this doctor needs to know immediately, grounded in retrieved data>"
}`;

/**
 * Generate a comprehensive, RAG-grounded clinical summary for a doctor.
 * Uses full agent loop — Claude is forced to call tools before synthesising.
 *
 * @param {object} opts
 * @param {string} opts.patientId  — patient UUID
 * @returns {Promise<object>} structured clinical summary with RAG references
 */
async function generateDoctorPatientSummary({ patientId }) {
    const userMessage = [
        `Patient UUID: ${patientId}`,
        'Generate a comprehensive clinical summary for the treating doctor.',
        'Step 1: Call get_patient_chart_by_id to retrieve all patient data.',
        'Step 2: For each significant abnormal finding or condition, call rag_search for evidence-based context.',
        'Step 3: Output ONLY the structured JSON — every value must come from tool results.',
    ].join('\n');

    const { text } = await runAgent({
        agentName:   'DoctorPatientSummaryAgent',
        userId:      null,
        system:      DOCTOR_SUMMARY_SYSTEM,
        userMessage,
        tools:       DOCTOR_SUMMARY_TOOLS,
        executors:   buildDoctorExecutors(),
        maxTokens:   3000,
        temperature: 0.1,
    });

    return extractJSON(text);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJSON(text) {
    const t = text.trim();

    // 1. Direct parse
    try { return JSON.parse(t); } catch {}

    // 2. Markdown code block
    const block = t.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (block) { try { return JSON.parse(block[1]); } catch {} }

    // 3. First { … last }
    const start = t.indexOf('{');
    const end   = t.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try { return JSON.parse(t.slice(start, end + 1)); } catch {}
    }

    throw new Error('Could not extract JSON from agent response');
}

// ─── Patient-facing health story summary ─────────────────────────────────────

const SUMMARY_SYSTEM = `আপনি RxSense-এর একজন সহানুভূতিশীল স্বাস্থ্য সহকারী।
আপনার কাজ: টুল থেকে পাওয়া আসল তথ্য ব্যবহার করে রোগীর জন্য একটি সহজ, বাংলা স্বাস্থ্য সারসংক্ষেপ লেখা।

## কাজের ধাপ
1. get_patient_profile কল করুন — রোগীর আসল অবস্থা, ওষুধ, অ্যালার্জি, রক্তের গ্রুপ জানুন।
2. get_report_history কল করুন — সাম্প্রতিক ল্যাব রিপোর্টের আসল মান জানুন।
3. অস্বাভাবিক মানের জন্য rag_search কল করুন — সহজ ভাষায় মানে বুঝুন।
4. শুধুমাত্র টুল থেকে পাওয়া তথ্য দিয়ে JSON আউটপুট দিন।

## কঠোর নিয়ম — এগুলো ভাঙলে রোগীর ক্ষতি হতে পারে
- টুল রিটার্ন না করলে কোনো ল্যাব মান (রক্তচাপ, হিমোগ্লোবিন ইত্যাদি) কল্পনা করবেন না।
- টুলে না থাকলে কোনো রোগ, ওষুধ বা উপসর্গ তৈরি করবেন না।
- ডেটা না থাকলে সৎভাবে বলুন — অনুমান করবেন না।

## আউটপুট ফরম্যাট — টুল কলের পর শুধু এই JSON দিন (কোনো markdown নয়):
{
  "headline": "<একটি উষ্ণ, সত্যিকারের বাংলা বাক্য — সর্বোচ্চ ১২ শব্দ>",
  "sections": [
    {
      "icon": "<একটি emoji>",
      "title": "<বাংলায় শিরোনাম>",
      "points": ["<ছোট বাংলা পয়েন্ট — সর্বোচ্চ ১৫ শব্দ>"]
    }
  ]
}

## কোন sections রাখবেন (শুধু যদি টুলে ডেটা থাকে):
১. আইকন 💚, শিরোনাম "আপনার স্বাস্থ্য অবস্থা" — রক্তের গ্রুপ, রোগ, সামগ্রিক অবস্থা
২. আইকন 💊, শিরোনাম "আপনার ওষুধ" — প্রতিটি ওষুধ: নাম + কী কাজে লাগে (সহজ বাংলায়)
৩. আইকন 🔬, শিরোনাম "আপনার রিপোর্ট" — প্রতিটি মান: সংখ্যা + স্বাভাবিক/সতর্কতা

## লেখার নিয়ম
- সম্পূর্ণ বাংলায় লিখুন — কোনো ইংরেজি বাক্য নয়; শুধু ওষুধ ও মেডিকেল নাম ইংরেজিতে রাখুন
- প্রতিটি পয়েন্ট ছোট ও সহজ — অশিক্ষিত মানুষও যেন বুঝতে পারেন
- মেডিকেল টার্ম ব্যবহার করলে সাথে বাংলায় ব্যাখ্যা দিন, যেমন: "Metoprolol (হৃদস্পন্দন নিয়ন্ত্রণের ওষুধ)"
- ভালো মান হলে: "✓ স্বাভাবিক"; সতর্কতার মান হলে: "⚠️ একটু কম/বেশি — ডাক্তারকে জানান"
- ডেটা না থাকলে সেই section বাদ দিন, মিথ্যা লিখবেন না`;

/**
 * Generate a warm, personal, grounded health narrative for the patient.
 * Uses the full agent loop so Claude is forced to call tools — it cannot hallucinate
 * data it hasn't actually retrieved.
 *
 * @param {object} opts
 * @param {number} opts.userId
 * @returns {Promise<{ headline: string, sections: Array<{ icon: string, title: string, points: string[] }> }>}
 */
async function generatePatientSummary({ userId }) {
    const SUMMARY_TOOLS = SCHEMAS.filter(t =>
        ['get_patient_profile', 'get_report_history', 'rag_search'].includes(t.name)
    );

    const userMessage = [
        `Patient user_id: ${userId}`,
        'Use your tools to gather this patient\'s actual health data — profile, reports, and clinical context.',
        'Write their personal health story using ONLY what the tools return. Output the JSON.',
    ].join('\n');

    const { text } = await runOpenAIAgent({
        agentName:   'PatientSummaryAgent',
        userId,
        system:      SUMMARY_SYSTEM,
        userMessage,
        tools:       SUMMARY_TOOLS,
        executors:   buildExecutors(userId),
        maxTokens:   3000,
        temperature: 0.2,
    });

    return extractJSON(text);
}

// ─── (legacy direct-call removed — see generatePatientSummary above) ──────────
// eslint-disable-next-line no-unused-vars
async function _unused_placeholder({ userId }) {
    const db = DB_Connection.getInstance();

    const profileRes = await db.query_executor(`
        SELECT
            u.full_name,
            EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
            p.gender,
            p.blood_group,
            (SELECT COALESCE(json_agg(kc.condition_name), '[]'::json)
             FROM known_condition kc
             WHERE kc.patient_id = p.patient_id AND kc.status = 'active'
            ) AS active_conditions,
            (SELECT COALESCE(ps.medications, '[]'::jsonb)
             FROM prescription_scan ps
             WHERE ps.user_id = u.id
             ORDER BY ps.created_at DESC
             LIMIT 1
            ) AS current_medications
        FROM users u
        LEFT JOIN patient p ON p.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
    `, [userId]);

    const reportsRes = await db.query_executor(`
        SELECT
            mr.report_type,
            mr.report_date,
            (SELECT json_agg(json_build_object(
                'parameter', lm.parameter_name,
                'value',     lm.value,
                'unit',      lm.unit,
                'status',    lm.status
            ) ORDER BY CASE lm.status
                WHEN 'critical_high' THEN 1 WHEN 'critical_low' THEN 2
                WHEN 'high'          THEN 3 WHEN 'low'          THEN 4
                ELSE 5 END)
             FROM report_metric lm WHERE lm.report_id = mr.report_id
            ) AS metrics
        FROM medical_report mr
        JOIN patient p ON p.patient_id = mr.patient_id
        WHERE p.user_id = $1
        ORDER BY mr.uploaded_at DESC
        LIMIT 3
    `, [userId]);

    const p          = profileRes.rows[0] || {};
    const reports    = reportsRes.rows;
    const conditions = p.active_conditions   || [];
    const meds       = (p.current_medications || []).map(m =>
        [m.name || m.drug, m.dosage, m.frequency].filter(Boolean).join(' ')
    );

    const reportsText = reports.length
        ? reports.map(r => {
            const date    = r.report_date ? new Date(r.report_date).toLocaleDateString() : 'recent';
            const metrics = (r.metrics || []).slice(0, 5)
                .map(m => `${m.parameter}: ${m.value}${m.unit ? ' ' + m.unit : ''} (${m.status})`)
                .join(', ');
            return `${r.report_type} (${date}): ${metrics || 'values extracted'}`;
        }).join('\n')
        : 'No lab reports on file yet';

    const noData = conditions.length === 0 && meds.length === 0 && reports.length === 0;

    const prompt = noData
        ? `Write a warm, encouraging health summary for ${p.full_name || 'a patient'} who is just starting to track their health. Output ONLY valid JSON:
{"headline":"<one uplifting sentence about beginning their health journey, max 15 words>","paragraphs":["<why tracking health matters — hopeful and empowering>","<how RxSense can help them stay on top of things>","<warm closing that feels personal and motivating>"]}`
        : `Write a warm, personal health summary for this patient. Be like a caring friend who happens to know medicine — honest but never scary.

Patient: ${p.full_name || 'Patient'}${p.age ? ', ' + p.age + ' years old' : ''}${p.blood_group ? ', blood group ' + p.blood_group : ''}
Active conditions: ${conditions.length ? conditions.join(', ') : 'none diagnosed'}
Current medications: ${meds.length ? meds.join('; ') : 'none'}
Recent lab results:
${reportsText}

Output ONLY valid JSON (no markdown):
{
  "headline": "<one warm sentence that frames their health journey positively, max 15 words>",
  "paragraphs": [
    "<paragraph about their conditions and daily life — reframe as 'you are managing this well' not 'you are sick'>",
    "<paragraph about their medications — validate that taking medication is a sign of strength, mention names>",
    "<paragraph about recent lab trends — celebrate what is good, gently note what to watch, end on hope>"
  ]
}

Rules:
- Address the patient directly as "you" / "your"
- Never use words like "dangerous", "serious", "alarming" — use "worth watching", "worth mentioning", "something to keep an eye on"
- Mention specific values and drug names to feel genuinely personal
- If a value is elevated, say what small action can help
- If everything is fine, celebrate it warmly
- Keep each paragraph to 2–3 sentences
- Output raw JSON only`;

    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('CLAUDE_API_KEY not set');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
            'Content-Type':      'application/json',
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model:       process.env.CLAUDE_REPORT_MODEL || 'claude-sonnet-4-6',
            max_tokens:  900,
            temperature: 0.4,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return extractJSON(data.content?.[0]?.text || '');
}

module.exports = { generateInsights, generateDoctorSummary, generatePatientSummary, generateDoctorPatientSummary };
