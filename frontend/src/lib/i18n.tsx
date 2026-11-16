'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import en from './i18n/en.json';
import fr from './i18n/fr.json';
import ar from './i18n/ar.json';

export type Lang = 'en' | 'fr' | 'ar';

const dict: Record<Lang, Record<string, string>> = { en, fr, ar };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('dtms_lang') : null) as Lang | null;
    if (saved && ['en', 'fr', 'ar'].includes(saved)) setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem('dtms_lang', l);
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = dict[lang][key] ?? dict.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };

  return <Ctx.Provider value={{ lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr' }}>{children}</Ctx.Provider>;
}

export function useT() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useT must be used inside I18nProvider');
  return ctx;
}
