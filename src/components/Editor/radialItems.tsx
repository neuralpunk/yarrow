import type { RadialMenuItem } from "./RadialMenu";
import type { StringKey } from "../../lib/i18n";
import { editorEN } from "../../lib/i18n/strings/editor";

// ────────────── Editor right-click items ──────────────
//
// 2.2.0: the radial layout is now wider — Inserts and Format are
// modal "rooms" rather than direct items, and the rest of the slots
// carry clipboard verbs (cut, copy, paste, select all). The shape of
// the radial therefore changes by selection state:
//
//   no selection: Inserts… · Format… · Cut(disabled) · Copy(disabled)
//                · Paste · Select All
//   with selection: Cut · Copy · Paste · Scratch Pad · Annotate · Format…
//
// The linear (non-radial) right-click menu mirrors the same set, but
// "Inserts…" and "Format…" become slide-out submenus instead of
// opening modals — same conventions any standard desktop app uses.
//
// All labels go through a `Translator` (a `useT()` from the hosting
// component). The radial owns icons; AppShell owns the state behind
// the callbacks.

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const WikilinkIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const TableIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 4v16M15 4v16" />
  </svg>
);

const TaskIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <rect x="3" y="5" width="16" height="16" rx="2" />
    <path d="m7 12 3 3 7-7" />
  </svg>
);

const CalloutIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4l-4 4v-4H6a2 2 0 0 1-2-2Z" />
    <path d="M12 8v4M12 14h.01" />
  </svg>
);

const CodeIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
  </svg>
);

const HeadingIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
    <path d="M6 4v16M18 4v16M6 12h12" />
  </svg>
);

const ScratchpadIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8M8 12h8M8 17h5" />
  </svg>
);

const CopyIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);

const CutIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M8.12 8.12 19 19" />
    <path d="M15 4 8.12 15.88" />
  </svg>
);

const PasteIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M9 4h6v3H9z" />
    <path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
  </svg>
);

const SelectAllIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeDasharray="3 2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const BoldIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
    <path d="M7 5h6a4 4 0 0 1 0 8H7zM7 13h7a4 4 0 0 1 0 8H7z" />
  </svg>
);

const ItalicIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
    <path d="M19 4h-9M14 20H5M15 4 9 20" />
  </svg>
);

const StrikethroughIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M5 12h14" />
    <path d="M16 7q-3-2-7-1.5T7 9q0 2 4 3" />
    <path d="M8 17q3 2 7 1.5T17 15" />
  </svg>
);

const MathIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M5 19h2L13 5h2" />
    <path d="M9 12h6" />
    <path d="M16 14l4 4M20 14l-4 4" />
  </svg>
);

const InsertsIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M12 5v14M5 12h14" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);

const TimerIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <circle cx="12" cy="13" r="7" />
    <path d="M12 9v4l2.5 2" />
    <path d="M9 3h6" />
  </svg>
);

const RecipeUrlIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
    <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
  </svg>
);

const ShoppingIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M5 7h14l-1.4 11.2a1.5 1.5 0 0 1-1.5 1.3H7.9a1.5 1.5 0 0 1-1.5-1.3L5 7z" />
    <path d="M9 10V6a3 3 0 0 1 6 0v4" />
  </svg>
);

const FormatIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M5 6h14M5 12h10M5 18h6" />
  </svg>
);

const AnnotateIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M4 4h16v12H8l-4 4z" />
    <path d="M8 10h8M8 13h5" />
  </svg>
);

