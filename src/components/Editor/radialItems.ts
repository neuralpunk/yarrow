import type { StringKey } from "../../lib/i18n/index.svelte";
import { editorEN } from "../../lib/i18n/strings/editor";
import type { RadialIconId } from "./RadialIcon.svelte";

export interface RadialMenuItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: RadialIconId;
  disabled?: boolean;
  onSelect?: () => void;
  submenu?: RadialMenuItem[];
}

export interface RadialCallbacks {
  mappingEnabled: boolean;
  openWikilinkPicker: () => void;
  openTableInsert: () => void;
  openCalloutInsert: () => void;
  openInsertsModal: () => void;
  openFormatModal: () => void;
  sendSelectionToScratchpad: (text: string) => void;
  insertRaw: (
    text: string,
    opts?: { caretOffset?: number; atLineStart?: boolean },
  ) => void;
  wrapSelection: (opening: string, closing: string) => void;
  annotateSelection: (anchor: string) => void;
  cutSelection: () => void;
  pasteAtCursor: () => void;
  selectAll: () => void;
  copySelection: (text: string) => void;
  openTimerPicker: () => void;
  openRecipeClipper: () => void;
  addToShoppingList: () => void;
  cookingEnabled: boolean;
}

type Translator = (key: StringKey, vars?: Record<string, string>) => string;

const enFallback: Translator = (key) =>
  (editorEN as Record<string, string>)[key] ?? key;

const itemCut = (cb: RadialCallbacks, t: Translator, enabled: boolean): RadialMenuItem => ({
  id: "cut",
  label: t("editor.radial.action.cut"),
  sublabel: t("editor.radial.action.cutSub"),
  icon: "cut",
  disabled: !enabled,
  onSelect: cb.cutSelection,
});

const itemCopy = (cb: RadialCallbacks, t: Translator, enabled: boolean, selection: string): RadialMenuItem => ({
  id: "copy",
  label: t("editor.radial.action.copy"),
  sublabel: t("editor.radial.action.copySub"),
  icon: "copy",
  disabled: !enabled,
  onSelect: () => {
    if (selection) cb.copySelection(selection);
  },
});

const itemPaste = (cb: RadialCallbacks, t: Translator): RadialMenuItem => ({
  id: "paste",
  label: t("editor.radial.action.paste"),
  sublabel: t("editor.radial.action.pasteSub"),
  icon: "paste",
  onSelect: cb.pasteAtCursor,
});

const itemSelectAll = (cb: RadialCallbacks, t: Translator): RadialMenuItem => ({
  id: "selectAll",
  label: t("editor.radial.action.selectAll"),
  sublabel: t("editor.radial.action.selectAllSub"),
  icon: "selectAll",
  onSelect: cb.selectAll,
});

const itemScratch = (cb: RadialCallbacks, t: Translator, selection: string): RadialMenuItem => ({
  id: "scratch",
  label: t("editor.radial.action.scratchpad"),
  sublabel: t("editor.radial.action.scratchpadSub"),
  icon: "scratchpad",
  onSelect: () => cb.sendSelectionToScratchpad(selection),
});

const itemAnnotate = (cb: RadialCallbacks, t: Translator, selection: string): RadialMenuItem => ({
  id: "annotate",
  label: t("editor.radial.action.annotate"),
  sublabel: t("editor.radial.action.annotateSub"),
  icon: "annotate",
  onSelect: () => cb.annotateSelection(selection),
});

const radialInsertsParent = (cb: RadialCallbacks, t: Translator): RadialMenuItem => ({
  id: "inserts",
  label: t("editor.radial.parent.inserts"),
  sublabel: t("editor.radial.parent.insertsSub"),
  icon: "inserts",
  onSelect: cb.openInsertsModal,
});

const radialFormatParent = (cb: RadialCallbacks, t: Translator): RadialMenuItem => ({
  id: "format",
  label: t("editor.radial.parent.format"),
  sublabel: t("editor.radial.parent.formatSub"),
  icon: "format",
  onSelect: cb.openFormatModal,
});

