import { useState, useEffect, useRef } from 'react';

const NAV_SECTIONS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'problem',       label: 'Problem' },
  { id: 'solution',      label: 'Solution' },
  { id: 'features',      label: 'Features' },
  { id: 'architecture',  label: 'Architecture' },
  { id: 'dataflow',      label: 'Data Flow' },
  { id: 'ai',            label: 'AI & Models' },
  { id: 'rag',           label: 'RAG Pipeline' },
  { id: 'stack',         label: 'Tech Stack' },
  { id: 'api',           label: 'API Reference' },
  { id: 'database',      label: 'Database' },
  { id: 'security',      label: 'Security' },
  { id: 'roadmap',       label: 'Roadmap' },
  { id: 'team',          label: 'Team' },
];

const TEAM = [
  { name: 'Pritom Biswas',       role: 'Team Lead · Full-Stack & AI Engineer', phone: '+880 01753861838', avatar: 'PB' },
  { name: 'Ananta Debnath',      role: 'Member · Full-Stack & AI Engineer',           phone: '+880 1728564128',  avatar: 'AD' },
  { name: 'Shadman Sami Shanon', role: 'Member · Full-Stack & AI Engineer',          phone: '+880 1873346089',  avatar: 'SS' },
  { name: 'Tafsir Al Nafin',     role: 'Member · Full-Stack & AI Engineer',          phone: '+880 1700645096',  avatar: 'TN' },
];

