// TODO: Replace with API call — POST /api/drugs/interactions
export const mockDrugInteractionResult = {
  drugs: [
    { id: 'd1', name: 'Metformin', dosage: '500mg' },
    { id: 'd2', name: 'Aspirin', dosage: '75mg' },
    { id: 'd3', name: 'Alcohol', dosage: '-' },
  ],
  interactions: [
    {
      id: 'int_001',
      drug1: 'Metformin',
      drug2: 'Aspirin',
      severity: 'safe',
      title: 'Metformin + Aspirin',
      description: 'No known clinically significant interaction. Safe to take together at these doses.',
      recommendation: 'No action needed.',
    },
    {
      id: 'int_002',
      drug1: 'Metformin',
      drug2: 'Alcohol',
      severity: 'warning',
      title: 'Metformin + Alcohol',
      description: 'Moderate interaction. Alcohol can increase the risk of lactic acidosis with Metformin, especially in large quantities. Also affects blood sugar control.',
      recommendation: 'Limit or avoid alcohol consumption. If you do drink, keep it to a minimum and monitor blood sugar.',
    },
    {
      id: 'int_003',
      drug1: 'Aspirin',
      drug2: 'Warfarin (example)',
      severity: 'danger',
      title: 'Aspirin + Warfarin',
      description: '⛔ SEVERE — Aspirin and Warfarin together significantly increase the risk of serious bleeding. Both drugs affect blood clotting through different mechanisms.',
      recommendation: 'Do NOT combine without strict doctor supervision and close monitoring. Alternative anticoagulants may be safer.',
      isExample: true,
    },
  ],
  matrix: [
    ['', 'Metformin', 'Aspirin', 'Alcohol'],
    ['Metformin', '-', 'safe', 'warning'],
    ['Aspirin', 'safe', '-', 'safe'],
    ['Alcohol', 'warning', 'safe', '-'],
  ],
  summary: {
    safe: 1,
    warning: 1,
    danger: 0,
  },
  dataSource: 'OpenFDA Drug Interaction Database',
};

export const defaultDrugs = [
  { id: 'dd1', name: 'Metformin', dosage: '500mg' },
  { id: 'dd2', name: 'Aspirin', dosage: '75mg' },
];
