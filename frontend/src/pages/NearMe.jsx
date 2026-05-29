import { Building2, ShieldAlert } from 'lucide-react';
import NearMePanel from '../components/nearby/NearMePanel.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function NearMe() {
  const { t } = useLanguage();

  return (
    <div className="h-full flex flex-col overflow-hidden gap-3 px-4 lg:px-8">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            {t('nearMePageTitle')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('nearMePageSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400 flex-shrink-0">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
          {t('nearMeEmergencyNote')}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <NearMePanel />
      </div>

    </div>
  );
}
