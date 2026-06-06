const SEVERITY_LABELS = {
  low: 'Watch',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Urgent',
};

const METRIC_COMPLICATIONS = [
  {
    keys: ['hemoglobin', 'hb', 'rbc', 'mcv', 'mch', 'mchc', 'hematocrit', 'pcv'],
    title: 'Possible anemia risk',
    reason: 'Blood count pattern can point toward reduced oxygen-carrying capacity, especially when hemoglobin or red cell indices are low.',
  },
  {
    keys: ['hba1c', 'glucose', 'sugar', 'fbs', 'rbs'],
    title: 'Possible diabetes risk',
    reason: 'Sugar-related values are trending in a pattern that can raise concern for diabetes or worsening blood sugar control.',
  },
  {
    keys: ['cholesterol', 'ldl', 'hdl', 'triglyceride'],
    title: 'Possible heart and blood vessel risk',
    reason: 'Lipid patterns can increase long-term cardiovascular risk when they stay outside a healthy range.',
  },
  {
    keys: ['creatinine', 'urea', 'egfr', 'uric acid'],
    title: 'Possible kidney strain',
    reason: 'Kidney-related markers can suggest reduced filtering capacity or extra strain when the pattern is abnormal.',
  },
  {
    keys: ['alt', 'sgpt', 'ast', 'sgot', 'bilirubin', 'alkaline phosphatase'],
    title: 'Possible liver stress',
    reason: 'Liver markers can rise when liver cells or bile flow are under stress.',
  },
  {
    keys: ['tsh', 't3', 't4', 'thyroid'],
    title: 'Possible thyroid imbalance',
    reason: 'Thyroid values can suggest overactive or underactive thyroid function when they drift out of range.',
  },
  {
    keys: ['wbc', 'neutrophil', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil', 'esr', 'crp'],
    title: 'Possible infection or inflammation pattern',
    reason: 'White blood cell and inflammation markers can change with infection, allergy, inflammation, or immune response.',
  },
  {
    keys: ['platelet'],
    title: 'Possible bleeding or clotting concern',
    reason: 'Platelet patterns can affect bleeding or clotting risk when they move meaningfully outside the expected range.',
  },
];

const clean = (value) => String(value || '').trim();

const isRawMetricName = (value, metric) => {
  const title = clean(value).toLowerCase();
  const metricName = clean(metric).toLowerCase();
  return !title || title === metricName || title === `${metricName}s` || title.includes('worsening of ');
};

export function getPredictionDisplay(prediction = {}) {
  const metric = clean(prediction.metric_name);
  const rawTitle = clean(prediction.predicted_value || prediction.predicted_complication);
  const haystack = `${metric} ${rawTitle}`.toLowerCase();
  const mapped = METRIC_COMPLICATIONS.find((item) => item.keys.some((key) => haystack.includes(key)));
  const title = isRawMetricName(rawTitle, metric)
    ? mapped?.title || 'Possible health complication'
    : rawTitle;
  const rawReason = clean(prediction.reasoning);
  const hasTechnicalReason = /\bslope\s*=|\bslope:|\bcohort\b|heuristic/i.test(rawReason);
  const reason = hasTechnicalReason || !rawReason
    ? mapped?.reason || 'This is based on changes in your reports and patterns seen in similar health records.'
    : rawReason;
  const confidence = Number(prediction.confidence || 0);
  const severity = clean(prediction.severity_level || prediction.severity || 'moderate').toLowerCase();

  return {
    title,
    reason,
    confidence: confidence > 1 ? confidence / 100 : confidence,
    severity,
    severityLabel: SEVERITY_LABELS[severity] || 'Moderate',
    metric,
    action: clean(prediction.preventive_action || prediction.recommendation),
    reportId: prediction.report_id || prediction.reportId || null,
  };
}
