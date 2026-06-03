"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type ThemePreference = "light" | "dark" | "auto";

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  preference: "auto",
  setPreference: () => {},
  toggle: () => {},
});

function resolveAutoTheme(): Theme {
  const h = new Date().getHours();
  return h >= 7 && h < 19 ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `tz-admin-theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("tz-admin-theme") as ThemePreference | null;
    const pref: ThemePreference = stored === "light" || stored === "dark" ? stored : "auto";
    setPreferenceState(pref);
    const resolved = pref === "auto" ? resolveAutoTheme() : pref;
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  useEffect(() => {
    if (preference !== "auto") return;
    const interval = setInterval(() => {
      const resolved = resolveAutoTheme();
      setTheme(resolved);
      applyTheme(resolved);
    }, 60_000);
    return () => clearInterval(interval);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    const resolved = p === "auto" ? resolveAutoTheme() : p;
    setTheme(resolved);
    applyTheme(resolved);
    if (p === "auto") {
      localStorage.removeItem("tz-admin-theme");
    } else {
      localStorage.setItem("tz-admin-theme", p);
    }
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setPreferenceState(next);
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("tz-admin-theme", next);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
