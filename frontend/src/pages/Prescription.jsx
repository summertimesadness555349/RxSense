import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, Upload, ShieldAlert } from 'lucide-react';
import FileDropzone from '../components/ui/FileDropzone.jsx';
import PrescriptionChatbot from '../components/prescription/PrescriptionChatbot.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { analyzePrescription, getPrescriptionHistoryLocal } from '../services/api.js';

// ── Processing spinner ────────────────────────────────────────────────────────
function ProcessingView({ stepIdx }) {
  const { t } = useLanguage();
  const STEPS = [
    t('stepReadingHandwriting'),
    t('stepIdentifyingMeds'),
    t('stepExtractingDosages'),
    t('stepSavingRecord'),
  ];
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto mb-5" />
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{t('analysingPrescription')}</h3>
      <div className="space-y-2 max-w-xs mx-auto">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg transition-all ${
            i < stepIdx
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
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

// ── Collapsible prescription image ───────────────────────────────────────────
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
        <img src={imageUrl} alt="rx" className="w-9 h-9 object-cover rounded-lg flex-shrink-0 border border-gray-200 dark:border-gray-700" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{t('prescriptionImage')}</span>
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
            <img src={imageUrl} alt="prescription full" className="w-full object-contain max-h-[60vh]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Horizontal prescription selector ─────────────────────────────────────────
function ScanSelector({ history, activeScan, onSelect, onNew }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {t('savedPrescriptions')}
        </span>
        <button
          onClick={onNew}
          className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 font-medium"
        >
          <Upload className="w-3 h-3" /> {t('scanNew')}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {history.map((item, i) => {
          const isActive = activeScan && (
            item.scan_id
              ? item.scan_id === activeScan.scan_id
              : item.savedAt === activeScan.savedAt
          );
          const rawName = item.doctor?.name || '';
          const label = rawName
            ? rawName.replace(/^Dr\.\s*/i, '').split(' ').slice(0, 2).join(' ')
            : 'Prescription';
          const medCount = item.medications?.length || 0;
          return (
            <button
              key={item.scan_id || item.savedAt || i}
              onClick={() => onSelect(item)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border text-xs transition-all min-w-[72px] ${
                isActive
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {item.image_url
                ? <img src={item.image_url} className="w-9 h-9 rounded-lg object-cover" alt="" />
                : <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm text-gray-400">Rx</div>
              }
              <span className="font-medium truncate w-full text-center">{label}</span>
              <span className="text-gray-400 dark:text-gray-500">{t('medsCount', { n: medCount })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Analysis result view ──────────────────────────────────────────────────────
function ResultView({ result }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">

      {/* Doctor + Patient side by side */}
      <div className="grid grid-cols-2 py-4">
        <div className="pr-4 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('doctorLabel')}</p>
          {result.doctor?.name ? (
            <>
              <p className="font-semibold text-base text-gray-900 dark:text-white leading-tight">
                {result.doctor.name.replace(/^Dr\.\s*/i, 'Dr. ')}
              </p>
              {result.doctor.qualification && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{result.doctor.qualification}</p>
              )}
              {result.doctor.specialization && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{result.doctor.specialization}</p>
              )}
              {result.hospital?.name && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{result.hospital.name}</p>
              )}
            </>
          ) : (
            <p className="text-base text-gray-400">{t('notSpecified')}</p>
          )}
          {result.date && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{result.date}</p>
          )}
        </div>

        <div className="pl-4 border-l border-gray-200 dark:border-gray-700 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('patientLabel')}</p>
          {result.patient?.name ? (
            <>
              <p className="font-semibold text-base text-gray-900 dark:text-white leading-tight">{result.patient.name}</p>
              {result.patient.age > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('ageLabel')} {result.patient.age}</p>
              )}
              {result.patient.gender && (
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{result.patient.gender}</p>
              )}
            </>
          ) : (
            <p className="text-base text-gray-400">{t('notSpecified')}</p>
          )}
          <span className="inline-block mt-1.5 text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold">
            {t('confidencePct', { pct: result.confidence })}
          </span>
        </div>
      </div>

      {/* Diagnosis + Tests side by side */}
      {(result.diseases?.length > 0 || result.tests?.length > 0) && (
        <div className="grid grid-cols-2 gap-4 py-4">
          {result.diseases?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('diagnosisLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.diseases.map((d, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-sm font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.tests?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('requiredTests')}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.tests.map((test, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                    {test}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Medications */}
      <div className="py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">{t('prescribedMeds')}</p>
        {result.medications?.length === 0 ? (
          <p className="text-base text-gray-500 dark:text-gray-400">{t('noMedsDetected')}</p>
        ) : (
          <div className="space-y-2">
            {result.medications.map((med, i) => (
              <div key={med.id ?? i} className="flex items-start gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base text-gray-900 dark:text-white">{med.name}</p>
                  {med.generic && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{med.generic}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    {med.dosage && (
                      <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{med.dosage}</span>
                    )}
                    {med.frequency && (
                      <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{med.frequency}</span>
                    )}
                    {med.duration && (
                      <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{med.duration}</span>
                    )}
                    {med.instructions && (
                      <span className="text-sm text-gray-500 dark:text-gray-400 italic">{med.instructions}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warnings */}
      {result.warnings?.length > 0 && (
        <div className="py-4 space-y-2">
          {result.warnings.map((w, i) => (
            <div key={i} className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border ${
              w.type === 'danger'
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                : w.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
            }`}>
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Prescription() {
  const { t } = useLanguage();
  const { addToast } = useToast();

  const [phase, setPhase]           = useState('upload');
  const [stepIdx, setStepIdx]       = useState(0);
  const [activeScan, setActiveScan] = useState(null);
  const [history, setHistory]       = useState([]);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    const h = getPrescriptionHistoryLocal();
    setHistory(h);
    if (h.length > 0) {
      setActiveScan(h[0]);
      setPhase('result');
    }
  }, []);

  const handleUpload = async (file) => {
    setPhase('processing');
    setShowUpload(false);
    setStepIdx(0);

    const STEP_COUNT = 4;
    const stepTimer = setInterval(() => {
      setStepIdx(prev => (prev < STEP_COUNT - 1 ? prev + 1 : prev));
    }, 700);

    try {
      const result = await analyzePrescription(file);
      clearInterval(stepTimer);
      setActiveScan(result);
      setPhase('result');
      const updated = getPrescriptionHistoryLocal();
      setHistory(updated);
      addToast(t('prescriptionSavedToast'), 'success');
    } catch (err) {
      clearInterval(stepTimer);
      setPhase(activeScan ? 'result' : 'upload');
      addToast(t('analysisFailed', { msg: err.message }), 'error');
    }
  };

  const isProcessing = phase === 'processing';
  const hasHistory   = history.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden gap-3 px-4 lg:px-8">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
            {t('prescriptionPageTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('prescriptionPageSubtitle')}
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
            <div>
              <FileDropzone
                onFileSelect={(file) => { setShowUpload(false); handleUpload(file); }}
                accept="image/*"
                label={t('prescriptionDropzoneLabel')}
                hint={t('prescriptionDropzoneHint')}
                showCamera
              />
            </div>
          )}

          {isProcessing && <ProcessingView stepIdx={stepIdx} />}

          {hasHistory && !isProcessing && (
            <ScanSelector
              history={history}
              activeScan={activeScan}
              onSelect={(item) => {
                setActiveScan(item);
                setPhase('result');
                setShowUpload(false);
              }}
              onNew={() => setShowUpload(p => !p)}
            />
          )}

          {activeScan?.image_url && !isProcessing && (
            <CollapsibleImage imageUrl={activeScan.image_url} />
          )}

          {activeScan && !isProcessing && (
            <ResultView result={activeScan} />
          )}

          {!isProcessing && (
            <div className="pb-4">
              {activeScan ? (
                <button
                  onClick={() => setShowUpload(p => !p)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {showUpload ? t('cancelBtn') : t('scanAnotherBtn')}
                </button>
              ) : (
                !showUpload && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
                  >
                    <Upload className="w-4 h-4" /> {t('uploadPrescriptionBtn')}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: chatbot ─────────────────────────────────────────────── */}
        <div className="overflow-hidden min-h-0">
          <PrescriptionChatbot prescription={activeScan} />
        </div>
      </div>
    </div>
  );
}
