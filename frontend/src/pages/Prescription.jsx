import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Download, Share2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import FileDropzone from '../components/ui/FileDropzone.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import UrgencyBanner from '../components/ui/UrgencyBanner.jsx';
import DisclaimerBanner from '../components/ui/DisclaimerBanner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { analyzePrescription } from '../services/api.js';
import { mockPrescriptionResult } from '../data/mockPrescriptions.js';

const steps = ['Reading handwriting...', 'Identifying medications...', 'Generating explanation...', 'Saving to your health record...'];

export default function Prescription() {
  const [phase, setPhase] = useState('upload'); // upload | processing | result
  const [file, setFile] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [banglaOpen, setBanglaOpen] = useState(false);
  const { addToast } = useToast();

  const handleUpload = async (f) => {
    setFile(f);
    setPhase('processing');
    setStepIdx(0);

    // Simulate step-by-step processing
    for (let i = 0; i < steps.length; i++) {
      setStepIdx(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    // TODO: Replace with actual API call
    const data = await analyzePrescription(f);
    setResult(data);
    setPhase('result');
    addToast('✓ Prescription saved to your Health Record!', 'success');
  };

  const reset = () => { setPhase('upload'); setFile(null); setResult(null); setStepIdx(0); };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">📋 Prescription Reader</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Upload a photo of any prescription — we'll explain it in plain language.
        </p>
      </div>

      <DisclaimerBanner />

      <AnimatePresence mode="wait">
        {phase === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <FileDropzone
                onFileSelect={handleUpload}
                accept="image/*"
                label="Drag & drop your prescription image here, or click to browse"
                hint="Supports JPG, PNG, HEIC. We can read handwritten prescriptions."
                showCamera
              />
            </Card>
          </motion.div>
        )}

        {phase === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="text-center py-10">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto mb-5" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Analyzing your prescription...</h3>
              <div className="space-y-2 max-w-xs mx-auto">
                {steps.map((s, i) => (
                  <div key={s} className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg transition-all ${
                    i < stepIdx ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : i === stepIdx ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white animate-pulse'
                    : 'text-gray-400 dark:text-gray-600'
                  }`}>
                    <span className="w-5 flex-shrink-0 text-center">
                      {i < stepIdx ? '✓' : i === stepIdx ? '⋯' : '○'}
                    </span>
                    {s}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {phase === 'result' && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Auto-save confirmation */}
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  ✓ Automatically saved to your Health Record
                </p>
              </div>
              <Link to="/history" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                View in Timeline →
              </Link>
            </div>

            {/* Confidence + Image preview */}
            <Card>
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0 text-xs text-gray-400 text-center">
                  📋<br />Prescription<br />Image
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="font-semibold text-gray-900 dark:text-white">Prescription Analysis</h2>
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                      AI Confidence: {result.confidence}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{result.date} • {result.doctor}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{result.hospital}</p>
                </div>
              </div>
            </Card>

            {/* Diseases */}
            {result.diseases?.length > 0 && (
              <Card>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Diagnosis / Conditions</h3>
                <div className="flex flex-wrap gap-2">
                  {result.diseases.map((d, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                      {d}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Required Tests */}
            {result.tests?.length > 0 && (
              <Card>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Required Tests</h3>
                <div className="flex flex-wrap gap-2">
                  {result.tests.map((t, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                      {t}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Medications */}
            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Prescribed Medications</h3>
              {result.medications.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No medications detected.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {result.medications.map((med) => (
                    <span key={med.id} className="px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                      {med.name}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Plain Language Explanation */}
            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Plain Language Explanation</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{result.explanation}</p>
            </Card>

            {/* Warnings */}
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <div key={i} className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border ${
                  w.type === 'danger'
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                    : w.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                }`}>
                  <span>⚠️</span> {w.message}
                </div>
              ))}
            </div>

            {/* Bangla Translation Panel */}
            <Card hover={false}>
              <button
                onClick={() => setBanglaOpen((p) => !p)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-white"
              >
                <span>বাংলা অনুবাদ (Bangla Translation)</span>
                {banglaOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {banglaOpen && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-400">
                  [Bangla translation placeholder — আপনার ডাক্তার একটি অ্যান্টিবায়োটিক (অ্যামোক্সিসিলিন) দিয়েছেন সংক্রমণের চিকিৎসার জন্য।]
                </div>
              )}
            </Card>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => addToast('Saved to history!', 'success')}>Save to History</Button>
              <Button variant="secondary" onClick={() => addToast('Share link copied!', 'info')}>
                <Share2 className="w-4 h-4" /> Share with Doctor
              </Button>
              <Button variant="outline" onClick={() => addToast('Generating PDF...', 'info')}>
                <Download className="w-4 h-4" /> Download PDF
              </Button>
              <Button variant="ghost" onClick={reset}>
                <RotateCcw className="w-4 h-4" /> Scan Another
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
