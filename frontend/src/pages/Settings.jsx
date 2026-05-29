import { useState } from 'react';
import { Sun, Moon, Download, Trash2, Settings as SettingsIcon, Globe, Bell } from 'lucide-react';
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
  const { lang, setLang, t } = useLanguage();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState({ reminders: true, reports: true, insights: false });
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '', phone: '+8801712345678' });

  const toggleNotif = (k) => setNotifs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          {t('settingsTitle')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('settingsSubtitle')}</p>
      </div>

      {/* Profile */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">{t('sectionProfile')}</h2>
        <div className="space-y-3">
          <Input label={t('fieldFullName')} value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
          <Input label={t('fieldEmail')} type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
          <Input label={t('fieldPhone')} value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
          <Button onClick={() => addToast(t('profileSaved'), 'success')}>{t('saveChangesBtn')}</Button>
        </div>
      </Card>

      {/* Language */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400" /> {t('sectionLanguage')}
        </h2>
        <div className="flex gap-3">
          {[{ val: 'en', labelKey: 'optionEnglish' }, { val: 'bn', labelKey: 'optionBangla' }].map(({ val, labelKey }) => (
            <button
              key={val}
              onClick={() => { setLang(val); addToast(t(labelKey), 'info'); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                lang === val
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 text-emerald-700 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </Card>

      {/* Theme */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">{t('sectionAppearance')}</h2>
        <div className="flex gap-3">
          {[
            { val: 'light', Icon: Sun, labelKey: 'optionLight' },
            { val: 'dark', Icon: Moon, labelKey: 'optionDark' },
          ].map(({ val, Icon, labelKey }) => (
            <button
              key={val}
              onClick={() => { if (theme !== val) toggleTheme(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                theme === val
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 text-emerald-700 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Icon className="w-4 h-4" /> {t(labelKey)}
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-400" /> {t('sectionNotifications')}
        </h2>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <Toggle id="notif-reminders" label={t('notifMedReminders')} checked={notifs.reminders} onChange={() => toggleNotif('reminders')} />
          <Toggle id="notif-reports" label={t('notifReportAlerts')} checked={notifs.reports} onChange={() => toggleNotif('reports')} />
          <Toggle id="notif-insights" label={t('notifHealthInsights')} checked={notifs.insights} onChange={() => toggleNotif('insights')} />
        </div>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">{t('sectionDataPrivacy')}</h2>
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => addToast('Preparing data export...', 'info')}>
            <Download className="w-4 h-4" /> {t('downloadMyData')}
          </Button>
          <Button variant="danger" className="w-full" onClick={() => addToast('Please contact support to delete your account.', 'warning')}>
            <Trash2 className="w-4 h-4" /> {t('deleteAccount')}
          </Button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t('dataSecurityNote')}</p>
      </Card>

      {/* Logout */}
      <Button
        variant="ghost"
        className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
        onClick={() => { logout(); navigate('/'); }}
      >
        {t('signOut')}
      </Button>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600">{t('settingsFooter')}</p>
    </div>
  );
}
