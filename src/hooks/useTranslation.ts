"use client";

import { useStore } from "@/lib/store";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import {
  getTranslation,
  LanguageCode,
} from "@/lib/translations";

export function useTranslation() {
  const { currentUser } = useStore();
  const { lang } = useLanguagePreference(currentUser?.language);

  const t = (key: string): string => {
    return getTranslation(lang, key);
  };

  return { t, lang };
}

// For public pages where user might not be logged in
export function usePublicTranslation(adminLang?: LanguageCode) {
  const { lang } = useLanguagePreference(adminLang);

  const t = (key: string): string => {
    return getTranslation(lang, key);
  };

  return { t, lang };
}