const API_ENDPOINTS = [
  { method: 'POST', path: '/auth/register',               desc: 'Register new patient account' },
  { method: 'POST', path: '/auth/login',                  desc: 'Login with email and password' },
  { method: 'POST', path: '/auth/google-login',           desc: 'Login via Google OAuth' },
  { method: 'GET',  path: '/auth/verify-token',           desc: 'Verify JWT access token' },
  { method: 'POST', path: '/auth/password/reset',         desc: 'Reset password via token' },
  { method: 'GET',  path: '/patient/me',                  desc: 'Get current patient profile' },
  { method: 'PUT',  path: '/patient/me',                  desc: 'Update patient profile' },
  { method: 'GET',  path: '/patient/me/health-summary',   desc: 'AI-generated health summary' },
  { method: 'POST', path: '/patient/reports/analyze',     desc: 'Upload & analyze lab report image' },
  { method: 'POST', path: '/patient/reports/chat',        desc: 'Chat with AI about a report' },
  { method: 'GET',  path: '/patient/timeline',            desc: 'Chronological health timeline' },
  { method: 'POST', path: '/prescription/analyze',        desc: 'Analyze prescription image via OCR' },
  { method: 'GET',  path: '/prescription/history',        desc: 'Prescription scan history' },
  { method: 'POST', path: '/prescription/chat',           desc: 'Chat about a prescription' },
  { method: 'POST', path: '/symptom/check',               desc: 'AI symptom assessment (Claude agent)' },
  { method: 'POST', path: '/drugs/interactions',          desc: 'Check drug-drug interactions' },
  { method: 'GET',  path: '/insights',                    desc: 'Health insights & risk score' },
  { method: 'POST', path: '/insights/patient-summary',   desc: 'AI patient health narrative' },
  { method: 'POST', path: '/insights/doctor-summary',    desc: 'AI clinical summary for doctor' },
  { method: 'GET',  path: '/family/my-code',             desc: 'Get family share code' },
  { method: 'POST', path: '/family/link',                desc: 'Link a family member' },
  { method: 'GET',  path: '/family/members/:id/health',  desc: 'View family member health' },
  { method: 'POST', path: '/doctor/register',            desc: 'Register doctor account' },
  { method: 'GET',  path: '/doctor/patients',            desc: 'Get assigned patients' },
  { method: 'POST', path: '/doctor/patients/:id/prescriptions', desc: 'Create prescription for patient' },
  { method: 'POST', path: '/doctor/patients/:id/check-safety',  desc: 'Drug safety check before prescribing' },
  { method: 'GET',  path: '/places/nearby',              desc: 'Find nearby hospitals & pharmacies' },
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
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color]}`}>
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
  };
  return (
    <div className={`border rounded-lg px-4 py-2.5 text-center text-sm font-medium ${colors[color]}`}>
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
                  predicts health risks, and connects families — making clinical intelligence accessible
                  to every patient regardless of medical literacy.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'API Endpoints', value: '47' },
                  { label: 'Database Tables', value: '24' },
                  { label: 'AI Models', value: '5' },
                  { label: 'RAG Sources', value: '4' },
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
                  { title: 'Prescription Confusion', desc: 'Patients cannot read or understand what doctors write' },
                  { title: 'Lab Report Overload', desc: 'Complex clinical values are meaningless without context' },
                  { title: 'No Risk Continuity', desc: 'Nobody tracks patterns across visits to predict early risk' },
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
                { title: 'Prescription Analysis', desc: 'Upload a photo — AI extracts drugs, dosages, and frequencies using MedGemma OCR + Claude vision', icon: '💊' },
                { title: 'Lab Report Interpretation', desc: 'AI reads lab values, flags abnormals against MedlinePlus ranges, and explains results in plain Bangla or English', icon: '🧪' },
                { title: 'Risk Prediction', desc: 'Health score + trend analysis across visits detects early signs of diabetes, cardiovascular risk, and more', icon: '📊' },
                { title: 'Symptom Checker', desc: 'Claude agent with tool-use fetches patient history and medical literature to give personalised assessments', icon: '🩺' },
                { title: 'Drug Interaction Safety', desc: 'Cross-references active medications against DrugBank to warn about dangerous combinations', icon: '⚠️' },
                { title: 'Family Health Network', desc: 'Share codes connect family members so caregivers stay informed about their loved ones\' health', icon: '👨‍👩‍👧' },
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
            <SectionHeading id="features" title="Feature Matrix" subtitle="Current capabilities" />
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
                    ['Prescription OCR + Analysis', 'Patient', 'Live'],
                    ['Lab Report Analysis', 'Patient', 'Live'],
                    ['AI Symptom Checker', 'Patient', 'Live'],
                    ['Drug Interaction Checker', 'Patient / Doctor', 'Live'],
                    ['Health Dashboard + Risk Score', 'Patient', 'Live'],
                    ['Health Timeline', 'Patient', 'Live'],
                    ['Family Health Network', 'Patient', 'Live'],
                    ['Nearby Facilities (Google Maps)', 'Patient', 'Live'],
                    ['Doctor Portal', 'Doctor', 'Live'],
                    ['Prescription Safety Check', 'Doctor', 'Live'],
                    ['Patient Chart View', 'Doctor', 'Live'],
                    ['Bangla / English UI', 'Both', 'Live'],
                    ['Google OAuth Login', 'Patient', 'Live'],
                    ['Email Verification', 'Both', 'Live'],
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
            <SectionHeading id="architecture" title="System Architecture" subtitle="How the three services connect" />
            <Card>
              <div className="space-y-3">
                {/* Frontend */}
                <div className="grid grid-cols-3 gap-2">
                  <FlowBox label="Patient App" sub="React 19 + Vite" color="blue" />
                  <FlowBox label="Doctor Portal" sub="React 19 + Vite" color="blue" />
                  <FlowBox label="Public /docs" sub="React 19 + Vite" color="blue" />
                </div>
                <Arrow />
                {/* API Gateway */}
                <FlowBox label="Express 5 REST API" sub="Node.js · JWT Auth · Rate Limiting · Swagger /api/docs" color="teal" />
                <Arrow />
                {/* Services row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <FlowBox label="Auth Service" sub="bcrypt · JWT" color="slate" />
                  <FlowBox label="AI Service" sub="Claude · Gemini · GPT-4o" color="purple" />
                  <FlowBox label="OCR Service" sub="MedGemma · Modal GPU" color="amber" />
                  <FlowBox label="File Service" sub="Multer · Sharp · Cloudinary" color="slate" />
                </div>
                <Arrow />
                {/* Data layer */}
                <div className="grid grid-cols-2 gap-2">
                  <FlowBox label="PostgreSQL" sub="24 tables · NeonDB serverless" color="emerald" />
                  <FlowBox label="pgvector" sub="RAG embeddings · cosine similarity" color="emerald" />
                </div>
                <Arrow />
                {/* External */}
                <div className="grid grid-cols-3 gap-2">
                  <FlowBox label="Anthropic API" sub="Claude Sonnet 4.6" color="purple" />
                  <FlowBox label="OpenAI API" sub="GPT-4o · Embeddings" color="purple" />
                  <FlowBox label="Google APIs" sub="Gemini · Places · OAuth" color="purple" />
                </div>
              </div>
            </Card>
          </section>

          {/* ── DATA FLOW ── */}
          <section>
            <SectionHeading id="dataflow" title="Data Flow" subtitle="Prescription & lab report analysis pipeline" />
            <div className="grid sm:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-semibold text-white mb-4">Prescription Analysis Pipeline</h3>
                <div className="space-y-2">
                  <FlowBox label="User uploads image" sub="JPEG / PNG / PDF" color="blue" />
                  <Arrow />
                  <FlowBox label="Sharp converts to JPEG" sub="Format normalisation" color="slate" />
                  <Arrow />
                  <FlowBox label="Cloudinary stores image" sub="Returns public URL" color="slate" />
                  <Arrow />
                  <FlowBox label="MedGemma 1.5 4B (Modal GPU)" sub="OCR + medical text extraction" color="amber" />
                  <Arrow />
                  <FlowBox label="Claude / Gemini analysis" sub="Structures extracted text to JSON" color="purple" />
                  <Arrow />
                  <FlowBox label="Saved to prescription_scan" sub="PostgreSQL" color="emerald" />
                  <Arrow />
                  <FlowBox label="Returned to patient" sub="Drugs · dosages · follow-up" color="blue" />
                </div>
              </Card>
              <Card>
                <h3 className="font-semibold text-white mb-4">Symptom Checker Agent Pipeline</h3>
                <div className="space-y-2">
                  <FlowBox label="User sends symptom message" sub="+ full conversation history" color="blue" />
                  <Arrow />
                  <FlowBox label="SymptomAgent builds context" sub="History formatted as रोगी / ডাক্তার" color="slate" />
                  <Arrow />
                  <FlowBox label="Claude Sonnet 4.6 (Turn 1)" sub="Decides: ask more OR use tools" color="purple" />
                  <Arrow />
                  <div className="grid grid-cols-2 gap-2">
                    <FlowBox label="get_patient_profile" sub="age · conditions · allergies" color="teal" />
                    <FlowBox label="rag_search" sub="Harrison's · Davidson's · MedlinePlus" color="teal" />
                  </div>
                  <Arrow />
                  <FlowBox label="Claude synthesises (up to 8 turns)" sub="Tool results injected back" color="purple" />
                  <Arrow />
                  <FlowBox label="Bangla assessment returned" sub="+ EMERGENCY_CARD if critical" color="emerald" />
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
                  role: 'Primary AI — lab report analysis, prescription understanding, symptom assessment agent (tool-use loop, max 8 turns), health insights generation, patient and doctor summary creation',
                  badge: 'primary',
                },
                {
                  model: 'MedGemma 1.5 4B',
                  provider: 'Google (open-weight)',
                  role: 'Prescription image OCR and medical text extraction — runs on Modal.com serverless GPU. Purpose-built for medical vision tasks.',
                  badge: 'vision',
                },
                {
                  model: 'Gemini 2.5 Flash',
                  provider: 'Google',
                  role: 'Cost-effective fallback for prescription analysis flows when Claude is unavailable or for high-volume scenarios.',
                  badge: 'fallback',
                },
                {
                  model: 'GPT-4o / GPT-4o-mini',
                  provider: 'OpenAI',
                  role: 'Prescription and report chat conversations, health insights agent runner (openaiAgentRunner.js).',
                  badge: 'chat',
                },
                {
                  model: 'text-embedding-ada-002',
                  provider: 'OpenAI',
                  role: 'Generates vector embeddings for the RAG knowledge base stored in pgvector. Used at both ingestion time and query time.',
                  badge: 'embeddings',
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
                    { source: "Davidson's Principles and Practice of Medicine", weight: '1.0', type: 'medical_book' },
                    { source: 'MedlinePlus Lab Test References', weight: '1.0', type: 'medical_book' },
                    { source: 'Patient Lab Reports', weight: '0.7', type: 'patient_report' },
                    { source: 'Patient Profile', weight: '0.6', type: 'patient_profile' },
                    { source: 'Chat History', weight: '0.3', type: 'chat_history' },
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
                    ['Vector Store', 'pgvector inside PostgreSQL'],
                    ['Embedding Model', 'text-embedding-ada-002'],
                    ['Similarity', 'Cosine distance'],
                    ['Score formula', '(1 - cosine_dist) × weight'],
                    ['Min score threshold', '0.25'],
                    ['Top-K', '6 default · 10 max'],
                    ['Chunking', 'Semantic (chapter / topic)'],
                    ['Global sources', 'Books (user_id IS NULL)'],
                    ['Private sources', 'Per-patient vectors'],
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
                <FlowBox label="Top-K chunks returned" color="slate" />
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
                  items: ['PostgreSQL (NeonDB)', 'pgvector extension', '24 tables', 'Raw SQL (no ORM)', 'UUID primary keys'],
                },
                {
                  layer: 'AI & Models',
                  color: 'purple',
                  items: ['Claude Sonnet 4.6', 'MedGemma 1.5 4B', 'Gemini 2.5 Flash', 'GPT-4o / GPT-4o-mini', 'text-embedding-ada-002'],
                },
                {
                  layer: 'Infrastructure',
                  color: 'amber',
                  items: ['Modal.com (serverless GPU)', 'Cloudinary (image storage)', 'NeonDB (serverless PostgreSQL)', 'ngrok (dev tunneling)'],
                },
                {
                  layer: 'External APIs',
                  color: 'red',
                  items: ['Anthropic API', 'OpenAI API', 'Google Gemini API', 'Google Places API', 'Google OAuth', 'Mailtrap (email)', 'Prescripto OCR API'],
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
            <SectionHeading id="api" title="API Reference" subtitle={`${API_ENDPOINTS.length} endpoints across 10 route groups`} />
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
            <SectionHeading id="database" title="Database Schema" subtitle="24 PostgreSQL tables" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { group: 'Auth & Users', tables: ['users', 'patient', 'doctor'], color: 'blue' },
                { group: 'Healthcare Facilities', tables: ['hospital', 'doctor_hospital'], color: 'teal' },
                { group: 'Patient Health', tables: ['known_condition', 'surgical_history', 'vaccination_record', 'patient_allergy'], color: 'emerald' },
                { group: 'Medications', tables: ['drug', 'drug_interaction', 'drugbank_drug', 'prescription', 'prescription_item', 'prescription_scan'], color: 'purple' },
                { group: 'Reports & Metrics', tables: ['medical_report', 'report_metric', 'lab_test_info'], color: 'amber' },
                { group: 'AI & Intelligence', tables: ['symptom_log', 'ai_risk_assessment', 'llm_query_log', 'rag_documents', 'patient_insights'], color: 'red' },
                { group: 'Social', tables: ['family_link'], color: 'slate' },
              ].map(({ group, tables, color }) => (
                <Card key={group}>
                  <div className="font-semibold text-white mb-3">{group}</div>
                  <div className="space-y-1">
                    {tables.map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <code className="text-slate-300 text-xs">{t}</code>
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
                    'Time-expiring password reset tokens',
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
                    'Family health access gated by link_id',
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
                    'Real-time notifications for critical lab values',
                    'PDF export of health reports',
                    'Appointment booking with nearby doctors',
                    'Medication reminder system',
                    'Voice input for symptom checker',
                  ],
                },
                {
                  phase: 'Mid Term',
                  timeframe: '3–9 months',
                  color: 'blue',
                  items: [
                    'Wearable device integration (heart rate, glucose)',
                    'Predictive risk scoring with trend ML models',
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
                    'Population-level health analytics for NGOs',
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
