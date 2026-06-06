import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ChevronRight, X, Phone, Heart,
  Pill as PillIcon, FileText, FlaskConical, RefreshCw, Sparkles,
  Loader2, CheckCircle, Droplets, TrendingUp, BarChart3,
} from 'lucide-react';
import { useAuth }     from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { relativeTime } from '../utils/timeUtils.js';
import PredictionCard from '../components/predictions/PredictionCard.jsx';
import {
  getHealthSummary,
  getPrescriptionHistory,
  getPrescriptionHistoryLocal,
  getReportHistory,
  getReportHistoryLocal,
  getPatientSummary,
  getPredictions,
} from '../services/api.js';

// ── Animated health emoji ──────────────────────────────────────────────────────
const EMOJI_CONFIG = [
  { min: 85, emoji: '😄', anim: { y: [0, -12, 0] },      dur: 1.0 },
  { min: 70, emoji: '😊', anim: { y: [0, -6,  0] },      dur: 1.8 },
  { min: 55, emoji: '🙂', anim: { rotate: [-5, 5, -5] }, dur: 2.5 },
  { min: 40, emoji: '😐', anim: { y: [0, 5,   0] },      dur: 3.2 },
  { min:  0, emoji: '😔', anim: { x: [-3, 3, -3] },      dur: 1.8 },
];
function HealthEmoji({ score }) {
  const cfg = EMOJI_CONFIG.find(c => score >= c.min) ?? EMOJI_CONFIG.at(-1);
  return (
    <motion.span className="text-6xl select-none leading-none"
      animate={cfg.anim}
      transition={{ duration: cfg.dur, repeat: Infinity, ease: 'easeInOut' }}>
      {cfg.emoji}
    </motion.span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Bone({ w = 'w-full', h = 'h-4' }) {
  return <div className={`${w} ${h} bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse`} />;
}

// ── Lab value status colours ───────────────────────────────────────────────────
const STATUS_STYLE = {
  high:          'text-red-600 dark:text-red-400',
  critical_high: 'text-red-700 dark:text-red-300 font-bold',
  low:           'text-amber-600 dark:text-amber-400',
  critical_low:  'text-amber-700 dark:text-amber-300 font-bold',
  normal:        'text-emerald-600 dark:text-emerald-400',
};

// ── Completeness helper (mirrors HistoryProfile logic) ─────────────────────────
function computeCompleteness(p, raw = []) {
  if (!p) return 0.5;
  const checks = [
    Boolean(p.dateOfBirth), Boolean(p.gender), Boolean(p.bloodGroup),
    Boolean(p.phone), Boolean(p.smokingStatus), Boolean(p.height),
    Boolean(p.weight), Boolean(p.bloodPressureSystolic), Boolean(p.emergencyContactName),
    (p.conditions  || []).length > 0,
    (p.allergies   || []).length > 0,
    raw.some(m => ['hba1c','rbs','fbs'].some(k => m.parameterName?.toLowerCase().includes(k))),
    raw.some(m => m.parameterName?.toLowerCase().includes('hemoglobin')),
    raw.some(m => m.parameterName?.toLowerCase().includes('creatinine')),
    raw.some(m => ['sgpt','alt'].some(k => m.parameterName?.toLowerCase().includes(k))),
    raw.some(m => m.parameterName?.toLowerCase().includes('cholesterol')),
    raw.some(m => m.parameterName?.toLowerCase().includes('tsh')),
  ];
  return checks.filter(Boolean).length / checks.length;
}

// ── Cache helpers ──────────────────────────────────────────────────────────────
function readCache(key)       { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function writeCache(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ── Main component ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user }  = useAuth();
  const { t }     = useLanguage();

  const DASH_KEY    = `rxsense_dashboard_v2_${user?.id}`;
  const SUMMARY_KEY = `rxsense_patient_summary_v2_${user?.id}`;
  const DISMISS_KEY = `rxsense_profile_banner_${user?.id}`;

  // Summary steps use translation keys resolved at render time
  const SUMMARY_STEPS = [
    t('stepReadingProfile'),
    t('stepCheckingReports'),
    t('stepClinicalContext'),
    t('stepWritingStory'),
  ];

  // ── Core dashboard state ───────────────────────────────────────────────────
  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [completeness, setCompleteness] = useState(0.5);
  const [latestRx,     setLatestRx]     = useState(null);
  const [latestReport, setLatestReport] = useState(null);

  // ── Health story summary state ─────────────────────────────────────────────
  const [summary,        setSummary]        = useState(() => readCache(SUMMARY_KEY));
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryStep,    setSummaryStep]    = useState(0);

  const [predictions,    setPredictions]    = useState([]);
  const [predictionsLoading, setPredictionsLoading] = useState(false);

  // Advance the step indicator while the agent is running (~4 s per step)
  useEffect(() => {
    if (!summaryLoading) { setSummaryStep(0); return; }
    setSummaryStep(0);
    const id = setInterval(() =>
      setSummaryStep(s => Math.min(s + 1, SUMMARY_STEPS.length - 1)), 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryLoading]);

  // ── Dismissible profile-completeness banner ────────────────────────────────
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1'
  );
  const dismissBanner = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setBannerDismissed(true);
  };

  // ── Data fingerprint: changes when any summary-relevant data changes ────────
  function makeSummaryFingerprint(p, rx, rpt) {
    return [
      (p?.conditions  || []).length,
      (p?.medications || []).filter(m => !m.status || m.status === 'active').length,
      rx?.savedAt  || 'none',
      rpt?.savedAt || 'none',
    ].join('|');
  }

  // ── Fetch patient summary (generates fresh if fingerprint differs) ──────────
  const fetchSummary = useCallback(async (p, rx, rpt, force = false) => {
    const fp = makeSummaryFingerprint(p, rx, rpt);
    const cached = readCache(SUMMARY_KEY);
    if (!force && cached?.fingerprint === fp) return;

    setSummaryLoading(true);
    try {
      const result = await getPatientSummary();
      const toSave = { ...result, fingerprint: fp, cachedAt: new Date().toISOString() };
      setSummary(toSave);
      writeCache(SUMMARY_KEY, toSave);
    } catch {
      // keep whatever cached summary exists
    } finally {
      setSummaryLoading(false);
    }
  }, [SUMMARY_KEY]);

  // ── Main data fetch (loads cache instantly, then refreshes in background) ───
  useEffect(() => {
    const cached = readCache(DASH_KEY);
    const rxHistory  = getPrescriptionHistoryLocal();
    const rptHistory = getReportHistoryLocal();
    let freshRx    = rxHistory[0]  ?? null;
    let freshRpt   = rptHistory[0] ?? null;

    const stale = !cached
      || freshRx?.savedAt  !== cached.latestRxSavedAt
      || freshRpt?.savedAt !== cached.latestRptSavedAt;

    if (cached && !stale) {
      setProfile(cached.profile);
      setCompleteness(cached.completeness ?? 0.5);
      setLatestRx(cached.latestRx);
      setLatestReport(cached.latestReport);
      setLoading(false);
    }

    (async () => {
      if (stale) setLoading(true);
      try {
        const { profile: p, metrics: raw } = await getHealthSummary();
        const rxHistoryNew  = await getPrescriptionHistory();
        const rptHistoryNew = await getReportHistory();
        freshRx = rxHistoryNew[0] ?? null;
        freshRpt = rptHistoryNew[0] ?? null;
        const comp = computeCompleteness(p, raw);
        setProfile(p);
        setCompleteness(comp);
        setLatestRx(freshRx);
        setLatestReport(freshRpt);

        writeCache(DASH_KEY, {
          profile:          p,
          completeness:     comp,
          latestRx:         freshRx,
          latestReport:     freshRpt,
          latestRxSavedAt:  freshRx?.savedAt  ?? null,
          latestRptSavedAt: freshRpt?.savedAt ?? null,
          cachedAt:         new Date().toISOString(),
        });

        setLoading(false);
        await fetchSummary(p, freshRx, freshRpt);

        setPredictionsLoading(true);
        try {
          const preds = await getPredictions();
          setPredictions(preds || []);
        } catch (err) {
          console.warn('Failed to fetch predictions:', err);
        } finally {
          setPredictionsLoading(false);
        }
      } catch {
        setLatestRx(freshRx);
        setLatestReport(freshRpt);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const firstName    = profile?.name?.split(' ')[0] ?? user?.name?.split(' ')[0] ?? 'there';
  const score        = Math.round(completeness * 100);
  const activeConds  = (profile?.conditions ?? []).filter(c => c.status === 'active');
  const hasConditions = activeConds.length > 0;
  const profileMeds  = (profile?.medications ?? []).filter(m => !m.status || m.status === 'active');
  const rxMeds       = latestRx?.medications ?? [];
  const meds         = profileMeds.length > 0 ? profileMeds : rxMeds;
  const hasMeds      = meds.length > 0;
  const emergency    = profile?.emergencyContactName
    ? { name: profile.emergencyContactName, phone: profile.emergencyContactPhone }
    : null;

  const reportEntries = (() => {
    if (!latestReport) return [];
    const all      = (latestReport.sections ?? []).flatMap(s => s.entries ?? []).filter(e => e.value != null);
    const abnormal = all.filter(e => e.status && e.status !== 'normal');
    return [...abnormal, ...all.filter(e => !e.status || e.status === 'normal')].slice(0, 3);
  })();

  const showBanner = !loading && !bannerDismissed && completeness < 0.5;

  // Motivational message using t()
  const motivationalMsg = hasConditions && hasMeds
    ? t('motivationSick',    { firstName })
    : hasMeds
    ? t('motivationMeds',    { firstName })
    : t('motivationHealthy', { firstName });

  return (
    <div className="space-y-5">

      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('welcomeGreeting', { firstName })}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('healthOverviewSubtitle')}
        </p>
      </motion.div>

      {/* Dismissible profile-completeness banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <Link to="/history/profile" className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                  {t('profileIncomplete', { pct: Math.round(completeness * 100) })}
                </p>
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {t('profileIncompleteHelp')}
                </p>
              </Link>
              <button onClick={dismissBanner}
                className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors flex-shrink-0"
                aria-label="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Row 1: Health Overview ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        {loading ? (
          <div className="flex items-center gap-5">
            <Bone w="w-16" h="h-16" />
            <div className="flex-1 space-y-2">
              <Bone w="w-48" h="h-5" /><Bone w="w-72" h="h-4" />
              <div className="flex gap-2 mt-3"><Bone w="w-20" h="h-6" /><Bone w="w-28" h="h-6" /></div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-5 flex-wrap">
            <HealthEmoji score={score} />
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900 dark:text-white leading-snug">
                {motivationalMsg}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {profile?.bloodGroup && (
                  <span className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800">
                    <Droplets className="w-3 h-3" /> {profile.bloodGroup}
                  </span>
                )}
                {hasMeds && (
                  <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                    <PillIcon className="w-3 h-3" /> {t('medicationsBadge', { n: meds.length })}
                  </span>
                )}
                {emergency ? (
                  <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <Phone className="w-3 h-3" /> {t('emergencyPrefix')} {emergency.name.split(' ')[0]}
                  </span>
                ) : (
                  <Link to="/history/profile"
                    className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium px-2.5 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                    {t('addEmergencyContact')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Row 2: Medication Plan + Emergency Contact ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Medication Plan */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PillIcon className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('cardMedPlan')}</h2>
            </div>
            <Link to="/prescription" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex items-center gap-0.5">
              {t('cardPrescriptions')} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2.5 flex-1"><Bone h="h-12" /><Bone h="h-12" /></div>
          ) : meds.length > 0 ? (
            <div className="space-y-2 flex-1">
              {meds.slice(0, 4).map((med, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                  <PillIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {med.name}{med.dosage ? ` · ${med.dosage}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {[med.frequency, med.duration].filter(Boolean).join(' · ') || t('asPresribed')}
                    </p>
                  </div>
                </div>
              ))}
              {meds.length > 4 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
                  {t('nMoreShort', { n: meds.length - 4 })}
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <PillIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noMedsOnFile')}</p>
              <Link to="/prescription" className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                {t('scanPrescriptionCta')}
              </Link>
            </div>
          )}
        </div>

        {/* Emergency Info */}
        <div className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              <h2 className="text-sm font-semibold">{t('cardEmergency')}</h2>
            </div>
            <Link to="/history/profile" className="text-xs text-red-100 hover:text-white hover:underline font-medium flex items-center gap-0.5">
              {t('cardHealthProfile')} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2.5">
              <div className="h-8 bg-white/20 rounded-lg animate-pulse" />
              <div className="h-8 bg-white/20 rounded-lg animate-pulse" />
            </div>
          ) : profile?.bloodGroup || emergency ? (
            <div className="space-y-3 flex-1">
              <div className="flex gap-3">
                {profile?.bloodGroup && (
                  <div className="bg-white/20 rounded-xl px-3 py-2 text-center flex-shrink-0">
                    <p className="text-red-200 text-[10px] font-medium uppercase">{t('bloodLabel')}</p>
                    <p className="font-bold text-xl leading-tight">{profile.bloodGroup}</p>
                  </div>
                )}
                {(profile?.allergies ?? []).length > 0 && (
                  <div className="bg-white/20 rounded-xl px-3 py-2 min-w-0 flex-1">
                    <p className="text-red-200 text-[10px] font-medium uppercase mb-0.5">{t('allergiesLabel')}</p>
                    <p className="text-sm font-semibold truncate">
                      {profile.allergies[0]?.name ?? profile.allergies[0]}
                    </p>
                    {profile.allergies.length > 1 && (
                      <p className="text-red-200 text-xs">{t('nMoreShort', { n: profile.allergies.length - 1 })}</p>
                    )}
                  </div>
                )}
              </div>
              {emergency ? (
                <div className="bg-white/20 rounded-xl px-3 py-2 flex items-center gap-3">
                  <Phone className="w-4 h-4 flex-shrink-0 text-red-100" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{emergency.name}</p>
                    {emergency.phone && <p className="text-red-200 text-xs truncate">{emergency.phone}</p>}
                  </div>
                </div>
              ) : (
                <Link to="/history/profile" className="flex items-center gap-2 bg-white/10 border border-dashed border-white/30 rounded-xl px-3 py-2 text-red-100 hover:bg-white/20 transition-colors text-xs font-medium">
                  {t('addEmergencyContact')}
                </Link>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
              <p className="text-red-100 text-sm">{t('noEmergencySet')}</p>
              <Link to="/history/profile" className="mt-2 text-white text-xs hover:underline font-medium">{t('completeProfileCta')}</Link>
            </div>
          )}
        </div>

      </div>

      {/* ── Row 3: Latest Prescription + Latest Report ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Latest Prescription */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('cardLatestRx')}</h2>
            </div>
            <Link to="/prescription" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex items-center gap-0.5">
              {t('openLabel')} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2.5 flex-1"><Bone w="w-40" h="h-4" /><Bone h="h-10" /><Bone h="h-10" /><Bone h="h-10" /></div>
          ) : latestRx ? (
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {latestRx.doctor?.name && (
                  <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium border border-emerald-200 dark:border-emerald-800">
                    Dr. {latestRx.doctor.name.replace(/^Dr\.?\s*/i, '')}
                  </span>
                )}
                {latestRx.date && <span className="text-xs text-gray-400 dark:text-gray-500">{latestRx.date}</span>}
              </div>
              <div className="space-y-1.5">
                {rxMeds.slice(0, 3).map((med, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <PillIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{med.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {[med.dosage, med.frequency].filter(Boolean).join(' · ') || t('asPresribed')}
                      </p>
                    </div>
                  </div>
                ))}
                {rxMeds.length > 3 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
                    {t('moreMedications', { n: rxMeds.length - 3 })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noRxScanned')}</p>
              <Link to="/prescription" className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">{t('scanFirstRxCta')}</Link>
            </div>
          )}
        </div>

        {/* Latest Report */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-purple-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('cardLatestReport')}</h2>
            </div>
            <Link to="/report" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex items-center gap-0.5">
              {t('openLabel')} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2.5 flex-1"><Bone w="w-40" h="h-4" /><Bone h="h-10" /><Bone h="h-10" /><Bone h="h-10" /></div>
          ) : latestReport ? (
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {latestReport.type && (
                  <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium border border-purple-200 dark:border-purple-800 truncate max-w-[160px]">
                    {latestReport.type}
                  </span>
                )}
                {latestReport.date && <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{latestReport.date}</span>}
              </div>
              {reportEntries.length > 0 ? (
                <div className="space-y-1.5">
                  {reportEntries.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1 mr-2">{entry.label}</p>
                      <p className={`text-sm font-semibold flex-shrink-0 ${STATUS_STYLE[entry.status] ?? 'text-gray-900 dark:text-white'}`}>
                        {entry.value}{entry.unit ? ` ${entry.unit}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-2">{t('noLabValues')}</p>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <FlaskConical className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noReportUploaded')}</p>
              <Link to="/report" className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">{t('uploadFirstReportCta')}</Link>
            </div>
          )}
        </div>

      </div>

      {/* ── Row 4: Future Health Risks (Predictions) ─────────────────────────── */}
      {predictions && predictions.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Upcoming Health Risks</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Based on your trends and similar patient outcomes
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {predictions.slice(0, 2).map((pred, idx) => (
              <PredictionCard key={idx} prediction={pred} compact={true} />
            ))}
            {predictions.length > 2 && (
              <Link to="/report#predictions" className="inline-block text-sm text-amber-600 dark:text-amber-400 hover:underline font-medium mt-2">
                View all {predictions.length} predictions →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Row 5: Health Story (AI summary) ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-6">

        {/* Card header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">{t('cardHealthStory')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('healthStorySubtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {summary?.cachedAt && !summaryLoading && (
              <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                {relativeTime(summary.cachedAt)}
              </span>
            )}
            <button
              onClick={() => fetchSummary(profile, latestRx, latestReport, true)}
              disabled={summaryLoading || loading}
              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-40"
              title={t('refreshLabel')}
            >
              <RefreshCw className={`w-4 h-4 ${summaryLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        {summaryLoading ? (
          <div className="space-y-5">
            <div className="space-y-3">
              {SUMMARY_STEPS.map((step, i) => {
                const done    = i < summaryStep;
                const active  = i === summaryStep;
                return (
                  <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${
                    done ? 'opacity-50' : active ? 'opacity-100' : 'opacity-25'
                  }`}>
                    {done ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : active ? (
                      <Loader2 className="w-4 h-4 text-emerald-500 animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${
                      active
                        ? 'text-emerald-700 dark:text-emerald-300 font-medium'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>{step}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
              {t('summaryTakesTime')}
            </p>
          </div>
        ) : summary?.headline ? (
          <div>
            <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300 mb-5 leading-snug">
              {summary.headline}
            </p>
            <div className="space-y-5">
              {(summary.sections || []).map((section, si) => (
                <div key={si}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg leading-none">{section.icon}</span>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {section.title}
                    </h3>
                  </div>
                  <ul className="space-y-1.5 ml-1">
                    {(section.points || []).map((point, pi) => (
                      <li key={pi} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-500 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {loading ? t('noHealthData') : t('healthStoryLoading')}
            </p>
          </div>
        )}

        {/* Footer disclaimer */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-5 pt-4 border-t border-emerald-200/60 dark:border-emerald-800/40 italic">
          {t('aiDisclaimer')}
        </p>
      </div>

    </div>
  );
}
