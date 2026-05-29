import { useState, useEffect } from 'react';
import { Bell, Info, ChevronDown, ChevronUp, Calendar, Sunrise, Sun, Moon } from 'lucide-react';
import Modal from '../components/ui/Modal.jsx';
import { getPatientActiveMedications, getPrescriptionHistoryLocal } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

// ─── Duration parsing ─────────────────────────────────────────────────────────
function parseDurationDays(duration) {
  if (!duration) return null;
  const d = duration.toLowerCase();
  const m = d.match(/(\d+)\s*(day|week|month)/);
  if (!m) return null;
  const n = parseInt(m[1]);
  if (m[2].startsWith('day'))   return n;
  if (m[2].startsWith('week'))  return n * 7;
  if (m[2].startsWith('month')) return n * 30;
  return null;
}

function isMedActive(med, rxSavedAt) {
  const days = parseDurationDays(med.duration);
  if (!days) return true; // no duration info → assume ongoing
  const expiry = new Date(new Date(rxSavedAt).getTime() + days * 86400000);
  return new Date() <= expiry;
}

// ─── Schedule parser ──────────────────────────────────────────────────────────
// Handles both "X-X-X" (morning-afternoon-night) notation AND English frequency text.
function parseSchedule(frequency = '', instructions = '') {
  const freq = (frequency  || '').trim();
  const inst = (instructions || '').toLowerCase();
  const full = `${freq} ${inst}`.toLowerCase();

  const has = (...terms) => terms.some((t) => full.includes(t));

  // Determine meal relation from instructions
  const beforeMeal = has('before meal', 'before eating', 'before food', 'খাওয়ার আগে', 'খাবার আগে', 'pre-meal', ' ac', 'ac ');
  const emptyStomach = has('empty stomach', 'খালি পেটে', 'before breakfast') && !has('before lunch', 'before dinner');

  // ── X-X-X notation (e.g. "1-0-0", "0-0-1", "1-1-1") ──────────────────────
  const xPattern = freq.match(/^([01+½¾])\s*[-–]\s*([01+½¾])\s*[-–]\s*([01+½¾])$/);
  if (xPattern) {
    const toActive = (v) => v !== '0' && v !== '' && v != null;
    const mActive  = toActive(xPattern[1]);
    const aActive  = toActive(xPattern[2]);
    const nActive  = toActive(xPattern[3]);
    const result = {};
    if (emptyStomach && mActive)   { result.morningBefore  = true; }
    else if (mActive) { beforeMeal ? (result.morningBefore = true) : (result.morningAfter = true); }
    if (aActive) { beforeMeal ? (result.afternoonBefore = true) : (result.afternoonAfter = true); }
    if (nActive) { beforeMeal ? (result.nightBefore = true) : (result.nightAfter = true); }
    return Object.keys(result).length ? result : { morningAfter: true };
  }

  // ── SOS / as-needed ───────────────────────────────────────────────────────
  if (has('sos', 'as needed', 'as required', 'when needed', 'prn', 'প্রয়োজনে')) {
    return { sos: true };
  }

  // ── Empty stomach ─────────────────────────────────────────────────────────
  if (emptyStomach) return { morningBefore: true };

  const b = beforeMeal;

  // ── Count-based keywords ──────────────────────────────────────────────────
  const isQID   = has('four times', '4 times', '4x', 'qid');
  const isTDS   = has('three times', '3 times', '3x', 'tds', 'tid', 'thrice');
  const isTwice = has('twice daily', 'twice a day', '2 times', '2x', ' bd', 'bd ', 'bid', 'b.i.d');
  const isOnce  = has('once daily', 'once a day', '1 time', '1x', ' od', 'od ') || (full.match(/\bonce\b/) && !has('twice', 'three', 'four'));

  const isMorning   = has('morning', 'সকাল', 'breakfast');
  const isAfternoon = has('afternoon', 'lunch', 'noon', 'দুপুর');
  const isNight     = has('night', 'bedtime', 'hs ', ' hs', 'রাত', 'evening');

  if (isQID)  return { morningBefore: b, morningAfter: !b, afternoonAfter: true, nightBefore: b, nightAfter: !b };
  if (isTDS)  return { morningAfter: !b, morningBefore: b, afternoonAfter: !b, afternoonBefore: b, nightAfter: !b, nightBefore: b };
  if (isTwice) {
    if (isMorning && isNight)     return { morningAfter: !b, morningBefore: b, nightAfter: !b, nightBefore: b };
    if (isAfternoon && isNight)   return { afternoonAfter: !b, afternoonBefore: b, nightAfter: !b, nightBefore: b };
    return { morningAfter: !b, morningBefore: b, nightAfter: !b, nightBefore: b };
  }
  if (isOnce) {
    if (isNight)     return { nightAfter: !b, nightBefore: b };
    if (isAfternoon) return { afternoonAfter: !b, afternoonBefore: b };
    return { morningAfter: !b, morningBefore: b };
  }

  // Explicit time slots
  if (isMorning && isAfternoon && isNight) return { morningAfter: !b, morningBefore: b, afternoonAfter: !b, afternoonBefore: b, nightAfter: !b, nightBefore: b };
  if (isMorning && isNight)     return { morningAfter: !b, morningBefore: b, nightAfter: !b, nightBefore: b };
  if (isMorning && isAfternoon) return { morningAfter: !b, morningBefore: b, afternoonAfter: !b, afternoonBefore: b };
  if (isNight)     return { nightAfter: !b, nightBefore: b };
  if (isAfternoon) return { afternoonAfter: !b, afternoonBefore: b };
  if (isMorning)   return { morningAfter: !b, morningBefore: b };

  return { morningAfter: true }; // fallback
}

