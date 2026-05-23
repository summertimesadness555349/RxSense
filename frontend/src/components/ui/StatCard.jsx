export default function StatCard({ number, label, icon, color = 'emerald' }) {
  const colors = {
    emerald: 'text-emerald-500',
    blue: 'text-blue-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
  };
  return (
    <div className="flex flex-col items-center text-center p-4">
      {icon && <div className={`text-3xl mb-2 ${colors[color]}`}>{icon}</div>}
      <div className={`text-2xl sm:text-3xl font-bold ${colors[color]}`}>{number}</div>
      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  );
}
