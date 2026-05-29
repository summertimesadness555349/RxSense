import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';

export default function MainLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Pages that fill all available height (inner sections manage their own scroll)
  const isFullHeightPage = ['/symptoms', '/prescription', '/report'].includes(location.pathname);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-10 h-10 text-emerald-500 animate-pulse" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading RxSense...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#0a0f1a] overflow-hidden">
      {/* Navbar: single row on mobile, two rows (brand + nav) on desktop */}
      <Navbar onMenuToggle={() => setSidebarOpen(true)} />

      {/* Sidebar: mobile-only drawer (lg:hidden inside Sidebar) */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {isFullHeightPage ? (
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden p-4 pb-20 lg:pb-4">
          <Outlet />
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto">
          <div className="w-4/5 mx-auto p-4 pb-24 lg:pb-8">
            <Outlet />
          </div>
        </main>
      )}

      {/* Bottom tab bar: mobile only */}
      <BottomNav />
    </div>
  );
}
