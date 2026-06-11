import { useState, useEffect } from 'react';

const NAV_SECTIONS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'problem',      label: 'Problem' },
  { id: 'solution',     label: 'Solution' },
  { id: 'features',     label: 'Features' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'dataflow',     label: 'Data Flow' },
  { id: 'ai',           label: 'AI & Models' },
  { id: 'rag',          label: 'RAG Pipeline' },
  { id: 'stack',        label: 'Tech Stack' },
  { id: 'api',          label: 'API Reference' },
  { id: 'database',     label: 'Database' },
  { id: 'security',     label: 'Security' },
  { id: 'roadmap',      label: 'Roadmap' },
  { id: 'team',         label: 'Team' },
];

const TEAM = [
  { name: 'Pritom Biswas',       role: 'Team Lead · Full-Stack & AI Engineer', phone: '+880 01753861838', avatar: 'PB' },
  { name: 'Ananta Debnath',      role: 'Member · Full-Stack & AI Engineer',    phone: '+880 1728564128',  avatar: 'AD' },
  { name: 'Shadman Sami Shanon', role: 'Member · Full-Stack & AI Engineer',    phone: '+880 1873346089',  avatar: 'SS' },
  { name: 'Tafsir Al Nafin',     role: 'Member · Full-Stack & AI Engineer',    phone: '+880 1700645096',  avatar: 'TN' },
];

