import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const config = {
  high: {
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
    text: 'text-red-800 dark:text-red-300',
    Icon: AlertTriangle,
    label: 'HIGH',
  },
  moderate: {
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700',
    text: 'text-amber-800 dark:text-amber-300',
    Icon: AlertCircle,
    label: 'MODERATE',
  },
  low: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700',
    text: 'text-emerald-800 dark:text-emerald-300',
    Icon: Info,
    label: 'LOW',
  },
};

export default function UrgencyBanner({ level = 'moderate', message }) {
  const c = config[level] || config.moderate;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${c.bg}`} role="alert">
      <c.Icon className={`w-5 h-5 flex-shrink-0 ${c.text}`} />
      <div className={c.text}>
        <span className="font-bold">URGENCY: {c.label}</span>
        {message && <span className="ml-2 font-normal">— {message}</span>}
      </div>
    </div>
  );
}
