// Paper & Warmth (2.1). Two axes:
//
//   texture — the subtle pattern tiled into the app background. Six
//             choices, all inline SVG data URIs so we ship zero assets.
//   warmth  — a scalar (-300 … +300) that warms or cools the paper tone,
//             applied as a hue-rotate + sepia filter blend on the body
//             layer. Crucially it's applied to *.paper-wash* wrappers
//             (below, in index.css) rather than the whole page, so the
//             editor and graphs stay faithful.
//
// State lives in localStorage; reactive via a custom event like the
// other Yarrow prefs. Both values are applied to CSS custom properties
// on `:root` so every surface that opts in picks them up without prop
// drilling.

import { useCallback, useEffect, useState } from "react";

// ──────────────── textures ────────────────

export type PaperTextureId = "cream" | "linen" | "recycled" | "ledger" | "graph" | "dusk";

export interface PaperTextureChoice {
  id: PaperTextureId;
  label: string;
  description: string;
  /** Short CSS fragment for the `--paper-texture` background. Kept inline
   *  so we stay single-binary with zero assets. */
  css: string;
}

// Tiny repeatable backgrounds defined purely in CSS — no raster images.
// Each snippet is used verbatim as the value of `--paper-texture`.
// `cream` is the default: no texture, just a flat warm wash.
//
// 2.1 texture retune: alphas dropped to ~0.06–0.10, tile sizes halved,
// and radial gradients use tight (0.5px → 0.6px) stops so dots read as
// crisp pixels rather than soft blurs. The goal is paper-like grain
// you notice only if you look for it — never enough to get in the way
// of prose.
export const PAPER_TEXTURES: PaperTextureChoice[] = [
  {
    id: "cream",
    label: "Cream",
    description: "The default. Flat warm paper.",
    css: "none",
  },
  {
    id: "linen",
    label: "Linen",
    description: "Cross-hatched weave. Textured.",
    // Self-tiling gradient at 4px pitch — tighter than before, so the
    // weave reads as weave rather than stripes. Alpha halved.
    css:
      "repeating-linear-gradient(45deg, rgba(120,92,50,0.05) 0 0.6px, transparent 0.6px 4px)," +
      "repeating-linear-gradient(-45deg, rgba(120,92,50,0.05) 0 0.6px, transparent 0.6px 4px)",
  },
  {
    id: "recycled",
    label: "Recycled",
    description: "Speckled. Honest.",
    // Hard-edge radial dots — 0.5px stop cuts straight to transparent
    // at 0.6px so dots look like pin-pricks, not fuzzy blobs.
    css:
      "radial-gradient(rgba(90,68,32,0.10) 0.5px, transparent 0.6px)",
  },
  {
    id: "ledger",
    label: "Ledger",
    description: "Faint horizontal rule lines.",
    // Self-tiling at 22px line spacing with a single-px line and a
    // lighter alpha so the lines whisper rather than shout.
    css:
      "repeating-linear-gradient(180deg, transparent 0 21px, rgba(168,122,44,0.10) 21px 22px)",
  },
  {
    id: "graph",
    label: "Graph",
    description: "Light grid, both axes.",
    // Hard 1px lines at low alpha — reads as "graph paper" only on
    // focused inspection; vanishes into the background at reading
    // distance.
    css:
      "linear-gradient(rgba(168,122,44,0.07) 1px, transparent 1px)," +
      "linear-gradient(90deg, rgba(168,122,44,0.07) 1px, transparent 1px)",
  },
  {
    id: "dusk",
    label: "Dusk",
    description: "Warm night. Tiny pin-prick stars.",
    // Sparse, sharp radial stars — higher alpha because the dark
    // canvas needs a warmer highlight to catch the eye.
    css:
      "radial-gradient(rgba(232,213,156,0.16) 0.5px, transparent 0.6px)",
  },
];

const TEX_KEY = "yarrow.paperTexture";
const TEX_EVT = "yarrow:paperTexture-changed";
const DEFAULT_TEXTURE: PaperTextureId = "cream";

function readTexture(): PaperTextureId {
  try {
    const raw = localStorage.getItem(TEX_KEY);
    if (raw && PAPER_TEXTURES.some((t) => t.id === raw)) return raw as PaperTextureId;
  } catch {}
  return DEFAULT_TEXTURE;
}

