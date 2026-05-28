import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, Upload, ShieldAlert } from 'lucide-react';
import FileDropzone from '../components/ui/FileDropzone.jsx';
import ReportChatbot from '../components/report/ReportChatbot.jsx';
import { Select } from '../components/ui/Input.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { analyzeReport, getReportHistoryLocal } from '../services/api.js';

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

const STEPS = [
  'Reading document…',
  'Extracting values…',
  'Identifying abnormalities…',
  'Saving to your health record…',
];

const STATUS_CONFIG = {
  normal:        { label: 'Normal',     cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  high:          { label: 'High',       cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
  low:           { label: 'Low',        cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  critical_high: { label: 'Critical',   cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
  critical_low:  { label: 'Critical',   cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
  borderline:    { label: 'Borderline', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
};

// ── Processing spinner ────────────────────────────────────────────────────────
function ProcessingView({ stepIdx }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mx-auto mb-5" />
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Analysing report…</h3>
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
  const [expanded, setExpanded] = useState(false);
  if (!imageUrl) return null;
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <img src={imageUrl} alt="report" className="w-9 h-9 object-cover rounded-lg flex-shrink-0 border border-gray-200 dark:border-gray-700" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">Report Image</span>
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
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Saved Reports
        </span>
        <button
          onClick={onNew}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 font-medium"
        >
          <Upload className="w-3 h-3" /> Analyze new
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
              <span className="text-gray-400 dark:text-gray-500">{sectionCount} sec{sectionCount !== 1 ? 's' : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, flag }) {
  if (!status || status === 'normal') return null;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.high;
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.cls}`}>
      {flag || cfg.label}
    </span>
  );
}

// ── Report result view ────────────────────────────────────────────────────────
function ResultView({ report }) {
  return (
    <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">

      {/* Report info + Patient side by side */}
      <div className="grid grid-cols-2 py-4">
        <div className="pr-4 space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Report Info</p>
          {report.type && (
            <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{report.type}</p>
          )}
          {report.facility && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{report.facility}</p>
          )}
          {report.ordering_doctor && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{report.ordering_doctor}</p>
          )}
          {report.date && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{report.date}</p>
          )}
        </div>

        <div className="pl-4 border-l border-gray-200 dark:border-gray-700 space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Patient</p>
          {report.patient?.name ? (
            <>
              <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{report.patient.name}</p>
              {report.patient.age && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Age {report.patient.age}</p>
              )}
              {report.patient.gender && (
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{report.patient.gender}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">Not specified</p>
          )}
        </div>
      </div>

      {/* Overall impression */}
      {report.overall_impression && (
        <div className="py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Overall Impression</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{report.overall_impression}</p>
        </div>
      )}

      {/* Diagnoses + Recommendations side by side */}
      {(report.diagnoses?.length > 0 || report.recommendations?.length > 0) && (
        <div className="grid grid-cols-2 gap-4 py-4">
          {report.diagnoses?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Diagnoses</p>
              <div className="flex flex-wrap gap-1.5">
                {report.diagnoses.map((d, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.recommendations?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Recommendations</p>
              <ol className="space-y-1">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-gray-600 dark:text-gray-300">
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
        const isTable = section.type === 'lab_results' || section.type === 'vitals';
        const hasEntries = section.entries?.length > 0;
        if (!hasEntries && !section.narrative) return null;

        return (
          <div key={si} className="py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
              {section.title}
            </p>

            {isTable && hasEntries && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[320px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left font-semibold text-gray-400 pb-1.5 pl-2 pr-3 w-[38%]">Parameter</th>
                      <th className="text-left font-semibold text-gray-400 pb-1.5 pr-3">Value</th>
                      <th className="text-left font-semibold text-gray-400 pb-1.5 pr-3">Reference</th>
                      <th className="text-left font-semibold text-gray-400 pb-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {section.entries.map((e, ei) => {
                      const isAbnormal = e.status && e.status !== 'normal';
                      return (
                        <tr key={ei} className={isAbnormal ? 'bg-red-50/40 dark:bg-red-900/5' : ''}>
                          <td className="py-2 pl-2 pr-3 font-medium text-gray-800 dark:text-gray-200">{e.label}</td>
                          <td className="py-2 pr-3 font-bold text-gray-900 dark:text-white">
                            {e.value ?? '—'}
                            {e.unit && <span className="font-normal text-gray-400 ml-0.5">{e.unit}</span>}
                          </td>
                          <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{e.reference_range || '—'}</td>
                          <td className="py-2">
                            <StatusBadge status={e.status} flag={e.flag} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isTable && section.narrative && (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{section.narrative}</p>
            )}

            {!isTable && !section.narrative && hasEntries && (
              <div className="space-y-1.5">
                {section.entries.map((e, ei) => (
                  <div key={ei} className="flex items-start gap-2 text-xs flex-wrap">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">{e.label}:</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {e.value ?? ''}{e.unit ? ' ' + e.unit : ''}
                      {e.reference_range && <span className="text-gray-400 ml-1">({e.reference_range})</span>}
                    </span>
                    <StatusBadge status={e.status} flag={e.flag} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Clinical notes + Follow-up */}
      {(report.clinical_notes || report.follow_up) && (
        <div className="grid grid-cols-2 gap-4 py-4">
          {report.clinical_notes && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Clinical Notes</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{report.clinical_notes}</p>
            </div>
          )}
          {report.follow_up && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Follow-up</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{report.follow_up}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Report() {
  const [phase, setPhase]               = useState('upload');
  const [stepIdx, setStepIdx]           = useState(0);
  const [activeReport, setActiveReport] = useState(null);
  const [history, setHistory]           = useState([]);
  const [showUpload, setShowUpload]     = useState(false);
  const [reportType, setReportType]     = useState('Complete Blood Count (CBC)');
  const { addToast }                    = useToast();

  useEffect(() => {
    const h = getReportHistoryLocal();
    setHistory(h);
    if (h.length > 0) {
      setActiveReport(h[0]);
      setPhase('result');
    }
  }, []);

  const handleUpload = async (file) => {
    setPhase('processing');
    setShowUpload(false);
    setStepIdx(0);

    const stepTimer = setInterval(() => {
      setStepIdx(prev => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 900);

    try {
      const result = await analyzeReport(file, reportType);
      clearInterval(stepTimer);
      setActiveReport(result);
      setPhase('result');
      const updated = getReportHistoryLocal();
      setHistory(updated);
      addToast('Report analyzed and saved to your Health Record!', 'success');
    } catch (err) {
      clearInterval(stepTimer);
      setPhase(activeReport ? 'result' : 'upload');
      addToast(`Analysis failed: ${err.message}`, 'error');
    }
  };

  const isProcessing = phase === 'processing';
  const hasHistory   = history.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden gap-3 px-4 lg:px-8">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
            Medical Report Analyzer
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Upload any lab report — we'll extract and explain all findings in Bangla.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400 flex-shrink-0">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
          Not a medical diagnosis
        </div>
      </div>

      {/* ── Two-column body ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 overflow-hidden">

        {/* ── Left panel ──────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto pr-1 space-y-4 min-h-0">

          {/* Upload dropzone + report type selector */}
          {(phase === 'upload' || showUpload) && (
            <div className="space-y-3">
              <Select
                label="Report Type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <FileDropzone
                onFileSelect={(file) => { setShowUpload(false); handleUpload(file); }}
                accept="image/*,.pdf"
                label="Drag & drop your report (PDF or image) here, or click to browse"
                hint="Supports PDF, JPG, PNG, HEIC. CBC, lipid panel, X-ray, ECG, and more."
              />
            </div>
          )}

          {/* Processing */}
          {isProcessing && <ProcessingView stepIdx={stepIdx} />}

          {/* Report selector */}
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

          {/* Collapsed image */}
          {activeReport?.image_url && !isProcessing && (
            <CollapsibleImage imageUrl={activeReport.image_url} />
          )}

          {/* Report result */}
          {activeReport && !isProcessing && (
            <ResultView report={activeReport} />
          )}

          {/* Actions */}
          {!isProcessing && (
            <div className="pb-4">
              {activeReport ? (
                <button
                  onClick={() => setShowUpload(p => !p)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {showUpload ? 'Cancel' : 'Analyze Another Report'}
                </button>
              ) : (
                !showUpload && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
                  >
                    <Upload className="w-4 h-4" /> Upload Report
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
