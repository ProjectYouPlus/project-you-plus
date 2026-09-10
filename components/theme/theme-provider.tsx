"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "original" | "white" | "grey" | "blue" | "pink";

export type ThemeOption = {
  id: Theme;
  label: string;
  description: string;
  swatches: string[];
};

const THEME_OPTIONS: ThemeOption[] = [
  { id: "original", label: "Original", description: "Deep violet liquid glass", swatches: ["#5B3FD4", "#7C5CFF", "#A78BFA"] },
  { id: "white", label: "White", description: "Bright Apple Watch-inspired color", swatches: ["#FF7A1A", "#20C8FF", "#A7F231", "#FF5CA8"] },
  { id: "grey", label: "Grey", description: "Soft graphite sophistication", swatches: ["#4B5563", "#9CA3AF", "#D1D5DB"] },
  { id: "blue", label: "Blue", description: "Oceanic and focused", swatches: ["#0A84FF", "#3AA8FF", "#8ED6FF"] },
  { id: "pink", label: "Light Pink", description: "Warm and radiant", swatches: ["#F25D9C", "#F79AC1", "#F7D5E6"] },
];

const STORAGE_KEY = "project-you-theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeOptions: ThemeOption[];
};

const ThemeContext = createContext<ThemeContextValue>({ theme: "original", setTheme: () => {}, themeOptions: THEME_OPTIONS });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("original");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const preferred = stored && THEME_OPTIONS.some((option) => option.id === stored) ? stored : "original";
    applyTheme(preferred);
    setThemeState(preferred);
  }, []);

  function setTheme(next: Theme) {
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }

  const value = useMemo(() => ({ theme, setTheme, themeOptions: THEME_OPTIONS }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme === "white" || theme === "pink" ? "light" : "dark";
}

export function useTheme() {
  return useContext(ThemeContext);
}
