// Editor preferences (Svelte 5 port).
//
// Editor font + per-axis editor toggles (raw markdown, typewriter,
// editorial reading, path-tinted caret, live preview, cook mode).
// Shape mirrors the legacy React hooks, but every store is a singleton
// rune-state object — components consume `editorFont.current.stack`,
// `typewriterMode.value`, etc., and call `.set(...)`.

import {
  workspaceScope,
  readScoped,
  wsKey,
  writeScoped,
} from "./workspaceScope.svelte";

const RAW_KEY = "yarrow.showRawMarkdown";
const RAW_EVT = "yarrow:showRawMarkdown-changed";

// ───────────────── editor font family ─────────────────

export type EditorFontId =
  | "newsreader"
  | "source-serif"
  | "lora"
  | "fraunces"
  | "inter-tight"
  | "georgia"
  | "jetbrains-mono"
  | "fira-code"
  | "source-code-pro"
  | "ibm-plex-mono";

export interface EditorFontChoice {
  id: EditorFontId;
  label: string;
  kind: "serif" | "sans" | "mono";
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
    stack: "'Newsreader', ui-serif, Georgia, serif",
    lineHeight: 1.66,
    sample: "Generous reading rhythm — the default.",
  },
  {
    id: "source-serif",
    label: "Source Serif 4",
    kind: "serif",
    stack: "'Source Serif 4', 'Newsreader', ui-serif, Georgia, serif",
    lineHeight: 1.65,
    sample: "A thinking tool for long-form prose.",
  },
  {
    id: "lora",
    label: "Lora",
    kind: "serif",
    stack: "'Lora', 'Newsreader', ui-serif, Georgia, serif",
    lineHeight: 1.7,
    sample: "Warm contemporary book face with hand-drawn italics.",
  },
  {
    id: "fraunces",
    label: "Fraunces",
    kind: "serif",
    stack: "'Fraunces', ui-serif, Georgia, serif",
    lineHeight: 1.66,
    sample: "Characterful — same family as the wordmark.",
  },
  {
    id: "inter-tight",
    label: "Inter Tight",
    kind: "sans",
    stack: "'Inter Tight', 'Inter', ui-sans-serif, system-ui, sans-serif",
    lineHeight: 1.6,
    sample: "Neutral, legible, no distractions.",
  },
  {
    id: "georgia",
    label: "Georgia",
    kind: "serif",
    stack: "Georgia, ui-serif, 'Newsreader', serif",
    lineHeight: 1.62,
    sample: "A classic — available everywhere, no download.",
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    kind: "mono",
    stack: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
    lineHeight: 1.55,
    sample: "const yarrow = (notes) => notes.map(checkpoint);",
  },
  {
    id: "fira-code",
    label: "Fira Code",
    kind: "mono",
    stack: "'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
    lineHeight: 1.55,
    sample: "fn fold(xs: &[i32]) -> i32 { xs.iter().sum() }",
  },
  {
    id: "source-code-pro",
    label: "Source Code Pro",
    kind: "mono",
    stack: "'Source Code Pro', 'JetBrains Mono', ui-monospace, monospace",
    lineHeight: 1.55,
    sample: "for path in paths { reconcile(path)?; }",
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    kind: "mono",
    stack: "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace",
    lineHeight: 1.55,
    sample: "git checkout -b feature/typewriter-mode",
  },
];

const FONT_KEY = "yarrow.editorFont";
const FONT_EVT = "yarrow:editorFont-changed";
const DEFAULT_FONT: EditorFontId = "newsreader";

function readFont(): EditorFontId {
  const raw = readScoped(FONT_KEY);
  if (raw && EDITOR_FONTS.some((f) => f.id === raw)) return raw as EditorFontId;
  return DEFAULT_FONT;
}

function applyFontToDOM(id: EditorFontId) {
  const font = EDITOR_FONTS.find((f) => f.id === id) ?? EDITOR_FONTS[0];
  const root = document.documentElement;
  root.style.setProperty("--editor-font-family", font.stack);
  root.style.setProperty("--editor-line-height", String(font.lineHeight));
}

class EditorFontStore {
  id = $state<EditorFontId>(readFont());

