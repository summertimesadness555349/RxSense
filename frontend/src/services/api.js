import axios from 'axios';
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

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Axios instance for JSON endpoints
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rxsense_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalise a backend user object to the shape the UI expects
const normaliseUser = (backendUser, fallbackName = '') => ({
  id: backendUser.id,
  name: backendUser.full_name || fallbackName || backendUser.username,
  email: backendUser.email,
  username: backendUser.username,
  role: 'patient',
  avatar_url: backendUser.avatar_url || null,
  subscription_type: backendUser.subscription_type,
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

// POST /api/auth/login
export const login = async (email, password) => {
  try {
    const res = await api.post('/auth/login', { identifier: email, password });
    const data = res.data;
    if (!data.success) throw new Error(data.error || 'Login failed');
    return {
      user: normaliseUser(data.user),
      token: data.tokens.accessToken,
    };
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Login failed');
  }
};

// POST /api/auth/register
export const register = async (userData) => {
  try {
    // Backend requires a unique username — derive from full name + timestamp tail
    const username =
      userData.name.toLowerCase().replace(/\s+/g, '_') +
      '_' +
      Date.now().toString().slice(-4);

    const res = await api.post('/auth/register', {
      username,
      email: userData.email,
      password: userData.password,
    });
    const data = res.data;
    if (!data.success) throw new Error(data.error || 'Registration failed');

    // Email verification required — no token returned yet
    if (data.user?.requires_verification) {
      throw new Error('Account created! Please check your email to verify before logging in.');
    }

    return {
      user: normaliseUser(data.user, userData.name),
      token: data.tokens.accessToken,
    };
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Registration failed');
  }
};

// ─── Prescription ─────────────────────────────────────────────────────────────

// POST /api/prescription/analyze
export const analyzePrescription = async (imageFile) => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);

    const token = localStorage.getItem('rxsense_token');
    const res = await axios.post(`${BASE_URL}/api/prescription/analyze`, formData, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      // Do NOT set Content-Type — axios sets multipart boundary automatically
    });

    const data = res.data;
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

    const diseaseList = (data.diseases || []).join(', ');
    const testList = (data.tests || []).join(', ');
    const explanation =
      medications.length > 0
        ? `Your prescription contains ${medications.length} medication${medications.length !== 1 ? 's' : ''}: ` +
          `${medications.map((m) => m.name).join(', ')}.` +
          (diseaseList ? ` Diagnosed condition: ${diseaseList}.` : '') +
          (testList ? ` Required tests: ${testList}.` : '') +
          ` Consult your doctor or pharmacist if you have any questions.`
        : 'No medications could be detected. Please ensure the image is clear and well-lit, then try again.';

    return {
      confidence: avgConf,
      date: new Date().toLocaleDateString('en-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      doctor: 'From your prescription',
      hospital: data.vlm_available ? 'Analyzed by MedGemma + EasyOCR' : 'Analyzed by EasyOCR',
      medications,
      diseases: data.diseases || [],
      tests: data.tests || [],
      explanation,
      warnings,
    };
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Analysis failed');
  }
};

// ─── Remaining endpoints (mocked until backend routes exist) ──────────────────

// POST /api/report/analyze
export const analyzeReport = async (file, reportType) => {
  await delay(2500);
  return mockReportResult;
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
  await delay(500);
  return mockUser;
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
