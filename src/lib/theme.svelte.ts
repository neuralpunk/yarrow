import { workspaceScope, readScoped, writeScoped } from "./workspaceScope.svelte";
import { api } from "./tauri";

// 3.1 — six-theme system per yarrow-theme-system-implementation.md.
//
// Two new defaults frame Yarrow's brand identity:
//   • Vellum   — cool bone canvas with slate-blue primary (default light).
//   • Workshop — deep ink-blue with bronze primary (default dark).
//
// The previous "Light"/"Dark" palettes are preserved as alternatives
// renamed to:
//   • Linen    — warm cream and olive (former "Light").
//   • Graphite — neutral charcoal (former "Dark").
//
// Plus the existing 2.1/3.0 alternates: Ashrose (light family) and
// Dracula (dark family).
//
// "Auto" is no longer a single mode that toggles light↔dark — it now
// pairs *two* configured themes (one light, one dark) and switches by
// `prefers-color-scheme`. A user can have Vellum during the day and
// Workshop at night, or any other valid pair from the two families.
export type ThemeName =
  | "vellum"
  | "linen"
  | "ashrose"
  | "workshop"
  | "graphite"
  | "dracula";

export type LightThemeName = Extract<ThemeName, "vellum" | "linen" | "ashrose">;
export type DarkThemeName = Extract<
  ThemeName,
  "workshop" | "graphite" | "dracula"
>;

// `mode` tells us which family to resolve from. Specific theme names
// (e.g. "vellum") are also legal as `mode` values for users who want
// to pin one theme regardless of family — this matches the spec's
// `ThemeMode = 'auto' | 'light' | 'dark' | ThemeName` shape.
export type ThemeMode = "auto" | "light" | "dark" | ThemeName;

export interface ThemeConfig {
  mode: ThemeMode;
  lightTheme: LightThemeName;
  darkTheme: DarkThemeName;
}

export const LIGHT_THEMES: readonly LightThemeName[] = [
  "vellum",
  "linen",
  "ashrose",
] as const;

export const DARK_THEMES: readonly DarkThemeName[] = [
  "workshop",
  "graphite",
  "dracula",
] as const;

// Cycle order for the corner toggle button — keeps the spec's
// "Auto first, then walk the families" muscle memory.
export const THEME_ORDER: ThemeMode[] = [
  "auto",
  "vellum",
  "linen",
  "ashrose",
  "workshop",
  "graphite",
  "dracula",
];

export const THEME_LABELS: Record<ThemeMode, string> = {
  auto: "Auto",
  light: "Light",
  dark: "Dark",
  vellum: "Vellum",
  linen: "Linen",
  ashrose: "Ashrose",
  workshop: "Workshop",
  graphite: "Graphite",
  dracula: "Dracula",
};

const KEY = "yarrow.theme";              // legacy single-mode storage
const CONFIG_KEY = "yarrow.theme.config"; // new full ThemeConfig

const DEFAULT_LIGHT: LightThemeName = "vellum";
const DEFAULT_DARK: DarkThemeName = "workshop";
const DEFAULT_CONFIG: ThemeConfig = {
  mode: "auto",
  lightTheme: DEFAULT_LIGHT,
  darkTheme: DEFAULT_DARK,
};

// Both signals feed the `resolved` derived through `systemPrefersDark`.
// Using `$state` makes them reactive — a previous shape held them as
// plain `let` and updated them from matchMedia / detectColorScheme
// listeners, which forced those listeners to call `apply()` directly
// and bypass the `resolved` derived. Anything reading `theme.resolved`
// (e.g. `theme.isDark`, ConnectionGraph's theme-aware colours) saw a
// stale value because the derived had no dependency to invalidate on.
let systemDark = $state<boolean>(
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false,
);
let systemHasExplicitPreference = $state<boolean>(
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: light)").matches
      || window.matchMedia("(prefers-color-scheme: dark)").matches
    : false,
);

// Theme system spec §9.3 — populated asynchronously on boot from
// `cmd_detect_color_scheme`. Acts as a fallback for old Linux DEs
// where the WebView reports no preference.
let linuxDeOverride = $state<"light" | "dark" | null>(null);

