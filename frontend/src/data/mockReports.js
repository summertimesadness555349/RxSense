// TODO: Replace with API call — GET /api/reports
export const mockReportResult = {
  id: 'rep_001',
  date: '2026-05-23',
  type: 'Complete Blood Count (CBC)',
  lab: 'Popular Diagnostic Centre',
  urgencyLevel: 'moderate',
  urgencyMessage: 'See a doctor within 1 week',
  autoSaved: true,
  values: [
    { id: 'v1', parameter: 'Hemoglobin', value: '11.2 g/dL', normalRange: '13.5-17.5 g/dL', status: 'low', numericValue: 11.2, trend: [10.8, 11.0, 11.2] },
    { id: 'v2', parameter: 'WBC', value: '7,500 /µL', normalRange: '4,000-11,000 /µL', status: 'normal', numericValue: 7500, trend: [] },
    { id: 'v3', parameter: 'Platelets', value: '245,000 /µL', normalRange: '150,000-400,000 /µL', status: 'normal', numericValue: 245000, trend: [] },
    { id: 'v4', parameter: 'HbA1c', value: '7.2%', normalRange: '< 5.7%', status: 'high', numericValue: 7.2, trend: [6.5, 6.8, 7.2] },
    { id: 'v5', parameter: 'Total Cholesterol', value: '215 mg/dL', normalRange: '< 200 mg/dL', status: 'borderline', numericValue: 215, trend: [] },
    { id: 'v6', parameter: 'Fasting Glucose', value: '142 mg/dL', normalRange: '70-100 mg/dL', status: 'high', numericValue: 142, trend: [] },
  ],
  risks: [
    { level: 'high', condition: 'Diabetes Indicator', message: 'Your HbA1c of 7.2% suggests uncontrolled diabetes. Normal is below 5.7%. Consult an endocrinologist.' },
    { level: 'moderate', condition: 'Anemia Indicator', message: 'Hemoglobin is below normal range. Could indicate iron deficiency. Consider iron-rich diet and further testing.' },
    { level: 'low', condition: 'Cholesterol', message: 'Slightly elevated. Lifestyle modifications recommended.' },
  ],
  recommendations: [
    'Schedule appointment with endocrinologist.',
    'Repeat HbA1c in 3 months.',
    'Start iron supplementation after doctor consultation.',
  ],
  plainSummary:
    'Your blood test shows two main concerns. First, your HbA1c is 7.2%, which is above the normal limit of 5.7%, indicating that your blood sugar has been high over the past 3 months — this suggests your diabetes needs better management. Second, your hemoglobin is 11.2 g/dL, which is lower than normal (13.5-17.5 g/dL), indicating mild anemia. Your cholesterol is slightly elevated at 215 mg/dL but not critically high. The rest of your values are within normal range.',
};

export const mockReports = [
  { id: 'rep_001', date: '2026-05-23', type: 'CBC', abnormalCount: 3, urgency: 'moderate' },
  { id: 'rep_002', date: '2026-04-28', type: 'HbA1c Panel', abnormalCount: 1, urgency: 'moderate' },
  { id: 'rep_003', date: '2026-02-01', type: 'CBC', abnormalCount: 1, urgency: 'low' },
];
