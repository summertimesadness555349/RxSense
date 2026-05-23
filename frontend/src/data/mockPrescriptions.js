// TODO: Replace with API call — GET /api/prescriptions
export const mockPrescriptionResult = {
  id: 'rx_001',
  date: '2026-05-20',
  doctor: 'Dr. Karim Ahmed',
  hospital: 'Dhaka Medical College',
  confidence: 94,
  imageUrl: null,
  medications: [
    {
      id: 'm1',
      name: 'Amoxicillin',
      dosage: '500mg',
      frequency: '3x daily',
      duration: '7 days',
      purpose: 'Antibiotic for infection',
      timing: 'After meals',
    },
    {
      id: 'm2',
      name: 'Omeprazole',
      dosage: '20mg',
      frequency: '1x daily (before breakfast)',
      duration: '14 days',
      purpose: 'Stomach acid reducer',
      timing: 'Empty stomach',
    },
    {
      id: 'm3',
      name: 'Paracetamol',
      dosage: '500mg',
      frequency: 'As needed',
      duration: '-',
      purpose: 'Pain/fever relief',
      timing: 'As needed',
    },
  ],
  explanation:
    'Your doctor has prescribed an antibiotic (Amoxicillin) to treat an infection. Take it 3 times a day for 7 days — do not stop early even if you feel better. Omeprazole protects your stomach from acid. Take it before breakfast on an empty stomach. Paracetamol can be taken as needed for pain or fever.',
  warnings: [
    { type: 'danger', message: 'Complete the full antibiotic course — do not stop early.' },
    { type: 'warning', message: 'Avoid dairy products 1 hour before/after Amoxicillin.' },
    { type: 'info', message: 'Omeprazole should be taken 30 minutes before breakfast for best effect.' },
  ],
};

export const mockPrescriptions = [
  { id: 'rx_001', date: '2026-05-20', doctor: 'Dr. Karim', medicationCount: 3, summary: 'Amoxicillin, Omeprazole, Paracetamol' },
  { id: 'rx_002', date: '2026-03-10', doctor: 'Dr. Karim', medicationCount: 2, summary: 'Metformin 500mg, Iron Supplement' },
];
