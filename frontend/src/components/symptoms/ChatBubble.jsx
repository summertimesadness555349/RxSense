import Badge from '../ui/Badge.jsx';

function ConfidenceBar({ pct }) {
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-gray-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function ChatBubble({ message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-emerald-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.type === 'text') {
    return (
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 text-sm">⚕️</div>
        <div className="max-w-[85%] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          {message.content}
        </div>
      </div>
    );
  }

  // AI analysis card
  return (
    <div className="flex gap-2">
      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 text-sm">⚕️</div>
      <div className="flex-1 max-w-[90%] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-sm p-4 space-y-4">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{message.content}</p>

        {/* Possible conditions */}
        {message.possibleConditions && (
          <div className="space-y-2">
            {message.possibleConditions.map((c, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{c.name}</span>
                  <Badge variant={c.match >= 70 ? 'emerald' : c.match >= 50 ? 'amber' : 'gray'} className="text-xs">
                    {c.match}% match
                  </Badge>
                </div>
                <ConfidenceBar pct={c.match} />
                <p className="text-xs text-gray-500 dark:text-gray-400">{c.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Urgency */}
        {message.urgency && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold
            ${message.urgency === 'high' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              : message.urgency === 'moderate' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'}`}>
            {message.urgency === 'high' ? '🔴' : message.urgency === 'moderate' ? '🟡' : '🟢'}
            {message.urgency.toUpperCase()} — {message.urgencyMessage}
          </div>
        )}

        {/* Recommendations */}
        {message.recommendations && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Recommended Actions</p>
            <ul className="space-y-1">
              {message.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-emerald-500 flex-shrink-0 mt-0.5">✓</span> {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* See a doctor if */}
        {message.seeDoctorIf && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-1.5">⚠️ See a Doctor Immediately If...</p>
            <ul className="space-y-0.5">
              {message.seeDoctorIf.map((s, i) => (
                <li key={i} className="text-xs text-red-600 dark:text-red-400">• {s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
