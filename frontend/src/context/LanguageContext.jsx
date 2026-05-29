import { createContext, useContext, useState } from 'react';
import translations from '../i18n/translations.js';

const LanguageContext = createContext(null);

const STORAGE_KEY = 'rxsense_lang';

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'bn'   // default Bangla
  );

  const setLang = (l) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };

  const toggleLang = () => setLang(lang === 'en' ? 'bn' : 'en');

  /**
   * Translate a key, optionally interpolating {varName} placeholders.
   * Falls back to the English string, then the raw key if neither exists.
   *
   * t('welcomeGreeting', { firstName: 'Rahim' })
   */
  const t = (key, vars = {}) => {
    const dict = translations[lang] || translations.bn;
    let text = dict[key] ?? translations.en[key] ?? key;
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''));
    });
    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