function systemPrefersDark(): boolean {
  // matchMedia first — modern WebKit2GTK / WKWebView / Edge all honour
  // `prefers-color-scheme` directly. The Rust DE probe pushes its
  // result into `linuxDeOverride` once it resolves; that flag wins
  // only when the OS query reports genuine "no preference" rather than
  // an explicit light/dark.
  if (linuxDeOverride !== null && !systemHasExplicitPreference) {
    return linuxDeOverride === "dark";
  }
  return systemDark;
}

function isLightThemeName(v: unknown): v is LightThemeName {
  return v === "vellum" || v === "linen" || v === "ashrose";
}

function isDarkThemeName(v: unknown): v is DarkThemeName {
  return v === "workshop" || v === "graphite" || v === "dracula";
}

function isThemeMode(v: unknown): v is ThemeMode {
  return (
    v === "auto" ||
    v === "light" ||
    v === "dark" ||
    isLightThemeName(v) ||
    isDarkThemeName(v)
  );
}

// Resolve a config to the actual palette name we apply (one of the
// six concrete themes). Used both to set `data-theme` and to decide
// the `.dark` class for downstream "is this dark?" CSS rules.
function resolvePalette(cfg: ThemeConfig): ThemeName {
  if (cfg.mode === "auto") {
    return systemPrefersDark() ? cfg.darkTheme : cfg.lightTheme;
  }
  if (cfg.mode === "light") return cfg.lightTheme;
  if (cfg.mode === "dark") return cfg.darkTheme;
  return cfg.mode;
}

function isDarkPalette(name: ThemeName): boolean {
  return isDarkThemeName(name);
}

// Migration: pre-3.1 the store held a single string (light / dark /
// auto / ashrose / dracula). Map those to the new ThemeConfig shape.
//   "light" → { mode: "light",  lightTheme: "linen"   }
//   "dark"  → { mode: "dark",   darkTheme:  "graphite" }
// (existing users with a "light"/"dark" preference get the renamed
// originals, not the new Vellum/Workshop defaults — they explicitly
// chose those palettes and we shouldn't reskin them on upgrade.)
function migrateLegacy(raw: unknown): ThemeConfig | null {
  if (typeof raw !== "string") return null;
  if (raw === "light") {
    return { mode: "light", lightTheme: "linen", darkTheme: DEFAULT_DARK };
  }
  if (raw === "dark") {
    return { mode: "dark", lightTheme: DEFAULT_LIGHT, darkTheme: "graphite" };
  }
  if (raw === "auto") {
    return {
      mode: "auto",
      lightTheme: "linen",
      darkTheme: "graphite",
    };
  }
  if (isLightThemeName(raw)) {
    return { mode: raw, lightTheme: raw, darkTheme: DEFAULT_DARK };
  }
  if (isDarkThemeName(raw)) {
    return { mode: raw, lightTheme: DEFAULT_LIGHT, darkTheme: raw };
  }
  return null;
}

function isThemeConfig(v: unknown): v is ThemeConfig {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    isThemeMode(o.mode) &&
    isLightThemeName(o.lightTheme) &&
    isDarkThemeName(o.darkTheme)
  );
}

function readStoredConfig(): ThemeConfig {
  // Try the new structured config first (scoped, then global).
  for (const reader of [() => readScoped(CONFIG_KEY), () => safeLocal(CONFIG_KEY)]) {
    const raw = reader();
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (isThemeConfig(parsed)) return parsed;
      } catch {
        /* fall through */
      }
    } else if (isThemeConfig(raw)) {
      return raw as ThemeConfig;
    }
  }
  // Fall back to the legacy single-string key and migrate.
  for (const reader of [() => readScoped(KEY), () => safeLocal(KEY)]) {
    const migrated = migrateLegacy(reader());
    if (migrated) return migrated;
  }
  return { ...DEFAULT_CONFIG };
}

function safeLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let themeTransitionTimer: number | null = null;

function apply(palette: ThemeName) {
  // Mark <html> for a brief window so the body's bg/color transition
  // (scoped to `html.theme-transitioning`) carries the crossfade.
  document.documentElement.classList.add("theme-transitioning");
  if (themeTransitionTimer != null) {
    window.clearTimeout(themeTransitionTimer);
  }
  themeTransitionTimer = window.setTimeout(() => {
    document.documentElement.classList.remove("theme-transitioning");
    themeTransitionTimer = null;
  }, 260);
  document.documentElement.classList.toggle("dark", isDarkPalette(palette));
  document.documentElement.setAttribute("data-theme", palette);
}

