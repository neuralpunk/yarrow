// macOS viewport-height correction.
//
// macOS Tahoe + Tauri 2 + WKWebView consistently over-reports the
// usable viewport height — `visualViewport.height`,
// `documentElement.clientHeight`, and `window.innerHeight` all
// agree on a value that's larger than the actual visible content
// area. The deficit is the combined contribution of the title bar,
// the system status strip, and a window-server fudge that reserves
// rows for the OS chrome. Empirically the deficit is somewhere
// between ~100 and ~260 px on Tahoe — and varies across macOS
// versions and display arrangements, which is why this is exposed
// as a tunable rather than hardcoded.
//
// The slider lives in Settings → Appearance (macOS only) so users
// who hit the bottom-cutoff bug can self-fix without waiting for a
// release. Read by `main.tsx`'s `readViewportHeight()` on every
// resize/focus/visualViewport event; updates dispatch a custom
// event so main.tsx can resync immediately (no reload needed).

import { useEffect, useState } from "react";
import type { StringKey } from "./i18n";

const STORAGE_KEY = "yarrow:vp-fudge";

/** Default subtraction on macOS when no override is set. Picked
 *  on the larger side — a small dead zone above the bottom edge
 *  is visually equivalent to a slightly larger window inset, while
 *  too small a value clips real chrome the user needs (left-rail
 *  Activity / Trash and the global status bar with word count +
 *  sync state). */
export const DEFAULT_MAC_VP_FUDGE_PX = 150;

/** Custom event fired when the fudge changes — `main.tsx` listens
 *  so it can resync `--vp-h` immediately without a reload. */
export const VP_FUDGE_CHANGED_EVENT = "yarrow:vp-fudge-changed";

export interface MacFudgePreset {
  id: "none" | "small" | "medium" | "large" | "xlarge";
  px: number;
  labelKey: StringKey;
  sublabelKey: StringKey;
}

/** Fixed preset ladder. Five rungs are enough resolution for users
 *  to find a value that works without offering so many that picking
 *  becomes tedious. The `medium` preset matches
 *  `DEFAULT_MAC_VP_FUDGE_PX` so "default" and "Medium" agree. */
export const MAC_FUDGE_PRESETS: readonly MacFudgePreset[] = [
  { id: "none",   px: 0,   labelKey: "settings.appearance.macFudge.none.label",   sublabelKey: "settings.appearance.macFudge.none.sub" },
  { id: "small",  px: 80,  labelKey: "settings.appearance.macFudge.small.label",  sublabelKey: "settings.appearance.macFudge.small.sub" },
  { id: "medium", px: 150, labelKey: "settings.appearance.macFudge.medium.label", sublabelKey: "settings.appearance.macFudge.medium.sub" },
  { id: "large",  px: 220, labelKey: "settings.appearance.macFudge.large.label",  sublabelKey: "settings.appearance.macFudge.large.sub" },
  { id: "xlarge", px: 300, labelKey: "settings.appearance.macFudge.xlarge.label", sublabelKey: "settings.appearance.macFudge.xlarge.sub" },
] as const;

export type MacFudgePresetId = (typeof MAC_FUDGE_PRESETS)[number]["id"];

/** Read the current fudge value, falling back to the default if no
 *  override has been set. Clamped to a sane range (0-400 px) — a
 *  hostile or accidental localStorage write can't hide the chrome.
 *  Intentionally a plain function (no React) so `main.tsx` can call
 *  it before React has mounted. */
export function getMacViewportFudge(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v != null) {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 400) return n;
    }
  } catch {
    /* localStorage may be disabled in some embed contexts */
  }
  return DEFAULT_MAC_VP_FUDGE_PX;
}

/** Find the preset whose `px` matches the current saved value, or
 *  null if the saved value doesn't correspond to any preset (e.g.
 *  a custom value set via devtools). Used by Settings to highlight
 *  the active tile. */
export function getActiveMacFudgePreset(): MacFudgePreset | null {
  const px = getMacViewportFudge();
  return MAC_FUDGE_PRESETS.find((p) => p.px === px) ?? null;
}

/** Persist a new fudge value and notify listeners so the layout
 *  updates immediately. Storing 0 still writes — that's a valid
 *  override (turn the correction off) distinct from "use default." */
export function setMacViewportFudge(px: number): void {
  const clamped = Math.max(0, Math.min(400, Math.round(px)));
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    /* ignore — localStorage write failures are not actionable here */
  }
  // Async dispatch — in case the caller is mid-render, give React a
  // tick to commit before main.tsx's resync runs and reads layout.
  window.dispatchEvent(new CustomEvent(VP_FUDGE_CHANGED_EVENT));
}

/** Hook for Settings UI. Returns the currently active preset id (or
 *  "custom" when the saved value doesn't match any preset) and a
 *  setter that writes the preset's px to storage. */
export function useMacFudgePreset(): [
  MacFudgePresetId | "custom",
  (id: MacFudgePresetId) => void,
] {
  const [active, setActive] = useState<MacFudgePresetId | "custom">(() => {
    const p = getActiveMacFudgePreset();
    return p ? p.id : "custom";
  });

  useEffect(() => {
    const handler = () => {
      const p = getActiveMacFudgePreset();
      setActive(p ? p.id : "custom");
    };
    window.addEventListener(VP_FUDGE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(VP_FUDGE_CHANGED_EVENT, handler);
  }, []);

  const set = (id: MacFudgePresetId) => {
    const preset = MAC_FUDGE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setMacViewportFudge(preset.px);
  };

  return [active, set];
}
