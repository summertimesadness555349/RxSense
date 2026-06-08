'use strict';

const { OpenAI } = require('openai');
const pdfParse   = require('pdf-parse');

const EXTRACTION_PROMPT = `TASK: Extract every piece of data from this medical report into the JSON schema below.

CRITICAL RULES — follow without exception:
- You MUST return valid JSON. No markdown fences, no prose, no apologies, no refusals.
- Start your response with { and end with }. Nothing else.
- Extract EVERY row from every table — do not skip any parameter or test result.
- Preserve values, units, and reference ranges exactly as printed.
- If a field is not visible, use null — never omit the key.
- Do not invent or modify values. Transcribe what you see.

{
  "report_type": "CBC or Lipid Panel or Metabolic Panel or Thyroid or Urine Analysis or Imaging or Other",
  "report_date": "date exactly as written, or null",
  "facility": "lab or hospital name, or null",
  "ordering_doctor": "doctor name, or null",
  "patient": {
    "name": null,
    "age": null,
    "gender": null,
    "patient_id": null,
    "date_of_birth": null
  },
  "sections": [
    {
      "title": "section heading exactly as printed e.g. Complete Blood Count",
      "type": "lab_results or imaging or vitals or narrative or other",
      "entries": [
        {
          "label": "parameter name exactly as printed",
          "value": "result value exactly as printed",
          "unit": "unit or null",
          "reference_range": "reference range exactly as printed or null",
          "flag": "H or L or HH or LL or * or null — exactly as printed",
          "status": "normal or high or low or critical or borderline or null"
        }
      ],
      "narrative": "free text for findings/impression sections, null for table sections"
    }
  ],
  "overall_impression": "conclusion or null",
  "diagnoses": [],
  "recommendations": [],
  "clinical_notes": null,
  "follow_up": null
}

- Tabular data (blood counts, panels): type = "lab_results", populate entries
- Narrative sections (Findings, Impression): type = "narrative", put text in narrative, entries = []
- Vitals (BP, HR, SpO2, weight): type = "vitals", populate entries`;

const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const SUPPORTED_TYPES       = new Set(['application/pdf', ...SUPPORTED_IMAGE_TYPES]);

// Labels that are derived ratios/indices — skip reference lookup
const SKIP_LABEL_PATTERNS = /ratio|index|vldl|pcv/i;

class ReportAnalysisUtils {
    constructor() {
        this.openai     = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.modelName  = process.env.OPENAI_REPORT_MODEL || 'gpt-4.1';
        this._refLookup = null;
    }