const API_ENDPOINTS = [
  // ── Auth ──
  { method: 'POST',   path: '/auth/register',                                        desc: 'Register new patient account' },
  { method: 'POST',   path: '/auth/login',                                           desc: 'Login with email and password' },
  { method: 'POST',   path: '/auth/google-login',                                    desc: 'Login via Google OAuth ID token' },
  { method: 'GET',    path: '/auth/me',                                               desc: 'Get authenticated user profile' },
  { method: 'POST',   path: '/auth/logout/:userId',                                   desc: 'Invalidate refresh token' },
  { method: 'GET',    path: '/auth/verify-token',                                     desc: 'Check JWT token validity' },
  { method: 'POST',   path: '/auth/send-verification-email',                          desc: 'Request email verification link' },
  { method: 'GET',    path: '/auth/verify-email',                                     desc: 'Verify email via link token' },
  { method: 'POST',   path: '/auth/password/request',                                 desc: 'Send password reset email' },
  { method: 'POST',   path: '/auth/password/reset',                                   desc: 'Reset password with token' },
  { method: 'POST',   path: '/auth/password/change',                                  desc: 'Change password (authenticated)' },
  // ── Patient – Profile ──
  { method: 'GET',    path: '/patient/me',                                             desc: 'Get current patient profile' },
  { method: 'PUT',    path: '/patient/me',                                             desc: 'Update patient demographics & vitals' },
  { method: 'GET',    path: '/patient/me/health-summary',                              desc: 'Profile + latest metrics + active medications (Dashboard)' },
  { method: 'GET',    path: '/patient/me/active-medications',                          desc: 'Duration-filtered active medications only' },
  { method: 'POST',   path: '/patient/me/medication-safety',                           desc: 'Check if a medication is safe for this patient' },
  { method: 'GET',    path: '/patient/me/documents',                                   desc: 'All uploaded reports and prescription scans' },
  // ── Patient – Appointments ──
  { method: 'GET',    path: '/patient/doctors',                                        desc: 'List available doctors for booking' },
  { method: 'GET',    path: '/patient/doctors/:doctorId/availability',                 desc: 'Get available time slots for a doctor on a date' },
  { method: 'POST',   path: '/patient/appointments',                                   desc: 'Book appointment (serial-based, 10-min slot estimation)' },
  { method: 'GET',    path: '/patient/appointments',                                   desc: 'Get patient\'s appointment history' },
  { method: 'PATCH',  path: '/patient/appointments/:id/arrive',                        desc: 'Mark patient as arrived at clinic' },
  { method: 'PATCH',  path: '/patient/appointments/:id/cancel',                        desc: 'Cancel appointment' },
  // ── Patient – Reports ──
  { method: 'POST',   path: '/patient/reports/analyze',                                desc: 'Upload & analyze lab report (Claude Sonnet 4.6 vision)' },
  { method: 'GET',    path: '/patient/reports/history',                                desc: 'Get report history' },
  { method: 'PATCH',  path: '/patient/reports/update/:reportId',                       desc: 'Inline-edit report patient info or metric values/statuses' },
  { method: 'PATCH',  path: '/patient/reports/save/:reportId',                         desc: 'Save report to patient profile' },
  { method: 'PATCH',  path: '/patient/reports/remove/:reportId',                       desc: 'Remove report from patient profile' },
  { method: 'DELETE', path: '/patient/reports/delete/:reportId',                       desc: 'Permanently delete report' },
  { method: 'POST',   path: '/patient/reports/chat',                                   desc: 'AI Q&A chat about a specific lab report' },
  // ── Patient – Timeline ──
  { method: 'GET',    path: '/patient/timeline',                                       desc: 'Chronological health timeline (reports, prescriptions, symptoms)' },
  { method: 'POST',   path: '/patient/timeline',                                       desc: 'Manually add a timeline entry' },
  // ── Prescription ──
  { method: 'POST',   path: '/prescription/analyze',                                   desc: 'Upload image → MedGemma OCR + GPT-4.1 dosage extraction' },
  { method: 'GET',    path: '/prescription/history',                                   desc: 'Scan history (includes rx_status, rx_end_date)' },
  { method: 'PATCH',  path: '/prescription/update/:scanId',                            desc: 'Inline-edit prescription details, rx_status, medications' },
  { method: 'PATCH',  path: '/prescription/save/:scanId',                              desc: 'Save scan to patient profile' },
  { method: 'PATCH',  path: '/prescription/remove/:scanId',                            desc: 'Detach scan from patient profile' },
  { method: 'DELETE', path: '/prescription/delete/:scanId',                            desc: 'Permanently delete prescription scan' },
  { method: 'POST',   path: '/prescription/chat',                                      desc: 'AI chat about a prescription (DrugBank-grounded)' },
  // ── Symptom ──
  { method: 'POST',   path: '/symptom/check',                                          desc: 'Multi-turn AI symptom assessment — Bengali, emergency detection' },
  { method: 'POST',   path: '/symptom/share',                                          desc: 'Share symptom session transcript with a doctor' },
  // ── Drugs ──
  { method: 'POST',   path: '/drugs/interactions',                                     desc: 'Check drug-drug interactions (open, no auth required)' },
  { method: 'POST',   path: '/drugs/newmedinteractions/:patientId',                    desc: 'Check new medication against patient\'s current active meds' },
  // ── Insights ──
  { method: 'GET',    path: '/insights',                                               desc: 'AI health score, trend alerts, risk breakdown (24h DB cache)' },
  { method: 'POST',   path: '/insights/patient-summary',                               desc: 'Warm Bangla health narrative for patient (active meds only)' },
  { method: 'POST',   path: '/insights/doctor-summary',                                desc: 'Clinical summary card for sharing with doctor' },
  // ── Predictive ──
  { method: 'GET',    path: '/predictive',                                             desc: 'AI complication risk predictions with confidence scores' },
  { method: 'GET',    path: '/predictive/trends/:metricName',                          desc: 'Trend series for a specific lab metric over time' },
  { method: 'POST',   path: '/predictive/refresh',                                     desc: 'Force-regenerate predictions' },
  { method: 'POST',   path: '/predictive/compute-trends',                              desc: 'Compute trend analysis across all tracked metrics' },
  // ── Family ──
  { method: 'GET',    path: '/family/my-code',                                         desc: 'Get personal family share code' },
  { method: 'POST',   path: '/family/my-code/regenerate',                              desc: 'Regenerate family share code' },
  { method: 'POST',   path: '/family/lookup',                                          desc: 'Preview a member by share code before linking' },
  { method: 'POST',   path: '/family/link',                                            desc: 'Link a family member with relationship type' },
  { method: 'GET',    path: '/family/members',                                         desc: 'List all linked family members' },
  { method: 'GET',    path: '/family/members/:linkId/health',                          desc: 'Full health snapshot (vitals, conditions, allergies with severity)' },
  { method: 'DELETE', path: '/family/link/:linkId',                                    desc: 'Remove a family link' },
  // ── Doctor – Auth & Profile ──
  { method: 'POST',   path: '/doctor/register',                                        desc: 'Register doctor account (separate credential store)' },
  { method: 'POST',   path: '/doctor/login',                                           desc: 'Doctor login' },
  { method: 'GET',    path: '/doctor/get-profile/:doctorId',                           desc: 'Get doctor profile & specialties' },
  { method: 'PATCH',  path: '/doctor/update-profile/:doctorId',                        desc: 'Update doctor profile, specialties, qualifications' },
  { method: 'POST',   path: '/doctor/change-password/:doctorId',                       desc: 'Change doctor account password' },
  // ── Doctor – Hospitals & Availability ──
  { method: 'GET',    path: '/doctor/hospitals-list',                                  desc: 'Get all registered hospitals' },
  { method: 'POST',   path: '/doctor/hospitals/:doctorId',                             desc: 'Add hospital affiliation' },
  { method: 'GET',    path: '/doctor/hospitals/:doctorId',                             desc: 'Get doctor\'s hospital affiliations' },
  { method: 'PATCH',  path: '/doctor/limits',                                          desc: 'Update daily patient limit per hospital' },
  { method: 'GET',    path: '/doctor/availability',                                    desc: 'Get availability time slots' },
  { method: 'PATCH',  path: '/doctor/availability',                                    desc: 'Set weekly availability schedule' },
  // ── Doctor – Appointments ──
  { method: 'GET',    path: '/doctor/patients',                                        desc: 'List doctor\'s patients' },
  { method: 'GET',    path: '/doctor/appointments',                                    desc: 'Get today\'s and upcoming appointments' },
  { method: 'PATCH',  path: '/doctor/appointments/:id/late',                           desc: 'Mark appointment as late' },
  { method: 'PATCH',  path: '/doctor/appointments/:id/arrived',                        desc: 'Mark patient has arrived' },
  { method: 'PATCH',  path: '/doctor/appointments/:id/start',                          desc: 'Start the appointment (in_progress)' },
  { method: 'PATCH',  path: '/doctor/appointments/:id/complete',                       desc: 'Complete appointment' },
  // ── Doctor – Patient Management ──
  { method: 'GET',    path: '/doctor/patients/:patientId',                             desc: 'Comprehensive patient chart (conditions, allergies, scans, reports, meds)' },
  { method: 'POST',   path: '/doctor/patients/:patientId/ai-summary',                  desc: 'Generate AI-powered patient summary narrative' },
  { method: 'POST',   path: '/doctor/patients/:patientId/check-safety',                desc: 'AI safety check for a proposed prescription' },
  { method: 'POST',   path: '/doctor/patients/:patientId/prescriptions',               desc: 'Create formal prescription for patient' },
  { method: 'PATCH',  path: '/doctor/patients/:patientId/prescription-items/:itemId',  desc: 'Modify a prescription line item' },
  { method: 'POST',   path: '/doctor/patients/:patientId/allergies',                   desc: 'Add allergy record for patient' },
  { method: 'POST',   path: '/doctor/patients/:patientId/vaccinations',                desc: 'Add vaccination record' },
  { method: 'POST',   path: '/doctor/patients/:patientId/surgeries',                   desc: 'Add surgical history entry' },
  { method: 'GET',    path: '/doctor/drugs/search',                                    desc: 'Search DrugBank drug database by name' },
  { method: 'GET',    path: '/doctor/patients/:patientId/paused-medications',           desc: 'Get paused or stopped medications for patient' },
  // ── Places ──
  { method: 'GET',    path: '/places/nearby',                                          desc: 'Find nearby hospitals, clinics & doctor chambers (Google Places)' },
  { method: 'GET',    path: '/places/geocode',                                         desc: 'Geocode address to lat/lng coordinates' },
  { method: 'POST',   path: '/places/infer-specialty',                                 desc: 'AI: infer required medical specialty from condition description' },
  // ── User ──
  { method: 'GET',    path: '/user/get-profile/:userId',                               desc: 'Get user profile by ID' },
  { method: 'PATCH',  path: '/user/update-profile/:userId',                            desc: 'Update user profile' },
  { method: 'PATCH',  path: '/user/subscription/:userId',                              desc: 'Change subscription tier' },
  { method: 'POST',   path: '/user/avatar/:userId',                                    desc: 'Upload profile avatar image' },
];

