// TODO: Replace with API call — GET /api/symptoms/history
export const mockConversation = [
  {
    id: 'msg_001',
    role: 'ai',
    type: 'text',
    content: "Hi! I'm RxSense. Tell me about your symptoms, and I'll help you understand what might be going on. ⚕️ Remember: this is NOT a medical diagnosis.",
    timestamp: '2026-05-15T16:30:00',
  },
  {
    id: 'msg_002',
    role: 'user',
    type: 'text',
    content: "I've been having headaches for 3 days and feeling dizzy.",
    timestamp: '2026-05-15T16:31:00',
  },
  {
    id: 'msg_003',
    role: 'ai',
    type: 'analysis',
    timestamp: '2026-05-15T16:31:10',
    content: 'Based on your symptoms (persistent headache + dizziness), here are possible causes:',
    possibleConditions: [
      { name: 'Tension Headache', match: 72, description: 'Most common type, often caused by stress or muscle tension.' },
      { name: 'Dehydration', match: 65, description: 'Insufficient fluid intake can cause headache and dizziness.' },
      { name: 'Migraine', match: 58, description: 'Neurological condition causing severe headache, sometimes with dizziness.' },
      { name: 'Hypertension', match: 45, description: 'High blood pressure can cause headache and dizziness — important to rule out given your history.' },
    ],
    recommendations: [
      'Monitor blood pressure if possible',
      'Stay hydrated — drink at least 8 glasses of water',
      'Rest in a quiet, dark room if headache is severe',
      'If headache persists >5 days or is severe, visit a doctor immediately',
    ],
    urgency: 'moderate',
    urgencyMessage: 'Monitor for 48 hours',
    seeDoctorIf: [
      'Vision changes or blurred vision',
      'Neck stiffness',
      'Fever above 102°F (39°C)',
      'Sudden severe "thunderclap" headache',
      'Confusion or difficulty speaking',
    ],
  },
];

export const quickSymptomChips = [
  'Headache', 'Fever', 'Chest Pain', 'Fatigue', 'Cough',
  'Stomach Pain', 'Dizziness', 'Skin Rash', 'Shortness of Breath', 'Nausea',
];
