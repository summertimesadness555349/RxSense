import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const severityConfig = {
  safe: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/10',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
    title: 'text-emerald-800 dark:text-emerald-300',
    body: 'text-emerald-700 dark:text-emerald-400',
    label: 'Safe',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    title: 'text-amber-800 dark:text-amber-300',
    body: 'text-amber-700 dark:text-amber-400',
    label: 'Moderate',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-red-200 dark:border-red-800',
    icon: XCircle,
    iconColor: 'text-red-500',
    title: 'text-red-800 dark:text-red-300',
    body: 'text-red-700 dark:text-red-400',
    label: 'Severe',
  },
};

export default function InteractionCard({ interaction }) {
  const c = severityConfig[interaction.severity] || severityConfig.safe;
  const Icon = c.icon;

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${c.iconColor}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className={`font-semibold text-sm ${c.title}`}>{interaction.title}</h4>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              interaction.severity === 'safe' ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200'
              : interaction.severity === 'warning' ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
              : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
            }`}>{c.label}</span>
            {interaction.isExample && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">Example</span>
            )}
          </div>
          <p className={`text-sm ${c.body}`}>{interaction.description}</p>
          {interaction.recommendation && (
            <p className={`text-xs font-medium mt-2 ${c.title}`}>💡 {interaction.recommendation}</p>
          )}
        </div>
      </div>
    </div>
  );
}
