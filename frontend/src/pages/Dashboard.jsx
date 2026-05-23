import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import HealthScoreGauge from '../components/ui/HealthScoreGauge.jsx';
import EmergencyCard from '../components/history/EmergencyCard.jsx';
import { mockUser } from '../data/mockUser.js';

const recentActivity = [
  { icon: '🔬', title: 'Blood test analyzed — 2 abnormal values', time: '2 hours ago', to: '/report' },
  { icon: '📋', title: 'Prescription scanned — 3 medications', time: 'Yesterday', to: '/prescription' },
  { icon: '🏥', title: 'Doctor visit logged — Dr. Karim', time: '3 days ago', to: '/history' },
  { icon: '📝', title: "Personal note — 'Felt dizzy after walk'", time: '5 days ago', to: '/history' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t(`Welcome back, ${user?.name?.split(' ')[0] || 'Rahim'} 👋`)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("Here's your health summary for today.")}
        </p>
      </motion.div>

      {/* AI Alert Banner */}
      <Link to="/history/insights">
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex-1">
            {t('⚠️ Your HbA1c has risen for 3 consecutive tests. Tap to view trend.')}
          </p>
          <ChevronRight className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        </div>
      </Link>

      {/* Health Overview Strip */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          {t('Health Overview')}
        </h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <HealthScoreGauge score={68} size="sm" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Health Score</p>
              <p className="text-sm font-bold text-amber-500">Moderate</p>
            </div>
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
              <p className="text-xs text-gray-500 dark:text-gray-400">Active Conditions</p>
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                  Type 2 Diabetes
                </span>
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                  Mild Anemia
                </span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
              <p className="text-xs text-gray-500 dark:text-gray-400">Medications</p>
              <p className="font-semibold text-gray-900 dark:text-white">2 active</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Metformin, Iron Supp.</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
              <p className="text-xs text-gray-500 dark:text-gray-400">Next Action</p>
              <p className="font-medium text-gray-900 dark:text-white text-xs">Repeat HbA1c</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Due Aug 2026</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('Recent Activity')}</h2>
            <Link to="/history" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
              View Full Timeline →
            </Link>
          </div>
          <div className="space-y-2">
            {recentActivity.map(({ icon, title, time, to }, i) => (
              <Link
                key={i}
                to={to}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{t(title)}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Clock className="w-3 h-3" /> {time}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Risk Summary */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('Risk Summary')}</h2>
            <Link to="/history/insights" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
              View Insights →
            </Link>
          </div>
          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Current Risk Level</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">⚠️ Moderate</p>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Diabetes', risk: 'High', color: 'text-red-500', bg: 'bg-red-500', pct: 82 },
              { label: 'Cardiovascular', risk: 'Moderate', color: 'text-amber-500', bg: 'bg-amber-500', pct: 45 },
              { label: 'Anemia', risk: 'Improving', color: 'text-blue-500', bg: 'bg-blue-500', pct: 38 },
            ].map(({ label, risk, color, bg, pct }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-gray-600 dark:text-gray-400 flex-shrink-0">{label}</span>
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-xs font-semibold w-20 text-right ${color}`}>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Medication Reminders */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('Medication Reminders')}</h2>
            <Link to="/history/medications" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
              Manage →
            </Link>
          </div>
          <div className="space-y-2">
            {[
              { med: 'Metformin 500mg', time: '8:00 PM', urgent: true },
              { med: 'Iron Supplement', time: 'Tomorrow morning', urgent: false },
            ].map(({ med, time, urgent }, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-2.5 rounded-xl ${
                  urgent
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}
              >
                <span className="text-lg">💊</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{med}</p>
                  <p className="text-xs text-gray-500">{time}</p>
                </div>
                {urgent && (
                  <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-medium">
                    Today
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Card Preview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('Emergency Card')}</h2>
            <Link to="/history/profile" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
              View Full →
            </Link>
          </div>
          <EmergencyCard user={mockUser} compact />
        </div>
      </div>
    </div>
  );
}
