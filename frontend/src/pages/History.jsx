import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Clock, User, FolderOpen, Pill, Brain, Users } from 'lucide-react';

const tabs = [
  { to: '/history', label: 'Timeline', icon: Clock, end: true },
  { to: '/history/profile', label: 'Health Profile', icon: User },
  { to: '/history/documents', label: 'Documents', icon: FolderOpen },
  { to: '/history/medications', label: 'Medications', icon: Pill },
  { to: '/history/insights', label: 'AI Insights', icon: Brain },
  { to: '/history/family', label: 'Family', icon: Users },
];

export default function History() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">📁 Smart Health Record</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Your complete health history — every scan, visit, and insight in one place.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
        <div className="flex gap-1 min-w-max border-b border-gray-200 dark:border-gray-800 pb-0">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `
                flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors -mb-px
                ${isActive
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:block">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Sub-page content */}
      <Outlet />
    </div>
  );
}
