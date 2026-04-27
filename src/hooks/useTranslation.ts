"use client";

import { useStore } from "@/lib/store";
import {
  getTranslation,
  LanguageCode,
  normalizeLanguageCode,
} from "@/lib/translations";

export function useTranslation() {
  const { currentUser } = useStore();
  const lang: LanguageCode = normalizeLanguageCode(currentUser?.language);

  const t = (key: string): string => {
    return getTranslation(lang, key);
  };

  return { t, lang };
}

// For public pages where user might not be logged in
export function usePublicTranslation(adminLang?: LanguageCode) {
  const lang: LanguageCode = normalizeLanguageCode(adminLang);

  const t = (key: string): string => {
    return getTranslation(lang, key);
  };

  return { t, lang };
}
