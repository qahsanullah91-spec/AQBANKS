import React, { createContext, useContext, useState, useEffect } from 'react';
import { en, TranslationKey } from '../locales/en';
import { ps } from '../locales/ps';
import { Languages } from 'lucide-react';

export type Language = 'en' | 'ps';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  isRTL: boolean;
  t: (key: TranslationKey | string, defaultText?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'aq_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ps' || saved === 'en') {
      return saved;
    }
    return 'en'; // English is default for new users
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  useEffect(() => {
    const dir = language === 'ps' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    if (language === 'ps') {
      document.body.classList.add('rtl-layout');
    } else {
      document.body.classList.remove('rtl-layout');
    }
  }, [language]);

  const t = (key: TranslationKey | string, defaultText?: string): string => {
    if (language === 'ps') {
      const psVal = (ps as any)[key];
      if (psVal) return psVal;
    }
    const enVal = (en as any)[key];
    if (enVal) return enVal;
    return defaultText || key;
  };

  const isRtl = language === 'ps';
  const dir = isRtl ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, dir, isRtl, isRTL: isRtl, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-lg p-0.5 shadow-sm ${className}`}>
      <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-slate-400">
        <Languages className="w-3.5 h-3.5 text-emerald-400" />
      </div>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2 py-1 min-h-[36px] text-xs font-semibold rounded transition ${
          language === 'en'
            ? 'bg-emerald-600 text-white shadow keep-white-text'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
        title="English (Default)"
        aria-label="Switch to English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('ps')}
        className={`px-2 py-1 min-h-[36px] text-xs font-semibold rounded transition font-sans ${
          language === 'ps'
            ? 'bg-emerald-600 text-white shadow keep-white-text'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
        title="پښتو (Pashto)"
        aria-label="Switch to Pashto"
      >
        پښتو
      </button>
    </div>
  );
};
