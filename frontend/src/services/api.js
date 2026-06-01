
import { mockPrescriptionResult } from '../data/mockPrescriptions.js';
import { mockUser } from '../data/mockUser.js';
import { mockCurrentMedications, mockPastMedications } from '../data/mockMedications.js';
import { mockDocuments } from '../data/mockDocuments.js';
import { mockFamilyMembers, mockHereditaryRisks, mockGeneticRiskScores } from '../data/mockFamilyHistory.js';
import { mockConversation } from '../data/mockConversations.js';
import { mockDrugInteractionResult } from '../data/mockDrugInteractions.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

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

    const token = getAccessToken();
    const response = await fetch(`${API_BASE_URL}/prescription/analyze`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Analysis failed');

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

    const result = {
      scan_id:    data.scan_id   || null,
      image_url:  data.image_url || null,
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

    // Persist to localStorage prescription history
    savePrescriptionToLocal(result);

    return result;
  } catch (err) {
    throw new Error(err.message || 'Analysis failed');
  }
};

const PRESCRIPTION_HISTORY_KEY = 'rxsense_prescription_history';
const MAX_LOCAL_HISTORY = 30;

function savePrescriptionToLocal(result) {
  try {
    const existing = JSON.parse(localStorage.getItem(PRESCRIPTION_HISTORY_KEY) || '[]');
    const entry = {
      scan_id:     result.scan_id,
      image_url:   result.image_url,
      date:        result.date,
      savedAt:     new Date().toISOString(),
      confidence:  result.confidence,
      doctor:      result.doctor,
      hospital:    result.hospital,
      diseases:    result.diseases,
      tests:       result.tests,
      medications: result.medications,
      notes:       result.notes,
      followUp:    result.followUp,
    };
    const updated = [entry, ...existing].slice(0, MAX_LOCAL_HISTORY);
    localStorage.setItem(PRESCRIPTION_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export const getPrescriptionHistoryLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(PRESCRIPTION_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
};

// GET /api/prescription/history
export const getPrescriptionHistory = async ({ limit = 50, offset = 0 } = {}) => {
  const data = await request(`/prescription/history?limit=${limit}&offset=${offset}`);
  return data.scans || [];
};

// POST /api/prescription/chat
export const chatWithPrescription = async ({ messages, prescription, question }) => {
  const data = await request('/prescription/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, prescription, question }),
  });
  return data; // { reply, drugs_context }
};

// ─── Remaining endpoints (mocked until backend routes exist) ──────────────────

const REPORT_HISTORY_KEY = 'rxsense_report_history';
const MAX_LOCAL_REPORTS  = 20;

function saveReportToLocal(report) {
  try {
    const existing = JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) || '[]');
    const entry = {
      id:                 report.id,
      image_url:          report.image_url,
      type:               report.type,
      date:               report.date,
      savedAt:            new Date().toISOString(),
      facility:           report.facility,
      ordering_doctor:    report.ordering_doctor,
      patient:            report.patient,
      sections:           report.sections,
      overall_impression: report.overall_impression,
      diagnoses:          report.diagnoses,
      recommendations:    report.recommendations,
      clinical_notes:     report.clinical_notes,
      follow_up:          report.follow_up,
    };
    const updated = [entry, ...existing].slice(0, MAX_LOCAL_REPORTS);
    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export const getReportHistoryLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
};

// POST /api/patient/reports/analyze
export const analyzeReport = async (file, reportType) => {
  const formData = new FormData();
  formData.append('report', file);
  formData.append('reportType', reportType);

  try {
    const storedUser = JSON.parse(localStorage.getItem('rxsense_user') || '{}');
    const patientId = storedUser.patient_id || storedUser.uuid;
    if (patientId) formData.append('patientId', patientId);
  } catch {
    // Optional — backend analyzes without saving if no patientId
  }

  const data = await request('/patient/reports/analyze', {
    method: 'POST',
    body: formData,
  });

  const dbReport = data.report || {};

  const mapDbReportToUi = (db) => {
    if (!db) return null;
    const fmtDate = (raw) => {
      if (!raw) return null;
      try {
        const d = new Date(raw);
        return isNaN(d) ? String(raw) : d.toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch {
        return String(raw);
      }
    };

    const type = db.type || db.report_type || null;
    const date = fmtDate(db.report_date || db.date);
    const image_url = db.image_url || db.imageUrl || null;

    const sections = (Array.isArray(db.sections) && db.sections.length > 0)
      ? db.sections.map((s) => ({
          title: s.title || s.name || '',
          type: s.type || 'other',
          narrative: s.narrative || null,
          entries: (s.entries || []).map((e) => ({
            label: e.label || e.parameterName || e.parameter_name || e.name || '',
            value: e.value ?? null,
            unit: e.unit || null,
            reference_range: e.reference_range || e.referenceRange || null,
            flag: e.flag || null,
            status: e.status || null,
            note: e.note || null,
          })),
        }))
      : (Array.isArray(db.metrics) && db.metrics.length > 0)
        ? [{
            title: 'Results',
            type: 'lab_results',
            narrative: null,
            entries: db.metrics.map((m) => ({
              label: m.parameterName || m.parameter_name || '',
              value: m.value ?? null,
              unit: m.unit || null,
              reference_range: m.referenceRange || m.reference_range || null,
              flag: null,
              status: m.status || null,
            })),
          }]
        : [];

    return {
      id: db.report_id || db.id || null,
      image_url,
      type,
      date,
      facility: db.facility || null,
      ordering_doctor: db.ordering_doctor || db.orderingDoctor || null,
      patient: db.patient || {},
      sections,
      overall_impression: db.overall_impression || db.impression || null,
      diagnoses: Array.isArray(db.diagnoses) ? db.diagnoses : (db.diagnoses ? [db.diagnoses] : []),
      recommendations: Array.isArray(db.recommendations) ? db.recommendations : (db.recommendations ? [db.recommendations] : []),
      clinical_notes: db.clinical_notes || db.clinicalNotes || null,
      follow_up: db.follow_up || db.followUp || null,
    };
  };

  const report = mapDbReportToUi(dbReport);
  saveReportToLocal(report);
  return report;
};

// POST /api/patient/reports/chat
export const chatWithReport = async ({ messages, report, question }) => {
  const data = await request('/patient/reports/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, report, question }),
  });
  return data; // { reply }
};

// POST /api/symptoms/check
// POST /api/symptom/check
// messages = prior [ { role: 'user'|'ai', content } ] for conversation context
export const checkSymptoms = async (question, messages = []) => {
  const data = await request('/symptom/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, messages }),
  });
  return { reply: data.reply, emergency: data.emergency || null };
};

