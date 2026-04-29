// Chrome-font + UI-size preferences (Svelte 5 port).
//
// Stored in localStorage and applied via CSS custom properties so every
// component picks them up without prop drilling. The editor has its own
// font (see editorPrefs.svelte.ts) — these stores do not touch it.

import {
  workspaceScope,
  readScoped,
  wsKey,
  writeScoped,
} from "./workspaceScope.svelte";

// ──────────────────────── UI font family ────────────────────────

// 2.1 revised UI font picker. Inter Tight is the default chrome
// sans; Newsreader is offered as a serif option for users who want
// chrome and prose to share a family. Fraunces is available for the
// editorial-forward look. Georgia + system sans are offline fallbacks.
export type UiFontId =
  | "inter-tight"
  | "newsreader"
  | "fraunces"
  | "georgia"
  | "system-sans";

export interface UiFontChoice {
  id: UiFontId;
  label: string;
  kind: "serif" | "sans";
  stack: string;
  /** Short sentence set in the face — used for the swatch preview. */
  sample: string;
}

export const UI_FONTS: UiFontChoice[] = [
  {
    id: "inter-tight",
    label: "Inter Tight",
    kind: "sans",
    stack: "'Inter Tight', 'Inter', ui-sans-serif, system-ui, sans-serif",
    sample: "Notes that branch and connect.",
  },
  {
    id: "newsreader",
    label: "Newsreader",
    kind: "serif",
    stack: "'Newsreader', ui-serif, Georgia, serif",
    sample: "Notes that branch and connect.",
  },
  {
    id: "fraunces",
    label: "Fraunces",
    kind: "serif",
    stack: "'Fraunces', ui-serif, Georgia, serif",
    sample: "Notes that branch and connect.",
  },
  {
    id: "georgia",
    label: "Georgia",
    kind: "serif",
    stack: "Georgia, ui-serif, 'Newsreader', serif",
    sample: "Notes that branch and connect.",
  },
  {
    id: "system-sans",
    label: "System sans",
    kind: "sans",
    stack:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
    sample: "Notes that branch and connect.",
  },
];

const UI_FONT_KEY = "yarrow.uiFont";
const UI_FONT_EVT = "yarrow:uiFont-changed";
const DEFAULT_UI_FONT: UiFontId = "inter-tight";

function readUiFont(): UiFontId {
  const raw = readScoped(UI_FONT_KEY);
  if (raw && UI_FONTS.some((f) => f.id === raw)) return raw as UiFontId;
  return DEFAULT_UI_FONT;
}

function applyUiFontToDOM(id: UiFontId) {
  const font = UI_FONTS.find((f) => f.id === id) ?? UI_FONTS[0];
  document.documentElement.style.setProperty("--ui-font-family", font.stack);
}

class UiFontStore {
  id = $state<UiFontId>(readUiFont());

