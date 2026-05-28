import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Menu, X, Edit2, Save, Plus, Share2, Printer, AlertTriangle, ChevronRight,
  Upload, CheckCircle, Loader2,
} from 'lucide-react';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmergencyCard from '../components/history/EmergencyCard.jsx';
import { getHealthSummary, updatePatientProfile, getPrescriptionHistoryLocal, analyzeReport } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const MANUAL_KEY = 'rxsense_manual_metrics';

const SECTIONS = [
  { id: 'overview',    label: 'Overview',          icon: '📋' },
  { id: 'general',     label: 'General Info',       icon: '👤' },
  { id: 'blood_sugar', label: 'Blood Sugar',        icon: '🩸' },
  { id: 'cbc',         label: 'CBC',                icon: '🔬' },
  { id: 'kidney',      label: 'Kidney Function',    icon: '🫘' },
  { id: 'liver',       label: 'Liver Function',     icon: '🫁' },
  { id: 'lipid',       label: 'Lipid Profile',      icon: '💉' },
  { id: 'thyroid',     label: 'Thyroid',            icon: '⚕️' },
  { id: 'conditions',  label: 'Conditions',         icon: '🏥' },
  { id: 'emergency',   label: 'Emergency Contact',  icon: '🚨' },
];

const PARAM_MAP = {
  hemoglobin:       { aliases: ['hemoglobin','hb','haemoglobin'],                                        label: 'Hemoglobin',        unit: 'g/dL',   validity: 180,
    desc: { en: 'Protein in red blood cells that carries oxygen through the body. Low levels mean anemia.', bn: 'লোহিত রক্তকণিকায় প্রোটিন যা অক্সিজেন বহন করে। কম মাত্রা রক্তশূন্যতার লক্ষণ।' } },
  wbc:              { aliases: ['wbc','white blood cell','white blood cells','leukocyte','total wbc'],   label: 'WBC',               unit: '10³/µL', validity: 180,
    desc: { en: 'White blood cells that fight infection. High or low levels can indicate illness or immune problems.', bn: 'শ্বেত রক্তকণিকা যা সংক্রমণের বিরুদ্ধে লড়াই করে। অস্বাভাবিক মাত্রা রোগের ইঙ্গিত দেয়।' } },
  platelets:        { aliases: ['platelet','platelets','plt','thrombocyte','platelet count'],             label: 'Platelets',         unit: '10³/µL', validity: 180,
    desc: { en: 'Tiny cells that help blood clot after injury. Very low levels increase bleeding risk.', bn: 'ক্ষুদ্র কণিকা যা আঘাতের পর রক্ত জমাট বাঁধতে সাহায্য করে। কম মাত্রায় রক্তক্ষরণের ঝুঁকি বাড়ে।' } },
  hematocrit:       { aliases: ['hematocrit','haematocrit','pcv','packed cell volume'],                  label: 'Hematocrit',        unit: '%',      validity: 180,
    desc: { en: 'Percentage of red blood cells in blood. Low values suggest anemia; high values may indicate dehydration.', bn: 'রক্তে লোহিত কণিকার শতকরা পরিমাণ। কম মাত্রা রক্তশূন্যতা, বেশি মাত্রা পানিশূন্যতার ইঙ্গিত দিতে পারে।' } },
  hba1c:            { aliases: ['hba1c','hb a1c','glycated hemoglobin','a1c','hemoglobin a1c'],          label: 'HbA1c',             unit: '%',      validity: 90,
    desc: { en: 'Average blood sugar over the past 3 months. The key test for diabetes diagnosis and management.', bn: 'গত ৩ মাসের গড় রক্তের শর্করার মাত্রা। ডায়াবেটিস নির্ণয় ও নিয়ন্ত্রণের প্রধান পরীক্ষা।' } },
  rbs:              { aliases: ['rbs','random blood sugar','random blood glucose','random glucose'],      label: 'RBS',               unit: 'mg/dL',  validity: 1,
    desc: { en: 'Blood sugar measured at any random time. Used for quick screening, not for diabetes diagnosis alone.', bn: 'যেকোনো সময়ে রক্তে শর্করার পরিমাণ। দ্রুত পরীক্ষার জন্য ব্যবহৃত হয়, একা ডায়াবেটিস নির্ণয়ে যথেষ্ট নয়।' } },
  fbs:              { aliases: ['fbs','fasting blood sugar','fasting blood glucose','fasting glucose'],  label: 'FBS',               unit: 'mg/dL',  validity: 30,
    desc: { en: 'Blood sugar after at least 8 hours of fasting. Primary test for diagnosing diabetes.', bn: 'কমপক্ষে ৮ ঘণ্টা না খেয়ে থাকার পর রক্তের শর্করা। ডায়াবেটিস শনাক্তের প্রাথমিক পরীক্ষা।' } },
  creatinine:       { aliases: ['creatinine','serum creatinine','s. creatinine','s creatinine'],         label: 'Creatinine',        unit: 'mg/dL',  validity: 90,
    desc: { en: 'Waste product filtered by the kidneys. High levels suggest the kidneys are not working properly.', bn: 'কিডনি দ্বারা পরিশোধিত বর্জ্য পদার্থ। বেশি মাত্রা কিডনির দুর্বলতার ইঙ্গিত দেয়।' } },
  bun:              { aliases: ['bun','blood urea nitrogen','urea','blood urea','serum urea'],           label: 'BUN',               unit: 'mg/dL',  validity: 180,
    desc: { en: 'Measures kidney and liver health together. Always read alongside creatinine for full kidney picture.', bn: 'কিডনি ও যকৃতের স্বাস্থ্য একসাথে পরিমাপ করে। পূর্ণ চিত্রের জন্য সর্বদা ক্রিয়েটিনিনের সাথে দেখুন।' } },
  sgpt:             { aliases: ['sgpt','alt','alanine aminotransferase','alanine transaminase'],         label: 'SGPT / ALT',        unit: 'U/L',    validity: 90,
    desc: { en: 'Liver enzyme. High levels indicate liver damage, fatty liver, or hepatitis.', bn: 'যকৃতের এনজাইম। বেশি মাত্রা যকৃতের ক্ষতি, ফ্যাটি লিভার বা হেপাটাইটিসের ইঙ্গিত।' } },
  sgot:             { aliases: ['sgot','ast','aspartate aminotransferase','aspartate transaminase'],     label: 'SGOT / AST',        unit: 'U/L',    validity: 90,
    desc: { en: 'Found in liver and heart. Must always be tested together with SGPT for a complete liver assessment.', bn: 'যকৃত ও হৃদপিণ্ডে পাওয়া যায়। পূর্ণ যকৃত মূল্যায়নের জন্য সর্বদা SGPT-এর সাথে পরীক্ষা করতে হবে।' } },
  bilirubin:        { aliases: ['bilirubin','total bilirubin','bilirubin total','serum bilirubin'],      label: 'Bilirubin',         unit: 'mg/dL',  validity: 365,
    desc: { en: 'Yellow pigment from broken-down red blood cells. High levels cause jaundice (yellow skin/eyes).', bn: 'ভেঙে যাওয়া লোহিত কণিকা থেকে তৈরি হলুদ রঞ্জক। বেশি মাত্রায় জন্ডিস হয় (ত্বক/চোখ হলুদ হয়)।' } },
  totalCholesterol: { aliases: ['total cholesterol','cholesterol total','cholesterol','tc'],             label: 'Total Cholesterol', unit: 'mg/dL',  validity: 365,
    desc: { en: 'Total fat in blood from all sources. High levels increase the risk of heart disease and stroke.', bn: 'রক্তে সব উৎস থেকে মোট চর্বি। বেশি মাত্রা হৃদরোগ ও স্ট্রোকের ঝুঁকি বাড়ায়।' } },
  ldl:              { aliases: ['ldl','ldl cholesterol','ldl-c','low density lipoprotein'],              label: 'LDL',               unit: 'mg/dL',  validity: 365,
    desc: { en: '"Bad" cholesterol. High LDL builds up in arteries and raises the risk of heart attack.', bn: '"খারাপ" কোলেস্টেরল। বেশি LDL ধমনীতে জমা হয় এবং হার্ট অ্যাটাকের ঝুঁকি বাড়ায়।' } },
  hdl:              { aliases: ['hdl','hdl cholesterol','hdl-c','high density lipoprotein'],             label: 'HDL',               unit: 'mg/dL',  validity: 365,
    desc: { en: '"Good" cholesterol. Higher HDL removes bad cholesterol and protects the heart.', bn: '"ভালো" কোলেস্টেরল। বেশি HDL খারাপ কোলেস্টেরল সরিয়ে হৃদয় রক্ষা করে।' } },
  triglycerides:    { aliases: ['triglycerides','tg','triglyceride','serum triglyceride'],               label: 'Triglycerides',     unit: 'mg/dL',  validity: 180,
    desc: { en: 'Fat stored from excess calories. High levels are linked to heart disease and pancreatitis.', bn: 'অতিরিক্ত ক্যালোরি থেকে জমা চর্বি। বেশি মাত্রা হৃদরোগ ও অগ্ন্যাশয়ের সমস্যার সাথে যুক্ত।' } },
  tsh:              { aliases: ['tsh','thyroid stimulating hormone','thyrotropin'],                      label: 'TSH',               unit: 'mIU/L',  validity: 365,
    desc: { en: 'Controls thyroid hormone production. Abnormal levels affect metabolism, energy, and body weight.', bn: 'থাইরয়েড হরমোন উৎপাদন নিয়ন্ত্রণ করে। অস্বাভাবিক মাত্রা বিপাক, শক্তি ও শরীরের ওজনকে প্রভাবিত করে।' } },
  freeT4:           { aliases: ['free t4','ft4','free thyroxine','t4 free','ft4 free'],                 label: 'Free T4',           unit: 'ng/dL',  validity: 365,
    desc: { en: 'Active thyroid hormone in blood. Tested when TSH is abnormal to confirm thyroid disease.', bn: 'রক্তে সক্রিয় থাইরয়েড হরমোন। TSH অস্বাভাবিক হলে থাইরয়েড রোগ নিশ্চিত করতে পরীক্ষা করা হয়।' } },
};