// POST /api/drugs/interactions
export const checkDrugInteractions = async (drugList) => {
  // Expecting drugList: [{ id?, name, dosage? }, ...]
  try {

    const payload = { drugs: (Array.isArray(drugList) ? drugList : []).map(d => ({ name: d.name || d })) };
    const data = await request('/drugs/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },

// ─── Doctor Appointments ───────────────────────────────────────────────

      body: JSON.stringify(payload),
    });

    // Map backend shape to frontend expected shape
    const canonical = data.canonical || [];

    const matrix = data.matrix || [];
    const summary = data.summary || { safe: 0, warning: 0, danger: 0 };

    const inputs = payload.drugs.map(d => d.name);
    const names = canonical.length ? canonical : inputs;

    const drugs = names.map((n, idx) => ({
      id: `d${idx+1}`,
      name: n,
      inputName: inputs[idx] || n,
      dosage: drugList[idx]?.dosage || '',
    }));

    const interactions = (data.interactions || []).map((it) => {

      const aInput = (drugs.find(d => d.name.toLowerCase() === it.drugA.toLowerCase()) || {}).inputName || it.drugA;
      const bInput = (drugs.find(d => d.name.toLowerCase() === it.drugB.toLowerCase()) || {}).inputName || it.drugB;
      return {
        id: it.id || `${it.drugA}_${it.drugB}`,
        drug1: it.drugA,
        drug2: it.drugB,

        drug1_input: aInput,
        drug2_input: bInput,
        severity: it.category || (it.severity || 'warning'),
        title: `${it.drugA} (${aInput}) + ${it.drugB} (${bInput})`,
        description: it.description || '',
        recommendation: null,

      };
    });

    return {
      drugs,
      interactions,

      matrix,
      summary,
      dataSource: data.dataSource || 'Local drug interactions database',
    };
  } catch (err) {
    // Fallback to mock data on error
    await delay(500);
    return mockDrugInteractionResult;
  }
};

