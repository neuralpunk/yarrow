import type { RadialMenuItem } from "./RadialMenu";

// ────────────── Editor radial items ──────────────
// Two variants: one when the user right-clicked without a selection
// (inserts) and one with a selection (transforms). Kept out of
// `AppShell.tsx` to keep that file from ballooning any further.

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

const PathIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <circle cx="5" cy="5" r="1.8" />
    <circle cx="5" cy="19" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
    <path d="M5 7v10M6.5 6.3 17 10.8M6.5 17.7 17 13.3" />
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

export interface RadialCallbacks {
  mappingEnabled: boolean;
  openWikilinkPicker: () => void;
  openTableInsert: () => void;
  openCalloutInsert: () => void;
  startPathFrom: (seed: string) => void;
  sendSelectionToScratchpad: (text: string) => void;
  insertRaw: (
    text: string,
    opts?: { caretOffset?: number; atLineStart?: boolean },
  ) => void;
  /** Pin a margin-ink annotation anchored at the current selection. */
  annotateSelection: (anchor: string) => void;
}

const AnnotateIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
    <path d="M4 4h16v12H8l-4 4z" />
    <path d="M8 10h8M8 13h5" />
  </svg>
);

function dispatchInsertRaw(
  text: string,
  opts?: { caretOffset?: number; atLineStart?: boolean },
) {
  window.dispatchEvent(
    new CustomEvent("yarrow:editor-insert-raw", {
      detail: { text, ...opts },
    }),
  );
}

/** Items shown when no text is selected — six inserts for headings,
 *  tasks, callouts, code blocks, tables, and wikilinks. */
export function buildRadialInsertItems(cb: RadialCallbacks): RadialMenuItem[] {
  return [
    {
      id: "wikilink",
      label: "Wikilink",
      sublabel: "[[ … ]]",
      icon: WikilinkIcon,
      disabled: !cb.mappingEnabled,
      onSelect: cb.openWikilinkPicker,
    },
    {
      id: "table",
      label: "Table",
      sublabel: "rows × cols",
      icon: TableIcon,
      onSelect: cb.openTableInsert,
    },
    {
      id: "task",
      label: "Task",
      sublabel: "- [ ]",
      icon: TaskIcon,
      onSelect: () =>
        cb.insertRaw("- [ ] ", { atLineStart: true }),
    },
    {
      id: "code",
      label: "Code",
      sublabel: "``` block",
      icon: CodeIcon,
      // Caret lands between the fences, on the empty middle line.
      onSelect: () =>
        cb.insertRaw("```\n\n```\n", {
          atLineStart: true,
          caretOffset: "```\n".length,
        }),
    },
    {
      id: "callout",
      label: "Callout",
      sublabel: "note, tip, warning…",
      icon: CalloutIcon,
      // Opens a dedicated modal with type picker, title/body inputs,
      // and a live preview so the author sees exactly what will land.
      onSelect: cb.openCalloutInsert,
    },
    {
      id: "heading",
      label: "Heading",
      sublabel: "#",
      icon: HeadingIcon,
      onSelect: () => cb.insertRaw("# ", { atLineStart: true }),
    },
  ];
}

/** Items shown when the user right-clicked on a selection. Transforms
 *  (bold, italic), forwards (scratchpad, path-from), and copy — most
 *  common actions a writer reaches for with text highlighted. */
export function buildRadialSelectionItems(
  selection: string,
  cb: RadialCallbacks,
): RadialMenuItem[] {
  return [
    {
      id: "wikilink",
      label: "Wikilink",
      sublabel: "replace",
      icon: WikilinkIcon,
      disabled: !cb.mappingEnabled,
      onSelect: cb.openWikilinkPicker,
    },
    {
      id: "path",
      label: "New path",
      sublabel: "from this",
      icon: PathIcon,
      onSelect: () => cb.startPathFrom(selection),
    },
    {
      id: "bold",
      label: "Bold",
      sublabel: "**…**",
      icon: BoldIcon,
      onSelect: () => dispatchInsertRaw(`**${selection}**`),
    },
    {
      id: "italic",
      label: "Italic",
      sublabel: "*…*",
      icon: ItalicIcon,
      onSelect: () => dispatchInsertRaw(`*${selection}*`),
    },
    {
      id: "annotate",
      label: "Annotate",
      sublabel: "margin ink",
      icon: AnnotateIcon,
      onSelect: () => cb.annotateSelection(selection),
    },
    {
      id: "scratch",
      label: "Scratchpad",
      sublabel: "send to",
      icon: ScratchpadIcon,
      onSelect: () => cb.sendSelectionToScratchpad(selection),
    },
    {
      id: "copy",
      label: "Copy",
      sublabel: "⌘C",
      icon: CopyIcon,
      onSelect: () => {
        navigator.clipboard?.writeText(selection).catch(() => {});
      },
    },
  ];
}
