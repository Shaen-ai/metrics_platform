import { LanguageCode, normalizeLanguageCode } from "@/lib/translations";

export const LANGUAGE_STORAGE_KEY = "tunzone-lang";
export const LANGUAGE_COOKIE_NAME = "tunzone-lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function normalizeLanguagePreference(lang: string | undefined | null): LanguageCode | null {
  if (lang === "en" || lang === "ru") return lang;
  if (lang === "hy") return "ru";
  return null;
}

function readCookieLanguage(): LanguageCode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LANGUAGE_COOKIE_NAME}=([^;]+)`),
  );
  return normalizeLanguagePreference(match?.[1]);
}

export function getStoredLanguagePreference(): LanguageCode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const normalized = normalizeLanguagePreference(stored);
    if (normalized) return normalized;
  } catch {
    // Ignore storage errors in private/restricted browser contexts.
  }
  return readCookieLanguage();
}

export function getLanguagePreference(fallback?: string | null): LanguageCode {
  return getStoredLanguagePreference() ?? normalizeLanguageCode(fallback);
}

export function setStoredLanguagePreference(lang: LanguageCode): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors; cookie still keeps the preference.
    }
  }
  if (typeof document !== "undefined") {
    document.cookie = `${LANGUAGE_COOKIE_NAME}=${lang}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }
}
