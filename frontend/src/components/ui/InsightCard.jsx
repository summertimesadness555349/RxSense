const typeConfig = {
  danger: {
    border: 'border-red-200 dark:border-red-800',
    bg: 'bg-red-50 dark:bg-red-900/10',
    icon: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    title: 'text-red-800 dark:text-red-300',
    body: 'text-red-700 dark:text-red-400',
  },
  warning: {
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    icon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    title: 'text-amber-800 dark:text-amber-300',
    body: 'text-amber-700 dark:text-amber-400',
  },
  success: {
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50 dark:bg-emerald-900/10',
    icon: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    title: 'text-emerald-800 dark:text-emerald-300',
    body: 'text-emerald-700 dark:text-emerald-400',
  },
  info: {
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    icon: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    title: 'text-blue-800 dark:text-blue-300',
    body: 'text-blue-700 dark:text-blue-400',
  },
};

export default function InsightCard({ type = 'info', icon, title, body, action, children }) {
  const c = typeConfig[type] || typeConfig.info;
  return (
    <div className={`rounded-xl border p-4 ${c.border} ${c.bg}`}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ${c.icon}`}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && <h4 className={`font-semibold text-sm mb-1 ${c.title}`}>{title}</h4>}
          {body && <p className={`text-sm leading-relaxed ${c.body}`}>{body}</p>}
          {action && (
            <p className={`text-xs font-medium mt-2 ${c.title}`}>
              → {action}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