const BLOOD_GROUPS   = ['A+','A-','B+','B-','O+','O-','AB+','AB-'].map((v) => ({ value: v, label: v }));
const SMOKING_STATUS = [
  { value: 'non_smoker', label: 'Non-smoker' },
  { value: 'smoker',     label: 'Smoker'     },
  { value: 'ex_smoker',  label: 'Ex-smoker'  },
];
const GENDER_OPTIONS = [
  { value: 'Male',              label: 'Male'               },
  { value: 'Female',            label: 'Female'             },
  { value: 'Other',             label: 'Other'              },
  { value: 'Prefer not to say', label: 'Prefer not to say'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeMetrics(rawList, manual = {}) {
  const result = {};
  for (const [key, def] of Object.entries(PARAM_MAP)) {
    const fromReport = rawList.find((m) =>
      def.aliases.some((a) => m.parameterName?.toLowerCase().includes(a))
    );
    const fromManual = manual[key];
    // Manual entry wins only if newer
    let chosen = fromReport ? { ...fromReport, label: def.label, unit: fromReport.unit || def.unit, validity: def.validity } : null;
    if (fromManual?.value) {
      const manualNewer = !chosen?.recordedAt || new Date(fromManual.recordedAt) > new Date(chosen.recordedAt);
      if (manualNewer) chosen = { ...fromManual, label: def.label, unit: fromManual.unit || def.unit, validity: def.validity, manual: true };
    }
    result[key] = chosen;
  }
  if (result.creatinine?.value) {
    const cr = parseFloat(result.creatinine.value);
    if (!isNaN(cr) && cr > 0) {
      result.egfr = { label: 'eGFR', unit: 'mL/min/1.73m²', value: String(Math.round(186 * Math.pow(cr, -1.154))), status: 'auto', validity: 90, recordedAt: result.creatinine.recordedAt };
    }
  }
  return result;
}

function computeFlag(m) {
  if (!m?.value) return 'MISSING';
  const days = m.recordedAt ? (Date.now() - new Date(m.recordedAt).getTime()) / 86400000 : Infinity;
  if (days > (m.validity ?? 365)) return 'OUTDATED';
  const map = { normal: 'NORMAL', high: 'HIGH', low: 'LOW', critical_high: 'CRITICAL', critical_low: 'CRITICAL' };
  return map[m.status] || 'NORMAL';
}

function computeCompleteness(profile, metrics) {
  if (!profile) return 0;
  const c = [
    Boolean(profile.dateOfBirth), Boolean(profile.gender), Boolean(profile.bloodGroup),
    Boolean(profile.phone), Boolean(profile.smokingStatus), Boolean(profile.height),
    Boolean(profile.weight), Boolean(profile.bloodPressureSystolic), Boolean(profile.emergencyContactName),
    (profile.conditions || []).length > 0, (profile.allergies || []).length > 0,
    Boolean(metrics.hba1c?.value || metrics.rbs?.value || metrics.fbs?.value),
    Boolean(metrics.hemoglobin?.value), Boolean(metrics.creatinine?.value),
    Boolean(metrics.sgpt?.value), Boolean(metrics.totalCholesterol?.value),
    Boolean(metrics.tsh?.value),
  ];
  return c.filter(Boolean).length / c.length;
}

function calcAge(dob) {
  if (!dob) return null;
  const d = new Date(dob), t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
}

function calcBMI(h, w) {
  if (!h || !w) return null;
  return (w / ((h / 100) ** 2)).toFixed(1);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function loadManual() {
  try { return JSON.parse(localStorage.getItem(MANUAL_KEY) || '{}'); } catch { return {}; }
}
function saveManual(data) {
  localStorage.setItem(MANUAL_KEY, JSON.stringify(data));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const FLAG_CLS = {
  NORMAL:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  HIGH:     'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  LOW:      'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  CRITICAL: 'bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-300 font-bold',
  OUTDATED: 'bg-gray-100 dark:bg-gray-800 text-gray-500',
  MISSING:  'bg-gray-100 dark:bg-gray-800 text-gray-400 italic',
};

function FlagBadge({ flag }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${FLAG_CLS[flag] || FLAG_CLS.MISSING}`}>
      {flag || 'MISSING'}
    </span>
  );
}

/** Reusable card shell with title + edit/save button in top-right */
function ProfileCard({ title, note, editing, onEdit, onSave, onCancel, saving, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" loading={saving} onClick={onSave}><Save className="w-3.5 h-3.5" /> Save</Button>
            <Button size="sm" variant="ghost" onClick={onCancel}><X className="w-3.5 h-3.5" /></Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </Button>
        )}
      </div>
      {children}
      {note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{note}</p>}
    </div>
  );
}

/** A single labelled row inside a card */
function Row({ label, value, flag, extra }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800/60 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400 w-44 flex-shrink-0">{label}</span>
      <span className="text-base font-semibold text-gray-900 dark:text-white flex-1">
        {value || <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>}
      </span>
      {extra && <span className="text-sm text-gray-400">{extra}</span>}
      {flag && <FlagBadge flag={flag} />}
    </div>
  );
}

/** Metric row that reads from the normalised metrics map */
function MetricRow({ metricKey, label, metric, desc }) {
  const flag = computeFlag(metric);
  return (
    <div className="py-3 border-b border-gray-100 dark:border-gray-800/60 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-48 flex-shrink-0">
          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{label}</span>
        </div>
        {metric?.value ? (
          <>
            <span className="text-base font-semibold text-gray-900 dark:text-white flex-1">
              {metric.value}
              {metric.unit && <span className="text-sm font-normal text-gray-400 ml-1">{metric.unit}</span>}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(metric.recordedAt)}</span>
            {metric.manual && <span className="text-xs text-blue-400 flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">manual</span>}
            <FlagBadge flag={flag} />
          </>
        ) : (
          <>
            <span className="text-base text-gray-300 dark:text-gray-600 flex-1">—</span>
            <FlagBadge flag="MISSING" />
          </>
        )}
      </div>
    </div>
  );
}

/** Inline text / select input for edit forms */
function Field({ label, name, value, onChange, type = 'text', options, readOnly }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</label>
      {options ? (
        <select name={name} value={value || ''} onChange={onChange}
          className="text-base border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">— select —</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={value || ''} onChange={onChange} readOnly={readOnly}
          className={`text-base border rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            readOnly
              ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
          }`} />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Main component
// ── Extract matching metrics from an analyzed report ─────────────────────────
function extractMetricsFromReport(report, sectionKeys) {
  const entries = (report?.sections || []).flatMap((s) => s.entries || []);
  const reportDate = new Date().toISOString();
  const found = {};
  for (const entry of entries) {
    if (!entry.label || entry.value === null || entry.value === undefined) continue;
    const labelLower = entry.label.toLowerCase();
    for (const key of sectionKeys) {
      if (found[key]) continue;
      const def = PARAM_MAP[key];
      if (!def) continue;
      if (def.aliases.some((a) => labelLower.includes(a))) {
        found[key] = {
          parameterName: entry.label,
          value:         String(entry.value),
          unit:          entry.unit || def.unit || '',
          status:        entry.status || 'normal',
          recordedAt:    reportDate,
        };
      }
    }
  }
  return found;
}

// ── Section report upload widget ─────────────────────────────────────────────
function SectionUpload({ sectionKeys, reportType, onExtracted }) {
  const fileRef = useRef(null);
  const [uploading, setUploading]   = useState(false);
  const [result,    setResult]      = useState(null); // { updated, notFound }

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const report = await analyzeReport(file, reportType);
      const found  = extractMetricsFromReport(report, sectionKeys);
      onExtracted(found);
      const updated  = Object.keys(found);
      const notFound = sectionKeys.filter((k) => !found[k]);
      setResult({ updated, notFound });
    } catch (err) {
      setResult({ error: err.message || 'Analysis failed.' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mb-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing report…</>
          : <><Upload className="w-4 h-4" /> Upload Report to Auto-fill</>
        }
      </button>

      {result && !result.error && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {result.updated.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> {PARAM_MAP[k]?.label || k}
            </span>
          ))}
          {result.notFound.map((k) => (
            <span key={k} className="text-xs text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
              {PARAM_MAP[k]?.label || k}: not found
            </span>
          ))}
        </div>
      )}
      {result?.error && (
        <p className="mt-2 text-xs text-red-500">{result.error}</p>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════

export default function HistoryProfile() {
  const { addToast } = useToast();
  const { lang }     = useLanguage();

  const [loading,    setLoading]    = useState(true);
  const [profile,    setProfile]    = useState(null);
  const [metrics,    setMetrics]    = useState({});
  const [manual,     setManual]     = useState(loadManual);
  const [recentMeds, setRecentMeds] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen,   setSidebarOpen]   = useState(true);

  // Per-card edit states
  const [editing, setEditing] = useState({});   // { cardId: true }
  const [saving,  setSaving]  = useState({});   // { cardId: true }

  // Form drafts
  const [generalForm,   setGeneralForm]   = useState({});
  const [bpForm,        setBpForm]        = useState({});
  const [emergencyForm, setEmergencyForm] = useState({});
  const [manualForm,    setManualForm]    = useState({});  // { key: { value, unit, recordedAt } }

  const startEdit  = (id) => setEditing((p) => ({ ...p, [id]: true }));
  const cancelEdit = (id) => setEditing((p) => ({ ...p, [id]: false }));

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { profile: p, metrics: raw } = await getHealthSummary();
      const m = loadManual();
      setManual(m);
      setProfile(p);
      setMetrics(normalizeMetrics(raw, m));
      setGeneralForm({
        dateOfBirth:   p?.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split('T')[0] : '',
        gender:        p?.gender        || '',
        bloodGroup:    p?.bloodGroup    || '',
        smokingStatus: p?.smokingStatus || '',
        height:        p?.height        || '',
        weight:        p?.weight        || '',
        phone:         p?.phone         || '',
      });
      setBpForm({
        bloodPressureSystolic: p?.bloodPressureSystolic || '',
        bloodPressureDiastolic: p?.bloodPressureDiastolic || '',
      });
      setEmergencyForm({
        emergencyContactName: p?.emergencyContactName || '',
        emergencyContactPhone: p?.emergencyContactPhone || '',
        emergencyContactRelation: p?.emergencyContactRelation || '',
      });
      const rx = getPrescriptionHistoryLocal();
      if (rx[0]?.medications?.length) setRecentMeds(rx[0].medications.slice(0, 5));
    } catch {
      addToast('Could not load health profile.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Save general info ─────────────────────────────────────────────────────
  const saveGeneral = async () => {
    setSaving((p) => ({ ...p, general: true }));
    try {
      const updated = await updatePatientProfile({
        dateOfBirth:   generalForm.dateOfBirth   || null,
        gender:        generalForm.gender        || null,
        bloodGroup:    generalForm.bloodGroup    || null,
        smokingStatus: generalForm.smokingStatus || null,
        height:        generalForm.height     ? Number(generalForm.height)  : null,
        weight:        generalForm.weight     ? Number(generalForm.weight)  : null,
        phone:         generalForm.phone         || null,
      });
      if (updated) setProfile((p) => ({ ...p, ...updated }));
      cancelEdit('general');
      addToast('General info saved.', 'success');
    } catch (e) { addToast(e.message || 'Save failed.', 'error'); }
    finally { setSaving((p) => ({ ...p, general: false })); }
  };

  const saveBP = async () => {
    setSaving((p) => ({ ...p, bp: true }));
    try {
      const updated = await updatePatientProfile({
        bloodPressureSystolic:  bpForm.bloodPressureSystolic  ? Number(bpForm.bloodPressureSystolic)  : null,
        bloodPressureDiastolic: bpForm.bloodPressureDiastolic ? Number(bpForm.bloodPressureDiastolic) : null,
        bpRecordedAt: new Date().toISOString(),
      });
      if (updated) setProfile((p) => ({ ...p, ...updated }));
      cancelEdit('bp');
      addToast('Blood pressure saved.', 'success');
    } catch (e) { addToast(e.message || 'Save failed.', 'error'); }
    finally { setSaving((p) => ({ ...p, bp: false })); }
  };

  const saveEmergency = async () => {
    setSaving((p) => ({ ...p, emergency: true }));
    try {
      const updated = await updatePatientProfile({
        emergencyContactName:     emergencyForm.emergencyContactName     || null,
        emergencyContactPhone:    emergencyForm.emergencyContactPhone    || null,
        emergencyContactRelation: emergencyForm.emergencyContactRelation || null,
      });
      if (updated) setProfile((p) => ({ ...p, ...updated }));
      cancelEdit('emergency');
      addToast('Emergency contact saved.', 'success');
    } catch (e) { addToast(e.message || 'Save failed.', 'error'); }
    finally { setSaving((p) => ({ ...p, emergency: false })); }
  };

  // ── Save manual metric entry ───────────────────────────────────────────────
  const startManualEdit = (sectionKeys) => {
    const draft = {};
    sectionKeys.forEach((k) => {
      draft[k] = {
        value: metrics[k]?.value || '',
        unit: metrics[k]?.unit || PARAM_MAP[k]?.unit || '',
        recordedAt: metrics[k]?.recordedAt ? metrics[k].recordedAt.split('T')[0] : new Date().toISOString().split('T')[0],
      };
    });
    setManualForm(draft);
    startEdit('manual_' + sectionKeys[0]);
  };

  const saveManualMetrics = (sectionKeys) => {
    const updated = { ...loadManual() };
    sectionKeys.forEach((k) => {
      if (manualForm[k]?.value) {
        updated[k] = {
          parameterName: PARAM_MAP[k]?.label || k,
          value: manualForm[k].value,
          unit:  manualForm[k].unit  || PARAM_MAP[k]?.unit || '',
          recordedAt: manualForm[k].recordedAt || new Date().toISOString(),
          status: 'normal',
        };
      }
    });
    saveManual(updated);
    setManual(updated);
    setMetrics((prev) => {
      // Re-derive only the affected keys
      const rawSnapshot = [];  // we just rely on manual override
      const patched = { ...prev };
      sectionKeys.forEach((k) => {
        if (updated[k]) {
          patched[k] = { ...updated[k], label: PARAM_MAP[k]?.label || k, validity: PARAM_MAP[k]?.validity || 365, manual: true };
        }
      });
      return patched;
    });
    cancelEdit('manual_' + sectionKeys[0]);
    addToast('Values saved.', 'success');
  };

  // ── Handle report-extracted metrics (from SectionUpload) ─────────────────
  const handleReportExtracted = useCallback((found) => {
    if (!Object.keys(found).length) { addToast('No matching values found in this report.', 'info'); return; }
    const updated = { ...loadManual() };
    Object.entries(found).forEach(([k, v]) => { updated[k] = v; });
    saveManual(updated);
    setManual(updated);
    setMetrics((prev) => {
      const patched = { ...prev };
      Object.entries(found).forEach(([k, v]) => {
        patched[k] = { ...v, label: PARAM_MAP[k]?.label || k, validity: PARAM_MAP[k]?.validity || 365, manual: true };
      });
      return patched;
    });
    addToast(`${Object.keys(found).length} value${Object.keys(found).length > 1 ? 's' : ''} updated from report.`, 'success');
  }, [addToast]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const age          = calcAge(profile?.dateOfBirth);
  const bmi          = calcBMI(profile?.height, profile?.weight);
  const conditions   = profile?.conditions   || [];
  const allergies    = profile?.allergies    || [];
  const surgeries    = profile?.surgeries    || [];
  const vaccinations = profile?.vaccinations || [];
  const completeness = computeCompleteness(profile, metrics);
  const bpFlag = (() => {
    const s = profile?.bloodPressureSystolic, d = profile?.bloodPressureDiastolic;
    if (!s) return 'MISSING';
    if (s >= 180 || d >= 120) return 'CRITICAL';
    if (s >= 140 || d >= 90)  return 'HIGH';
    if (s >= 130 || d >= 80)  return 'LOW';   // borderline / stage 1 — shown as LOW (amber)
    return 'NORMAL';
  })();

  if (loading) {
    return (
      <div className="flex w-full h-48 items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Section renderers ─────────────────────────────────────────────────────

  function renderOverview() {
    const pct = Math.round(completeness * 100);
    return (
      <div className="space-y-4">
        {/* Completeness */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          completeness < 0.5
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
            : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        }`}>
          <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${completeness < 0.5 ? 'text-amber-500' : 'text-emerald-500'}`} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Profile {pct}% complete</p>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1.5 overflow-hidden">
              <div className={`h-full rounded-full ${completeness < 0.5 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Identity strip */}
        <ProfileCard title="Patient Identity" onEdit={() => setActiveSection('general')} editing={false}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Name',       value: profile?.name },
              { label: 'Age / Sex',  value: age ? `${age} yr · ${profile?.gender || '?'}` : null },
              { label: 'Blood Type', value: profile?.bloodGroup },
              { label: 'Smoking',    value: profile?.smokingStatus?.replace('_', '-') },
              { label: 'Height',     value: profile?.height ? `${profile.height} cm` : null },
              { label: 'Weight',     value: profile?.weight ? `${profile.weight} kg` : null },
              { label: 'BMI',        value: bmi },
              { label: 'Phone',      value: profile?.phone },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{value || <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>}</p>
              </div>
            ))}
          </div>
        </ProfileCard>

        {/* Quick lab summary */}
        <ProfileCard title="Latest Lab Summary" onEdit={() => setActiveSection('blood_sugar')} editing={false}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'HbA1c', m: metrics.hba1c },
              { label: 'Creatinine', m: metrics.creatinine },
              { label: 'SGPT', m: metrics.sgpt },
              { label: 'Hemoglobin', m: metrics.hemoglobin },
              { label: 'Total Chol.', m: metrics.totalCholesterol },
              { label: 'TSH', m: metrics.tsh },
              { label: 'WBC', m: metrics.wbc },
              { label: 'LDL', m: metrics.ldl },
            ].map(({ label, m }) => {
              const flag = computeFlag(m);
              return (
                <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 flex flex-col gap-1.5">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {m?.value || <span className="text-gray-300 dark:text-gray-600 font-normal text-base">—</span>}
                  </p>
                  <FlagBadge flag={flag} />
                </div>
              );
            })}
          </div>
        </ProfileCard>

        {/* Active conditions */}
        <ProfileCard title="Active Conditions & Allergies" onEdit={() => setActiveSection('conditions')} editing={false}>
          <div className="flex flex-wrap gap-2 mb-3">
            {conditions.filter((c) => c.status === 'active').map((c) => (
              <span key={c.id} className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full font-medium">
                {c.name}{c.since ? ` (${c.since})` : ''}
              </span>
            ))}
            {conditions.filter((c) => c.status === 'active').length === 0 && <p className="text-sm text-gray-400">No active conditions.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {allergies.map((a) => (
              <span key={a.id} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1 rounded-full font-medium">
                ⚠ {a.name} ({a.severity})
              </span>
            ))}
          </div>
        </ProfileCard>
      </div>
    );
  }

  function renderGeneral() {
    const isEditingG  = editing['general'];
    const isEditingBP = editing['bp'];
    return (
      <div className="space-y-4">
        {/* Demographics card */}
        <ProfileCard
          title="Demographics"
          editing={isEditingG}
          onEdit={() => startEdit('general')}
          onSave={saveGeneral}
          onCancel={() => cancelEdit('general')}
          saving={saving['general']}
        >
          {isEditingG ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Full Name"      name="name"          value={profile?.name}             onChange={() => {}} readOnly />
              <Field label="Date of Birth"  name="dateOfBirth"   value={generalForm.dateOfBirth}   onChange={(e) => setGeneralForm((p) => ({ ...p, dateOfBirth: e.target.value }))} type="date" />
              <Field label="Gender"         name="gender"        value={generalForm.gender}        onChange={(e) => setGeneralForm((p) => ({ ...p, gender: e.target.value }))}        options={GENDER_OPTIONS} />
              <Field label="Phone"          name="phone"         value={generalForm.phone}         onChange={(e) => setGeneralForm((p) => ({ ...p, phone: e.target.value }))} type="tel" />
              <Field label="Blood Group"    name="bloodGroup"    value={generalForm.bloodGroup}    onChange={(e) => setGeneralForm((p) => ({ ...p, bloodGroup: e.target.value }))}    options={BLOOD_GROUPS} />
              <Field label="Smoking"        name="smokingStatus" value={generalForm.smokingStatus} onChange={(e) => setGeneralForm((p) => ({ ...p, smokingStatus: e.target.value }))} options={SMOKING_STATUS} />
              <Field label="Height (cm)"    name="height"        value={generalForm.height}        onChange={(e) => setGeneralForm((p) => ({ ...p, height: e.target.value }))}   type="number" />
              <Field label="Weight (kg)"    name="weight"        value={generalForm.weight}        onChange={(e) => setGeneralForm((p) => ({ ...p, weight: e.target.value }))}   type="number" />
            </div>
          ) : (
            <>
              <Row label="Full Name"     value={profile?.name} />
              <Row label="Date of Birth" value={profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-GB') : null} extra={age ? `${age} years` : null} flag={profile?.dateOfBirth ? undefined : 'MISSING'} />
              <Row label="Gender"        value={profile?.gender} flag={profile?.gender ? undefined : 'MISSING'} />
              <Row label="Phone"         value={profile?.phone} />
              <Row label="Blood Group"   value={profile?.bloodGroup}   flag={profile?.bloodGroup ? 'NORMAL' : 'MISSING'} />
              <Row label="Smoking"       value={profile?.smokingStatus?.replace('_', '-')} flag={profile?.smokingStatus ? 'NORMAL' : 'MISSING'} />
              <Row label="Height"        value={profile?.height ? `${profile.height} cm` : null} />
              <Row label="Weight"        value={profile?.weight ? `${profile.weight} kg` : null} flag={profile?.weight ? 'NORMAL' : 'MISSING'} />
              <Row label="BMI"           value={bmi} flag={bmi ? (bmi < 18.5 ? 'LOW' : bmi < 25 ? 'NORMAL' : bmi < 30 ? 'HIGH' : 'CRITICAL') : 'MISSING'} />
            </>
          )}
        </ProfileCard>

        {/* Blood Pressure card */}
        <ProfileCard
          title="Blood Pressure"
          editing={isEditingBP}
          onEdit={() => startEdit('bp')}
          onSave={saveBP}
          onCancel={() => cancelEdit('bp')}
          saving={saving['bp']}
        >
          {isEditingBP ? (
            <div className="flex gap-3 items-end">
              <Field label="Systolic (mmHg)"  name="bloodPressureSystolic"  value={bpForm.bloodPressureSystolic}  onChange={(e) => setBpForm((p) => ({ ...p, bloodPressureSystolic: e.target.value }))}  type="number" />
              <span className="mb-2 text-gray-400 font-bold text-lg">/</span>
              <Field label="Diastolic (mmHg)" name="bloodPressureDiastolic" value={bpForm.bloodPressureDiastolic} onChange={(e) => setBpForm((p) => ({ ...p, bloodPressureDiastolic: e.target.value }))} type="number" />
            </div>
          ) : (
            <>
              <Row
                label="BP (mmHg)"
                value={profile?.bloodPressureSystolic ? `${profile.bloodPressureSystolic} / ${profile.bloodPressureDiastolic}` : null}
                flag={bpFlag}
                extra={fmtDate(profile?.bpRecordedAt)}
              />
              <p className="text-[10px] text-gray-400 mt-2">Recorded: {fmtDate(profile?.bpRecordedAt)}</p>
            </>
          )}
        </ProfileCard>

        {/* Medications from latest prescription */}
        {recentMeds.length > 0 && (
          <ProfileCard title="Current Medications" editing={false} onEdit={() => addToast('Scan a new prescription to update medications.', 'info')}>
            {recentMeds.map((m, i) => (
              <Row key={i} label={m.name} value={[m.dosage, m.frequency].filter(Boolean).join(' · ') || 'As prescribed'} />
            ))}
            <p className="text-[10px] text-gray-400 mt-3">From most recent scanned prescription. Scan a new one to update.</p>
          </ProfileCard>
        )}
      </div>
    );
  }

  function renderTestSection({ cardId, title, keys, reportType, note, warnings = [] }) {
    const isEditing = editing[`manual_${keys[0]}`];
    return (
      <ProfileCard
        title={title}
        editing={isEditing}
        onEdit={() => startManualEdit(keys)}
        onSave={() => saveManualMetrics(keys)}
        onCancel={() => cancelEdit(`manual_${keys[0]}`)}
        note={note}
      >
        {/* Centred upload zone — always visible */}
        {!isEditing && (
          <SectionUpload
            sectionKeys={keys}
            reportType={reportType}
            onExtracted={handleReportExtracted}
          />
        )}

        {isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {keys.filter((k) => k !== 'egfr').map((k) => (
              <div key={k} className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <Field
                    label={`${PARAM_MAP[k]?.label} (${PARAM_MAP[k]?.unit})`}
                    name={k}
                    type="number"
                    value={manualForm[k]?.value || ''}
                    onChange={(e) => setManualForm((p) => ({ ...p, [k]: { ...p[k], value: e.target.value } }))}
                  />
                </div>
                <Field
                  label="Date"
                  name={`${k}_date`}
                  type="date"
                  value={manualForm[k]?.recordedAt || ''}
                  onChange={(e) => setManualForm((p) => ({ ...p, [k]: { ...p[k], recordedAt: e.target.value } }))}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            {keys.map((k) => (
              <MetricRow
                key={k}
                metricKey={k}
                label={PARAM_MAP[k]?.label || k}
                metric={metrics[k]}
              />
            ))}
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-500 dark:text-amber-400 mt-2">⚠ {w}</p>
            ))}
          </>
        )}
      </ProfileCard>
    );
  }

  function renderConditions() {
    return (
      <div className="space-y-4">
        <ProfileCard title="Known Conditions" editing={false} onEdit={() => addToast('Coming soon — add via your doctor portal.', 'info')}>
          <p className="text-sm font-semibold text-gray-400 uppercase mb-2">Active</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {conditions.filter((c) => c.status === 'active').map((c) => (
              <span key={c.id} className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-full font-medium">
                {c.name}{c.since ? ` · since ${c.since}` : ''}
              </span>
            ))}
            {conditions.filter((c) => c.status === 'active').length === 0 && <p className="text-base text-gray-400">None recorded.</p>}
          </div>
          <p className="text-sm font-semibold text-gray-400 uppercase mb-2">Resolved</p>
          <div className="flex flex-wrap gap-2">
            {conditions.filter((c) => c.status !== 'active').map((c) => (
              <span key={c.id} className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-400 line-through px-3 py-1.5 rounded-full">{c.name}</span>
            ))}
            {conditions.filter((c) => c.status !== 'active').length === 0 && <p className="text-xs text-gray-400">None.</p>}
          </div>
        </ProfileCard>

        <ProfileCard title="Allergies (Critical)" editing={false} onEdit={() => addToast('Coming soon.', 'info')}>
          {allergies.length > 0 ? allergies.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800/60 last:border-0">
              <span className="text-sm font-semibold text-red-600 dark:text-red-400 flex-1">{a.name}</span>
              <Badge variant="red">{a.severity}</Badge>
              <span className="text-xs text-gray-500">{a.reaction}</span>
            </div>
          )) : <p className="text-sm text-gray-400">No allergies recorded.</p>}
        </ProfileCard>

        {surgeries.length > 0 && (
          <ProfileCard title="Surgical History" editing={false} onEdit={() => addToast('Coming soon.', 'info')}>
            {surgeries.map((s) => (
              <Row key={s.id} label={s.name} value={[s.year, s.facility].filter(Boolean).join(' · ')} />
            ))}
          </ProfileCard>
        )}

        {vaccinations.length > 0 && (
          <ProfileCard title="Vaccinations" editing={false} onEdit={() => addToast('Coming soon.', 'info')}>
            {vaccinations.map((v) => (
              <Row key={v.id} label={`${v.name} — Dose ${v.dose}`} value={v.date} />
            ))}
          </ProfileCard>
        )}
      </div>
    );
  }

  function renderEmergency() {
    const isEditing = editing['emergency'];
    return (
      <div className="space-y-4">
        <ProfileCard
          title="Emergency Contact"
          editing={isEditing}
          onEdit={() => startEdit('emergency')}
          onSave={saveEmergency}
          onCancel={() => cancelEdit('emergency')}
          saving={saving['emergency']}
        >
          {isEditing ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"     name="emergencyContactName"     value={emergencyForm.emergencyContactName}     onChange={(e) => setEmergencyForm((p) => ({ ...p, emergencyContactName: e.target.value }))} />
              <Field label="Phone"    name="emergencyContactPhone"    value={emergencyForm.emergencyContactPhone}    onChange={(e) => setEmergencyForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))} type="tel" />
              <Field label="Relation" name="emergencyContactRelation" value={emergencyForm.emergencyContactRelation} onChange={(e) => setEmergencyForm((p) => ({ ...p, emergencyContactRelation: e.target.value }))} />
            </div>
          ) : profile?.emergencyContactName ? (
            <>
              <Row label="Name"     value={profile.emergencyContactName} />
              <Row label="Phone"    value={profile.emergencyContactPhone} />
              <Row label="Relation" value={profile.emergencyContactRelation} />
            </>
          ) : (
            <p className="text-sm text-gray-400">No emergency contact recorded. Click Edit to add.</p>
          )}
        </ProfileCard>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Emergency Medical Card</h3>
          <EmergencyCard user={{
            name: profile?.name, gender: profile?.gender, bloodGroup: profile?.bloodGroup,
            allergies,
            emergencyContact: profile?.emergencyContactName ? {
              name: profile.emergencyContactName, phone: profile.emergencyContactPhone, relation: profile.emergencyContactRelation,
            } : null,
          }} />
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" onClick={() => addToast('Share link generated!', 'success')}><Share2 className="w-4 h-4" /> Share</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</Button>
          </div>
        </div>
      </div>
    );
  }

  function renderSection() {
    switch (activeSection) {
      case 'overview': return renderOverview();
      case 'general':  return renderGeneral();
      case 'blood_sugar': return renderTestSection({
        cardId: 'blood_sugar', title: 'Blood Sugar',
        keys: ['rbs','fbs','hba1c'],
        reportType: 'HbA1c / Diabetes Panel',
        note: 'Upload a report to auto-fill, or use Edit to enter values manually.',
        warnings: conditions.some((c) => c.name?.toLowerCase().includes('diabet'))
          ? ['Diabetic patient — all three values are critical. HbA1c should be repeated every 3 months.']
          : [],
      });
      case 'cbc': return renderTestSection({
        cardId: 'cbc', title: 'CBC (Complete Blood Count)',
        keys: ['hemoglobin','wbc','platelets','hematocrit'],
        reportType: 'Complete Blood Count (CBC)',
        note: 'Upload a CBC report to auto-fill all four values, or use Edit to enter manually.',
      });
      case 'kidney': return (
        <div className="space-y-4">
          {renderTestSection({
            cardId: 'kidney', title: 'Kidney Function',
            keys: ['creatinine','bun'],
            reportType: 'Kidney Function Test (KFT)',
            note: 'eGFR is auto-calculated from creatinine.',
            warnings: metrics.egfr?.value && parseFloat(metrics.egfr.value) < 60
              ? ['eGFR < 60 indicates Chronic Kidney Disease (CKD). Consult a nephrologist.']
              : [],
          })}
          {metrics.egfr && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Calculated</p>
              <MetricRow label="eGFR (mL/min/1.73m²)" metric={metrics.egfr} />
            </div>
          )}
        </div>
      );
      case 'liver': return renderTestSection({
        cardId: 'liver', title: 'Liver Function',
        keys: ['sgpt','sgot','bilirubin'],
        reportType: 'Liver Function Test (LFT)',
        note: 'SGPT and SGOT should always be tested together.',
        warnings: metrics.sgpt?.value && !metrics.sgot?.value
          ? ['SGPT recorded without SGOT — incomplete liver panel.']
          : [],
      });
      case 'lipid': return renderTestSection({
        cardId: 'lipid', title: 'Lipid Profile',
        keys: ['totalCholesterol','ldl','hdl','triglycerides'],
        reportType: 'Lipid Panel',
        note: 'Lipid panel is done as a single test — all four values should be from the same date.',
      });
      case 'thyroid': return renderTestSection({
        cardId: 'thyroid', title: 'Thyroid',
        keys: ['tsh','freeT4'],
        reportType: 'Thyroid Panel',
        note: 'TSH alone is sufficient for routine screening. Free T4 is needed only if TSH is abnormal.',
      });
      case 'conditions': return renderConditions();
      case 'emergency':  return renderEmergency();
      default: return null;
    }
  }

  const activeSectionMeta = SECTIONS.find((s) => s.id === activeSection);

  // ─── Layout ───────────────────────────────────────────────────────────────
  return (
    <div className="flex w-full min-h-[calc(100vh-120px)] -mx-4 sm:-mx-6">

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className={`
        flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        transition-all duration-200 overflow-hidden
        ${sidebarOpen ? 'w-52' : 'w-0'}
      `}>
        <div className="w-52 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-4 mb-2">
            Manage
          </p>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all text-left border-l-4 ${
                activeSection === s.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="text-base">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Health Profile</span>
            <ChevronRight className="w-4 h-4" />
            <span className="font-semibold text-gray-900 dark:text-white">
              {activeSectionMeta?.icon} {activeSectionMeta?.label}
            </span>
          </div>
          {completeness < 0.5 && (
            <span className="ml-auto text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 rounded-full font-semibold">
              {Math.round(completeness * 100)}% complete
            </span>
          )}
        </div>

        {/* Section content */}
        <div className="flex-1 px-4 sm:px-6 py-6 overflow-y-auto">
          {renderSection()}
        </div>

      </div>
    </div>
  );
}
