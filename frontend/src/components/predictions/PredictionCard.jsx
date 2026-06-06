import { AlertTriangle, TrendingUp, Heart } from 'lucide-react';
import { getPredictionDisplay } from '../../utils/predictionDisplay.js';

export default function PredictionCard({ prediction, compact = false }) {
  const display = getPredictionDisplay(prediction);
  const severityColors = {
    low: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    moderate: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    high: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
  };

  const getSeverityIcon = (severity) => {
    if (severity === 'critical' || severity === 'high') {
      return <AlertTriangle className="w-5 h-5" />;
    }
    if (severity === 'moderate') {
      return <TrendingUp className="w-5 h-5" />;
    }
    return <Heart className="w-5 h-5" />;
  };

  const colorClass = severityColors[display.severity] || severityColors.moderate;
  const displayConfidence = Math.round((display.confidence || 0) * 100);

  if (compact) {
    return (
      <div className={`rounded-lg border p-3 ${colorClass}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getSeverityIcon(display.severity)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">
              {display.title}
            </h4>
            <p className="text-xs mt-1 opacity-90">
              {display.reason}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="px-2 py-1 bg-white/30 dark:bg-black/20 rounded">
                {display.severityLabel} risk
              </span>
              {displayConfidence > 0 && (
                <span className="px-2 py-1 bg-white/30 dark:bg-black/20 rounded">
                  {displayConfidence}% confidence
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {getSeverityIcon(display.severity)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-base">
            {display.title}
          </h3>
          <p className="text-sm mt-2 opacity-95">
            {display.reason}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="px-3 py-1.5 bg-white/40 dark:bg-black/20 rounded-md text-sm font-medium">
              {display.severityLabel} risk
            </div>
            {displayConfidence > 0 && (
              <div className="px-3 py-1.5 bg-white/40 dark:bg-black/20 rounded-md text-sm font-medium">
                {displayConfidence}% confidence
              </div>
            )}
          </div>
          {display.action && (
            <p className="text-xs mt-3 opacity-85">{display.action}</p>
          )}
          {prediction.predicted_date && (
            <p className="text-xs mt-3 opacity-80">
              Review around: {new Date(prediction.predicted_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
