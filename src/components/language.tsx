import { useEffect, useState } from "react";
import { LanguageContext, type Locale, useLanguage } from "@/lib/language";
const storageKey = "flight-fare-finder.locale";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "zh-TW";
  const savedLocale = window.localStorage.getItem(storageKey);
  if (savedLocale === "zh-TW" || savedLocale === "en") return savedLocale;
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh-TW" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    window.localStorage.setItem(storageKey, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>{children}</LanguageContext.Provider>
  );
}

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="language-switch" aria-label="Language selector / 語言選擇器" role="group">
      <button
        aria-pressed={locale === "zh-TW"}
        className={locale === "zh-TW" ? "language-option is-active" : "language-option"}
        onClick={() => setLocale("zh-TW")}
        type="button"
      >
        中文
      </button>
      <button
        aria-pressed={locale === "en"}
        className={locale === "en" ? "language-option is-active" : "language-option"}
        onClick={() => setLocale("en")}
        type="button"
      >
        EN
      </button>
    </div>
  );
}
