"use client";

import { useStore } from "@/lib/store";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import { getTranslation } from "@/lib/translations";

export function useTranslation() {
  const { currentUser } = useStore();
  const { lang } = useLanguagePreference(currentUser?.language);

  const t = (key: string): string => {
    return getTranslation(lang, key);
  };

  return { t, lang };
}
