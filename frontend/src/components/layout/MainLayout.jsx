import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';

export default function MainLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Pages that should fill all available height (no page-level scroll — inner sections scroll)
  const isFullHeightPage = location.pathname === '/symptoms';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-pulse-slow">⚕️</span>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading RxSense...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    // Sidebar is always an overlay — never in the flex row, never takes layout space
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#0a0f1a] overflow-hidden">
      <Navbar onMenuToggle={() => setSidebarOpen(true)} />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {isFullHeightPage ? (
        // Full-height layout: main fills remaining space, no page-scroll, content manages own scroll
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden p-4 pb-20 lg:pb-4">
          <Outlet />
        </main>
      ) : (
        // Normal scrollable layout: content can be any height, page scrolls
        <main className="flex-1 overflow-y-auto">
          <div className="w-4/5 mx-auto p-4 pb-24 lg:pb-8">
            <Outlet />
          </div>
        </main>
      )}

      <BottomNav />
    </div>
  );
}
