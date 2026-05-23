// TODO: Replace with API call — GET /api/family/:userId
export const mockFamilyMembers = [
  {
    id: 'fam_self',
    relation: 'Self',
    name: 'Rahim Uddin',
    age: 38,
    alive: true,
    conditions: [
      { name: 'Type 2 Diabetes', since: '2023' },
      { name: 'Mild Anemia', since: '2025' },
    ],
  },
  {
    id: 'fam_001',
    relation: 'Father',
    name: 'Abdul Uddin',
    age: 68,
    alive: true,
    conditions: [
      { name: 'Hypertension', since: '2010' },
      { name: 'Type 2 Diabetes', since: '2015' },
      { name: 'Heart Attack', since: '2020', notes: 'Survived. On cardiac medications.' },
    ],
  },
  {
    id: 'fam_002',
    relation: 'Mother',
    name: 'Rashida Uddin',
    age: 63,
    alive: true,
    conditions: [
      { name: 'Hypothyroidism', since: '2012' },
      { name: 'Osteoarthritis', since: '2018' },
    ],
  },
  {
    id: 'fam_003',
    relation: 'Brother',
    name: 'Karim Uddin',
    age: 35,
    alive: true,
    conditions: [],
  },
  {
    id: 'fam_004',
    relation: 'Sister',
    name: 'Fatima Uddin',
    age: 31,
    alive: true,
    conditions: [
      { name: 'Gestational Diabetes', since: '2024', notes: 'During pregnancy. Currently resolved.' },
    ],
  },
];

export const mockHereditaryRisks = [
  {
    type: 'danger',
    title: 'Strong Diabetes Family History',
    message: 'Father and sister both have/had diabetes. You already have Type 2 Diabetes. Monitor HbA1c aggressively and maintain strict dietary control.',
  },
  {
    type: 'warning',
    title: 'Cardiovascular Risk',
    message: "Father had a heart attack at age 62. Combined with your diabetes and borderline cholesterol, cardiovascular screening is strongly recommended. Consider an ECG and lipid panel annually.",
  },
  {
    type: 'info',
    title: 'Thyroid Screening Recommended',
    message: "Mother has hypothyroidism. Consider periodic thyroid panel (TSH, T3, T4) screening — thyroid conditions have a hereditary component.",
  },
];

export const mockGeneticRiskScores = [
  { condition: 'Diabetes', percentage: 92, color: '#ef4444' },
  { condition: 'Cardiovascular', percentage: 61, color: '#f59e0b' },
  { condition: 'Thyroid', percentage: 35, color: '#3b82f6' },
];
