const path = require('path');

const REPORT_TYPE_TO_ENUM = {
    'Complete Blood Count (CBC)': 'CBC',
    'Lipid Panel': 'lipid_panel',
    'Liver Function Test (LFT)': 'metabolic_panel',
    'Kidney Function Test (KFT)': 'metabolic_panel',
    'HbA1c / Diabetes Panel': 'metabolic_panel',
    'Thyroid Panel': 'thyroid',
    'Urine Analysis': 'urine_analysis',
    Other: 'other'
};

const EXTRACTION_PROMPT = `You are a medical data extraction assistant.
Extract ALL information from this medical report and return a JSON object.
Use null for any field not present in the report.

IMPORTANT: Return ONLY raw JSON. No markdown, no code fences, no explanation.
Your response must start with { and end with }

{
  "patient": {
    "name": null,
    "age": null,
    "gender": null,
    "patient_id": null,
    "date_of_birth": null
  },
  "report": {
    "report_date": null,
    "report_type": null,
    "facility": null,
    "doctor": null
  },
  "diagnoses": [],
  "lab_results": [
    {
      "test": "exact test name from report",
      "value": "numeric value",
      "unit": "unit of measurement",
      "reference_range": "ONLY fill if explicitly written in the report, else null",
      "status": "normal or abnormal or critical - ONLY if stated in report, else null",
      "conclusion": "any conclusion or interpretation written in the report, else null"
    }
  ],
  "medications": [
    {"name": null, "dosage": null, "frequency": null}
  ],
  "vitals": {
    "blood_pressure": null,
    "heart_rate": null,
    "temperature": null,
    "weight": null,
    "height": null,
    "bmi": null,
    "oxygen_saturation": null
  },
  "clinical_notes": null,
  "recommendations": [],
  "follow_up": null
}`;

const REFERENCE_RANGE_PROMPT = `You are a medical reference expert.

A lab test result needs its standard reference range.
Test name: {test_name}
Value: {value}
Unit: {unit}
Patient age: {age}
Patient gender: {gender}

Provide the standard medical reference range for this test for this patient profile.
Use your medical knowledge. If you are not confident, say so.

Return ONLY a raw JSON object. No markdown, no explanation.
{
  "reference_range": "e.g. 4.5-11.0",
  "unit": "e.g. x10^3/uL",
  "source": "medical_knowledge or web_search",
  "confidence": "high or medium or low",
  "notes": "any important notes about this range e.g. varies by lab"
}`;

const REFERENCE_RANGE_WEB_PROMPT = `You are a medical reference expert. Use web search to find the standard reference range for this lab test.

Test: {test_name}
Unit: {unit}
Patient age: {age}
Patient gender: {gender}

Search for the standard reference range and return ONLY a raw JSON object:
{
  "reference_range": "e.g. 4.5-11.0",
  "unit": "e.g. x10^3/uL",
  "source": "web_search",
  "confidence": "high or medium or low",
  "notes": "source website or guideline name"
}`;

const ANALYSIS_PROMPT = `You are an experienced clinician analyzing lab results.

Patient: Age={age}, Gender={gender}

Lab results with reference ranges:
{lab_json}

For EACH lab result:
1. Compare the value against the reference range
2. Determine status: normal / abnormal (high) / abnormal (low) / critical
3. Identify what the abnormality could indicate clinically
4. Note any patterns if multiple results are abnormal together

Return ONLY a raw JSON array. No markdown, no explanation.
[
  {
    "test": "test name",
    "value": "value with unit",
    "reference_range": "range used",
    "status": "normal / abnormal (high) / abnormal (low) / critical",
    "deviation": "how far from normal e.g. slightly elevated / significantly low",
    "possible_causes": ["cause1", "cause2"],
    "clinical_significance": "what this means medically in 1-2 sentences",
    "action_needed": true
  }
]`;

