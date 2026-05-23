import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext(null);

// For now, Bangla shows [BN] prefix — translations come later
// TODO: Connect to i18n library with real Bangla translations
export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en');

  const t = (text) => {
    if (lang === 'bn') return `[BN] ${text}`;
    return text;
  };

  const toggleLang = () => setLang((l) => (l === 'en' ? 'bn' : 'en'));

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
