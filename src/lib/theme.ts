import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "auto" | "blueberry";

export const THEME_ORDER: ThemeMode[] = ["light", "auto", "dark", "blueberry"];

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  auto: "Auto",
  blueberry: "Blueberry",
};

const KEY = "yarrow.theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Some palettes are intrinsically dark (blueberry) — they always keep the
// `.dark` class so Tailwind `dark:` variants still apply correctly.
function isDarkResolved(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (mode === "blueberry") return true;
  return systemPrefersDark();
}

function paletteAttr(mode: ThemeMode): string {
  // The data-theme attribute selects a CSS-variable block. Light/dark/auto
  // all share the default warm palette — only non-default palettes need an
  // attribute override.
  if (mode === "blueberry") return "blueberry";
  return "warm";
}

function apply(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", isDarkResolved(mode));
  document.documentElement.setAttribute("data-theme", paletteAttr(mode));
}

function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "auto" || v === "blueberry";
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
