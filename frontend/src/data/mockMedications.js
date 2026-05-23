// TODO: Replace with API call — GET /api/medications/:userId
export const mockCurrentMedications = [
  {
    id: 'med_001',
    name: 'Metformin',
    dosage: '500mg',
    frequency: '2x daily',
    timing: ['8:00 AM', '8:00 PM'],
    startDate: '2026-03-15',
    prescribedBy: 'Dr. Karim Ahmed',
    purpose: 'Blood sugar control (Type 2 Diabetes)',
    reminderEnabled: true,
    refillDaysRemaining: 5,
    status: 'active',
  },
  {
    id: 'med_002',
    name: 'Iron Supplement (Ferrous Sulfate)',
    dosage: '200mg',
    frequency: '1x daily',
    timing: ['Morning'],
    startDate: '2026-05-18',
    prescribedBy: 'Dr. Karim Ahmed',
    purpose: 'Anemia — Iron Deficiency',
    reminderEnabled: false,
    refillDaysRemaining: 30,
    status: 'active',
  },
];

export const mockPastMedications = [
  {
    id: 'med_003',
    name: 'Metformin',
    dosage: '250mg',
    frequency: '1x daily',
    startDate: '2023-06-01',
    endDate: '2026-03-15',
    stoppedReason: 'Dosage increased to 500mg — blood sugar not adequately controlled',
    prescribedBy: 'Dr. Karim Ahmed',
    status: 'stopped',
  },
  {
    id: 'med_004',
    name: 'Amoxicillin',
    dosage: '500mg',
    frequency: '3x daily',
    startDate: '2026-05-20',
    endDate: '2026-05-27',
    stoppedReason: 'Completed 7-day course',
    prescribedBy: 'Dr. Karim Ahmed',
    status: 'completed',
  },
];

export const mockMedicationTimeline = [
  { id: 'med_003', name: 'Metformin 250mg', start: '2023-06-01', end: '2026-03-15', color: '#6b7280' },
  { id: 'med_001', name: 'Metformin 500mg', start: '2026-03-15', end: null, color: '#10b981' },
  { id: 'med_004', name: 'Amoxicillin 500mg', start: '2026-05-20', end: '2026-05-27', color: '#6b7280' },
  { id: 'med_002', name: 'Iron Supplement 200mg', start: '2026-05-18', end: null, color: '#10b981' },
];
