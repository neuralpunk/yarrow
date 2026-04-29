// Accessibility preferences (Svelte 5 port).
//
// Six categories from the consultant review:
//   • Vision:    text size scale, contrast level, reduce transparency,
//                larger cursor, dyslexia-friendly font.
//   • Motion:    reduce-motion override (default tracks the OS), disable
//                autoplay (graph view, etc.).
//   • Motor:     larger hit targets (44×44 minimum), sticky-keys aware
//                shortcut hints.
//   • Cognitive: reading guide (cursor-line bar), spell-check tone.
//   • Reader:    verbose announcements, focus-ring visibility level.
//   • Color:     color-blind safe mode (adds shape/label cues to
//                colour-only state signals).
//
// All settings are device-local — they describe how the chrome is
// painted on the user's machine. Nothing here touches workspace files.
//
// Each setting drives a CSS custom property or a class on
// document.documentElement so consumers can pick them up without
// prop drilling. The Accessibility persona presets in
// `A11Y_PERSONA_PATCHES` flip several of these together.

// ──────────────────────── shared util ────────────────────────

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
    window.dispatchEvent(new CustomEvent(`${key}-changed`));
  } catch { /* quota */ }
}

function readString<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(key) as T | null;
    if (raw && allowed.includes(raw)) return raw;
    return fallback;
  } catch {
    return fallback;
  }
}

function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(`${key}-changed`));
  } catch { /* quota */ }
}

// Generic boolean-pref store. Each factory returns a singleton with a
// `.value` rune-state and a `.set(next)` setter, plus a `.toggle()`
// for chrome that wants a one-line click handler.
class BoolPref {
  value = $state<boolean>(false);
  #key: string;
  #fallback: boolean;

