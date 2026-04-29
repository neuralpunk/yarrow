// Paper & Warmth (Svelte 5 port). Two axes:
//
//   texture — the subtle pattern tiled into the app background. Six
//             choices, all inline SVG data URIs so we ship zero assets.
//   warmth  — a scalar (-300 … +300) that warms or cools the paper tone,
//             applied as a hue-rotate + sepia filter blend on the body
//             layer. Crucially it's applied to *.paper-wash* wrappers
//             rather than the whole page, so the editor and graphs
//             stay faithful.

import {
  workspaceScope,
  readScoped,
  wsKey,
  writeScoped,
} from "./workspaceScope.svelte";

// ──────────────── textures ────────────────

export type PaperTextureId = "cream" | "linen" | "recycled" | "ledger" | "graph" | "dusk";

export interface PaperTextureChoice {
  id: PaperTextureId;
  label: string;
  description: string;
  /** Short CSS fragment for the `--paper-texture` background. Inline
   *  so we stay single-binary with zero assets. */
  css: string;
}

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
    css:
      "repeating-linear-gradient(45deg, rgba(120,92,50,0.05) 0 0.6px, transparent 0.6px 4px)," +
      "repeating-linear-gradient(-45deg, rgba(120,92,50,0.05) 0 0.6px, transparent 0.6px 4px)",
  },
  {
    id: "recycled",
    label: "Recycled",
    description: "Speckled. Honest.",
    css:
      "radial-gradient(rgba(90,68,32,0.10) 0.5px, transparent 0.6px)",
  },
  {
    id: "ledger",
    label: "Ledger",
    description: "Faint horizontal rule lines.",
    css:
      "repeating-linear-gradient(180deg, transparent 0 21px, rgba(168,122,44,0.10) 21px 22px)",
  },
  {
    id: "graph",
    label: "Graph",
    description: "Light grid, both axes.",
    css:
      "linear-gradient(rgba(168,122,44,0.07) 1px, transparent 1px)," +
      "linear-gradient(90deg, rgba(168,122,44,0.07) 1px, transparent 1px)",
  },
  {
    id: "dusk",
    label: "Dusk",
    description: "Warm night. Tiny pin-prick stars.",
    css:
      "radial-gradient(rgba(232,213,156,0.16) 0.5px, transparent 0.6px)",
  },
];

const TEX_KEY = "yarrow.paperTexture";
const TEX_EVT = "yarrow:paperTexture-changed";
const DEFAULT_TEXTURE: PaperTextureId = "cream";

function readTexture(): PaperTextureId {
  const raw = readScoped(TEX_KEY);
  if (raw && PAPER_TEXTURES.some((t) => t.id === raw)) return raw as PaperTextureId;
  return DEFAULT_TEXTURE;
}

function applyTexture(id: PaperTextureId) {
  const t = PAPER_TEXTURES.find((x) => x.id === id) ?? PAPER_TEXTURES[0];
  const root = document.documentElement;
  root.style.setProperty("--paper-texture", t.css);
  const size: Record<PaperTextureId, string> = {
    cream:    "auto",
    linen:    "auto",
    ledger:   "100% 22px",
    recycled: "4px 4px",
    graph:    "20px 20px",
    dusk:     "5px 5px",
  };
  root.style.setProperty("--paper-texture-size", size[id] ?? "auto");
  root.setAttribute("data-paper-texture", id);
}

class PaperTextureStore {
  id = $state<PaperTextureId>(readTexture());

  constructor() {
    applyTexture(this.id);
    $effect.root(() => {
      $effect(() => { applyTexture(this.id); });
      $effect(() => {
        void workspaceScope.scope;
        const next = readTexture();
        if (next !== this.id) this.id = next;
      });
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<PaperTextureId>).detail;
        if (next && PAPER_TEXTURES.some((t) => t.id === next)) {
          if (this.id !== next) this.id = next;
        } else {
          const fresh = readTexture();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === TEX_KEY || e.key === wsKey(TEX_KEY)) {
          const fresh = readTexture();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      window.addEventListener(TEX_EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(TEX_EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  get current(): PaperTextureChoice {
    return PAPER_TEXTURES.find((t) => t.id === this.id) ?? PAPER_TEXTURES[0];
  }

  set(next: PaperTextureId) {
    if (this.id === next) return;
    writeScoped(TEX_KEY, next);
    try { localStorage.setItem(TEX_KEY, next); } catch { /* quota */ }
    applyTexture(next);
    this.id = next;
    window.dispatchEvent(new CustomEvent(TEX_EVT, { detail: next }));
  }
}

export const paperTexture = new PaperTextureStore();

// ──────────────── warmth ────────────────

const WARMTH_KEY = "yarrow.paperWarmth";
const WARMTH_EVT = "yarrow:paperWarmth-changed";
const DEFAULT_WARMTH = 0;

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(-300, Math.min(300, Math.round(n)));
}

function readWarmth(): number {
  const raw = readScoped(WARMTH_KEY);
  if (raw == null) return DEFAULT_WARMTH;
  const n = parseInt(raw, 10);
  return clamp(n);
}

function applyWarmth(k: number) {
  const root = document.documentElement;
  root.style.setProperty("--paper-warmth", String(k));
  const sepia = Math.max(0, k / 300) * 0.24;
  const hue = -(k / 300) * 8;
  const filter = k === 0 ? "none" : `sepia(${sepia.toFixed(3)}) hue-rotate(${hue.toFixed(2)}deg)`;
  root.style.setProperty("--paper-warmth-filter", filter);
  if (k === 0) {
    root.removeAttribute("data-paper-warmth-active");
  } else {
    root.setAttribute("data-paper-warmth-active", "true");
  }
}

class PaperWarmthStore {
  value = $state<number>(readWarmth());

  constructor() {
    applyWarmth(this.value);
    $effect.root(() => {
      $effect(() => { applyWarmth(this.value); });
      $effect(() => {
        void workspaceScope.scope;
        const next = readWarmth();
        if (next !== this.value) this.value = next;
      });
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<number>).detail;
        const fresh = typeof next === "number" ? clamp(next) : readWarmth();
        if (fresh !== this.value) this.value = fresh;
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === WARMTH_KEY || e.key === wsKey(WARMTH_KEY)) {
          const fresh = readWarmth();
          if (fresh !== this.value) this.value = fresh;
        }
      };
      window.addEventListener(WARMTH_EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(WARMTH_EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  set(next: number) {
    const k = clamp(next);
    if (this.value === k) return;
    writeScoped(WARMTH_KEY, String(k));
    try { localStorage.setItem(WARMTH_KEY, String(k)); } catch { /* quota */ }
    applyWarmth(k);
    this.value = k;
    window.dispatchEvent(new CustomEvent(WARMTH_EVT, { detail: k }));
  }
}

export const paperWarmth = new PaperWarmthStore();

// Apply saved values before the Svelte tree mounts so the chrome
// doesn't flash defaults on cold start.
if (typeof window !== "undefined") {
  try { applyTexture(readTexture()); } catch { /* DOM not ready */ }
  try { applyWarmth(readWarmth()); } catch { /* DOM not ready */ }
}
