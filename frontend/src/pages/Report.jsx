import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, Upload, ShieldAlert } from 'lucide-react';
import FileDropzone from '../components/ui/FileDropzone.jsx';
import ReportChatbot from '../components/report/ReportChatbot.jsx';
import PredictionCard from '../components/predictions/PredictionCard.jsx';
import ComplicationsCard from '../components/predictions/ComplicationsCard.jsx';
import Modal from '../components/ui/Modal.jsx';
import { Select } from '../components/ui/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  analyzeReport,
  getReportHistory,
  saveReportScan,
  removeReportScan,
  deleteReportScan,
  getPredictions,
} from '../services/api.js';

const REPORT_TYPES = [
  'Complete Blood Count (CBC)',
  'Lipid Panel',
  'Liver Function Test (LFT)',
  'Kidney Function Test (KFT)',
  'HbA1c / Diabetes Panel',
  'Thyroid Panel',
  'Urine Analysis',
  'X-Ray',
  'ECG / EKG',
  'MRI / CT Scan',
  'Ultrasound',
  'Other',
];

// status → translation key
const STATUS_KEY_MAP = {
  normal:        'statusNormal',
  high:          'statusHigh',
  low:           'statusLow',
  critical_high: 'statusCritical',
  critical_low:  'statusCritical',
  borderline:    'statusBorderline',
};

const STATUS_CLS = {
  normal:        'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  high:          'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  low:           'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  critical_high: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  critical_low:  'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  borderline:    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
};

