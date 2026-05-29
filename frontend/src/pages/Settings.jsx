import { useState } from 'react';
import { Sun, Moon, Bell, Shield, Download, Trash2 } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useNavigate } from 'react-router-dom';
import DoctorSettings from './DoctorSettings.jsx';

function Toggle({ checked, onChange, label, id }) {
  return (
    <div className="flex items-center justify-between py-2">
      <label htmlFor={id} className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">{label}</label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
      >
        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform m-0.5 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  if (user?.role === 'doctor') {
    return <DoctorSettings />;
  }

  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useLanguage();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState({ reminders: true, reports: true, insights: false });
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '', phone: '+8801712345678' });

  const toggleNotif = (k) => setNotifs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">⚙️ Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Profile</h2>
        <div className="space-y-3">
          <Input label="Full Name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Email" type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
          <Input label="Phone Number" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
          <Button onClick={() => addToast('Profile saved!', 'success')}>Save Changes</Button>
        </div>
      </Card>

      {/* Language */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Language</h2>
        <div className="flex gap-3">
          {[{ val: 'en', label: 'English' }, { val: 'bn', label: 'বাংলা (Bangla)' }].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => { setLang(val); addToast(`Language set to ${label}`, 'info'); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                lang === val
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 text-emerald-700 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Theme */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Appearance</h2>
        <div className="flex gap-3">
          {[
            { val: 'light', Icon: Sun, label: 'Light' },
            { val: 'dark', Icon: Moon, label: 'Dark' },
          ].map(({ val, Icon, label }) => (
            <button
              key={val}
              onClick={() => { if (theme !== val) toggleTheme(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                theme === val
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 text-emerald-700 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Notifications</h2>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <Toggle id="notif-reminders" label="Medication Reminders" checked={notifs.reminders} onChange={() => toggleNotif('reminders')} />
          <Toggle id="notif-reports" label="Report Analysis Alerts" checked={notifs.reports} onChange={() => toggleNotif('reports')} />
          <Toggle id="notif-insights" label="AI Health Insights" checked={notifs.insights} onChange={() => toggleNotif('insights')} />
        </div>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Data & Privacy</h2>
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => addToast('Preparing data export...', 'info')}>
            <Download className="w-4 h-4" /> Download My Data
          </Button>
          <Button variant="danger" className="w-full" onClick={() => addToast('Please contact support to delete your account.', 'warning')}>
            <Trash2 className="w-4 h-4" /> Delete Account
          </Button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Your data is stored securely and never shared without consent. See our Privacy Policy for details.
        </p>
      </Card>

      {/* Logout */}
      <Button
        variant="ghost"
        className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
        onClick={() => { logout(); navigate('/'); }}
      >
        Sign Out
      </Button>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        RxSense v1.0.0 • Infinity AI Buildfest 2026 • Bangladesh
      </p>
    </div>
  );
}
