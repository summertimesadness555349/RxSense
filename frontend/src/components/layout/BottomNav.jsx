import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ScanLine, History, Stethoscope, MoreHorizontal } from 'lucide-react';

const items = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/prescription', icon: ScanLine, label: 'Scan' },
  { to: '/history', icon: History, label: 'Record', center: true },
  { to: '/symptoms', icon: Stethoscope, label: 'Symptoms' },
  { to: '/drugs', icon: MoreHorizontal, label: 'More' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-end justify-around px-2 py-1.5 max-w-xl mx-auto">
        {items.map(({ to, icon: Icon, label, center }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                center
                  ? `${isActive ? 'bg-emerald-500 text-white' : 'bg-emerald-500 text-white'} -mt-4 shadow-lg shadow-emerald-500/30 border-4 border-white dark:border-gray-950`
                  : isActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`
            }
            aria-label={label}
          >
            <Icon className={center ? 'w-6 h-6' : 'w-5 h-5'} />
            <span className={`${center ? 'text-[10px] font-bold' : 'text-[10px]'} leading-tight`}>{label}</span>
          </NavLink>
        ))}
      </div>
      {/* Safe area padding for iOS */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  );
}
