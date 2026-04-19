import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Compartment, EditorState, RangeSetBuilder } from "@codemirror/state";
import { EditorView, keymap, placeholder, ViewPlugin, ViewUpdate, Decoration, DecorationSet, MatchDecorator, WidgetType } from "@codemirror/view";
import { defaultKeymap, history as cmHistory, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages as cmLanguages } from "@codemirror/language-data";
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from "@codemirror/language";
import { autocompletion, CompletionContext, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import katex from "katex";
import { isCorrect, loadSpell, suggest as spellSuggest } from "../../lib/spell";
import WikilinkPreview, {
  cachePreview as sharedCachePreview,
  getCachedPreview as sharedGetCachedPreview,
} from "../WikilinkPreview";
import type { Note, NoteSummary, Provenance } from "../../lib/types";
import { api } from "../../lib/tauri";
import { editorialDate, relativeTime, timeOfDayPhrase } from "../../lib/format";
import { isDivergent } from "../../lib/forkDetection";
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
   *  fires (race that previously produced cross-note content swaps). */
  onSave: (slug: string, body: string, thinking?: string) => void;
  onTitleChange: (title: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onNavigate: (slug: string) => void;
  onBodyChange?: (body: string) => void;
  onOpenFork: () => void;
  /** All paths and which slugs each contains — for the wikilink hover chip. */
  pathNotes?: Record<string, string[]>;
  /** "Start a path here" CTA fired from the wikilink hover popover. The
   *  slug is what the user hovered on. */
  onBranchFromWikilink?: (slug: string) => void;
  /** When false (basic workspace mode), [[wikilink]] autocomplete is off. */
  mappingEnabled?: boolean;
  /** Persist a new tag list for the note (slug, tags). Slug is the one
   *  captured at editor-mount so a save races against a note-switch land
   *  on the right note (same fix as `onSave`). */
  onTagsChange?: (slug: string, tags: string[]) => void;
  /** All tags currently in the workspace, fed into the chip-input
   *  autocomplete so users converge on consistent vocabulary. */
  tagSuggestions?: string[];
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

// ────────────── inline image preview ──────────────
// Matches `![alt](attachments/xxx.ext)` and renders the image beneath the line.
// The widget loads bytes via `api.readAttachment` → data URL, caching by relpath
// so scrolling doesn't refetch.
const ATTACH_IMG_RE = /!\[[^\]]*\]\((attachments\/[^)\s]+)\)/;

// Short-lived cache for wikilink hover previews. Hovering the same link five
// times in a row should only fetch the target note once; cleared on editor
// unmount. We cap by count, not bytes — excerpts are always ≤480 chars.
// Wikilink hover preview cache + component live in `../WikilinkPreview` so
// reading mode shares the same surface.
const cachePreview = sharedCachePreview;

// LRU-ish cache: bounded by entry count so a long session editing a vault with
// many attachments doesn't hand all its RAM to data-URL strings. JS Maps iterate
// in insertion order, so deleting the first key approximates "evict oldest".
const IMAGE_CACHE_MAX = 50;
const imageCache = new Map<string, string>();
function cacheImage(relpath: string, url: string) {
  if (imageCache.has(relpath)) imageCache.delete(relpath);
  imageCache.set(relpath, url);
  while (imageCache.size > IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value;
    if (oldest === undefined) break;
    imageCache.delete(oldest);
  }
}
function getCachedImage(relpath: string): string | undefined {
  const hit = imageCache.get(relpath);
  if (hit !== undefined) {
    // Refresh recency on hit.
    imageCache.delete(relpath);
    imageCache.set(relpath, hit);
  }
  return hit;
}

class ImageWidget extends WidgetType {
  constructor(readonly relpath: string) { super(); }
  eq(other: ImageWidget) { return other.relpath === this.relpath; }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-yarrow-img";
    wrap.contentEditable = "false";
    const img = document.createElement("img");
    img.alt = "";
    wrap.appendChild(img);
    const cached = getCachedImage(this.relpath);
    if (cached) {
      img.src = cached;
    } else {
      api.readAttachment(this.relpath).then((d) => {
        const url = `data:${d.mime};base64,${d.base64}`;
        cacheImage(this.relpath, url);
        img.src = url;
      }).catch(() => {
        wrap.classList.add("cm-yarrow-img-missing");
        wrap.textContent = `Missing: ${this.relpath}`;
      });
    }
    return wrap;
  }
  ignoreEvent() { return false; }
}

function imagePreviewPlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = this.build(view); }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;
        // Pre-scan line-by-line from the top of the document to know which
        // lines live inside fenced ``` code blocks. For any realistic note
        // size this is cheap (a few kB of text) and saves us from widgetising
        // image references that appear as documentation inside a code fence.
        const fenceMask = new Uint8Array(doc.lines + 1);
        let inFence = false;
        for (let n = 1; n <= doc.lines; n++) {
          const text = doc.line(n).text;
          if (/^\s*```/.test(text)) {
            // The fence line itself is "in-fence" so its `![…](…)` (rare but
            // possible if malformed) doesn't render a widget.
            fenceMask[n] = 1;
            inFence = !inFence;
          } else {
            fenceMask[n] = inFence ? 1 : 0;
          }
        }
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = doc.lineAt(pos);
            if (fenceMask[line.number] === 0) {
              const m = ATTACH_IMG_RE.exec(line.text);
              if (m) {
                builder.add(line.to, line.to, Decoration.widget({
                  widget: new ImageWidget(m[1]),
                  side: 1,
                  block: true,
                }));
              }
            }
            pos = line.to + 1;
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}

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

// ────────────── inline / block math (KaTeX) ──────────────
// Inline `$x$` and block `$$x$$` are rendered to KaTeX widgets when the cursor
// is not inside the delimited range. The active range stays raw so editing the
// LaTeX source is straightforward. Code-fence regions are excluded so prose
// about math doesn't trigger rendering.
class MathInlineWidget extends WidgetType {
  constructor(readonly tex: string) { super(); }
  eq(other: MathInlineWidget) { return other.tex === this.tex; }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-yarrow-math-inline";
    try {
      katex.render(this.tex, span, { throwOnError: false, displayMode: false });
    } catch {
      span.textContent = `$${this.tex}$`;
      span.classList.add("cm-yarrow-math-error");
    }
    return span;
  }
  ignoreEvent() { return false; }
}

class MathBlockWidget extends WidgetType {
  constructor(readonly tex: string) { super(); }
  eq(other: MathBlockWidget) { return other.tex === this.tex; }
  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-yarrow-math-block";
    div.contentEditable = "false";
    try {
      katex.render(this.tex, div, { throwOnError: false, displayMode: true });
    } catch {
      div.textContent = `$$${this.tex}$$`;
      div.classList.add("cm-yarrow-math-error");
    }
    return div;
  }
  ignoreEvent() { return false; }
}

function mathPlugin() {
  const INLINE_RE = /(?<!\$)\$([^\s$][^$\n]*?[^\s$]|[^\s$])\$(?!\$)/g;
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
        const doc = view.state.doc;
        const sel = view.state.selection.main;
        // Build a fence mask line-by-line so we skip math-looking text inside
        // code fences.
        const fenceMask = new Uint8Array(doc.lines + 1);
        let inFence = false;
        for (let n = 1; n <= doc.lines; n++) {
          const text = doc.line(n).text;
          if (/^\s*```/.test(text)) {
            fenceMask[n] = 1;
            inFence = !inFence;
          } else {
            fenceMask[n] = inFence ? 1 : 0;
          }
        }

        // ── block math: $$...$$ across lines ──
        // Scan whole-document so multi-line blocks render even if only the
        // closing line is in the viewport.
        const text = doc.toString();
        const blocks: Array<[number, number, string]> = [];
        let i = 0;
        while (i < text.length) {
          const open = text.indexOf("$$", i);
          if (open === -1) break;
          const startLine = doc.lineAt(open).number;
          if (fenceMask[startLine] === 1) { i = open + 2; continue; }
          const close = text.indexOf("$$", open + 2);
          if (close === -1) break;
          const endLine = doc.lineAt(close).number;
          if (fenceMask[endLine] === 1) { i = close + 2; continue; }
          const tex = text.slice(open + 2, close);
          blocks.push([open, close + 2, tex]);
          i = close + 2;
        }
        for (const [from, to, tex] of blocks) {
          // If the cursor is anywhere inside the block, leave it raw.
          const inside = sel.from <= to && sel.to >= from;
          if (inside) continue;
          builder.add(from, to, Decoration.replace({
            widget: new MathBlockWidget(tex),
            block: true,
          }));
        }

        // ── inline math: $...$ on a single line ──
        // Skip ranges already covered by a block so we don't double-decorate.
        const blockRanges = blocks.map(([f, t]) => [f, t] as [number, number]);
        const inBlock = (pos: number) =>
          blockRanges.some(([f, t]) => pos >= f && pos < t);

        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = doc.lineAt(pos);
            if (fenceMask[line.number] === 0 && !inBlock(line.from)) {
              INLINE_RE.lastIndex = 0;
              let m: RegExpExecArray | null;
              while ((m = INLINE_RE.exec(line.text)) !== null) {
                const start = line.from + m.index;
                const end = start + m[0].length;
                if (sel.from <= end && sel.to >= start) continue;
                builder.add(start, end, Decoration.replace({
                  widget: new MathInlineWidget(m[1]),
                }));
              }
            }
            pos = line.to + 1;
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}

