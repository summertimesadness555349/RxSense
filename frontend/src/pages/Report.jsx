import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ChevronDown, ChevronUp, TrendingUp, RotateCcw } from 'lucide-react';
import FileDropzone from '../components/ui/FileDropzone.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import UrgencyBanner from '../components/ui/UrgencyBanner.jsx';
import DisclaimerBanner from '../components/ui/DisclaimerBanner.jsx';
import { Select } from '../components/ui/Input.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { analyzeReport } from '../services/api.js';

const reportTypes = [
  'Complete Blood Count (CBC)',
  'Lipid Panel',
  'Liver Function Test (LFT)',
  'Kidney Function Test (KFT)',
  'HbA1c / Diabetes Panel',
  'Thyroid Panel',
  'Urine Analysis',
  'Other',
];

const statusConfig = {
  normal: { label: '🟢 Normal', cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
  high: { label: '🔴 High', cls: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
  low: { label: '🔴 Low', cls: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
  borderline: { label: '🟡 Borderline', cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
};

const steps = ['Reading document...', 'Parsing values...', 'Comparing with normal ranges...', 'Generating risk assessment...', 'Saving to your health record...'];

export default function Report() {
  const [phase, setPhase] = useState('upload');
  const [reportType, setReportType] = useState('Complete Blood Count (CBC)');
  const [file, setFile] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const { addToast } = useToast();

  const handleUpload = async (f) => {
    setFile(f);
    setPhase('processing');
    try {
      for (let i = 0; i < steps.length; i++) {
        setStepIdx(i);
        await new Promise((r) => setTimeout(r, 350));
      }
      const data = await analyzeReport(f, reportType);
      setResult(data);
      setPhase('result');
      addToast(
        data.autoSaved
          ? 'Report saved to your Health Record. AI will track these values.'
          : 'Report analyzed. Add a patient ID to save it to the Health Record.',
        data.autoSaved ? 'success' : 'info'
      );
    } catch (error) {
      setPhase('upload');
      setFile(null);
      addToast(error.message || 'Could not analyze this report.', 'error');
    }
  };

  const reset = () => { setPhase('upload'); setFile(null); setResult(null); setStepIdx(0); };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">🔬 Medical Report Analyzer</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Upload your blood test, CBC, or any lab report — we'll explain each value.
        </p>
      </div>

      <DisclaimerBanner />

      <AnimatePresence mode="wait">
        {phase === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card>
              <Select
                label="Report Type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="mb-4"
              >
                {reportTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <FileDropzone
                onFileSelect={handleUpload}
                accept="image/png,image/jpeg,image/webp,image/gif,.pdf"
                label="Drag & drop your report (PDF or image) here, or click to browse"
                hint="Supports PDF, JPG, PNG, WEBP, and GIF reports."
              />
            </Card>
          </motion.div>
        )}

        {phase === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="text-center py-10">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mx-auto mb-5" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Analyzing your report...</h3>
              <div className="space-y-2 max-w-xs mx-auto">
                {steps.map((s, i) => (
                  <div key={s} className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg transition-all ${
                    i < stepIdx ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : i === stepIdx ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white animate-pulse'
                    : 'text-gray-400 dark:text-gray-600'
                  }`}>
                    <span className="w-5 flex-shrink-0 text-center">{i < stepIdx ? '✓' : i === stepIdx ? '⋯' : '○'}</span>
                    {s}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {phase === 'result' && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Auto-save */}
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex-1">
                {result.autoSaved
                  ? 'Automatically saved to your Health Record. AI will track these values over time.'
                  : 'Analyzed successfully. Sign in with a patient profile to save this to your Health Record.'}
              </p>
              {result.autoSaved && (
                <Link to="/history" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex-shrink-0">
                  View in Timeline →
                </Link>
              )}
            </div>

            {/* Urgency */}
            <UrgencyBanner level={result.urgencyLevel} message={result.urgencyMessage} />

            {/* Report summary */}
            <Card>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-1">
                Blood Test Report — Analyzed on {result.date}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{result.type} • {result.lab}</p>
            </Card>

            {/* Values table */}
            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Test Results</h3>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[450px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {['Parameter', 'Your Value', 'Normal Range', 'Status', 'Trend'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 pr-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {result.values.map((v) => (
                      <tr key={v.id}>
                        <td className="py-2.5 pr-3 font-medium text-gray-900 dark:text-white text-xs">{v.parameter}</td>
                        <td className="py-2.5 pr-3 font-bold text-gray-900 dark:text-white">{v.value}</td>
                        <td className="py-2.5 pr-3 text-gray-500 dark:text-gray-400 text-xs">{v.normalRange}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusConfig[v.status]?.cls}`}>
                            {statusConfig[v.status]?.label}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {v.trend.length >= 2 && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              {v.trend.join(' → ')}
                              <TrendingUp className={`w-3 h-3 ${v.status === 'high' ? 'text-red-500' : 'text-emerald-500'}`} />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Risk Assessment */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Risk Assessment</h3>
              {result.risks.map((r, i) => (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
                  r.level === 'high' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                  : r.level === 'moderate' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                  : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                }`}>
                  <span className="text-lg flex-shrink-0">
                    {r.level === 'high' ? '⚠️' : r.level === 'moderate' ? '⚠️' : 'ℹ️'}
                  </span>
                  <div>
                    <p className={`font-semibold mb-0.5 ${r.level === 'high' ? 'text-red-700 dark:text-red-400' : r.level === 'moderate' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
                      {r.level.toUpperCase()} RISK — {r.condition}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Recommendations</h3>
              <ol className="space-y-1.5">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-emerald-500 font-bold flex-shrink-0">{i + 1}.</span> {r}
                  </li>
                ))}
              </ol>
            </Card>

            {/* Plain Language Summary (collapsible) */}
            <Card hover={false}>
              <button
                onClick={() => setSummaryOpen((p) => !p)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-white"
              >
                <span>Plain Language Summary</span>
                {summaryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {summaryOpen && (
                <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {result.plainSummary}
                </p>
              )}
            </Card>

            {/* Trend Chart Placeholder */}
            <Card hover={false}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Historical Trend</h3>
              </div>
              <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 mb-3">
                Values from previous reports will appear here
              </div>
              <div className="space-y-2">
                {result.values.filter(v => v.trend.length >= 2).map((v) => (
                  <div key={v.id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">{v.parameter}:</span>
                    <span className="text-gray-600 dark:text-gray-300">{v.trend.join(' → ')}</span>
                    <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                  </div>
                ))}
              </div>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => addToast('Saved!', 'success')}>Save to History</Button>
              <Button variant="secondary" onClick={() => addToast('Sharing...', 'info')}>Share with Doctor</Button>
              <Button variant="ghost" onClick={reset}>
                <RotateCcw className="w-4 h-4" /> Analyze Another
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
