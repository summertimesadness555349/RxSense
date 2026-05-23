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
  // TODO: Replace with actual API call to backend
  await delay(1000);
  if (email && password) {
    return {
      token: 'mock_token_abc123',
      user: {
        id: 'usr_001',
        name: 'Rahim Uddin',
        email: 'rahim@example.com',
        role: 'patient',
      },
    };
  }
  throw new Error('Invalid credentials');
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
