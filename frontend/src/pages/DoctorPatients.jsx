import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  User,
  Phone,
  Activity,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  PlusCircle,
  CheckCircle,
  FileText,
  Pause,
  Play,
  XCircle,
  AlertCircle,
  Check,
  History,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import {
  getDoctorPatients,
  getDoctorPatientChart,
  generateDoctorAiSummary,
  searchDrugs,
  checkPrescriptionSafety,
  createPrescription,
  modifyPrescriptionItem,
  addPatientAllergy,
  addPatientVaccination,
  addPatientSurgery,
  getPausedMedication,
  markAppointmentLate,
  markAppointmentArrived,
  startAppointment,
  completeAppointment,
} from "../services/api.js";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import { useNavigate } from "react-router-dom";

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const formatChartDate = (value) => {
  if (!value) return "N/A";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
};

const calculateBMI = (heightCm, weightKg) => {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return bmi.toFixed(1);
};

const bmiCategory = (bmi) => {
  if (!bmi) return null;
  const val = parseFloat(bmi);
  if (val < 18.5) return "Underweight";
  if (val < 25) return "Normal";
  if (val < 30) return "Overweight";
  return "Obese";
};

const medicineLabel = (item) =>
  item?.brand_name || item?.generic_name || item?.name || "Medication";

const scannedRxDateValue = (item) =>
  item?.rx_date ||
  item?.rxDate ||
  item?.prescription_date ||
  item?.date ||
  item?.effective_rx_date ||
  null;

const scannedRxDateLabel = (item) => {
  if (item?.rx_date) return String(item.rx_date);
  const value = scannedRxDateValue(item);
  if (!value) return "Not recorded";
  if (item?.rx_date_was_missing) return formatChartDate(value);
  return String(value);
};

const joinLines = (rows, fallback) => {
  const cleanRows = rows.filter(Boolean);
  return cleanRows.length > 0 ? cleanRows.join("\n") : fallback;
};

const getPrescriptionMedicationItems = (data) =>
  (data?.chart?.activePrescriptions || []).flatMap((rx) =>
    (rx.items || []).map((item) => ({
      ...item,
      prescription_id: rx.prescription_id,
      doctor_name: rx.doctor_name,
      issued_at: rx.issued_at,
      rx_date: scannedRxDateValue(item) || rx.rx_date,
      effective_rx_date: item.effective_rx_date || rx.effective_rx_date,
      rx_date_was_missing: item.rx_date_was_missing ?? rx.rx_date_was_missing,
    }))
  );

const createEmptyPrescriptionDraft = () => ({
  referredBy: "",
  chiefComplaint: "",
  examination: "",
  diagnosis: "",
  allergies: "No known drug allergies recorded.",
  currentMedications: "No current medicines recorded as still taken.",
  advice: "",
  followUp: "",
});

