// Chrome-font + UI-size preferences, stored in localStorage and applied
// via CSS custom properties so every component picks them up without
// prop drilling. The editor has its own font (see editorPrefs.ts) — these
// hooks do not touch it.

import { useCallback, useEffect, useState } from "react";

// ──────────────────────── UI font family ────────────────────────

export type UiFontId =
  | "inter"
  | "roboto-serif"
  | "plex-serif"
  | "georgia"
  | "frank-ruhl"
  | "merriweather";

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
    id: "inter",
    label: "Inter",
    kind: "sans",
    stack: "Inter, ui-sans-serif, system-ui, sans-serif",
    sample: "Notes that branch and connect.",
  },
  {
    id: "roboto-serif",
    label: "Roboto Serif",
    kind: "serif",
    stack: "'Roboto Serif', ui-serif, Georgia, serif",
    sample: "Notes that branch and connect.",
  },
  {
    id: "plex-serif",
    label: "IBM Plex Serif",
    kind: "serif",
    stack: "'IBM Plex Serif', ui-serif, Georgia, serif",
    sample: "Notes that branch and connect.",
  },
  {
    id: "georgia",
    label: "Georgia",
    kind: "serif",
    stack: "Georgia, ui-serif, 'Source Serif 4', serif",
    sample: "Notes that branch and connect.",
  },
  {
    id: "frank-ruhl",
    label: "Frank Ruhl Libre",
    kind: "serif",
    stack: "'Frank Ruhl Libre', ui-serif, Georgia, serif",
    sample: "Notes that branch and connect.",
  },
  {
    id: "merriweather",
    label: "Merriweather",
    kind: "serif",
    stack: "Merriweather, ui-serif, Georgia, serif",
    sample: "Notes that branch and connect.",
  },
];

const UI_FONT_KEY = "yarrow.uiFont";
const UI_FONT_EVT = "yarrow:uiFont-changed";
const DEFAULT_UI_FONT: UiFontId = "inter";

function readUiFont(): UiFontId {
  try {
    const raw = localStorage.getItem(UI_FONT_KEY);
    if (raw && UI_FONTS.some((f) => f.id === raw)) return raw as UiFontId;
  } catch {}
  return DEFAULT_UI_FONT;
}

function applyUiFontToDOM(id: UiFontId) {
  const font = UI_FONTS.find((f) => f.id === id) ?? UI_FONTS[0];
  document.documentElement.style.setProperty("--ui-font-family", font.stack);
}

export function useUiFont(): [UiFontChoice, (id: UiFontId) => void] {
  const [id, setId] = useState<UiFontId>(readUiFont);

  useEffect(() => { applyUiFontToDOM(id); }, [id]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<UiFontId>).detail;
      if (next && UI_FONTS.some((f) => f.id === next)) setId(next);
      else setId(readUiFont());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === UI_FONT_KEY) setId(readUiFont());
    };
    window.addEventListener(UI_FONT_EVT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(UI_FONT_EVT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const set = useCallback((next: UiFontId) => {
    try { localStorage.setItem(UI_FONT_KEY, next); } catch {}
    applyUiFontToDOM(next);
    setId(next);
    window.dispatchEvent(new CustomEvent(UI_FONT_EVT, { detail: next }));
  }, []);

  const current = UI_FONTS.find((f) => f.id === id) ?? UI_FONTS[0];
  return [current, set];
}

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
  try {
    const raw = localStorage.getItem(UI_SCALE_KEY);
    if (raw && UI_SCALES.some((s) => s.id === raw)) return raw as UiScaleId;
  } catch {}
  return DEFAULT_UI_SCALE;
}

function applyUiScaleToDOM(id: UiScaleId) {
  const scale = UI_SCALES.find((s) => s.id === id) ?? UI_SCALES[1];
  // `zoom` on body scales the whole rendered chrome at once. The editor
  // counter-zooms via CSS so its own font-size preference stays honest.
  document.documentElement.style.setProperty("--ui-zoom", String(scale.zoom));
  document.documentElement.style.setProperty("--ui-zoom-inv", String(1 / scale.zoom));
}

export function useUiScale(): [UiScaleChoice, (id: UiScaleId) => void] {
  const [id, setId] = useState<UiScaleId>(readUiScale);

  useEffect(() => { applyUiScaleToDOM(id); }, [id]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<UiScaleId>).detail;
      if (next && UI_SCALES.some((s) => s.id === next)) setId(next);
      else setId(readUiScale());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === UI_SCALE_KEY) setId(readUiScale());
    };
    window.addEventListener(UI_SCALE_EVT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(UI_SCALE_EVT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const set = useCallback((next: UiScaleId) => {
    try { localStorage.setItem(UI_SCALE_KEY, next); } catch {}
    applyUiScaleToDOM(next);
    setId(next);
    window.dispatchEvent(new CustomEvent(UI_SCALE_EVT, { detail: next }));
  }, []);

  const current = UI_SCALES.find((s) => s.id === id) ?? UI_SCALES[1];
  return [current, set];
}

// Apply saved prefs before React mounts so chrome doesn't flash the
// defaults. Same pattern as editorPrefs.ts.
if (typeof window !== "undefined") {
  try { applyUiFontToDOM(readUiFont()); } catch {}
  try { applyUiScaleToDOM(readUiScale()); } catch {}
}
