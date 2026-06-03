'use strict';

const EXTRACTION_PROMPT = `You are a medical data extraction specialist.
Extract ALL information visible in this medical report and return it as structured JSON.
Include every piece of data — leave nothing out, even if the fields seem unusual.
Return ONLY raw JSON starting with { and ending with }. No markdown, no code fences, no explanation.

{
  "report_type": "type of report e.g. CBC, Lipid Panel, X-Ray, Ultrasound, ECG, Urine Analysis",
  "report_date": "date as written in the report, or null",
  "facility": "lab, clinic, or hospital name, or null",
  "ordering_doctor": "doctor name who ordered the report, or null",
  "patient": {
    "name": null,
    "age": null,
    "gender": null,
    "patient_id": null,
    "date_of_birth": null
  },
  "sections": [
    {
      "title": "section heading exactly as in report e.g. Complete Blood Count, Biochemistry, Findings, Impression",
      "type": "lab_results or imaging or vitals or medications or narrative or other",
      "entries": [
        {
          "label": "parameter or test name",
          "value": "value exactly as printed",
          "unit": "unit of measurement, or null",
          "reference_range": "normal range exactly as printed in the report, or null",
          "flag": "H or L or HH or LL or * or null — exactly as printed on the report",
          "status": "normal or high or low or critical or borderline or null"
        }
      ],
      "narrative": "free-text content for imaging/impression/narrative sections, null for table sections"
    }
  ],
  "overall_impression": "overall conclusion or impression from the report, or null",
  "diagnoses": ["list of diagnoses if mentioned"],
  "recommendations": ["list of recommendations or advice if mentioned"],
  "clinical_notes": "any other clinical notes or comments, or null",
  "follow_up": "follow-up instructions, or null"
}

Rules:
- For sections with tabular data (blood counts, chemistry panels, etc.) use type "lab_results" and populate "entries"
- For sections with free text (findings, impression, history) use type "narrative" and put text in "narrative", leave "entries" as []
- For vitals (BP, HR, temp, weight, SpO2) use type "vitals" and populate "entries"
- Preserve original values and units exactly as written
- If the report is an image and text is unclear, do your best — include partial info rather than omitting`;

const SUPPORTED_CLAUDE_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
]);

// Labels that are derived ratios/indices — skip reference lookup
const SKIP_LABEL_PATTERNS = /ratio|index|vldl|pcv/i;

class ReportAnalysisUtils {
    constructor() {
        this.apiKey    = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
        this.modelName = process.env.CLAUDE_REPORT_MODEL || 'claude-sonnet-4-6';
        this.endpoint  = 'https://api.anthropic.com/v1/messages';
        this._refLookup = null;
    }

    validateApiKey() {
        if (!this.apiKey || this.apiKey === 'your_claude_api_key_here') {
            throw new Error('CLAUDE_API_KEY is missing or still set to the placeholder value. Add it to .env to enable report analysis.');
        }
    }

    isSupportedType(mimetype) {
        return SUPPORTED_CLAUDE_TYPES.has(mimetype?.toLowerCase());
    }

    buildContent(file) {
        if (file.mimetype === 'application/pdf') {
            return [
                {
                    type: 'document',
                    source: {
                        type: 'base64',
                        media_type: 'application/pdf',
                        data: file.buffer.toString('base64'),
                    },
                },
                { type: 'text', text: EXTRACTION_PROMPT },
            ];
        }
        return [
            {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: file.mimetype,
                    data: file.buffer.toString('base64'),
                },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
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

        console.error('[Report] Could not parse Claude JSON:', clean.slice(0, 500));
        throw new Error('Could not parse report extraction response');
    }

    extract = async (file) => {
        this.validateApiKey();

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type':      'application/json',
                'x-api-key':         this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model:      this.modelName,
                max_tokens: 8192,
                messages:   [{ role: 'user', content: this.buildContent(file) }],
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Claude extraction failed (${response.status}): ${text}`);
        }

        const data    = await response.json();

        if (data.stop_reason === 'max_tokens') {
            console.warn('[Report] Claude hit max_tokens — response was truncated. Report may be too large.');
            throw new Error('Report is too large to fully extract. Try uploading individual pages.');
        }

        const rawText = (data.content || [])
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n')
            .trim();

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
