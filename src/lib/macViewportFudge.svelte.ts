// macOS viewport-height correction (Svelte 5 port).
//
// macOS Tahoe + Tauri 2 + WKWebView consistently over-reports the
// usable viewport height — `visualViewport.height`,
// `documentElement.clientHeight`, and `window.innerHeight` all
// agree on a value that's larger than the actual visible content
// area. The slider in Settings → Appearance (macOS only) lets users
// self-fix without waiting for a release. Read by `main.ts`'s
// `readViewportHeight()` on every resize/focus/visualViewport event.

import type { StringKey } from "./i18n/index.svelte";

const STORAGE_KEY = "yarrow:vp-fudge";

export const DEFAULT_MAC_VP_FUDGE_PX = 0;

export const VP_FUDGE_CHANGED_EVENT = "yarrow:vp-fudge-changed";

export interface MacFudgePreset {
  id: "none" | "small" | "medium" | "large" | "xlarge";
  px: number;
  labelKey: StringKey;
  sublabelKey: StringKey;
}

export const MAC_FUDGE_PRESETS: readonly MacFudgePreset[] = [
  { id: "none",   px: 0,   labelKey: "settings.appearance.macFudge.none.label",   sublabelKey: "settings.appearance.macFudge.none.sub" },
  { id: "small",  px: 90,  labelKey: "settings.appearance.macFudge.small.label",  sublabelKey: "settings.appearance.macFudge.small.sub" },
  { id: "medium", px: 100, labelKey: "settings.appearance.macFudge.medium.label", sublabelKey: "settings.appearance.macFudge.medium.sub" },
  { id: "large",  px: 150, labelKey: "settings.appearance.macFudge.large.label",  sublabelKey: "settings.appearance.macFudge.large.sub" },
  { id: "xlarge", px: 220, labelKey: "settings.appearance.macFudge.xlarge.label", sublabelKey: "settings.appearance.macFudge.xlarge.sub" },
] as const;

export type MacFudgePresetId = (typeof MAC_FUDGE_PRESETS)[number]["id"];

/** Read the current fudge value, falling back to the default if no
 *  override has been set. Clamped to a sane range (0-400 px). Plain
 *  function so `main.ts` can call it before any reactive context
 *  exists. */
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

export function getActiveMacFudgePreset(): MacFudgePreset | null {
  const px = getMacViewportFudge();
  return MAC_FUDGE_PRESETS.find((p) => p.px === px) ?? null;
}

export function setMacViewportFudge(px: number): void {
  const clamped = Math.max(0, Math.min(400, Math.round(px)));
  try { localStorage.setItem(STORAGE_KEY, String(clamped)); } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent(VP_FUDGE_CHANGED_EVENT));
}

class MacFudgePresetStore {
  active = $state<MacFudgePresetId | "custom">("none");

  constructor() {
    const p = getActiveMacFudgePreset();
    this.active = p ? p.id : "custom";
    $effect.root(() => {
      const handler = () => {
        const fresh = getActiveMacFudgePreset();
        const next = fresh ? fresh.id : "custom";
        if (next !== this.active) this.active = next;
      };
      window.addEventListener(VP_FUDGE_CHANGED_EVENT, handler);
      return () => window.removeEventListener(VP_FUDGE_CHANGED_EVENT, handler);
    });
  }

  set(id: MacFudgePresetId) {
    const preset = MAC_FUDGE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setMacViewportFudge(preset.px);
  }
}

export const macFudgePreset = new MacFudgePresetStore();
