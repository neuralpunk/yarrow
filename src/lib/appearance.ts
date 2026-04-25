// Appearance preferences — font family + size for UI chrome and for the
// editor. Themes ship via the existing `lib/theme` hook; this module
// handles the font side so the two concerns stay separately toggleable.
//
// Preferences live in localStorage; applied via CSS custom properties
// on `:root` so every component that reads `var(--serif)` /
// `var(--sans)` / `var(--ui-font-size)` / `var(--editor-font-size)`
// picks them up with zero prop-drilling.

import { useEffect, useState } from "react";

export type FontFamily =
  | "serif-lora"
  | "serif-garamond"
  | "serif-system"
  | "sans-inter"
  | "sans-source"
  | "sans-system";

export type FontSize = "small" | "medium" | "large";

const FAMILY_KEY = "yarrow.ui.font";
const SIZE_KEY = "yarrow.ui.size";
const EDITOR_FAMILY_KEY = "yarrow.editor.font";
const EDITOR_SIZE_KEY = "yarrow.editor.size";

export const FAMILIES: Array<{ id: FontFamily; label: string; stack: string; kind: "serif" | "sans" }> = [
  {
    id: "serif-lora",
    label: "Lora",
    kind: "serif",
    stack: `"Lora", "Iowan Old Style", "Georgia", ui-serif, serif`,
  },
  {
    id: "serif-garamond",
    label: "Garamond",
    kind: "serif",
    stack: `"EB Garamond", "Garamond", "Iowan Old Style", "Georgia", ui-serif, serif`,
  },
  {
    id: "serif-system",
    label: "System serif",
    kind: "serif",
    stack: `ui-serif, Georgia, Cambria, "Times New Roman", serif`,
  },
  {
    id: "sans-inter",
    label: "Inter",
    kind: "sans",
    stack: `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif`,
  },
  {
    id: "sans-source",
    label: "Source Sans",
    kind: "sans",
    stack: `"Source Sans 3", "Source Sans Pro", system-ui, sans-serif`,
  },
  {
    id: "sans-system",
    label: "System sans",
    kind: "sans",
    stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  },
];

export const SIZES: Array<{ id: FontSize; label: string; ui: number; editor: number }> = [
  { id: "small", label: "Small", ui: 13, editor: 14 },
  { id: "medium", label: "Medium", ui: 14, editor: 15 },
  { id: "large", label: "Large", ui: 16, editor: 17 },
];

function familyStack(id: FontFamily | null): string {
  return FAMILIES.find((f) => f.id === id)?.stack ?? "";
}
function sizeValues(id: FontSize | null): { ui: number; editor: number } {
  return SIZES.find((s) => s.id === id) ?? SIZES[1];
}

function apply(
  uiFamily: FontFamily,
  uiSize: FontSize,
  editorFamily: FontFamily,
  editorSize: FontSize,
) {
  const root = document.documentElement;
  root.style.setProperty("--ui-font", familyStack(uiFamily));
  const sz = sizeValues(uiSize);
  root.style.setProperty("--ui-font-size", `${sz.ui}px`);
  root.style.setProperty("--editor-font", familyStack(editorFamily));
  const esz = sizeValues(editorSize);
  root.style.setProperty("--editor-font-size", `${esz.editor}px`);
}

function isFamily(v: unknown): v is FontFamily {
  return typeof v === "string" && FAMILIES.some((f) => f.id === v);
}
function isSize(v: unknown): v is FontSize {
  return typeof v === "string" && SIZES.some((s) => s.id === v);
}

export function useAppearance() {
  const [uiFamily, setUiFamilyRaw] = useState<FontFamily>(() => {
    const v = localStorage.getItem(FAMILY_KEY);
    return isFamily(v) ? v : "serif-system";
  });
  const [uiSize, setUiSizeRaw] = useState<FontSize>(() => {
    const v = localStorage.getItem(SIZE_KEY);
    return isSize(v) ? v : "medium";
  });
  const [editorFamily, setEditorFamilyRaw] = useState<FontFamily>(() => {
    const v = localStorage.getItem(EDITOR_FAMILY_KEY);
    return isFamily(v) ? v : "serif-system";
  });
  const [editorSize, setEditorSizeRaw] = useState<FontSize>(() => {
    const v = localStorage.getItem(EDITOR_SIZE_KEY);
    return isSize(v) ? v : "medium";
  });

  useEffect(() => {
    apply(uiFamily, uiSize, editorFamily, editorSize);
    localStorage.setItem(FAMILY_KEY, uiFamily);
    localStorage.setItem(SIZE_KEY, uiSize);
    localStorage.setItem(EDITOR_FAMILY_KEY, editorFamily);
    localStorage.setItem(EDITOR_SIZE_KEY, editorSize);
  }, [uiFamily, uiSize, editorFamily, editorSize]);

  return {
    uiFamily,
    uiSize,
    editorFamily,
    editorSize,
    setUiFamily: setUiFamilyRaw,
    setUiSize: setUiSizeRaw,
    setEditorFamily: setEditorFamilyRaw,
    setEditorSize: setEditorSizeRaw,
  };
}

/** Install the appearance variables on first module load, before any
 *  React component renders. Prevents a flash of unstyled content on
 *  page load since the values apply synchronously. */
export function installAppearanceAtBoot(): void {
  if (typeof window === "undefined") return;
  const uiFamily = (localStorage.getItem(FAMILY_KEY) as FontFamily) || "serif-system";
  const uiSize = (localStorage.getItem(SIZE_KEY) as FontSize) || "medium";
  const editorFamily =
    (localStorage.getItem(EDITOR_FAMILY_KEY) as FontFamily) || "serif-system";
  const editorSize = (localStorage.getItem(EDITOR_SIZE_KEY) as FontSize) || "medium";
  apply(uiFamily, uiSize, editorFamily, editorSize);
}
