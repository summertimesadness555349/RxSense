import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Calendar, Phone, Activity, FileSpreadsheet, Sparkles, ShieldCheck, ShieldAlert, Plus, Trash2, PlusCircle, CheckCircle, FileText, Pause, Play, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getDoctorPatients, getDoctorPatientChart, searchDrugs, checkPrescriptionSafety, createPrescription, modifyPrescriptionItem } from '../services/api.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

export default function DoctorPatients() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  
  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [activeTab, setActiveTab] = useState('conditions');

  // Prescription builder state
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [drugSearch, setDrugSearch] = useState('');
  const [drugResults, setDrugResults] = useState([]);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('7');
  const [instructions, setInstructions] = useState('');
  
  const [safetyReport, setSafetyReport] = useState(null);
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [submittingRx, setSubmittingRx] = useState(false);
  const [medicationAction, setMedicationAction] = useState(null);
  const [medicationActionNotes, setMedicationActionNotes] = useState('');
  const [pauseDurationDays, setPauseDurationDays] = useState('3');
  const [updatingMedicationId, setUpdatingMedicationId] = useState(null);

  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      getDoctorPatients(user.id)
        .then((data) => {
          setPatients(data);
          setFilteredPatients(data);
        })
        .catch((err) => {
          addToast(err.message || 'Failed to load patients list', 'error');
        });
    }
  }, [user?.id]);

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      setFilteredPatients(patients);
    } else {
      setFilteredPatients(
        patients.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            (p.phone && p.phone.includes(term)) ||
            (p.email && p.email.toLowerCase().includes(term))
        )
      );
    }
  }, [searchTerm, patients]);

  const handleSelectPatient = async (patientId) => {
    setSelectedPatientId(patientId);
    setLoadingChart(true);
    setChartData(null);
    setPrescriptionItems([]);
    setSafetyReport(null);
    try {
      const data = await getDoctorPatientChart(patientId);
      console.log("frontend getDoctorPatientChart data:", data);
      setChartData(data);
    } catch (err) {
      addToast(err.message || 'Failed to load patient chart', 'error');
    } finally {
      setLoadingChart(false);
    }
  };

  // Debounced drug search
  const handleDrugSearchChange = (e) => {
    const val = e.target.value;
    setDrugSearch(val);
    setSelectedDrug(null);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!val.trim()) {
      setDrugResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchDrugs(val);
        setDrugResults(results);
      } catch (err) {
        console.error('Drug search error:', err);
      }
    }, 400);
  };

  const handleAddDrugItem = () => {
    if (!selectedDrug) {
      addToast('Please select a drug from the autocomplete suggestions', 'warning');
      return;
    }
    if (!dosage.trim() || !frequency.trim()) {
      addToast('Please fill in dosage and frequency', 'warning');
      return;
    }

    const proposedItem = {
      drug_id: selectedDrug.drug_id,
      name: selectedDrug.brand_name ? `${selectedDrug.brand_name} (${selectedDrug.generic_name})` : selectedDrug.generic_name,
      dosage,
      frequency,
      duration_days: parseInt(duration) || 7,
      instructions: instructions || 'Take as directed'
    };

    setPrescriptionItems((p) => [...p, proposedItem]);
    setSafetyReport(null); // Clear old safety report when prescription list changes

    // Reset drug fields
    setSelectedDrug(null);
    setDrugSearch('');
    setDrugResults([]);
    setDosage('');
    setFrequency('');
    setDuration('7');
    setInstructions('');
  };

  const handleRemoveDrugItem = (index) => {
    setPrescriptionItems((p) => p.filter((_, i) => i !== index));
    setSafetyReport(null);
  };

  const handleRunSafetyCheck = async () => {
    if (prescriptionItems.length === 0) {
      addToast('Add at least one medication to run safety checks', 'warning');
      return;
    }

    setCheckingSafety(true);
    setSafetyReport(null);
    try {
      const items = prescriptionItems.map((pi) => ({
        drug_id: pi.drug_id,
        dosage: pi.dosage,
        frequency: pi.frequency
      }));
      const report = await checkPrescriptionSafety(selectedPatientId, items);
      setSafetyReport(report);
      if (report.has_conflict) {
        addToast('AI flagged potential interaction warnings!', 'warning');
      } else {
        addToast('AI verification: Prescription is safe!', 'success');
      }
    } catch (err) {
      addToast(err.message || 'AI safety check request failed', 'error');
    } finally {
      setCheckingSafety(false);
    }
  };

  const handleSubmitPrescription = async () => {
    if (prescriptionItems.length === 0) {
      addToast('Add at least one medication to prescribe', 'warning');
      return;
    }

    setSubmittingRx(true);
    try {
      const items = prescriptionItems.map((pi) => ({
        drug_id: pi.drug_id,
        dosage: pi.dosage,
        frequency: pi.frequency,
        duration_days: pi.duration_days,
        instructions: pi.instructions
      }));
      await createPrescription(selectedPatientId, items);
      addToast('Prescription finalized and submitted successfully!', 'success');
      
      // Reload chart
      const data = await getDoctorPatientChart(selectedPatientId);
      setChartData(data);
      setPrescriptionItems([]);
      setSafetyReport(null);
    } catch (err) {
      addToast(err.message || 'Failed to submit prescription', 'error');
    } finally {
      setSubmittingRx(false);
    }
  };

  const activeMedications = (chartData?.chart?.activePrescriptions || []).flatMap((rx) =>
    (rx.items || []).map((item) => ({
      ...item,
      prescription_id: rx.prescription_id,
      doctor_name: rx.doctor_name,
      issued_at: rx.issued_at
    }))
  );

  const statusStyle = (status = 'active') => {
    const normalized = String(status || 'active').toLowerCase();
    if (normalized === 'paused') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    if (normalized === 'stopped') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  };

  const openMedicationAction = (item, status) => {
    setMedicationAction({ item, status });
    setMedicationActionNotes(item.modification_notes || '');
    setPauseDurationDays(item.pause_duration_days ? String(item.pause_duration_days) : '3');
  };

  const closeMedicationAction = () => {
    setMedicationAction(null);
    setMedicationActionNotes('');
    setPauseDurationDays('3');
  };

  const handleMedicationStatusChange = async (item, status, options = {}) => {
    setUpdatingMedicationId(item.item_id);
    try {
      await modifyPrescriptionItem(selectedPatientId, item.item_id, {
        status,
        pause_duration_days: status === 'paused' ? options.pauseDurationDays : null,
        modification_notes: options.notes || null
      });
      const data = await getDoctorPatientChart(selectedPatientId);
      setChartData(data);
      addToast(`Medication marked as ${status}`, 'success');
      closeMedicationAction();
    } catch (err) {
      addToast(err.message || 'Failed to update medication', 'error');
    } finally {
      setUpdatingMedicationId(null);
    }
  };

  const confirmMedicationAction = () => {
    if (!medicationAction) return;
    const durationDays = parseInt(pauseDurationDays, 10);
    if (medicationAction.status === 'paused' && (!durationDays || durationDays < 1)) {
      addToast('Pause duration must be at least 1 day', 'warning');
      return;
    }

    handleMedicationStatusChange(medicationAction.item, medicationAction.status, {
      pauseDurationDays: durationDays,
      notes: medicationActionNotes.trim()
    });
  };

  const calculateAge = (dobString) => {
    if (!dobString) return 'N/A';
    try {
      const dob = new Date(dobString);
      const diff = Date.now() - dob.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + ' yrs';
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[calc(100vh-8rem)]">
      {/* Left side: Patient selector list */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 flex flex-col h-[calc(100vh-10rem)] lg:h-[75vh] overflow-hidden">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">Patient Registry</h2>
        <div className="relative mb-3 flex-shrink-0">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
  type="text"
  className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-400"
  placeholder="Search patient name..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
/>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredPatients.length > 0 ? (
            filteredPatients.map((p) => (
              <button
                key={p.patient_id}
                onClick={() => handleSelectPatient(p.patient_id)}
                className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-colors ${
                  selectedPatientId === p.patient_id
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-700 dark:text-gray-300 border border-transparent'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {p.gender} · {calculateAge(p.date_of_birth)}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-xs text-gray-400 text-center py-6">No matching patients found.</p>
          )}
        </div>
      </div>

      {/* Right side: Detail Patient Chart + Prescription Builder */}
      <div className="flex-1 min-w-0 flex flex-col gap-5 h-[calc(100vh-10rem)] lg:h-[75vh] overflow-y-auto">
        {!selectedPatientId ? (
          <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
            <span className="text-5xl mb-4 animate-bounce-slow">🧑‍⚕️</span>
            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg">No Patient Selected</h3>
            <p className="text-gray-400 text-sm mt-1 max-w-sm">
              Please select a patient from the registry on the left to review their chart details and draft prescriptions.
            </p>
          </div>
        ) : loadingChart ? (
          <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <span className="text-4xl animate-spin">⚕️</span>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Retrieving Medical Record...</p>
          </div>
        ) : (
          chartData && (
            <div className="space-y-6">
              {/* Patient Basic Demographics Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{chartData.patient?.name}</h2>
                    <p className="text-xs text-gray-400">
                      {chartData.patient?.gender} · {calculateAge(chartData.patient?.date_of_birth)} ({chartData.patient?.date_of_birth ? new Date(chartData.patient.date_of_birth).toLocaleDateString() : 'N/A'})
                    </p>
                  </div>
                </div>

                <div className="flex gap-6 text-sm">
                  {chartData.patient?.phone && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      <span>{chartData.patient.phone}</span>
                    </div>
                  )}
                  {chartData.patient?.height && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Height</p>
                      <p className="font-bold text-gray-800 dark:text-gray-200">{chartData.patient.height} cm</p>
                    </div>
                  )}
                  {chartData.patient?.weight && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Weight</p>
                      <p className="font-bold text-gray-800 dark:text-gray-200">{chartData.patient.weight} kg</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Patient Chart Tabs */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
                <div className="flex border-b border-gray-100 dark:border-gray-800 pb-2 mb-4 overflow-x-auto gap-2">
                  {[
                    { id: 'conditions', label: 'Conditions', count: chartData.chart?.conditions?.length },
                    { id: 'allergies', label: 'Allergies', count: chartData.chart?.allergies?.length },
                    { id: 'medications', label: 'Active Medications', count: activeMedications.length },
                    { id: 'prescriptions', label: 'Active Prescriptions', count: chartData.chart?.activePrescriptions?.length },
                    { id: 'surgeries', label: 'Surgeries', count: chartData.chart?.surgeries?.length },
                    { id: 'vaccinations', label: 'Vaccinations', count: chartData.chart?.vaccinations?.length },
                    { id: 'reports', label: 'Lab Reports', count: chartData.chart?.reports?.length }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        activeTab === tab.id
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {tab.label}
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-850 text-gray-600 dark:text-gray-400'}`}>
                        {tab.count || 0}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="min-h-[150px]">
                  {activeTab === 'conditions' && (
                    <div className="space-y-3">
                      {chartData.chart?.conditions?.length > 0 ? (
                        chartData.chart.conditions.map((c) => (
                          <div key={c.condition_id} className="p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{c.condition_name}</h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold capitalize">{c.status}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Diagnosed on: {c.diagnosed_at ? new Date(c.diagnosed_at).toLocaleDateString() : 'N/A'} · Severity: <span className="font-semibold text-amber-500">{c.severity || 'N/A'}</span></p>
                            {c.notes && <p className="text-xs text-gray-500 mt-1 italic">Notes: {c.notes}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">No conditions on record.</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'allergies' && (
                    <div className="space-y-3">
                      {chartData.chart?.allergies?.length > 0 ? (
                        chartData.chart.allergies.map((a) => (
                          <div key={a.allergy_id} className="p-3 bg-rose-500/5 rounded-2xl border border-rose-200/20 flex justify-between items-center">
                            <div>
                              <h4 className="font-bold text-sm text-rose-600 dark:text-rose-400">{a.brand_name || a.generic_name}</h4>
                              <p className="text-xs text-gray-400 mt-0.5">Reaction: {a.reaction_type || 'Unknown'} · Severity: <span className="font-semibold">{a.severity}</span></p>
                            </div>
                            {a.confirmed_at && (
                              <span className="text-[10px] text-gray-400">Confirmed: {new Date(a.confirmed_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">No drug allergies on record.</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'medications' && (
                    <div className="space-y-3">
                      {activeMedications.length > 0 ? (
                        activeMedications.map((item) => {
                          const medStatus = item.status || 'active';
                          const isUpdating = updatingMedicationId === item.item_id;
                          return (
                            <motion.div
                              key={item.item_id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800"
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                                      {item.brand_name || item.generic_name || 'Medication'}
                                    </h4>
                                    {item.generic_name && item.brand_name && (
                                      <span className="text-xs text-gray-400">({item.generic_name})</span>
                                    )}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize ${statusStyle(medStatus)}`}>
                                      {medStatus}
                                      {medStatus === 'paused' && item.pause_duration_days ? ` - ${item.pause_duration_days}d` : ''}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {[item.dosage, item.frequency, item.duration_days ? `${item.duration_days} days` : null].filter(Boolean).join(' · ')}
                                  </p>
                                  {item.instructions && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Instructions: {item.instructions}</p>
                                  )}
                                  <p className="text-[11px] text-gray-400 mt-2">
                                    Dr. {item.doctor_name || 'System'} · {item.issued_at ? new Date(item.issued_at).toLocaleDateString() : 'No issue date'}
                                  </p>
                                  {item.modification_notes && (
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 rounded-xl px-3 py-2">
                                      Note: {item.modification_notes}
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                  {medStatus !== 'active' && (
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => handleMedicationStatusChange(item, 'active')}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold disabled:opacity-60"
                                    >
                                      <Play className="w-3.5 h-3.5" /> Resume
                                    </button>
                                  )}
                                  {medStatus !== 'paused' && (
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => openMedicationAction(item, 'paused')}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold disabled:opacity-60"
                                    >
                                      <Pause className="w-3.5 h-3.5" /> Pause
                                    </button>
                                  )}
                                  {medStatus !== 'stopped' && (
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => openMedicationAction(item, 'stopped')}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-semibold disabled:opacity-60"
                                    >
                                      <XCircle className="w-3.5 h-3.5" /> Stop
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">No active medications found.</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'prescriptions' && (
                    <div className="space-y-4">
                      {chartData.chart?.activePrescriptions?.length > 0 ? (
                        chartData.chart.activePrescriptions.map((rx) => (
                          <div key={rx.prescription_id} className="p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800">
                            <div className="flex justify-between items-start border-b border-gray-150 dark:border-gray-800 pb-2 mb-2">
                              <div>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Prescribed by Dr. {rx.doctor_name || 'System'}</p>
                                <p className="text-[10px] text-gray-400">Issued: {new Date(rx.issued_at).toLocaleDateString()}</p>
                              </div>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full capitalize">{rx.status}</span>
                            </div>
                            <div className="space-y-1">
                              {rx.items?.map((item) => (
                                <div key={item.item_id} className="text-xs flex items-center justify-between text-gray-600 dark:text-gray-400">
                                  <span className="font-semibold text-gray-800 dark:text-gray-200">{item.brand_name || item.generic_name} {item.dosage}</span>
                                  <span>{item.frequency} · {item.duration_days} days</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">No active prescriptions.</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'surgeries' && (
                    <div className="space-y-3">
                      {chartData.chart?.surgeries?.length > 0 ? (
                        chartData.chart.surgeries.map((s) => (
                          <div key={s.surgery_id} className="p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800">
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{s.procedure_name}</h4>
                            <p className="text-xs text-gray-400 mt-1">Performed on: {s.performed_at ? new Date(s.performed_at).toLocaleDateString() : 'N/A'} · Outcome: <span className="font-semibold text-emerald-500">{s.outcome || 'N/A'}</span></p>
                            {s.notes && <p className="text-xs text-gray-500 mt-1 italic">Notes: {s.notes}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">No surgical history on record.</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'vaccinations' && (
                    <div className="space-y-3">
                      {chartData.chart?.vaccinations?.length > 0 ? (
                        chartData.chart.vaccinations.map((v) => (
                          <div key={v.vaccination_id} className="p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800">
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{v.vaccine_name}</h4>
                            <p className="text-xs text-gray-400 mt-1">Administered: {new Date(v.administered_at).toLocaleDateString()} · Dose: {v.dose_number}/{v.total_doses || 1}</p>
                            {v.next_due_date && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">Next due: {new Date(v.next_due_date).toLocaleDateString()}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">No vaccinations on record.</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'reports' && (
                    <div className="space-y-3">
                      {chartData.chart?.reports?.length > 0 ? (
                        chartData.chart.reports.map((r) => (
                          <div key={r.report_id} className="p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 flex justify-between items-center">
                            <div>
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-emerald-500" />
                                {r.report_type} Report
                              </h4>
                              <p className="text-xs text-gray-400 mt-0.5">Uploaded: {new Date(r.uploaded_at).toLocaleDateString()}</p>
                            </div>
                            {(r.image_url || r.storage_path) && (
                              <a
                                href={r.image_url || r.storage_path}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                              >
                                View File
                              </a>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">No lab reports uploaded.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Prescription Builder Area */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-6">
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  Prescription Writer
                </h2>

                <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-gray-500">Add Medication</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Autocomplete Drug Search */}
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Search Drug (Generic/Brand)</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
  type="text"
  className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 text-black dark:text-white text-sm focus:outline-none focus:border-emerald-500 placeholder:text-gray-400 dark:placeholder:text-white/50"
  placeholder="Type drug name (e.g. Paracetamol, Napa...)"
  value={drugSearch}
  onChange={handleDrugSearchChange}
/>
                      </div>

                      {drugResults.length > 0 && (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl">
                          {drugResults.map((drug) => (
                            <button
                              key={drug.drug_id}
                              type="button"
                              onClick={() => {
                                setSelectedDrug(drug);
                                setDrugSearch(drug.brand_name ? `${drug.brand_name} (${drug.generic_name})` : drug.generic_name);
                                setDrugResults([]);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs flex justify-between"
                            >
                              <div>
                                <span className="font-bold text-gray-800 dark:text-gray-200">{drug.brand_name || 'N/A'}</span>
                                <span className="text-gray-400 ml-2">({drug.generic_name})</span>
                              </div>
                              <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] px-2 py-0.5 rounded">
                                {drug.drug_class || 'General'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <Input
                      label="Dosage"
                      id="dosageInput"
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      placeholder="e.g. 500mg, 1 tablet"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Frequency"
                      id="freqInput"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      placeholder="e.g. 3 times daily, once daily"
                    />
                    <Input
                      label="Duration (Days)"
                      id="durInput"
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="7"
                    />
                    <Input
                      label="Special Instructions"
                      id="instInput"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g. after food, before sleep"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleAddDrugItem}
                      className="flex items-center gap-1 text-emerald-600"
                    >
                      <PlusCircle className="w-4 h-4" /> Add Medication
                    </Button>
                  </div>
                </div>

                {/* Proposed items list */}
                {prescriptionItems.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-gray-500">Draft Prescription Items</h3>
                    <div className="overflow-x-auto border border-gray-100 dark:border-gray-850 rounded-2xl">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-950 text-xs text-gray-400 uppercase">
                          <tr>
                            <th className="px-4 py-2">Drug Name</th>
                            <th className="px-4 py-2">Dosage</th>
                            <th className="px-4 py-2">Frequency</th>
                            <th className="px-4 py-2">Duration</th>
                            <th className="px-4 py-2">Instructions</th>
                            <th className="px-4 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
                          {prescriptionItems.map((item, index) => (
                            <tr key={index} className="text-xs text-gray-700 dark:text-gray-300">
                              <td className="px-4 py-2.5 font-semibold">{item.name}</td>
                              <td className="px-4 py-2.5">{item.dosage}</td>
                              <td className="px-4 py-2.5">{item.frequency}</td>
                              <td className="px-4 py-2.5">{item.duration_days} days</td>
                              <td className="px-4 py-2.5">{item.instructions}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDrugItem(index)}
                                  className="text-red-500 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* AI Safety Checker Box */}
                    <div className="flex flex-col md:flex-row gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRunSafetyCheck}
                        loading={checkingSafety}
                        className="flex-1 flex items-center justify-center gap-2 border border-purple-500/20 hover:bg-purple-500/5 text-purple-600 dark:text-purple-400 font-semibold"
                      >
                        <Sparkles className="w-4 h-4" /> Run AI Safety Check
                      </Button>
                      
                      <Button
                        type="button"
                        onClick={handleSubmitPrescription}
                        loading={submittingRx}
                        className="flex-1 flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Finalize & Submit
                      </Button>
                    </div>

                    {/* Safety checker response */}
                    {safetyReport && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-3 ${
                          safetyReport.has_conflict
                            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                            : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/60'
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {safetyReport.has_conflict ? (
                            <ShieldAlert className="w-6 h-6 text-rose-500" />
                          ) : (
                            <ShieldCheck className="w-6 h-6 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex-1 space-y-2 text-xs">
                          <p className="font-bold text-sm">
                            {safetyReport.has_conflict
                              ? 'Safety Conflict Flagged'
                              : 'Prescription Verified Safe'}
                          </p>
                          {safetyReport.warnings && safetyReport.warnings.length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1 text-gray-700 dark:text-gray-300">
                              {safetyReport.warnings.map((w, idx) => (
                                <li key={idx}>
                                  <strong>{w.severity?.toUpperCase() || 'WARNING'}:</strong> {w.description}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-600 dark:text-gray-400">
                              No drug interactions or allergy conflicts detected between the proposed items and the patient's record.
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <AnimatePresence>
        {medicationAction && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-xl"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-xl p-2 ${medicationAction.status === 'paused' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30'}`}>
                  {medicationAction.status === 'paused' ? <Pause className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {medicationAction.status === 'paused' ? 'Pause medication' : 'Stop medication'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {medicationAction.item.brand_name || medicationAction.item.generic_name || 'Medication'}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {medicationAction.status === 'paused' && (
                  <Input
                    label="Pause duration (days)"
                    id="pauseDurationDays"
                    type="number"
                    min="1"
                    value={pauseDurationDays}
                    onChange={(e) => setPauseDurationDays(e.target.value)}
                  />
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes for patient</label>
                  <textarea
                    value={medicationActionNotes}
                    onChange={(e) => setMedicationActionNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Reason or follow-up instruction"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeMedicationAction}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={confirmMedicationAction}
                  loading={updatingMedicationId === medicationAction.item.item_id}
                  className={medicationAction.status === 'stopped' ? 'bg-rose-600 hover:bg-rose-700' : ''}
                >
                  Confirm
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
