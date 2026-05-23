export default function HealthScoreGauge({ score, max = 100, size = 'md' }) {
  const pct = score / max;
  const radius = size === 'lg' ? 54 : size === 'sm' ? 30 : 42;
  const stroke = size === 'lg' ? 10 : size === 'sm' ? 7 : 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - pct * circumference;
  const dim = (radius + stroke) * 2;

  const color =
    score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  const textSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-2xl';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className="text-gray-200 dark:text-gray-800"
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textSize} font-bold`} style={{ color }}>
          {score}
        </span>
        {size !== 'sm' && <span className="text-xs text-gray-500 dark:text-gray-400">/{max}</span>}
      </div>
    </div>
  );
}
