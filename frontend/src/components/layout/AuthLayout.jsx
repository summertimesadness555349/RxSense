import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Activity } from 'lucide-react';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) {
    const target = user?.role === 'doctor' ? '/doctor/dashboard' : '/dashboard';
    return <Navigate to={target} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/30 to-blue-50/20 dark:from-[#0a0f1a] dark:via-[#0a1a14] dark:to-[#0a0f1a] flex items-stretch">
      {/* Left Panel — decorative */}
      <div className="hidden lg:flex flex-col justify-center items-center w-2/5 bg-gradient-to-br from-emerald-600 to-emerald-800 dark:from-emerald-900 dark:to-gray-950 p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white/30"
              style={{
                width: `${60 + i * 30}px`,
                height: `${60 + i * 30}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center">
          <div className="mb-6 flex justify-center">
            <Activity className="w-16 h-16 text-white/90" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">RxSense</h1>
          <p className="text-emerald-200 text-base leading-relaxed max-w-xs">
            Your lifelong digital health companion. Every prescription, every report — connected and understood.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 text-center">
            {[
              { n: '170M+', l: 'People We Can Help' },
              { n: '94%', l: 'AI Accuracy' },
              { n: '3 sec', l: 'Analysis Time' },
              { n: '2', l: 'Languages' },
            ].map(({ n, l }) => (
              <div key={l} className="bg-white/10 rounded-xl p-3">
                <div className="text-white font-bold text-lg">{n}</div>
                <div className="text-emerald-200 text-xs">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Activity className="w-6 h-6 text-emerald-500" />
            <span className="font-bold text-xl text-gray-900 dark:text-white">RxSense</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
