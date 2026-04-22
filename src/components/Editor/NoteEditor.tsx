import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Compartment, EditorState, RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder, tooltips, ViewPlugin, ViewUpdate, Decoration, DecorationSet, MatchDecorator } from "@codemirror/view";
import { defaultKeymap, history as cmHistory, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap, type CompletionSource } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import WikilinkPreview, {
  cachePreview as sharedCachePreview,
  getCachedPreview as sharedGetCachedPreview,
} from "../WikilinkPreview";
import type { Note, NoteSummary, Provenance } from "../../lib/types";
import { api } from "../../lib/tauri";
import { editorialDate, relativeTime, timeOfDayPhrase } from "../../lib/format";
import { isDivergent } from "../../lib/forkDetection";
import {
  useExtraCodeHighlight,
  useExtraImagePreview,
  useExtraMath,
  useExtraSpell,
} from "../../lib/extraPrefs";
import {
  usePathTintedCaret,
  useTypewriterMode,
} from "../../lib/editorPrefs";
import { colorForPath } from "../../lib/pathAwareness";
import AnnotationsGutter from "./AnnotationsGutter";
import type { Annotation } from "../../lib/types";
import calloutsPlugin from "./extensions/callouts";
import ForkSuggestion from "./ForkSuggestion";
import TagChips from "./TagChips";

interface Props {
  note: Note;
  notes: NoteSummary[];
  currentPath: string;
  debounceMs: number;
  askThinkingOnClose: boolean;
  showRawMarkdown?: boolean;
  jumpToLine?: { line: number; nonce: number };
  /** Pass the slug back so the parent saves to the right note even if the
   *  user has already switched to a different one before the debounce
   *  fires (race that previously produced cross-note content swaps).
   *  Also pass the path the editor was mounted on — otherwise a flush
   *  triggered by a path switch routes to the *new* path and cross-
   *  contaminates content between main and an override. */
  onSave: (slug: string, body: string, thinking?: string, path?: string) => void;
  onTitleChange: (title: string) => void;
  /** Bump to tell the editor to re-sync its displayed title to the
   *  canonical frontmatter value — used when the parent rejects a rename
   *  (user cancelled the "update wikilinks?" prompt) so the input field
   *  doesn't sit on a title the file never actually took. */
  titleRevertNonce?: number;
  onDirtyChange: (dirty: boolean) => void;
  onNavigate: (slug: string) => void;
  onBodyChange?: (body: string) => void;
  onOpenFork: () => void;
  /** All paths and which slugs each contains — for the wikilink hover chip. */
  pathNotes?: Record<string, string[]>;
  /** "Start a path here" CTA fired from the wikilink hover popover. The
   *  slug is what the user hovered on. */
  onBranchFromWikilink?: (slug: string) => void;
  /** When false (basic workspace mode), the "Insert wikilink" context-menu
   *  option and fork suggestions are suppressed — the editor is a plain
   *  markdown surface without note-to-note linking affordances. */
  mappingEnabled?: boolean;
  /** Persist a new tag list for the note (slug, tags). Slug is the one
   *  captured at editor-mount so a save races against a note-switch land
   *  on the right note (same fix as `onSave`). */
  onTagsChange?: (slug: string, tags: string[]) => void;
  /** All tags currently in the workspace, fed into the chip-input
   *  autocomplete so users converge on consistent vocabulary. */
  tagSuggestions?: string[];
  /** User-assigned accent colours per path (hex, from `PathCollection.color`).
   *  Feeds the path-tinted caret accessibility feature. Undefined/unset ≡
   *  fall back to the hue derived from the path name. */
  pathColorOverrides?: Record<string, string>;
  /** Persist the updated annotations array on the note. Null `at`/`anchor`
   *  means "no change" — the editor hands the whole array back to the
   *  shell, which writes it to frontmatter via `cmd_save_note_full`. */
  onAnnotationsChange?: (slug: string, annotations: Annotation[]) => void;
}

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, class: "cm-heading1" },
  { tag: tags.heading2, class: "cm-heading2" },
  { tag: tags.heading3, class: "cm-heading3" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.link, color: "var(--yeld)" },
  { tag: tags.url, color: "var(--yeld)" },
]);

// ────────────── pipe-table navigation ──────────────
// A row is a line whose first non-whitespace character is `|`. Tab inside
// such a row jumps the cursor to the start of the next cell; Shift-Tab
// steps back. When Tab lands past the last cell of the last table row,
// we append a fresh empty row so the user can keep filling the table
// without reaching for the mouse.

function isTableRow(text: string): boolean {
  return /^\s*\|/.test(text);
}

/** Positions of every `|` in `line` — the cell boundaries we navigate
 *  between. Returned as absolute document offsets (line.from + index). */
function pipePositions(line: { from: number; text: string }): number[] {
  const out: number[] = [];
  for (let i = 0; i < line.text.length; i++) {
    if (line.text[i] === "|") out.push(line.from + i);
  }
  return out;
}

/** Where the next cell's content starts — the offset right after a pipe,
 *  skipping one leading space if the author put one there. */
function cellStartAfter(line: { from: number; text: string }, pipeAbs: number): number {
  const rel = pipeAbs - line.from + 1;
  if (line.text[rel] === " ") return pipeAbs + 2;
  return pipeAbs + 1;
}

function tableTab(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (!isTableRow(line.text)) return false;
  const pipes = pipePositions(line);
  // Next pipe strictly after the cursor — that boundary opens the next
  // cell. If we're past the last one, advance to the next row (or append
  // one when we're already on the final row of the table).
  const nextPipe = pipes.find((p) => p > sel.head);
  if (nextPipe !== undefined) {
    const target = cellStartAfter(line, nextPipe);
    view.dispatch({
      selection: { anchor: Math.min(target, line.to) },
      scrollIntoView: true,
    });
    return true;
  }
  // Past the last cell of this row. If the next line is also a row,
  // land in its first cell; otherwise append a blank row sized to this
  // row's column count.
  if (line.number < state.doc.lines) {
    const next = state.doc.line(line.number + 1);
    if (isTableRow(next.text)) {
      const nextPipes = pipePositions(next);
      if (nextPipes.length > 0) {
        view.dispatch({
          selection: { anchor: cellStartAfter(next, nextPipes[0]) },
          scrollIntoView: true,
        });
        return true;
      }
    }
  }
  // Build a blank row matching this row's column count.
  const cols = Math.max(1, pipes.length - 1);
  const blank = "|" + " | ".repeat(cols).replace(/\s$/, " ") + "|";
  const insert = "\n" + blank;
  view.dispatch({
    changes: { from: line.to, to: line.to, insert },
    selection: { anchor: line.to + 2 + (blank.indexOf("|") + 2) },
    scrollIntoView: true,
    userEvent: "input.type",
  });
  // Anchor the cursor to the start of the new row's first cell.
  const newLineStart = line.to + 1;
  const newPipes: number[] = [];
  for (let i = 0; i < blank.length; i++) {
    if (blank[i] === "|") newPipes.push(newLineStart + i);
  }
  if (newPipes.length > 0) {
    view.dispatch({
      selection: { anchor: newPipes[0] + 2 },
    });
  }
  return true;
}

