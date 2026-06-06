
import { mockUser } from '../data/mockUser.js';
import { mockCurrentMedications, mockPastMedications } from '../data/mockMedications.js';

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

    // Persist to localStorage prescription history
    const result = savePrescriptionToLocal(data.scans);

    return result;
  } catch (err) {
    throw new Error(err.message || 'Analysis failed');
  }
};

const PRESCRIPTION_HISTORY_KEY = 'rxsense_prescription_history';
const MAX_LOCAL_HISTORY = 30;

function savePrescriptionToLocal(data) {
  try {
    const existing = JSON.parse(localStorage.getItem(PRESCRIPTION_HISTORY_KEY) || '[]');
    const match = existing.find((e) => e.scan_id === data.scan_id);
    if (match) return match;

    const drugs = data.medications || [];

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
      name:         d.matched_brand || d.extracted_name,
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

    const patient = data.patient_json || {name: data.patient_name_rx || null, age: null, gender: null};
    const doctor = {
      name: data.doctor_name || '',
      specialization: data.doctor_speciality || data.doctor_specialization || '',
      qualification: data.doctor_qualification || '',
    };
    const hospital = {name: data.hospital_name || ''};

    const diseaseList = data.diseases.join(', ');
    const testList    = data.tests.join(', ');
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

    // const result = {
    //   scan_id:    data.scan_id   || null,
    //   image_url:  data.image_url || null,
    //   confidence: avgConf,
    //   date:       rxDate,
    //   patient,
    //   doctor,
    //   hospital,
    //   notes:    data.notes    || null,
    //   followUp: data.followUp || null,
    //   medications,
    //   diseases,
    //   tests,
    //   explanation,
    //   warnings,
    // };

    const entry = {
      scan_id:     data.scan_id || null,
      patient_id:  data.patient_id || null,
      image_url:   data.image_url || null,
      date:        rxDate,
      savedAt:     new Date().toISOString(),
      confidence:  avgConf,
      patient:     patient,
      doctor:      doctor,
      hospital:    hospital,
      diseases:    data.diseases,
      tests:       data.tests,
      medications: medications,
      notes:       data.notes,
      followUp:    data.followUp,
    };
    const updated = [entry, ...existing].slice(0, MAX_LOCAL_HISTORY);
    localStorage.setItem(PRESCRIPTION_HISTORY_KEY, JSON.stringify(updated));

    return entry;
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function saveAllPrescriptionsToLocal(scans) {
  try {
    for (const scan of scans) {
      savePrescriptionToLocal(scan);
    }
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
  // If local cache exists, return it instead of fetching
  try {
    const raw = localStorage.getItem(PRESCRIPTION_HISTORY_KEY);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        return parsed;
      } catch {
        return [];
      }
    }
  } catch {
    // ignore and fall through to fetch
  }

  const data = await request(`/prescription/history?limit=${limit}&offset=${offset}`);
  const scans = data.scans || [];
  // persist fetched scans to localStorage
  try { saveAllPrescriptionsToLocal(scans); } catch {}
  return JSON.parse(localStorage.getItem(PRESCRIPTION_HISTORY_KEY) || '[]');
};

function updatePrescriptionHistoryLocal(scanId, updater) {
  try {
    const existing = JSON.parse(localStorage.getItem(PRESCRIPTION_HISTORY_KEY) || '[]');
    const updated = existing.map((entry) => {
      if (entry.scan_id !== scanId) return entry;
      return updater(entry);
    });
    localStorage.setItem(PRESCRIPTION_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

function deletePrescriptionHistoryLocal(scanId) {
  try {
    const existing = JSON.parse(localStorage.getItem(PRESCRIPTION_HISTORY_KEY) || '[]');
    const updated = existing.filter((entry) => entry.scan_id !== scanId);
    localStorage.setItem(PRESCRIPTION_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export const savePrescriptionScan = async (scanId) => {
  const data = await request(`/prescription/save/${scanId}`, {
    method: 'PATCH',
  });

  const patientId = data.scan?.patient_id ?? null;
  updatePrescriptionHistoryLocal(scanId, (entry) => ({
    ...entry,
    patient_id: patientId,
  }));

  return data.scan || null;
};

export const removePrescriptionScan = async (scanId) => {
  const data = await request(`/prescription/remove/${scanId}`, {
    method: 'PATCH',
  });

  updatePrescriptionHistoryLocal(scanId, (entry) => ({
    ...entry,
    patient_id: null,
  }));

  return data.scan || null;
};

export const deletePrescriptionScan = async (scanId) => {
  const data = await request(`/prescription/delete/${scanId}`, {
    method: 'DELETE',
  });

  deletePrescriptionHistoryLocal(scanId);

  return data.scan || null;
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

function metricsToSections(metrics = []) {
  const sectionMap = new Map();

  for (const m of metrics) {
    const sectionTitle = m.section_title || "RESULTS";

    // create section if not exists
    if (!sectionMap.has(sectionTitle)) {
      sectionMap.set(sectionTitle, {
        title: sectionTitle,
        entries: [],
        narrative: null
      });
    }

    const section = sectionMap.get(sectionTitle);

    // convert metric → entry format
    section.entries.push({
      label: m.parameter_name,
      value: m.value,
      unit: m.unit,
      status: m.status,
      reference_range: m.reference_range,
      flag: m.status === "low" ? "L" :
            m.status === "high" ? "H" :
            m.status === "normal" ? "N" :
            m.status === "borderline" ? "N" : null,
    });
  }

  return Array.from(sectionMap.values());
}

function saveReportToLocal(report) {
  try {
    const existing = JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) || '[]');
    const entry = {
      id:                 report.report_id,
      patient_id:         report.patient_id || null,
      image_url:          report.image_url,
      type:               report.report_type,
      date:               report.report_date,
      savedAt:            new Date().toISOString(),
      facility:           report.facility,
      ordering_doctor:    report.ordering_doctor,
      patient:            report.patient_json,
      sections:           metricsToSections(report.metrics),
      overall_impression: report.overall_impression,
      diagnoses:          report.diagnoses || [],
      recommendations:    report.recommendations || [],
      clinical_notes:     report.clinical_notes,
      follow_up:          report.follow_up,
      predictions:         report.predictions || [],
      overallRisk:         report.overallRisk || report.overall_risk || null,
      cohortSize:          report.cohortSize || report.cohort_size || 0,
    };
    const updated = [entry, ...existing].slice(0, MAX_LOCAL_REPORTS);
    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(updated));
    return entry;
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function saveAllReportsToLocal(reports) {
  try {
    for (const report of reports) {
      saveReportToLocal(report);
    }
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

function updateReportHistoryLocal(reportId, updater) {
  try {
    const existing = JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) || '[]');
    const updated = existing.map((entry) => {
      if (entry.id !== reportId) return entry;
      return updater(entry);
    });
    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

function deleteReportHistoryLocal(reportId) {
  try {
    const existing = JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) || '[]');
    const updated = existing.filter((entry) => entry.id !== reportId);
    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

// POST /api/patient/reports/analyze
export const analyzeReport = async (file, reportType) => {
  const formData = new FormData();
  formData.append('report', file);
  formData.append('reportType', reportType);

  const data = await request('/patient/reports/analyze', {
    method: 'POST',
    body: formData,
  });

  const report = data.report || {};

  const entry = saveReportToLocal(report);
  return entry || report;
};

export const getReportHistory = async ({ limit = 50, offset = 0 } = {}) => {
  // If local cache exists, return it instead of fetching
  try {
    const raw = localStorage.getItem(REPORT_HISTORY_KEY);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        return parsed;
      } catch {
        return [];
      }
    }
  } catch {
    // ignore and fall through to fetch
  }

  const data = await request(`/patient/reports/history?limit=${limit}&offset=${offset}`);
  const reports = data.reports || [];
  // clear cache and persist fetched reports to localStorage to ensure clean sync of patient_id
  try {
    localStorage.removeItem(REPORT_HISTORY_KEY);
    saveAllReportsToLocal(reports);
  } catch {}
  return JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) || '[]');
};

export const saveReportScan = async (reportId) => {
  const data = await request(`/patient/reports/save/${reportId}`, {
    method: 'PATCH',
  });

  const patientId = data.report?.patient_id ?? null;
  updateReportHistoryLocal(reportId, (entry) => ({
    ...entry,
    patient_id: patientId,
  }));

  return data.report || null;
};

export const removeReportScan = async (reportId) => {
  const data = await request(`/patient/reports/remove/${reportId}`, {
    method: 'PATCH',
  });

  updateReportHistoryLocal(reportId, (entry) => ({
    ...entry,
    patient_id: null,
  }));

  return data.report || null;
};

export const deleteReportScan = async (reportId) => {
  const data = await request(`/patient/reports/delete/${reportId}`, {
    method: 'DELETE',
  });

  deleteReportHistoryLocal(reportId);

  return data.report || null;
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
    return null;
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

export const checkPatientMedicationSafety = async (patientData) => {
  const data = await request('/patient/me/medication-safety', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patientData),
  });
  return data.safetyReport || null;
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

// // GET /api/documents/:userId
// export const getDocuments = async (userId) => {
//   await delay(600);
//   return mockDocuments;
// };

// // POST /api/documents/:userId
// export const uploadDocument = async (userId, file, metadata) => {
//   await delay(1500);
//   return { id: `doc_${Date.now()}`, filename: file.name, ...metadata };
// };

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

// // GET /api/family/:userId
// export const getFamilyHistory = async (userId) => {
//   await delay(600);
//   return {
//     members: mockFamilyMembers,
//     risks: mockHereditaryRisks,
//     geneticScores: mockGeneticRiskScores,
//   };
// };

// // POST /api/family/:userId/member
// export const addFamilyMember = async (userId, member) => {
//   await delay(800);
//   return { ...member, id: `fam_${Date.now()}` };
// };

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

export const updateDoctorProfile = async (doctorId, profileData, currentPassword) => {
  const data = await request(`/doctor/update-profile/${doctorId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...profileData, currentPassword }),
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

export const createPrescription = async (patientId, payload) => {
  const data = await request(`/doctor/patients/${patientId}/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

export const getPausedMedication = async (patientId) => {
  const data = await request(`/doctor/patients/${patientId}/paused-medications`, {
    method: 'GET',
  });
  return data || null;
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

export const modifyPrescriptionItem = async (patientId, itemId, { status, pause_duration_days, duration_days, modification_notes }) => {
  const data = await request(`/doctor/patients/${patientId}/prescription-items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, pause_duration_days, duration_days, modification_notes }),
  });
  return data;
};

export const getPredictions = async () => {
  const data = await request('/predictions', {
    method: 'GET',
  });
  return data.predictions || [];
};

export const getMetricTrend = async (metricName) => {
  const data = await request(`/predictions/trends/${encodeURIComponent(metricName)}`, {
    method: 'GET',
  });
  return data.trend || null;
};

export const refreshPredictions = async () => {
  const data = await request('/predictions/refresh', {
    method: 'POST',
  });
  return data;
};

export const computeTrends = async () => {
  const data = await request('/predictions/compute-trends', {
    method: 'POST',
  });
  return data.trends || {};
};
