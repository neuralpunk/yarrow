import { useCallback, useEffect, useState } from "react";

const KEY = "yarrow.showRawMarkdown";
const EVT = "yarrow:showRawMarkdown-changed";

// ───────────────── editor font family ─────────────────

// 2.1 revised: the editor defaults to Newsreader — a screen-first
// editorial serif that stays legible at 17px on webkit2gtk, where
// Fraunces's high-contrast display cut was rendering as spidery and
// unreadable. Fraunces survives as an opt-in choice for users who
// want its display personality; the default is quiet and workable.
export type EditorFontId =
  | "newsreader"
  | "source-serif"
  | "lora"
  | "fraunces"
  | "inter-tight"
  | "georgia";

export interface EditorFontChoice {
  id: EditorFontId;
  label: string;
  kind: "serif" | "sans";
  stack: string;
  /** Recommended line-height for body text in this face. */
  lineHeight: number;
  /** One-line sample showing the typeface's character. */
  sample: string;
}

export const EDITOR_FONTS: EditorFontChoice[] = [
  {
    id: "newsreader",
    label: "Newsreader",
    kind: "serif",
    // Default. Production Type's screen-first editorial face. Variable
    // opsz 6..72 — we pin to 14 for body size in index.css. Warmer and
    // more robust than Fraunces at 17px; stays crisp on Linux/webkit2gtk.
    stack: "'Newsreader', ui-serif, Georgia, serif",
    lineHeight: 1.66,
    sample: "Generous reading rhythm — the default.",
  },
  {
    id: "source-serif",
    label: "Source Serif 4",
    kind: "serif",
    // Adobe's editorial workhorse. Variable opsz 8..60. Slightly more
    // contemporary than Newsreader, beautiful italics.
    stack: "'Source Serif 4', 'Newsreader', ui-serif, Georgia, serif",
    lineHeight: 1.65,
    sample: "A thinking tool for long-form prose.",
  },
  {
    id: "lora",
    label: "Lora",
    kind: "serif",
    // Warm, book-like, very popular for reading-focused interfaces.
    // No opsz axis, just weight. Renders well at any size.
    stack: "'Lora', 'Newsreader', ui-serif, Georgia, serif",
    lineHeight: 1.7,
    sample: "Warm contemporary book face with hand-drawn italics.",
  },
  {
    id: "fraunces",
    label: "Fraunces",
    kind: "serif",
    // High-personality display serif. Beautiful at large sizes; body
    // use is opt-in because its display cut reads as spidery on some
    // screens. The editor's opsz pin keeps it from the worst behaviour.
    stack: "'Fraunces', ui-serif, Georgia, serif",
    lineHeight: 1.66,
    sample: "Characterful — same family as the wordmark.",
  },
  {
    id: "inter-tight",
    label: "Inter Tight",
    kind: "sans",
    // For users who prefer sans prose. Chrome already ships this.
    stack: "'Inter Tight', 'Inter', ui-sans-serif, system-ui, sans-serif",
    lineHeight: 1.6,
    sample: "Neutral, legible, no distractions.",
  },
  {
    id: "georgia",
    label: "Georgia",
    kind: "serif",
    // Offline fallback. Works with no network; honest on every display.
    stack: "Georgia, ui-serif, 'Newsreader', serif",
    lineHeight: 1.62,
    sample: "A classic — available everywhere, no download.",
  },
];

const FONT_KEY = "yarrow.editorFont";
const FONT_EVT = "yarrow:editorFont-changed";
const DEFAULT_FONT: EditorFontId = "newsreader";

function readFont(): EditorFontId {
  try {
    const raw = localStorage.getItem(FONT_KEY);
    if (raw && EDITOR_FONTS.some((f) => f.id === raw)) return raw as EditorFontId;
  } catch {}
  return DEFAULT_FONT;
}

function applyFontToDOM(id: EditorFontId) {
  const font = EDITOR_FONTS.find((f) => f.id === id) ?? EDITOR_FONTS[0];
  const root = document.documentElement;
  root.style.setProperty("--editor-font-family", font.stack);
  root.style.setProperty("--editor-line-height", String(font.lineHeight));
}