export interface RadialCallbacks {
  mappingEnabled: boolean;
  /** Open the Wikilink picker modal (no-selection or replace-selection). */
  openWikilinkPicker: () => void;
  /** Open the table-insert modal. */
  openTableInsert: () => void;
  /** Open the callout-insert modal. */
  openCalloutInsert: () => void;
  /** Open the new "Inserts…" container modal (radial-only entry). */
  openInsertsModal: () => void;
  /** Open the new "Format…" container modal (radial-only entry). */
  openFormatModal: () => void;
  /** Send the highlighted text to the scratchpad as a quote-block. */
  sendSelectionToScratchpad: (text: string) => void;
  /** Insert raw text at the cursor (or replace the active selection). */
  insertRaw: (
    text: string,
    opts?: { caretOffset?: number; atLineStart?: boolean },
  ) => void;
  /** Wrap the active selection with `opening` … `closing`. Empty
   *  selection inserts the wrappers and lands the caret between. */
  wrapSelection: (opening: string, closing: string) => void;
  /** Pin a margin-ink annotation anchored at the current selection. */
  annotateSelection: (anchor: string) => void;
  /** Cut, paste, select all — go through the editor so they
   *  participate in CodeMirror's undo history. */
  cutSelection: () => void;
  pasteAtCursor: () => void;
  selectAll: () => void;
  /** Copy `text` to the system clipboard, surface a toast, and close
   *  the radial. Routes through the Rust-backed clipboard plugin so
   *  the result is visible to other apps too. */
  copySelection: (text: string) => void;
  /** Open the timer-picker (presets + custom) and insert the chosen
   *  `[label](timer:Xm)` markdown link at the cursor. */
  openTimerPicker: () => void;
  /** Open the recipe-URL clipper modal. */
  openRecipeClipper: () => void;
  /** Send the active note's `## Ingredients` section to the workspace
   *  shopping list. AppShell handles the empty-state toast when the
   *  note has no `## Ingredients` section. */
  addToShoppingList: () => void;
  /** When false, the timer / clip-recipe / shopping-list entries are
   *  filtered out of the Inserts submenu so users who don't bake
   *  don't see them. Controlled by Settings → Writing → Cooking. */
  cookingEnabled: boolean;
}

/** Translator type — accepts the same shape `useT()` returns. */
type Translator = (key: StringKey, vars?: Record<string, string>) => string;

/** Default translator that returns the English string for the given key.
 *  Used when callers don't pass a translator. The radial labels are
 *  short enough that an EN fallback is acceptable when the locale isn't
 *  threaded through. */
const enFallback: Translator = (key) =>
  (editorEN as Record<string, string>)[key] ?? key;

// ──────────────── shared item builders ────────────────
//
// These return individual primitives that the radial / linear
// builders below compose into a final list. Keeping the action
// definitions in one place means a future change (e.g. swapping the
// keyboard hint for a strikethrough) lands in exactly one spot.

const itemCut = (cb: RadialCallbacks, t: Translator, enabled: boolean): RadialMenuItem => ({
  id: "cut",
  label: t("editor.radial.action.cut"),
  sublabel: t("editor.radial.action.cutSub"),
  icon: CutIcon,
  disabled: !enabled,
  onSelect: cb.cutSelection,
});

const itemCopy = (cb: RadialCallbacks, t: Translator, enabled: boolean, selection: string): RadialMenuItem => ({
  id: "copy",
  label: t("editor.radial.action.copy"),
  sublabel: t("editor.radial.action.copySub"),
  icon: CopyIcon,
  disabled: !enabled,
  onSelect: () => {
    if (selection) cb.copySelection(selection);
  },
});

const itemPaste = (cb: RadialCallbacks, t: Translator): RadialMenuItem => ({
  id: "paste",
  label: t("editor.radial.action.paste"),
  sublabel: t("editor.radial.action.pasteSub"),
  icon: PasteIcon,
  onSelect: cb.pasteAtCursor,
});

const itemSelectAll = (cb: RadialCallbacks, t: Translator): RadialMenuItem => ({
  id: "selectAll",
  label: t("editor.radial.action.selectAll"),
  sublabel: t("editor.radial.action.selectAllSub"),
  icon: SelectAllIcon,
  onSelect: cb.selectAll,
});

const itemScratch = (cb: RadialCallbacks, t: Translator, selection: string): RadialMenuItem => ({
  id: "scratch",
  label: t("editor.radial.action.scratchpad"),
  sublabel: t("editor.radial.action.scratchpadSub"),
  icon: ScratchpadIcon,
  onSelect: () => cb.sendSelectionToScratchpad(selection),
});

