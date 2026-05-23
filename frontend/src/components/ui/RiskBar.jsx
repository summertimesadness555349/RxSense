export default function RiskBar({ label, percentage, color = '#f59e0b', level }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <div className="flex items-center gap-2">
          {level && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{level}</span>
          )}
          <span className="font-semibold" style={{ color }}>{percentage}%</span>
        </div>
      </div>
      <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
