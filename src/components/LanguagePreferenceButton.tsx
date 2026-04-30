"use client";

import { Globe } from "lucide-react";
import type { LanguageCode } from "@/lib/translations";
import { languages } from "@/lib/translations";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";

type LanguagePreferenceButtonProps = {
  fallback?: string | null;
  className?: string;
  onChange?: (lang: LanguageCode) => void;
};

export function LanguagePreferenceButton({
  fallback,
  className,
  onChange,
}: LanguagePreferenceButtonProps) {
  const { lang, setLang } = useLanguagePreference(fallback);
  const selectedLanguage = languages.find((language) => language.code === lang) ?? languages[0];

  const handleToggle = () => {
    const currentIdx = languages.findIndex((language) => language.code === lang);
    const nextLang = languages[(currentIdx + 1) % languages.length];
    setLang(nextLang.code);
    onChange?.(nextLang.code);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={
        className ??
        "flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted-foreground)] shadow-sm transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
      }
    >
      <Globe className="w-4 h-4" />
      <span>
        {selectedLanguage.flag} {selectedLanguage.name}
      </span>
    </button>
  );
}