const itemAnnotate = (cb: RadialCallbacks, t: Translator, selection: string): RadialMenuItem => ({
  id: "annotate",
  label: t("editor.radial.action.annotate"),
  sublabel: t("editor.radial.action.annotateSub"),
  icon: AnnotateIcon,
  onSelect: () => cb.annotateSelection(selection),
});

// ──────────────── radial parents — open modals ────────────────

const radialInsertsParent = (cb: RadialCallbacks, t: Translator): RadialMenuItem => ({
  id: "inserts",
  label: t("editor.radial.parent.inserts"),
  sublabel: t("editor.radial.parent.insertsSub"),
  icon: InsertsIcon,
  onSelect: cb.openInsertsModal,
});

const radialFormatParent = (cb: RadialCallbacks, t: Translator): RadialMenuItem => ({
  id: "format",
  label: t("editor.radial.parent.format"),
  sublabel: t("editor.radial.parent.formatSub"),
  icon: FormatIcon,
  onSelect: cb.openFormatModal,
});

// ──────────────── linear parents — submenus ────────────────

function buildInsertsSubmenu(cb: RadialCallbacks, t: Translator): RadialMenuItem[] {
  const items: RadialMenuItem[] = [
    {
      id: "insert-wikilink",
      label: t("editor.radial.insert.wikilink"),
      sublabel: t("editor.radial.insert.wikilinkSub"),
      icon: WikilinkIcon,
      disabled: !cb.mappingEnabled,
      onSelect: cb.openWikilinkPicker,
    },
    {
      id: "insert-task",
      label: t("editor.radial.insert.task"),
      sublabel: t("editor.radial.insert.taskSub"),
      icon: TaskIcon,
      onSelect: () => cb.insertRaw("- [ ] ", { atLineStart: true }),
    },
    {
      id: "insert-table",
      label: t("editor.radial.insert.table"),
      sublabel: t("editor.radial.insert.tableSub"),
      icon: TableIcon,
      onSelect: cb.openTableInsert,
    },
    {
      id: "insert-callout",
      label: t("editor.radial.insert.callout"),
      sublabel: t("editor.radial.insert.calloutSub"),
      icon: CalloutIcon,
      onSelect: cb.openCalloutInsert,
    },
  ];
  // 2.2.0 round 2 — cooking-extra-gated entries. When the Cooking
  // additions extra is off (default), these don't surface at all in
  // the linear right-click Inserts submenu. The Inserts modal does
  // its own filtering.
  if (cb.cookingEnabled) {
    items.push(
      {
        id: "insert-timer",
        label: t("editor.radial.insert.timer"),
        sublabel: t("editor.radial.insert.timerSub"),
        icon: TimerIcon,
        onSelect: cb.openTimerPicker,
      },
      {
        id: "insert-clip-recipe",
        label: t("editor.radial.insert.clipRecipe"),
        sublabel: t("editor.radial.insert.clipRecipeSub"),
        icon: RecipeUrlIcon,
        onSelect: cb.openRecipeClipper,
      },
      {
        id: "insert-shopping-list",
        label: t("editor.radial.insert.shoppingList"),
        sublabel: t("editor.radial.insert.shoppingListSub"),
        icon: ShoppingIcon,
        onSelect: cb.addToShoppingList,
      },
    );
  }
  return items;
}

