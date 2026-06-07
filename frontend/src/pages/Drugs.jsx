import { useState, useEffect } from 'react';
import { Plus, Info, Pill, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DrugInputRow from '../components/drugs/DrugInputRow.jsx';
import InteractionCard from '../components/drugs/InteractionCard.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import DisclaimerBanner from '../components/ui/DisclaimerBanner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { checkDrugInteractions, getPatientActiveMedications } from '../services/api.js';

const defaultDrugs = [
  { id: 'dd1', name: 'Warfarin', dosage: '500mg' },
  { id: 'dd2', name: 'Aspirin', dosage: '75mg' },
];

function InteractionMatrix({ matrix, drugs = [] }) {
  const severityColor = { safe: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', '-': 'bg-gray-100 dark:bg-gray-800 text-gray-400' };
  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={`px-2 py-1.5 text-center font-medium rounded ${i === 0 || j === 0 ? 'font-bold text-gray-700 dark:text-gray-300' : severityColor[cell] || 'bg-gray-50 dark:bg-gray-800'}`}>
                  {i === 0 || j === 0 ? (
                    <div className="flex flex-col items-center">
                      <div>{cell}</div>
                      {(j > 0 && i === 0) || (i > 0 && j === 0) ? (() => {
                        const idx = j > 0 && i === 0 ? j - 1 : (i > 0 && j === 0 ? i - 1 : -1);
                        const d = drugs[idx];
                        if (d && d.inputName && d.inputName.toLowerCase() !== String(cell).toLowerCase()) {
                          return <div className="text-xs text-gray-500 dark:text-gray-400">({d.inputName})</div>;
                        }
                        return null;
                      })() : null}
                    </div>
                  ) : (cell === '-' ? '—' : cell.charAt(0).toUpperCase() + cell.slice(1))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Drugs() {
  const { t } = useLanguage();
  const [drugs, setDrugs] = useState(defaultDrugs.map((d) => ({ ...d })));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  // Patient-oriented states
  const [activeTab, setActiveTab] = useState('standard');
  const [ongoingMeds, setOngoingMeds] = useState([]);
  const [loadingOngoingMeds, setLoadingOngoingMeds] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedType, setNewMedType] = useState('allopathy');
  const [loadingPatientCheck, setLoadingPatientCheck] = useState(false);
  const [patientCheckResult, setPatientCheckResult] = useState(null);

  const loadOngoingMeds = async () => {
    setLoadingOngoingMeds(true);
    try {
      const data = await getPatientActiveMedications();
      const activeMeds = (data || [])
        .filter((m) => String(m.status || 'active').toLowerCase() === 'active')
        .map((m) => ({
          id: m.item_id || m.id,
          name: m.brand_name || m.generic_name || m.extracted_name || 'Medication',
          generic: m.generic_name,
          dosage: m.dosage,
          source: m.source || 'prescription_item',
        }));
      setOngoingMeds(activeMeds);
    } catch (err) {
      console.error('Failed to load ongoing medications:', err);
    } finally {
      setLoadingOngoingMeds(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'patientOriented') {
      loadOngoingMeds();
    }
  }, [activeTab]);

  const addDrug = () => setDrugs((p) => [...p, { id: `dd_${Date.now()}`, name: '', dosage: '' }]);
  const removeDrug = (id) => setDrugs((p) => p.filter((d) => d.id !== id));
  const updateDrug = (id, data) => setDrugs((p) => p.map((d) => d.id === id ? data : d));

  const check = async () => {
    // Filter out empty names before sending
    const validDrugs = drugs
      .map(d => ({ ...d, name: (d.name || '').trim() }))
      .filter(d => d.name && d.name.length > 0);

    if (validDrugs.length === 0) {
      addToast(t('enterOneMed'), 'error');
      return;
    }

    setLoading(true);
    try {
      const data = await checkDrugInteractions(validDrugs);
      setResult(data);
      addToast(t('checkInteractionsBtn'), 'success');
    } catch (err) {
      console.error('Drug interaction check failed:', err);
      addToast(err.message || t('checkInteractionsBtn'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkPatientOriented = async () => {
    if (!newMedName.trim()) {
      addToast(t('enterOneMed'), 'error');
      return;
    }

    setLoadingPatientCheck(true);
    setPatientCheckResult(null);

    try {
      // TODO: Call the LLM agent to analyze drug interactions for the patient.
      // The LLM agent should check if the new medicine (newMedName, dosage, type) has
      // any conflicts or bad interactions with the patient's ongoing medications.
      // Payload to LLM agent:
      // - newMed: { name: newMedName, dosage: newMedDosage, type: newMedType }
      // - ongoingMedications: ongoingMeds (both prescription_item and scanned_prescription)
      // - patientHealthProfile (optional, for allergies/conditions if retrieved)

      // Simulate a loading delay for the LLM agent response
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock response for demonstration and hackathon visual integration
      const hasConflicts = ongoingMeds.length > 0 && ongoingMeds.some(m => 
        m.name.toLowerCase().includes('warfarin') || 
        m.name.toLowerCase().includes('aspirin')
      );

      const mockLlmResponse = {
        success: true,
        summary: `Analyzed "${newMedName}" (${newMedType === 'allopathy' ? 'Allopathy' : 'Homeopathy'}) against your ${ongoingMeds.length} active medication(s).`,
        findings: hasConflicts 
          ? [
              {
                severity: 'warning',
                interaction: `${newMedName} + Warfarin / Aspirin`,
                description: `Moderate interaction risk. Taking ${newMedName} with blood-thinners like Aspirin or Warfarin may increase risk of bleeding or reduce efficacy.`,
                recommendation: 'Seek advice from your healthcare practitioner before taking these together.'
              }
            ]
          : []
      };

      setPatientCheckResult(mockLlmResponse);
      addToast(t('checkOngoingBtn'), 'success');
    } catch (err) {
      console.error('Patient-oriented drug check failed:', err);
      addToast('Failed to analyze safety.', 'error');
    } finally {
      setLoadingPatientCheck(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Pill className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          {t('drugsPageTitle')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {t('drugsPageSubtitle')}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 flex-shrink-0 mb-1">
        <button
          onClick={() => setActiveTab('standard')}
          className={`px-4 py-2.5 text-sm font-semibold transition-all duration-150 border-b-2 ${
            activeTab === 'standard'
              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500'
              : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-750 dark:hover:text-gray-300'
          }`}
        >
          {t('tabStandardCheck')}
        </button>
        <button
          onClick={() => setActiveTab('patientOriented')}
          className={`px-4 py-2.5 text-sm font-semibold transition-all duration-150 border-b-2 ${
            activeTab === 'patientOriented'
              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500'
              : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-750 dark:hover:text-gray-300'
          }`}
        >
          {t('tabPatientCheck')}
        </button>
      </div>

      <DisclaimerBanner message={t('drugsDisclaimer')} />

      {activeTab === 'standard' ? (
        <>
          {/* Drug input */}
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('addMedications')}</h3>
            <div className="space-y-2.5">
              {drugs.map((drug) => (
                <DrugInputRow
                  key={drug.id}
                  drug={drug}
                  onChange={(d) => updateDrug(drug.id, d)}
                  onRemove={() => removeDrug(drug.id)}
                  canRemove={drugs.length > 1}
                />
              ))}
            </div>
            <button
              onClick={addDrug}
              className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              <Plus className="w-4 h-4" /> {t('addAnotherDrug')}
            </button>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button onClick={check} loading={loading} size="lg" className="w-full" disabled={!drugs.some(d => (d.name || '').trim().length > 0)}>
                Check Interactions
              </Button>
            </div>
          </Card>

          <AnimatePresence mode="wait">
            {result && (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { labelKey: 'safeCount',    count: result.summary.safe,    color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
                    { labelKey: 'warningCount', count: result.summary.warning, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
                    { labelKey: 'dangerCount',  count: result.summary.danger,  color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
                  ].map(({ labelKey, count, color }) => (
                    <div key={labelKey} className={`border rounded-xl p-3 text-center ${color}`}>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs font-medium">{t(labelKey)}</div>
                    </div>
                  ))}
                </div>

                {/* Interactions */}
                <div className="space-y-3">
                  {result.interactions.map((int) => (
                    <InteractionCard key={int.id} interaction={int} />
                  ))}
                </div>

                {/* Matrix */}
                <Card>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('interactionMatrix')}</h3>
                  <InteractionMatrix matrix={result.matrix} drugs={result.drugs} />
                </Card>

                {/* Data source */}
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 px-1">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  {result.dataSource}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          {/* Patient oriented input */}
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              {t('tabPatientCheck')}
            </h3>
            
            <div className="space-y-4">
              {/* Medicine Name */}
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                  {t('newMedNameLabel')}
                </label>
                <input
                  type="text"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  placeholder="e.g. Paracetamol, Ibuprofen..."
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Medicine Dosage */}
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                  {t('newMedDosageLabel')}
                </label>
                <input
                  type="text"
                  value={newMedDosage}
                  onChange={(e) => setNewMedDosage(e.target.value)}
                  placeholder="e.g. 500mg, 1 tablet..."
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Medicine Type */}
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  {t('newMedTypeLabel')}
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-medium select-none">
                    <input
                      type="radio"
                      name="newMedType"
                      value="allopathy"
                      checked={newMedType === 'allopathy'}
                      onChange={() => setNewMedType('allopathy')}
                      className="w-4 h-4 text-emerald-500 border-gray-300 dark:border-gray-700 focus:ring-emerald-500"
                    />
                    <span>{t('typeAllopathy')}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-medium select-none">
                    <input
                      type="radio"
                      name="newMedType"
                      value="homeopathy"
                      checked={newMedType === 'homeopathy'}
                      onChange={() => setNewMedType('homeopathy')}
                      className="w-4 h-4 text-emerald-500 border-gray-300 dark:border-gray-700 focus:ring-emerald-500"
                    />
                    <span>{t('typeHomeopathy')}</span>
                  </label>
                </div>
              </div>

              {/* List of Ongoing Medicines to check against */}
              <div className="mt-4 pt-4 border-t border-gray-150 dark:border-gray-800">
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-emerald-500" />
                  {t('ongoingMedsLabel')}
                </h4>
                {loadingOngoingMeds ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                    <span>Loading ongoing medications...</span>
                  </div>
                ) : ongoingMeds.length === 0 ? (
                  <p className="text-sm text-gray-550 dark:text-gray-400 italic">
                    {t('noOngoingMeds')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ongoingMeds.map((med) => (
                      <span
                        key={med.id}
                        className="inline-flex items-center text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full font-medium border border-emerald-100 dark:border-emerald-900/30"
                      >
                        {med.name} {med.dosage && `(${med.dosage})`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                onClick={checkPatientOriented}
                loading={loadingPatientCheck}
                size="lg"
                className="w-full"
                disabled={!newMedName.trim()}
              >
                {t('checkOngoingBtn')}
              </Button>
            </div>
          </Card>

          <AnimatePresence mode="wait">
            {patientCheckResult && (
              <motion.div
                key="patient-result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <Card>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                    {t('summaryLabel')}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    {patientCheckResult.summary}
                  </p>

                  {patientCheckResult.findings.length === 0 ? (
                    <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-emerald-950 dark:text-emerald-400 text-sm">
                          No Interactions Detected
                        </h4>
                        <p className="text-xs text-emerald-800/80 dark:text-emerald-500/85 mt-0.5">
                          It appears safe to take {newMedName} alongside your active medications.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {patientCheckResult.findings.map((f, idx) => (
                        <div
                          key={idx}
                          className={`p-4 border rounded-xl flex gap-3 ${
                            f.severity === 'danger'
                              ? 'bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-900/50'
                              : 'bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50'
                          }`}
                        >
                          {f.severity === 'danger' ? (
                            <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-1">
                            <h4 className="font-bold text-sm text-gray-950 dark:text-white">
                              {f.interaction}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {f.description}
                            </p>
                            {f.recommendation && (
                              <p className="text-xs font-semibold text-emerald-650 dark:text-emerald-400 mt-2 bg-emerald-500/10 dark:bg-emerald-950/30 rounded-lg px-2.5 py-1.5 inline-block">
                                Recommendation: {f.recommendation}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* LLM TODO comment placeholder & disclaimer */}
                  <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500 px-1 mt-4 pt-3 border-t border-gray-150 dark:border-gray-800">
                    <Info className="w-4 h-4 flex-shrink-0 text-emerald-500 mt-0.5" />
                    <div>
                      <span>
                        This check is currently running in simulated offline mode using local logic.
                      </span>
                      <div className="mt-1 font-mono text-[10px] text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-950 p-2 rounded border border-gray-150 dark:border-gray-900">
                        {`// TODO: Integrators - call the LLM agent API (e.g. POST /api/patient/me/medication-safety)`}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