const METHOD_COLORS = {
  GET:    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  POST:   'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  PUT:    'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  PATCH:  'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

function SectionHeading({ id, title, subtitle }) {
  return (
    <div id={id} className="mb-8 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-8 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full" />
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      {subtitle && <p className="text-slate-400 ml-4">{subtitle}</p>}
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, color = 'emerald' }) {
  const colors = {
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    blue:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
    amber:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
    red:     'bg-red-500/20 text-red-400 border-red-500/30',
    teal:    'bg-teal-500/20 text-teal-400 border-teal-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color] || colors.emerald}`}>
      {children}
    </span>
  );
}

function FlowBox({ label, sub, color = 'slate' }) {
  const colors = {
    slate:   'bg-slate-700/60 border-slate-600 text-slate-200',
    emerald: 'bg-emerald-900/40 border-emerald-600/50 text-emerald-200',
    blue:    'bg-blue-900/40 border-blue-600/50 text-blue-200',
    purple:  'bg-purple-900/40 border-purple-600/50 text-purple-200',
    amber:   'bg-amber-900/40 border-amber-600/50 text-amber-200',
    teal:    'bg-teal-900/40 border-teal-600/50 text-teal-200',
    red:     'bg-red-900/40 border-red-600/50 text-red-200',
  };
  return (
    <div className={`border rounded-lg px-4 py-2.5 text-center text-sm font-medium ${colors[color] || colors.slate}`}>
      <div>{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Arrow({ direction = 'down' }) {
  if (direction === 'right') return <div className="text-slate-500 text-lg font-bold mx-1">→</div>;
  return <div className="text-slate-500 text-lg font-bold my-1 text-center">↓</div>;
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileNavOpen(false);
  };

  const filteredEndpoints = API_ENDPOINTS.filter(
    (e) => !search || e.path.toLowerCase().includes(search.toLowerCase()) || e.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">

      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">Rx</div>
            <span className="font-semibold text-white">RxSense</span>
            <span className="text-slate-500 text-sm hidden sm:block">/ docs</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge color="emerald">v1.0.0</Badge>
            <Badge color="blue">Infinity AI Buildfest 2026</Badge>
            <button className="sm:hidden text-slate-400" onClick={() => setMobileNavOpen(!mobileNavOpen)}>☰</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 flex gap-8 py-8">

        {/* Sidebar */}
        <aside className={`${mobileNavOpen ? 'fixed inset-0 z-40 bg-slate-950 p-6' : 'hidden'} lg:block lg:static lg:w-52 shrink-0`}>
          {mobileNavOpen && (
            <button className="absolute top-4 right-4 text-slate-400 text-xl" onClick={() => setMobileNavOpen(false)}>✕</button>
          )}
          <nav className="sticky top-20 space-y-0.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">Contents</p>
            {NAV_SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all ${
                  activeSection === id
                    ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-16">

          {/* ── OVERVIEW ── */}
          <section>
            <div id="overview" className="scroll-mt-24">
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1 text-emerald-400 text-sm mb-4">
                  HealthTech · Risk Prediction Engine · Bangladesh
                </div>
                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
                  RxSense
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 text-3xl sm:text-4xl mt-1">
                    One platform for every health story in your family.
                  </span>
                </h1>
                <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
                  AI-powered health management platform that reads prescriptions, interprets lab reports,
                  predicts health risks, connects families, and provides doctors with a full clinical workspace —
                  making clinical intelligence accessible to every patient regardless of medical literacy.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'API Endpoints',   value: `${API_ENDPOINTS.length}` },
                  { label: 'Database Tables', value: '31' },
                  { label: 'AI Models',       value: '7' },
                  { label: 'RAG Sources',     value: '4' },
                ].map(({ label, value }) => (
                  <Card key={label} className="text-center">
                    <div className="text-3xl font-bold text-emerald-400">{value}</div>
                    <div className="text-slate-400 text-sm mt-1">{label}</div>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* ── PROBLEM ── */}
          <section>
            <SectionHeading id="problem" title="Problem Statement" subtitle="The healthcare gap RxSense is built to close" />
            <Card>
              <p className="text-slate-300 leading-relaxed mb-4">
                In Bangladesh, patients routinely leave clinics holding handwritten prescriptions and lab reports they
                cannot read or understand. Doctors write in Latin abbreviations and illegible shorthand; lab values
                mean nothing to an untrained eye.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                With one of the lowest doctor-to-patient ratios in the region and severely overburdened healthcare
                facilities, there is no one to explain these documents — leading to wrong dosages, missed diagnoses,
                and preventable health deterioration.
              </p>
              <p className="text-slate-300 leading-relaxed mb-6">
                Worse, no one is connecting the dots across a patient's prescriptions, lab trends, and symptoms over
                time — so early warning signs of diabetes, heart disease, or drug toxicity go completely unnoticed
                until it is too late.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { title: 'Prescription Confusion',   desc: 'Patients cannot read or understand what doctors write' },
                  { title: 'Lab Report Overload',      desc: 'Complex clinical values are meaningless without context' },
                  { title: 'No Risk Continuity',       desc: 'Nobody tracks patterns across visits to predict early risk' },
                ].map(({ title, desc }) => (
                  <div key={title} className="bg-red-950/30 border border-red-800/30 rounded-lg p-4">
                    <div className="text-red-400 font-semibold mb-1">{title}</div>
                    <div className="text-slate-400 text-sm">{desc}</div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* ── SOLUTION ── */}
          <section>
            <SectionHeading id="solution" title="Solution" subtitle="How RxSense addresses each problem" />
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: 'Prescription Analysis',         icon: '💊', desc: 'Upload a photo — MedGemma OCR + GPT-4.1 vision extracts drugs, dosages, frequencies, meal instructions, and diseases. Supports handwritten Bengali and English.' },
                { title: 'Lab Report Interpretation',     icon: '🧪', desc: 'Claude Sonnet 4.6 reads lab values, flags abnormals against reference ranges, groups by section (CBC, lipids, thyroid), and explains results in plain Bangla or English.' },
                { title: 'Predictive Analytics',          icon: '📊', desc: 'AI analyzes trends across all past reports to predict future complications — diabetes, cardiovascular risk, kidney disease. Each prediction carries a confidence score and preventive actions.' },
                { title: 'Symptom Checker',               icon: '🩺', desc: 'Claude agent with RAG tool-use fetches patient history and Harrison\'s Medical knowledge to give personalised, multi-turn Bengali assessments. Fires an EMERGENCY_CARD for life-threatening presentations.' },
                { title: 'Drug Interaction Safety',       icon: '⚠️', desc: 'Multi-source lookup — local DrugBank → NIH RxNorm → Medscape → Tavily web search. Provides severity, mechanism, and clinical action for every interaction found.' },
                { title: 'Doctor Portal',                 icon: '👨‍⚕️', desc: 'Full clinical workspace: view comprehensive patient charts (conditions, allergies, vaccinations, surgeries, prescriptions, reports), create prescriptions with drug-database search, run AI safety checks before prescribing, and generate one-click AI summaries.' },
                { title: 'Appointment System',            icon: '📅', desc: 'Patients browse available doctors by specialty, pick a date, and book in real time. Serial number assignment estimates wait time in 10-minute slots. Doctors manage arrivals through a status lifecycle: booked → arrived → in_progress → completed.' },
                { title: 'Family Health Network',         icon: '👨‍👩‍👧', desc: 'Share codes connect family members so caregivers stay informed — full vitals, conditions, and allergies (with severity) visible from the family panel. Links can be regenerated or revoked at any time.' },
                { title: 'Prescription Lifecycle',        icon: '📋', desc: 'Each scan carries rx_status (ongoing / closed) and an optional rx_end_date. Duration-based expiry math filters out stale medications from all AI prompts, the dashboard, and the drug interaction checker.' },
                { title: 'Inline Data Editing',           icon: '✏️', desc: 'Patients can correct OCR mistakes directly in the UI — edits to patient info, metric values, statuses, and medication names persist to the database immediately via PATCH endpoints.' },
                { title: 'Nearby Facilities',             icon: '📍', desc: 'Google Places API locates hospitals, clinics, and doctor chambers within 5–8 km. Condition keywords are AI-inferred to the right medical specialty. Full skeleton loader prevents churn during the GPS + search latency.' },
                { title: 'Offline-First Persistence',     icon: '💾', desc: 'Insights, family health, drug interactions, and active medications are cached in localStorage with TTLs (2 h insights, 30 min meds). A refresh button force-invalidates the cache on any page.' },
              ].map(({ title, desc, icon }) => (
                <Card key={title}>
                  <div className="flex gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <div className="font-semibold text-white mb-1">{title}</div>
                      <div className="text-slate-400 text-sm leading-relaxed">{desc}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* ── FEATURES ── */}
          <section>
            <SectionHeading id="features" title="Feature Matrix" subtitle="Complete capability list — patient and doctor sides" />
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">Feature</th>
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">User</th>
                    <th className="text-left py-2 text-slate-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {[
                    // Patient
                    ['Prescription OCR + Analysis (MedGemma + GPT-4.1)', 'Patient', 'Live'],
                    ['Lab Report Analysis (Claude Sonnet 4.6 vision)', 'Patient', 'Live'],
                    ['Report & Prescription AI Chat', 'Patient', 'Live'],
                    ['Inline Report & Prescription Editing', 'Patient', 'Live'],
                    ['Prescription Status Tracking (rx_status / expiry)', 'Patient', 'Live'],
                    ['Active Medication Filtering (duration-based)', 'Patient', 'Live'],
                    ['Save / Remove / Delete Reports & Scans', 'Patient', 'Live'],
                    ['Predictive Health Analysis (complication risks)', 'Patient', 'Live'],
                    ['AI Symptom Checker (Bengali, emergency detection)', 'Patient', 'Live'],
                    ['Symptom Sharing with Doctor', 'Patient', 'Live'],
                    ['Drug Interaction Checker (open)', 'Patient / Doctor', 'Live'],
                    ['New Medication vs Active Meds Safety Check', 'Patient / Doctor', 'Live'],
                    ['Health Dashboard + AI Health Story', 'Patient', 'Live'],
                    ['Health Insights (score, trends, risk, actions)', 'Patient', 'Live'],
                    ['Health Timeline (filterable, searchable)', 'Patient', 'Live'],
                    ['Family Health Network (share codes)', 'Patient', 'Live'],
                    ['Family Health Snapshot (vitals, conditions, allergies)', 'Patient', 'Live'],
                    ['Appointment Booking & Calendar', 'Patient', 'Live'],
                    ['Nearby Facilities (Google Places + AI specialty)', 'Patient', 'Live'],
                    ['Offline-First Data Persistence (localStorage)', 'Patient', 'Live'],
                    ['Profile Management (vitals, conditions, allergies)', 'Patient', 'Live'],
                    ['Avatar Upload', 'Patient', 'Live'],
                    ['Subscription Management', 'Patient', 'Live'],
                    // Doctor
                    ['Doctor Portal & Authentication', 'Doctor', 'Live'],
                    ['Hospital Affiliations Management', 'Doctor', 'Live'],
                    ['Availability Scheduling', 'Doctor', 'Live'],
                    ['Daily Patient Limit Setting', 'Doctor', 'Live'],
                    ['Appointment Status Lifecycle (booked → arrived → in_progress → completed)', 'Doctor', 'Live'],
                    ['Comprehensive Patient Chart', 'Doctor', 'Live'],
                    ['AI Patient Summary (one-click narrative)', 'Doctor', 'Live'],
                    ['Prescription Creation with Drug-Database Search', 'Doctor', 'Live'],
                    ['AI Prescription Safety Check before Prescribing', 'Doctor', 'Live'],
                    ['Modify Prescription Line Items', 'Doctor', 'Live'],
                    ['View Paused / Stopped Medications', 'Doctor', 'Live'],
                    ['Add Allergies, Vaccinations, Surgical History', 'Doctor', 'Live'],
                    // Shared
                    ['Bangla / English UI (750+ i18n keys)', 'Both', 'Live'],
                    ['Google OAuth Login', 'Patient', 'Live'],
                    ['Email Verification + Password Reset', 'Both', 'Live'],
                  ].map(([feat, user, status]) => (
                    <tr key={feat}>
                      <td className="py-2 pr-4 text-slate-300">{feat}</td>
                      <td className="py-2 pr-4 text-slate-400">{user}</td>
                      <td className="py-2">
                        <Badge color={status === 'Live' ? 'emerald' : status === 'Beta' ? 'amber' : 'blue'}>
                          {status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          {/* ── ARCHITECTURE ── */}
          <section>
            <SectionHeading id="architecture" title="System Architecture" subtitle="How the three deployable services connect" />
            <Card>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <FlowBox label="Patient App" sub="React 19 + Vite" color="blue" />
                  <FlowBox label="Doctor Portal" sub="React 19 + Vite" color="blue" />
                  <FlowBox label="Public /docs" sub="React 19 + Vite" color="blue" />
                </div>
                <Arrow />
                <FlowBox label="Express 5 REST API" sub="Node.js · JWT Auth · Rate Limiting · Swagger /api/docs" color="teal" />
                <Arrow />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <FlowBox label="Auth Service"   sub="bcrypt · JWT · Google OAuth" color="slate" />
                  <FlowBox label="AI Service"     sub="Claude · Gemini · GPT-4o"   color="purple" />
                  <FlowBox label="OCR Service"    sub="MedGemma · Modal GPU"        color="amber" />
                  <FlowBox label="File Service"   sub="Multer · Sharp · Cloudinary" color="slate" />
                </div>
                <Arrow />
                <div className="grid grid-cols-2 gap-2">
                  <FlowBox label="PostgreSQL" sub="31 tables · NeonDB serverless"       color="emerald" />
                  <FlowBox label="pgvector"   sub="RAG embeddings · cosine similarity"  color="emerald" />
                </div>
                <Arrow />
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  <FlowBox label="Anthropic API"    sub="Claude Sonnet 4.6"        color="purple" />
                  <FlowBox label="OpenAI API"       sub="GPT-4o · Embeddings"      color="purple" />
                  <FlowBox label="Google APIs"      sub="Gemini · Places · OAuth"  color="purple" />
                  <FlowBox label="NIH RxNorm"       sub="Drug interaction lookup"  color="teal" />
                  <FlowBox label="Tavily Search"    sub="Web fallback for DDI"     color="teal" />
                </div>
              </div>
            </Card>
          </section>

          {/* ── DATA FLOW ── */}
          <section>
            <SectionHeading id="dataflow" title="Data Flow" subtitle="Key pipelines — patient and doctor side" />

            {/* Row 1 */}
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <Card>
                <h3 className="font-semibold text-white mb-4">Report Analysis Pipeline</h3>
                <div className="space-y-2">
                  <FlowBox label="User uploads lab report" sub="JPEG / PNG / PDF" color="blue" />
                  <Arrow />
                  <FlowBox label="Sharp converts to JPEG" sub="Format normalisation" color="slate" />
                  <Arrow />
                  <FlowBox label="Cloudinary stores image" sub="Returns permanent public URL" color="slate" />
                  <Arrow />
                  <FlowBox label="Claude Sonnet 4.6 (vision)" sub="Reads lab values, diagnoses, narrative findings" color="purple" />
                  <Arrow />
                  <FlowBox label="Structured JSON extraction" sub="metrics · normal ranges · abnormal flags · sections" color="amber" />
                  <Arrow />
                  <FlowBox label="Saved to medical_report + report_metric" sub="PostgreSQL — RAG embeddings ingested" color="emerald" />
                  <Arrow />
                  <FlowBox label="Returned to patient" sub="Summary · abnormal highlights · follow-up advice" color="blue" />
                </div>
              </Card>
              <Card>
                <h3 className="font-semibold text-white mb-4">Prescription Analysis Pipeline</h3>
                <div className="space-y-2">
                  <FlowBox label="User uploads prescription image" sub="JPEG / PNG / PDF" color="blue" />
                  <Arrow />
                  <FlowBox label="Sharp converts to JPEG" sub="Format normalisation" color="slate" />
                  <Arrow />
                  <FlowBox label="Cloudinary stores image" sub="Returns public URL" color="slate" />
                  <Arrow />
                  <FlowBox label="MedGemma 1.5 4B (Modal GPU)" sub="VLM — OCR + medical text extraction" color="amber" />
                  <Arrow />
                  <FlowBox label="GPT-4.1 vision (dosage pass)" sub="Frequency notation · meal instructions · duration" color="amber" />
                  <Arrow />
                  <FlowBox label="EasyOCR fallback" sub="English + Bengali if MedGemma unavailable" color="slate" />
                  <Arrow />
                  <FlowBox label="Saved to prescription_scan" sub="PostgreSQL with rx_status, rx_end_date" color="emerald" />
                  <Arrow />
                  <FlowBox label="Returned to patient" sub="Drugs · dosages · diseases · follow-up" color="blue" />
                </div>
              </Card>
            </div>

            {/* Row 2 */}
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <Card>
                <h3 className="font-semibold text-white mb-4">Symptom Checker Agent Pipeline</h3>
                <div className="space-y-2">
                  <FlowBox label="User sends symptom message" sub="+ full conversation history" color="blue" />
                  <Arrow />
                  <FlowBox label="SymptomAgent builds context" sub="History formatted as রোগী / ডাক্তার turns" color="slate" />
                  <Arrow />
                  <FlowBox label="Claude Sonnet 4.6 (Turn 1)" sub="Decides: ask more OR use tools" color="purple" />
                  <Arrow />
                  <div className="grid grid-cols-2 gap-2">
                    <FlowBox label="get_patient_profile" sub="age · conditions · allergies · active meds" color="teal" />
                    <FlowBox label="rag_search" sub="Harrison's · MedlinePlus" color="teal" />
                  </div>
                  <Arrow />
                  <FlowBox label="Claude synthesises (up to 8 turns)" sub="Tool results injected into context" color="purple" />
                  <Arrow />
                  <FlowBox label="Bengali assessment returned" sub="+ EMERGENCY_CARD JSON if life-threatening" color="emerald" />
                  <Arrow />
                  <FlowBox label="Session persisted in localStorage" sub="max 20 sessions — accessible from History" color="blue" />
                </div>
              </Card>
              <Card>
                <h3 className="font-semibold text-white mb-4">Active Medication Filtering</h3>
                <div className="space-y-2">
                  <FlowBox label="prescription_scan rows fetched" sub="WHERE rx_status IS NULL OR = 'ongoing'" color="blue" />
                  <Arrow />
                  <FlowBox label="normalizeScanRows({ activeOnly: true })" sub="Node.js utility — cannot be done in SQL" color="amber" />
                  <Arrow />
                  <FlowBox label="parseDurationDays(med.duration)" sub="'7 days' / '2 weeks' / '1 month' → N" color="slate" />
                  <Arrow />
                  <FlowBox label="expiresAt = rx_date + durationDays" sub="Missing rx_date → fallback −90 days" color="slate" />
                  <Arrow />
                  <FlowBox label="Filter: expiresAt ≥ today" sub="Expired meds silently dropped" color="emerald" />
                  <Arrow />
                  <FlowBox label="Consumed by: Dashboard · AI Summary · Insights · Doctor Summary · Drug Checker" sub="Every AI context receives filtered list" color="purple" />
                </div>
              </Card>
            </div>

            {/* Row 3 */}
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <Card>
                <h3 className="font-semibold text-white mb-4">Drug Interaction Check Pipeline</h3>
                <div className="space-y-2">
                  <FlowBox label="Drug list submitted" sub="Patient open-form or new-med vs active meds" color="blue" />
                  <Arrow />
                  <FlowBox label="DrugInteractionAgent runs" sub="GPT-4o · multi-source tool-use loop" color="purple" />
                  <Arrow />
                  <div className="grid grid-cols-2 gap-2">
                    <FlowBox label="check_local_db" sub="Local DrugBank table" color="teal" />
                    <FlowBox label="rxnorm_lookup" sub="NIH RxNorm API" color="teal" />
                  </div>
                  <Arrow />
                  <div className="grid grid-cols-2 gap-2">
                    <FlowBox label="medscape_lookup" sub="Medscape reference DB" color="teal" />
                    <FlowBox label="web_search" sub="Tavily — last-resort fallback" color="teal" />
                  </div>
                  <Arrow />
                  <FlowBox label="Structured interaction result" sub="severity · mechanism · clinical_action · source" color="amber" />
                  <Arrow />
                  <FlowBox label="Returned to caller" sub="Unrecognised drugs flagged separately" color="emerald" />
                </div>
              </Card>
              <Card>
                <h3 className="font-semibold text-white mb-4">Doctor Prescription Safety Pipeline</h3>
                <div className="space-y-2">
                  <FlowBox label="Doctor searches DrugBank" sub="GET /doctor/drugs/search" color="blue" />
                  <Arrow />
                  <FlowBox label="Adds drugs with dosage, frequency, duration" sub="UI builds prescription draft" color="slate" />
                  <Arrow />
                  <FlowBox label="POST /doctor/patients/:id/check-safety" sub="Proposed drugs + patient ID" color="blue" />
                  <Arrow />
                  <FlowBox label="Patient active meds fetched" sub="normalizeScanRows — duration-filtered" color="amber" />
                  <Arrow />
                  <FlowBox label="AI safety check runs" sub="New drugs × active meds interaction matrix" color="purple" />
                  <Arrow />
                  <FlowBox label="Interaction alerts shown to doctor" sub="Severity / mechanism / clinical action" color="red" />
                  <Arrow />
                  <FlowBox label="Doctor confirms → POST /prescriptions" sub="Saved to prescription table in DB" color="emerald" />
                </div>
              </Card>
            </div>

            {/* Row 4 */}
            <div className="grid sm:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-semibold text-white mb-4">Health Insights Agent Pipeline</h3>
                <div className="space-y-2">
                  <FlowBox label="GET /insights (patient or force=true)" sub="Check DB cache (24h TTL) first" color="blue" />
                  <Arrow />
                  <FlowBox label="InsightsAgent runs" sub="GPT-4o · up to 8 turns" color="purple" />
                  <Arrow />
                  <div className="grid grid-cols-2 gap-2">
                    <FlowBox label="get_report_history" sub="Last 3 lab reports + metrics" color="teal" />
                    <FlowBox label="get_patient_profile" sub="Conditions · allergies · active meds" color="teal" />
                  </div>
                  <Arrow />
                  <FlowBox label="Structured JSON output" sub="health_score · trend_alerts · risk_breakdown · recommended_actions" color="amber" />
                  <Arrow />
                  <FlowBox label="Saved to patient_insights" sub="Expires after 24h" color="emerald" />
                  <Arrow />
                  <FlowBox label="Client caches in localStorage" sub="2h TTL — refresh button force-invalidates" color="blue" />
                </div>
              </Card>
              <Card>
                <h3 className="font-semibold text-white mb-4">Appointment Booking Pipeline</h3>
                <div className="space-y-2">
                  <FlowBox label="Patient browses doctors" sub="GET /patient/doctors" color="blue" />
                  <Arrow />
                  <FlowBox label="Picks date → fetch availability" sub="GET /patient/doctors/:id/availability" color="slate" />
                  <Arrow />
                  <FlowBox label="POST /patient/appointments" sub="doctor_id + appointment_date" color="blue" />
                  <Arrow />
                  <FlowBox label="Serial number assigned" sub="Daily serial → estimated wait (serial × 10 min)" color="amber" />
                  <Arrow />
                  <FlowBox label="Appointment saved" sub="status = booked" color="emerald" />
                  <Arrow />
                  <FlowBox label="Patient marks arrival" sub="PATCH .../arrive → status = arrived" color="slate" />
                  <Arrow />
                  <FlowBox label="Doctor progresses through lifecycle" sub="arrived → in_progress → completed" color="teal" />
                </div>
              </Card>
            </div>
          </section>

          {/* ── AI & MODELS ── */}
          <section>
            <SectionHeading id="ai" title="AI & Models" subtitle="Every model used and its specific role" />
            <div className="space-y-3">
              {[
                {
                  model: 'Claude Sonnet 4.6',
                  provider: 'Anthropic',
                  badge: 'primary',
                  role: 'Lab report analysis (vision), prescription understanding, symptom assessment agent (tool-use loop, max 8 turns), health insights generation, patient and doctor summary creation. The get_patient_profile tool returns only duration-filtered active medications via normalizeScanRows so AI summaries never cite expired prescriptions.',
                },
                {
                  model: 'MedGemma 1.5 4B',
                  provider: 'Google (open-weight, Modal GPU)',
                  badge: 'vision',
                  role: 'Prescription image OCR and medical text extraction. Purpose-built vision-language model for medical documents. Quantized to 4-bit (BitsAndBytes) and deployed on Modal.com L4 GPU with auto-scale to zero after 600 s idle.',
                },
                {
                  model: 'GPT-4.1',
                  provider: 'OpenAI',
                  badge: 'vision',
                  role: 'Dosage detail pass in the prescription pipeline — parses frequency notation (1+0+1, BD, TDS), meal timing (PC, AC, HS, SOS), duration, and drug strength from MedGemma OCR output.',
                },
                {
                  model: 'GPT-4o / GPT-4o-mini',
                  provider: 'OpenAI',
                  badge: 'chat',
                  role: 'Prescription and report chat conversations, health insights agent, predictive analysis agent, drug interaction agent (GPT-4o), symptom checker, and specialty inference from condition keywords (GPT-4o-mini).',
                },
                {
                  model: 'Gemini 2.5 Flash',
                  provider: 'Google',
                  badge: 'fallback',
                  role: 'Cost-effective fallback for prescription analysis flows when Claude is unavailable or for high-volume scenarios.',
                },
                {
                  model: 'text-embedding-3-small',
                  provider: 'OpenAI',
                  badge: 'embeddings',
                  role: 'Generates 1536-dimension vector embeddings for the RAG knowledge base stored in pgvector. Used at both ingestion time (medical books, patient reports) and query time (cosine similarity search).',
                },
                {
                  model: 'EasyOCR',
                  provider: 'open-source (Python service)',
                  badge: 'ocr',
                  role: 'Fallback OCR for English and Bengali text when the MedGemma GPU endpoint is unavailable. Runs on CPU in the same Modal Python service.',
                },
              ].map(({ model, provider, role, badge }) => (
                <Card key={model} className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-purple-900/40 border border-purple-600/30 flex items-center justify-center text-purple-400 text-lg">🤖</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-white">{model}</span>
                      <span className="text-slate-500 text-xs">by {provider}</span>
                      <Badge color="purple">{badge}</Badge>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">{role}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* ── RAG ── */}
          <section>
            <SectionHeading id="rag" title="RAG Pipeline" subtitle="Retrieval-Augmented Generation architecture" />
            <div className="grid sm:grid-cols-2 gap-6 mb-4">
              <Card>
                <h3 className="font-semibold text-white mb-4">Knowledge Base Sources</h3>
                <div className="space-y-3">
                  {[
                    { source: "Harrison's Principles of Internal Medicine", weight: '1.0', type: 'medical_book' },
                    { source: 'MedlinePlus Lab Test References',            weight: '1.0', type: 'medical_book' },
                    { source: 'Patient Lab Reports',                        weight: '0.7', type: 'patient_report' },
                    { source: 'Patient Profile',                            weight: '0.6', type: 'patient_profile' },
                    { source: 'Chat History',                               weight: '0.3', type: 'chat_history' },
                  ].map(({ source, weight, type }) => (
                    <div key={source} className="flex items-center justify-between">
                      <div>
                        <div className="text-slate-300 text-sm">{source}</div>
                        <div className="text-slate-500 text-xs">{type}</div>
                      </div>
                      <div className="text-emerald-400 font-mono text-sm font-semibold">w={weight}</div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <h3 className="font-semibold text-white mb-4">Retrieval Config</h3>
                <div className="space-y-3">
                  {[
                    ['Vector Store',        'pgvector inside PostgreSQL'],
                    ['Embedding Model',     'text-embedding-3-small (1536-dim)'],
                    ['Similarity',          'Cosine distance'],
                    ['Score formula',       '(1 − cosine_dist) × source_weight'],
                    ['Min score threshold', '0.25'],
                    ['Top-K',              '6 default · 10 max'],
                    ['Chunking',           'Semantic (chapter / topic boundary)'],
                    ['Global sources',     'Books (user_id IS NULL)'],
                    ['Private sources',    'Per-patient vectors (user_id = ?)'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-slate-400">{k}</span>
                      <span className="text-slate-200 font-mono text-xs text-right max-w-xs">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <Card>
              <h3 className="font-semibold text-white mb-4">Agent Tool-Use Flow</h3>
              <div className="flex flex-wrap items-center gap-2">
                <FlowBox label="Claude receives message" color="purple" />
                <Arrow direction="right" />
                <FlowBox label="Calls rag_search tool" color="teal" />
                <Arrow direction="right" />
                <FlowBox label="Query → OpenAI embed" color="slate" />
                <Arrow direction="right" />
                <FlowBox label="pgvector cosine search" color="emerald" />
                <Arrow direction="right" />
                <FlowBox label="Top-K chunks × weights" color="slate" />
                <Arrow direction="right" />
                <FlowBox label="Claude reasons over chunks" color="purple" />
                <Arrow direction="right" />
                <FlowBox label="Final response" color="blue" />
              </div>
            </Card>
          </section>

          {/* ── STACK ── */}
          <section>
            <SectionHeading id="stack" title="Technology Stack" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  layer: 'Frontend',
                  color: 'blue',
                  items: ['React 19', 'Vite 8', 'Tailwind CSS 3', 'Framer Motion', 'React Router 7', 'Axios'],
                },
                {
                  layer: 'Backend',
                  color: 'teal',
                  items: ['Node.js', 'Express 5', 'JWT (jsonwebtoken)', 'bcrypt', 'Multer', 'Sharp', 'Swagger UI'],
                },
                {
                  layer: 'Database',
                  color: 'emerald',
                  items: ['PostgreSQL (NeonDB)', 'pgvector extension', '31 tables', 'Raw SQL (no ORM)', 'UUID primary keys'],
                },
                {
                  layer: 'AI & Models',
                  color: 'purple',
                  items: ['Claude Sonnet 4.6', 'MedGemma 1.5 4B', 'Gemini 2.5 Flash', 'GPT-4o / GPT-4.1', 'text-embedding-3-small', 'EasyOCR'],
                },
                {
                  layer: 'Infrastructure',
                  color: 'amber',
                  items: ['Modal.com (serverless GPU)', 'Cloudinary (image storage)', 'NeonDB (serverless Postgres)', 'ngrok (dev tunneling)'],
                },
                {
                  layer: 'External APIs',
                  color: 'red',
                  items: ['Anthropic API', 'OpenAI API', 'Google Gemini API', 'Google Places API', 'Google OAuth', 'NIH RxNorm API', 'Tavily Search API', 'Mailtrap (email)'],
                },
              ].map(({ layer, color, items }) => (
                <Card key={layer}>
                  <div className="font-semibold text-white mb-3">{layer}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((item) => (
                      <Badge key={item} color={color}>{item}</Badge>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* ── API REFERENCE ── */}
          <section>
            <SectionHeading id="api" title="API Reference" subtitle={`${API_ENDPOINTS.length} endpoints across 11 route groups`} />

            <a
              href="https://registry.scalar.com/@default-team-ptg7m/apis/rxsense-api@latest"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mb-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 transition-all rounded-lg px-4 py-2.5 text-sm text-slate-300 hover:text-white"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              View full interactive API docs on Scalar
              <span className="text-slate-500">↗</span>
            </a>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search endpoints..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium w-20">Method</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Path</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium hidden sm:table-cell">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredEndpoints.map(({ method, path, desc }) => (
                    <tr key={`${method}-${path}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[method]}`}>
                          {method}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-mono text-slate-300 text-xs">/api{path}</td>
                      <td className="py-2 px-4 text-slate-400 hidden sm:table-cell">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <p className="text-slate-500 text-xs mt-2">All protected endpoints require <code className="bg-slate-800 px-1 rounded">Authorization: Bearer &lt;token&gt;</code> header.</p>
          </section>

          {/* ── DATABASE ── */}
          <section>
            <SectionHeading id="database" title="Database Schema" subtitle="31 PostgreSQL tables · pgvector extension · NeonDB serverless" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  group: 'Auth & Users',
                  color: 'blue',
                  tables: [
                    'users — shared registry (patient + doctor)',
                    'patient — demographics, vitals, blood group',
                    'doctor — specialties[], license, daily_limit',
                  ],
                },
                {
                  group: 'Facilities & Availability',
                  color: 'teal',
                  tables: [
                    'hospital — name, location, type',
                    'doctor_hospital — M:N affiliation, is_primary',
                    'doctor_availability — date, start_time, end_time',
                  ],
                },
                {
                  group: 'Appointments',
                  color: 'emerald',
                  tables: [
                    'appointment — status lifecycle, serial_number',
                    '  status: booked → arrived → in_progress → completed',
                  ],
                },
                {
                  group: 'Patient Health Records',
                  color: 'emerald',
                  tables: [
                    'known_condition — icd_10, status, severity',
                    'surgical_history — procedure, outcome, anaesthesia',
                    'vaccination_record — cvx_code, next_due_date',
                    'patient_allergy — severity, reaction_type, llm_flagged',
                    'patient_vitals — bp, heart_rate, glucose, weight',
                  ],
                },
                {
                  group: 'Prescriptions & Drugs',
                  color: 'purple',
                  tables: [
                    'prescription — doctor-issued, interaction_alert',
                    'prescription_item — dosage, frequency, duration_days',
                    'prescription_scan — +rx_status +rx_end_date',
                    'drug / drugs / drugbank_drug — three catalog tables',
                    'drug_interaction / drug_interactions — DDI pairs',
                  ],
                },
                {
                  group: 'Reports & Metrics',
                  color: 'amber',
                  tables: [
                    'medical_report — patient_json editable',
                    'report_metric — value + status editable',
                    'lab_test_info — reference ranges',
                  ],
                },
                {
                  group: 'AI & Intelligence',
                  color: 'red',
                  tables: [
                    'symptom_log — JSONB Q&A, body_system',
                    'ai_risk_assessment — conditions[], cancer_risk_flag',
                    'patient_insights — 24h TTL insights JSON',
                    'rag_documents — pgvector + source_type + weight',
                    'llm_query_log — full audit trail (tokens, model)',
                  ],
                },
                {
                  group: 'Family & Chat',
                  color: 'slate',
                  tables: [
                    'family_link — relationship, share_code',
                    'chat_session — conversation metadata',
                    'chat_message — role, content, timestamp',
                  ],
                },
              ].map(({ group, tables, color }) => (
                <Card key={group}>
                  <div className="font-semibold text-white mb-3">{group}</div>
                  <div className="space-y-1">
                    {tables.map((t) => (
                      <div key={t} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                        <code className="text-slate-300 text-xs leading-relaxed">{t}</code>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* ── SECURITY ── */}
          <section>
            <SectionHeading id="security" title="Security" subtitle="Auth, RBAC, and data protection" />
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'Authentication',
                  points: [
                    'JWT access tokens (30-min TTL)',
                    'JWT refresh tokens (30-day TTL)',
                    'Google OAuth via ID token verification',
                    'Email verification before login',
                    'Rate limiting on all auth endpoints',
                  ],
                },
                {
                  title: 'Password Security',
                  points: [
                    'bcrypt hashing with 13 salt rounds',
                    'Time-expiring password reset tokens via email',
                    'Account lockout after failed attempts',
                    'No plain-text credentials stored anywhere',
                    'Secure reset via email link only',
                  ],
                },
                {
                  title: 'Access Control',
                  points: [
                    'Role-based: patient vs doctor middleware',
                    'Separate auth middleware per route group',
                    'Patients cannot access doctor routes',
                    'Family health access gated by link_id ownership',
                    'Doctor sees only affiliated patients',
                  ],
                },
                {
                  title: 'Data Protection',
                  points: [
                    'Medical images stored on Cloudinary (private URLs)',
                    'All patient data behind JWT auth',
                    'LLM audit trail in llm_query_log table',
                    'AI responses grounded in RAG (reduces hallucination)',
                    'Emergency override in symptom checker for safety',
                  ],
                },
              ].map(({ title, points }) => (
                <Card key={title}>
                  <div className="font-semibold text-white mb-3">{title}</div>
                  <ul className="space-y-1.5">
                    {points.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-slate-400">
                        <span className="text-emerald-400 shrink-0">✓</span> {p}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>

          {/* ── ROADMAP ── */}
          <section>
            <SectionHeading id="roadmap" title="Roadmap" />
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  phase: 'Short Term',
                  timeframe: '0–3 months',
                  color: 'emerald',
                  items: [
                    'Real-time push notifications for critical lab values',
                    'PDF export of health reports and prescriptions',
                    'Medication reminder system with push alerts',
                    'Voice input for symptom checker',
                    'Doctor in-app messaging with patients',
                  ],
                },
                {
                  phase: 'Mid Term',
                  timeframe: '3–9 months',
                  color: 'blue',
                  items: [
                    'Wearable device integration (heart rate, glucose)',
                    'Predictive risk scoring with dedicated ML models',
                    'Doctor-patient video consultation',
                    'Insurance claim document generation',
                    'Community health worker portal',
                  ],
                },
                {
                  phase: 'Long Term',
                  timeframe: '9–24 months',
                  color: 'purple',
                  items: [
                    'Hospital EHR system integration',
                    'Government health database API',
                    'Population-level analytics for NGOs',
                    'Offline mode for low-connectivity areas',
                    'Multi-country rollout across South Asia',
                  ],
                },
              ].map(({ phase, timeframe, color, items }) => (
                <Card key={phase}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge color={color}>{phase}</Badge>
                    <span className="text-slate-500 text-xs">{timeframe}</span>
                  </div>
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-slate-400">
                        <span className="text-slate-600 shrink-0">→</span> {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>

          {/* ── TEAM ── */}
          <section>
            <SectionHeading id="team" title="Team" subtitle="Infinity AI Buildfest 2026" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {TEAM.map(({ name, role, phone, avatar }) => (
                <Card key={name} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
                    {avatar}
                  </div>
                  <div className="font-semibold text-white">{name}</div>
                  <div className="text-slate-400 text-sm mt-1">{role}</div>
                  <div className="text-emerald-400 text-xs mt-2 font-mono">{phone}</div>
                </Card>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-slate-800 pt-8 text-center text-slate-500 text-sm">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">Rx</div>
              <span className="text-white font-semibold">RxSense</span>
            </div>
            <p>Built for Infinity AI Buildfest 2026 · HealthTech · Risk Prediction Engine</p>
            <p className="mt-1">© 2026 RxSense Team. All rights reserved.</p>
          </footer>

        </main>
      </div>
    </div>
  );
}
