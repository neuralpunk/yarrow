import { useEffect, useState } from "react";

// 2.1 adds a third palette: Ashrose. Light + Dark stay exactly as
// they were — Ashrose is purely additive and lives behind its own
// `data-theme="ashrose"` selector in src/index.css. The cycle order
// puts it after dark so the existing muscle-memory of "click to flip
// light/dark" still works for users who only used those two.
export type ThemeMode = "light" | "dark" | "auto" | "ashrose";

export const THEME_ORDER: ThemeMode[] = ["light", "auto", "dark", "ashrose"];

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  auto: "Auto",
  ashrose: "Ashrose",
};

const KEY = "yarrow.theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Ashrose is a light-family palette (pale dusty rose canvas, deep wine
// accent), so it never resolves to "dark." Keep it grouped with light
// for any code that asks "is this a dark theme?"
function isDarkResolved(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light" || mode === "ashrose") return false;
  return systemPrefersDark();
}

// 2.1: three palette selectors live in index.css —
//   `:root` / `[data-theme="light"]`     for Linen & Gold
//   `html.dark` / `[data-theme="dark"]`  for Plum & Graphite
//   `[data-theme="ashrose"]`             for Ashrose (this release)
// The dark class is also mirrored onto `data-theme` so both selector
// styles light up; ashrose only flips the data-theme attribute since
// the .dark class would also drag in the dark palette's overrides.
function paletteAttr(mode: ThemeMode): string {
  if (mode === "ashrose") return "ashrose";
  return isDarkResolved(mode) ? "dark" : "light";
}

// Tracks the timeout for the theme-transition class so back-to-back
// theme toggles don't strand a stale `theme-transitioning` flag on
// <html> (which would keep the bg/color transition lit during normal
// hover work — exactly what we removed in the perf pass).
let themeTransitionTimer: number | null = null;

function apply(mode: ThemeMode) {
  // Mark <html> for a brief window so the body's bg/color transition
  // (now scoped to `html.theme-transitioning`) carries the crossfade.
  // Outside this window the transition is dormant — preventing it
  // from being accidentally re-triggered every time another CSS var
  // (paper warmth, ui zoom, path-tinted caret colour) changes on the
  // root.
  document.documentElement.classList.add("theme-transitioning");
  if (themeTransitionTimer != null) {
    window.clearTimeout(themeTransitionTimer);
  }
  themeTransitionTimer = window.setTimeout(() => {
    document.documentElement.classList.remove("theme-transitioning");
    themeTransitionTimer = null;
  }, 260);
  document.documentElement.classList.toggle("dark", isDarkResolved(mode));
  document.documentElement.setAttribute("data-theme", paletteAttr(mode));
}

function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "auto" || v === "ashrose";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const raw = localStorage.getItem(KEY);
    // Light is the canonical default. We deliberately do NOT fall
    // through to "auto" (prefers-color-scheme) — operators wanted a
    // predictable first-impression look on the public login page.
    // Users on a dark-preferring OS can still toggle to dark (persisted)
    // or pick "Auto" / "Ashrose" from Settings.
    return isThemeMode(raw) ? raw : "light";
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