  constructor(key: string, fallback: boolean) {
    this.#key = key;
    this.#fallback = fallback;
    this.value = readBool(key, fallback);
    $effect.root(() => {
      const onChange = () => {
        const fresh = readBool(this.#key, this.#fallback);
        if (fresh !== this.value) this.value = fresh;
      };
      window.addEventListener(`${key}-changed`, onChange);
      return () => window.removeEventListener(`${key}-changed`, onChange);
    });
  }

  set(next: boolean) {
    if (this.value === next) return;
    writeBool(this.#key, next);
    this.value = next;
  }

  toggle() { this.set(!this.value); }
}

class StringPref<T extends string> {
  value = $state<T>("" as T);
  #key: string;
  #allowed: readonly T[];
  #fallback: T;

  constructor(key: string, allowed: readonly T[], fallback: T) {
    this.#key = key;
    this.#allowed = allowed;
    this.#fallback = fallback;
    this.value = readString<T>(key, allowed, fallback);
    $effect.root(() => {
      const onChange = () => {
        const fresh = readString<T>(this.#key, this.#allowed, this.#fallback);
        if (fresh !== this.value) this.value = fresh;
      };
      window.addEventListener(`${key}-changed`, onChange);
      return () => window.removeEventListener(`${key}-changed`, onChange);
    });
  }

  set(next: T) {
    if (this.value === next) return;
    writeString(this.#key, next);
    this.value = next;
  }
}

// ──────────────────────── Vision: text scale ────────────────────────

// 7-step scale that covers what the consultant asked for (85%–200%)
// without giving us infinite values to test against. The CSS custom
// property `--a11y-text-scale` multiplies into chrome and editor
// font sizes so existing components don't need to know about a11y.
export const TEXT_SCALES = ["85", "100", "115", "130", "150", "175", "200"] as const;
export type TextScale = typeof TEXT_SCALES[number];

const TEXT_SCALE_KEY = "yarrow.a11y.textScale";
export const a11yTextScale = new StringPref<TextScale>(
  TEXT_SCALE_KEY,
  TEXT_SCALES,
  "100",
);

// ──────────────────────── Vision: contrast ────────────────────────

export const CONTRAST_LEVELS = ["default", "high", "maximum"] as const;
export type ContrastLevel = typeof CONTRAST_LEVELS[number];

const CONTRAST_KEY = "yarrow.a11y.contrast";
export const a11yContrast = new StringPref<ContrastLevel>(
  CONTRAST_KEY,
  CONTRAST_LEVELS,
  "default",
);

// ──────────────────────── Vision: misc toggles ────────────────────────

const REDUCE_TRANSPARENCY_KEY = "yarrow.a11y.reduceTransparency";
const LARGER_CURSOR_KEY = "yarrow.a11y.largerCursor";
const DYSLEXIA_FONT_KEY = "yarrow.a11y.dyslexiaFont";

export const reduceTransparency = new BoolPref(REDUCE_TRANSPARENCY_KEY, false);
export const largerCursor = new BoolPref(LARGER_CURSOR_KEY, false);
export const dyslexiaFont = new BoolPref(DYSLEXIA_FONT_KEY, false);

// ──────────────────────── Motion ────────────────────────

const REDUCE_MOTION_OVERRIDE_KEY = "yarrow.a11y.reduceMotionOverride";
const DISABLE_AUTOPLAY_KEY = "yarrow.a11y.disableAutoplay";

// "auto" = follow the OS prefers-reduced-motion. "on" = force on.
// "off" = force off. The override is what users tweak when the OS
// pref doesn't match what they actually need from this app.
export const MOTION_OVERRIDES = ["auto", "on", "off"] as const;
export type MotionOverride = typeof MOTION_OVERRIDES[number];

export const reduceMotionOverride = new StringPref<MotionOverride>(
  REDUCE_MOTION_OVERRIDE_KEY,
  MOTION_OVERRIDES,
  "auto",
);
export const disableAutoplay = new BoolPref(DISABLE_AUTOPLAY_KEY, false);

// ──────────────────────── Motor ────────────────────────

const LARGE_HIT_TARGETS_KEY = "yarrow.a11y.largeHitTargets";
const STICKY_KEYS_AWARE_KEY = "yarrow.a11y.stickyKeysAware";

export const largeHitTargets = new BoolPref(LARGE_HIT_TARGETS_KEY, false);
export const stickyKeysAware = new BoolPref(STICKY_KEYS_AWARE_KEY, false);

// ──────────────────────── Cognitive ────────────────────────

const READING_GUIDE_KEY = "yarrow.a11y.readingGuide";
const SPELLCHECK_TONE_KEY = "yarrow.a11y.spellcheckTone";

export const SPELLCHECK_TONES = ["underline", "highlight", "off"] as const;
export type SpellcheckTone = typeof SPELLCHECK_TONES[number];

export const readingGuide = new BoolPref(READING_GUIDE_KEY, false);
export const spellcheckTone = new StringPref<SpellcheckTone>(
  SPELLCHECK_TONE_KEY,
  SPELLCHECK_TONES,
  "underline",
);

// ──────────────────────── Reader / focus ────────────────────────

const VERBOSE_ANNOUNCEMENTS_KEY = "yarrow.a11y.verboseAnnouncements";
const FOCUS_RING_KEY = "yarrow.a11y.focusRing";

export const FOCUS_RING_STYLES = ["subtle", "default", "high"] as const;
export type FocusRingStyle = typeof FOCUS_RING_STYLES[number];

export const verboseAnnouncements = new BoolPref(VERBOSE_ANNOUNCEMENTS_KEY, false);
export const focusRingStyle = new StringPref<FocusRingStyle>(
  FOCUS_RING_KEY,
  FOCUS_RING_STYLES,
  "default",
);

// ──────────────────────── Visualizations ────────────────────────

const DIFF_PATTERNS_KEY = "yarrow.a11y.diffPatterns";
const GRAPH_TABLE_ALT_KEY = "yarrow.a11y.graphTableAlt";

export const diffPatterns = new BoolPref(DIFF_PATTERNS_KEY, true);
export const graphTableAlt = new BoolPref(GRAPH_TABLE_ALT_KEY, false);

// ──────────────────────── Color ────────────────────────

const COLOR_BLIND_SAFE_KEY = "yarrow.a11y.colorBlindSafe";
export const colorBlindSafe = new BoolPref(COLOR_BLIND_SAFE_KEY, false);

export const COLOR_BLIND_TYPES = [
  "off",
  "deuteranopia",
  "protanopia",
  "tritanopia",
  "achromatopsia",
] as const;
export type ColorBlindType = typeof COLOR_BLIND_TYPES[number];

const COLOR_BLIND_TYPE_KEY = "yarrow.a11y.colorBlindType";
export const colorBlindType = new StringPref<ColorBlindType>(
  COLOR_BLIND_TYPE_KEY,
  COLOR_BLIND_TYPES,
  "off",
);

// ──────────────────────── Apply to DOM ────────────────────────

/** Wire every accessibility preference to a CSS custom property or a
 *  class on <html>. Call once at app boot — internally uses an
 *  `$effect.root` so subsequent toggles flow into the DOM without
 *  another call. */
export function installAccessibilityApplier(): void {
  $effect.root(() => {
    $effect(() => {
      const root = document.documentElement;
      // Read every reactive value first so the effect tracks them all.
      const scale = a11yTextScale.value;
      const contrast = a11yContrast.value;
      const rt = reduceTransparency.value;
      const lc = largerCursor.value;
      const df = dyslexiaFont.value;
      const motion = reduceMotionOverride.value;
      const da = disableAutoplay.value;
      const lh = largeHitTargets.value;
      const rg = readingGuide.value;
      const st = spellcheckTone.value;
      const fr = focusRingStyle.value;
      const cbs = colorBlindSafe.value;
      const cbt = colorBlindType.value;
      const dp = diffPatterns.value;
      const gta = graphTableAlt.value;

      root.style.setProperty("--a11y-text-scale", `${Number(scale) / 100}`);
      root.classList.toggle("a11y-contrast-high", contrast === "high");
      root.classList.toggle("a11y-contrast-maximum", contrast === "maximum");
      root.classList.toggle("a11y-reduce-transparency", rt);
      root.classList.toggle("a11y-larger-cursor", lc);
      root.classList.toggle("a11y-dyslexia-font", df);
      root.classList.toggle("a11y-disable-autoplay", da);
      root.classList.toggle("a11y-large-hit-targets", lh);
      root.classList.toggle("a11y-reading-guide", rg);
      root.classList.toggle("a11y-color-blind-safe", cbs);
      root.classList.toggle("a11y-diff-patterns", dp);
      root.classList.toggle("a11y-graph-table-alt", gta);
      if (motion === "auto") {
        root.removeAttribute("data-motion");
      } else {
        root.setAttribute("data-motion", motion === "on" ? "off" : "on");
      }
      root.setAttribute("data-spellcheck-tone", st);
      root.setAttribute("data-focus-ring", fr);
      if (cbt === "off") {
        root.removeAttribute("data-cb-type");
      } else {
        root.setAttribute("data-cb-type", cbt);
      }
    });
  });
}

// ──────────────────────── A11y Persona presets ────────────────────────

export type A11yPersona =
  | "low-vision"
  | "dyslexia-friendly"
  | "reduced-motion"
  | "motor-friendly";

interface PersonaPatch {
  textScale?: TextScale;
  contrast?: ContrastLevel;
  reduceTransparency?: boolean;
  largerCursor?: boolean;
  dyslexiaFont?: boolean;
  reduceMotionOverride?: MotionOverride;
  disableAutoplay?: boolean;
  largeHitTargets?: boolean;
  stickyKeysAware?: boolean;
  readingGuide?: boolean;
  spellcheckTone?: SpellcheckTone;
  focusRing?: FocusRingStyle;
  colorBlindSafe?: boolean;
  // Disables the press-and-hold radial menu (kept in extras land but
  // surfaced here so the motor-friendly preset can flip it off).
  radialMenuOff?: boolean;
}

export const A11Y_PERSONA_PATCHES: Record<A11yPersona, PersonaPatch> = {
  "low-vision": {
    textScale: "150",
    contrast: "high",
    largerCursor: true,
    focusRing: "high",
  },
  "dyslexia-friendly": {
    dyslexiaFont: true,
    readingGuide: true,
    spellcheckTone: "off",
  },
  "reduced-motion": {
    reduceMotionOverride: "on",
    disableAutoplay: true,
    reduceTransparency: true,
  },
  "motor-friendly": {
    largeHitTargets: true,
    stickyKeysAware: true,
    radialMenuOff: true,
  },
};

export function a11yPersonaSettingCount(p: A11yPersona): number {
  return Object.keys(A11Y_PERSONA_PATCHES[p]).length;
}

export function resetAccessibilityPrefs(): void {
  // Vision
  writeString(TEXT_SCALE_KEY, "100");
  writeString(CONTRAST_KEY, "default");
  writeBool(REDUCE_TRANSPARENCY_KEY, false);
  writeBool(LARGER_CURSOR_KEY, false);
  writeBool(DYSLEXIA_FONT_KEY, false);
  // Motion
  writeString(REDUCE_MOTION_OVERRIDE_KEY, "auto");
  writeBool(DISABLE_AUTOPLAY_KEY, false);
  // Motor
  writeBool(LARGE_HIT_TARGETS_KEY, false);
  writeBool(STICKY_KEYS_AWARE_KEY, false);
  // Cognitive
  writeBool(READING_GUIDE_KEY, false);
  writeString(SPELLCHECK_TONE_KEY, "underline");
  // Reader / focus
  writeBool(VERBOSE_ANNOUNCEMENTS_KEY, false);
  writeString(FOCUS_RING_KEY, "default");
  // Color
  writeBool(COLOR_BLIND_SAFE_KEY, false);
  writeString(COLOR_BLIND_TYPE_KEY, "off");
  // Visualizations
  writeBool(DIFF_PATTERNS_KEY, true);
  writeBool(GRAPH_TABLE_ALT_KEY, false);
  // Radial menu — canonical surface lives here even though the storage
  // key sits in extraPrefs land.
  try { localStorage.setItem("yarrow.extras.radialMenu", "true"); } catch { /* quota */ }
  window.dispatchEvent(
    new CustomEvent("yarrow:extras-radialMenu-changed", { detail: true }),
  );
}

export function applyA11yPersona(p: A11yPersona): void {
  const patch = A11Y_PERSONA_PATCHES[p];
  if (patch.textScale != null) writeString(TEXT_SCALE_KEY, patch.textScale);
  if (patch.contrast != null) writeString(CONTRAST_KEY, patch.contrast);
  if (patch.reduceTransparency != null) writeBool(REDUCE_TRANSPARENCY_KEY, patch.reduceTransparency);
  if (patch.largerCursor != null) writeBool(LARGER_CURSOR_KEY, patch.largerCursor);
  if (patch.dyslexiaFont != null) writeBool(DYSLEXIA_FONT_KEY, patch.dyslexiaFont);
  if (patch.reduceMotionOverride != null) writeString(REDUCE_MOTION_OVERRIDE_KEY, patch.reduceMotionOverride);
  if (patch.disableAutoplay != null) writeBool(DISABLE_AUTOPLAY_KEY, patch.disableAutoplay);
  if (patch.largeHitTargets != null) writeBool(LARGE_HIT_TARGETS_KEY, patch.largeHitTargets);
  if (patch.stickyKeysAware != null) writeBool(STICKY_KEYS_AWARE_KEY, patch.stickyKeysAware);
  if (patch.readingGuide != null) writeBool(READING_GUIDE_KEY, patch.readingGuide);
  if (patch.spellcheckTone != null) writeString(SPELLCHECK_TONE_KEY, patch.spellcheckTone);
  if (patch.focusRing != null) writeString(FOCUS_RING_KEY, patch.focusRing);
  if (patch.colorBlindSafe != null) writeBool(COLOR_BLIND_SAFE_KEY, patch.colorBlindSafe);
  if (patch.radialMenuOff != null) {
    const next = patch.radialMenuOff ? "false" : "true";
    try { localStorage.setItem("yarrow.extras.radialMenu", next); } catch { /* quota */ }
    window.dispatchEvent(
      new CustomEvent("yarrow:extras-radialMenu-changed", {
        detail: !patch.radialMenuOff,
      }),
    );
  }
}
