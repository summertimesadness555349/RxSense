import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge.jsx';

const typeConfig = {
  report: { icon: '🔬', color: 'border-blue-400', badge: 'blue', label: 'Report' },
  prescription: { icon: '📋', color: 'border-emerald-400', badge: 'emerald', label: 'Prescription' },
  symptom: { icon: '🩺', color: 'border-amber-400', badge: 'amber', label: 'Symptom Check' },
  visit: { icon: '🏥', color: 'border-purple-400', badge: 'purple', label: 'Doctor Visit' },
  note: { icon: '📝', color: 'border-gray-400', badge: 'gray', label: 'Personal Note' },
  medication: { icon: '💊', color: 'border-pink-400', badge: 'gray', label: 'Medication Change' },
  vaccination: { icon: '💉', color: 'border-teal-400', badge: 'emerald', label: 'Vaccination' },
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function TimelineEntry({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = typeConfig[entry.type] || typeConfig.note;

  return (
    <div className="flex gap-4">
      {/* Left border strip */}
      <div className="flex flex-col items-center">
        <div className={`w-1 flex-1 border-l-2 ${cfg.color}`} />
        <div className="text-lg leading-none my-1">{cfg.icon}</div>
        <div className={`w-1 flex-1 border-l-2 ${cfg.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-5">
        <div
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors"
          onClick={() => setExpanded((p) => !p)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setExpanded((p) => !p)}
          aria-expanded={expanded}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant={cfg.badge}>{cfg.label}</Badge>
                {entry.urgency === 'high' && <Badge variant="red">Urgent</Badge>}
                {entry.urgency === 'moderate' && <Badge variant="amber">Moderate</Badge>}
                {entry.aiInsight && <Badge variant="blue">⚡ AI Insight</Badge>}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{entry.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(entry.date)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">{entry.summary}</p>
            </div>
            <div className="flex-shrink-0 text-gray-400">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {expanded && entry.details && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
              {Object.entries(entry.details).map(([key, val]) => {
                if (!val) return null;
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                return (
                  <div key={key} className="flex gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400 flex-shrink-0 font-medium min-w-[100px]">{label}:</span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {Array.isArray(val) ? val.join(', ') : String(val)}
                    </span>
                  </div>
                );
              })}
              {entry.aiInsight && (
                <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-800 dark:text-blue-300 font-medium flex items-start gap-1.5">
                  <span>⚡</span> {entry.aiInsight}
                </div>
              )}
              {entry.linkedId && (
                <Link
                  to={entry.type === 'prescription' ? '/prescription' : '/report'}
                  className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Full Analysis <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