// TIME_ICONS used by table header and cell rendering
export const TIME_ICONS = { morning: Sunrise, afternoon: Sun, night: Moon };

// ─── Table cell ───────────────────────────────────────────────────────────────
function Tick({ active }) {
  return active
    ? <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 text-emerald-500 text-lg">✓</span>
    : <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 text-sm">—</span>;
}

// ─── Medication detail modal ──────────────────────────────────────────────────
function MedModal({ med, rx, onClose }) {
  const { t } = useLanguage();
  const sched = med ? parseSchedule(med.frequency, med.instructions) : {};

  const SLOT_LABELS = [
    { key: 'morningBefore',   label: `${t('timeMorning')} · ${t('timingBefore')}` },
    { key: 'morningAfter',    label: `${t('timeMorning')} · ${t('timingAfter')}` },
    { key: 'afternoonBefore', label: `${t('timeAfternoon')} · ${t('timingBefore')}` },
    { key: 'afternoonAfter',  label: `${t('timeAfternoon')} · ${t('timingAfter')}` },
    { key: 'nightBefore',     label: `${t('timeNight')} · ${t('timingBefore')}` },
    { key: 'nightAfter',      label: `${t('timeNight')} · ${t('timingAfter')}` },
    { key: 'sos',             label: t('timeSOS') },
  ];

  return (
    <Modal isOpen={!!med} onClose={onClose} title={med?.name || ''} size="md">
      {med && (
        <div className="space-y-4">
          {med.dosage && (
            <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
              {med.name} {med.dosage}
            </p>
          )}

          <div className="space-y-2.5">
            {[
              { label: t('genericLabel'),      value: med.generic      },
              { label: t('dosageLabel'),       value: med.dosage       },
              { label: t('frequencyLabel'),    value: med.frequency    },
              { label: t('durationLabel'),     value: med.duration     },
              { label: t('instructionsLabel'), value: med.instructions },
              { label: t('prescribedBy'),      value: rx?.doctor?.name || (typeof rx?.doctor === 'string' ? rx?.doctor : null) },
              { label: 'Date',                 value: rx?.date         },
              { label: t('hospitalLabel'),     value: rx?.hospital?.name || (typeof rx?.hospital === 'string' ? rx?.hospital : null) },
              { label: t('conditionsLabel'),   value: (rx?.diseases || []).join(', ') || null },
            ].filter((r) => r.value).map(({ label, value }) => (
              <div key={label} className="flex gap-3 text-sm">
                <span className="text-gray-400 dark:text-gray-500 w-28 flex-shrink-0">{label}</span>
                <span className="text-gray-900 dark:text-white font-medium">{value}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('scheduleLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {SLOT_LABELS.filter(({ key }) => sched[key]).map(({ label }) => (
                <span key={label} className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full font-medium">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════

export default function HistoryMedications() {
  const { addToast } = useToast();
  const { t }        = useLanguage();

  const [allRx,       setAllRx]       = useState([]);
  const [doctorMedications, setDoctorMedications] = useState([]);
  const [activeRxIdx, setActiveRxIdx] = useState(0);
  const [selectedMed, setSelectedMed] = useState(null);
  const [pastOpen,    setPastOpen]    = useState(false);

  useEffect(() => {
    setAllRx(getPrescriptionHistoryLocal());
    getPatientActiveMedications()
      .then(setDoctorMedications)
      .catch(() => {
        addToast('Could not load doctor-issued medication updates', 'warning');
      });
  }, [addToast]);

  // Only show prescriptions that have at least one still-active medication
  const activePrescriptions = allRx.filter((rx) =>
    (rx.medications || []).some((m) => isMedActive(m, rx.savedAt))
  );
  const pastPrescriptions = allRx.filter((rx) =>
    !(rx.medications || []).some((m) => isMedActive(m, rx.savedAt))
  );

  // Clamp activeRxIdx if needed
  const clampedIdx  = Math.min(activeRxIdx, Math.max(0, activePrescriptions.length - 1));
  const activeRx    = activePrescriptions[clampedIdx] || null;
  const medications = (activeRx?.medications || []).filter((m) => isMedActive(m, activeRx?.savedAt));
  const hasDoctorMedications = doctorMedications.length > 0;

  const statusMeta = (status = 'active') => {
    const normalized = String(status || 'active').toLowerCase();
    if (normalized === 'paused') {
      return { Icon: PauseCircle, label: 'Paused', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
    }
    if (normalized === 'stopped') {
      return { Icon: StopCircle, label: 'Stopped', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' };
    }
    return { Icon: PlayCircle, label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
  };

  return (
    <div className="space-y-5">

      {hasDoctorMedications && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Doctor-issued active medication list</p>
            <p className="text-xs text-gray-400 mt-0.5">Pause, stop, and resume recommendations from your doctor appear here.</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {doctorMedications.map((med) => {
              const meta = statusMeta(med.status);
              const Icon = meta.Icon;
              return (
                <div key={med.item_id || med.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {med.brand_name || med.generic_name || 'Medication'}
                      </p>
                      {med.brand_name && med.generic_name && (
                        <span className="text-xs text-gray-400">({med.generic_name})</span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${meta.className}`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                        {med.status === 'paused' && med.pause_duration_days ? ` for ${med.pause_duration_days}d` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {[med.dosage, med.frequency, med.duration_days ? `${med.duration_days} days` : null].filter(Boolean).join(' · ')}
                    </p>
                    {med.instructions && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{med.instructions}</p>
                    )}
                    {med.modification_notes && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 rounded-xl px-3 py-2">
                        Doctor note: {med.modification_notes}
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 md:text-right">
                    {med.doctor_name ? `Dr. ${med.doctor_name}` : 'Doctor-issued'}
                    <br />
                    {med.issued_at ? new Date(med.issued_at).toLocaleDateString() : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active prescription selector */}
      {activePrescriptions.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {activePrescriptions.map((rx, i) => (
              <button
                key={i}
                onClick={() => setActiveRxIdx(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  clampedIdx === i
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400'
                }`}
              >
                {rx.doctor?.name ? `Dr. ${rx.doctor.name.split(' ').slice(-1)[0]}` : `Rx ${i + 1}`}
                <span className="ml-1.5 text-xs opacity-70">{String(rx.date || '').slice(0, 6)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {activePrescriptions.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-base font-medium">{allRx.length > 0 ? t('noMedicationsFound') : t('noPrescriptionsYet')}</p>
          <p className="text-sm mt-1">{allRx.length > 0 ? t('scanPrescriptionPrompt') : t('goScanPrescription')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">

          {/* Prescription context bar */}
          {activeRx && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
              {activeRx.doctor?.name && <span className="font-semibold text-gray-900 dark:text-white">{activeRx.doctor.name}</span>}
              {activeRx.hospital?.name && <><span>·</span><span>{activeRx.hospital.name}</span></>}
              {activeRx.date && <><span>·</span><span>{activeRx.date}</span></>}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm border-collapse">
              <thead>
                {/* Group row */}
                <tr className="bg-gray-50 dark:bg-gray-800/70">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700" rowSpan={2}>
                    {t('filterMedication')}
                  </th>
                  <th colSpan={2} className="text-center px-2 py-2.5 font-semibold text-gray-600 dark:text-gray-300 border-l border-b border-gray-200 dark:border-gray-700">
                    <span className="flex items-center justify-center gap-1"><Sunrise className="w-3.5 h-3.5" />{t('timeMorning')}</span>
                  </th>
                  <th colSpan={2} className="text-center px-2 py-2.5 font-semibold text-gray-600 dark:text-gray-300 border-l border-b border-gray-200 dark:border-gray-700">
                    <span className="flex items-center justify-center gap-1"><Sun className="w-3.5 h-3.5" />{t('timeAfternoon')}</span>
                  </th>
                  <th colSpan={2} className="text-center px-2 py-2.5 font-semibold text-gray-600 dark:text-gray-300 border-l border-b border-gray-200 dark:border-gray-700">
                    <span className="flex items-center justify-center gap-1"><Moon className="w-3.5 h-3.5" />{t('timeNight')}</span>
                  </th>
                  <th className="text-center px-2 py-2.5 font-semibold text-gray-600 dark:text-gray-300 border-l border-b border-gray-200 dark:border-gray-700" rowSpan={2}>
                    {t('timeSOS')}
                  </th>
                </tr>
                {/* Sub-header row */}
                <tr className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700">{t('timingBefore')}</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t('timingAfter')}</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700">{t('timingBefore')}</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t('timingAfter')}</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700">{t('timingBefore')}</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t('timingAfter')}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {medications.map((med, i) => {
                  const s = parseSchedule(med.frequency, med.instructions);
                  return (
                    <tr key={med.id || i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedMed(med)}
                          className="text-left w-full"
                        >
                          <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400 hover:underline">
                            {med.name}
                          </p>
                          {(med.generic || med.dosage) && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {[med.generic, med.dosage].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </button>
                      </td>
                      <td className="text-center px-4 py-3 border-l border-gray-100 dark:border-gray-800"><Tick active={s.morningBefore} /></td>
                      <td className="text-center px-4 py-3"><Tick active={s.morningAfter} /></td>
                      <td className="text-center px-4 py-3 border-l border-gray-100 dark:border-gray-800"><Tick active={s.afternoonBefore} /></td>
                      <td className="text-center px-4 py-3"><Tick active={s.afternoonAfter} /></td>
                      <td className="text-center px-4 py-3 border-l border-gray-100 dark:border-gray-800"><Tick active={s.nightBefore} /></td>
                      <td className="text-center px-4 py-3"><Tick active={s.nightAfter} /></td>
                      <td className="text-center px-4 py-3 border-l border-gray-100 dark:border-gray-800"><Tick active={s.sos} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            {t('timingNote')}
          </div>
        </div>
      )}

      {/* Past prescriptions */}
      {pastPrescriptions.length > 0 && (
        <div>
          <button
            onClick={() => setPastOpen((p) => !p)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {pastOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {t('pastPrescriptions')} ({pastPrescriptions.length})
          </button>
          {pastOpen && (
            <div className="mt-3 space-y-2">
              {pastPrescriptions.map((rx, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 opacity-60 text-sm">
                  <span className="font-medium text-gray-600 dark:text-gray-400">{rx.doctor?.name || 'Unknown Doctor'}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{rx.date || '—'}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{rx.medications?.length || 0} medications</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Medication detail modal — always mounted, controlled via isOpen */}
      <MedModal
        med={selectedMed}
        rx={activeRx}
        onClose={() => setSelectedMed(null)}
      />
    </div>
  );
}
