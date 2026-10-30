"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, Language, TranslationKey } from "@/lib/translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string) => string;
  tDigit: (val: string | number) => string;
  dir: "ltr";
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load language from localStorage
    const savedLang = localStorage.getItem("hisabx_language") as Language;
    if (savedLang === "en" || savedLang === "ur") {
      setLanguageState(savedLang);
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("hisabx_language", lang);
  };

  useEffect(() => {
    if (!mounted) return;
    // Always keep HTML dir as ltr (Urdu side layout is not flipped)
    document.documentElement.dir = "ltr";
    document.documentElement.lang = language;
  }, [language, mounted]);

  const tDigit = (val: string | number): string => {
    return String(val);
  };

  const t = (key: TranslationKey | string): string => {
    const activeLang = mounted ? language : "en";
    const langDict = translations[activeLang] || translations.en;
    // @ts-ignore
    const translation = langDict[key];
    return translation !== undefined ? translation : String(key);
  };

  const dir = "ltr" as const;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tDigit, dir }}>
      <div className={mounted && language === "ur" ? "font-nastaleeq" : ""}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