function tableShiftTab(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (!isTableRow(line.text)) return false;
  const pipes = pipePositions(line);
  // Previous pipe strictly before the cursor opens the current cell.
  // Jumping to the cell *before* that means the second-prior pipe.
  const priorIdx = (() => {
    for (let i = pipes.length - 1; i >= 0; i--) {
      if (pipes[i] < sel.head) return i;
    }
    return -1;
  })();
  if (priorIdx >= 1) {
    view.dispatch({
      selection: { anchor: cellStartAfter(line, pipes[priorIdx - 1]) },
      scrollIntoView: true,
    });
    return true;
  }
  // At the first cell — step back into the previous row's last cell.
  if (line.number > 1) {
    const prev = state.doc.line(line.number - 1);
    if (isTableRow(prev.text)) {
      const prevPipes = pipePositions(prev);
      if (prevPipes.length >= 2) {
        view.dispatch({
          selection: { anchor: cellStartAfter(prev, prevPipes[prevPipes.length - 2]) },
          scrollIntoView: true,
        });
        return true;
      }
    }
  }
  // No earlier cell — fall through so Shift-Tab still outdents when the
  // user is at the very start of a table.
  return false;
}

function wikilinkPlugin() {
  const matcher = new MatchDecorator({
    regexp: /!?\[\[([^\]\n]+)\]\]/g,
    decoration: (m: RegExpExecArray) =>
      Decoration.mark({
        class: m[0].startsWith("!")
          ? "cm-yarrow-wikilink cm-yarrow-embed"
          : "cm-yarrow-wikilink",
      }),
  });
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = matcher.createDeco(view); }
      update(update: ViewUpdate) {
        this.decorations = matcher.updateDeco(update, this.decorations);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

// Short-lived cache for wikilink hover previews. Hovering the same link five
// times in a row should only fetch the target note once; cleared on editor
// unmount. We cap by count, not bytes — excerpts are always ≤480 chars.
// Wikilink hover preview cache + component live in `../WikilinkPreview` so
// reading mode shares the same surface.
const cachePreview = sharedCachePreview;

// Image preview / math / spell plugins live in `./extensions/*` now so
// they can be dynamic-imported based on the Writing extras toggles.

async function attachFilesToEditor(files: File[], view: EditorView, at: number) {
  const fragments: string[] = [];
  for (const f of files) {
    // Filter out directories. The drag/drop File API reports folders as
    // zero-sized entries with an empty `type`; attempting arrayBuffer() on
    // one silently produces a 0-byte "file". Skip rather than attach garbage.
    if (f.size === 0 && !f.type) {
      console.warn("skipped directory drop:", f.name);
      continue;
    }
    try {
      const buf = await f.arrayBuffer();
      if (buf.byteLength === 0) continue;
      const b64 = arrayBufferToBase64(buf);
      const ref = await api.attachBytes(f.name || "attachment", b64);
      fragments.push(ref.markdown);
    } catch (e) {
      console.error("attach failed", e);
    }
  }
  if (fragments.length === 0) return;
  // Ensure attachments start on their own line so the image widget matches.
  const doc = view.state.doc;
  const pos = Math.min(at, doc.length);
  const before = pos > 0 ? doc.sliceString(Math.max(0, pos - 1), pos) : "\n";
  const prefix = before === "\n" || pos === 0 ? "" : "\n\n";
  const insert = `${prefix}${fragments.join("\n\n")}\n`;
  view.dispatch({
    changes: { from: pos, to: pos, insert },
    selection: { anchor: pos + insert.length },
  });
}

function isLikelyUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

function escapeMdLinkText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // Chunked to avoid stack blow-ups on large files.
  const CHUNK = 0x8000;
  let s = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(s);
}

/**
 * Hide inline markdown tokens (`**`, `[[`, `]]`) on lines the cursor isn't
 * currently on — so the body reads like prose, not raw markdown. The active
 * line stays untouched so the token you're editing is visible. Disabled when
 * `showRawMarkdown` is on (toggled from Settings → Writing).
 */
function hideSyntaxPlugin() {
  // Heading prefix (`## `), emphasis markers (`**`, `__`, `*`, `_`), wikilink
  // brackets (`[[`, `]]`), and inline code ticks are hidden on non-active
  // lines so the body reads as rendered prose. The active line stays raw so
  // you can edit the tokens without chasing invisible characters.
  const INLINE_RE = /\*\*|__|\[\[|\]\]|`/g;
  const HEADING_RE = /^(#{1,6})\s/;
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = this.build(view); }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const sel = view.state.selection.main;
        const activeLine = view.state.doc.lineAt(sel.head).number;
        const ranges: Array<[number, number]> = [];
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = view.state.doc.lineAt(pos);
            if (line.number !== activeLine) {
              const hm = HEADING_RE.exec(line.text);
              if (hm) {
                // Hide the `#`s and the single trailing space — the heading
                // text itself keeps its styled size/weight via the markdown
                // highlight style.
                ranges.push([line.from, line.from + hm[0].length]);
              }
              INLINE_RE.lastIndex = 0;
              let m: RegExpExecArray | null;
              while ((m = INLINE_RE.exec(line.text)) !== null) {
                const start = line.from + m.index;
                ranges.push([start, start + m[0].length]);
              }
            }
            pos = line.to + 1;
          }
        }
        // RangeSetBuilder requires strictly ascending `from` order; we
        // collected heading-first-then-inline per line so sort to be safe.
        ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        for (const [a, b] of ranges) {
          builder.add(a, b, Decoration.replace({}));
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}

// Math / spell / image-preview / code-highlight plugins live under
// `./extensions/*` and are dynamic-imported in the mount effect when the
// corresponding Writing Extra is on.

