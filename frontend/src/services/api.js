// TODO: Replace all mock returns with actual API calls to backend
import { mockPrescriptionResult } from '../data/mockPrescriptions.js';
import { mockTimeline } from '../data/mockTimeline.js';
import { mockUser } from '../data/mockUser.js';
import { mockCurrentMedications, mockPastMedications } from '../data/mockMedications.js';
import { mockDocuments } from '../data/mockDocuments.js';
import {
  mockHealthScore,
  mockTrendAlerts,
  mockRiskBreakdown,
  mockRecommendedActions,
  mockDoctorSummary,
} from '../data/mockInsights.js';
import { mockFamilyMembers, mockHereditaryRisks, mockGeneticRiskScores } from '../data/mockFamilyHistory.js';
import { mockConversation } from '../data/mockConversations.js';
import { mockDrugInteractionResult } from '../data/mockDrugInteractions.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const getAccessToken = () => {
  const appToken = localStorage.getItem('rxsense_token');
  if (appToken) return appToken;

  const accessToken = localStorage.getItem('rxsense_access_token');
  if (accessToken) return accessToken;

  try {
    const stored = JSON.parse(localStorage.getItem('rxsense_user') || '{}');
    return stored?.token || stored?.tokens?.accessToken || null;
  } catch {
    return null;
  }
};

const request = async (path, options = {}) => {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  return data;
};

// POST /api/prescription/analyze
export const analyzePrescription = async (imageFile) => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);

    const data = await request('/api/prescription/analyze', {
      method: 'POST',
      body: formData,
    });

    if (!data.success) throw new Error(data.error || 'Analysis failed');

    const drugs = data.drugs || [];

    // Map confidence string → percentage for the UI gauge
    const confMap = { high: 100, medium: 70, low: 30 };
    const avgConf =
      drugs.length > 0
        ? Math.round(
            drugs.reduce((s, d) => s + (confMap[d.confidence] ?? 50), 0) / drugs.length
          )
        : 0;

    const medications = drugs.map((d, i) => ({
      id: i + 1,
      name: d.matched_brand || d.extracted_name,
      generic:      d.generic      || null,
      dosage:       d.dosage_from_prescription || d.strength || null,
      frequency:    d.frequency    || null,
      duration:     d.duration     || null,
      instructions: d.instructions || null,
    }));

    const warnings = (data.needs_review || []).map((d) => ({
      type: 'warning',
      message: `"${d.extracted_name}" matched with low confidence — please verify with your pharmacist.`,
    }));

    if (!data.vlm_available) {
      warnings.push({
        type: 'info',
        message: 'Advanced AI vision unavailable — results based on OCR only and may be less accurate.',
      });
    }

    const diseases = data.diseases || [];
    const tests    = data.tests    || [];
    const patient  = data.patient  || null;
    const doctor   = data.doctor   || null;
    const hospital = data.hospital || null;

    const diseaseList = diseases.join(', ');
    const testList    = tests.join(', ');
    const explanation =
      medications.length > 0
        ? `Prescribed ${medications.length} medication${medications.length !== 1 ? 's' : ''}: ` +
          `${medications.map((m) => m.name).join(', ')}.` +
          (diseaseList ? ` Diagnosis: ${diseaseList}.` : '') +
          (testList    ? ` Required tests: ${testList}.` : '') +
          ` Consult your doctor or pharmacist if you have any questions.`
        : 'No medications could be detected. Please ensure the image is clear and well-lit, then try again.';

    const rxDate = data.date
      ? new Date(data.date).toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' });

    return {
      confidence: avgConf,
      date:       rxDate,
      patient,
      doctor,
      hospital,
      notes:    data.notes    || null,
      followUp: data.followUp || null,
      medications,
      diseases,
      tests,
      explanation,
      warnings,
    };
  } catch (err) {
    throw new Error(err.message || 'Analysis failed');
  }
};

// ─── Remaining endpoints (mocked until backend routes exist) ──────────────────

// POST /api/report/analyze
export const analyzeReport = async (file, reportType) => {
  const formData = new FormData();
  formData.append('report', file);
  formData.append('reportType', reportType);

  try {
    const storedUser = JSON.parse(localStorage.getItem('rxsense_user') || '{}');
    const patientId = storedUser.patient_id || storedUser.uuid;
    if (patientId) formData.append('patientId', patientId);
  } catch {
    // Optional patient ID only; backend can still analyze without saving.
  }

  const data = await request('/api/patient/reports/analyze', {
    method: 'POST',
    body: formData,
  });

  // Backend now returns { success, reportRecord, savedMetrics }
  // Return the full payload so callers can adapt to the new shape.
  return data;
};

