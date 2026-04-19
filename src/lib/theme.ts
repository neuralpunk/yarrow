import { useEffect, useState } from "react";

// TODO(post-launch): reintroduce Blueberry palette
export type ThemeMode = "light" | "dark" | "auto";

export const THEME_ORDER: ThemeMode[] = ["light", "auto", "dark"];

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  auto: "Auto",
};

const KEY = "yarrow.theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDarkResolved(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return systemPrefersDark();
}

function paletteAttr(_mode: ThemeMode): string {
  return "warm";
}

function apply(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", isDarkResolved(mode));
  document.documentElement.setAttribute("data-theme", paletteAttr(mode));
}

function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "auto";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const raw = localStorage.getItem(KEY);
    return isThemeMode(raw) ? raw : "auto";
  });

  useEffect(() => {
    apply(mode);
    localStorage.setItem(KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  return {
    mode,
    setMode,
    isDark: isDarkResolved(mode),
    cycle: () =>
      setMode((m) => {
        const i = THEME_ORDER.indexOf(m);
        return THEME_ORDER[(i + 1) % THEME_ORDER.length];
      }),
  };
}