const SUMMARY_PROMPT = `You are a compassionate doctor writing a report summary readable by BOTH doctors and patients.

Patient: {patient_name}, Age={age}, Gender={gender}
Report type: {report_type}
Date: {report_date}

Full analysis data:
{analysis_json}

Diagnoses from report: {diagnoses}
Clinical notes: {clinical_notes}
Recommendations: {recommendations}
Follow-up: {follow_up}

Write a comprehensive summary with TWO sections:

SECTION 1 - CLINICAL SUMMARY (for doctors): Technical, concise, uses medical terms
SECTION 2 - PATIENT SUMMARY (for patients): Warm, simple language, no jargon

Return ONLY a raw JSON object. No markdown, no code fences.
{
  "overall_status": "Normal / Needs Attention / Concerning / Critical",
  "overall_status_marker": "OK or WARNING or URGENT",
  "abnormal_count": 0,
  "total_tests": 0,

  "clinical_summary": {
    "impression": "one paragraph clinical impression",
    "significant_findings": ["finding1", "finding2"],
    "suggested_followup": "clinical follow-up recommendation"
  },

  "patient_summary": {
    "headline": "one friendly sentence summarizing overall health",
    "what_this_report_is": "plain English explanation of what this report tests",
    "good_news": ["thing1 is normal", "thing2 is fine"],
    "needs_attention": [
      {"test": "test name", "finding": "what was found", "simple_explanation": "what it means in plain words", "what_to_do": "simple action"}
    ],
    "diagnoses_explained": ["plain English explanation of each diagnosis"],
    "medications_explained": ["what each medication is for in simple words"],
    "next_steps": "simple friendly advice on what to do next",
    "encouraging_note": "warm closing message"
  },

  "full_plain_text_summary": "3-4 paragraph easy-to-read summary of the entire report for the patient"
}`;

const SUPPORTED_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
]);

const fillTemplate = (template, values) => Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value ?? ''),
    template
);

const parseJsonResponse = (rawText, label = '') => {
    const raw = String(rawText || '')
        .trim()
        .replace(/```(?:json|JSON)?\s*/g, '')
        .replace(/```/g, '')
        .trim();

    try {
        return JSON.parse(raw);
    } catch {
        // Continue into object/array extraction.
    }

    const extractBalanced = (openChar, closeChar) => {
        const start = raw.indexOf(openChar);
        if (start < 0) return null;
        let depth = 0;
        for (let i = start; i < raw.length; i++) {
            if (raw[i] === openChar) depth++;
            if (raw[i] === closeChar) depth--;
            if (depth === 0) return raw.slice(start, i + 1);
        }
        return null;
    };

    for (const candidate of [extractBalanced('{', '}'), extractBalanced('[', ']')]) {
        if (!candidate) continue;
        try {
            return JSON.parse(candidate);
        } catch {
            // Try the next balanced shape.
        }
    }

    console.error(`Could not parse Claude JSON response [${label}]:`, raw.slice(0, 2000));
    throw new Error(`Could not parse JSON from Claude [${label}]`);
};

const extractTextFromResponse = (responseJson) => (responseJson.content || [])
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n')
    .trim();

const normalizeStatus = (status) => {
    const value = String(status || 'normal').toLowerCase();
    if (value.includes('critical') && value.includes('low')) return 'critical_low';
    if (value.includes('critical') && value.includes('high')) return 'critical_high';
    if (value.includes('critical')) return 'critical_high';
    if (value.includes('low')) return 'low';
    if (value.includes('high')) return 'high';
    return 'normal';
};

const toUiStatus = (status) => {
    const value = normalizeStatus(status);
    if (value === 'critical_low') return 'low';
    if (value === 'critical_high') return 'high';
    return value;
};

class ReportAnalysisUtils {
    constructor() {
        this.apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
        this.modelName = process.env.CLAUDE_REPORT_MODEL || process.env.ANTHROPIC_REPORT_MODEL || 'claude-sonnet-4-6';
        this.endpoint = 'https://api.anthropic.com/v1/messages';
        this.tokensUsed = 0;
    }

    getReportTypeEnum = (reportType) => REPORT_TYPE_TO_ENUM[reportType] || 'other';