function buildInsertsSubmenu(cb: RadialCallbacks, t: Translator): RadialMenuItem[] {
  const items: RadialMenuItem[] = [
    {
      id: "insert-wikilink",
      label: t("editor.radial.insert.wikilink"),
      sublabel: t("editor.radial.insert.wikilinkSub"),
      icon: "wikilink",
      disabled: !cb.mappingEnabled,
      onSelect: cb.openWikilinkPicker,
    },
    {
      id: "insert-task",
      label: t("editor.radial.insert.task"),
      sublabel: t("editor.radial.insert.taskSub"),
      icon: "task",
      onSelect: () => cb.insertRaw("- [ ] ", { atLineStart: true }),
    },
    {
      id: "insert-table",
      label: t("editor.radial.insert.table"),
      sublabel: t("editor.radial.insert.tableSub"),
      icon: "table",
      onSelect: cb.openTableInsert,
    },
    {
      id: "insert-callout",
      label: t("editor.radial.insert.callout"),
      sublabel: t("editor.radial.insert.calloutSub"),
      icon: "callout",
      onSelect: cb.openCalloutInsert,
    },
  ];
  if (cb.cookingEnabled) {
    items.push(
      {
        id: "insert-timer",
        label: t("editor.radial.insert.timer"),
        sublabel: t("editor.radial.insert.timerSub"),
        icon: "timer",
        onSelect: cb.openTimerPicker,
      },
      {
        id: "insert-clip-recipe",
        label: t("editor.radial.insert.clipRecipe"),
        sublabel: t("editor.radial.insert.clipRecipeSub"),
        icon: "recipeUrl",
        onSelect: cb.openRecipeClipper,
      },
      {
        id: "insert-shopping-list",
        label: t("editor.radial.insert.shoppingList"),
        sublabel: t("editor.radial.insert.shoppingListSub"),
        icon: "shopping",
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
      icon: "heading",
      onSelect: () => cb.insertRaw("# ", { atLineStart: true }),
    },
    {
      id: "format-code",
      label: t("editor.radial.insert.code"),
      sublabel: t("editor.radial.insert.codeSub"),
      icon: "code",
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
      icon: "bold",
      onSelect: () => wrap("**", "**", 2),
    },
    {
      id: "format-italic",
      label: t("editor.radial.format.italic"),
      sublabel: t("editor.radial.format.italicSub"),
      icon: "italic",
      onSelect: () => wrap("*", "*", 1),
    },
    {
      id: "format-strikethrough",
      label: t("editor.radial.format.strikethrough"),
      sublabel: t("editor.radial.format.strikethroughSub"),
      icon: "strikethrough",
      onSelect: () => wrap("~~", "~~", 2),
    },
    {
      id: "format-math",
      label: t("editor.radial.format.math"),
      sublabel: t("editor.radial.format.mathSub"),
      icon: "math",
      onSelect: () => wrap("$", "$", 1),
    },
  ];
}

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

export function buildLinearInsertItems(
  cb: RadialCallbacks,
  t: Translator = enFallback,
): RadialMenuItem[] {
  return [
    {
      id: "inserts",
      label: t("editor.radial.parent.inserts"),
      sublabel: t("editor.radial.parent.insertsSub"),
      icon: "inserts",
      submenu: buildInsertsSubmenu(cb, t),
    },
    {
      id: "format",
      label: t("editor.radial.parent.format"),
      sublabel: t("editor.radial.parent.formatSub"),
      icon: "format",
      submenu: buildFormatSubmenu(cb, t, ""),
    },
    itemCut(cb, t, false),
    itemCopy(cb, t, false, ""),
    itemPaste(cb, t),
    itemSelectAll(cb, t),
  ];
}

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
      icon: "format",
      submenu: buildFormatSubmenu(cb, t, selection),
    },
  ];
}
