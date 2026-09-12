import { createContext, useContext } from "react";

export type Locale = "zh-TW" | "en";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage() {
  const language = useContext(LanguageContext);
  if (!language) throw new Error("useLanguage must be used inside LanguageProvider.");
  return language;
}
