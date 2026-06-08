import { CheckCircle, AlertTriangle, XCircle, Zap, Database, Globe, BookOpen } from 'lucide-react';

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

const sourceConfig = {
  local_db:   { icon: Database, label: 'Local DB',  color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
  rxnorm:     { icon: BookOpen, label: 'RxNorm',    color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' },
  medscape:   { icon: BookOpen, label: 'Medscape',  color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800' },
  web_search: { icon: Globe,    label: 'Web',       color: 'text-gray-500 bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700' },
  ai:         { icon: Zap,      label: 'AI',        color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
};

export default function InteractionCard({ interaction }) {
  const c      = severityConfig[interaction.severity] || severityConfig.warning;
  const Icon   = c.icon;
  const src    = sourceConfig[interaction.source] || sourceConfig.ai;
  const SrcIcon = src.icon;

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${c.iconColor}`} />
        <div className="flex-1 space-y-1.5">

          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-semibold text-sm ${c.title}`}>{interaction.title}</h4>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              interaction.severity === 'safe'    ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200' :
              interaction.severity === 'warning' ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' :
                                                   'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
            }`}>{c.label}</span>
            {interaction.source && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${src.color}`}>
                <SrcIcon className="w-2.5 h-2.5" />
                {src.label}
              </span>
            )}
          </div>

          {/* Description */}
          <p className={`text-sm ${c.body}`}>{interaction.description}</p>

          {/* Mechanism */}
          {interaction.mechanism && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              <span className="font-semibold not-italic text-gray-600 dark:text-gray-300">Mechanism: </span>
              {interaction.mechanism}
            </p>
          )}

          {/* Clinical action */}
          {interaction.clinical_action && (
            <div className="mt-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white/60 dark:bg-black/20 border border-current/10 text-gray-700 dark:text-gray-300">
              <span className="font-bold">Action: </span>{interaction.clinical_action}
            </div>
          )}

          {/* Legacy recommendation */}
          {!interaction.clinical_action && interaction.recommendation && (
            <p className={`text-xs font-medium mt-1 ${c.title}`}>💡 {interaction.recommendation}</p>
          )}
        </div>
      </div>
    </div>
  );
}
