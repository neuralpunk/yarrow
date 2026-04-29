// Font Personality (Svelte 5 port). Pick a voice for your whole vault:
//
//   calm      — warm serif chrome + Newsreader editor; generous and quiet
//   crisp     — modern sans chrome + Inter editor; compact and sharp
//   writerly  — book-weight serif + Source Serif 4 editor; classic, confident
//   notebook  — soft serif chrome + Lora editor; intimate, slightly casual
//
// Each personality is a complete bundle: UI font + editor font + a
// suggested UI scale. When the user picks a personality we set the three
// underlying localStorage keys (`yarrow.uiFont`, `yarrow.editorFont`,
// `yarrow.uiScale`) and fire their respective events so existing stores
// pick the change up without anything rewriting itself.
//
// A user can still tune each axis individually in Settings → Appearance;
// that reverts the personality to "custom" automatically.

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
// vary by which face carries body prose; UI scale is intentionally NOT
// part of the bundle — CSS `zoom` interacts badly with `position: fixed`
// + SVG glyphs + the right-rail layout (the rail's icons render at the
// scaled size but the surrounding spacing chain doesn't always agree),
// and forcing roomy/compact via a personality compounded that into a
// "Calm breaks the UI" report. Scale now stays where the user put it
// in Settings → Appearance, independent of which personality is active.
export const PERSONALITIES: PersonalityChoice[] = [
  {
    id: "calm",
    label: "Calm",
    description: "Newsreader everywhere. Warm, screen-first body serif — quiet and legible.",
    uiFont: "newsreader",
    editorFont: "newsreader",
    uiScale: null,
  },
  {
    id: "crisp",
    label: "Crisp",
    description: "Inter Tight everywhere — modern sans, compact and sharp.",
    uiFont: "inter-tight",
    editorFont: "inter-tight",
    uiScale: null,
  },
  {
    id: "writerly",
    label: "Writerly",
    description: "Sans chrome, Newsreader prose. Editorial split — chrome steps back so the writing leads.",
    uiFont: "inter-tight",
    editorFont: "newsreader",
    uiScale: null,
  },
  {
    id: "notebook",
    label: "Notebook",
    description: "Lora everywhere. Warmer book face with hand-drawn italics — intimate, slightly casual.",
    uiFont: "newsreader",
    editorFont: "lora",
    uiScale: null,
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
  } catch { /* private mode */ }
  return DEFAULT;
}

function fire(key: string, evt: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent(evt, { detail: value }));
}

function apply(id: PersonalityId) {
  const p = PERSONALITIES.find((x) => x.id === id) ?? PERSONALITIES[PERSONALITIES.length - 1];
  if (p.uiFont)     fire("yarrow.uiFont",     "yarrow:uiFont-changed",     p.uiFont);
  if (p.editorFont) fire("yarrow.editorFont", "yarrow:editorFont-changed", p.editorFont);
  if (p.uiScale)    fire("yarrow.uiScale",    "yarrow:uiScale-changed",    p.uiScale);
}

class PersonalityStore {
  id = $state<PersonalityId>(read());
  // "We're the ones firing these events" breadcrumb. Kept off the
  // reactive surface so the listener's read of it doesn't subscribe.
  #applying = false;

  constructor() {
    $effect.root(() => {
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<PersonalityId>).detail;
        if (next && PERSONALITIES.some((p) => p.id === next)) {
          if (this.id !== next) this.id = next;
        } else {
          const fresh = read();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          const fresh = read();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      window.addEventListener(EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);

      // When the user hand-tunes any underlying axis, drop the
      // personality to "custom" so the settings tile doesn't lie
      // about what's active. Skip the events we ourselves fired
      // through `apply()` (the `#applying` breadcrumb is set right
      // before the call and cleared on the next tick).
      const toCustom = () => {
        if (this.#applying) return;
        if (read() === "custom" && this.id === "custom") return;
        try { localStorage.setItem(KEY, "custom"); } catch { /* quota */ }
        if (this.id !== "custom") this.id = "custom";
        window.dispatchEvent(new CustomEvent(EVT, { detail: "custom" }));
      };
      const axisKeys = [
        "yarrow:uiFont-changed",
        "yarrow:editorFont-changed",
        "yarrow:uiScale-changed",
      ];
      axisKeys.forEach((k) => window.addEventListener(k, toCustom));

      return () => {
        window.removeEventListener(EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
        axisKeys.forEach((k) => window.removeEventListener(k, toCustom));
      };
    });
  }

  get current(): PersonalityChoice {
    return (
      PERSONALITIES.find((p) => p.id === this.id) ??
      PERSONALITIES[PERSONALITIES.length - 1]
    );
  }

  set(next: PersonalityId) {
    this.#applying = true;
    try { localStorage.setItem(KEY, next); } catch { /* quota */ }
    apply(next);
    if (this.id !== next) this.id = next;
    window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
    setTimeout(() => { this.#applying = false; }, 0);
  }
}

export const personality = new PersonalityStore();
