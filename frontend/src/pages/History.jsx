import { NavLink, Outlet } from 'react-router-dom';
import { Clock, User, FolderOpen, Pill, Users, FolderHeart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

const TAB_DEFS = [
  { to: '/history',             labelKey: 'tabTimeline',      icon: Clock,      end: true },
  { to: '/history/profile',     labelKey: 'tabHealthProfile', icon: User },
  { to: '/history/documents',   labelKey: 'tabDocuments',     icon: FolderOpen },
  { to: '/history/medications', labelKey: 'tabMedications',   icon: Pill },
  { to: '/history/family',      labelKey: 'tabFamily',        icon: Users },
];

export default function History() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FolderHeart className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          {t('historyTitle')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {t('historySubtitle')}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
        <div className="flex gap-1 min-w-max border-b border-gray-200 dark:border-gray-800 pb-0">
          {TAB_DEFS.map(({ to, labelKey, icon: Icon, end }) => (
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
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Sub-page content */}
      <Outlet />
    </div>
  );
}