function questionPlugin() {
  const matcher = new MatchDecorator({
    regexp: /\?\?[^\n]*/g,
    decoration: () => Decoration.mark({ class: "cm-yarrow-question" }),
  });
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = matcher.createDeco(view); }
      update(update: ViewUpdate) {
        this.decorations = matcher.updateDeco(update, this.decorations);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

export default function NoteEditor({
  note,
  notes,
  currentPath,
  debounceMs,
  showRawMarkdown,
  jumpToLine,
  onSave,
  onTitleChange,
  titleRevertNonce,
  onDirtyChange,
  onNavigate,
  onBodyChange,
  onOpenFork,
  pathNotes,
  onBranchFromWikilink,
  mappingEnabled = true,
  onTagsChange,
  tagSuggestions,
  pathColorOverrides,
  onAnnotationsChange,
}: Props) {
  // Writing-extras toggles. Each flips dynamic loading of a heavier
  // extension on/off; the editor re-mounts whenever one changes (via the
  // useEffect deps below) so the new extensions set takes effect without
  // a page reload.
  const [codeHighlightOn] = useExtraCodeHighlight();
  const [mathOn] = useExtraMath();
  const [spellOn] = useExtraSpell();
  const [imagePreviewOn] = useExtraImagePreview();
  // 2.0 posture toggles. Neither remounts the editor — they flip classes
  // on existing DOM and rely on a live-reconfigurable plugin compartment
  // to update behaviour on the fly. Typewriter mode adds an update
  // listener that pins the active line to the viewport centre.
  const [typewriterOn] = useTypewriterMode();
  const [caretTintOn] = usePathTintedCaret();

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Fresh-notes pointer for the wikilink completion source. Captured at
  // mount time via closure, read at completion time — so a note added
  // after mount appears in the `[[` dropdown without a full remount.
  const notesRef = useRef(notes);
  notesRef.current = notes;
  // Populated by the spell extension when it's enabled; consumed by the
  // contextmenu handler to surface suggestions for misspelled words. Null
  // means the spell extra is off (no underlines exist either, so the
  // handler's misspelled-class branch never fires).
  const spellSuggestRef = useRef<((word: string) => string[]) | null>(null);
  // Compartment so flipping reading ↔ writing mode reconfigures a single
  // extension without tearing down the whole editor (which would lose
  // scroll position, undo history, and introduce a visible flicker).
  const hideSyntaxCompartment = useRef(new Compartment());
  const saveTimer = useRef<number | null>(null);
  const lastSavedBody = useRef<string>(note.body);
  // Slug captured at editor-mount time. Every save passes this back so the
  // parent writes to the note that *was* on screen, not whatever's active
  // now. Without it, switching notes mid-debounce caused note A's body to
  // overwrite note B (the cross-note swap bug).
  const mountedSlugRef = useRef<string>(note.slug);
  // Same idea for the active path. The <NoteEditor> `key` includes
  // currentPath, so a path switch unmounts this instance and the cleanup
  // below may flush a pending debounce. Without capturing the path at
  // mount time, that flush would route through `handleSave` with the
  // *new* currentPath — writing what-if edits onto main (and vice versa).
  const mountedPathRef = useRef<string>(currentPath);
  // Last (words, chars) tuple we dispatched for the status bar. Lets us
  // suppress the no-op "still 0/0" dispatch on every keystroke while
  // typing without a selection.
  const lastSelectionRef = useRef<{ words: number; chars: number }>({ words: 0, chars: 0 });
  // Keep the latest `onSave` reachable from the editor's unmount cleanup.
  // Without this, a path-switch remount would clear the debounced timer
  // without flushing — losing whatever the user typed in the last <debounce.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  // Debounce body-broadcast to the shell. Every keystroke used to fan out to
  // OpenQuestions / Transclusions / anything reading `currentBody`; these
  // consumers don't need keystroke-granular updates.
  const bodyBroadcastTimer = useRef<number | null>(null);
  const onBodyChangeRef = useRef(onBodyChange);
  onBodyChangeRef.current = onBodyChange;
  const [title, setTitle] = useState(note.frontmatter.title || note.slug);
  // When the parent tells us a rename was rejected/cancelled, pull the
  // displayed title back to the canonical frontmatter value. Without this,
  // the input field would sit on a name the file never actually took.
  useEffect(() => {
    if (titleRevertNonce == null) return;
    setTitle(note.frontmatter.title || note.slug);
  }, [titleRevertNonce, note.frontmatter.title, note.slug]);
  const [showForkSuggestion, setShowForkSuggestion] = useState(false);
  const dismissedForkRef = useRef<Set<string>>(new Set());
  const [blame, setBlame] = useState<{ x: number; y: number; p: Provenance } | null>(null);
  const blameTimer = useRef<number | null>(null);
  // Monotonic counter incremented every time a hover starts, gets cleared,
  // or the editor unmounts. The provenance Promise checks the epoch hasn't
  // moved on before calling setBlame, so a stale result can't pop a
  // tooltip belonging to a previous hover (or a previous note).
  const blameEpochRef = useRef(0);
  const [justSaved, setJustSaved] = useState(false);
  const justSavedTimer = useRef<number | null>(null);
  const [preview, setPreview] = useState<
    | { x: number; y: number; placeAbove: boolean; title: string; body: string; slug?: string; missing?: boolean }
    | null
  >(null);
  const previewTimer = useRef<number | null>(null);
  const previewTargetRef = useRef<HTMLElement | null>(null);
  /** Delay before hiding the wikilink popover, so the user can move the
   *  cursor from the link into the popover to click "Start a path…". */
  const previewHideTimer = useRef<number | null>(null);

  const resolveWikilink = useCallback(
    (query: string): NoteSummary | undefined => {
      return notes.find(
        (n) =>
          n.title.toLowerCase() === query.toLowerCase() ||
          n.slug === query ||
          n.slug === query.toLowerCase().replace(/\s+/g, "-"),
      );
    },
    [notes],
  );

  const scanDivergent = useCallback((body: string) => {
    const paragraphs = body.split(/\n{2,}/);
    const last = paragraphs[paragraphs.length - 1] ?? "";
    const key = last.trim();
    if (!key) return false;
    if (dismissedForkRef.current.has(key)) return false;
    return isDivergent(last);
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;
    // Re-anchor the captured slug for this mount cycle. The useEffect
    // re-runs whenever `note.slug` changes (full editor re-init), so this
    // always reflects the note actually on screen.
    mountedSlugRef.current = note.slug;
    mountedPathRef.current = currentPath;

    // Async scaffolding: each enabled Writing Extra dynamically imports
    // its module, which splits that module into its own chunk. Off
    // toggles skip the import entirely — the chunk never loads, its
    // code never parses, RAM stays lean. When one flips on, the effect
    // re-runs (thanks to the deps array below) and pulls the chunk in.
    let cancelled = false;
    let view: EditorView | null = null;

    const mount = async () => {
      // Diagnostic: leave a breadcrumb in the console so enabling an
      // extra and not seeing the effect is debuggable without needing a
      // custom debug build. Only one line per mount, gated on prefs.
      console.info(
        "[yarrow] editor mount — extras:",
        JSON.stringify({
          codeHighlight: codeHighlightOn,
          math: mathOn,
          spell: spellOn,
          imagePreview: imagePreviewOn,
        }),
      );
      // Markdown base: when code-highlight extra is on we feed the full
      // language-data pack in; otherwise plain markdown suffices.
      let markdownExtension: Extension;
      if (codeHighlightOn) {
        const { codeHighlightedMarkdown } = await import("./extensions/codeHighlight");
        if (cancelled) return;
        markdownExtension = await codeHighlightedMarkdown();
        console.info("[yarrow] code highlighting loaded");
      } else {
        markdownExtension = markdown();
      }

      const extraExtensions: Extension[] = [];
      if (mathOn) {
        const { loadMathExtension } = await import("./extensions/math");
        if (cancelled) return;
        extraExtensions.push(await loadMathExtension());
        console.info("[yarrow] math extension loaded");
      }
      if (spellOn) {
        const { loadSpellExtension } = await import("./extensions/spell");
        if (cancelled) return;
        const { extension, suggest } = await loadSpellExtension();
        spellSuggestRef.current = suggest;
        extraExtensions.push(extension);
        console.info("[yarrow] spell extension loaded");
      } else {
        spellSuggestRef.current = null;
      }
      if (imagePreviewOn) {
        const { imagePreviewPlugin } = await import("./extensions/imagePreview");
        if (cancelled) return;
        extraExtensions.push(imagePreviewPlugin());
        console.info("[yarrow] image preview extension loaded");
      }
      // Build the autocomplete stack. Both the slash menu and the
      // wikilink `[[` dropdown feed a single `autocompletion(...)` so
      // their tooltips share config and can't conflict. The tooltip is
      // parented to `document.body` with `position: "fixed"` so nested
      // `overflow-hidden` ancestors in the AppShell layout can't clip
      // it — the 1.2-era bug that manifested as "nothing happens when
      // I type /" on WebKit/Wayland (webkit2gtk on Linux) was exactly
      // this: the popup rendered inside an invisible scroll region.
      const completionSources: CompletionSource[] = [];

      // Wikilink completion is always on when note-to-note mapping is
      // enabled (i.e. not in basic/plain-markdown workspace mode).
      if (mappingEnabled) {
        const wl = await import("./extensions/wikilinkAutocomplete");
        if (cancelled) return;
        completionSources.push(wl.wikilinkSource(() => notesRef.current));
        extraExtensions.push(wl.wikilinkInputHandler);
        console.info("[yarrow] wikilink autocomplete loaded");
      }

      if (completionSources.length > 0) {
        extraExtensions.push(
          autocompletion({
            override: completionSources,
            defaultKeymap: true,
            icons: false,
            activateOnTyping: true,
          }),
          tooltips({ parent: document.body, position: "fixed" }),
        );
      }

      if (cancelled || !hostRef.current) return;

      const state = EditorState.create({
        doc: note.body,
        extensions: [
          cmHistory(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            // Table-aware Tab/Shift-Tab: inside a pipe-table row, jump to
            // the next/previous cell; when Tab lands past the last cell
            // of the last row, insert a fresh row. Listed before
            // `indentWithTab` so the table behavior wins when applicable;
            // everywhere else it falls through to normal indent.
            { key: "Tab", run: tableTab, shift: tableShiftTab },
            indentWithTab,
          ]),
          closeBrackets(),
          bracketMatching(),
          indentOnInput(),
          markdownExtension,
          syntaxHighlighting(highlightStyle),
          syntaxHighlighting(defaultHighlightStyle),
          placeholder("Start writing…"),
          EditorView.lineWrapping,
          wikilinkPlugin(),
          questionPlugin(),
          calloutsPlugin(),
          ...extraExtensions,
          hideSyntaxCompartment.current.of(showRawMarkdown ? [] : hideSyntaxPlugin()),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const body = update.state.doc.toString();
            const dirty = body !== lastSavedBody.current;
            onDirtyChange(dirty);
            if (bodyBroadcastTimer.current) window.clearTimeout(bodyBroadcastTimer.current);
            bodyBroadcastTimer.current = window.setTimeout(() => {
              onBodyChangeRef.current?.(body);
            }, 140);
            setShowForkSuggestion(mappingEnabled && scanDivergent(body));
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            if (dirty) {
              saveTimer.current = window.setTimeout(() => {
                lastSavedBody.current = body;
                onSave(mountedSlugRef.current, body, undefined, mountedPathRef.current);
                onDirtyChange(false);
                setJustSaved(true);
                if (justSavedTimer.current) window.clearTimeout(justSavedTimer.current);
                justSavedTimer.current = window.setTimeout(() => setJustSaved(false), 1200);
              }, debounceMs);
            }
          }
          // Broadcast selection size for the status bar. Two-stage filter:
          // skip if neither selection nor doc changed, and skip if the
          // emitted (words, chars) tuple is identical to the last one we
          // sent. The second stage matters: ordinary typing keeps the
          // selection empty, so without it every keystroke would dispatch
          // a "0/0" event that re-rendered the AppShell tree.
          if (update.selectionSet || update.docChanged) {
            const sel = update.state.selection.main;
            const selected = sel.empty
              ? ""
              : update.state.sliceDoc(sel.from, sel.to);
            const chars = selected.length;
            const count = selected
              ? (selected.trim().match(/\S+/g)?.length ?? 0)
              : 0;
            const last = lastSelectionRef.current;
            if (last.words !== count || last.chars !== chars) {
              lastSelectionRef.current = { words: count, chars };
              window.dispatchEvent(new CustomEvent("yarrow:selection-changed", {
                detail: { words: count, chars },
              }));
            }
          }
        }),
        EditorView.domEventHandlers({
          click: (e, _view) => {
            const raw = e.target as HTMLElement;
            const target = (raw.closest(".cm-yarrow-wikilink") as HTMLElement | null) ?? raw;
            if (!target.classList.contains("cm-yarrow-wikilink")) return false;
            const m = /^!?\[\[(.+)\]\]$/.exec((target.textContent || "").trim());
            if (!m) return false;
            const match = resolveWikilink(m[1]);
            if (match) {
              e.preventDefault();
              e.stopPropagation();
              onNavigate(match.slug);
              return true;
            }
            return false;
          },
          // Right-click surfaces our context menu. With a selection, the
          // menu hosts selection-level actions (scratchpad, copy, start a
          // path from this). Without one, it still offers "Insert
          // wikilink…" so users can pick a target note without having to
          // know its exact name. Spellcheck click on a misspelled word
          // takes precedence and shows the suggestions popover instead.
          contextmenu: (e, view) => {
            const sel = view.state.selection.main;
            if (sel.empty) {
              const target = e.target as HTMLElement;
              if (target.classList.contains("cm-yarrow-misspelled")) {
                const word = (target.textContent || "").trim();
                if (word) {
                  const pos = view.posAtDOM(target);
                  const line = view.state.doc.lineAt(pos);
                  const idx = line.text.indexOf(word);
                  if (idx >= 0) {
                    const from = line.from + idx;
                    const to = from + word.length;
                    e.preventDefault();
                    e.stopPropagation();
                    // Guard: the class `.cm-yarrow-misspelled` only
                    // exists when the spell extra is on, which also sets
                    // the ref. Fall back defensively just in case.
                    const suggestions = spellSuggestRef.current
                      ? spellSuggestRef.current(word)
                      : [];
                    window.dispatchEvent(new CustomEvent("yarrow:editor-spellcheck", {
                      detail: {
                        word, suggestions,
                        x: e.clientX, y: e.clientY,
                        from, to,
                      },
                    }));
                    return true;
                  }
                }
              }
              // Empty selection, not on a misspelled word — show the
              // no-selection variant of the menu (wikilink-only).
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent("yarrow:editor-contextmenu", {
                detail: { text: "", x: e.clientX, y: e.clientY },
              }));
              return true;
            }
            const text = view.state.sliceDoc(sel.from, sel.to);
            e.preventDefault();
            e.stopPropagation();
            // Whitespace-only selections behave as "no selection" so the
            // user still gets a menu — just the insert variant instead
            // of the transform variant.
            window.dispatchEvent(new CustomEvent("yarrow:editor-contextmenu", {
              detail: { text: text.trim() ? text : "", x: e.clientX, y: e.clientY },
            }));
            return true;
          },
          mouseover: (e, _view) => {
            const raw = e.target as HTMLElement;
            const target = (raw.closest(".cm-yarrow-wikilink") as HTMLElement | null) ?? raw;
            if (!target.classList.contains("cm-yarrow-wikilink")) return false;
            const m = /^!?\[\[(.+)\]\]$/.exec((target.textContent || "").trim());
            if (!m) return false;
            const query = m[1];

            if (previewTimer.current) window.clearTimeout(previewTimer.current);
            if (blameTimer.current) window.clearTimeout(blameTimer.current);
            blameEpochRef.current++;
            setBlame(null);
            previewTargetRef.current = target;

            previewTimer.current = window.setTimeout(() => {
              if (previewTargetRef.current !== target) return;
              const rect = target.getBoundingClientRect();
              const PREVIEW_W = 360;
              const PREVIEW_H_EST = 180;
              const spaceBelow = window.innerHeight - rect.bottom;
              const placeAbove = spaceBelow < PREVIEW_H_EST + 20 && rect.top > PREVIEW_H_EST;
              const x = Math.max(
                12,
                Math.min(window.innerWidth - PREVIEW_W - 12, rect.left),
              );
              const y = placeAbove ? rect.top - 8 : rect.bottom + 6;

              const match = resolveWikilink(query);
              if (!match) {
                setPreview({ x, y, placeAbove, title: query, body: "", missing: true });
                return;
              }
              const cached = sharedGetCachedPreview(match.slug);
              if (cached) {
                setPreview({ x, y, placeAbove, ...cached, slug: match.slug });
                return;
              }
              api
                .readNote(match.slug)
                .then((n) => {
                  if (previewTargetRef.current !== target) return;
                  const payload = {
                    title: n.frontmatter.title || n.slug,
                    body: n.body,
                  };
                  cachePreview(n.slug, payload);
                  setPreview({ x, y, placeAbove, ...payload, slug: n.slug });
                })
                .catch(() => {
                  if (previewTargetRef.current !== target) return;
                  setPreview({ x, y, placeAbove, title: query, body: "", missing: true });
                });
            }, 140);
            return false;
          },
          mouseout: (e, _view) => {
            const raw = e.target as HTMLElement;
            const target = (raw.closest(".cm-yarrow-wikilink") as HTMLElement | null) ?? raw;
            if (!target.classList.contains("cm-yarrow-wikilink")) return false;
            if (previewTimer.current) window.clearTimeout(previewTimer.current);
            // Don't hide instantly — give the user a moment to travel into
            // the popover (which is interactive now). The popover's own
            // mouseenter will cancel this timer.
            if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
            previewHideTimer.current = window.setTimeout(() => {
              previewTargetRef.current = null;
              setPreview(null);
            }, 220);
            return false;
          },
          mousemove: (e, view) => {
            // Blame tooltip: yields to wikilink preview over [[links]].
            const raw = e.target as HTMLElement;
            if (raw.closest(".cm-yarrow-wikilink")) {
              if (blameTimer.current) window.clearTimeout(blameTimer.current);
              return false;
            }
            if (blameTimer.current) window.clearTimeout(blameTimer.current);
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos == null) return false;
            const { x, y } = { x: e.clientX, y: e.clientY };
            // Bump the epoch so any in-flight provenance lookup that hasn't
            // resolved yet ignores its result. Without this, switching
            // notes (or just moving the mouse) while a 1.2 s hover-delay
            // call was in flight could pop a tooltip belonging to the
            // *previous* hover point — sometimes for a different note's
            // path entirely.
            const epoch = ++blameEpochRef.current;
            const slug = mountedSlugRef.current;
            blameTimer.current = window.setTimeout(() => {
              const line = view.state.doc.lineAt(pos).number;
              api
                .paragraphProvenance(slug, line)
                .then((p) => {
                  // Drop the result if a newer hover (or a clear) happened
                  // between scheduling and resolving.
                  if (blameEpochRef.current !== epoch) return;
                  setBlame({ x: x + 12, y: y + 18, p });
                })
                .catch(() => {
                  if (blameEpochRef.current !== epoch) return;
                  setBlame(null);
                });
            }, 1200);
            return false;
          },
          mouseleave: () => {
            if (blameTimer.current) window.clearTimeout(blameTimer.current);
            if (previewTimer.current) window.clearTimeout(previewTimer.current);
            previewTargetRef.current = null;
            setBlame(null);
            setPreview(null);
            return false;
          },
          drop: (e, view) => {
            if (!e.dataTransfer || e.dataTransfer.files.length === 0) return false;
            e.preventDefault();
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head;
            attachFilesToEditor(Array.from(e.dataTransfer.files), view, pos);
            return true;
          },
          dragover: (e, _view) => {
            if (e.dataTransfer && e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
            return false;
          },
          paste: (e, view) => {
            if (!e.clipboardData) return false;
            const files: File[] = [];
            for (const item of e.clipboardData.items) {
              if (item.kind === "file") {
                const f = item.getAsFile();
                if (f) files.push(f);
              }
            }
            if (files.length > 0) {
              e.preventDefault();
              attachFilesToEditor(files, view, view.state.selection.main.head);
              return true;
            }
            // Smart paste: a clipboard string that's just a URL becomes a
            // [title](url) markdown link. Title fetch is async — insert the
            // raw URL first, then replace with the linked form on success.
            const text = e.clipboardData.getData("text/plain");
            const url = isLikelyUrl(text);
            if (url) {
              e.preventDefault();
              const sel = view.state.selection.main;
              // If the user has selected text, treat it as the link label and
              // skip the network fetch entirely.
              if (!sel.empty) {
                const label = view.state.sliceDoc(sel.from, sel.to);
                view.dispatch({
                  changes: { from: sel.from, to: sel.to, insert: `[${label}](${url})` },
                  selection: { anchor: sel.from + `[${label}](${url})`.length },
                });
                return true;
              }
              const insertAt = sel.head;
              view.dispatch({
                changes: { from: insertAt, to: insertAt, insert: url },
                selection: { anchor: insertAt + url.length },
              });
              api.fetchUrlTitle(url).then((title) => {
                const trimmed = title.trim();
                if (!trimmed) return;
                // Re-find the URL in case the doc shifted; only replace when
                // the original placeholder is still present at this offset.
                const current = view.state.doc.sliceString(insertAt, insertAt + url.length);
                if (current !== url) return;
                const replacement = `[${escapeMdLinkText(trimmed)}](${url})`;
                view.dispatch({
                  changes: { from: insertAt, to: insertAt + url.length, insert: replacement },
                });
              }).catch(() => { /* leave the raw URL */ });
              return true;
            }
            return false;
          },
        }),
      ],
    });

      view = new EditorView({ state, parent: hostRef.current });
      viewRef.current = view;
    };

    mount().catch((err) => {
      // A dynamic import can fail (offline, corrupt chunk). Log and leave
      // the editor pane empty — the user will see the "Start writing…"
      // placeholder; toggling the extra off in Settings is the escape
      // hatch.
      console.error("editor mount failed", err);
    });

    return () => {
      cancelled = true;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (blameTimer.current) window.clearTimeout(blameTimer.current);
      if (justSavedTimer.current) window.clearTimeout(justSavedTimer.current);
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
      if (bodyBroadcastTimer.current) {
        window.clearTimeout(bodyBroadcastTimer.current);
        if (view) {
          // Flush latest body so the consuming shell is in sync on unmount.
          try { onBodyChangeRef.current?.(view.state.doc.toString()); } catch {}
        }
      }
      // Flush any pending edits before the editor goes away. This covers
      // path switches, restores, and workspace close — all of which
      // remount the editor and would otherwise drop whatever was typed
      // in the last debounce window.
      if (view) {
        try {
          const body = view.state.doc.toString();
          if (body !== lastSavedBody.current) {
            lastSavedBody.current = body;
            onSaveRef.current(mountedSlugRef.current, body, undefined, mountedPathRef.current);
          }
        } catch {
          // Swallow: we're already tearing down; losing this flush is
          // still better than an unhandled exception during unmount.
        }
        view.destroy();
      }
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.slug, currentPath, codeHighlightOn, mathOn, spellOn, imagePreviewOn, mappingEnabled]);

  // Live-reconfigure the hide-syntax plugin when the mode toggles. Far cheaper
  // than a full editor teardown/remount.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: hideSyntaxCompartment.current.reconfigure(
        showRawMarkdown ? [] : hideSyntaxPlugin()
      ),
    });
  }, [showRawMarkdown]);

  useEffect(() => {
    setTitle(note.frontmatter.title || note.slug);
    // Drop any stale blame tooltip when the note prop swaps. Belt-and-
    // braces alongside the per-hover epoch — the parent may keep this
    // editor instance alive across slug changes if the key prop logic
    // ever changes.
    if (blameTimer.current) {
      window.clearTimeout(blameTimer.current);
      blameTimer.current = null;
    }
    blameEpochRef.current++;
    setBlame(null);
  }, [note.slug, note.body, note.frontmatter.title]);

  // Late note.body sync. Path switches remount this component with whatever
  // activeNote was at click time — AppShell's re-fetch for the new path
  // resolves a tick later and updates note.body. That prop change doesn't
  // re-mount (key hasn't changed), so without this the view would show the
  // previous path's content indefinitely. We only replace the doc when the
  // view matches the last-saved body: if the user has unflushed edits, the
  // debounced save (or the onBlur flush) will persist them to the captured
  // mount path first.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === note.body) return;
    if (current !== lastSavedBody.current) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: note.body },
    });
    lastSavedBody.current = note.body;
  }, [note.body]);

  // Jump to a specific line
  useEffect(() => {
    if (!jumpToLine || !viewRef.current) return;
    const view = viewRef.current;
    const line = Math.max(1, Math.min(jumpToLine.line, view.state.doc.lines));
    const pos = view.state.doc.line(line).from;
    view.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true,
    });
    view.focus();
  }, [jumpToLine]);

  // External text insertion — used by the scratchpad's "send to note" action.
  // Inserts at the current cursor (or doc end if no selection has been placed
  // yet), ensuring a blank line separates it from surrounding prose so the
  // inserted block reads as its own paragraph.
  useEffect(() => {
    const onInsert = (ev: Event) => {
      const view = viewRef.current;
      if (!view) return;
      const text = (ev as CustomEvent<{ text: string }>).detail?.text ?? "";
      if (!text) return;
      const cursor = view.state.selection.main.head;
      const before = view.state.sliceDoc(Math.max(0, cursor - 2), cursor);
      const prefix =
        cursor === 0 || before.endsWith("\n\n")
          ? ""
          : before.endsWith("\n")
            ? "\n"
            : "\n\n";
      const insert = prefix + text + "\n";
      view.dispatch({
        changes: { from: cursor, to: cursor, insert },
        selection: { anchor: cursor + insert.length },
        scrollIntoView: true,
      });
      view.focus();
      try { onBodyChangeRef.current?.(view.state.doc.toString()); } catch {}
    };
    window.addEventListener("yarrow:editor-insert", onInsert as EventListener);

    const onReplaceRange = (ev: Event) => {
      const view = viewRef.current;
      if (!view) return;
      const detail = (ev as CustomEvent<{ from: number; to: number; text: string }>).detail;
      if (!detail) return;
      const max = view.state.doc.length;
      const from = Math.max(0, Math.min(detail.from, max));
      const to = Math.max(from, Math.min(detail.to, max));
      view.dispatch({
        changes: { from, to, insert: detail.text },
        selection: { anchor: from + detail.text.length },
      });
      view.focus();
      try { onBodyChangeRef.current?.(view.state.doc.toString()); } catch {}
    };
    window.addEventListener("yarrow:editor-replace-range", onReplaceRange as EventListener);

    // Raw inline insertion at the current cursor — used by the
    // right-click radial menu (wikilink, wrap-with-bold, snippets) and
    // the right-click Insert-wikilink modal. Unlike
    // `yarrow:editor-insert` (which wraps the payload in its own
    // paragraph), this drops the text in exactly as-is so `[[Note]]`
    // lands mid-sentence.
    //
    // `caretOffset` (optional): where to place the cursor relative to
    //   the start of the inserted text. Defaults to end-of-text. Used
    //   for block snippets like code fences where the caret should
    //   land inside the block, not after the closing fence.
    // `atLineStart` (optional): if true, snap insertion to the start
    //   of the current line; if the line already has content, insert
    //   a leading newline. Used for line-prefix snippets like `# `
    //   and `- [ ] ` so they don't land mid-sentence.
    const onInsertRaw = (ev: Event) => {
      const view = viewRef.current;
      if (!view) return;
      const detail = (ev as CustomEvent<{
        text: string;
        caretOffset?: number;
        atLineStart?: boolean;
      }>).detail;
      const text = detail?.text ?? "";
      if (!text) return;
      const sel = view.state.selection.main;
      let from = sel.from;
      let to = sel.to;
      let leadingNewline = "";
      if (detail?.atLineStart) {
        const line = view.state.doc.lineAt(sel.head);
        if (line.text.trim().length === 0) {
          from = line.from;
          to = line.to;
        } else {
          from = line.to;
          to = line.to;
          leadingNewline = "\n";
        }
      }
      const insert = leadingNewline + text;
      const caret =
        from +
        leadingNewline.length +
        (detail?.caretOffset ?? text.length);
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: caret },
        scrollIntoView: true,
      });
      view.focus();
      try { onBodyChangeRef.current?.(view.state.doc.toString()); } catch {}
    };
    window.addEventListener("yarrow:editor-insert-raw", onInsertRaw as EventListener);

    return () => {
      window.removeEventListener("yarrow:editor-insert", onInsert as EventListener);
      window.removeEventListener("yarrow:editor-replace-range", onReplaceRange as EventListener);
      window.removeEventListener("yarrow:editor-insert-raw", onInsertRaw as EventListener);
    };
  }, []);

  const saveNow = () => {
    if (!viewRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const body = viewRef.current.state.doc.toString();
    if (body !== lastSavedBody.current) {
      lastSavedBody.current = body;
      onSave(mountedSlugRef.current, body, undefined, mountedPathRef.current);
      onDirtyChange(false);
    }
  };

  const handleTitleBlur = () => {
    const next = title.trim();
    if (next && next !== note.frontmatter.title) {
      onTitleChange(next);
    } else if (!next) {
      setTitle(note.frontmatter.title || note.slug);
    }
  };

  const acceptFork = () => {
    // Record the current last paragraph so we don't repeat the suggestion.
    const body = viewRef.current?.state.doc.toString() ?? note.body;
    const paragraphs = body.split(/\n{2,}/);
    const last = paragraphs[paragraphs.length - 1]?.trim();
    if (last) dismissedForkRef.current.add(last);
    setShowForkSuggestion(false);
    onOpenFork();
  };

  const dismissFork = () => {
    const body = viewRef.current?.state.doc.toString() ?? note.body;
    const paragraphs = body.split(/\n{2,}/);
    const last = paragraphs[paragraphs.length - 1]?.trim();
    if (last) dismissedForkRef.current.add(last);
    setShowForkSuggestion(false);
  };

  const linkTitleMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of notes) m[n.slug] = n.title;
    return m;
  }, [notes]);

  // ── 2.0 path-tinted caret ──
  // Compute the current path's colour, then apply it to the editor-host
  // wrapper (which is always mounted — unlike CodeMirror's own
  // `.cm-editor` node, which is created asynchronously inside the mount
  // effect and so isn't reliably present when this effect runs). The
  // CSS in `index.css` matches `.yarrow-caret-tinted .cm-cursor` etc.,
  // so the class on the parent is enough to propagate the colour once
  // CM lands.
  const pathColor = useMemo(
    () => colorForPath(currentPath || "main", { overrides: pathColorOverrides }),
    [currentPath, pathColorOverrides],
  );
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.setProperty("--caret-path-color", pathColor);
    if (caretTintOn) host.classList.add("yarrow-caret-tinted");
    else host.classList.remove("yarrow-caret-tinted");
  }, [pathColor, caretTintOn]);

  // ── 2.0 typewriter mode ──
  // Keep the active line pinned at the vertical middle of the scroll
  // container. We listen on CodeMirror selection updates and dispatch
  // an effect that computes the offset between the caret's DOM rect
  // and the centre of the scroll viewport, then scrolls by the
  // difference. This is cheaper and more reliable than a ViewPlugin
  // since the caret position is known after every dispatch.
  useEffect(() => {
    if (!typewriterOn) return;
    const view = viewRef.current;
    if (!view) return;
    // Find the nearest scroll ancestor — the overflow-y-auto div that
    // wraps the editor in NoteEditor's return (see <div className="note-enter …">).
    let scroller: HTMLElement | null = hostRef.current;
    while (scroller && scroller.parentElement) {
      const ov = getComputedStyle(scroller).overflowY;
      if (ov === "auto" || ov === "scroll") break;
      scroller = scroller.parentElement;
    }
    if (!scroller) return;
    const centre = () => {
      const v = viewRef.current;
      if (!v) return;
      const pos = v.state.selection.main.head;
      const coords = v.coordsAtPos(pos);
      if (!coords) return;
      const rect = scroller.getBoundingClientRect();
      const caretY = (coords.top + coords.bottom) / 2;
      const targetY = rect.top + rect.height / 2;
      const delta = caretY - targetY;
      if (Math.abs(delta) < 2) return;
      scroller.scrollBy({ top: delta, behavior: "auto" });
    };
    // One centre on activation — gets the line roughly in place even
    // before the user types anything.
    window.setTimeout(centre, 40);
    const onChange = () => {
      // Defer so CM has finished rendering the new selection/doc before
      // we read layout.
      window.requestAnimationFrame(centre);
    };
    window.addEventListener("yarrow:selection-changed", onChange);
    // Also re-centre when the user clicks to reposition the caret.
    const host = hostRef.current;
    host?.addEventListener("click", onChange);
    host?.addEventListener("keyup", onChange);
    return () => {
      window.removeEventListener("yarrow:selection-changed", onChange);
      host?.removeEventListener("click", onChange);
      host?.removeEventListener("keyup", onChange);
    };
  }, [typewriterOn, note.slug]);

  const annotations = note.frontmatter.annotations ?? [];
  const hasAnnotations = annotations.length > 0;

  return (
    <div
      className={`note-enter relative flex-1 overflow-y-auto px-12 py-12 2xl:px-24${typewriterOn ? " yarrow-typewriter" : ""}`}
      onContextMenu={(e) => {
        // Right-click inside CodeMirror is already handled by its own
        // `domEventHandlers.contextmenu` (spellcheck suggestions or a
        // selection-aware radial). We only fire when the click landed
        // on one of the dead zones around the editor: the outer page
        // padding, the metadata strip, the tag-chip row, the gap
        // between the chips and CM, and the "connects to" footer.
        // Keep native menus on real text inputs (the title field and
        // the tag-chip input) so users can still paste / spellcheck
        // into those.
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, [contenteditable='true']")) return;
        if (t.closest(".cm-editor")) return;
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("yarrow:editor-contextmenu", {
            detail: { text: "", x: e.clientX, y: e.clientY },
          }),
        );
      }}
    >
      <div className="w-full max-w-[680px] xl:max-w-[820px] 2xl:max-w-[960px] mx-auto">
        <div
          className={`font-serif italic text-xs text-t3 mb-5 inline-block px-1 py-0.5 rounded transition-colors ${
            justSaved ? "edited-pulse" : ""
          }`}
        >
          {editorialDate(note.frontmatter.modified)} · written in the{" "}
          {timeOfDayPhrase(note.frontmatter.modified)}
          <span className="text-t3/70"> · </span>
          <span className="font-mono not-italic text-2xs">{currentPath || "main"}</span>
          <span className="text-t3/70"> · </span>
          <span className="not-italic">
            {justSaved ? "saved" : "edited"} {relativeTime(note.frontmatter.modified)}
          </span>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          placeholder="Untitled"
          className="w-full font-serif text-[44px] leading-[1.1] text-char bg-transparent outline-none placeholder:text-t3 tracking-[-1px] mb-2"
        />
        <TagChips
          initial={note.frontmatter.tags ?? []}
          suggestions={tagSuggestions}
          onCommit={(next) => onTagsChange?.(mountedSlugRef.current, next)}
        />
        {onAnnotationsChange ? (
          <div className={hasAnnotations ? "yarrow-annotations-layout mt-6" : "mt-6"}>
            <div ref={hostRef} onBlur={saveNow} className="min-h-[50vh]" />
            {hasAnnotations && (
              <aside className="yarrow-annotations-gutter">
                <AnnotationsGutter
                  annotations={annotations}
                  onChange={(next) => onAnnotationsChange(mountedSlugRef.current, next)}
                />
              </aside>
            )}
          </div>
        ) : (
          <div ref={hostRef} onBlur={saveNow} className="min-h-[50vh] mt-6" />
        )}

        {note.frontmatter.links.length > 0 && (
          <div className="mt-14 pt-7 border-t border-bd flex items-baseline gap-3 flex-wrap">
            <span className="font-serif italic text-xs text-t3">This note connects to</span>
            {note.frontmatter.links.map((l) => (
              <button
                key={l.target}
                onClick={() => onNavigate(l.target)}
                className="px-2.5 py-0.5 rounded-full bg-s2 text-t2 font-serif italic text-xs hover:bg-s3 hover:text-char transition"
                title={`${l.type.replace("-", " ")} — ${linkTitleMap[l.target] ?? l.target}`}
              >
                {linkTitleMap[l.target] ?? l.target}
              </button>
            ))}
          </div>
        )}
      </div>

      <ForkSuggestion
        visible={showForkSuggestion}
        onAccept={acceptFork}
        onDismiss={dismissFork}
      />

      {blame && (
        <div
          style={{ left: blame.x, top: blame.y }}
          className="fixed z-40 pointer-events-none bg-char text-bg text-2xs px-2 py-1 rounded shadow-lg animate-fadeIn"
        >
          Written {relativeTime(blame.p.timestamp)} · path {blame.p.path_name}
        </div>
      )}

      {preview && (
        <WikilinkPreview
          data={preview}
          currentPath={currentPath}
          pathNotes={pathNotes}
          onBranchHere={(slug) => {
            // Fire the action then clear the preview so the modal isn't
            // visually stacked on top of it.
            if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
            setPreview(null);
            onBranchFromWikilink?.(slug);
          }}
          onEnter={() => {
            if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
          }}
          onLeave={() => {
            previewTargetRef.current = null;
            setPreview(null);
          }}
        />
      )}
    </div>
  );
}

