export default function RiskBadge({ level, size = 'sm' }) {
  const config = {
    high: { label: 'High Risk', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    moderate: { label: 'Moderate', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    low: { label: 'Low Risk', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    improving: { label: 'Improving', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  };
  const c = config[level] || config.low;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${size === 'sm' ? 'text-xs' : 'text-sm'} ${c.cls}`}>
      {c.label}
    </span>
  );
}
