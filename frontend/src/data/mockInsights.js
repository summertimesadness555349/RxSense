// TODO: Replace with API call — GET /api/insights/:userId
export const mockHealthScore = {
  score: 68,
  maxScore: 100,
  dataPoints: 8,
  periodMonths: 4,
  color: '#f59e0b',
  label: 'Moderate',
};

export const mockTrendAlerts = [
  {
    id: 'ins_001',
    type: 'danger',
    icon: '📈',
    title: 'HbA1c Rising Trend',
    body: 'Your HbA1c has increased from 6.5% → 6.8% → 7.2% over the last 4 months. This suggests your diabetes is not well-controlled despite Metformin.',
    action: 'Discuss with your doctor about adjusting medication or diet.',
    linkedParameter: 'HbA1c',
    trendValues: [
      { date: 'Feb 2026', value: '6.5%' },
      { date: 'Apr 2026', value: '6.8%' },
      { date: 'May 2026', value: '7.2%' },
    ],
  },
  {
    id: 'ins_002',
    type: 'warning',
    icon: '📉',
    title: 'Hemoglobin Slowly Improving',
    body: 'Hemoglobin went from 10.8 → 11.2 after starting iron supplements. Continue current supplementation.',
    action: 'Keep taking Iron Supplement daily. Retest in 2 months.',
    trendValues: [
      { date: 'Dec 2025', value: '10.8 g/dL' },
      { date: 'May 2026', value: '11.2 g/dL' },
    ],
  },
  {
    id: 'ins_003',
    type: 'success',
    icon: '❤️',
    title: 'Blood Pressure Stable',
    body: 'Last 3 readings are within normal range. No signs of hypertension despite family history.',
    action: 'Continue monitoring blood pressure monthly.',
    trendValues: [],
  },
  {
    id: 'ins_004',
    type: 'info',
    icon: '🧠',
    title: 'Pattern Detected — Headaches',
    body: 'You have reported headaches 3 times in the last 6 weeks, often coinciding with skipped Metformin doses.',
    action: 'Possible correlation with medication adherence. Discuss with doctor.',
    trendValues: [],
  },
];

export const mockRiskBreakdown = [
  { label: 'Diabetes Risk', percentage: 82, color: '#ef4444', level: 'High' },
  { label: 'Cardiovascular Risk', percentage: 45, color: '#f59e0b', level: 'Moderate' },
  { label: 'Anemia Risk', percentage: 38, color: '#f59e0b', level: 'Moderate' },
  { label: 'Overall Complication Risk', percentage: 55, color: '#f59e0b', level: 'Moderate' },
];

export const mockRecommendedActions = [
  { id: 'ra_001', action: 'Repeat HbA1c test by August 2026', priority: 'high', dueDate: '2026-08-01' },
  { id: 'ra_002', action: 'Schedule endocrinologist visit', priority: 'high', dueDate: null },
  { id: 'ra_003', action: 'Continue iron supplementation for 3 more months, then retest hemoglobin', priority: 'medium', dueDate: '2026-08-18' },
  { id: 'ra_004', action: 'Start tracking daily blood sugar readings', priority: 'medium', dueDate: null },
];

export const mockDoctorSummary = {
  generatedDate: '2026-05-23',
  patientName: 'Rahim Uddin',
  age: 38,
  bloodGroup: 'B+',
  activeConditions: ['Type 2 Diabetes (since 2023)', 'Mild Anemia (since 2025)', 'Gastritis (since 2026)'],
  currentMedications: ['Metformin 500mg — 2x daily', 'Iron Supplement (Ferrous Sulfate) 200mg — 1x daily'],
  criticalAllergies: ['Penicillin (Severe — Anaphylaxis)'],
  recentReports: 'HbA1c: 7.2% (May 2026) — Elevated. Hemoglobin: 11.2 g/dL (May 2026) — Low.',
  keyInsights: 'HbA1c rising trend over 4 months (6.5% → 7.2%). Hemoglobin improving with iron supplementation.',
  emergencyContact: 'Farida Uddin — +8801798765432',
};