// ────────────── spell check ──────────────
// Underlines misspellings on visible lines. Skips code fences, wikilinks, URLs,
// and the active line so token edits aren't churned with squiggles. The
// English dictionary loads asynchronously; until it does, the plugin produces
// no decorations (and rebuilds once loaded via a no-op state effect).
const SPELL_WORD_RE = /[A-Za-z][A-Za-z'\-]{2,}/g;
const SPELL_SKIP_RE = /\[\[[^\]]+\]\]|`[^`]+`|https?:\/\/\S+/g;

function spellPlugin() {
  let ready = false;
  loadSpell().then(() => { ready = true; }).catch(() => {});
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = this.build(view); }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.build(update.view);
        } else if (!ready) {
          // Cheap re-poll: when the dictionary finishes loading mid-session
          // we want the next viewport/cursor change to pick it up. Nothing
          // to do here — the next update tick will rebuild.
        }
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        if (!ready) return builder.finish();
        const doc = view.state.doc;
        const sel = view.state.selection.main;
        const activeLine = doc.lineAt(sel.head).number;
        // Build fence mask once per build.
        const fenceMask = new Uint8Array(doc.lines + 1);
        let inFence = false;
        for (let n = 1; n <= doc.lines; n++) {
          const text = doc.line(n).text;
          if (/^\s*```/.test(text)) {
            fenceMask[n] = 1;
            inFence = !inFence;
          } else {
            fenceMask[n] = inFence ? 1 : 0;
          }
        }
        const ranges: Array<[number, number]> = [];
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = doc.lineAt(pos);
            if (line.number !== activeLine && fenceMask[line.number] === 0) {
              const text = line.text;
              // Compute skip ranges (inline code, wikilinks, urls) to suppress
              // false positives in typical markdown content.
              const skip: Array<[number, number]> = [];
              SPELL_SKIP_RE.lastIndex = 0;
              let s: RegExpExecArray | null;
              while ((s = SPELL_SKIP_RE.exec(text)) !== null) {
                skip.push([s.index, s.index + s[0].length]);
              }
              const inSkip = (i: number) =>
                skip.some(([a, b]) => i >= a && i < b);
              SPELL_WORD_RE.lastIndex = 0;
              let m: RegExpExecArray | null;
              while ((m = SPELL_WORD_RE.exec(text)) !== null) {
                if (inSkip(m.index)) continue;
                const w = m[0];
                // Skip ALL-CAPS acronyms and words containing digits-in
                // (handled by regex), and obvious markdown keywords.
                if (/^[A-Z]{2,}$/.test(w)) continue;
                if (!isCorrect(w)) {
                  ranges.push([line.from + m.index, line.from + m.index + w.length]);
                }
              }
            }
            pos = line.to + 1;
          }
        }
        ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        for (const [a, b] of ranges) {
          builder.add(a, b, Decoration.mark({ class: "cm-yarrow-misspelled" }));
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}

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
  onDirtyChange,
  onNavigate,
  onBodyChange,
  onOpenFork,
  pathNotes,
  onBranchFromWikilink,
  mappingEnabled = true,
  onTagsChange,
  tagSuggestions,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
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

  const completionSource = useMemo(() => {
    return (ctx: CompletionContext) => {
      if (!mappingEnabled) return null;
      const before = ctx.matchBefore(/\[\[[^\]\n]*/);
      if (!before || (before.from === before.to && !ctx.explicit)) return null;
      const query = before.text.slice(2).toLowerCase();
      const options = notes
        .filter((n) => n.slug !== note.slug)
        .filter((n) =>
          !query ||
          n.title.toLowerCase().includes(query) ||
          n.slug.toLowerCase().includes(query),
        )
        .slice(0, 20)
        .map((n) => ({
          label: n.title || n.slug,
          apply: `[[${n.title || n.slug}]]`,
          detail: n.slug,
        }));
      return { from: before.from, options };
    };
  }, [notes, note.slug, mappingEnabled]);

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

    const state = EditorState.create({
      doc: note.body,
      extensions: [
        cmHistory(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        closeBrackets(),
        bracketMatching(),
        indentOnInput(),
        markdown({ codeLanguages: cmLanguages }),
        syntaxHighlighting(highlightStyle),
        syntaxHighlighting(defaultHighlightStyle),
        placeholder("Start writing…"),
        EditorView.lineWrapping,
        autocompletion({
          override: [completionSource],
          defaultKeymap: true,
          icons: false,
        }),
        wikilinkPlugin(),
        questionPlugin(),
        mathPlugin(),
        spellPlugin(),
        imagePreviewPlugin(),
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
                onSave(mountedSlugRef.current, body);
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
          // Right-click with a non-empty selection surfaces a small context
          // menu with "Send to scratchpad" as the primary action. The
          // menu is rendered by AppShell so it can live-update and call
          // through to `api.appendScratchpad` without NoteEditor knowing.
          // Without a selection we let the native menu through (Copy/Paste
          // still work on the editor's own contents).
          contextmenu: (e, view) => {
            const sel = view.state.selection.main;
            // Empty selection: probe for a misspelled word at the click and
            // surface spell suggestions. If nothing's misspelled, fall through
            // to the native menu so Copy/Paste still work.
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
                    const suggestions = spellSuggest(word);
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
              return false;
            }
            const text = view.state.sliceDoc(sel.from, sel.to);
            if (!text.trim()) return false;
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent("yarrow:editor-contextmenu", {
              detail: { text, x: e.clientX, y: e.clientY },
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

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (blameTimer.current) window.clearTimeout(blameTimer.current);
      if (justSavedTimer.current) window.clearTimeout(justSavedTimer.current);
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
      if (bodyBroadcastTimer.current) {
        window.clearTimeout(bodyBroadcastTimer.current);
        // Flush latest body so the consuming shell is in sync on unmount.
        try { onBodyChangeRef.current?.(view.state.doc.toString()); } catch {}
      }
      // Flush any pending edits before the editor goes away. This covers
      // path switches, restores, and workspace close — all of which remount
      // the editor and would otherwise drop whatever was typed in the last
      // debounce window.
      try {
        const body = view.state.doc.toString();
        if (body !== lastSavedBody.current) {
          lastSavedBody.current = body;
          onSaveRef.current(mountedSlugRef.current, body);
        }
      } catch {
        // Swallow: we're already tearing down; losing this flush is still
        // better than an unhandled exception during unmount.
      }
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.slug, currentPath]);

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
    lastSavedBody.current = note.body;
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

    return () => {
      window.removeEventListener("yarrow:editor-insert", onInsert as EventListener);
      window.removeEventListener("yarrow:editor-replace-range", onReplaceRange as EventListener);
    };
  }, []);

  const saveNow = () => {
    if (!viewRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const body = viewRef.current.state.doc.toString();
    if (body !== lastSavedBody.current) {
      lastSavedBody.current = body;
      onSave(mountedSlugRef.current, body);
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

  return (
    <div className="note-enter relative flex-1 overflow-y-auto px-12 py-12 2xl:px-24">
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
        <div ref={hostRef} onBlur={saveNow} className="min-h-[50vh] mt-6" />

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

