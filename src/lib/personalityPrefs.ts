// Font Personality (2.1). Pick a voice for your whole vault:
//
//   calm      — warm serif chrome + Newsreader editor; generous and quiet
//   crisp     — modern sans chrome + Inter editor; compact and sharp
//   writerly  — book-weight serif + Source Serif 4 editor; classic, confident
//   notebook  — soft serif chrome + Lora editor; intimate, slightly casual
//
// Each personality is a complete bundle: UI font + editor font + a
// suggested UI scale. When the user picks a personality we set the three
// underlying localStorage keys (`yarrow.uiFont`, `yarrow.editorFont`,
// `yarrow.uiScale`) and fire their respective events so existing hooks
// pick the change up without anything rewriting itself.
//
// A user can still tune each axis individually in Settings → Appearance;
// that reverts the personality to "custom" automatically.

import { useCallback, useEffect, useState } from "react";

export type PersonalityId = "calm" | "crisp" | "writerly" | "notebook" | "custom";

export interface PersonalityChoice {
  id: PersonalityId;
  label: string;
  /** Short one-liner shown under the name in the picker tile. */
  description: string;
  /** Keys we drive when the user picks this personality. `custom` drives none. */
  uiFont: string | null;     // matches UI_FONTS[].id
  editorFont: string | null; // matches EDITOR_FONTS[].id
  uiScale: string | null;    // matches UI_SCALES[].id
}

// 2.1 revised: the stack is Newsreader (body serif), Fraunces
// (display), Inter Tight (chrome), JetBrains Mono (meta). Personalities
// vary by which face carries body prose and how roomy the chrome is.
export const PERSONALITIES: PersonalityChoice[] = [
  {
    id: "calm",
    label: "Calm",
    description: "Newsreader everywhere. Warm, screen-first body serif — quiet and legible.",
    uiFont: "newsreader",
    editorFont: "newsreader",
    uiScale: "roomy",
  },
  {
    id: "crisp",
    label: "Crisp",
    description: "Inter Tight everywhere — modern sans, compact and sharp.",
    uiFont: "inter-tight",
    editorFont: "inter-tight",
    uiScale: "cozy",
  },
  {
    id: "writerly",
    label: "Writerly",
    description: "Sans chrome, Newsreader prose. Editorial split — chrome steps back so the writing leads.",
    uiFont: "inter-tight",
    editorFont: "newsreader",
    uiScale: "cozy",
  },
  {
    id: "notebook",
    label: "Notebook",
    description: "Lora everywhere. Warmer book face with hand-drawn italics — intimate, slightly casual.",
    uiFont: "newsreader",
    editorFont: "lora",
    uiScale: "roomy",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Whatever you've tuned by hand. No bundle applied.",
    uiFont: null,
    editorFont: null,
    uiScale: null,
  },
];

const KEY = "yarrow.personality";
const EVT = "yarrow:personality-changed";
const DEFAULT: PersonalityId = "custom";

function read(): PersonalityId {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && PERSONALITIES.some((p) => p.id === raw)) return raw as PersonalityId;
  } catch {}
  return DEFAULT;
}

function fire(key: string, evt: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
  window.dispatchEvent(new CustomEvent(evt, { detail: value }));
}

function apply(id: PersonalityId) {
  const p = PERSONALITIES.find((x) => x.id === id) ?? PERSONALITIES[PERSONALITIES.length - 1];
  if (p.uiFont)     fire("yarrow.uiFont",     "yarrow:uiFont-changed",     p.uiFont);
  if (p.editorFont) fire("yarrow.editorFont", "yarrow:editorFont-changed", p.editorFont);
  if (p.uiScale)    fire("yarrow.uiScale",    "yarrow:uiScale-changed",    p.uiScale);
}

export function usePersonality(): [PersonalityChoice, (id: PersonalityId) => void] {
  const [id, setId] = useState<PersonalityId>(read);

  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<PersonalityId>).detail;
      if (next && PERSONALITIES.some((p) => p.id === next)) setId(next);
      else setId(read());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setId(read());
    };
    window.addEventListener(EVT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // When the user hand-tunes any underlying axis, drop the personality to
  // "custom" so the settings tile doesn't lie about what's active.
  useEffect(() => {
    const toCustom = () => {
      if (read() === "custom") return;
      try { localStorage.setItem(KEY, "custom"); } catch {}
      setId("custom");
      window.dispatchEvent(new CustomEvent(EVT, { detail: "custom" }));
    };
    const keys = ["yarrow:uiFont-changed", "yarrow:editorFont-changed", "yarrow:uiScale-changed"];
    // Flag: ignore the events we ourselves fire via `apply()` above. We set
    // a module-scoped breadcrumb right before applying and clear it after.
    const wrapper = (_e: Event) => { if (applyingRef.flag) return; toCustom(); };
    keys.forEach((k) => window.addEventListener(k, wrapper));
    return () => keys.forEach((k) => window.removeEventListener(k, wrapper));
  }, []);

  const set = useCallback((next: PersonalityId) => {
    applyingRef.flag = true;
    try { localStorage.setItem(KEY, next); } catch {}
    apply(next);
    setId(next);
    window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
    // Drop the flag on the next tick so any event listeners we just
    // triggered see it set, but later hand-tunes see it cleared.
    setTimeout(() => { applyingRef.flag = false; }, 0);
  }, []);

  const current = PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[PERSONALITIES.length - 1];
  return [current, set];
}

// Module-level "we're the ones firing these events" breadcrumb. Kept on an
// object reference so the closure inside `useEffect` can read the current
// value rather than the one at mount time.
const applyingRef = { flag: false };