// GET /api/timeline/:userId
export const getTimeline = async (userId, filters = {}) => {
  if (!userId) return [];

  const params = new URLSearchParams();
  if (filters.limit) params.set('limit', filters.limit);

  const query = params.toString();
  const data = await request(`/patient/timeline${query ? `?${query}` : ''}`);
  let entries = data.timeline || [];

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

// GET /api/patient/me/documents  — medical reports + prescription scans
export const getPatientDocuments = async () => {
  const data = await request('/patient/me/documents');
  return { reports: data.reports || [], prescriptions: data.prescriptions || [] };
};

// GET /api/patient/me/health-summary  — profile + latest lab metrics
export const getHealthSummary = async () => {
  const data = await request('/patient/me/health-summary');
  return { profile: data.profile || null, metrics: data.metrics || [] };
};

export const getPatientActiveMedications = async () => {
  const data = await request('/patient/me/active-medications');
  return data.medications || [];
};

// PUT /api/patient/me  — update vitals / demographics
export const updatePatientProfile = async (payload) => {
  const data = await request('/patient/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.user || null;
};

// PUT /api/user/:userId/profile (legacy mock — kept for compatibility)
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

// GET /api/insights  (?force=true to bypass cache)
export const getInsights = async ({ force = false } = {}) => {
  const data = await request(`/insights${force ? '?force=true' : ''}`);
  const hs   = data.health_score || {};
  return {
    cached:       data.cached ?? false,
    generatedAt:  data.generated_at ?? null,
    healthScore: {
      score:        hs.score        ?? 50,
      label:        hs.label        ?? 'Moderate',
      dataPoints:   hs.data_points  ?? 0,
      periodMonths: hs.period_months ?? 0,
      maxScore:     100,
    },
    trendAlerts: (data.trend_alerts || []).map((a, i) => ({
      ...a,
      id:          a.id          || `ins_${String(i + 1).padStart(3, '0')}`,
      trendValues: (a.trend_values || []),
    })),
    riskBreakdown: (data.risk_breakdown || []),
    recommendedActions: (data.recommended_actions || []).map((a, i) => ({
      ...a,
      id:      a.id       || `ra_${String(i + 1).padStart(3, '0')}`,
      dueDate: a.due_date || null,
    })),
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

// ── Places / Nearby ───────────────────────────────────────────────────────

// GET /api/places/nearby
export const searchNearby = async (lat, lng, { type = 'hospital', keyword = '', radius = 5000 } = {}) => {
  const params = new URLSearchParams({ lat, lng, type, keyword, radius });
  const data = await request(`/places/nearby?${params}`);
  return data.places || [];
};

// POST /api/places/infer-specialty
export const inferSpecialty = async (condition) => {
  const data = await request('/places/infer-specialty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ condition }),
  });
  return { specialty: data.specialty, keyword: data.keyword };
};

// GET /api/places/geocode
export const geocodeAddress = async (address) => {
  const params = new URLSearchParams({ address });
  const data = await request(`/places/geocode?${params}`);
  return data; // { success, lat, lng, label }
};

// ── Family Network ─────────────────────────────────────────────────────────

// GET /api/family/my-code
export const getFamilyShareCode = async () => {
  const data = await request('/family/my-code');
  return data.code;
};

// POST /api/family/my-code/regenerate
export const regenerateFamilyShareCode = async () => {
  const data = await request('/family/my-code/regenerate', { method: 'POST' });
  return data.code;
};

// POST /api/family/lookup  { code }
export const lookupFamilyCode = async (code) => {
  const data = await request('/family/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return data.preview;
};

// POST /api/family/link  { code, relationship }
export const linkFamilyMember = async (code, relationship) => {
  const data = await request('/family/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, relationship }),
  });
  return data.link;
};

// GET /api/family/members
export const getFamilyMembers = async () => {
  const data = await request('/family/members');
  return data.members;
};

// GET /api/family/members/:linkId/health
export const getFamilyMemberHealth = async (linkId) => {
  const data = await request(`/family/members/${linkId}/health`);
  return data.health;
};

// DELETE /api/family/link/:linkId
export const removeFamilyLink = async (linkId) => {
  await request(`/family/link/${linkId}`, { method: 'DELETE' });
};

// POST /api/insights/patient-summary — warm Bangla bullet-point health narrative
export const getPatientSummary = async () => {
  const data = await request('/insights/patient-summary', { method: 'POST' });
  const s = data.summary || {};
  return {
    headline: s.headline  || '',
    sections: s.sections  || [],
  };
};

// POST /api/insights/doctor-summary
export const generateDoctorSummary = async () => {
  const data = await request('/insights/doctor-summary', { method: 'POST' });
  const s    = data.summary || {};
  return {
    generatedDate:      s.generated_date      || new Date().toISOString().slice(0, 10),
    patientName:        s.patient_name        || 'Unknown',
    age:                s.age                 ?? null,
    bloodGroup:         s.blood_group         || null,
    activeConditions:   s.active_conditions   || [],
    currentMedications: s.current_medications || [],
    criticalAllergies:  s.critical_allergies  || [],
    recentReports:      s.recent_reports      || '',
    keyInsights:        s.key_insights        || '',
    emergencyContact:   s.emergency_contact   || 'Not provided',
  };
};

// POST /api/insights/:userId/emergency-card
export const generateEmergencyCard = async (userId) => {
  await delay(1000);
  return { shareUrl: 'https://rxsense.app/emergency/usr_001', expiresIn: '24 hours' };
};


export const login = async (email, password) => {
  const data = await request('/auth/login', {
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
  try {
    const data = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     userData.name,
        email:    userData.email,
        password: userData.password,
        phone:    userData.phone || '',
        role:     userData.role === 'healthworker' ? 'doctor' : (userData.role || 'patient'),
      }),
    });

    if (data.user?.requires_verification) {
      throw new Error('Account created! Please check your email to verify before logging in.');
    }

    const token = data.tokens?.accessToken || data.token || null;
    const user = data.user || null;

    return { token, user, raw: data };
  } catch (err) {
    const msg = err.message || 'Registration failed';
    throw new Error(msg);
  }
};

// ─── Doctor APIs ──────────────────────────────────────────────────────────

export const doctorLogin = async (identifier, password) => {
  const data = await request('/doctor/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const token = data.tokens?.accessToken || data.token || null;
  const doctor = data.doctor || null;
  if (!token) throw new Error('Login succeeded but no access token was returned');
  return { token, user: { ...doctor, role: 'doctor', id: doctor.doctor_id }, raw: data };
};

export const doctorRegister = async (doctorData) => {
  const data = await request('/doctor/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doctorData),
  });
  return data;
};

export const getDoctorProfile = async (doctorId) => {
  const data = await request(`/doctor/get-profile/${doctorId}`);
  return data.doctor || null;
};

export const updateDoctorProfile = async (doctorId, profileData) => {
  const data = await request(`/doctor/update-profile/${doctorId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData),
  });
  return data.doctor || null;
};

export const updateDoctorDailyLimit = async (dailyPatientLimit) => {
  const data = await request('/doctor/limits', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyPatientLimit }),
  });
  return { doctor: data.doctor || null, effectiveDate: data.effectiveDate || null };
};

export const getDoctorAvailability = async (date) => {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const data = await request(`/doctor/availability${query}`);
  return data.availability || null;
};

export const setDoctorAvailability = async (payload) => {
  const data = await request('/doctor/availability', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { availability: data.availability || null, message: data.message || null };
};

export const changeDoctorPassword = async (doctorId, passwords) => {
  const data = await request(`/doctor/change-password/${doctorId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(passwords),
  });
  return data;
};

export const getHospitalsList = async () => {
  const data = await request('/doctor/hospitals-list');
  return data.hospitals || [];
};

export const addDoctorAffiliation = async (doctorId, affiliationData) => {
  const data = await request(`/doctor/hospitals/${doctorId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(affiliationData),
  });
  return data.affiliation || null;
};

export const getDoctorAffiliations = async (doctorId) => {
  const data = await request(`/doctor/hospitals/${doctorId}`);
  return data.affiliations || [];
};

export const getDoctorPatients = async (doctorId, date) => {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const data = await request(`/doctor/patients${query}`);
  return data.patients || [];
};

export const getDoctorPatientChart = async (patientId) => {
  const data = await request(`/doctor/patients/${patientId}`);
  return data;
};

export const getDoctorAppointments = async (date) => {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const data = await request(`/doctor/appointments${query}`);
  return data.appointments || [];
};

export const markAppointmentLate = async (appointmentId) => {
  const data = await request(`/doctor/appointments/${appointmentId}/late`, {
    method: 'PATCH',
  });
  return data.appointment || null;
};

export const markAppointmentArrived = async (appointmentId) => {
  const data = await request(`/doctor/appointments/${appointmentId}/arrived`, {
    method: 'PATCH',
  });
  return data.appointment || null;
};

export const startAppointment = async (appointmentId) => {
  const data = await request(`/doctor/appointments/${appointmentId}/start`, {
    method: 'PATCH',
  });
  return data.appointment || null;
};

export const completeAppointment = async (appointmentId) => {
  const data = await request(`/doctor/appointments/${appointmentId}/complete`, {
    method: 'PATCH',
  });
  return data.appointment || null;
};

export const getDoctorsForBooking = async () => {
  const data = await request('/patient/doctors');
  return data.doctors || [];
};

export const getDoctorAvailabilityForPatient = async (doctorId, date) => {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const data = await request(`/patient/doctors/${doctorId}/availability${query}`);
  return data;
};

// ─── Patient Appointment APIs ──────────────────────────────────────────

export const createAppointment = async (payload) => {
  const data = await request('/patient/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.appointment || null;
};

export const getPatientAppointments = async (date) => {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const data = await request(`/patient/appointments${query}`);
  return data.appointments || [];
};

export const patientMarkArrived = async (appointmentId) => {
  const data = await request(`/patient/appointments/${appointmentId}/arrive`, {
    method: 'PATCH',
  });
  return data.appointment || null;
};

export const cancelAppointment = async (appointmentId) => {
  const data = await request(`/patient/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
  });
  return data.appointment || null;
};

export const checkPrescriptionSafety = async (patientId, items) => {
  const data = await request(`/doctor/patients/${patientId}/check-safety`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return data.safetyReport || null;
};

export const createPrescription = async (patientId, items) => {
  const data = await request(`/doctor/patients/${patientId}/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return data;
};

export const addPatientAllergy = async (patientId, payload) => {
  const data = await request(`/doctor/patients/${patientId}/allergies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.allergy || null;
};

export const addPatientVaccination = async (patientId, payload) => {
  const data = await request(`/doctor/patients/${patientId}/vaccinations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.vaccination || null;
};

export const addPatientSurgery = async (patientId, payload) => {
  const data = await request(`/doctor/patients/${patientId}/surgeries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.surgery || null;
};

export const searchDrugs = async (query) => {
  const data = await request(`/doctor/drugs/search?q=${encodeURIComponent(query)}`);
  return data.drugs || [];
};

export const modifyPrescriptionItem = async (patientId, itemId, { status, pause_duration_days, modification_notes }) => {
  const data = await request(`/doctor/patients/${patientId}/prescription-items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, pause_duration_days, modification_notes }),
  });
  return data;
};
