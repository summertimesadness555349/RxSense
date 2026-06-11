import { useState, useEffect, useCallback } from 'react';
import { motion }            from 'framer-motion';
import { Brain, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import HealthScoreGauge      from '../components/ui/HealthScoreGauge.jsx';
import InsightCard           from '../components/ui/InsightCard.jsx';
import RiskBar               from '../components/ui/RiskBar.jsx';
import DisclaimerBanner      from '../components/ui/DisclaimerBanner.jsx';
import Card                  from '../components/ui/Card.jsx';
import Button                from '../components/ui/Button.jsx';
import { getInsights, generateDoctorSummary } from '../services/api.js';
import { useToast }          from '../context/ToastContext.jsx';
import { useLanguage }       from '../context/LanguageContext.jsx';
import { useAuth }           from '../context/AuthContext.jsx';
import { relativeTime }      from '../utils/timeUtils.js';

const INSIGHTS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const insightsCacheKey = (userId) => `rxsense_insights_v2_${userId}`;
const doctorSummaryCacheKey = (userId) => `rxsense_doctor_summary_v1_${userId}`;

const readInsightsCache = (userId) => {
  try {
    const raw = localStorage.getItem(insightsCacheKey(userId));
    if (!raw) return null;
    const { data, cachedAt } = JSON.parse(raw);
    if (Date.now() - new Date(cachedAt).getTime() > INSIGHTS_TTL_MS) return null;
    return data;
  } catch { return null; }
};
const writeInsightsCache = (userId, data) => {
  try { localStorage.setItem(insightsCacheKey(userId), JSON.stringify({ data, cachedAt: new Date().toISOString() })); } catch {}
};
const readDoctorSummaryCache = (userId) => {
  try { return JSON.parse(localStorage.getItem(doctorSummaryCacheKey(userId))) || null; } catch { return null; }
};
const writeDoctorSummaryCache = (userId, summary) => {
  try { localStorage.setItem(doctorSummaryCacheKey(userId), JSON.stringify(summary)); } catch {}
};

const LEVEL_COLORS = { High: '#ef4444', Moderate: '#f59e0b', Low: '#22c55e' };

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

function InsightsSkeleton() {
  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="flex flex-col items-center gap-3 py-6">
        <Skeleton className="w-36 h-36 rounded-full" />
        <Skeleton className="w-48 h-5" />
        <Skeleton className="w-64 h-4" />
      </Card>
      <div className="space-y-3">
        <Skeleton className="w-40 h-5" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
      <Card>
        <Skeleton className="w-36 h-5 mb-4" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-6 w-full mt-3" />)}
      </Card>
      <Card>
        <Skeleton className="w-48 h-5 mb-3" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-8 w-full mt-2" />)}
      </Card>
    </div>
  );
}

function InsightsError({ message, onRetry }) {
  const { t } = useLanguage();
  return (
    <Card className="max-w-2xl flex flex-col items-center text-center gap-4 py-10">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{t('insightsErrorTitle')}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">{message}</p>
      </div>
      <Button onClick={onRetry} variant="secondary" size="sm">{t('insightsTryAgain')}</Button>
    </Card>
  );
}