  constructor() {
    applyUiFontToDOM(this.id);
    $effect.root(() => {
      $effect(() => {
        applyUiFontToDOM(this.id);
      });

      $effect(() => {
        void workspaceScope.scope;
        const next = readUiFont();
        if (next !== this.id) this.id = next;
      });

      const onChange = (e: Event) => {
        const next = (e as CustomEvent<UiFontId>).detail;
        if (next && UI_FONTS.some((f) => f.id === next)) {
          if (this.id !== next) this.id = next;
        } else {
          const fresh = readUiFont();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === UI_FONT_KEY || e.key === wsKey(UI_FONT_KEY)) {
          const fresh = readUiFont();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      window.addEventListener(UI_FONT_EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(UI_FONT_EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  get current(): UiFontChoice {
    return UI_FONTS.find((f) => f.id === this.id) ?? UI_FONTS[0];
  }

  set(next: UiFontId) {
    if (this.id === next) return;
    writeScoped(UI_FONT_KEY, next);
    // Mirror to global so a brand-new workspace inherits the current
    // chrome font instead of always defaulting to Inter Tight.
    try { localStorage.setItem(UI_FONT_KEY, next); } catch { /* quota */ }
    applyUiFontToDOM(next);
    this.id = next;
    window.dispatchEvent(new CustomEvent(UI_FONT_EVT, { detail: next }));
  }
}

export const uiFont = new UiFontStore();

// ──────────────────────── UI scale ────────────────────────

export type UiScaleId = "compact" | "cozy" | "roomy";

export interface UiScaleChoice {
  id: UiScaleId;
  label: string;
  sublabel: string;
  /** Zoom factor applied to the app chrome. Editor content is counter-
   *  scaled back to 1.0 so this setting never fights the editor font-size
   *  preference. */
  zoom: number;
}

export const UI_SCALES: UiScaleChoice[] = [
  { id: "compact", label: "Compact", sublabel: "denser chrome, more on screen", zoom: 0.9 },
  { id: "cozy",    label: "Cozy",    sublabel: "the default",                   zoom: 1.0 },
  { id: "roomy",   label: "Roomy",   sublabel: "easier on the eyes",            zoom: 1.1 },
];

const UI_SCALE_KEY = "yarrow.uiScale";
const UI_SCALE_EVT = "yarrow:uiScale-changed";
const DEFAULT_UI_SCALE: UiScaleId = "cozy";

function readUiScale(): UiScaleId {
  const raw = readScoped(UI_SCALE_KEY);
  if (raw && UI_SCALES.some((s) => s.id === raw)) return raw as UiScaleId;
  return DEFAULT_UI_SCALE;
}

function applyUiScaleToDOM(id: UiScaleId) {
  const scale = UI_SCALES.find((s) => s.id === id) ?? UI_SCALES[1];
  // `zoom` on body scales the whole rendered chrome at once. The editor
  // counter-zooms via CSS so its own font-size preference stays honest.
  // At zoom == 1 (the default "Cozy" scale) we *unset* both vars so the
  // body never enters the zoom code path at all — `zoom: 1` is a no-op
  // visually but still creates a stacking context on webkit2gtk that
  // can subtly degrade subpixel positioning of text. Removing the
  // properties entirely keeps the default render path pristine.
  if (scale.zoom === 1) {
    document.documentElement.style.removeProperty("--ui-zoom");
    document.documentElement.style.removeProperty("--ui-zoom-inv");
    document.documentElement.removeAttribute("data-ui-zoom-active");
  } else {
    document.documentElement.style.setProperty("--ui-zoom", String(scale.zoom));
    document.documentElement.style.setProperty("--ui-zoom-inv", String(1 / scale.zoom));
    // Perf — gate the body's `zoom` rule behind this attribute. A
    // declared `zoom: 1` on body still pushes layout through webkit's
    // legacy zoom path; only opt in when the user has actually picked
    // a non-default scale.
    document.documentElement.setAttribute("data-ui-zoom-active", "true");
  }
}

class UiScaleStore {
  id = $state<UiScaleId>(readUiScale());

  constructor() {
    applyUiScaleToDOM(this.id);
    $effect.root(() => {
      $effect(() => {
        applyUiScaleToDOM(this.id);
      });

      $effect(() => {
        void workspaceScope.scope;
        const next = readUiScale();
        if (next !== this.id) this.id = next;
      });

      const onChange = (e: Event) => {
        const next = (e as CustomEvent<UiScaleId>).detail;
        if (next && UI_SCALES.some((s) => s.id === next)) {
          if (this.id !== next) this.id = next;
        } else {
          const fresh = readUiScale();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === UI_SCALE_KEY || e.key === wsKey(UI_SCALE_KEY)) {
          const fresh = readUiScale();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      window.addEventListener(UI_SCALE_EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(UI_SCALE_EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  get current(): UiScaleChoice {
    return UI_SCALES.find((s) => s.id === this.id) ?? UI_SCALES[1];
  }

  set(next: UiScaleId) {
    if (this.id === next) return;
    writeScoped(UI_SCALE_KEY, next);
    try { localStorage.setItem(UI_SCALE_KEY, next); } catch { /* quota */ }
    applyUiScaleToDOM(next);
    this.id = next;
    window.dispatchEvent(new CustomEvent(UI_SCALE_EVT, { detail: next }));
  }
}

export const uiScale = new UiScaleStore();

// ──────────────────────── Right-rail expand ────────────────────────
// 3.0 — when expanded, the right rail grows wide enough to render an
// inline label after each icon button. The choice is global (not
// workspace-scoped) — once a user has formed a habit about the rail's
// width, they'll want it consistent across notebooks.

const RAIL_EXPANDED_KEY = "yarrow.rightRail.expanded";
const RAIL_EXPANDED_EVT = "yarrow:rightRail-expanded-changed";

function readRailExpanded(): boolean {
  try {
    return localStorage.getItem(RAIL_EXPANDED_KEY) === "true";
  } catch {
    return false;
  }
}

class RailExpandedStore {
  expanded = $state<boolean>(readRailExpanded());

  constructor() {
    $effect.root(() => {
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<boolean>).detail;
        if (typeof next === "boolean" && this.expanded !== next) {
          this.expanded = next;
        }
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === RAIL_EXPANDED_KEY) {
          const fresh = readRailExpanded();
          if (fresh !== this.expanded) this.expanded = fresh;
        }
      };
      window.addEventListener(RAIL_EXPANDED_EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(RAIL_EXPANDED_EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  set(next: boolean) {
    if (this.expanded === next) return;
    try {
      localStorage.setItem(RAIL_EXPANDED_KEY, next ? "true" : "false");
    } catch { /* quota */ }
    this.expanded = next;
    window.dispatchEvent(
      new CustomEvent<boolean>(RAIL_EXPANDED_EVT, { detail: next }),
    );
  }
}

export const railExpanded = new RailExpandedStore();

// Apply saved prefs before the Svelte tree mounts so chrome doesn't
// flash the defaults. Same pattern as editorPrefs.
if (typeof window !== "undefined") {
  try { applyUiFontToDOM(readUiFont()); } catch { /* DOM not ready */ }
  try { applyUiScaleToDOM(readUiScale()); } catch { /* DOM not ready */ }
}