// ── Processing spinner ────────────────────────────────────────────────────────
function ProcessingView({ stepIdx }) {
  const { t } = useLanguage();
  const STEPS = [
    t('stepReadingDoc'),
    t('stepExtractingValues'),
    t('stepIdentifyingAbnormal'),
    t('stepSavingRecord'),
  ];
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mx-auto mb-5" />
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{t('analysingReport')}</h3>
      <div className="space-y-2 max-w-xs mx-auto">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg transition-all ${
            i < stepIdx
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
              : i === stepIdx
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white animate-pulse'
              : 'text-gray-400 dark:text-gray-600'
          }`}>
            <span className="w-5 flex-shrink-0 text-center text-xs">
              {i < stepIdx ? '✓' : i === stepIdx ? '…' : '○'}
            </span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Collapsible report image ──────────────────────────────────────────────────
function CollapsibleImage({ imageUrl }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  if (!imageUrl) return null;
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <img src={imageUrl} alt="report" className="w-9 h-9 object-cover rounded-lg flex-shrink-0 border border-gray-200 dark:border-gray-700" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{t('reportImage')}</span>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="img"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <img src={imageUrl} alt="report full" className="w-full object-contain max-h-[60vh]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Report selector ───────────────────────────────────────────────────────────
function ReportSelector({ history, activeReport, onSelect, onNew }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {t('savedReports')}
        </span>
        <button
          onClick={onNew}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 font-medium"
        >
          <Upload className="w-3 h-3" /> {t('analyzeNew')}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {history.map((item, i) => {
          const isActive = activeReport && (
            item.id ? item.id === activeReport.id : item.savedAt === activeReport.savedAt
          );
          const label = item.type
            ? item.type.replace(/\s*\(.*?\)\s*/g, '').trim().split(' ').slice(0, 2).join(' ')
            : 'Report';
          const sectionCount = item.sections?.length || 0;
          return (
            <button
              key={item.id || item.savedAt || i}
              onClick={() => onSelect(item)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border text-xs transition-all min-w-[72px] ${
                isActive
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {item.image_url
                ? <img src={item.image_url} className="w-9 h-9 rounded-lg object-cover" alt="" />
                : <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400">RPT</div>
              }
              <span className="font-medium truncate w-full text-center">{label}</span>
              <span className="text-gray-400 dark:text-gray-500">{t('sectionsCount', { n: sectionCount })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, flag }) {
  const { t } = useLanguage();
  if (!status) return null;
  const cls = STATUS_CLS[status] || STATUS_CLS.high;
  const label = flag || t(STATUS_KEY_MAP[status] || 'statusHigh');
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

// ── Report result view ────────────────────────────────────────────────────────
function ResultView({ report, onSave, onRemove, onDelete }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">

      {/* Report info + Patient side by side */}
      <div className="grid grid-cols-2 py-4">
        <div className="pr-4 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('reportInfo')}</p>
          {report.type && (
            <p className="font-semibold text-base text-gray-900 dark:text-white leading-tight">{report.type}</p>
          )}
          {report.facility && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{report.facility}</p>
          )}
          {report.ordering_doctor && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{report.ordering_doctor}</p>
          )}
          {report.date && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{report.date}</p>
          )}
        </div>

        <div className="pl-4 border-l border-gray-200 dark:border-gray-700 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('patientLabel')}</p>
          {report.patient?.name ? (
            <>
              <p className="font-semibold text-base text-gray-900 dark:text-white leading-tight">{report.patient.name}</p>
              {report.patient.age && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('ageLabel')} {report.patient.age}</p>
              )}
              {report.patient.gender && (
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{report.patient.gender}</p>
              )}
            </>
          ) : (
            <p className="text-base text-gray-400">{t('notSpecified')}</p>
          )}
        </div>
      </div>

      {/* Overall impression */}
      {report.overall_impression && (
        <div className="py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('overallImpression')}</p>
          <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">{report.overall_impression}</p>
        </div>
      )}

      {/* Diagnoses + Recommendations side by side */}
      {(report.diagnoses?.length > 0 || report.recommendations?.length > 0) && (
        <div className="grid grid-cols-2 gap-4 py-4">
          {report.diagnoses?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('diagnoses')}</p>
              <div className="flex flex-wrap gap-1.5">
                {report.diagnoses.map((d, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-sm font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.recommendations?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('recommendations')}</p>
              <ol className="space-y-1.5">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                    <span className="text-blue-500 font-bold flex-shrink-0">{i + 1}.</span> {r}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      {(report.sections || []).map((section, si) => {
        // const isTable = section.type === 'lab_results' || section.type === 'vitals';
        const hasEntries = section.entries?.length > 0;
        if (!hasEntries && !section.narrative) return null;

        return (
          <div key={si} className="py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
              {section.title}
            </p>

            {hasEntries && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[360px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left font-semibold text-gray-500 pb-2 pl-2 pr-3 w-[38%]">{t('colParameter')}</th>
                      <th className="text-left font-semibold text-gray-500 pb-2 pr-3">{t('colValue')}</th>
                      <th className="text-left font-semibold text-gray-500 pb-2 pr-3">{t('colReference')}</th>
                      <th className="text-left font-semibold text-gray-500 pb-2">{t('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {section.entries.map((e, ei) => {
                      const isAbnormal = e.status && e.status !== 'normal';
                      return (
                        <tr key={ei} className={isAbnormal ? 'bg-red-50/40 dark:bg-red-900/5' : ''}>
                          <td className="py-2.5 pl-2 pr-3 font-medium text-gray-800 dark:text-gray-200">{e.label}</td>
                          <td className="py-2.5 pr-3 font-bold text-gray-900 dark:text-white">
                            {e.value ?? '—'}
                            {e.unit && <span className="font-normal text-gray-400 ml-0.5">{e.unit}</span>}
                          </td>
                          <td className="py-2.5 pr-3 text-gray-500 dark:text-gray-400">{e.reference_range || '—'}</td>
                          <td className="py-2.5">
                            <StatusBadge status={e.status} flag={e.flag} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* {!isTable && section.narrative && (
              <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">{section.narrative}</p>
            )}

            {!isTable && !section.narrative && hasEntries && (
              <div className="space-y-2">
                {section.entries.map((e, ei) => (
                  <div key={ei} className="flex items-start gap-2 text-sm flex-wrap">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">{e.label}:</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {e.value ?? ''}{e.unit ? ' ' + e.unit : ''}
                      {e.reference_range && <span className="text-gray-400 ml-1">({e.reference_range})</span>}
                    </span>
                    <StatusBadge status={e.status} flag={e.flag} />
                  </div>
                ))}
              </div>
            )} */}
          </div>
        );
      })}

      {/* Clinical notes + Follow-up */}
      {(report.clinical_notes || report.follow_up) && (
        <div className="grid grid-cols-2 gap-4 py-4">
          {report.clinical_notes && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('clinicalNotes')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{report.clinical_notes}</p>
            </div>
          )}
          {report.follow_up && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('followUp')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{report.follow_up}</p>
            </div>
          )}
        </div>
      )}

      {((report.predictions && report.predictions.length > 0) || report.overallRisk) && (
        <div id="predictions" className="py-4 space-y-4 border-t border-gray-100 dark:border-gray-800 scroll-mt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('futurePredictions') || 'AI Health Predictions'}</p>
          <ComplicationsCard
            predictions={report.predictions}
            overallRisk={report.overallRisk}
            cohortSize={report.cohortSize || 0}
          />
          {report.predictions && report.predictions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Individual Predictions:</p>
              {report.predictions.slice(0, 3).map((pred, idx) => (
                <PredictionCard key={idx} prediction={pred} compact={true} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 pt-4">
        <button
          onClick={report.patient_id != null ? onRemove : onSave}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            report.patient_id != null
              ? "bg-amber-500 hover:bg-amber-600 text-white"
              : "bg-emerald-500 hover:bg-emerald-600 text-white"
          }`}
        >
          {report.patient_id != null ? t('removeReportBtn') : t('saveReportBtn')}
        </button>
        <button
          onClick={onDelete}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors
            bg-red-500 hover:bg-red-600 text-white`}
        >
          {t('deleteReportBtn')}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Report() {
  const { t } = useLanguage();
  const { addToast } = useToast();
  const { user } = useAuth();

  const [phase, setPhase]               = useState('upload');
  const [stepIdx, setStepIdx]           = useState(0);
  const [activeReport, setActiveReport] = useState(null);
  const [history, setHistory]           = useState([]);
  const [showUpload, setShowUpload]     = useState(false);
  const [reportType, setReportType]     = useState('Complete Blood Count (CBC)');
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [pendingSaveReport, setPendingSaveReport] = useState(null);
  const [patientPredictions, setPatientPredictions] = useState([]);

  const normalizeName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();

  const refreshReportHistory = async () => {
    const updated = await getReportHistory();
    const merged = mergeReportsWithPredictions(updated || [], patientPredictions);
    setHistory(merged);
    return updated || [];
  };

  const mergeReportsWithPredictions = (reports, predictions) => {
    if (!predictions?.length) return reports || [];
    return (reports || []).map((report) => {
      const reportPredictions = predictions.filter((prediction) => {
        const predictionReportId = prediction.report_id || prediction.reportId;
        return !predictionReportId || predictionReportId === report.id || predictionReportId === report.report_id;
      });
      return {
        ...report,
        predictions: reportPredictions,
        overallRisk: report.overallRisk || (reportPredictions.length ? 'Review these possible future risks with a clinician if symptoms appear or values keep changing.' : null),
      };
    });
  };

  const performSaveReport = async (report) => {
    if (!report?.id) return;

    try {
      const savedReport = await saveReportScan(report.id);
      const updatedHistory = await refreshReportHistory();
      const refreshedReport = updatedHistory.find((item) => item.id === report.id) || {
        ...report,
        patient_id: savedReport?.patient_id ?? report.patient_id ?? null,
      };
      setActiveReport(refreshedReport);
      addToast(t('reportSavedToast'), 'success');
    } catch (error) {
      addToast(error.message || 'Could not save report', 'error');
    }
  };

  const handleSaveReport = async (report) => {
    if (!report?.id) return;

    const profileName = user?.name;
    const patientName = report?.patient?.name;
    if (profileName && patientName && normalizeName(profileName) !== normalizeName(patientName)) {
      setPendingSaveReport(report);
      setSaveConfirmOpen(true);
      return;
    }

    await performSaveReport(report);
  };

  const confirmSaveReport = async () => {
    const report = pendingSaveReport;
    setSaveConfirmOpen(false);
    setPendingSaveReport(null);
    if (report) await performSaveReport(report);
  };

  const cancelSaveReport = () => {
    setSaveConfirmOpen(false);
    setPendingSaveReport(null);
  };

  const handleRemoveReport = async (report) => {
    if (!report?.id) return;

    try {
      const removedReport = await removeReportScan(report.id);
      const updatedHistory = await refreshReportHistory();
      const refreshedReport = updatedHistory.find((item) => item.id === report.id) || {
        ...report,
        patient_id: removedReport?.patient_id ?? null,
      };
      setActiveReport(refreshedReport);
      addToast(t('reportRemovedToast'), 'success');
    } catch (error) {
      addToast(error.message || 'Could not remove report', 'error');
    }
  };

  const handleDeleteReport = async (report) => {
    if (!report?.id) return;

    try {
      await deleteReportScan(report.id);
      const updatedHistory = history.filter((item) => item.id !== report.id);
      setHistory(updatedHistory);

      if (activeReport?.id === report.id) {
        setActiveReport(updatedHistory[0] || null);
        setPhase(updatedHistory.length > 0 ? 'result' : 'upload');
      }

      addToast(t('reportDeletedToast'), 'success');
    } catch (error) {
      addToast(error.message || 'Could not delete report', 'error');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [historyResult, predictionResult] = await Promise.all([
          getReportHistory(),
          getPredictions().catch(() => []),
        ]);
        setPatientPredictions(predictionResult || []);
        let h = mergeReportsWithPredictions(historyResult || [], predictionResult || []);
        setHistory(h);
        if (h.length > 0) {
          setActiveReport(h[0]);
          setPhase('result');
        }
      } catch (err) {
        console.log('Failed to load report history:', err);
        setHistory([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeReport || patientPredictions.length === 0) return;
    const merged = mergeReportsWithPredictions([activeReport], patientPredictions)[0];
    if (JSON.stringify(merged.predictions || []) !== JSON.stringify(activeReport.predictions || [])) {
      setActiveReport(merged);
    }
  }, [patientPredictions]);

  useEffect(() => {
    if (window.location.hash !== '#predictions') return;
    const timer = setTimeout(() => {
      document.getElementById('predictions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => clearTimeout(timer);
  }, [activeReport?.id, activeReport?.predictions?.length]);

  const handleUpload = async (file) => {
    setPhase('processing');
    setShowUpload(false);
    setStepIdx(0);

    const STEP_COUNT = 4;
    const stepTimer = setInterval(() => {
      setStepIdx(prev => (prev < STEP_COUNT - 1 ? prev + 1 : prev));
    }, 900);

    try {
      const result = await analyzeReport(file, reportType);
      clearInterval(stepTimer);
      setActiveReport(result);
      setPhase('result');
      try {
        const updated = await getReportHistory();
        const h = updated || [];
        setHistory(h);
        // Find the active report in history to ensure it has all fields mapped (including id)
        const historyMatch = h.find(item => item.id === result.id || item.id === result.report_id);
        if (historyMatch) setActiveReport(historyMatch);
      } catch {
        console.log('Failed to update history after analysis');
      }
      addToast(t('reportSavedToast'), 'success');
    } catch (err) {
      clearInterval(stepTimer);
      setPhase(activeReport ? 'result' : 'upload');
      addToast(t('analysisFailed', { msg: err.message }), 'error');
    }
  };

  const isProcessing = phase === 'processing';
  const hasHistory   = history.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden gap-3 px-4 lg:px-8">
      <Modal isOpen={saveConfirmOpen} onClose={cancelSaveReport} title={t('saveReportBtn') || 'Save Report'} size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/15 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex-shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{t('saveReportBtn') || 'Save Report'}</p>
              <p className="text-sm leading-6 text-amber-800 dark:text-amber-200 mt-1">
                {t('saveReportWarningForName', {
                  name: pendingSaveReport?.patient?.name || t('notSpecified'),
                  profileName: user?.name || t('notSpecified'),
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={cancelSaveReport}
              className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('cancelBtn')}
            </button>
            <button
              type="button"
              onClick={confirmSaveReport}
              className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              {t('saveReportBtn') || 'Save Report'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
            {t('reportPageTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('reportPageSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex-shrink-0">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
          {t('notMedicalDiagnosis')}
        </div>
      </div>

      {/* ── Two-column body ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 overflow-hidden">

        {/* ── Left panel ──────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto pr-1 space-y-4 min-h-0">

          {(phase === 'upload' || showUpload) && (
            <div className="space-y-3">
              <Select
                label={t('reportTypeLabel')}
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                {REPORT_TYPES.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
              </Select>
              <FileDropzone
                onFileSelect={(file) => { setShowUpload(false); handleUpload(file); }}
                accept="image/*,.pdf"
                label={t('reportDropzoneLabel')}
                hint={t('reportDropzoneHint')}
              />
            </div>
          )}

          {isProcessing && <ProcessingView stepIdx={stepIdx} />}

          {hasHistory && !isProcessing && (
            <ReportSelector
              history={history}
              activeReport={activeReport}
              onSelect={(item) => {
                setActiveReport(item);
                setPhase('result');
                setShowUpload(false);
              }}
              onNew={() => setShowUpload(p => !p)}
            />
          )}

          {activeReport?.image_url && !isProcessing && (
            <CollapsibleImage imageUrl={activeReport.image_url} />
          )}

          {activeReport && !isProcessing && (
            <ResultView
              report={activeReport}
              onSave={() => handleSaveReport(activeReport)}
              onRemove={() => handleRemoveReport(activeReport)}
              onDelete={() => handleDeleteReport(activeReport)}
            />
          )}

          {!isProcessing && (
            <div className="pb-4">
              {activeReport ? (
                <button
                  onClick={() => setShowUpload(p => !p)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {showUpload ? t('cancelBtn') : t('analyzeAnotherBtn')}
                </button>
              ) : (
                !showUpload && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
                  >
                    <Upload className="w-4 h-4" /> {t('uploadReportBtn')}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: chatbot ─────────────────────────────────────────────── */}
        <div className="overflow-hidden min-h-0">
          <ReportChatbot report={activeReport} />
        </div>
      </div>
    </div>
  );
}