export default function HistoryInsights() {
  const { t } = useLanguage();
  const { addToast } = useToast();
  const { user } = useAuth();
  const userId = user?.id;

  const [data,              setData]              = useState(() => readInsightsCache(userId));
  const [loading,           setLoading]           = useState(() => !readInsightsCache(userId));
  const [error,             setError]             = useState(null);
  const [refreshing,        setRefreshing]        = useState(false);
  const [summary,           setSummary]           = useState(() => readDoctorSummaryCache(userId));
  const [showSummary,       setShowSummary]       = useState(() => Boolean(readDoctorSummaryCache(userId)));
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const fetchInsights = useCallback(async (force = false) => {
    if (!force) {
      const cached = readInsightsCache(userId);
      if (cached) { setData(cached); setLoading(false); return; }
    }
    try {
      force ? setRefreshing(true) : setLoading(true);
      setError(null);
      const result = await getInsights({ force });
      setData(result);
      writeInsightsCache(userId, result);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const handleRefresh = () => fetchInsights(true);

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const result = await generateDoctorSummary();
      setSummary(result);
      setShowSummary(true);
      writeDoctorSummaryCache(userId, result);
      addToast(t('insightsSummaryToast'), 'success');
    } catch (err) {
      addToast(err.message || t('insightsErrorTitle'), 'error');
    } finally {
      setGeneratingSummary(false);
    }
  };

  if (loading) return <InsightsSkeleton />;
  if (error)   return <InsightsError message={error} onRetry={() => fetchInsights()} />;

  const { healthScore, trendAlerts = [], riskBreakdown = [], recommendedActions = [], cached, generatedAt } = data;

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Health Score */}
      <Card className="text-center">
        <div className="flex flex-col items-center gap-3">
          <HealthScoreGauge score={healthScore.score} size="lg" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('insightsOverallScore')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {healthScore.dataPoints > 0
                ? t('insightsBasedOn', { n: healthScore.dataPoints })
                  + (healthScore.periodMonths > 0 ? ' ' + t('insightsAcrossMonths', { n: healthScore.periodMonths }) : '')
                : t('insightsUploadForScore')}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {generatedAt && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {cached ? t('insightsCached') : t('insightsGenerated')}{relativeTime(generatedAt)}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title={t('refreshLabel')}
              className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? t('insightsRefreshing') : t('refreshLabel')}
            </button>
          </div>
        </div>
      </Card>

      {/* Trend Alerts */}
      {trendAlerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-emerald-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('insightsTrendAlerts')}</h2>
          </div>
          <div className="space-y-3">
            {trendAlerts.map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <InsightCard
                  type={alert.type}
                  icon={alert.icon}
                  title={alert.title}
                  body={alert.body}
                  action={alert.action}
                >
                  {(alert.trendValues || []).length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs flex-wrap">
                      {alert.trendValues.map((tv, j) => (
                        <span key={j} className="flex items-center gap-1">
                          <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded font-medium">
                            {tv.value}
                          </span>
                          {j < alert.trendValues.length - 1 && <span>→</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </InsightCard>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Breakdown */}
      {riskBreakdown.length > 0 && (
        <Card>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('insightsRiskBreakdown')}</h2>
          <div className="space-y-4">
            {riskBreakdown.map(r => (
              <RiskBar
                key={r.label}
                label={r.label}
                percentage={r.percentage}
                color={LEVEL_COLORS[r.level] || '#6b7280'}
                level={r.level}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Recommended Actions */}
      {recommendedActions.length > 0 && (
        <Card>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">{t('insightsRecommended')}</h2>
          <div className="space-y-2">
            {recommendedActions.map(a => (
              <div
                key={a.id}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${a.priority === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div className="flex-1">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{a.action}</p>
                  {a.dueDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('insightsDue', { date: a.dueDate })}</p>
                  )}
                </div>
                <button
                  onClick={() => addToast(t('insightsReminderSet'), 'success')}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex-shrink-0"
                >
                  {t('insightsRemind')}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Doctor Summary */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{t('insightsDoctorTitle')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('insightsDoctorDesc')}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {summary && (
            <Button
              className="flex-1"
              variant="ghost"
              onClick={() => setShowSummary(v => !v)}
            >
              {showSummary ? 'Hide Summary' : 'View Summary'}
            </Button>
          )}
          <Button
            className={summary ? 'flex-1' : 'w-full'}
            variant="secondary"
            loading={generatingSummary}
            onClick={handleGenerateSummary}
          >
            {summary ? t('insightsRegenerateBtn') : t('insightsGenerateBtn')}
          </Button>
        </div>

        {showSummary && summary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3 text-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle className="w-4 h-4" />
              {t('insightsSummaryGenerated', { date: summary.generatedDate })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  labelKey: 'insightsPatient',
                  value: [summary.patientName, summary.age ? `${summary.age}y` : null, summary.bloodGroup].filter(Boolean).join(', '),
                },
                {
                  labelKey: 'insightsCriticalAllergies',
                  value: summary.criticalAllergies.length ? summary.criticalAllergies.join(', ') : t('insightsNoneOnRecord'),
                },
                {
                  labelKey: 'insightsActiveConditions',
                  value: summary.activeConditions.length ? summary.activeConditions.join('; ') : t('insightsNoneDocumented'),
                },
                {
                  labelKey: 'insightsCurrentMeds',
                  value: summary.currentMedications.length ? summary.currentMedications.join('; ') : t('insightsNoneOnRecord'),
                },
              ].map(({ labelKey, value }) => (
                <div key={labelKey} className="col-span-2 sm:col-span-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t(labelKey)}</p>
                  <p className="text-gray-800 dark:text-gray-200">{value}</p>
                </div>
              ))}
            </div>

            {summary.recentReports && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('insightsRecentReports')}</p>
                <p className="text-gray-800 dark:text-gray-200">{summary.recentReports}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('insightsKeyInsights')}</p>
              <p className="text-gray-800 dark:text-gray-200">{summary.keyInsights}</p>
            </div>

            {summary.emergencyContact !== 'Not provided' && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('insightsEmergencyContact')}</p>
                <p className="text-gray-800 dark:text-gray-200">{summary.emergencyContact}</p>
              </div>
            )}

            <Button size="sm" onClick={() => addToast(t('insightsSharedToast'), 'success')}>
              {t('insightsShareBtn')}
            </Button>
          </motion.div>
        )}
      </Card>

      <DisclaimerBanner message={t('insightsDisclaimer')} />
    </div>
  );
}
