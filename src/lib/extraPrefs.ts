import { useCallback, useEffect, useState } from "react";

/**
 * Four opt-in editor extras that ship as lazy-loaded chunks — off by
 * default so the app's startup stays lean, on when the user wants them.
 * Each toggle is persisted in localStorage and mirrored across tabs /
 * components via a window event, the same pattern `editorPrefs` uses
 * for raw-markdown and editor-font prefs.
 *
 * Enabling a toggle causes NoteEditor to remount with the matching
 * chunk dynamically imported. Disabling frees the extension (but the
 * parsed chunk stays in memory until the page reloads — that's fine,
 * the next editor mount just skips the factory).
 */

export type ExtraKey =
  | "codeHighlight"
  | "math"
  | "spell"
  | "imagePreview"
  | "radialMenu"
  | "cooking";

interface ExtraDescriptor {
  key: ExtraKey;
  /** localStorage key — versioned so we can rename later without
   *  clobbering state. */
  storageKey: string;
  /** Window event fired when the pref flips. */
  event: string;
  /** Initial value when the user hasn't explicitly toggled. All of
   *  the heavy lazy-loaded extras default off; lightweight UI prefs
   *  that improve day-one feel (e.g. `radialMenu`) default on. */
  defaultOn?: boolean;
}

const DESCRIPTORS: Record<ExtraKey, ExtraDescriptor> = {
  codeHighlight: {
    key: "codeHighlight",
    storageKey: "yarrow.extras.codeHighlight",
    event: "yarrow:extras-codeHighlight-changed",
  },
  math: {
    key: "math",
    storageKey: "yarrow.extras.math",
    event: "yarrow:extras-math-changed",
  },
  spell: {
    key: "spell",
    storageKey: "yarrow.extras.spell",
    event: "yarrow:extras-spell-changed",
  },
  imagePreview: {
    key: "imagePreview",
    storageKey: "yarrow.extras.imagePreview",
    event: "yarrow:extras-imagePreview-changed",
    // 2.2.0: defaulted on. With it off, paste/drop produced raw
    // `![alt](attachments/…)` markdown — which read as "the image
    // didn't get attached" even though the file was on disk and the
    // ref was inserted. Inline preview is light enough to ship by
    // default; users who want a strict text-first editor can still
    // disable it from Settings → Writing extras.
    defaultOn: true,
  },
  radialMenu: {
    key: "radialMenu",
    storageKey: "yarrow.extras.radialMenu",
    event: "yarrow:extras-radialMenu-changed",
    defaultOn: true,
  },
  cooking: {
    key: "cooking",
    storageKey: "yarrow.extras.cooking",
    event: "yarrow:extras-cooking-changed",
    // 2.2.0 round 2: default OFF. Most users aren't here for the
    // baking flows; flipping this on enables the cook-mode toggle,
    // inline timer picker, recipe URL clipper, and "add ingredients
    // to shopping list" surface in one place.
  },
};

function read(key: ExtraKey): boolean {
  const d = DESCRIPTORS[key];
  try {
    const raw = localStorage.getItem(d.storageKey);
    // Unset means "no explicit choice" — fall back to the descriptor's
    // `defaultOn`. Explicit "false" wins even when defaultOn is true,
    // so a user who turns off the radial stays off across reloads.
    if (raw === null) return d.defaultOn ?? false;
    return raw === "true";
  } catch {
    return d.defaultOn ?? false;
  }
}

function useExtra(key: ExtraKey): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => read(key));

  useEffect(() => {
    const d = DESCRIPTORS[key];
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail;
      setV(typeof next === "boolean" ? next : read(key));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === d.storageKey) setV(read(key));
    };
    window.addEventListener(d.event, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(d.event, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  const set = useCallback(
    (next: boolean) => {
      const d = DESCRIPTORS[key];
      try {
        localStorage.setItem(d.storageKey, String(next));
      } catch {}
      setV(next);
      window.dispatchEvent(new CustomEvent(d.event, { detail: next }));
    },
    [key],
  );

  return [v, set];
}

export const useExtraCodeHighlight = () => useExtra("codeHighlight");
export const useExtraMath = () => useExtra("math");
export const useExtraSpell = () => useExtra("spell");
export const useExtraImagePreview = () => useExtra("imagePreview");
export const useExtraRadialMenu = () => useExtra("radialMenu");
export const useExtraCooking = () => useExtra("cooking");

/** Read every extra synchronously. Useful outside React for the editor
 *  bootstrap — we need the values at mount time, not via a hook. */
export function readAllExtras(): Record<ExtraKey, boolean> {
  return {
    codeHighlight: read("codeHighlight"),
    math: read("math"),
    spell: read("spell"),
    imagePreview: read("imagePreview"),
    radialMenu: read("radialMenu"),
    cooking: read("cooking"),
  };
}

export interface ExtraInfo {
  key: ExtraKey;
  label: string;
  /** One-line pitch for the Settings row. */
  blurb: string;
  /** Longer explanation of what enabling actually does. */
  detail: string;
}

export const EXTRAS: ExtraInfo[] = [
  {
    key: "codeHighlight",
    label: "Code syntax highlighting",
    blurb: "colorize code inside ``` fences (Python, JS, Rust, etc.)",
    detail:
      "Loads CodeMirror's 100+ language grammars on demand. Off by default because most notes don't contain code — enabling adds roughly 1 MB to the editor's working set.",
  },
  {
    key: "math",
    label: "Math (KaTeX)",
    blurb: "render $x^2$ and $$…$$ blocks as typeset equations",
    detail:
      "Lazy-loads the KaTeX renderer. Off by default because the LaTeX subset only matters for STEM / research notes; raw dollar-delimited math stays plain otherwise.",
  },
  {
    key: "spell",
    label: "Spell check",
    blurb: "underline misspelled words and suggest fixes on right-click",
    detail:
      "Loads the English dictionary (~800 KB) and the nspell runtime. Off by default; right-click on a squiggle surfaces suggestions once the dictionary is ready.",
  },
  {
    key: "imagePreview",
    label: "Inline image previews",
    blurb: "render ![](attachments/…) images beneath their markdown line",
    detail:
      "Small chunk — the cost is opinionated: you'll see the image in the writing pane instead of the raw markdown. On by default; turn it off for a strict text-first editor.",
  },
  {
    key: "radialMenu",
    label: "Radial right-click menu",
    blurb:
      "open a pie menu on right-click instead of a vertical list — faster once you learn the directions",
    detail:
      "On by default. Turn it off to get the plain linear context menu with the same actions — wikilink, table, new path, scratchpad, copy — just laid out as a standard drop-down.",
  },
  {
    key: "cooking",
    label: "Cooking additions",
    blurb:
      "inline timers, cook mode, recipe URL clipper, and the shopping-list flow",
    detail:
      "Off by default — most note-takers aren't here for the baking flows. Turn on to surface a cook-mode toggle on the right rail, the timer picker / clip recipe / send-to-shopping-list buttons in the Inserts menu, and the matching command-palette entries. Existing recipe notes work either way; this only controls whether the chrome is visible.",
  },
];