/**
 * Reactive hook mirroring `useShowRawMarkdown`: stores the chosen editor
 * font family in localStorage, applies it to CSS vars, and keeps every
 * subscriber (Settings picker, AppShell) in sync via a window event.
 */
export function useEditorFont(): [EditorFontChoice, (id: EditorFontId) => void] {
  const [id, setId] = useState<EditorFontId>(readFont);

  useEffect(() => {
    applyFontToDOM(id);
  }, [id]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<EditorFontId>).detail;
      if (detail && EDITOR_FONTS.some((f) => f.id === detail)) {
        setId(detail);
      } else {
        setId(readFont());
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === FONT_KEY) setId(readFont());
    };
    window.addEventListener(FONT_EVT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(FONT_EVT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const set = useCallback((next: EditorFontId) => {
    try { localStorage.setItem(FONT_KEY, next); } catch {}
    applyFontToDOM(next);
    setId(next);
    window.dispatchEvent(new CustomEvent(FONT_EVT, { detail: next }));
  }, []);

  const current = EDITOR_FONTS.find((f) => f.id === id) ?? EDITOR_FONTS[0];
  return [current, set];
}

// Preemptively apply the saved font on module load so the editor doesn't
// flash the default face before the hook mounts.
if (typeof window !== "undefined") {
  try { applyFontToDOM(readFont()); } catch {}
}

function read(): boolean {
  try { return localStorage.getItem(KEY) === "true"; } catch { return false; }
}

/**
 * Cross-component reactive hook. Multiple `useShowRawMarkdown` call sites
 * (Settings toggle, AppShell, rail button) stay in sync via a window event
 * so toggling in one updates all the others immediately.
 */
export function useShowRawMarkdown(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(read);

  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail;
      setV(typeof next === "boolean" ? next : read());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setV(read());
    };
    window.addEventListener(EVT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const set = useCallback((next: boolean) => {
    try { localStorage.setItem(KEY, String(next)); } catch {}
    setV(next);
    window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
  }, []);

  return [v, set];
}

// ───────────────── generic boolean-pref factory ─────────────────
// The toggles below (typewriter mode, editorial reading, path-tinted caret)
// all share the same shape: localStorage-backed boolean, cross-window sync
// via a custom event, and a setter that broadcasts. Factor once, use thrice.

function makeBoolPref(key: string, evt: string, def = false) {
  const readOne = (): boolean => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return def;
      return raw === "true";
    } catch {
      return def;
    }
  };
  return function useBoolPref(): [boolean, (v: boolean) => void] {
    const [v, setV] = useState<boolean>(readOne);
    useEffect(() => {
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<boolean>).detail;
        setV(typeof next === "boolean" ? next : readOne());
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) setV(readOne());
      };
      window.addEventListener(evt, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(evt, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    }, []);
    const set = useCallback((next: boolean) => {
      try { localStorage.setItem(key, String(next)); } catch {}
      setV(next);
      window.dispatchEvent(new CustomEvent(evt, { detail: next }));
    }, []);
    return [v, set];
  };
}

/** Typewriter mode: the active line stays at the vertical middle of the
 *  editor viewport; the page scrolls underneath you. A writing posture,
 *  not a default — per-user toggle under Settings → Writing. */
export const useTypewriterMode = makeBoolPref(
  "yarrow.typewriterMode",
  "yarrow:typewriterMode-changed",
);

/** Editorial reading mode: the read-only view uses drop caps, pull quotes
 *  (`> pull:` prefix), and generous leading — so finished notes read like
 *  a magazine spread, not a preview pane. */
export const useEditorialReading = makeBoolPref(
  "yarrow.editorialReading",
  "yarrow:editorialReading-changed",
);

/** Path-tinted caret: the caret takes the color of the current path so
 *  you always know which draft you're editing. Accessibility toggle —
 *  some users prefer the default caret's contrast. */
export const usePathTintedCaret = makeBoolPref(
  "yarrow.pathTintedCaret",
  "yarrow:pathTintedCaret-changed",
  true,
);
