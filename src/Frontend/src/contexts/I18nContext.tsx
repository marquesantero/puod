import React, { createContext, useContext, useMemo, useState } from "react";
import { messages } from "@/i18n/messages";

export type Locale = "en" | "pt";
export type MessageKey = keyof typeof messages.en;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const LOCALE_STORAGE_KEY = "puod.locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    if (stored === "pt" || stored === "en") {
      return stored;
    }
    const browserLocale = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
    return browserLocale.startsWith("pt") ? "pt" : "en";
  });

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale: (next) => {
      setLocaleState(next);
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    },
    t: (key) => (messages[locale] as any)[key] ?? (messages.en as any)[key] ?? key,
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
