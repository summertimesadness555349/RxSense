import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, Upload, ShieldAlert, Pencil, Check, X, Plus } from 'lucide-react';
import FileDropzone from '../components/ui/FileDropzone.jsx';
import Modal from '../components/ui/Modal.jsx';
import PrescriptionChatbot from '../components/prescription/PrescriptionChatbot.jsx';
import { useAuth }     from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  analyzePrescription,
  getPrescriptionHistory,
  deletePrescriptionScan,
  removePrescriptionScan,
  savePrescriptionScan,
  updatePrescriptionScan,
} from '../services/api.js';

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

// ── Small reusable edit action buttons ────────────────────────────────────────
function EditBtn({ onClick }) {
  return (
    <button onClick={onClick} className="ml-1.5 p-1 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex-shrink-0">
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );
}
function SaveCancelBtns({ onSave, onCancel, disabled = false }) {
  return (
    <div className="flex gap-1">
      <button onClick={onSave} disabled={disabled} className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={onCancel} disabled={disabled} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}
function InlineInput({ value, onChange, placeholder, className = '' }) {
  return (
    <input
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${className}`}
    />
  );
}

// ── Analysis result view ──────────────────────────────────────────────────────
function ResultView({ result, onSave, onRemove, onDelete, onEdit }) {
  const { t } = useLanguage();
  const { addToast } = useToast();

  // Per-section edit state — reset when scan changes
  const [editingPatient, setEditingPatient] = useState(false);
  const [editingDoctor,  setEditingDoctor]  = useState(false);
  const [editingMedIdx,  setEditingMedIdx]  = useState(null);
  const [saving,         setSaving]         = useState(false);

  const [patientDraft, setPatientDraft] = useState({});
  const [doctorDraft,  setDoctorDraft]  = useState({});
  const [medsDraft,    setMedsDraft]    = useState([]);

  // Rx expiry status
  const [rxStatus,  setRxStatus]  = useState(result.rx_status  || 'ongoing');
  const [rxEndDate, setRxEndDate] = useState(result.rx_end_date || '');

  // Reset all local state whenever the active scan changes
  const scanKey = result.scan_id || result.savedAt || '';
  useEffect(() => {
    setPatientDraft({ ...(result.patient || {}) });
    setDoctorDraft({ ...(result.doctor || {}) });
    setMedsDraft((result.medications || []).map(m => ({ ...m })));
    setRxStatus(result.rx_status || 'ongoing');
    setRxEndDate(result.rx_end_date || '');
    setEditingPatient(false);
    setEditingDoctor(false);
    setEditingMedIdx(null);
  }, [scanKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (patch) => onEdit && onEdit({ ...result, ...patch });

  const callUpdate = async (patch) => {
    if (!result.scan_id) return true; // localStorage-only scan — skip API
    setSaving(true);
    try {
      await updatePrescriptionScan(result.scan_id, patch);
      return true;
    } catch {
      addToast(t('saveEditError') || 'Failed to save — please try again', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const savePatient = async () => {
    if (!await callUpdate({ patient: patientDraft })) return;
    emit({ patient: patientDraft });
    setEditingPatient(false);
  };

  const saveDoctor = async () => {
    if (!await callUpdate({ doctor: doctorDraft })) return;
    emit({ doctor: doctorDraft });
    setEditingDoctor(false);
  };

  const saveMed = async (idx) => {
    const next = medsDraft.map((m, i) => i === idx ? { ...medsDraft[idx] } : m);
    if (!await callUpdate({ medications: next })) return;
    emit({ medications: next });
    setEditingMedIdx(null);
  };

  const saveRxStatus = async (status, endDate) => {
    const end = status === 'closed' ? (endDate || null) : null;
    if (!await callUpdate({ rx_status: status, rx_end_date: end })) return;
    setRxStatus(status);
    if (status !== 'closed') setRxEndDate('');
    emit({ rx_status: status, rx_end_date: end });
  };

  const setMedField = (idx, field, val) =>
    setMedsDraft(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));

  return (
    <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">

      {/* ── Doctor + Patient ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 py-4">

        {/* Doctor */}
        <div className="pr-4 space-y-1">
          <div className="flex items-center mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('doctorLabel')}</p>
            {!editingDoctor
              ? <EditBtn onClick={() => setEditingDoctor(true)} />
              : <SaveCancelBtns onSave={saveDoctor} onCancel={() => setEditingDoctor(false)} disabled={saving} />
            }
          </div>
          {editingDoctor ? (
            <div className="space-y-1.5">
              <InlineInput value={doctorDraft.name} onChange={v => setDoctorDraft(d => ({...d, name: v}))} placeholder="Doctor name" />
              <InlineInput value={doctorDraft.qualification} onChange={v => setDoctorDraft(d => ({...d, qualification: v}))} placeholder="Qualification" />
              <InlineInput value={doctorDraft.specialization} onChange={v => setDoctorDraft(d => ({...d, specialization: v}))} placeholder="Specialization" />
            </div>
          ) : (
            <>
              {result.doctor?.name
                ? <p className="font-semibold text-base text-gray-900 dark:text-white leading-tight">{result.doctor.name.replace(/^Dr\.\s*/i, 'Dr. ')}</p>
                : <p className="text-base text-gray-400">{t('notSpecified')}</p>
              }
              {result.doctor?.qualification   && <p className="text-sm text-gray-500 dark:text-gray-400">{result.doctor.qualification}</p>}
              {result.doctor?.specialization  && <p className="text-sm text-gray-500 dark:text-gray-400">{result.doctor.specialization}</p>}
              {result.hospital?.name          && <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{result.hospital.name}</p>}
              {result.date                    && <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{result.date}</p>}
            </>
          )}
        </div>

        {/* Patient */}
        <div className="pl-4 border-l border-gray-200 dark:border-gray-700 space-y-1">
          <div className="flex items-center mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('patientLabel')}</p>
            {!editingPatient
              ? <EditBtn onClick={() => setEditingPatient(true)} />
              : <SaveCancelBtns onSave={savePatient} onCancel={() => setEditingPatient(false)} disabled={saving} />
            }
          </div>
          {editingPatient ? (
            <div className="space-y-1.5">
              <InlineInput value={patientDraft.name} onChange={v => setPatientDraft(d => ({...d, name: v}))} placeholder="Patient name" />
              <InlineInput value={patientDraft.age}  onChange={v => setPatientDraft(d => ({...d, age: v}))}  placeholder="Age" />
              <InlineInput value={patientDraft.gender} onChange={v => setPatientDraft(d => ({...d, gender: v}))} placeholder="Gender" />
            </div>
          ) : (
            <>
              {result.patient?.name
                ? <p className="font-semibold text-base text-gray-900 dark:text-white leading-tight">{result.patient.name}</p>
                : <p className="text-base text-gray-400">{t('notSpecified')}</p>
              }
              {result.patient?.age > 0    && <p className="text-sm text-gray-500 dark:text-gray-400">{t('ageLabel')} {result.patient.age}</p>}
              {result.patient?.gender     && <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{result.patient.gender}</p>}
              <span className="inline-block mt-1.5 text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold">
                {t('confidencePct', { pct: result.confidence })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Prescription status (ongoing / closed) ────────────────────────── */}
      <div className="py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">Prescription Status</p>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio" name={`rxstatus-${scanKey}`} value="ongoing"
              checked={rxStatus === 'ongoing'}
              onChange={() => saveRxStatus('ongoing', '')}
              className="w-4 h-4 text-emerald-500 border-gray-300 dark:border-gray-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ongoing</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio" name={`rxstatus-${scanKey}`} value="closed"
              checked={rxStatus === 'closed'}
              onChange={() => setRxStatus('closed')}
              className="w-4 h-4 text-emerald-500 border-gray-300 dark:border-gray-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Closed on</span>
          </label>
          {rxStatus === 'closed' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={rxEndDate}
                onChange={e => setRxEndDate(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                onClick={() => saveRxStatus('closed', rxEndDate)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
              >
                Save
              </button>
            </div>
          )}
        </div>
        {rxStatus === 'ongoing' && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium">Active — medications are still being taken.</p>
        )}
        {rxStatus === 'closed' && rxEndDate && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">Prescription closed on <strong>{rxEndDate}</strong>.</p>
        )}
      </div>

      {/* ── Diagnosis + Tests ─────────────────────────────────────────────── */}
      {(result.diseases?.length > 0 || result.tests?.length > 0) && (
        <div className="grid grid-cols-2 gap-4 py-4">
          {result.diseases?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('diagnosisLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.diseases.map((d, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-sm font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">{d}</span>
                ))}
              </div>
            </div>
          )}
          {result.tests?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('requiredTests')}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.tests.map((test, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">{test}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Medications ───────────────────────────────────────────────────── */}
      <div className="py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">{t('prescribedMeds')}</p>
        {result.medications?.length === 0 ? (
          <p className="text-base text-gray-500 dark:text-gray-400">{t('noMedsDetected')}</p>
        ) : (
          <div className="space-y-2">
            {medsDraft.map((med, i) => {
              const isEditing = editingMedIdx === i;
              return (
                <div key={med.id ?? i} className={`p-3.5 rounded-xl border transition-colors ${isEditing ? 'border-emerald-400 bg-white dark:bg-gray-900' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/60'}`}>
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Editing Medication</span>
                        <SaveCancelBtns onSave={() => saveMed(i)} onCancel={() => setEditingMedIdx(null)} disabled={saving} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Name</p>
                          <InlineInput value={med.name} onChange={v => setMedField(i, 'name', v)} placeholder="Drug name" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Generic</p>
                          <InlineInput value={med.generic} onChange={v => setMedField(i, 'generic', v)} placeholder="Generic name" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Dosage</p>
                          <InlineInput value={med.dosage} onChange={v => setMedField(i, 'dosage', v)} placeholder="e.g. 500mg" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Frequency</p>
                          <InlineInput value={med.frequency} onChange={v => setMedField(i, 'frequency', v)} placeholder="e.g. 1+0+1" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Duration</p>
                          <InlineInput value={med.duration} onChange={v => setMedField(i, 'duration', v)} placeholder="e.g. 7 days" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Instructions</p>
                          <InlineInput value={med.instructions} onChange={v => setMedField(i, 'instructions', v)} placeholder="e.g. after meal" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base text-gray-900 dark:text-white">{med.name}</p>
                        {med.generic && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{med.generic}</p>}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                          {med.dosage     && <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{med.dosage}</span>}
                          {med.frequency  && <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{med.frequency}</span>}
                          {med.duration
                            ? <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{med.duration}</span>
                            : (
                              <button
                                onClick={() => setEditingMedIdx(i)}
                                className="text-xs text-gray-400 hover:text-emerald-500 flex items-center gap-0.5 transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Add duration
                              </button>
                            )
                          }
                          {med.instructions && <span className="text-sm text-gray-500 dark:text-gray-400 italic">{med.instructions}</span>}
                        </div>
                      </div>
                      <EditBtn onClick={() => setEditingMedIdx(i)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Warnings ─────────────────────────────────────────────────────── */}
      {result.warnings?.length > 0 && (
        <div className="py-4 space-y-2">
          {result.warnings.map((w, i) => (
            <div key={i} className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border ${
              w.type === 'danger' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              : w.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
              : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
            }`}>
              {w.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 pt-4">
        <button
          onClick={result.patient_id != null ? onRemove : onSave}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            result.patient_id != null ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          {result.patient_id != null ? t('removePrescBtn') : t('savePrescBtn')}
        </button>
        <button onClick={onDelete} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors">
          {t('deletePrescBtn')}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Prescription() {
  const { t } = useLanguage();
  const { addToast } = useToast();
  const { user } = useAuth();

  const [phase, setPhase]           = useState('upload');
  const [stepIdx, setStepIdx]       = useState(0);
  const [activeScan, setActiveScan] = useState(null);
  const [history, setHistory]       = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [pendingSaveScan, setPendingSaveScan] = useState(null);

  const normalizeName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();

  const refreshPrescriptionHistory = async () => {
    const updated = await getPrescriptionHistory();
    setHistory(updated || []);
    return updated || [];
  };

  const performSavePrescription = async (scan) => {
    if (!scan?.scan_id) return;

    try {
      const savedScan = await savePrescriptionScan(scan.scan_id);
      const updatedHistory = await refreshPrescriptionHistory();
      const refreshedScan = updatedHistory.find((item) => item.scan_id === scan.scan_id) || {
        ...scan,
        patient_id: savedScan?.patient_id ?? scan.patient_id ?? null,
      };
      setActiveScan(refreshedScan);
      addToast(t('prescriptionSavedToast'), 'success');
    } catch (error) {
      addToast(error.message || 'Could not save prescription', 'error');
    }
  };

  const handleSavePrescription = async (scan) => {
    if (!scan?.scan_id) return;

    const profileName = user?.name;
    const patientName = scan?.patient?.name;
    if (profileName && patientName && normalizeName(profileName) !== normalizeName(patientName)) {
      setPendingSaveScan(scan);
      setSaveConfirmOpen(true);
      return;
    }

    await performSavePrescription(scan);
  };

  const confirmSavePrescription = async () => {
    const scan = pendingSaveScan;
    setSaveConfirmOpen(false);
    setPendingSaveScan(null);
    if (scan) await performSavePrescription(scan);
  };

  const cancelSavePrescription = () => {
    setSaveConfirmOpen(false);
    setPendingSaveScan(null);
  };

  const handleRemovePrescription = async (scan) => {
    if (!scan?.scan_id) return;

    try {
      const removedScan = await removePrescriptionScan(scan.scan_id);
      const updatedHistory = await refreshPrescriptionHistory();
      const refreshedScan = updatedHistory.find((item) => item.scan_id === scan.scan_id) || {
        ...scan,
        patient_id: removedScan?.patient_id ?? null,
      };
      setActiveScan(refreshedScan);
      addToast(t('prescriptionRemovedToast'), 'success');
    } catch (error) {
      addToast(error.message || 'Could not remove prescription', 'error');
    }
  };

  const handleDeletePrescription = async (scan) => {
    if (!scan?.scan_id) return;

    try {
      await deletePrescriptionScan(scan.scan_id);
      const updatedHistory = history.filter((item) => item.scan_id !== scan.scan_id);
      setHistory(updatedHistory);

      if (activeScan?.scan_id === scan.scan_id) {
        setActiveScan(updatedHistory[0] || null);
        setPhase(updatedHistory.length > 0 ? 'result' : 'upload');
      }

      addToast(t('prescriptionDeletedToast'), 'success');
    } catch (error) {
      addToast(error.message || 'Could not delete prescription', 'error');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const h = await getPrescriptionHistory();
        setHistory(h || []);
        if ((h || []).length > 0) {
          setActiveScan(h[0]);
          setPhase('result');
        }
      } catch (err) {
        console.error('Failed to load prescription history', err);
        setHistory([]);
      }
    })();
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
      try {
        const updated = await getPrescriptionHistory();
        setHistory(updated || []);
      } catch (e) {
        console.error('Failed to refresh prescription history', e);
      }
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
      <Modal isOpen={saveConfirmOpen} onClose={cancelSavePrescription} title={t('savePrescBtn')} size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/15 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex-shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{t('savePrescBtn')}</p>
              <p className="text-sm leading-6 text-amber-800 dark:text-amber-200 mt-1">
                {t('saveWarningForName', {
                  name: pendingSaveScan?.patient?.name || t('notSpecified'),
                  profileName: user?.name || t('notSpecified'),
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={cancelSavePrescription}
              className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('cancelBtn')}
            </button>
            <button
              type="button"
              onClick={confirmSavePrescription}
              className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              {t('savePrescBtn')}
            </button>
          </div>
        </div>
      </Modal>

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
            <ResultView
              key={activeScan.scan_id || activeScan.savedAt}
              result={activeScan}
              onSave={() => handleSavePrescription(activeScan)}
              onRemove={() => handleRemovePrescription(activeScan)}
              onDelete={() => handleDeletePrescription(activeScan)}
              onEdit={(edited) => setActiveScan(edited)}
            />
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
