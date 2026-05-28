import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import HealthScoreGauge from '../components/ui/HealthScoreGauge.jsx';
import EmergencyCard from '../components/history/EmergencyCard.jsx';
import { getHealthProfile, getHealthSummary, getPrescriptionHistoryLocal, getReportHistoryLocal } from '../services/api.js';

const CONDITION_COLORS = [
  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
];

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function buildActivity(prescriptions, reports) {
  const items = [
    ...prescriptions.slice(0, 5).map((rx) => ({
      icon: '📋',
      title: `Prescription scanned — ${rx.medications?.length || 0} medication${rx.medications?.length !== 1 ? 's' : ''}`,
      time: rx.savedAt,
      to: '/prescription',
    })),
    ...reports.slice(0, 5).map((rpt) => ({
      icon: '🔬',
      title: `${rpt.type || 'Report'} analyzed`,
      time: rpt.savedAt,
      to: '/report',
    })),
  ];
  return items.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);
}

function deriveRisks(conditions) {
  if (!conditions?.length) return [];
  const risks = [];
  const names = conditions.map((c) => c.name?.toLowerCase() || '');

  if (names.some((n) => n.includes('diabet'))) {
    risks.push({ label: 'Diabetes', risk: 'High', color: 'text-red-500', bg: 'bg-red-500', pct: 80 });
  }
  if (names.some((n) => n.includes('cardiac') || n.includes('cardiovascular') || n.includes('hypertension') || n.includes('heart'))) {
    risks.push({ label: 'Cardiovascular', risk: 'Moderate', color: 'text-amber-500', bg: 'bg-amber-500', pct: 50 });
  }
  if (names.some((n) => n.includes('anemia') || n.includes('anaemia'))) {
    risks.push({ label: 'Anemia', risk: 'Moderate', color: 'text-blue-500', bg: 'bg-blue-500', pct: 40 });
  }
  if (names.some((n) => n.includes('thyroid'))) {
    risks.push({ label: 'Thyroid', risk: 'Moderate', color: 'text-purple-500', bg: 'bg-purple-500', pct: 45 });
  }
  if (names.some((n) => n.includes('kidney') || n.includes('renal'))) {
    risks.push({ label: 'Kidney', risk: 'Moderate', color: 'text-amber-500', bg: 'bg-amber-500', pct: 48 });
  }
  return risks.slice(0, 4);
}

