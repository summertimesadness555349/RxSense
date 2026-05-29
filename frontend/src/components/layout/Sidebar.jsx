import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, FlaskConical, History,
  Stethoscope, Pill, MapPin, Settings, X,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/prescription', icon: FileText,      label: 'Prescription Reader' },
  { to: '/report',     icon: FlaskConical,    label: 'Report Analyzer' },
  { to: '/history',    icon: History,         label: 'Health Record', highlight: true },
  { to: '/symptoms',   icon: Stethoscope,     label: 'Symptom Checker' },
  { to: '/drugs',      icon: Pill,            label: 'Drug Interactions' },
  { to: '/near-me',    icon: MapPin,          label: 'Doctors Near Me' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Backdrop — always covers full screen, blurs content behind */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel — always fixed overlay, full height, never takes layout space */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 w-64 flex flex-col
          bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800
          shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Navigation sidebar"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚕️</span>
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

        {/* Nav — fills remaining height, scrollable if needed */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, highlight }) => (
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
              <span className="flex-1">{label}</span>
              {highlight && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  Core
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <p className="text-xs text-gray-400 dark:text-gray-600">RxSense v1.0 • Infinity AI 2026</p>
        </div>
      </aside>
    </>
  );
}
