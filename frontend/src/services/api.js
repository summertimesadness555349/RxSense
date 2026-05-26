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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const getAccessToken = () => {
  const directToken = localStorage.getItem('rxsense_access_token');
  if (directToken) return directToken;

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
  // TODO: Replace with actual API call to backend
  await delay(2500);
  return mockPrescriptionResult;
};

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

  const data = await request('/patient/reports/analyze', {
    method: 'POST',
    body: formData,
  });

  return data.report;
};

// POST /api/symptoms/check
export const checkSymptoms = async (symptomsText) => {
  // TODO: Replace with actual API call to backend
  await delay(1500);
  return mockConversation[2]; // Return AI analysis message
};

// POST /api/drugs/interactions
export const checkDrugInteractions = async (drugList) => {
  // TODO: Replace with actual API call to backend
  await delay(1500);
  return mockDrugInteractionResult;
};

// GET /api/timeline/:userId
export const getTimeline = async (userId, filters = {}) => {
  // TODO: Replace with actual API call to backend
  await delay(800);
  let entries = [...mockTimeline];
  if (filters.type && filters.type !== 'all') {
    entries = entries.filter((e) => e.type === filters.type);
  }
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
  // TODO: Replace with actual API call to backend
  await delay(800);
  return { ...entry, id: `tl_${Date.now()}`, date: new Date().toISOString() };
};

// GET /api/user/:userId/profile
export const getHealthProfile = async (userId) => {
  // TODO: Replace with actual API call to backend
  await delay(500);
  return mockUser;
};

// PUT /api/user/:userId/profile
export const updateHealthProfile = async (userId, data) => {
  // TODO: Replace with actual API call to backend
  await delay(800);
  return { ...mockUser, ...data };
};

// GET /api/medications/:userId
export const getMedications = async (userId) => {
  // TODO: Replace with actual API call to backend
  await delay(600);
  return { current: mockCurrentMedications, past: mockPastMedications };
};

// POST /api/medications/:userId
export const addMedication = async (userId, med) => {
  // TODO: Replace with actual API call to backend
  await delay(800);
  return { ...med, id: `med_${Date.now()}`, status: 'active' };
};

// PUT /api/medications/:userId/:medId
export const updateMedication = async (userId, medId, data) => {
  // TODO: Replace with actual API call to backend
  await delay(600);
  return { id: medId, ...data };
};

// GET /api/documents/:userId
export const getDocuments = async (userId) => {
  // TODO: Replace with actual API call to backend
  await delay(600);
  return mockDocuments;
};

// POST /api/documents/:userId
export const uploadDocument = async (userId, file, metadata) => {
  // TODO: Replace with actual API call to backend
  await delay(1500);
  return { id: `doc_${Date.now()}`, filename: file.name, ...metadata };
};

// GET /api/insights/:userId
export const getInsights = async (userId) => {
  // TODO: Replace with actual API call to backend
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
  // TODO: Replace with actual API call to backend
  await delay(600);
  return { members: mockFamilyMembers, risks: mockHereditaryRisks, geneticScores: mockGeneticRiskScores };
};

// POST /api/family/:userId/member
export const addFamilyMember = async (userId, member) => {
  // TODO: Replace with actual API call to backend
  await delay(800);
  return { ...member, id: `fam_${Date.now()}` };
};

// POST /api/insights/:userId/doctor-summary
export const generateDoctorSummary = async (userId) => {
  // TODO: Replace with actual API call to backend
  await delay(2000);
  return mockDoctorSummary;
};

// POST /api/insights/:userId/emergency-card
export const generateEmergencyCard = async (userId) => {
  // TODO: Replace with actual API call to backend
  await delay(1000);
  return { shareUrl: 'https://rxsense.app/emergency/usr_001', expiresIn: '24 hours' };
};

// POST /api/auth/login
export const login = async (email, password) => {
  const data = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });

  const user = data.user || {};
  const accessToken = data.tokens?.accessToken;
  if (accessToken) localStorage.setItem('rxsense_access_token', accessToken);

  return {
    token: accessToken,
    tokens: data.tokens,
    user: {
      ...user,
      patient_id: user.patient_id || user.uuid || user.id,
      name: user.name || user.full_name || user.username || user.email,
      role: user.role || 'patient',
      tokens: data.tokens,
    },
  };
};

// POST /api/auth/register
export const register = async (userData) => {
  // TODO: Replace with actual API call to backend
  await delay(1200);
  return {
    token: 'mock_token_new123',
    user: {
      id: `usr_${Date.now()}`,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'patient',
    },
  };
};