    validateApiKey() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set. Add it to .env to enable report analysis.');
        }
    }

    isSupportedType(mimetype) {
        return SUPPORTED_TYPES.has(mimetype?.toLowerCase());
    }

    async buildMessages(file) {
        const system = {
            role: 'system',
            content: 'You are a medical records digitization assistant for RxSense. Your only output is valid JSON — never prose, never markdown, never refusals. Extract every data point from the medical document exactly as instructed. Refusing or hedging is not an option; digitization is your sole function.',
        };

        if (SUPPORTED_IMAGE_TYPES.has(file.mimetype?.toLowerCase())) {
            const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            return [
                system,
                {
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
                        { type: 'text', text: EXTRACTION_PROMPT },
                    ],
                },
            ];
        }

        // PDF — extract text with pdf-parse; fall back to error if scanned/empty
        const parsed = await pdfParse(file.buffer);
        const text   = (parsed.text || '').trim();
        if (!text) throw new Error('PDF appears to be a scanned image with no extractable text. Please upload a JPEG or PNG image of the report instead.');

        return [
            system,
            {
                role: 'user',
                content: `${EXTRACTION_PROMPT}\n\nReport text extracted from PDF:\n\`\`\`\n${text}\n\`\`\``,
            },
        ];
    }

    parseJson(rawText) {
        const clean = String(rawText || '')
            .replace(/```(?:json|JSON)?\s*/g, '')
            .replace(/```/g, '')
            .trim();

        try { return JSON.parse(clean); } catch {}

        const findBalanced = (open, close) => {
            const start = clean.indexOf(open);
            if (start < 0) return null;
            let depth = 0;
            for (let i = start; i < clean.length; i++) {
                if (clean[i] === open) depth++;
                if (clean[i] === close) depth--;
                if (depth === 0) return clean.slice(start, i + 1);
            }
            return null;
        };

        for (const [o, c] of [['{', '}'], ['[', ']']]) {
            const candidate = findBalanced(o, c);
            if (!candidate) continue;
            try { return JSON.parse(candidate); } catch {}
        }

        console.error('[Report] Could not parse extraction JSON:', clean.slice(0, 500));
        throw new Error('Could not parse report extraction response');
    }

    extract = async (file, reportType = '') => {
        this.validateApiKey();
        const messages = await this.buildMessages(file);

        console.log(`[Report] Extracting with ${this.modelName}...`);
        const response = await this.openai.chat.completions.create({
            model:      this.modelName,
            max_tokens: 8192,
            messages,
        });

        if (response.choices[0]?.finish_reason === 'length') {
            console.warn('[Report] OpenAI hit max_tokens — response truncated. Report may be too large.');
            throw new Error('Report is too large to fully extract. Try uploading individual pages.');
        }

        const rawText = response.choices[0]?.message?.content || '';
        return this.parseJson(rawText);
    };

    // Maps any status/flag string to the DB metric_status enum
    normalizeMetricStatus(status, flag) {
        const s = String(status || flag || 'normal').toLowerCase();
        if (s.includes('critical') || flag === 'HH' || flag === 'LL') {
            return s.includes('low') || flag === 'LL' ? 'critical_low' : 'critical_high';
        }
        if (s.includes('high') || flag === 'H')    return 'high';
        if (s.includes('low')  || flag === 'L')    return 'low';
        if (s.includes('borderline'))              return 'borderline';
        return 'normal';
    }

    getReportTypeEnum(reportType) {
        const MAP = {
            'Complete Blood Count (CBC)': 'CBC',
            'Lipid Panel':                'lipid_panel',
            'Liver Function Test (LFT)':  'metabolic_panel',
            'Kidney Function Test (KFT)': 'metabolic_panel',
            'HbA1c / Diabetes Panel':     'metabolic_panel',
            'Thyroid Panel':              'thyroid',
            'Urine Analysis':             'urine_analysis',
        };
        return MAP[reportType] || 'other';
    }

    // ── Reference range enrichment ────────────────────────────────────────────

    _normKey(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/\(.*?\)/g, ' ')          // strip parentheticals
            .replace(/\bserum\b|\bs\.\s*/g, ' ') // strip "serum" / "s."
            .replace(/[./\-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _initRefLookup() {
        if (this._refLookup) return;
        const data = require('../data/lab_reference_ranges.json');
        const lookup = new Map();

        const put = (key, info) => {
            const k = this._normKey(key);
            if (k && !lookup.has(k)) lookup.set(k, info);
        };

        for (const [testKey, testVal] of Object.entries(data.tests)) {
            put(testKey, testVal);
            if (testVal.full_name) put(testVal.full_name, testVal);
            if (testVal.components) {
                for (const [ck, cv] of Object.entries(testVal.components)) {
                    put(ck, cv);
                }
            }
        }

        // Common alternative labels
        const ALIASES = {
            'sgpt':                    'alt',
            'sgot':                    'ast',
            'hb':                      'hemoglobin',
            'hgb':                     'hemoglobin',
            'haemoglobin':             'hemoglobin',
            'haematocrit':             'hematocrit',
            'plt':                     'platelets',
            'total cholesterol':       'cholesterol',
            'ldl cholesterol':         'ldl',
            'hdl cholesterol':         'hdl',
            'triglyceride':            'triglycerides',
            'blood urea':              'bun',
            'fasting blood glucose':   'fbs',
            'fasting blood sugar':     'fbs',
            'random blood glucose':    'rbs',
            'random blood sugar':      'rbs',
            'glycosylated hemoglobin': 'hba1c',
            'ft4':                     'free t4',
            'uric acid':               'uric acid',  // after norm of "S. Uric Acid"
        };

        for (const [alias, target] of Object.entries(ALIASES)) {
            const tk = this._normKey(target);
            if (lookup.has(tk)) put(alias, lookup.get(tk));
        }

        this._refLookup = lookup;
    }

    _findRef(label) {
        if (SKIP_LABEL_PATTERNS.test(label)) return null;
        this._initRefLookup();
        const key = this._normKey(label);
        if (!key || key.length < 2) return null;

        if (this._refLookup.has(key)) return this._refLookup.get(key);

        // Prefix fallback: e.g. "wbc count" matches lookup key "wbc"
        for (const [k, v] of this._refLookup) {
            if (k.length >= 3 && (key.startsWith(k + ' ') || key.endsWith(' ' + k))) return v;
        }
        return null;
    }

    _getNormalRange(info, gender, age) {
        const isFemale = String(gender || '').toLowerCase().includes('f');
        const a = parseInt(age) || 0;

        // CBC component: { range: {min, max, unit} }
        if (info.range) return info.range;

        // Direct gender split on the info object (CBC.Hemoglobin, CBC.RBC)
        if (info.male && info.female) return isFemale ? info.female : info.male;

        if (!info.ranges) return null;
        const r = info.ranges;

        // ESR-style: age + gender combined key
        const ageG = a >= 50 ? 'over50' : 'under50';
        const ekey = `${isFemale ? 'female' : 'male'}_${ageG}`;
        if (r[ekey]) return r[ekey];

        // Gender split within ranges (ALT, GGT, Ferritin, etc.)
        if (r.male && r.female) return isFemale ? r.female : r.male;

        // Named single range
        if (r.normal) return r.normal;
        if (r.adult)  return r.adult;
        if (r.morning_8am) return r.morning_8am; // Cortisol

        // Multi-threshold: pick the "healthy" upper bound
        // Vitamin D → sufficient, Cholesterol → desirable, LDL → optimal
        return r.sufficient || r.desirable || r.optimal || null;
    }

    _rangeText(range) {
        if (!range) return null;
        const { min, max, unit } = range;
        const u = unit ? ` ${unit}` : '';
        if (min !== undefined && max !== undefined) return `${min} – ${max}${u}`;
        if (min !== undefined) return `≥ ${min}${u}`;
        if (max !== undefined) return `≤ ${max}${u}`;
        return null;
    }

    _computeStatus(valueStr, range) {
        const num = parseFloat(String(valueStr).replace(/[<>≥≤~\s,]/g, ''));
        if (isNaN(num)) return null; // qualitative (Positive/Negative, etc.)
        const { min, max } = range;
        if (max !== undefined && num > max) return 'high';
        if (min !== undefined && num < min) return 'low';
        return 'normal';
    }

    // Post-extraction enrichment: fills missing reference_range strings and
    // computes status for entries where Claude left it null.
    enrichWithReferenceRanges(extracted) {
        const gender = extracted.patient?.gender || null;
        const age    = extracted.patient?.age    || null;

        for (const section of (extracted.sections || [])) {
            if (section.type !== 'lab_results' && section.type !== 'vitals') continue;
            for (const entry of (section.entries || [])) {
                const info  = this._findRef(entry.label);
                if (!info) continue;
                const range = this._getNormalRange(info, gender, age);
                if (!range) continue;

                if (!entry.reference_range) {
                    entry.reference_range = this._rangeText(range);
                }
                if (!entry.status || entry.status === 'null') {
                    const s = this._computeStatus(entry.value, range);
                    if (s) entry.status = s;
                }
            }
        }
        return extracted;
    }

    // Convert the extracted report into a DB-friendly raw_analysis shape.
    // Returns an object containing top-level metadata and a `metrics` array
    // where each metric matches the keys expected by `addReportMetric`.
    normalizeForDb(extracted = {}, { imageUrl = null, typeOverride = null } = {}) {
        const out = {};

        out.report_type = extracted.report_type || typeOverride || null;
        out.report_date = extracted.report_date || null;
        out.facility = extracted.facility || null;
        out.ordering_doctor = extracted.ordering_doctor || null;
        out.patient = extracted.patient || null;
        out.overall_impression = extracted.overall_impression || null;
        out.diagnoses = Array.isArray(extracted.diagnoses) ? extracted.diagnoses : (extracted.diagnoses ? [extracted.diagnoses] : []);
        out.recommendations = Array.isArray(extracted.recommendations) ? extracted.recommendations : (extracted.recommendations ? [extracted.recommendations] : []);
        out.clinical_notes = extracted.clinical_notes || null;
        out.follow_up = extracted.follow_up || null;
        out.image_url = imageUrl || null;

        // Gather DB-friendly metrics from lab_results and vitals sections
        const metrics = [];
        for (const section of (extracted.sections || [])) {
            if (section.type !== 'lab_results' && section.type !== 'vitals') continue;
            for (const entry of (section.entries || [])) {
                const m = {
                    parameterName: entry.label || entry.name || '',
                    value: String(entry.value ?? ''),
                    unit: entry.unit || null,
                    referenceRange: entry.reference_range || null,
                    status: this.normalizeMetricStatus(entry.status, entry.flag) || null,
                    llmFlagged: Boolean((entry.status && entry.status !== 'normal') || entry.flag),
                    // preserve raw entry for traceability
                    raw: entry,
                };
                metrics.push(m);
            }
        }

        out.metrics = metrics;
        // Keep the original sections minimally for backward compatibility
        out.sections = extracted.sections || [];
        return out;
    }
}

module.exports = ReportAnalysisUtils;
