import { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, CheckCircle } from 'lucide-react';
import HealthScoreGauge from '../components/ui/HealthScoreGauge.jsx';
import InsightCard from '../components/ui/InsightCard.jsx';
import RiskBar from '../components/ui/RiskBar.jsx';
import DisclaimerBanner from '../components/ui/DisclaimerBanner.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import {
  mockHealthScore,
  mockTrendAlerts,
  mockRiskBreakdown,
  mockRecommendedActions,
  mockDoctorSummary,
} from '../data/mockInsights.js';
import { useToast } from '../context/ToastContext.jsx';

export default function HistoryInsights() {
  const [showSummary, setShowSummary] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const { addToast } = useToast();

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    await new Promise((r) => setTimeout(r, 2000));
    // TODO: Replace with actual API call
    setGeneratingSummary(false);
    setShowSummary(true);
    addToast('Doctor summary generated!', 'success');
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Health Score */}
      <Card className="text-center">
        <div className="flex flex-col items-center gap-3">
          <HealthScoreGauge score={mockHealthScore.score} size="lg" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Overall Health Score</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Based on {mockHealthScore.dataPoints} data points across {mockHealthScore.periodMonths} months
            </p>
          </div>
        </div>
      </Card>

      {/* Trend Alerts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">AI Trend Alerts</h2>
        </div>
        <div className="space-y-3">
          {mockTrendAlerts.map((alert, i) => (
            <motion.div key={alert.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
              <InsightCard type={alert.type} icon={alert.icon} title={alert.title} body={alert.body} action={alert.action}>
                {alert.trendValues.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    {alert.trendValues.map((t, j) => (
                      <span key={j} className="flex items-center gap-1">
                        <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded font-medium">{t.value}</span>
                        {j < alert.trendValues.length - 1 && <span>→</span>}
                      </span>
                    ))}
                  </div>
                )}
              </InsightCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Risk Breakdown */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Risk Breakdown</h2>
        <div className="space-y-4">
          {mockRiskBreakdown.map((r) => (
            <RiskBar key={r.label} label={r.label} percentage={r.percentage} color={r.color} level={r.level} />
          ))}
        </div>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Recommended Actions</h2>
        <div className="space-y-2">
          {mockRecommendedActions.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${a.priority === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
              <div className="flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-200">{a.action}</p>
                {a.dueDate && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Due: {a.dueDate}</p>}
              </div>
              <button onClick={() => addToast('Reminder set!', 'success')} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex-shrink-0">
                Remind
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Generate Doctor Summary */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Health Summary for Doctor</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Generate a 1-page AI summary of your health history to share with a new doctor.
            </p>
          </div>
        </div>
        <Button
          className="mt-4 w-full"
          variant="secondary"
          loading={generatingSummary}
          onClick={handleGenerateSummary}
        >
          Generate Doctor Summary
        </Button>

        {showSummary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3 text-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle className="w-4 h-4" /> Summary Generated — {mockDoctorSummary.generatedDate}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Patient', value: `${mockDoctorSummary.patientName}, ${mockDoctorSummary.age}y, ${mockDoctorSummary.bloodGroup}` },
                { label: 'Critical Allergies', value: mockDoctorSummary.criticalAllergies.join(', ') },
                { label: 'Active Conditions', value: mockDoctorSummary.activeConditions.join('; ') },
                { label: 'Current Medications', value: mockDoctorSummary.currentMedications.join('; ') },
              ].map(({ label, value }) => (
                <div key={label} className="col-span-2 sm:col-span-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-gray-800 dark:text-gray-200">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Key Insights</p>
              <p className="text-gray-800 dark:text-gray-200">{mockDoctorSummary.keyInsights}</p>
            </div>
            <Button size="sm" onClick={() => addToast('Summary shared!', 'success')}>Share with Doctor</Button>
          </motion.div>
        )}
      </Card>

      <DisclaimerBanner message="These insights are AI-generated based on your uploaded data. They are not diagnoses. Always consult a healthcare professional." />
    </div>
  );
}
