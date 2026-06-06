import { BarChart3, Users } from 'lucide-react';

export default function ComplicationsCard({ predictions, overallRisk, cohortSize }) {
  if (!predictions || predictions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <BarChart3 className="w-4 h-4" />
          <span className="text-sm">No predicted complications at this time</span>
        </div>
      </div>
    );
  }

  const complications = [...new Set(predictions.map(p => p.predicted_value))];
  const highRiskPredictions = predictions.filter(p => p.severity_level === 'high' || p.severity_level === 'critical');

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 p-4 bg-amber-50 dark:bg-amber-900/20">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <BarChart3 className="w-5 h-5 text-amber-700 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
            Possible Future Complications
          </h3>
          <div className="space-y-2">
            {complications.map((comp, idx) => {
              const matchingPreds = predictions.filter(p => p.predicted_value === comp);
              const avgConfidence = matchingPreds.reduce((sum, p) => sum + p.confidence, 0) / matchingPreds.length;
              const maxSeverity = Math.max(...matchingPreds.map(p => {
                const severityMap = { low: 1, moderate: 2, high: 3, critical: 4 };
                return severityMap[p.severity_level] || 0;
              }));
              const severityLabel = ['', 'Low', 'Moderate', 'High', 'Critical'][maxSeverity];

              return (
                <div key={idx} className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      {comp}
                    </span>
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      {Math.round(avgConfidence * 100)}% likely
                    </span>
                  </div>
                  <div className="w-full bg-amber-200 dark:bg-amber-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-600 dark:bg-amber-500 h-full transition-all"
                      style={{ width: `${Math.round(avgConfidence * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {cohortSize > 0 && (
            <div className="flex items-center gap-1 mt-3 text-xs text-amber-700 dark:text-amber-300">
              <Users className="w-3.5 h-3.5" />
              <span>Based on analysis of {cohortSize} similar patients</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