class ThemeStore {
  config = $state<ThemeConfig>(readStoredConfig());

  // Derived view of the currently applied palette name. Components
  // that need to know *which* of the six is live (e.g. swatch picker)
  // read this; everything else just goes via CSS vars.
  resolved = $derived<ThemeName>(resolvePalette(this.config));

  // Back-compat: existing callers (RightRail, IntroPage, ConnectionGraph,
  // TabBar, CompareDiff) read `theme.mode` to drive UI. Keep `mode` as
  // a setter/getter alias for `config.mode`.
  get mode(): ThemeMode {
    return this.config.mode;
  }
  set mode(next: ThemeMode) {
    this.set(next);
  }

  constructor() {
    apply(this.resolved);

    // Spec §9.3 — kick off the Linux DE probe in the background.
    // Resolves to "light"/"dark"/"unknown"; only the concrete answers
    // arm the matchMedia fallback. Setting the `$state` mirror
    // invalidates the `resolved` derived; the apply effect below
    // re-runs naturally and corrects a stale first paint.
    void api
      .detectColorScheme()
      .then((result) => {
        if (result === "light" || result === "dark") {
          linuxDeOverride = result;
        }
      })
      .catch(() => {});

    $effect.root(() => {
      // Apply + persist whenever the resolved palette changes — that
      // includes every input that feeds it: `config.mode`, the two
      // sub-theme picks, the system `prefers-color-scheme` mirror,
      // and the Linux DE probe override. Centralising the apply path
      // here means no listener has to call `apply()` directly.
      $effect(() => {
        const palette = this.resolved;
        apply(palette);
        // Theme system spec §9.1 — switch the macOS vibrancy
        // material to match the resolved family (Sidebar for light,
        // HudWindow for dark). Best-effort: noop on Linux/Windows,
        // and the Rust side swallows individual failures.
        void api.applyThemeVibrancy(palette).catch(() => {});
        const serialized = JSON.stringify(this.config);
        writeScoped(CONFIG_KEY, serialized);
        try {
          localStorage.setItem(CONFIG_KEY, serialized);
          // Mirror the resolved palette to the legacy single-string key
          // so any external probe (or downgraded build) lands somewhere
          // sane.
          localStorage.setItem(KEY, palette);
        } catch {
          /* quota */
        }
      });

      // Re-read on workspace switch so each notebook's saved config
      // takes effect the moment we land in it.
      $effect(() => {
        void workspaceScope.scope;
        const next = readStoredConfig();
        if (
          next.mode !== this.config.mode ||
          next.lightTheme !== this.config.lightTheme ||
          next.darkTheme !== this.config.darkTheme
        ) {
          this.config = next;
        }
      });

      // Mirror the OS `prefers-color-scheme` query into the `$state`
      // signals that feed `resolved`. Two media queries because we
      // also need to know whether the OS reported an *explicit*
      // preference (so the Linux DE override only kicks in when it
      // didn't). Listeners always run; the derived ignores them when
      // `mode !== "auto"` because `resolvePalette` only reads
      // `systemPrefersDark()` in the auto branch.
      $effect(() => {
        const dark = window.matchMedia("(prefers-color-scheme: dark)");
        const light = window.matchMedia("(prefers-color-scheme: light)");
        const sync = () => {
          systemDark = dark.matches;
          systemHasExplicitPreference = dark.matches || light.matches;
        };
        sync();
        dark.addEventListener("change", sync);
        light.addEventListener("change", sync);
        return () => {
          dark.removeEventListener("change", sync);
          light.removeEventListener("change", sync);
        };
      });
    });
  }

  set(next: ThemeMode) {
    if (this.config.mode === next) return;
    this.config = { ...this.config, mode: next };
  }

  setLightTheme(next: LightThemeName) {
    if (this.config.lightTheme === next) return;
    this.config = { ...this.config, lightTheme: next };
  }

  setDarkTheme(next: DarkThemeName) {
    if (this.config.darkTheme === next) return;
    this.config = { ...this.config, darkTheme: next };
  }

  cycle() {
    const i = THEME_ORDER.indexOf(this.config.mode);
    const next = THEME_ORDER[(i + 1) % THEME_ORDER.length];
    this.set(next);
  }

  get isDark(): boolean {
    return isDarkPalette(this.resolved);
  }
}

export const theme = new ThemeStore();