function applyTexture(id: PaperTextureId) {
  const t = PAPER_TEXTURES.find((x) => x.id === id) ?? PAPER_TEXTURES[0];
  const root = document.documentElement;
  root.style.setProperty("--paper-texture", t.css);
  // Per-texture tile size. Self-tiling gradients (linen, ledger) use
  // `auto` so we don't crop their pattern; everything else gets an
  // explicit tile so its single radial/linear gradient repeats.
  // 2.1 retune: tiles shrunk so the texture reads as grain, not as
  // pattern. At these sizes you don't "see" individual dots or
  // squares at reading distance — you see a subtle paper surface.
  const size: Record<PaperTextureId, string> = {
    cream:    "auto",
    linen:    "auto",
    ledger:   "100% 22px",
    recycled: "4px 4px",
    graph:    "20px 20px",
    dusk:     "5px 5px",
  };
  root.style.setProperty("--paper-texture-size", size[id] ?? "auto");
  // A `data-paper-texture` attribute on <html> lets CSS target
  // texture-specific tweaks if ever needed (e.g. dusk flips a text tone).
  root.setAttribute("data-paper-texture", id);
}

export function usePaperTexture(): [PaperTextureChoice, (id: PaperTextureId) => void] {
  const [id, setId] = useState<PaperTextureId>(readTexture);
  useEffect(() => { applyTexture(id); }, [id]);
  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<PaperTextureId>).detail;
      if (next && PAPER_TEXTURES.some((t) => t.id === next)) setId(next);
      else setId(readTexture());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === TEX_KEY) setId(readTexture());
    };
    window.addEventListener(TEX_EVT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TEX_EVT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const set = useCallback((next: PaperTextureId) => {
    try { localStorage.setItem(TEX_KEY, next); } catch {}
    applyTexture(next);
    setId(next);
    window.dispatchEvent(new CustomEvent(TEX_EVT, { detail: next }));
  }, []);
  const current = PAPER_TEXTURES.find((t) => t.id === id) ?? PAPER_TEXTURES[0];
  return [current, set];
}

// ──────────────── warmth ────────────────
//
// A simple integer, -300…+300, representing a Kelvin-ish offset from
// neutral. Applied as a `filter: sepia() hue-rotate()` on a dedicated
// paper wash div — so the hue affects paper surfaces without touching
// the editor text or graph SVGs. Zero = untouched.

const WARMTH_KEY = "yarrow.paperWarmth";
const WARMTH_EVT = "yarrow:paperWarmth-changed";
const DEFAULT_WARMTH = 0;

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(-300, Math.min(300, Math.round(n)));
}

function readWarmth(): number {
  try {
    const raw = localStorage.getItem(WARMTH_KEY);
    if (raw == null) return DEFAULT_WARMTH;
    const n = parseInt(raw, 10);
    return clamp(n);
  } catch {
    return DEFAULT_WARMTH;
  }
}

function applyWarmth(k: number) {
  const root = document.documentElement;
  root.style.setProperty("--paper-warmth", String(k));
  // Build a filter expression. Positive → warm (sepia + slight hue);
  // negative → cool (hue-rotate blue direction). We keep intensity
  // deliberately subtle: sepia maxes at 0.24, hue-rotate at ~8°.
  const sepia = Math.max(0, k / 300) * 0.24;
  const hue = -(k / 300) * 8; // warm = -8°, cool = +8°
  const filter = k === 0 ? "none" : `sepia(${sepia.toFixed(3)}) hue-rotate(${hue.toFixed(2)}deg)`;
  root.style.setProperty("--paper-warmth-filter", filter);
  // Perf — keep `filter` off the body unless warmth is actually
  // engaged. With `filter` declared (even as `none`), webkit2gtk
  // promotes the body to a full-page composited layer and re-paints
  // through the filter pipeline on every scroll. Toggling the
  // attribute means the rule only matches when the user has dialled
  // warmth away from neutral.
  if (k === 0) {
    root.removeAttribute("data-paper-warmth-active");
  } else {
    root.setAttribute("data-paper-warmth-active", "true");
  }
}

export function usePaperWarmth(): [number, (k: number) => void] {
  const [v, setV] = useState<number>(readWarmth);
  useEffect(() => { applyWarmth(v); }, [v]);
  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<number>).detail;
      setV(typeof next === "number" ? clamp(next) : readWarmth());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === WARMTH_KEY) setV(readWarmth());
    };
    window.addEventListener(WARMTH_EVT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WARMTH_EVT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const set = useCallback((next: number) => {
    const k = clamp(next);
    try { localStorage.setItem(WARMTH_KEY, String(k)); } catch {}
    applyWarmth(k);
    setV(k);
    window.dispatchEvent(new CustomEvent(WARMTH_EVT, { detail: k }));
  }, []);
  return [v, set];
}

// Apply saved values before React mounts so the chrome doesn't flash the
// defaults on cold start — same pattern as uiPrefs.
if (typeof window !== "undefined") {
  try { applyTexture(readTexture()); } catch {}
  try { applyWarmth(readWarmth()); } catch {}
}
