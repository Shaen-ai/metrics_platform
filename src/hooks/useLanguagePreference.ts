"use client";

import { useCallback, useEffect, useState } from "react";
import type { LanguageCode } from "@/lib/translations";
import {
  getLanguagePreference,
  getStoredLanguagePreference,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguagePreference,
  setStoredLanguagePreference,
} from "@/lib/languagePreference";

const LANGUAGE_CHANGED_EVENT = "tunzone-language-changed";

export function useLanguagePreference(fallback?: string | null) {
  const [lang, setLangState] = useState<LanguageCode>(() => getLanguagePreference(fallback));

  useEffect(() => {
    const fallbackLang = normalizeLanguagePreference(fallback);
    if (fallbackLang) {
      setStoredLanguagePreference(fallbackLang);
      setLangState(fallbackLang);
      return;
    }

    const nextLang = getLanguagePreference(fallback);
    setLangState(nextLang);
    if (getStoredLanguagePreference() === null) {
      setStoredLanguagePreference(nextLang);
    }
  }, [fallback]);

  useEffect(() => {
    const handleChange = () => setLangState(getLanguagePreference(fallback));
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY) handleChange();
    };

    window.addEventListener(LANGUAGE_CHANGED_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fallback]);

  const setLang = useCallback((nextLang: LanguageCode) => {
    setStoredLanguagePreference(nextLang);
    setLangState(nextLang);
    window.dispatchEvent(new Event(LANGUAGE_CHANGED_EVENT));
  }, []);

  return { lang, setLang };
}