// POST /api/symptoms/check
export const checkSymptoms = async (symptomsText) => {
  await delay(1500);
  return mockConversation[2];
};

// POST /api/drugs/interactions
export const checkDrugInteractions = async (drugList) => {
  await delay(1500);
  return mockDrugInteractionResult;
};

// GET /api/timeline/:userId
export const getTimeline = async (userId, filters = {}) => {
  await delay(800);
  let entries = [...mockTimeline];
  if (filters.type && filters.type !== 'all')
    entries = entries.filter((e) => e.type === filters.type);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    entries = entries.filter(
      (e) => e.title.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q)
    );
  }
  return entries;
};

// POST /api/timeline/:userId/entry
export const addTimelineEntry = async (userId, entry) => {
  await delay(800);
  return { ...entry, id: `tl_${Date.now()}`, date: new Date().toISOString() };
};

// GET /api/user/:userId/profile
export const getHealthProfile = async (userId) => {
  const data = await request('/patient/me');
  return data.user || null;
};

// PUT /api/user/:userId/profile
export const updateHealthProfile = async (userId, data) => {
  await delay(800);
  return { ...mockUser, ...data };
};

// GET /api/medications/:userId
export const getMedications = async (userId) => {
  await delay(600);
  return { current: mockCurrentMedications, past: mockPastMedications };
};

// POST /api/medications/:userId
export const addMedication = async (userId, med) => {
  await delay(800);
  return { ...med, id: `med_${Date.now()}`, status: 'active' };
};

// PUT /api/medications/:userId/:medId
export const updateMedication = async (userId, medId, data) => {
  await delay(600);
  return { id: medId, ...data };
};

// GET /api/documents/:userId
export const getDocuments = async (userId) => {
  await delay(600);
  return mockDocuments;
};

// POST /api/documents/:userId
export const uploadDocument = async (userId, file, metadata) => {
  await delay(1500);
  return { id: `doc_${Date.now()}`, filename: file.name, ...metadata };
};

// GET /api/insights/:userId
export const getInsights = async (userId) => {
  await delay(800);
  return {
    healthScore: mockHealthScore,
    trendAlerts: mockTrendAlerts,
    riskBreakdown: mockRiskBreakdown,
    recommendedActions: mockRecommendedActions,
  };
};

// GET /api/family/:userId
export const getFamilyHistory = async (userId) => {
  await delay(600);
  return {
    members: mockFamilyMembers,
    risks: mockHereditaryRisks,
    geneticScores: mockGeneticRiskScores,
  };
};

// POST /api/family/:userId/member
export const addFamilyMember = async (userId, member) => {
  await delay(800);
  return { ...member, id: `fam_${Date.now()}` };
};

// POST /api/insights/:userId/doctor-summary
export const generateDoctorSummary = async (userId) => {
  await delay(2000);
  return mockDoctorSummary;
};

// POST /api/insights/:userId/emergency-card
export const generateEmergencyCard = async (userId) => {
  await delay(1000);
  return { shareUrl: 'https://rxsense.app/emergency/usr_001', expiresIn: '24 hours' };
};

// POST /api/auth/login
// export const login = async (email, password) => {
//   // TODO: Replace with actual API call to backend
//   await delay(1000);
//   if (email && password) {
//     return {
//       token: 'mock_token_abc123',
//       user: {
//         id: 'usr_001',
//         name: 'Rahim Uddin',
//         email: 'rahim@example.com',
//         role: 'patient',
//       },
//     };
//   }
//   throw new Error('Invalid credentials');
// };

export const login = async (email, password) => {
  const data = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });

  const token = data.tokens?.accessToken || data.token || null;
  const user = data.user || null;
  if (!token) throw new Error('Login succeeded but no access token was returned');

  return { token, user, raw: data };
};

// POST /api/auth/register
export const register = async (userData) => {
  const payload = {
    name: userData.name,
    email: userData.email,
    password: userData.password,
    phone: userData.phone,
    role: userData.role === 'healthworker' ? 'doctor' : (userData.role || 'patient'),
  };

  try {
    const data = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const token = data.tokens?.accessToken || data.token || null;
    const user = data.user || null;

    return { token, user, raw: data };
  } catch (err) {
    const msg = err.message || 'Registration failed';
    throw new Error(msg);
  }
};
