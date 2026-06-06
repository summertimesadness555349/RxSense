import { BarChart3 } from 'lucide-react';
import { getPredictionDisplay } from '../../utils/predictionDisplay.js';

export default function ComplicationsCard({ predictions, overallRisk }) {
  const items = (predictions || []).map(getPredictionDisplay);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <BarChart3 className="w-4 h-4" />
          <span className="text-sm">No predicted complications at this time</span>
        </div>
      </div>
    );
  }

  const grouped = items.reduce((acc, item) => {
    const existing = acc.get(item.title);
    if (!existing || item.confidence > existing.confidence) {
      acc.set(item.title, item);
    }
    return acc;
  }, new Map());

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 p-4 bg-amber-50 dark:bg-amber-900/20">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <BarChart3 className="w-5 h-5 text-amber-700 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
            Possible Future Complications
          </h3>
          {overallRisk && (
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
              {overallRisk}
            </p>
          )}
          <div className="space-y-3">
            {[...grouped.values()].map((item, idx) => {
              const pct = Math.round((item.confidence || 0) * 100);
              return (
                <div key={idx} className="text-sm">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      {item.title}
                    </span>
                    {pct > 0 && (
                      <span className="text-xs text-amber-700 dark:text-amber-300 flex-shrink-0">
                        {pct}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
                    {item.reason}
                  </p>
                  {pct > 0 && (
                    <div className="w-full bg-amber-200 dark:bg-amber-800 rounded-full h-2 overflow-hidden mt-2">
                      <div
                        className="bg-amber-600 dark:bg-amber-500 h-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