function buildFormatSubmenu(cb: RadialCallbacks, t: Translator, selection: string): RadialMenuItem[] {
  const wrap = (opening: string, closing: string, emptyCaret: number) => {
    if (selection) {
      cb.wrapSelection(opening, closing);
    } else {
      cb.insertRaw(opening + closing, { caretOffset: emptyCaret });
    }
  };
  return [
    {
      id: "format-heading",
      label: t("editor.radial.insert.heading"),
      sublabel: t("editor.radial.insert.headingSub"),
      icon: HeadingIcon,
      onSelect: () => cb.insertRaw("# ", { atLineStart: true }),
    },
    {
      id: "format-code",
      label: t("editor.radial.insert.code"),
      sublabel: t("editor.radial.insert.codeSub"),
      icon: CodeIcon,
      onSelect: () =>
        cb.insertRaw("```\n\n```\n", {
          atLineStart: true,
          caretOffset: "```\n".length,
        }),
    },
    {
      id: "format-bold",
      label: t("editor.radial.format.bold"),
      sublabel: t("editor.radial.format.boldSub"),
      icon: BoldIcon,
      onSelect: () => wrap("**", "**", 2),
    },
    {
      id: "format-italic",
      label: t("editor.radial.format.italic"),
      sublabel: t("editor.radial.format.italicSub"),
      icon: ItalicIcon,
      onSelect: () => wrap("*", "*", 1),
    },
    {
      id: "format-strikethrough",
      label: t("editor.radial.format.strikethrough"),
      sublabel: t("editor.radial.format.strikethroughSub"),
      icon: StrikethroughIcon,
      onSelect: () => wrap("~~", "~~", 2),
    },
    {
      id: "format-math",
      label: t("editor.radial.format.math"),
      sublabel: t("editor.radial.format.mathSub"),
      icon: MathIcon,
      onSelect: () => wrap("$", "$", 1),
    },
  ];
}

// ──────────────── radial: no-selection set ────────────────
//
// Inserts… · Format… · Cut(disabled) · Copy(disabled) · Paste · Select All

export function buildRadialInsertItems(
  cb: RadialCallbacks,
  t: Translator = enFallback,
): RadialMenuItem[] {
  return [
    radialInsertsParent(cb, t),
    radialFormatParent(cb, t),
    itemCut(cb, t, false),
    itemCopy(cb, t, false, ""),
    itemPaste(cb, t),
    itemSelectAll(cb, t),
  ];
}

// ──────────────── radial: with-selection set ────────────────
//
// Cut · Copy · Paste · Scratch Pad · Annotate · Format…

export function buildRadialSelectionItems(
  selection: string,
  cb: RadialCallbacks,
  t: Translator = enFallback,
): RadialMenuItem[] {
  return [
    itemCut(cb, t, true),
    itemCopy(cb, t, true, selection),
    itemPaste(cb, t),
    itemScratch(cb, t, selection),
    itemAnnotate(cb, t, selection),
    radialFormatParent(cb, t),
  ];
}

// ──────────────── linear (right-click): no-selection ────────────────
//
// Inserts ▸ · Format ▸ · Cut(disabled) · Copy(disabled) · Paste · Select All

export function buildLinearInsertItems(
  cb: RadialCallbacks,
  t: Translator = enFallback,
): RadialMenuItem[] {
  return [
    {
      id: "inserts",
      label: t("editor.radial.parent.inserts"),
      sublabel: t("editor.radial.parent.insertsSub"),
      icon: InsertsIcon,
      submenu: buildInsertsSubmenu(cb, t),
    },
    {
      id: "format",
      label: t("editor.radial.parent.format"),
      sublabel: t("editor.radial.parent.formatSub"),
      icon: FormatIcon,
      submenu: buildFormatSubmenu(cb, t, ""),
    },
    itemCut(cb, t, false),
    itemCopy(cb, t, false, ""),
    itemPaste(cb, t),
    itemSelectAll(cb, t),
  ];
}

// ──────────────── linear (right-click): with-selection ────────────────
//
// Cut · Copy · Paste · Scratch Pad · Annotate · Format ▸

export function buildLinearSelectionItems(
  selection: string,
  cb: RadialCallbacks,
  t: Translator = enFallback,
): RadialMenuItem[] {
  return [
    itemCut(cb, t, true),
    itemCopy(cb, t, true, selection),
    itemPaste(cb, t),
    itemScratch(cb, t, selection),
    itemAnnotate(cb, t, selection),
    {
      id: "format",
      label: t("editor.radial.parent.format"),
      sublabel: t("editor.radial.parent.formatSub"),
      icon: FormatIcon,
      submenu: buildFormatSubmenu(cb, t, selection),
    },
  ];
}
