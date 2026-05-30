import { useState } from 'react';
import { Plus, Info, Pill } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DrugInputRow from '../components/drugs/DrugInputRow.jsx';
import InteractionCard from '../components/drugs/InteractionCard.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import DisclaimerBanner from '../components/ui/DisclaimerBanner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { checkDrugInteractions } from '../services/api.js';

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

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Pill className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          {t('drugsPageTitle')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {t('drugsPageSubtitle')}
        </p>
      </div>

      <DisclaimerBanner message={t('drugsDisclaimer')} />

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

      <AnimatePresence>
        {result && (
          <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
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
    </div>
  );
}
