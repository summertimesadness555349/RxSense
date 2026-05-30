import { NavLink } from 'react-router-dom';
import { X, Activity } from 'lucide-react';
import { patientNavItems, doctorNavItems } from './navItems.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Sidebar({ open, onClose }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navItems = user?.role === 'doctor' ? doctorNavItems : patientNavItems;
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer — mobile only overlay */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 w-64 flex flex-col lg:hidden
          bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800
          shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Navigation sidebar"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-lg text-gray-900 dark:text-white">RxSense</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, labelKey, highlight }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/history'}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-colors duration-150
                ${isActive
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{t(labelKey)}</span>
              {highlight && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {t('navCore')}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <p className="text-xs text-gray-400 dark:text-gray-600">{t('navFooter')}</p>
        </div>
      </aside>
    </>
  );
}
