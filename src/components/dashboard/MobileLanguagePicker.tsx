"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useShop } from "@/context/ShopContext";
import { useIsMobile } from "@/hooks/useIsMobile";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ur: "اردو",
  ar: "العربية",
  fa: "فارسی",
  ps: "پښتو",
  sd: "سنڌي",
  hi: "हिन्दी",
  bn: "বাংলা",
  ta: "தமிழ்",
  te: "తెలుగు",
};

export function MobileLanguagePicker() {
  const { language, setLanguage } = useLanguage();
  const { activeLanguages } = useShop();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (!activeLanguages || activeLanguages.length <= 1) return null;

  if (!isMobile) {
    return (
      <div className="flex items-center bg-slate-100 p-1 rounded-full border border-slate-200 shadow-inner">
        {activeLanguages.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang as Parameters<typeof setLanguage>[0])}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
              language === lang
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {LANGUAGE_NAMES[lang] || lang}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-600 active:scale-95 transition-transform"
        aria-label="Change language"
      >
        <Globe className="h-4.5 w-4.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-[60] animate-in fade-in slide-in-from-top-2 duration-150">
          {activeLanguages.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => {
                setLanguage(lang as Parameters<typeof setLanguage>[0]);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                language === lang
                  ? "text-indigo-600 bg-indigo-50"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {LANGUAGE_NAMES[lang] || lang}
              {language === lang && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