const createPrescriptionDraftFromChart = (data) => {
  const patient = data?.patient || {};
  const chart = data?.chart || {};
  const activeMedicines = getPrescriptionMedicationItems(data).filter(
    (item) => {
      const status = String(item.status || "active").toLowerCase();
      return status === "active";
    }
  );

  const bp =
    patient.bloodPressureSystolic && patient.bloodPressureDiastolic
      ? `BP: ${patient.bloodPressureSystolic}/${patient.bloodPressureDiastolic} mm Hg`
      : null;

  return {
    ...createEmptyPrescriptionDraft(),
    examination: joinLines(
      [
        bp,
        patient.height ? `Height: ${patient.height} cm` : null,
        patient.weight ? `Weight: ${patient.weight} kg` : null,
        patient.height && patient.weight
          ? `BMI: ${calculateBMI(
              patient.height,
              patient.weight
            )} (${bmiCategory(calculateBMI(patient.height, patient.weight))})`
          : null,
        patient.bloodGroup ? `Blood group: ${patient.bloodGroup}` : null,
      ],
      ""
    ),
    diagnosis: joinLines(
      (chart.conditions || []).map((condition) =>
        [
          condition.condition_name,
          condition.severity ? `Severity: ${condition.severity}` : null,
          condition.status ? `Status: ${condition.status}` : null,
        ]
          .filter(Boolean)
          .join(" - ")
      ),
      ""
    ),
    allergies: joinLines(
      (chart.allergies || []).map((allergy) =>
        [
          allergy.brand_name ||
            allergy.generic_name ||
            allergy.drug_class ||
            "Allergy",
          allergy.reaction_type ? `Reaction: ${allergy.reaction_type}` : null,
          allergy.severity ? `Severity: ${allergy.severity}` : null,
        ]
          .filter(Boolean)
          .join(" - ")
      ),
      "No known drug allergies recorded."
    ),
    currentMedications: joinLines(
      activeMedicines.map((item) =>
        [
          medicineLabel(item),
          item.dosage,
          item.frequency,
          item.duration_days ? `${item.duration_days} days` : null,
        ]
          .filter(Boolean)
          .join(" - ")
      ),
      "No current medicines recorded as still taken."
    ),
  };
};
function PrescriptionTextarea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder = "",
  tone = "default",
  readOnly = false,
}) {
  const toneClass =
    tone === "warning"
      ? "border-rose-200 bg-rose-50/40 focus:border-rose-400"
      : "border-gray-200 bg-white focus:border-emerald-500";

  const readOnlyClass = readOnly
    ? "cursor-not-allowed bg-gray-50 text-gray-600"
    : "";

  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-gray-600 mb-1.5">
        {label}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed text-gray-950 placeholder:text-gray-400 focus:outline-none ${toneClass} ${readOnlyClass}`}
      />
    </label>
  );
}

function PrescriptionMetaField({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-gray-950">{children}</div>
    </div>
  );
}

export default function DoctorPatients() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState(todayInputValue());

  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [activeTab, setActiveTab] = useState("conditions");

  // Paused Medications Database retrieval states
  const [pausedMedicationsHistory, setPausedMedicationsHistory] = useState([]);
  const [loadingPausedHistory, setLoadingPausedHistory] = useState(false);
  const [showPausedHistory, setShowPausedHistory] = useState(false);

  // Prescription builder state
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [drugSearch, setDrugSearch] = useState("");
  const [drugResults, setDrugResults] = useState([]);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [instructions, setInstructions] = useState("");
  const [visitDate, setVisitDate] = useState(todayInputValue());
  const [prescriptionDraft, setPrescriptionDraft] = useState(
    createEmptyPrescriptionDraft
  );

  const [safetyReport, setSafetyReport] = useState(null);
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [submittingRx, setSubmittingRx] = useState(false);
  const [medicationAction, setMedicationAction] = useState(null);
  const [medicationActionNotes, setMedicationActionNotes] = useState("");
  const [pauseDurationDays, setPauseDurationDays] = useState("3");
  const [updatingMedicationId, setUpdatingMedicationId] = useState(null);

  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  // AI Summary state
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  // New forms show/hide toggles
  const [showAddAllergyForm, setShowAddAllergyForm] = useState(false);
  const [showAddVaccinationForm, setShowAddVaccinationForm] = useState(false);
  const [showAddSurgeryForm, setShowAddSurgeryForm] = useState(false);

  // Allergy Form state
  const [allergyDrugSearch, setAllergyDrugSearch] = useState("");
  const [allergyDrugResults, setAllergyDrugResults] = useState([]);
  const [selectedAllergyDrug, setSelectedAllergyDrug] = useState(null);
  const [reactionType, setReactionType] = useState("");
  const [allergySeverity, setAllergySeverity] = useState("moderate");
  const [allergyConfirmedAt, setAllergyConfirmedAt] = useState(
    todayInputValue()
  );
  const [submittingAllergy, setSubmittingAllergy] = useState(false);

  // Vaccination Form state
  const [vaccineName, setVaccineName] = useState("");
  const [vaccineCvxCode, setVaccineCvxCode] = useState("");
  const [vaccineDoseNumber, setVaccineDoseNumber] = useState("");
  const [vaccineTotalDoses, setVaccineTotalDoses] = useState("");
  const [vaccineAdministeredAt, setVaccineAdministeredAt] = useState(
    todayInputValue()
  );
  const [vaccineBatchNumber, setVaccineBatchNumber] = useState("");
  const [vaccineSite, setVaccineSite] = useState("");
  const [vaccineNextDueDate, setVaccineNextDueDate] = useState("");
  const [vaccineNotes, setVaccineNotes] = useState("");
  const [submittingVaccination, setSubmittingVaccination] = useState(false);

  // Surgery Form state
  const [surgeryProcedureName, setSurgeryProcedureName] = useState("");
  const [surgeryIcd10Pcs, setSurgeryIcd10Pcs] = useState("");
  const [surgeryPerformedAt, setSurgeryPerformedAt] = useState(
    todayInputValue()
  );
  const [surgeryOutcome, setSurgeryOutcome] = useState("successful");
  const [surgeryComplications, setSurgeryComplications] = useState("");
  const [surgeryAnaesthesiaType, setSurgeryAnaesthesiaType] = useState("");
  const [surgeryNotes, setSurgeryNotes] = useState("");
  const [submittingSurgery, setSubmittingSurgery] = useState(false);

  const searchDebounceRef = useRef(null);

  const loadPatients = async () => {
    if (!user?.id) return;
    try {
      const data = await getDoctorPatients(user.id, appointmentDate);
      setPatients(data);
      setFilteredPatients(data);
      if (selectedPatientId) {
        const refreshed =
          data.find((p) => p.patient_id === selectedPatientId) || null;
        setSelectedPatient(refreshed);
      }
    } catch (err) {
      addToast(err.message || "Failed to load patients list", "error");
    }
  };

  useEffect(() => {
    loadPatients();
  }, [user?.id, appointmentDate]);

  useEffect(() => {
    if (chartData) {
      setPrescriptionDraft(createPrescriptionDraftFromChart(chartData));
    }
  }, [chartData]);

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

  const handleSelectPatient = async (patient) => {
    setSelectedPatientId(patient.patient_id);
    setSelectedPatient(patient);
    setLoadingChart(true);
    setChartData(null);
    setPrescriptionItems([]);
    setSafetyReport(null);
    setVisitDate(todayInputValue());
    setPrescriptionDraft(createEmptyPrescriptionDraft());
    setShowPausedHistory(false);
    setPausedMedicationsHistory([]);
    try {
      const data = await getDoctorPatientChart(patient.patient_id);
      console.log("frontend getDoctorPatientChart data:", data);
      setChartData(data);
      setPrescriptionDraft(createPrescriptionDraftFromChart(data));
    } catch (err) {
      addToast(err.message || "Failed to load patient chart", "error");
    } finally {
      setLoadingChart(false);
    }
  };

  const handleGenerateAiSummary = async () => {
    if (!selectedPatientId) return;
    setLoadingAiSummary(true);
    setAiSummary(null);
    setShowAiSummary(true);
    try {
      const data = await generateDoctorAiSummary(selectedPatientId);
      setAiSummary(data.summary);
    } catch (err) {
      addToast(err.message || "Failed to generate AI summary", "error");
      setShowAiSummary(false);
    } finally {
      setLoadingAiSummary(false);
    }
  };

  // Triggers API database lookup for historically paused or stopped items
  const fetchPausedMedicationsHistory = async () => {
    if (!selectedPatientId) return;
    setLoadingPausedHistory(true);
    try {
      const historyData = await getPausedMedication(selectedPatientId);
      setPausedMedicationsHistory(historyData || []);
      // console.log("Paused/Stopped medication history data:", historyData);
    } catch (err) {
      addToast(
        err.message || "Failed to load historical database entries",
        "error"
      );
    } finally {
      setLoadingPausedHistory(false);
    }
  };

  const togglePausedHistoryPanel = () => {
    const nextState = !showPausedHistory;
    setShowPausedHistory(nextState);
    if (nextState) {
      fetchPausedMedicationsHistory();
    }
  };

  // Allergy Drug Search Autocomplete handler
  const handleAllergyDrugSearchChange = (e) => {
    const val = e.target.value;
    setAllergyDrugSearch(val);
    setSelectedAllergyDrug(null);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!val.trim()) {
      setAllergyDrugResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchDrugs(val);
        setAllergyDrugResults(results);
      } catch (err) {
        console.error("Allergy drug search error:", err);
      }
    }, 400);
  };

  const handleAddAllergy = async (e) => {
    e.preventDefault();
    if (!selectedAllergyDrug) {
      addToast("Please search and select a drug allergen", "warning");
      return;
    }
    if (!reactionType.trim()) {
      addToast("Reaction type is required", "warning");
      return;
    }

    setSubmittingAllergy(true);
    try {
      const payload = {
        drugId: selectedAllergyDrug.drug_id,
        reactionType: reactionType.trim(),
        severity: allergySeverity,
        confirmedAt: allergyConfirmedAt || null,
      };
      await addPatientAllergy(selectedPatientId, payload);
      addToast("Allergy added successfully!", "success");

      // Reset form
      setAllergyDrugSearch("");
      setAllergyDrugResults([]);
      setSelectedAllergyDrug(null);
      setReactionType("");
      setAllergySeverity("moderate");
      setAllergyConfirmedAt(todayInputValue());
      setShowAddAllergyForm(false);

      // Refresh chart
      const refreshedData = await getDoctorPatientChart(selectedPatientId);
      setChartData(refreshedData);
    } catch (err) {
      addToast(err.message || "Failed to add allergy", "error");
    } finally {
      setSubmittingAllergy(false);
    }
  };

  const handleAddVaccination = async (e) => {
    e.preventDefault();
    if (!vaccineName.trim()) {
      addToast("Vaccine name is required", "warning");
      return;
    }

    setSubmittingVaccination(true);
    try {
      const payload = {
        vaccineName: vaccineName.trim(),
        cvxCode: vaccineCvxCode.trim() || null,
        doseNumber: vaccineDoseNumber ? parseInt(vaccineDoseNumber, 10) : null,
        totalDoses: vaccineTotalDoses ? parseInt(vaccineTotalDoses, 10) : null,
        administeredAt: vaccineAdministeredAt || null,
        batchNumber: vaccineBatchNumber.trim() || null,
        site: vaccineSite.trim() || null,
        nextDueDate: vaccineNextDueDate || null,
        notes: vaccineNotes.trim() || null,
      };
      await addPatientVaccination(selectedPatientId, payload);
      addToast("Vaccination recorded successfully!", "success");

      // Reset form
      setVaccineName("");
      setVaccineCvxCode("");
      setVaccineDoseNumber("");
      setVaccineTotalDoses("");
      setVaccineAdministeredAt(todayInputValue());
      setVaccineBatchNumber("");
      setVaccineSite("");
      setVaccineNextDueDate("");
      setVaccineNotes("");
      setShowAddVaccinationForm(false);

      // Refresh chart
      const refreshedData = await getDoctorPatientChart(selectedPatientId);
      setChartData(refreshedData);
    } catch (err) {
      addToast(err.message || "Failed to record vaccination", "error");
    } finally {
      setSubmittingVaccination(false);
    }
  };

  const handleAddSurgery = async (e) => {
    e.preventDefault();
    if (!surgeryProcedureName.trim()) {
      addToast("Procedure name is required", "warning");
      return;
    }

    setSubmittingSurgery(true);
    try {
      const payload = {
        procedureName: surgeryProcedureName.trim(),
        icd10Pcs: surgeryIcd10Pcs.trim() || null,
        performedAt: surgeryPerformedAt || null,
        outcome: surgeryOutcome || null,
        complications: surgeryComplications.trim() || null,
        anaesthesiaType: surgeryAnaesthesiaType.trim() || null,
        notes: surgeryNotes.trim() || null,
      };
      await addPatientSurgery(selectedPatientId, payload);
      addToast("Surgical history recorded successfully!", "success");

      // Reset form
      setSurgeryProcedureName("");
      setSurgeryIcd10Pcs("");
      setSurgeryPerformedAt(todayInputValue());
      setSurgeryOutcome("successful");
      setSurgeryComplications("");
      setSurgeryAnaesthesiaType("");
      setSurgeryNotes("");
      setShowAddSurgeryForm(false);

      // Refresh chart
      const refreshedData = await getDoctorPatientChart(selectedPatientId);
      setChartData(refreshedData);
    } catch (err) {
      addToast(err.message || "Failed to record surgical history", "error");
    } finally {
      setSubmittingSurgery(false);
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
        console.error("Drug search error:", err);
      }
    }, 400);
  };

  const handleAddDrugItem = () => {
    if (!selectedDrug) {
      addToast(
        "Please select a drug from the autocomplete suggestions",
        "warning"
      );
      return;
    }
    if (!dosage.trim() || !frequency.trim()) {
      addToast("Please fill in dosage and frequency", "warning");
      return;
    }

    const proposedItem = {
      drug_id: selectedDrug.drug_id,
      name: selectedDrug.brand_name
        ? `${selectedDrug.brand_name} (${selectedDrug.generic_name})`
        : selectedDrug.generic_name,
      dosage,
      frequency,
      duration_days: parseInt(duration) || 7,
      instructions: instructions || "Take as directed",
    };

    setPrescriptionItems((p) => [proposedItem, ...p]);
    setSafetyReport(null); // Clear old safety report when prescription list changes

    // Reset drug fields
    setSelectedDrug(null);
    setDrugSearch("");
    setDrugResults([]);
    setDosage("");
    setFrequency("");
    setDuration("");
    setInstructions("");
  };

  const handleRemoveDrugItem = (index) => {
    setPrescriptionItems((p) => p.filter((_, i) => i !== index));
    setSafetyReport(null);
  };

  const handleRemoveHistoricalPausedItem = (itemId) => {
    setPausedMedicationsHistory((prev) =>
      prev.filter((med) => med.item_id !== itemId)
    );
  };

  const handleUpdateDrugItem = (index, field, value) => {
    setPrescriptionItems((items) =>
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
    setSafetyReport(null);
  };

  const updatePrescriptionDraft = (field, value) => {
    setPrescriptionDraft((draft) => ({ ...draft, [field]: value }));
  };

  const handleRunSafetyCheck = async () => {
    if (prescriptionItems.length === 0) {
      addToast("Add at least one medication to run safety checks", "warning");
      return;
    }

    setCheckingSafety(true);
    setSafetyReport(null);
    try {
      const items = prescriptionItems.map((pi) => ({
        drug_id: pi.drug_id,
        dosage: pi.dosage,
        frequency: pi.frequency,
      }));
      const report = await checkPrescriptionSafety(selectedPatientId, items);
      setSafetyReport(report);
      if (report.has_conflict) {
        addToast("AI flagged potential interaction warnings!", "warning");
      } else {
        addToast("AI verification: Prescription is safe!", "success");
      }
    } catch (err) {
      addToast(err.message || "AI safety check request failed", "error");
    } finally {
      setCheckingSafety(false);
    }
  };

  const handleSubmitPrescription = async () => {
    if (prescriptionItems.length === 0) {
      addToast("Add at least one medication to prescribe", "warning");
      return;
    }

    if (submittingRx || checkingSafety) {
      addToast("Please wait for the current operation to complete", "warning");
      return;
    }

    setCheckingSafety(true);
    let safetyResult = null;
    try {
      const items = prescriptionItems.map((pi) => ({
        drug_id: pi.drug_id,
        dosage: pi.dosage,
        frequency: pi.frequency,
      }));
      safetyResult = await checkPrescriptionSafety(selectedPatientId, items);
      setSafetyReport(safetyResult);
    } catch (err) {
      addToast(err.message || "AI safety check request failed", "error");
    } finally {
      setCheckingSafety(false);
    }

    if (safetyResult && safetyResult.has_conflict) {
      let warningMessage =
        "The system has detected potential safety issues with this prescription:\n\n";
      if (safetyResult.warnings && safetyResult.warnings.length > 0) {
        warningMessage += safetyResult.warnings
          .map(
            (w, idx) =>
              `${idx + 1}. ${w.severity?.toUpperCase() || "WARNING"}: ${
                w.description
              }`
          )
          .join("\n");
      } else {
        warningMessage +=
          "Potential drug interactions or allergy conflicts detected.";
      }
      warningMessage +=
        "\n\nAre you sure you want to continue and submit this prescription?";
      setConfirmMessage(warningMessage);
      setShowConfirm(true);
      return;
    }

    handleConfirmSubmit();
  };

  const activeMedications = getPrescriptionMedicationItems(chartData).filter(
    (item) => String(item.status || "active").toLowerCase() === "active"
  );

  const statusStyle = (status = "active") => {
    const normalized = String(status || "active").toLowerCase();
    if (normalized === "paused")
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    if (normalized === "stopped")
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  };

  const openMedicationAction = (item, status) => {
    const isScannedMedication = item.source === "prescription_scan";

    setMedicationAction({ item, status });
    setMedicationActionNotes(item.modification_notes || "");
    setPauseDurationDays(
      isScannedMedication && status === "stopped"
        ? "0"
        : item.pause_duration_days
        ? String(item.pause_duration_days)
        : "3"
    );
  };

  const closeMedicationAction = () => {
    setMedicationAction(null);
    setMedicationActionNotes("");
    setPauseDurationDays("");
  };

  const handleConfirmSubmit = async () => {
    setSubmittingRx(true);
    try {
      const items = prescriptionItems.map((pi) => ({
        drug_id: pi.drug_id,
        dosage: pi.dosage,
        frequency: pi.frequency,
        duration_days: parseInt(pi.duration_days, 10) || 7,
        instructions: pi.instructions,
      }));

      await createPrescription(selectedPatientId, {
        ...prescriptionDraft,
        items,
      });

      // Mark the active appointment as finished/complete
      const targetAppointmentId = selectedPatient?.appointment_id;
      if (targetAppointmentId) {
        await completeAppointment(targetAppointmentId);
      }

      addToast(
        "Prescription finalized and appointment marked complete!",
        "success"
      );

      // Reload chart
      const data = await getDoctorPatientChart(selectedPatientId);
      setChartData(data);
      setPrescriptionDraft(createPrescriptionDraftFromChart(data));
      setPrescriptionItems([]);
      setSafetyReport(null);

      // Reload registry to reflect updated patient list status
      loadPatients();

      // Navigate to print page
      navigate(`/prescription/print/${selectedPatientId}`);
    } catch (err) {
      addToast(err.message || "Failed to submit prescription copy", "error");
    } finally {
      setSubmittingRx(false);
      setShowConfirm(false);
    }
  };

  const handleMedicationStatusChange = async (item, status, options = {}) => {
    setUpdatingMedicationId(item.item_id);
    try {
      await modifyPrescriptionItem(selectedPatientId, item.item_id, {
        status,
        pause_duration_days:
          status === "paused" ? options.pauseDurationDays : null,
        duration_days:
          item.source === "prescription_scan" && status === "stopped"
            ? options.durationDays
            : null,
        modification_notes: options.notes || null,
      });

      const data = await getDoctorPatientChart(selectedPatientId);
      setChartData(data);
      addToast(`Medication structural list updated to ${status}`, "success");
      closeMedicationAction();

      // If viewing the database trace list panel, sync updates
      if (showPausedHistory) {
        fetchPausedMedicationsHistory();
      }
    } catch (err) {
      addToast(
        err.message || "Failed to update medication status configuration",
        "error"
      );
    } finally {
      setUpdatingMedicationId(null);
    }
  };

  const confirmMedicationAction = () => {
    if (!medicationAction) return;
    const durationDays = parseInt(pauseDurationDays, 10);
    const isScannedMedication =
      medicationAction.item.source === "prescription_scan";

    if (
      medicationAction.status === "paused" &&
      (!durationDays || durationDays < 1)
    ) {
      addToast("Pause duration must be at least 1 day", "warning");
      return;
    }

    handleMedicationStatusChange(
      medicationAction.item,
      medicationAction.status,
      {
        pauseDurationDays: durationDays,
        durationDays:
          isScannedMedication && medicationAction.status === "stopped"
            ? 0
            : durationDays,
        notes: medicationActionNotes.trim(),
      }
    );
  };

  const calculateAge = (dobString) => {
    if (!dobString) return "N/A";
    try {
      const dob = new Date(dobString);
      const diff = Date.now() - dob.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + " yrs";
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[calc(100vh-8rem)]">
      {/* Left side: Patient selector list */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 flex flex-col h-[calc(100vh-10rem)] lg:h-[75vh] overflow-hidden">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">
          Patient Registry
        </h2>
        <div className="grid gap-2 mb-3 flex-shrink-0">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
              Appointment Date
            </span>
            <input
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-white text-sm px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-400"
              placeholder="Search patient name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredPatients.length > 0 ? (
            filteredPatients.map((p) => (
              <button
                key={p.patient_id}
                onClick={() => handleSelectPatient(p)}
                className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-colors ${
                  selectedPatientId === p.patient_id
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-700 dark:text-gray-300 border border-transparent"
                }`}
              >
                <div className="relative w-9 h-9 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <User className="w-5 h-5" />
                  {p.arrival_time && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate flex items-center gap-1.5 justify-between">
                    <span>{p.name}</span>
                    {p.serial_number && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 flex-shrink-0">
                        #{p.serial_number}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {p.gender} · {calculateAge(p.date_of_birth)}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate font-semibold">
                    {String(p.status || "booked")}
                    {p.priority_flag ? " · priority" : ""}
                    {p.arrival_time ? " · ✓ Arrived" : ""}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-xs text-gray-400 text-center py-6">
              No matching patients found.
            </p>
          )}
        </div>
      </div>

      {/* Right side: Detail Patient Chart + Prescription Builder */}
      <div className="flex-1 min-w-0 flex flex-col gap-5 h-[calc(100vh-10rem)] lg:h-[75vh] overflow-y-auto">
        {!selectedPatientId ? (
          <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
            <span className="text-5xl mb-4 animate-bounce-slow">🧑‍⚕️</span>
            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg">
              No Patient Selected
            </h3>
            <p className="text-gray-400 text-sm mt-1 max-w-sm">
              Please select a patient from the registry on the left to review
              their chart details and draft prescriptions.
            </p>
          </div>
        ) : loadingChart ? (
          <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <span className="text-4xl animate-spin">⚕️</span>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Retrieving Medical Record...
            </p>
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
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {chartData.patient?.name}
                      {selectedPatient?.serial_number && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Serial #{selectedPatient.serial_number}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {chartData.patient?.gender} ·{" "}
                      {calculateAge(chartData.patient?.date_of_birth)} (
                      {chartData.patient?.date_of_birth
                        ? new Date(
                            chartData.patient.date_of_birth
                          ).toLocaleDateString()
                        : "N/A"}
                      )
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
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
                        <p className="font-bold text-gray-800 dark:text-gray-200">
                          {chartData.patient.height} cm
                        </p>
                      </div>
                    )}
                    {chartData.patient?.weight && (
                      <div className="text-center">
                        <p className="text-xs text-gray-400">Weight</p>
                        <p className="font-bold text-gray-800 dark:text-gray-200">
                          {chartData.patient.weight} kg
                        </p>
                      </div>
                    )}
                    {chartData.patient?.height &&
                      chartData.patient?.weight &&
                      (() => {
                        const bmi = calculateBMI(
                          chartData.patient.height,
                          chartData.patient.weight
                        );
                        const category = bmiCategory(bmi);
                        const color =
                          parseFloat(bmi) < 18.5
                            ? "text-blue-500"
                            : parseFloat(bmi) < 25
                            ? "text-emerald-500"
                            : parseFloat(bmi) < 30
                            ? "text-amber-500"
                            : "text-rose-500";
                        return (
                          <div className="text-center">
                            <p className="text-xs text-gray-400">BMI</p>
                            <p className={`font-bold ${color}`}>{bmi}</p>
                            <p className="text-[10px] text-gray-400">
                              {category}
                            </p>
                          </div>
                        );
                      })()}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleGenerateAiSummary}
                    loading={loadingAiSummary}
                    className="border border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-900/70 dark:text-purple-300 dark:hover:bg-purple-950/30 ml-auto"
                  >
                    <Sparkles className="w-4 h-4" /> AI Clinical Summary
                  </Button>
                </div>
              </div>

              {/* AI Summary Modal */}
              <AnimatePresence>
                {showAiSummary && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowAiSummary(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.97 }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                    >
                      {/* Modal Header */}
                      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between rounded-t-3xl">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-purple-500" />
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            AI Clinical Summary
                          </h3>
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                            RAG Grounded
                          </span>
                        </div>
                        <button
                          onClick={() => setShowAiSummary(false)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="p-6 space-y-5">
                        {loadingAiSummary ? (
                          <div className="text-center py-12 space-y-3">
                            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-gray-500 text-sm">
                              Fetching patient data and searching clinical
                              literature…
                            </p>
                            <p className="text-gray-400 text-xs">
                              This usually takes 20–40 seconds
                            </p>
                          </div>
                        ) : aiSummary ? (
                          <>
                            {/* Patient Summary */}
                            {aiSummary.patient_summary && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                {[
                                  ["Name", aiSummary.patient_summary.name],
                                  ["Age", aiSummary.patient_summary.age],
                                  [
                                    "Blood Group",
                                    aiSummary.patient_summary.blood_group,
                                  ],
                                  ["BMI", aiSummary.patient_summary.bmi],
                                  ["Gender", aiSummary.patient_summary.gender],
                                  ["BP", aiSummary.patient_summary.bp],
                                ]
                                  .filter(([, v]) => v)
                                  .map(([label, value]) => (
                                    <div key={label}>
                                      <p className="text-xs text-gray-400">
                                        {label}
                                      </p>
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        {value}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            )}

                            {/* Key Clinical Notes */}
                            {aiSummary.key_clinical_notes && (
                              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                                  Key Clinical Notes
                                </p>
                                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                                  {aiSummary.key_clinical_notes}
                                </p>
                              </div>
                            )}

                            {/* Risk Flags */}
                            {aiSummary.risk_flags?.length > 0 && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                  Risk Flags
                                </p>
                                <div className="space-y-2">
                                  {aiSummary.risk_flags.map((flag, i) => (
                                    <div
                                      key={i}
                                      className={`rounded-xl p-3 border text-sm ${
                                        flag.level === "high"
                                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50"
                                          : flag.level === "moderate"
                                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50"
                                          : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-1">
                                        <span
                                          className={`text-xs px-1.5 py-0.5 rounded font-bold uppercase ${
                                            flag.level === "high"
                                              ? "bg-red-500 text-white"
                                              : flag.level === "moderate"
                                              ? "bg-amber-500 text-white"
                                              : "bg-blue-500 text-white"
                                          }`}
                                        >
                                          {flag.level}
                                        </span>
                                        {flag.flag}
                                      </div>
                                      <p className="text-gray-600 dark:text-gray-300 text-xs">
                                        {flag.basis}
                                      </p>
                                      {flag.rag_reference && (
                                        <p className="text-gray-400 text-xs mt-1 italic">
                                          {flag.rag_reference}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Lab Findings */}
                            {aiSummary.lab_findings?.length > 0 && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                  Lab Findings
                                </p>
                                <div className="space-y-2">
                                  {aiSummary.lab_findings.map((f, i) => (
                                    <div
                                      key={i}
                                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                          {f.parameter}
                                        </span>
                                        <span
                                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                            f.status?.includes("critical")
                                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                              : f.status === "high" ||
                                                f.status === "low"
                                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                          }`}
                                        >
                                          {f.value}
                                        </span>
                                      </div>
                                      {f.clinical_significance && (
                                        <p className="text-gray-500 text-xs">
                                          {f.clinical_significance}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Active Conditions */}
                            {aiSummary.active_conditions?.length > 0 && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                  Active Conditions
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {aiSummary.active_conditions.map((c, i) => (
                                    <span
                                      key={i}
                                      className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800/50"
                                    >
                                      {c.condition}
                                      {c.severity ? ` (${c.severity})` : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Allergies */}
                            {aiSummary.allergies?.length > 0 && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                  Allergies
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {aiSummary.allergies.map((a, i) => (
                                    <span
                                      key={i}
                                      className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs px-3 py-1 rounded-full border border-red-200 dark:border-red-800/50"
                                    >
                                      {a.allergen} — {a.severity}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Clinical Recommendations */}
                            {/* {aiSummary.clinical_recommendations?.length > 0 && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Clinical Recommendations</p>
                                <div className="space-y-2">
                                  {aiSummary.clinical_recommendations.map((r, i) => (
                                    <div key={i} className="flex gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3 text-sm">
                                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-bold uppercase self-start mt-0.5 ${r.priority === 'urgent' ? 'bg-red-500 text-white' : r.priority === 'high' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>{r.priority}</span>
                                      <div>
                                        <p className="text-gray-800 dark:text-gray-200">{r.recommendation}</p>
                                        {r.evidence_basis && <p className="text-gray-400 text-xs mt-1 italic">{r.evidence_basis}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )} */}

                            <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100 dark:border-gray-800">
                              Generated{" "}
                              {aiSummary.generated_at
                                ? new Date(
                                    aiSummary.generated_at
                                  ).toLocaleString()
                                : "just now"}{" "}
                              · Grounded in Harrison's, Davidson's & MedlinePlus
                              via RAG
                            </p>
                          </>
                        ) : null}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Patient Chart Tabs */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
                <div className="flex border-b border-gray-100 dark:border-gray-800 pb-2 mb-4 overflow-x-auto gap-2">
                  {[
                    {
                      id: "conditions",
                      label: "Conditions",
                      count: chartData.chart?.conditions?.length,
                    },
                    {
                      id: "allergies",
                      label: "Allergies",
                      count: chartData.chart?.allergies?.length,
                    },
                    {
                      id: "medications",
                      label: "Active Medications",
                      count: activeMedications.length,
                    },
                    {
                      id: "prescriptions",
                      label: "Active Prescriptions",
                      count: chartData.chart?.activePrescriptions?.length,
                    },
                    {
                      id: "surgeries",
                      label: "Surgeries",
                      count: chartData.chart?.surgeries?.length,
                    },
                    {
                      id: "vaccinations",
                      label: "Vaccinations",
                      count: chartData.chart?.vaccinations?.length,
                    },
                    {
                      id: "reports",
                      label: "Lab Reports",
                      count: chartData.chart?.reports?.length,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        activeTab === tab.id
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          activeTab === tab.id
                            ? "bg-white/20 text-white"
                            : "bg-gray-100 dark:bg-gray-850 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {tab.count || 0}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="min-h-[150px]">
                  {activeTab === "conditions" && (
                    <div className="space-y-3">
                      {chartData.chart?.conditions?.length > 0 ? (
                        chartData.chart.conditions.map((c) => (
                          <div
                            key={c.condition_id}
                            className="p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800"
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">
                                {c.condition_name}
                              </h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold capitalize">
                                {c.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              Diagnosed on:{" "}
                              {c.diagnosed_at
                                ? new Date(c.diagnosed_at).toLocaleDateString()
                                : "N/A"}{" "}
                              · Severity:{" "}
                              <span className="font-semibold text-amber-500">
                                {c.severity || "N/A"}
                              </span>
                            </p>
                            {c.notes && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                Notes: {c.notes}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">
                          No conditions on record.
                        </p>
                      )}
                    </div>
                  )}

                  {activeTab === "allergies" && (
                    <div className="space-y-3">
                      {chartData.chart?.allergies?.length > 0 ? (
                        chartData.chart.allergies.map((a) => (
                          <div
                            key={a.allergy_id}
                            className="p-3 bg-rose-500/5 rounded-2xl border border-rose-200/20 flex justify-between items-center"
                          >
                            <div>
                              <h4 className="font-bold text-sm text-rose-600 dark:text-rose-400">
                                {a.brand_name || a.generic_name}
                              </h4>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Reaction: {a.reaction_type || "Unknown"} ·
                                Severity:{" "}
                                <span className="font-semibold">
                                  {a.severity}
                                </span>
                              </p>
                            </div>
                            {a.confirmed_at && (
                              <span className="text-[10px] text-gray-400">
                                Confirmed:{" "}
                                {new Date(a.confirmed_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">
                          No drug allergies on record.
                        </p>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-150 dark:border-gray-800">
                        {!showAddAllergyForm ? (
                          <button
                            type="button"
                            onClick={() => setShowAddAllergyForm(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-all"
                          >
                            <PlusCircle className="w-4 h-4" /> Add Allergy
                          </button>
                        ) : (
                          <form
                            onSubmit={handleAddAllergy}
                            className="bg-rose-500/5 rounded-2xl border border-rose-200/20 p-4 space-y-4"
                          >
                            <div className="flex justify-between items-center">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                Add Allergy
                              </h4>
                              <button
                                type="button"
                                onClick={() => setShowAddAllergyForm(false)}
                                className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="relative md:col-span-2">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Drug Allergen
                                </label>
                                <div className="relative">
                                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-2 pl-9 pr-3 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                    placeholder="Search drug by generic or brand..."
                                    value={allergyDrugSearch}
                                    onChange={handleAllergyDrugSearchChange}
                                  />
                                </div>

                                {allergyDrugResults.length > 0 && (
                                  <div className="absolute left-0 right-0 z-35 mt-1 max-h-50 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl">
                                    {allergyDrugResults.map((drug) => (
                                      <button
                                        key={drug.drug_id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedAllergyDrug(drug);
                                          setAllergyDrugSearch(
                                            drug.brand_name
                                              ? `${drug.brand_name} (${drug.generic_name})`
                                              : drug.generic_name
                                          );
                                          setAllergyDrugResults([]);
                                        }}
                                        className="flex w-full justify-between gap-3 px-4 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                                      >
                                        <span className="min-w-0">
                                          <span className="font-bold">
                                            {drug.brand_name || "N/A"}
                                          </span>
                                          <span className="ml-2 text-gray-500">
                                            ({drug.generic_name})
                                          </span>
                                        </span>
                                        <span className="flex-shrink-0 rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">
                                          {drug.drug_class || "General"}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Reaction Type
                                </label>
                                <input
                                  type="text"
                                  value={reactionType}
                                  onChange={(e) =>
                                    setReactionType(e.target.value)
                                  }
                                  placeholder="e.g. Skin Rash, Anaphylaxis"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Severity
                                </label>
                                <select
                                  value={allergySeverity}
                                  onChange={(e) =>
                                    setAllergySeverity(e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white focus:outline-none focus:border-emerald-500"
                                >
                                  <option value="mild">Mild</option>
                                  <option value="moderate">Moderate</option>
                                  <option value="severe">Severe</option>
                                  <option value="critical">Critical</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Confirmed Date
                                </label>
                                <input
                                  type="date"
                                  value={allergyConfirmedAt}
                                  onChange={(e) =>
                                    setAllergyConfirmedAt(e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>

                            <Button
                              type="submit"
                              loading={submittingAllergy}
                              className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                            >
                              Add Allergy
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "medications" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                        <p className="text-xs text-gray-400 font-medium">
                          Currently Administered Drugs
                        </p>
                        <button
                          type="button"
                          onClick={togglePausedHistoryPanel}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-600 dark:text-gray-300 font-semibold transition"
                        >
                          <History className="w-3.5 h-3.5 text-amber-500" />
                          {showPausedHistory
                            ? "Hide Paused/Stopped History"
                            : "View Database Paused History"}
                        </button>
                      </div>

                      {/* DATABASE TRACE: Paused / Stopped Entries section fetched via getPausedMedication */}
                      <AnimatePresence border>
                        {showPausedHistory && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-amber-500/5 border border-dashed border-amber-500/20 rounded-2xl p-3 space-y-2.5 overflow-hidden"
                          >
                            <p className="text-[11px] font-bold tracking-wider text-amber-600 uppercase">
                              Database Trace: Paused & Stopped Log
                            </p>

                            {loadingPausedHistory ? (
                              <div className="text-center py-4 text-xs text-gray-400 animate-pulse">
                                Loading historical logs...
                              </div>
                            ) : pausedMedicationsHistory?.pausedMedications
                                ?.length > 0 ? (
                              pausedMedicationsHistory.pausedMedications.map(
                                (histItem) => {
                                  const isScannedMedication =
                                    histItem.source === "prescription_scan";
                                  return (
                                    <div
                                      key={histItem.item_id}
                                      className="p-2.5 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-xl flex justify-between items-start text-xs"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-gray-900 dark:text-white">
                                            {histItem.brand_name ||
                                              histItem.generic_name ||
                                              "Unknown Drug"}
                                          </span>
                                          <span
                                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${statusStyle(
                                              histItem.status || "paused"
                                            )}`}
                                          >
                                            {histItem.status || "Paused"}
                                          </span>
                                        </div>
                                        <p className="text-gray-500 mt-0.5">
                                          {histItem.dosage || "N/A"} ·{" "}
                                          {histItem.frequency || "N/A"}
                                        </p>
                                        {isScannedMedication && (
                                          <p className="text-[11px] text-gray-400 mt-1">
                                            Scanned prescription
                                            {histItem.expires_at
                                              ? ` · ended ${new Date(
                                                  histItem.expires_at
                                                ).toLocaleDateString()}`
                                              : ""}
                                          </p>
                                        )}
                                        {isScannedMedication && (
                                          <p className="text-[11px] text-emerald-600 dark:text-emerald-300 mt-1 font-semibold">
                                            Rx date:{" "}
                                            {scannedRxDateLabel(histItem)}
                                          </p>
                                        )}
                                        {histItem.modification_notes && (
                                          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 italic">
                                            Reason: "
                                            {histItem.modification_notes}"
                                          </p>
                                        )}
                                      </div>
                                      {isScannedMedication ? (
                                        <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 font-semibold text-[10px]">
                                          Scan record
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleMedicationStatusChange(
                                              histItem,
                                              "active"
                                            )
                                          }
                                          className="px-2 py-1 rounded bg-emerald-500 text-white font-semibold text-[10px] hover:bg-emerald-600 transition"
                                        >
                                          Re-activate
                                        </button>
                                      )}
                                    </div>
                                  );
                                }
                              )
                            ) : (
                              <p className="text-xs text-gray-400 text-center py-2">
                                No historical stopped or paused records found in
                                database.
                              </p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="space-y-3">
                        {activeMedications.length > 0 ? (
                          activeMedications.map((item) => {
                            const medStatus = item.status || "active";
                            const isUpdating =
                              updatingMedicationId === item.item_id;
                            const isScannedMedication =
                              item.source === "prescription_scan";
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
                                        {item.brand_name ||
                                          item.generic_name ||
                                          "Medication"}
                                      </h4>
                                      {item.generic_name && item.brand_name && (
                                        <span className="text-xs text-gray-400">
                                          ({item.generic_name})
                                        </span>
                                      )}
                                      <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize ${statusStyle(
                                          medStatus
                                        )}`}
                                      >
                                        {medStatus}
                                        {medStatus === "paused" &&
                                        item.pause_duration_days
                                          ? ` - ${item.pause_duration_days}d`
                                          : ""}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {[
                                        item.dosage,
                                        item.frequency,
                                        item.duration_days
                                          ? `${item.duration_days} days`
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                    {item.instructions && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Instructions: {item.instructions}
                                      </p>
                                    )}
                                    <p className="text-[11px] text-gray-400 mt-2">
                                      {isScannedMedication ? "" : "Dr. "}
                                      {item.doctor_name ||
                                        (isScannedMedication
                                          ? "Scanned prescription"
                                          : "System")}{" "}
                                      ·{" "}
                                      {item.issued_at
                                        ? formatChartDate(item.issued_at)
                                        : "No issue date"}
                                      {isScannedMedication
                                        ? " · Uploaded scan"
                                        : ""}
                                    </p>
                                    {isScannedMedication && (
                                      <p className="text-[11px] text-emerald-600 dark:text-emerald-300 mt-1 font-semibold">
                                        Rx date: {scannedRxDateLabel(item)}
                                      </p>
                                    )}
                                    {item.modification_notes && (
                                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 rounded-xl px-3 py-2">
                                        Note: {item.modification_notes}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap gap-2 lg:justify-end">
                                    {isScannedMedication && (
                                      <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-200/70 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                                        Scan record
                                      </span>
                                    )}
                                    {!isScannedMedication &&
                                      medStatus !== "active" && (
                                        <button
                                          type="button"
                                          disabled={isUpdating}
                                          onClick={() =>
                                            handleMedicationStatusChange(
                                              item,
                                              "active"
                                            )
                                          }
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold disabled:opacity-60"
                                        >
                                          <Play className="w-3.5 h-3.5" />{" "}
                                          Resume
                                        </button>
                                      )}
                                    {!isScannedMedication &&
                                      medStatus !== "paused" && (
                                        <button
                                          type="button"
                                          disabled={isUpdating}
                                          onClick={() =>
                                            openMedicationAction(item, "paused")
                                          }
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold disabled:opacity-60"
                                        >
                                          <Pause className="w-3.5 h-3.5" />{" "}
                                          Pause
                                        </button>
                                      )}
                                    {medStatus !== "stopped" && (
                                      <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={() =>
                                          openMedicationAction(item, "stopped")
                                        }
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
                          <p className="text-xs text-gray-400 text-center py-6">
                            No active medications found.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "prescriptions" && (
                    <div className="space-y-4">
                      {chartData.chart?.activePrescriptions?.length > 0 ? (
                        chartData.chart.activePrescriptions.map((rx) => (
                          <div
                            key={rx.prescription_id}
                            className="p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800"
                          >
                            <div className="flex justify-between items-start border-b border-gray-150 dark:border-gray-800 pb-2 mb-2">
                              <div>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                  {rx.source === "prescription_scan"
                                    ? `Scanned prescription${
                                        rx.doctor_name
                                          ? ` · ${rx.doctor_name}`
                                          : ""
                                      }`
                                    : `Prescribed by Dr. ${
                                        rx.doctor_name || "System"
                                      }`}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  Issued:{" "}
                                  {rx.issued_at
                                    ? formatChartDate(rx.issued_at)
                                    : "No prescription date"}
                                </p>
                                {rx.source === "prescription_scan" &&
                                  scannedRxDateValue(rx) && (
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-semibold">
                                      Rx date: {scannedRxDateLabel(rx)}
                                    </p>
                                  )}
                              </div>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full capitalize">
                                {rx.status}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {rx.items?.map((item) => (
                                <div
                                  key={item.item_id}
                                  className="text-xs flex items-center justify-between text-gray-600 dark:text-gray-400"
                                >
                                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                                    {item.brand_name || item.generic_name}{" "}
                                    {item.dosage}
                                  </span>
                                  <span>
                                    {item.frequency} · {item.duration_days} days
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">
                          No active prescriptions.
                        </p>
                      )}
                    </div>
                  )}

                  {activeTab === "surgeries" && (
                    <div className="space-y-3">
                      {chartData.chart?.surgeries?.length > 0 ? (
                        chartData.chart.surgeries.map((s) => (
                          <div
                            key={s.surgery_id}
                            className="p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800"
                          >
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">
                              {s.procedure_name}
                            </h4>
                            <p className="text-xs text-gray-400 mt-1">
                              Performed on:{" "}
                              {s.performed_at
                                ? new Date(s.performed_at).toLocaleDateString()
                                : "N/A"}{" "}
                              · Outcome:{" "}
                              <span className="font-semibold text-emerald-500">
                                {s.outcome || "N/A"}
                              </span>
                            </p>
                            {s.notes && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                Notes: {s.notes}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">
                          No surgical history on record.
                        </p>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-150 dark:border-gray-800">
                        {!showAddSurgeryForm ? (
                          <button
                            type="button"
                            onClick={() => setShowAddSurgeryForm(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all"
                          >
                            <PlusCircle className="w-4 h-4" /> Record Surgery
                          </button>
                        ) : (
                          <form
                            onSubmit={handleAddSurgery}
                            className="bg-emerald-500/5 rounded-2xl border border-emerald-200/20 p-4 space-y-4"
                          >
                            <div className="flex justify-between items-center">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Record Surgery
                              </h4>
                              <button
                                type="button"
                                onClick={() => setShowAddSurgeryForm(false)}
                                className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Procedure / Surgery Name
                                </label>
                                <input
                                  type="text"
                                  value={surgeryProcedureName}
                                  onChange={(e) =>
                                    setSurgeryProcedureName(e.target.value)
                                  }
                                  placeholder="e.g. Appendectomy, Coronary Bypass"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  ICD-10 PCS Code
                                </label>
                                <input
                                  type="text"
                                  value={surgeryIcd10Pcs}
                                  onChange={(e) =>
                                    setSurgeryIcd10Pcs(e.target.value)
                                  }
                                  placeholder="e.g. 0DB94ZZ"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Date Performed
                                </label>
                                <input
                                  type="date"
                                  value={surgeryPerformedAt}
                                  onChange={(e) =>
                                    setSurgeryPerformedAt(e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Outcome
                                </label>
                                <select
                                  value={surgeryOutcome}
                                  onChange={(e) =>
                                    setSurgeryOutcome(e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white focus:outline-none focus:border-emerald-500"
                                >
                                  <option value="successful">Successful</option>
                                  <option value="complicated">
                                    Complicated
                                  </option>
                                  <option value="failed">Failed</option>
                                  <option value="ongoing">Ongoing</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Anaesthesia Type
                                </label>
                                <input
                                  type="text"
                                  value={surgeryAnaesthesiaType}
                                  onChange={(e) =>
                                    setSurgeryAnaesthesiaType(e.target.value)
                                  }
                                  placeholder="e.g. General, Local, Epidural"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Complications
                                </label>
                                <input
                                  type="text"
                                  value={surgeryComplications}
                                  onChange={(e) =>
                                    setSurgeryComplications(e.target.value)
                                  }
                                  placeholder="e.g. Mild post-op bleeding, none"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Notes
                                </label>
                                <textarea
                                  rows={2}
                                  value={surgeryNotes}
                                  onChange={(e) =>
                                    setSurgeryNotes(e.target.value)
                                  }
                                  placeholder="Any additional details or recommendations..."
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 resize-none"
                                />
                              </div>
                            </div>

                            <Button
                              type="submit"
                              loading={submittingSurgery}
                              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                              Record Surgery
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "vaccinations" && (
                    <div className="space-y-3">
                      {chartData.chart?.vaccinations?.length > 0 ? (
                        chartData.chart.vaccinations.map((v) => (
                          <div
                            key={v.vaccination_id}
                            className="p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800"
                          >
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">
                              {v.vaccine_name}
                            </h4>
                            <p className="text-xs text-gray-400 mt-1">
                              Administered:{" "}
                              {new Date(v.administered_at).toLocaleDateString()}{" "}
                              · Dose: {v.dose_number}/{v.total_doses || 1}
                            </p>
                            {v.next_due_date && (
                              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                                Next due:{" "}
                                {new Date(v.next_due_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-6">
                          No vaccinations on record.
                        </p>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-150 dark:border-gray-800">
                        {!showAddVaccinationForm ? (
                          <button
                            type="button"
                            onClick={() => setShowAddVaccinationForm(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-all"
                          >
                            <PlusCircle className="w-4 h-4" /> Record
                            Vaccination
                          </button>
                        ) : (
                          <form
                            onSubmit={handleAddVaccination}
                            className="bg-teal-500/5 rounded-2xl border border-teal-200/20 p-4 space-y-4"
                          >
                            <div className="flex justify-between items-center">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                                Record Vaccination
                              </h4>
                              <button
                                type="button"
                                onClick={() => setShowAddVaccinationForm(false)}
                                className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Vaccine Name
                                </label>
                                <input
                                  type="text"
                                  value={vaccineName}
                                  onChange={(e) =>
                                    setVaccineName(e.target.value)
                                  }
                                  placeholder="e.g. COVID-19 mRNA, Influenza"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  CVX Code
                                </label>
                                <input
                                  type="text"
                                  value={vaccineCvxCode}
                                  onChange={(e) =>
                                    setVaccineCvxCode(e.target.value)
                                  }
                                  placeholder="e.g. 207"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Administered Date
                                </label>
                                <input
                                  type="date"
                                  value={vaccineAdministeredAt}
                                  onChange={(e) =>
                                    setVaccineAdministeredAt(e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Dose Number
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={vaccineDoseNumber}
                                  onChange={(e) =>
                                    setVaccineDoseNumber(e.target.value)
                                  }
                                  placeholder="e.g. 1, 2"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Total Doses (Series)
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={vaccineTotalDoses}
                                  onChange={(e) =>
                                    setVaccineTotalDoses(e.target.value)
                                  }
                                  placeholder="e.g. 2, 3"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Batch / Lot Number
                                </label>
                                <input
                                  type="text"
                                  value={vaccineBatchNumber}
                                  onChange={(e) =>
                                    setVaccineBatchNumber(e.target.value)
                                  }
                                  placeholder="e.g. EN9582"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Administration Site
                                </label>
                                <input
                                  type="text"
                                  value={vaccineSite}
                                  onChange={(e) =>
                                    setVaccineSite(e.target.value)
                                  }
                                  placeholder="e.g. Left Deltoid"
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Next Due Date (Booster)
                                </label>
                                <input
                                  type="date"
                                  value={vaccineNextDueDate}
                                  onChange={(e) =>
                                    setVaccineNextDueDate(e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                  Notes
                                </label>
                                <textarea
                                  rows={2}
                                  value={vaccineNotes}
                                  onChange={(e) =>
                                    setVaccineNotes(e.target.value)
                                  }
                                  placeholder="Any additional details or observations..."
                                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 resize-none"
                                />
                              </div>
                            </div>

                            <Button
                              type="submit"
                              loading={submittingVaccination}
                              className="w-full bg-teal-500 hover:bg-teal-600 text-white"
                            >
                              Record Vaccination
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "reports" && (
                    <div className="space-y-3">
                      {chartData.chart?.reports?.length > 0 ? (
                        chartData.chart.reports.map((r) => (
                          <div
                            key={r.report_id}
                            className="p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 flex justify-between items-center"
                          >
                            <div>
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-emerald-500" />
                                {r.report_type} Report
                              </h4>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Uploaded:{" "}
                                {new Date(r.uploaded_at).toLocaleDateString()}
                              </p>
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
                        <p className="text-xs text-gray-400 text-center py-6">
                          No lab reports uploaded.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Prescription Writer */}
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    Prescription Writer
                  </h2>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleRunSafetyCheck}
                      loading={checkingSafety}
                      disabled={prescriptionItems.length === 0}
                      className="border border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/70 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                    >
                      <Sparkles className="w-4 h-4" /> Safety Check
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSubmitPrescription}
                      loading={submittingRx}
                      disabled={prescriptionItems.length === 0}
                    >
                      <CheckCircle className="w-4 h-4" /> Finalize & Submit
                    </Button>
                  </div>
                </div>
                {safetyReport && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-3 ${
                      safetyReport.has_conflict
                        ? "bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60"
                        : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/60"
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
                      <p className="font-bold text-sm text-gray-900 dark:text-white">
                        {safetyReport.has_conflict
                          ? "Safety Conflict Flagged"
                          : "Prescription Verified Safe"}
                      </p>
                      {safetyReport.warnings &&
                      safetyReport.warnings.length > 0 ? (
                        <ul className="list-disc pl-4 space-y-1 text-gray-700 dark:text-gray-300">
                          {safetyReport.warnings.map((w, idx) => (
                            <li key={idx}>
                              <strong>
                                {w.severity?.toUpperCase() || "WARNING"}:
                              </strong>{" "}
                              {w.description}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-600 dark:text-gray-400">
                          No drug interactions or allergy conflicts detected
                          between the proposed items and the patient's record.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white text-gray-950 shadow-sm">
                  <div className="grid gap-4 border-b border-gray-300 px-5 py-5 lg:grid-cols-[1fr_auto_1fr]">
                    <div>
                      <p className="text-xl font-bold leading-tight">
                        Dr. {user?.name || user?.username || "Doctor"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        {Array.isArray(user?.specialty)
                          ? user.specialty.length > 0
                            ? user.specialty.join(", ")
                            : "General Practitioner"
                          : user?.specialty || "General Practitioner"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        License No: {user?.license_number || "N/A"}
                      </p>
                    </div>

                    <div className="hidden items-center justify-center lg:flex">
                      <div className="rounded-full border-2 border-emerald-800 px-5 py-2 text-center text-xs font-black uppercase tracking-[0.24em] text-emerald-900">
                        RxSense
                      </div>
                    </div>

                    <div className="lg:text-right">
                      <p className="text-xl font-black tracking-wide">
                        Digital Prescription
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        Editable clinical copy
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Patient ID: {chartData.patient?.patient_id || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 border-b border-gray-300 px-5 py-3 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.8fr_0.9fr]">
                    <PrescriptionMetaField label="Name">
                      {chartData.patient?.name || "N/A"}
                    </PrescriptionMetaField>
                    <PrescriptionMetaField label="Age">
                      {calculateAge(chartData.patient?.date_of_birth)}
                    </PrescriptionMetaField>
                    <PrescriptionMetaField label="Gender">
                      {chartData.patient?.gender || "N/A"}
                    </PrescriptionMetaField>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                        Date
                      </span>
                      <input
                        type="date"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm font-semibold text-gray-950 focus:outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="sm:col-span-2 lg:col-span-4">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                        Referred By
                      </span>
                      <input
                        value={prescriptionDraft.referredBy}
                        onChange={(e) =>
                          updatePrescriptionDraft("referredBy", e.target.value)
                        }
                        placeholder="Write referral source if any"
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-950 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                      />
                    </label>
                  </div>

                  <div className="grid lg:grid-cols-[minmax(260px,36%)_1fr]">
                    <aside className="space-y-4 border-b border-gray-300 bg-gray-50/70 px-5 py-5 lg:border-b-0 lg:border-r">
                      <PrescriptionTextarea
                        label="Chief Complaint"
                        rows={3}
                        value={prescriptionDraft.chiefComplaint}
                        onChange={(value) =>
                          updatePrescriptionDraft("chiefComplaint", value)
                        }
                        placeholder="Write presenting complaints"
                      />
                      <PrescriptionTextarea
                        label="On Examination"
                        rows={4}
                        value={prescriptionDraft.examination}
                        onChange={(value) =>
                          updatePrescriptionDraft("examination", value)
                        }
                        placeholder="BP, pulse, weight, BMI, physical findings"
                      />
                      <PrescriptionTextarea
                        label="Diagnosis"
                        rows={4}
                        value={prescriptionDraft.diagnosis}
                        onChange={(value) =>
                          updatePrescriptionDraft("diagnosis", value)
                        }
                        placeholder="Write diagnosis"
                      />
                      <PrescriptionTextarea
                        label="Allergies"
                        rows={3}
                        tone="warning"
                        value={prescriptionDraft.allergies}
                        onChange={(value) =>
                          updatePrescriptionDraft("allergies", value)
                        }
                      />
                      <PrescriptionTextarea
                        label="Current Medicine Still Taken"
                        rows={4}
                        value={prescriptionDraft.currentMedications}
                        onChange={(value) =>
                          updatePrescriptionDraft("currentMedications", value)
                        }
                        readOnly={true}
                      />
                    </aside>

                    <section className="min-h-[720px] px-5 py-5">
                      <div className="mb-5 flex items-center justify-between border-b border-gray-200 pb-3">
                        <p className="font-serif text-3xl font-black text-gray-950">
                          Rx
                        </p>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                          Medicine
                        </p>
                      </div>

                      <div className="space-y-1 mb-4">
                        {prescriptionItems.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm font-medium text-gray-400">
                            No medicines added yet. Use the form below to add.
                          </div>
                        ) : (
                          prescriptionItems.map((item, index) => (
                            <div
                              key={`${item.drug_id}-${index}`}
                              className="group relative pl-1 py-2.5 border-b border-gray-100 last:border-0"
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 text-sm font-bold text-gray-700 w-5 flex-shrink-0">
                                  {index + 1}.
                                </span>
                                <div className="flex-1 min-w-0">
                                  <input
                                    value={item.name}
                                    onChange={(e) =>
                                      handleUpdateDrugItem(
                                        index,
                                        "name",
                                        e.target.value
                                      )
                                    }
                                    className="w-full bg-transparent border-0 border-b border-dotted border-gray-300 focus:border-emerald-500 focus:outline-none text-[15px] font-bold text-gray-950 leading-tight pb-0.5 pr-8"
                                  />
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                                    <input
                                      value={item.dosage}
                                      onChange={(e) =>
                                        handleUpdateDrugItem(
                                          index,
                                          "dosage",
                                          e.target.value
                                        )
                                      }
                                      placeholder="0+0+1"
                                      className="bg-transparent border-0 border-b border-dotted border-gray-300 focus:border-emerald-500 focus:outline-none text-sm font-mono font-semibold text-gray-700 w-24 pb-0.5"
                                    />
                                    <input
                                      value={item.frequency}
                                      onChange={(e) =>
                                        handleUpdateDrugItem(
                                          index,
                                          "frequency",
                                          e.target.value
                                        )
                                      }
                                      placeholder="After meals"
                                      className="bg-transparent border-0 border-b border-dotted border-gray-300 focus:border-emerald-500 focus:outline-none text-sm text-gray-600 w-32 pb-0.5"
                                    />
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.duration_days}
                                        onChange={(e) =>
                                          handleUpdateDrugItem(
                                            index,
                                            "duration_days",
                                            e.target.value
                                          )
                                        }
                                        placeholder="7"
                                        className="bg-transparent border-0 border-b border-dotted border-gray-300 focus:border-emerald-500 focus:outline-none text-sm text-gray-600 w-12 pb-0.5 text-center"
                                      />
                                      <span className="text-xs text-gray-400">
                                        days
                                      </span>
                                    </div>
                                    <input
                                      value={item.instructions}
                                      onChange={(e) =>
                                        handleUpdateDrugItem(
                                          index,
                                          "instructions",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Instructions"
                                      className="bg-transparent border-0 border-b border-dotted border-gray-300 focus:border-emerald-500 focus:outline-none text-xs text-gray-500 w-40 pb-0.5"
                                    />
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  title="Remove medication"
                                  aria-label="Remove medication"
                                  onClick={() => handleRemoveDrugItem(index)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-3 border border-dashed border-gray-200 rounded-xl bg-gray-50/60 px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
                          + Add Medicine
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="relative md:col-span-2">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-950 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                              placeholder="Search drug by generic or brand"
                              value={drugSearch}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDrugSearch(value); // This allows you to actually type!

                                if (value.trim()) {
                                  handleDrugSearchChange(e);
                                } else {
                                  setDrugResults([]);
                                }
                              }}
                            />

                            {drugResults.length > 0 && (
                              <div className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                                {drugResults.map((drug) => (
                                  <button
                                    key={drug.drug_id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedDrug(drug);
                                      setDrugSearch(
                                        drug.brand_name
                                          ? `${drug.brand_name} (${drug.generic_name})`
                                          : drug.generic_name
                                      );
                                      setDrugResults([]);
                                    }}
                                    className="flex w-full justify-between gap-3 px-4 py-2 text-left text-xs hover:bg-gray-50"
                                  >
                                    <span className="min-w-0">
                                      <span className="font-bold text-gray-900">
                                        {drug.brand_name || "N/A"}
                                      </span>
                                      <span className="ml-2 text-gray-500">
                                        ({drug.generic_name})
                                      </span>
                                    </span>
                                    <span className="flex-shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                                      {drug.drug_class || "General"}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <input
                            value={dosage}
                            onChange={(e) => setDosage(e.target.value)}
                            placeholder="Dosage (e.g. 500mg or 1 tablet)"
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                          />
                          <input
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value)}
                            placeholder="Frequency (e.g. 0+0+1)"
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                          />
                          <input
                            type="number"
                            min="1"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="Duration (days)"
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                          />
                          <input
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="Instructions(e.g. after meals)"
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleAddDrugItem}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            <PlusCircle className="w-4 h-4" /> Add Medication
                          </button>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <PrescriptionTextarea
                          label="Advices"
                          rows={4}
                          value={prescriptionDraft.advice}
                          onChange={(value) =>
                            updatePrescriptionDraft("advice", value)
                          }
                          placeholder="Diet, lifestyle, precautions"
                        />
                        <PrescriptionTextarea
                          label="Follow-up"
                          rows={4}
                          value={prescriptionDraft.followUp}
                          onChange={(value) =>
                            updatePrescriptionDraft("followUp", value)
                          }
                          placeholder="Next visit, review tests, emergency signs"
                        />
                      </div>

                      <div className="mt-16 flex justify-end">
                        <div className="w-56 border-t border-gray-500 pt-2 text-center text-xs font-semibold text-gray-600">
                          Doctor Signature
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="border-t border-gray-300 px-5 py-3 text-center text-xs font-medium text-gray-500">
                    Medicines should be taken only as directed by the registered
                    physician.
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {showConfirm && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl p-2 bg-rose-100 text-rose-600 dark:bg-rose-900/30">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  Confirm Submission
                </h3>

                <div className="mt-2 text-sm">
                  {confirmMessage.includes(
                    "Are you sure you want to continue and submit this prescription?"
                  ) && (
                    <p className="text-gray-600 dark:text-gray-300 font-medium mb-3">
                      Are you sure you want to continue and submit this
                      prescription?
                    </p>
                  )}

                  <div className="space-y-2 text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    {confirmMessage
                      .replace(
                        "Are you sure you want to continue and submit this prescription?",
                        ""
                      )
                      .split(/(?=\d+\.\s)/)
                      .map((point, index) => {
                        const trimmed = point.trim();
                        if (!trimmed) return null;
                        return (
                          <p
                            key={index}
                            className="leading-relaxed flex items-start gap-1"
                          >
                            {trimmed}
                          </p>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowConfirm(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSubmit}
                loading={submittingRx}
                className="bg-emerald-600 hover:bg-emerald-700 text-white structural-sub-btn"
              >
                OK
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

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
                <div
                  className={`mt-0.5 rounded-xl p-2 ${
                    medicationAction.status === "paused"
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                      : "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                  }`}
                >
                  {medicationAction.status === "paused" ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {medicationAction.status === "paused"
                      ? "Pause medication"
                      : medicationAction.item.source === "prescription_scan"
                      ? "Stop scanned medicine"
                      : "Stop medication"}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {medicationAction.item.brand_name ||
                      medicationAction.item.generic_name ||
                      "Medication"}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {medicationAction.status === "stopped" &&
                  medicationAction.item.source === "prescription_scan" && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-3 py-2">
                      Scanned prescriptions are kept in the record. Confirming
                      will stop it from being in active medicine list.
                    </p>
                  )}
                {medicationAction.status === "paused" && (
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Notes for patient
                  </label>
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeMedicationAction}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={confirmMedicationAction}
                  loading={
                    updatingMedicationId === medicationAction.item.item_id
                  }
                  className={
                    medicationAction.status === "stopped"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : ""
                  }
                >
                  {medicationAction.item.source === "prescription_scan" &&
                  medicationAction.status === "stopped"
                    ? "Stop medicine"
                    : "Confirm"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