function SkeletonLine({ w = 'w-full', h = 'h-4' }) {
  return <div className={`${w} ${h} bg-gray-200 dark:bg-gray-700 rounded animate-pulse`} />;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [activity,     setActivity]     = useState([]);
  const [recentMeds,   setRecentMeds]   = useState([]);
  const [completeness, setCompleteness] = useState(null);

  useEffect(() => {
    const rxHistory  = getPrescriptionHistoryLocal();
    const rptHistory = getReportHistoryLocal();
    setActivity(buildActivity(rxHistory, rptHistory));
    const latestRx = rxHistory[0];
    if (latestRx?.medications?.length) setRecentMeds(latestRx.medications.slice(0, 3));

    // Use health summary so we can compute completeness
    getHealthSummary()
      .then(({ profile: p, metrics: raw }) => {
        setProfile(p);
        // Quick completeness: count filled key fields (mirrors HistoryProfile logic)
        if (p) {
          const checks = [
            Boolean(p.dateOfBirth), Boolean(p.gender), Boolean(p.bloodGroup),
            Boolean(p.phone), Boolean(p.smokingStatus), Boolean(p.height),
            Boolean(p.weight), Boolean(p.bloodPressureSystolic), Boolean(p.emergencyContactName),
            (p.conditions || []).length > 0, (p.allergies || []).length > 0,
            raw.some((m) => ['hba1c','rbs','fbs'].some((k) => m.parameterName?.toLowerCase().includes(k))),
            raw.some((m) => m.parameterName?.toLowerCase().includes('hemoglobin')),
            raw.some((m) => m.parameterName?.toLowerCase().includes('creatinine')),
            raw.some((m) => ['sgpt','alt'].some((k) => m.parameterName?.toLowerCase().includes(k))),
            raw.some((m) => m.parameterName?.toLowerCase().includes('cholesterol')),
            raw.some((m) => m.parameterName?.toLowerCase().includes('tsh')),
          ];
          setCompleteness(checks.filter(Boolean).length / checks.length);
        }
      })
      .catch(() => {
        getHealthProfile().then(setProfile).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, []);

  const activeConditions = (profile?.conditions || []).filter((c) => c.status === 'active');
  const risks = deriveRisks(activeConditions);
  const firstName = profile?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'there';
  const hasAlerts = activeConditions.some((c) =>
    c.name?.toLowerCase().includes('diabet') || c.name?.toLowerCase().includes('hba1c')
  );

  const emergencyUser = profile
    ? {
        name:             profile.name,
        gender:           profile.gender,
        bloodGroup:       profile.bloodGroup || null,
        allergies:        profile.allergies  || [],
        emergencyContact: null,
      }
    : null;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t(`Welcome back, ${firstName} 👋`)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("Here's your health summary for today.")}
        </p>
      </motion.div>

      {/* Profile completeness prompt — shown only when < 50% */}
      {!loading && completeness !== null && completeness < 0.5 && (
        <Link to="/history/profile">
          <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700 rounded-xl cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors">
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                Your health profile is only {Math.round(completeness * 100)}% complete
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Complete your profile so your doctor has the full picture. Tap to fill in missing details.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-400 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* AI Alert Banner — shown only when there are relevant active conditions */}
      {!loading && hasAlerts && (
        <Link to="/history/insights">
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex-1">
              {t('⚠️ You have active conditions that need monitoring. Tap to view your health insights.')}
            </p>
            <ChevronRight className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* Health Overview Strip */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          {t('Health Overview')}
        </h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <HealthScoreGauge score={68} size="sm" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Health Score</p>
              <p className="text-sm font-bold text-amber-500">Moderate</p>
            </div>
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">

            {/* Active Conditions */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Active Conditions</p>
              {loading ? (
                <div className="space-y-1.5">
                  <SkeletonLine w="w-24" h="h-5" />
                  <SkeletonLine w="w-20" h="h-5" />
                </div>
              ) : activeConditions.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {activeConditions.slice(0, 3).map((c, i) => (
                    <span key={c.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONDITION_COLORS[i % CONDITION_COLORS.length]}`}>
                      {c.name}
                    </span>
                  ))}
                  {activeConditions.length > 3 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">+{activeConditions.length - 3} more</span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">None on record</p>
              )}
            </div>

            {/* Medications */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
              <p className="text-xs text-gray-500 dark:text-gray-400">Medications</p>
              {loading ? (
                <div className="space-y-1.5 mt-1">
                  <SkeletonLine w="w-16" h="h-4" />
                  <SkeletonLine w="w-24" h="h-3" />
                </div>
              ) : recentMeds.length > 0 ? (
                <>
                  <p className="font-semibold text-gray-900 dark:text-white">{recentMeds.length} from last Rx</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {recentMeds.map((m) => m.name).join(', ')}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-900 dark:text-white">None tracked</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Scan a prescription</p>
                </>
              )}
            </div>

            {/* Next Action */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
              <p className="text-xs text-gray-500 dark:text-gray-400">Next Action</p>
              {loading ? (
                <div className="space-y-1.5 mt-1">
                  <SkeletonLine w="w-20" h="h-4" />
                  <SkeletonLine w="w-16" h="h-3" />
                </div>
              ) : activeConditions.some((c) => c.name?.toLowerCase().includes('diabet')) ? (
                <>
                  <p className="font-medium text-gray-900 dark:text-white text-xs">Repeat HbA1c</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Consult your doctor</p>
                </>
              ) : activity.length > 0 ? (
                <>
                  <p className="font-medium text-gray-900 dark:text-white text-xs">Upload latest report</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400">Keep records current</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-900 dark:text-white text-xs">Get started</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400">Scan a report or Rx</p>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('Recent Activity')}</h2>
            <Link to="/history" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
              View All →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <SkeletonLine w="w-8" h="h-8" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonLine w="w-3/4" h="h-3" />
                    <SkeletonLine w="w-1/3" h="h-2.5" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length > 0 ? (
            <div className="space-y-1">
              {activity.map(({ icon, title, time, to }, i) => (
                <Link
                  key={i}
                  to={to}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{title}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Clock className="w-3 h-3" /> {relativeTime(time)}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500">
              <p className="text-sm">No activity yet.</p>
              <p className="text-xs mt-1">Upload a report or scan a prescription to get started.</p>
            </div>
          )}
        </div>

        {/* Risk Summary */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('Risk Summary')}</h2>
            <Link to="/history/insights" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
              View Insights →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              <SkeletonLine w="w-full" h="h-14" />
              {[1, 2, 3].map((i) => <SkeletonLine key={i} w="w-full" h="h-5" />)}
            </div>
          ) : risks.length > 0 ? (
            <>
              <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Current Risk Level</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">⚠️ Moderate</p>
              </div>
              <div className="space-y-2">
                {risks.map(({ label, risk, color, bg, pct }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    <span className="w-28 text-gray-600 dark:text-gray-400 flex-shrink-0 text-xs">{label}</span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-semibold w-20 text-right ${color}`}>{risk}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500">
              <p className="text-sm">No risk data yet.</p>
              <p className="text-xs mt-1">Risk tracking is based on your conditions and reports.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Medication Reminders */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('Recent Medications')}</h2>
            <Link to="/history/medications" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
              Manage →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              <SkeletonLine w="w-full" h="h-12" />
              <SkeletonLine w="w-full" h="h-12" />
            </div>
          ) : recentMeds.length > 0 ? (
            <div className="space-y-2">
              {recentMeds.map((med, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800">
                  <span className="text-lg">💊</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {med.name}{med.dosage ? ` ${med.dosage}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {[med.frequency, med.duration].filter(Boolean).join(' · ') || 'As prescribed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500">
              <p className="text-sm">No medications on file.</p>
              <p className="text-xs mt-1">Scan a prescription to track your medications.</p>
            </div>
          )}
        </div>

        {/* Emergency Card */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('Emergency Card')}</h2>
            <Link to="/history/profile" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
              View Full →
            </Link>
          </div>
          {loading ? (
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ) : (
            <EmergencyCard user={emergencyUser} compact />
          )}
        </div>
      </div>
    </div>
  );
}
