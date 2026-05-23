// TODO: Replace with API call — GET /api/user/profile
export const mockUser = {
  id: 'usr_001',
  name: 'Rahim Uddin',
  email: 'rahim@example.com',
  phone: '+8801712345678',
  role: 'patient',
  avatar: null,
  dateOfBirth: '1988-03-15',
  age: 38,
  gender: 'Male',
  bloodGroup: 'B+',
  height: 170,
  weight: 72,
  bmi: 24.9,
  emergencyContact: {
    name: 'Farida Uddin',
    phone: '+8801798765432',
    relation: 'Spouse',
  },
  conditions: [
    { id: 'c1', name: 'Type 2 Diabetes', since: '2023', status: 'active', doctor: 'Dr. Karim' },
    { id: 'c2', name: 'Mild Anemia', since: '2025', status: 'active', doctor: 'Dr. Karim' },
    { id: 'c3', name: 'Gastritis', since: '2026', status: 'active', doctor: 'Dr. Karim' },
    { id: 'c4', name: 'Dengue Fever', since: '2022', status: 'resolved', doctor: 'Dr. Rahman' },
  ],
  allergies: [
    { id: 'a1', name: 'Penicillin', type: 'drug', severity: 'severe', reaction: 'Anaphylaxis' },
  ],
  surgeries: [
    { id: 's1', name: 'Appendectomy', year: '2019', facility: 'Dhaka Medical College' },
  ],
  vaccinations: [
    { id: 'v1', name: 'COVID-19 (Pfizer)', dose: 'Dose 1', date: '2022-01-15', facility: 'Dhaka City Health Center' },
    { id: 'v2', name: 'COVID-19 (Pfizer)', dose: 'Dose 2', date: '2022-02-12', facility: 'Dhaka City Health Center' },
    { id: 'v3', name: 'COVID-19 (Pfizer)', dose: 'Booster', date: '2022-08-20', facility: 'Dhaka City Health Center' },
    { id: 'v4', name: 'Hepatitis B', dose: 'Complete Series', date: '2019-06-01', facility: 'Square Hospital' },
  ],
};
