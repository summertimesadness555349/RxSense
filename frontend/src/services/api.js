// TODO: Replace all mock returns with actual API calls to backend
import { mockPrescriptionResult } from '../data/mockPrescriptions.js';
import { mockReportResult } from '../data/mockReports.js';
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
import axios from 'axios';

// const API_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:3000/api';
const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rxsense_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// POST /api/prescription/analyze
export const analyzePrescription = async (imageFile) => {
  // TODO: Replace with actual API call to backend
  await delay(2500);
  return mockPrescriptionResult;
};

// POST /api/report/analyze
export const analyzeReport = async (file, reportType) => {
  // TODO: Replace with actual API call to backend
  await delay(2500);
  return mockReportResult;
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

// GET /api/patient/me
export const getHealthProfile = async (userId) => {
  try {
    const res = await api.get('/patient/me');
    const data = res.data || {};
    if (!data.success) {
      throw new Error(data.error || 'Failed to load health profile');
    }

    return data.user || null;
  } catch (err) {
    const msg = err.response?.data?.error || err.message || 'Failed to load health profile';
    throw new Error(msg);
  }
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
  try {
    const res = await api.post('/auth/login', { identifier: email, password });
    const data = res.data || {};
    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    const token = data.tokens?.accessToken || data.token || null;
    const user = data.user || null;

    return { token, user, raw: data };
  } catch (err) {
    const msg = err.response?.data?.error || err.message || 'Login failed';
    throw new Error(msg);
  }
};

// POST /api/auth/register
export const register = async (userData) => {
  try {
    const res = await api.post('/auth/register', {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      phone: userData.phone,
      role: userData.role === 'healthworker' ? 'doctor' : (userData.role || 'patient'),
    });

    const data = res.data || {};
    if (!data.success) {
      throw new Error(data.error || 'Registration failed');
    }

    const token = data.tokens?.accessToken || data.token || null;
    const user = data.user || null;

    return { token, user, raw: data };
  } catch (err) {
    const msg = err.response?.data?.error || err.message || 'Registration failed';
    throw new Error(msg);
  }
};
