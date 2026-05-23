import { useLanguage } from '../../context/LanguageContext.jsx';

export default function LanguageToggle() {
  const { lang, toggleLang } = useLanguage();
  return (
    <button
      onClick={toggleLang}
      aria-label={`Switch to ${lang === 'en' ? 'Bangla' : 'English'}`}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
    >
      <span>{lang === 'en' ? 'EN' : 'বাং'}</span>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
      <span>{lang === 'en' ? 'বাং' : 'EN'}</span>
    </button>
  );
}
