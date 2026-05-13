import {
  workspaceScope,
  readScoped,
  wsKey,
  writeScoped,
} from "./workspaceScope.svelte";

/**
 * Editor extras (3.2+ — collapsed to a single user-preference surface
 * after the persona system was retired). Each toggle persists in
 * localStorage (workspace-scoped) and broadcasts via window events.
 */

export type ExtraKey =
  | "codeHighlight"
  | "spell"
  | "imagePreview"
  | "radialMenu"
  | "slashCommands";

interface ExtraDescriptor {
  key: ExtraKey;
  storageKey: string;
  event: string;
  /** Initial value when the user hasn't explicitly toggled. */
  defaultOn?: boolean;
}

const DESCRIPTORS: Record<ExtraKey, ExtraDescriptor> = {
  codeHighlight: {
    key: "codeHighlight",
    storageKey: "yarrow.extras.codeHighlight",
    event: "yarrow:extras-codeHighlight-changed",
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
    defaultOn: true,
  },
  radialMenu: {
    key: "radialMenu",
    storageKey: "yarrow.extras.radialMenu",
    event: "yarrow:extras-radialMenu-changed",
    defaultOn: true,
  },
  slashCommands: {
    key: "slashCommands",
    storageKey: "yarrow.extras.slashCommands",
    event: "yarrow:extras-slashCommands-changed",
    defaultOn: true,
  },
};

function read(key: ExtraKey): boolean {
  const d = DESCRIPTORS[key];
  const raw = readScoped(d.storageKey);
  if (raw === null) return d.defaultOn ?? false;
  return raw === "true";
}

class ExtraPref {
  value = $state<boolean>(false);
  #key: ExtraKey;

  constructor(key: ExtraKey) {
    this.#key = key;
    this.value = read(key);
    $effect.root(() => {
      const d = DESCRIPTORS[key];
      $effect(() => {
        void workspaceScope.scope;
        const fresh = read(this.#key);
        if (fresh !== this.value) this.value = fresh;
      });
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<boolean>).detail;
        const fresh = typeof next === "boolean" ? next : read(this.#key);
        if (fresh !== this.value) this.value = fresh;
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === d.storageKey || e.key === wsKey(d.storageKey)) {
          const fresh = read(this.#key);
          if (fresh !== this.value) this.value = fresh;
        }
      };
      window.addEventListener(d.event, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(d.event, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  set(next: boolean) {
    if (this.value === next) return;
    const d = DESCRIPTORS[this.#key];
    writeScoped(d.storageKey, String(next));
    try { localStorage.setItem(d.storageKey, String(next)); } catch { /* quota */ }
    this.value = next;
    window.dispatchEvent(new CustomEvent(d.event, { detail: next }));
  }

  toggle() { this.set(!this.value); }
}

export const extraCodeHighlight = new ExtraPref("codeHighlight");
export const extraSpell = new ExtraPref("spell");
export const extraImagePreview = new ExtraPref("imagePreview");
export const extraRadialMenu = new ExtraPref("radialMenu");
export const extraSlashCommands = new ExtraPref("slashCommands");

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
    key: "spell",
    label: "Spell check",
    blurb: "underline misspelled words and suggest fixes on right-click",
    detail:
      "Loads the English dictionary (~800 KB) and the Hunspell-WASM runtime. Off by default; right-click on a squiggle surfaces suggestions once the dictionary is ready.",
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
    key: "slashCommands",
    label: "Slash command panel",
    blurb:
      "type / at the start of a line for a filterable list of insertions and actions",
    detail:
      "On by default. Modeled on Obsidian's slash panel — covers headings, callouts, tables, math, wikilinks, embeds, tags, ?? markers, plus app-level actions (palette, scratchpad, focus, history). Off disables the panel entirely; / behaves as a plain character.",
  },
];