  constructor() {
    applyFontToDOM(this.id);
    $effect.root(() => {
      $effect(() => { applyFontToDOM(this.id); });

      $effect(() => {
        void workspaceScope.scope;
        const next = readFont();
        if (next !== this.id) this.id = next;
      });

      const onChange = (e: Event) => {
        const detail = (e as CustomEvent<EditorFontId>).detail;
        if (detail && EDITOR_FONTS.some((f) => f.id === detail)) {
          if (this.id !== detail) this.id = detail;
        } else {
          const fresh = readFont();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === FONT_KEY || e.key === wsKey(FONT_KEY)) {
          const fresh = readFont();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      window.addEventListener(FONT_EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(FONT_EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  get current(): EditorFontChoice {
    return EDITOR_FONTS.find((f) => f.id === this.id) ?? EDITOR_FONTS[0];
  }

  set(next: EditorFontId) {
    if (this.id === next) return;
    writeScoped(FONT_KEY, next);
    try { localStorage.setItem(FONT_KEY, next); } catch { /* quota */ }
    applyFontToDOM(next);
    this.id = next;
    window.dispatchEvent(new CustomEvent(FONT_EVT, { detail: next }));
  }
}

export const editorFont = new EditorFontStore();

// Preemptively apply the saved font on module load so the editor
// doesn't flash the default face before the store wires up.
if (typeof window !== "undefined") {
  try { applyFontToDOM(readFont()); } catch { /* DOM not ready */ }
}

// ───────────────── show raw markdown ─────────────────

function readShowRaw(): boolean {
  try { return localStorage.getItem(RAW_KEY) === "true"; } catch { return false; }
}

class ShowRawMarkdownStore {
  value = $state<boolean>(readShowRaw());

  constructor() {
    $effect.root(() => {
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<boolean>).detail;
        const fresh = typeof next === "boolean" ? next : readShowRaw();
        if (fresh !== this.value) this.value = fresh;
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === RAW_KEY) {
          const fresh = readShowRaw();
          if (fresh !== this.value) this.value = fresh;
        }
      };
      window.addEventListener(RAW_EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(RAW_EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  set(next: boolean) {
    if (this.value === next) return;
    try { localStorage.setItem(RAW_KEY, String(next)); } catch { /* quota */ }
    this.value = next;
    window.dispatchEvent(new CustomEvent(RAW_EVT, { detail: next }));
  }

  toggle() { this.set(!this.value); }
}

export const showRawMarkdown = new ShowRawMarkdownStore();

// ───────────────── generic boolean-pref factory ─────────────────
// The toggles below (typewriter, editorial reading, path-tinted caret,
// live preview, cook mode) all share the same shape: localStorage
// boolean, cross-window sync via custom event + storage event, simple
// setter that broadcasts. Factor once, use thrice.

class BoolEditorPref {
  value = $state<boolean>(false);
  #key: string;
  #evt: string;
  #def: boolean;

  constructor(key: string, evt: string, def = false) {
    this.#key = key;
    this.#evt = evt;
    this.#def = def;
    this.value = this.#read();
    $effect.root(() => {
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<boolean>).detail;
        const fresh = typeof next === "boolean" ? next : this.#read();
        if (fresh !== this.value) this.value = fresh;
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === this.#key) {
          const fresh = this.#read();
          if (fresh !== this.value) this.value = fresh;
        }
      };
      window.addEventListener(this.#evt, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(this.#evt, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  #read(): boolean {
    try {
      const raw = localStorage.getItem(this.#key);
      if (raw == null) return this.#def;
      return raw === "true";
    } catch {
      return this.#def;
    }
  }

  set(next: boolean) {
    if (this.value === next) return;
    try { localStorage.setItem(this.#key, String(next)); } catch { /* quota */ }
    this.value = next;
    window.dispatchEvent(new CustomEvent(this.#evt, { detail: next }));
  }

  toggle() { this.set(!this.value); }
}

/** Typewriter mode: the active line stays at the vertical middle of the
 *  editor viewport; the page scrolls underneath you. */
export const typewriterMode = new BoolEditorPref(
  "yarrow.typewriterMode",
  "yarrow:typewriterMode-changed",
);

/** Editorial reading mode: the read-only view uses drop caps, pull quotes,
 *  and generous leading — finished notes read like a magazine spread. */
export const editorialReading = new BoolEditorPref(
  "yarrow.editorialReading",
  "yarrow:editorialReading-changed",
);

/** Path-tinted caret: the caret takes the color of the current path. */
export const pathTintedCaret = new BoolEditorPref(
  "yarrow.pathTintedCaret",
  "yarrow:pathTintedCaret-changed",
  true,
);

/** 2.2.0 Live preview: split the editor into a writing pane on the left
 *  and a rendered-markdown pane on the right. */
export const livePreview = new BoolEditorPref(
  "yarrow.livePreview",
  "yarrow:livePreview-changed",
);

/** 2.2.0 Cook mode: bigger rendered text, generous padding, optional
 *  screen wake-lock — for hands-free reading mid-recipe. */
export const cookMode = new BoolEditorPref(
  "yarrow.cookMode",
  "yarrow:cookMode-changed",
);