    validateFile = (file) => {
        if (!file) throw new Error('No report file was uploaded');
        if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
            const ext = path.extname(file.originalname || '').toLowerCase();
            throw new Error(`Unsupported file type${ext ? `: ${ext}` : ''}. Upload PDF, PNG, JPG, JPEG, WEBP, or GIF.`);
        }
    };

    message = async ({ content, maxTokens = 4096, tools }) => {
        if (!this.apiKey || this.apiKey === 'your_claude_api_key_here') {
            throw new Error('CLAUDE_API_KEY is missing or still set to the placeholder value');
        }

        const response = await globalThis.fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.modelName,
                max_tokens: maxTokens,
                tools,
                messages: [{ role: 'user', content }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Claude report analysis failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        this.tokensUsed += data.usage ? (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) : 0;
        return data;
    };

    fileContent = (file) => {
        if (file.mimetype === 'application/pdf') {
            return [
                {
                    type: 'document',
                    source: {
                        type: 'base64',
                        media_type: 'application/pdf',
                        data: file.buffer.toString('base64')
                    }
                },
                { type: 'text', text: EXTRACTION_PROMPT }
            ];
        }

        return [
            {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: file.mimetype,
                    data: file.buffer.toString('base64')
                }
            },
            { type: 'text', text: EXTRACTION_PROMPT }
        ];
    };

    step1Extract = async (file) => {
        const response = await this.message({
            content: this.fileContent(file),
            maxTokens: 4096
        });
        return parseJsonResponse(extractTextFromResponse(response), 'extraction');
    };

    getReferenceRange = async ({ testName, value, unit, age, gender }) => {
        const prompt = fillTemplate(REFERENCE_RANGE_PROMPT, {
            test_name: testName,
            value,
            unit,
            age,
            gender
        });

        const response = await this.message({
            content: prompt,
            maxTokens: 512
        });
        let result = parseJsonResponse(extractTextFromResponse(response), `ref_range:${testName}`);

        if (String(result.confidence || '').toLowerCase() === 'low') {
            const webPrompt = fillTemplate(REFERENCE_RANGE_WEB_PROMPT, {
                test_name: testName,
                unit,
                age,
                gender
            });

            try {
                const webResponse = await this.message({
                    content: webPrompt,
                    maxTokens: 512,
                    tools: [{ type: 'web_search_20250305', name: 'web_search' }]
                });
                const webText = extractTextFromResponse(webResponse);
                if (webText) {
                    result = parseJsonResponse(webText, `web_ref_range:${testName}`);
                }
            } catch (error) {
                console.warn(`Web reference lookup failed for ${testName}:`, error.message);
            }
        }

        return result;
    };

    step2FillReferenceRanges = async (extracted) => {
        const labResults = extracted.lab_results || [];
        const age = extracted.patient?.age || 'unknown';
        const gender = extracted.patient?.gender || 'unknown';

        for (const lab of labResults) {
            if (lab.reference_range) {
                lab.range_source = 'report';
                continue;
            }

            const ref = await this.getReferenceRange({
                testName: lab.test || '',
                value: lab.value || '',
                unit: lab.unit || '',
                age,
                gender
            });

            lab.reference_range = ref.reference_range || 'N/A';
            lab.unit = lab.unit || ref.unit || null;
            lab.range_source = ref.source || 'lookup';
            lab.range_confidence = ref.confidence || 'unknown';
            lab.range_notes = ref.notes || '';
        }

        extracted.lab_results = labResults;
        return extracted;
    };

    step3Analyze = async (extracted) => {
        const labResults = extracted.lab_results || [];
        if (labResults.length === 0) return [];

        const prompt = fillTemplate(ANALYSIS_PROMPT, {
            age: extracted.patient?.age || 'unknown',
            gender: extracted.patient?.gender || 'unknown',
            lab_json: JSON.stringify(labResults, null, 2)
        });

        const response = await this.message({
            content: prompt,
            maxTokens: 4096
        });
        return parseJsonResponse(extractTextFromResponse(response), 'analysis');
    };

    step4Summary = async (extracted, analysis) => {
        const patient = extracted.patient || {};
        const report = extracted.report || {};
        const prompt = fillTemplate(SUMMARY_PROMPT, {
            patient_name: patient.name || 'Patient',
            age: patient.age || 'unknown',
            gender: patient.gender || 'unknown',
            report_type: report.report_type || 'Medical Report',
            report_date: report.report_date || 'unknown',
            analysis_json: JSON.stringify(analysis, null, 2),
            diagnoses: JSON.stringify(extracted.diagnoses || []),
            clinical_notes: extracted.clinical_notes || 'None',
            recommendations: JSON.stringify(extracted.recommendations || []),
            follow_up: extracted.follow_up || 'None'
        });

        const response = await this.message({
            content: prompt,
            maxTokens: 4096
        });
        return parseJsonResponse(extractTextFromResponse(response), 'summary');
    };

    analyze = async ({ file }) => {
        this.tokensUsed = 0;
        this.validateFile(file);

        const extracted = await this.step1Extract(file);
        const extractedWithRanges = await this.step2FillReferenceRanges(extracted);
        const analysis = await this.step3Analyze(extractedWithRanges);
        const summary = await this.step4Summary(extractedWithRanges, analysis);

        return {
            extracted_data: extractedWithRanges,
            analysis,
            summary,
            _meta: {
                model_used: this.modelName,
                tokens_used: this.tokensUsed
            }
        };
    };

    toFrontendResult = ({ analysisResult, reportRecord }) => {
        const labResults = analysisResult.extracted_data?.lab_results || [];
        const summary = analysisResult.summary || {};
        const report = analysisResult.extracted_data?.report || {};
        const clinical = summary.clinical_summary || {};
        const patientSummary = summary.patient_summary || {};

        const values = labResults.map((item, index) => ({
            id: item.metric_id || `metric_${index + 1}`,
            parameter: item.test,
            value: [item.value, item.unit].filter(Boolean).join(' '),
            normalRange: item.reference_range ? [item.reference_range, item.unit].filter(Boolean).join(' ') : 'Not provided',
            status: toUiStatus(item.status),
            numericValue: Number.parseFloat(String(item.value).replace(/,/g, '')),
            trend: [],
            conclusion: item.conclusion,
            rangeSource: item.range_source
        }));

        const risks = (analysisResult.analysis || [])
            .filter((item) => item.action_needed || !String(item.status || '').toLowerCase().includes('normal'))
            .map((item) => ({
                level: String(item.status || '').toLowerCase().includes('critical') ? 'high' : 'moderate',
                condition: item.test,
                message: item.clinical_significance || item.deviation || 'Review with a clinician.'
            }));

        if (risks.length === 0 && clinical.impression) {
            risks.push({
                level: summary.overall_status === 'Normal' ? 'low' : 'moderate',
                condition: summary.overall_status || 'Report review',
                message: clinical.impression
            });
        }

        const recommendations = analysisResult.extracted_data?.recommendations?.length
            ? analysisResult.extracted_data.recommendations
            : [clinical.suggested_followup, patientSummary.next_steps].filter(Boolean);

        const status = String(summary.overall_status || '').toLowerCase();
        const urgencyLevel = status.includes('critical') || status.includes('concerning')
            ? 'high'
            : status.includes('normal')
                ? 'low'
                : 'moderate';

        return {
            id: reportRecord?.report_id || `rep_${Date.now()}`,
            date: report.report_date || new Date().toISOString().slice(0, 10),
            type: report.report_type || reportRecord?.report_type || 'Medical Report',
            lab: report.facility || 'Unknown facility',
            urgencyLevel,
            urgencyMessage: urgencyLevel === 'high' ? 'Seek urgent medical care' : urgencyLevel === 'moderate' ? 'Review with a doctor' : 'No urgent action flagged',
            autoSaved: Boolean(reportRecord?.report_id),
            values,
            risks,
            recommendations,
            plainSummary: summary.full_plain_text_summary || patientSummary.headline || clinical.impression || 'No summary available.',
            extractedData: analysisResult.extracted_data,
            analysis: analysisResult.analysis,
            summary
        };
    };

    normalizeMetricStatus = normalizeStatus;
}

module.exports = ReportAnalysisUtils;
