<script module lang="ts">
  import { Compartment, EditorState, RangeSetBuilder } from "@codemirror/state";
  import type { Extension } from "@codemirror/state";
  import {
    EditorView,
    keymap,
    placeholder,
    tooltips,
    ViewPlugin,
    Decoration,
    MatchDecorator,
  } from "@codemirror/view";
  import type { ViewUpdate, DecorationSet } from "@codemirror/view";
  import {
    defaultKeymap,
    history as cmHistory,
    historyKeymap,
    indentWithTab,
  } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import {
    bracketMatching,
    indentOnInput,
    syntaxHighlighting,
    defaultHighlightStyle,
    HighlightStyle,
  } from "@codemirror/language";
  import {
    autocompletion,
    closeBrackets,
    closeBracketsKeymap,
    type CompletionSource,
  } from "@codemirror/autocomplete";
  import { tags } from "@lezer/highlight";

  export const highlightStyle = HighlightStyle.define([
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

  export function isTableRow(text: string): boolean {
    return /^\s*\|/.test(text);
  }

  /** Positions of every `|` in `line` — the cell boundaries we navigate
   *  between. Returned as absolute document offsets (line.from + index). */
  export function pipePositions(line: { from: number; text: string }): number[] {
    const out: number[] = [];
    for (let i = 0; i < line.text.length; i++) {
      if (line.text[i] === "|") out.push(line.from + i);
    }
    return out;
  }

  /** Where the next cell's content starts — the offset right after a pipe,
   *  skipping one leading space if the author put one there. */
  export function cellStartAfter(
    line: { from: number; text: string },
    pipeAbs: number,
  ): number {
    const rel = pipeAbs - line.from + 1;
    if (line.text[rel] === " ") return pipeAbs + 2;
    return pipeAbs + 1;
  }

  export function tableTab(view: EditorView): boolean {
    if (view.composing) return false;
    const { state } = view;
    const sel = state.selection.main;
    if (!sel.empty) return false;
    const line = state.doc.lineAt(sel.head);
    if (!isTableRow(line.text)) return false;
    const pipes = pipePositions(line);
    const nextPipe = pipes.find((p) => p > sel.head);
    if (nextPipe !== undefined) {
      const target = cellStartAfter(line, nextPipe);
      view.dispatch({
        selection: { anchor: Math.min(target, line.to) },
        scrollIntoView: true,
      });
      return true;
    }
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
    const cols = Math.max(1, pipes.length - 1);
    const blank = "|" + " | ".repeat(cols).replace(/\s$/, " ") + "|";
    const insert = "\n" + blank;
    view.dispatch({
      changes: { from: line.to, to: line.to, insert },
      selection: { anchor: line.to + 2 + (blank.indexOf("|") + 2) },
      scrollIntoView: true,
      userEvent: "input.type",
    });
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

  export function tableShiftTab(view: EditorView): boolean {
    if (view.composing) return false;
    const { state } = view;
    const sel = state.selection.main;
    if (!sel.empty) return false;
    const line = state.doc.lineAt(sel.head);
    if (!isTableRow(line.text)) return false;
    const pipes = pipePositions(line);
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
    if (line.number > 1) {
      const prev = state.doc.line(line.number - 1);
      if (isTableRow(prev.text)) {
        const prevPipes = pipePositions(prev);
        if (prevPipes.length >= 2) {
          view.dispatch({
            selection: {
              anchor: cellStartAfter(prev, prevPipes[prevPipes.length - 2]),
            },
            scrollIntoView: true,
          });
          return true;
        }
      }
    }
    return false;
  }

  export function wikilinkPlugin() {
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
        constructor(view: EditorView) {
          this.decorations = matcher.createDeco(view);
        }
        update(update: ViewUpdate) {
          this.decorations = matcher.updateDeco(update, this.decorations);
        }
      },
      { decorations: (v) => v.decorations },
    );
  }

  export async function attachFilesToEditor(
    files: File[],
    view: EditorView,
    at: number,
  ) {
    const { api } = await import("../../lib/tauri");
    const fragments: string[] = [];
    for (const f of files) {
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

  export function isLikelyUrl(text: string): string | null {
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

  export function escapeMdLinkText(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
  }

  export function arrayBufferToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let s = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      s += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + CHUNK) as unknown as number[],
      );
    }
    return btoa(s);
  }

  /**
   * Hide inline markdown tokens (`**`, `[[`, `]]`) on lines the cursor isn't
   * currently on — so the body reads like prose, not raw markdown. The active
   * line stays untouched so the token you're editing is visible. Disabled when
   * `showRawMarkdown` is on (toggled from Settings → Writing).
   */
  export function hideSyntaxPlugin() {
    const INLINE_RE = /\*\*|__|\[\[|\]\]|`/g;
    const HEADING_RE = /^(#{1,6})\s/;
    return ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = this.build(view);
        }
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

  export function questionPlugin() {
    const matcher = new MatchDecorator({
      regexp: /\?\?[^\n]*/g,
      decoration: () => Decoration.mark({ class: "cm-yarrow-question" }),
    });
    return ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = matcher.createDeco(view);
        }
        update(update: ViewUpdate) {
          this.decorations = matcher.updateDeco(update, this.decorations);
        }
      },
      { decorations: (v) => v.decorations },
    );
  }
</script>

<script lang="ts">
  import WikilinkPreview, {
    cachePreview as sharedCachePreview,
    getCachedPreview as sharedGetCachedPreview,
    type WikilinkPreviewData,
  } from "../WikilinkPreview.svelte";
  import type {
    Annotation,
    Draft,
    Note,
    NoteSummary,
    Provenance,
  } from "../../lib/types";
  import { api } from "../../lib/tauri";
  import DraftTabStrip from "./DraftTabStrip.svelte";
  import PathPeek from "../Paths/PathPeek.svelte";
  import { editorialDate, relativeTime, timeOfDayPhrase } from "../../lib/format";
  import { isDivergent } from "../../lib/forkDetection";
  import {
    extraCodeHighlight,
    extraImagePreview,
    extraSpell,
  } from "../../lib/extraPrefs.svelte";
  import { mode } from "../../lib/mode.svelte";
  import {
    pathTintedCaret,
    typewriterMode,
  } from "../../lib/editorPrefs.svelte";
  import { colorForPath } from "../../lib/pathAwareness";
  import AnnotationsGutter from "./AnnotationsGutter.svelte";
  import calloutsPlugin from "./extensions/callouts";
  import ForkSuggestion from "./ForkSuggestion.svelte";
  import TagChips from "./TagChips.svelte";
  import TagBouquet from "./TagBouquet.svelte";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    note: Note;
    notes: NoteSummary[];
    currentPath: string;
    debounceMs: number;
    askThinkingOnClose: boolean;
    showRawMarkdown?: boolean;
    jumpToLine?: { line: number; nonce: number };
    onSave: (
      slug: string,
      body: string,
      thinking?: string,
      path?: string,
    ) => void;
    onTitleChange: (title: string) => void;
    titleRevertNonce?: number;
    onDirtyChange: (dirty: boolean) => void;
    onNavigate: (slug: string) => void;
    onBodyChange?: (body: string) => void;
    onOpenFork: () => void;
    pathNotes?: Record<string, string[]>;
    onBranchFromWikilink?: (slug: string) => void;
    mappingEnabled?: boolean;
    onTagsChange?: (slug: string, tags: string[]) => void;
    tagSuggestions?: string[];
    pathColorOverrides?: Record<string, string>;
    onAnnotationsChange?: (slug: string, annotations: Annotation[]) => void;
    drafts?: Draft[];
    onDraftsChanged?: () => void;
    onDraftPromoted?: (slug: string) => void;
    draftsEnabled?: boolean;
    divergingPaths?: string[];
    rootPathName?: string;
    onBorrowed?: (slug: string) => void;
  }

  let {
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
    drafts = [],
    onDraftsChanged,
    onDraftPromoted,
    draftsEnabled = true,
    divergingPaths = [],
    rootPathName = "main",
    onBorrowed,
  }: Props = $props();

  let t = $derived(tr());

  // 3.0 — code-highlight and math are persona-derived. Code uses the
  // existing `extraCodeHighlight` toggle as a Developer-mode-only
  // sub-switch; outside Developer mode the toggle is inert. Math is
  // fully persona-bound — on in Researcher, off elsewhere.
  let codeHighlightOn = $derived(
    mode.config.persona === "developer" && extraCodeHighlight.value,
  );
  let mathOn = $derived(mode.config.persona === "researcher");
  let spellOn = $derived(extraSpell.value);
  let imagePreviewOn = $derived(extraImagePreview.value);
  let typewriterOn = $derived(typewriterMode.value);
  let caretTintOn = $derived(pathTintedCaret.value);

  // Wikilink hover preview cache shim (re-export for legacy parity).
  const cachePreview = sharedCachePreview;

  // Plain refs (not reactive) — these are imperative handles, not UI state.
  // svelte-ignore non_reactive_update
  let hostEl: HTMLDivElement | null = null;
  // svelte-ignore non_reactive_update
  let view: EditorView | null = null;
  // Fresh-notes pointer captured at mount; kept in sync by an effect.
  // svelte-ignore state_referenced_locally
  let notesRef: NoteSummary[] = notes;
  let spellSuggestRef: ((word: string) => string[]) | null = null;
  const hideSyntaxCompartment = new Compartment();
  let saveTimer: number | null = null;
  let quicksaveTimer: number | null = null;
  // svelte-ignore state_referenced_locally
  let lastSavedBody: string = note.body;
  let activeDraftIdRef: string | null = null;
  let draftSwitchTarget: string | null | undefined = undefined;
  let mainBodySnapshot: string | null = null;
  // svelte-ignore state_referenced_locally
  // svelte-ignore non_reactive_update
  let mountedSlug: string = note.slug;
  // svelte-ignore state_referenced_locally
  let mountedPath: string = currentPath;
  let lastSelection: { words: number; chars: number } = { words: 0, chars: 0 };
  let lastCursorLine = -1;
  let bodyBroadcastTimer: number | null = null;
  let blameTimer: number | null = null;
  let blameEpoch = 0;
  let justSavedTimer: number | null = null;
  let previewTimer: number | null = null;
  let previewHideTimer: number | null = null;
  let dismissedFork: Set<string> = new Set();

  // Reactive UI state.
  let peek = $state<{
    sourcePath: string;
    sourcePathLabel: string;
    x: number;
    y: number;
  } | null>(null);
  let activeDraftId = $state<string | null>(null);
  // svelte-ignore state_referenced_locally
  let title = $state(note.frontmatter.title || note.slug);
  let showForkSuggestion = $state(false);
  let blame = $state<{ x: number; y: number; p: Provenance } | null>(null);
  let justSaved = $state(false);
  let preview = $state<WikilinkPreviewData | null>(null);

  // Latest callbacks reachable from CodeMirror handlers (which capture once at
  // mount time). We refresh via $effect so the latest closures are visible.
  // svelte-ignore state_referenced_locally
  let onSaveLatest = onSave;
  // svelte-ignore state_referenced_locally
  let onBodyChangeLatest = onBodyChange;
  $effect(() => {
    onSaveLatest = onSave;
  });
  $effect(() => {
    onBodyChangeLatest = onBodyChange;
  });
  $effect(() => {
    notesRef = notes;
  });
  $effect(() => {
    activeDraftIdRef = activeDraftId;
  });

  // Title-revert nonce — pulls displayed title back to canonical when the
  // parent rejects/cancels a rename.
  $effect(() => {
    if (titleRevertNonce == null) return;
    title = note.frontmatter.title || note.slug;
  });

  function resolveWikilink(query: string): NoteSummary | undefined {
    return notes.find(
      (n) =>
        n.title.toLowerCase() === query.toLowerCase() ||
        n.slug === query ||
        n.slug === query.toLowerCase().replace(/\s+/g, "-"),
    );
  }

  function scanDivergent(body: string): boolean {
    const lastBreak = body.lastIndexOf("\n\n");
    const last = lastBreak < 0 ? body : body.slice(lastBreak + 2);
    const key = last.trim();
    if (!key) return false;
    if (dismissedFork.has(key)) return false;
    return isDivergent(last);
  }

  // ───────────────── editor mount ─────────────────
  // Re-runs whenever any of these reactive deps change: note.slug,
  // currentPath, codeHighlightOn, mathOn, spellOn, imagePreviewOn,
  // mappingEnabled.
  $effect(() => {
    void note.slug;
    void currentPath;
    void codeHighlightOn;
    void mathOn;
    void spellOn;
    void imagePreviewOn;
    void mappingEnabled;
    if (!hostEl) return;

    mountedSlug = note.slug;
    mountedPath = currentPath;

    let cancelled = false;
    let localView: EditorView | null = null;

    const mount = async () => {
      console.info(
        "[yarrow] editor mount — extras:",
        JSON.stringify({
          codeHighlight: codeHighlightOn,
          math: mathOn,
          spell: spellOn,
          imagePreview: imagePreviewOn,
        }),
      );
      let markdownExtension: Extension;
      if (codeHighlightOn) {
        const { codeHighlightedMarkdown } = await import(
          "./extensions/codeHighlight"
        );
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
        spellSuggestRef = suggest;
        extraExtensions.push(extension);
        console.info("[yarrow] spell extension loaded");
      } else {
        spellSuggestRef = null;
      }
      if (imagePreviewOn) {
        const { imagePreviewPlugin } = await import("./extensions/imagePreview");
        if (cancelled) return;
        extraExtensions.push(imagePreviewPlugin());
        console.info("[yarrow] image preview extension loaded");
      }

      const completionSources: CompletionSource[] = [];

      if (mappingEnabled) {
        const wl = await import("./extensions/wikilinkAutocomplete");
        if (cancelled) return;
        completionSources.push(wl.wikilinkSource(() => notesRef));
        extraExtensions.push(wl.wikilinkInputHandler);
        console.info("[yarrow] wikilink autocomplete loaded");

        const cite = await import("./extensions/citeAutocomplete");
        if (cancelled) return;
        completionSources.push(cite.citeSource(() => notesRef));
        extraExtensions.push(cite.citeAutoTrigger);
        extraExtensions.push(cite.citeInputHandler);
        console.info("[yarrow] @cite autocomplete loaded");
      }

      const isPrivate =
        note.frontmatter.private === true ||
        (note.frontmatter.tags ?? []).some(
          (tag) => tag.toLowerCase() === "clinical",
        );
      if (isPrivate) {
        const phi = await import("./extensions/phiHighlight");
        if (cancelled) return;
        extraExtensions.push(phi.phiHighlight());
        console.info("[yarrow] PHI highlighter loaded");
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

      if (cancelled || !hostEl) return;

      const state = EditorState.create({
        doc: note.body,
        extensions: [
          cmHistory(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            { key: "Tab", run: tableTab, shift: tableShiftTab },
            indentWithTab,
          ]),
          closeBrackets(),
          bracketMatching(),
          indentOnInput(),
          markdownExtension,
          syntaxHighlighting(highlightStyle),
          syntaxHighlighting(defaultHighlightStyle),
          placeholder(t("editor.note.placeholder")),
          EditorView.lineWrapping,
          wikilinkPlugin(),
          questionPlugin(),
          calloutsPlugin(),
          ...extraExtensions,
          hideSyntaxCompartment.of(
            showRawMarkdown ? [] : hideSyntaxPlugin(),
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const body = update.state.doc.toString();
              const dirty = body !== lastSavedBody;
              onDirtyChange(dirty);
              if (bodyBroadcastTimer)
                window.clearTimeout(bodyBroadcastTimer);
              bodyBroadcastTimer = window.setTimeout(() => {
                onBodyChangeLatest?.(body);
              }, 140);
              showForkSuggestion = mappingEnabled && scanDivergent(body);
              if (saveTimer) window.clearTimeout(saveTimer);
              if (quicksaveTimer) window.clearTimeout(quicksaveTimer);
              if (dirty) {
                if (!activeDraftIdRef) {
                  quicksaveTimer = window.setTimeout(() => {
                    api
                      .quicksaveNote(mountedSlug, body)
                      .catch((err) =>
                        console.error("quicksave failed", err),
                      );
                  }, 300);
                }
                saveTimer = window.setTimeout(() => {
                  lastSavedBody = body;
                  const draftId = activeDraftIdRef;
                  if (draftId) {
                    api
                      .draftSave(mountedSlug, draftId, body)
                      .catch((err) =>
                        console.error("draft save failed", err),
                      );
                  } else {
                    onSaveLatest(
                      mountedSlug,
                      body,
                      undefined,
                      mountedPath,
                    );
                  }
                  onDirtyChange(false);
                  justSaved = true;
                  if (justSavedTimer)
                    window.clearTimeout(justSavedTimer);
                  justSavedTimer = window.setTimeout(
                    () => (justSaved = false),
                    1200,
                  );
                }, debounceMs);
              }
            }
            if (update.selectionSet || update.docChanged) {
              const sel = update.state.selection.main;
              const selected = sel.empty
                ? ""
                : update.state.sliceDoc(sel.from, sel.to);
              const chars = selected.length;
              const count = selected
                ? (selected.trim().match(/\S+/g)?.length ?? 0)
                : 0;
              const last = lastSelection;
              if (last.words !== count || last.chars !== chars) {
                lastSelection = { words: count, chars };
                window.dispatchEvent(
                  new CustomEvent("yarrow:selection-changed", {
                    detail: { words: count, chars },
                  }),
                );
              }
              const lineNum = update.state.doc.lineAt(sel.head).number;
              if (lastCursorLine !== lineNum) {
                lastCursorLine = lineNum;
                window.dispatchEvent(
                  new CustomEvent("yarrow:cursor-changed", {
                    detail: { line: lineNum },
                  }),
                );
              }
              if (
                document.documentElement.classList.contains(
                  "a11y-reading-guide",
                )
              ) {
                try {
                  const coords = update.view.coordsAtPos(sel.head);
                  const wrapRect = update.view.dom.getBoundingClientRect();
                  if (coords) {
                    const y =
                      coords.top -
                      wrapRect.top +
                      update.view.scrollDOM.scrollTop;
                    update.view.dom.style.setProperty(
                      "--cm-active-line-y",
                      `${y}px`,
                    );
                  }
                } catch {}
              }
            }
          }),
          EditorView.domEventHandlers({
            click: (e, _v) => {
              const raw = e.target as HTMLElement;
              const target =
                (raw.closest(".cm-yarrow-wikilink") as HTMLElement | null) ??
                raw;
              if (!target.classList.contains("cm-yarrow-wikilink"))
                return false;
              const m = /^!?\[\[(.+)\]\]$/.exec(
                (target.textContent || "").trim(),
              );
              if (!m) return false;
              e.preventDefault();
              e.stopPropagation();

              const query = m[1];
              const match = resolveWikilink(query);
              const targetSlug = match?.slug;

              if (
                preview?.mode === "click" &&
                ((targetSlug && preview.slug === targetSlug) ||
                  (!targetSlug && preview.title === query && preview.missing))
              ) {
                if (previewHideTimer)
                  window.clearTimeout(previewHideTimer);
                preview = null;
                return true;
              }

              const rect = target.getBoundingClientRect();
              const PREVIEW_W = 380;
              const PREVIEW_H_EST = 220;
              const spaceBelow = window.innerHeight - rect.bottom;
              const placeAbove =
                spaceBelow < PREVIEW_H_EST + 20 && rect.top > PREVIEW_H_EST;
              const x = Math.max(
                12,
                Math.min(window.innerWidth - PREVIEW_W - 12, rect.left),
              );
              const y = placeAbove ? rect.top - 8 : rect.bottom + 6;

              if (!match) {
                preview = {
                  x,
                  y,
                  placeAbove,
                  title: query,
                  body: "",
                  missing: true,
                  mode: "click",
                };
                return true;
              }
              const cached = sharedGetCachedPreview(match.slug);
              if (cached) {
                preview = {
                  x,
                  y,
                  placeAbove,
                  ...cached,
                  slug: match.slug,
                  mode: "click",
                };
                return true;
              }
              const fallbackTitle = match.title || match.slug;
              preview = {
                x,
                y,
                placeAbove,
                title: fallbackTitle,
                body: "",
                slug: match.slug,
                mode: "click",
              };
              api
                .readNote(match.slug)
                .then((n) => {
                  const payload = {
                    title: n.frontmatter.title || n.slug,
                    body: n.body,
                  };
                  cachePreview(n.slug, payload);
                  if (
                    preview?.mode === "click" &&
                    preview.slug === match.slug
                  ) {
                    preview = { ...preview, ...payload };
                  }
                })
                .catch(() => {
                  if (
                    preview?.mode === "click" &&
                    preview.slug === match.slug
                  ) {
                    preview = { ...preview, missing: true };
                  }
                });
              return true;
            },
            contextmenu: (e, v) => {
              const sel = v.state.selection.main;
              if (sel.empty) {
                const target = e.target as HTMLElement;
                if (target.classList.contains("cm-yarrow-misspelled")) {
                  const word = (target.textContent || "").trim();
                  if (word) {
                    const pos = v.posAtDOM(target);
                    const line = v.state.doc.lineAt(pos);
                    const idx = line.text.indexOf(word);
                    if (idx >= 0) {
                      const from = line.from + idx;
                      const to = from + word.length;
                      e.preventDefault();
                      e.stopPropagation();
                      const suggestions = spellSuggestRef
                        ? spellSuggestRef(word)
                        : [];
                      window.dispatchEvent(
                        new CustomEvent("yarrow:editor-spellcheck", {
                          detail: {
                            word,
                            suggestions,
                            x: e.clientX,
                            y: e.clientY,
                            from,
                            to,
                          },
                        }),
                      );
                      return true;
                    }
                  }
                }
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("yarrow:editor-contextmenu", {
                    detail: { text: "", x: e.clientX, y: e.clientY },
                  }),
                );
                return true;
              }
              const text = v.state.sliceDoc(sel.from, sel.to);
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("yarrow:editor-contextmenu", {
                  detail: {
                    text: text.trim() ? text : "",
                    x: e.clientX,
                    y: e.clientY,
                  },
                }),
              );
              return true;
            },
            mousemove: (e, v) => {
              const raw = e.target as HTMLElement;
              if (raw.closest(".cm-yarrow-wikilink")) {
                if (blameTimer) window.clearTimeout(blameTimer);
                return false;
              }
              if (blameTimer) window.clearTimeout(blameTimer);
              const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
              if (pos == null) return false;
              const { x, y } = { x: e.clientX, y: e.clientY };
              const epoch = ++blameEpoch;
              const slug = mountedSlug;
              blameTimer = window.setTimeout(() => {
                const lineNum = v.state.doc.lineAt(pos).number;
                api
                  .paragraphProvenance(slug, lineNum)
                  .then((p) => {
                    if (blameEpoch !== epoch) return;
                    blame = { x: x + 12, y: y + 18, p };
                  })
                  .catch(() => {
                    if (blameEpoch !== epoch) return;
                    blame = null;
                  });
              }, 1200);
              return false;
            },
            mouseleave: () => {
              if (blameTimer) window.clearTimeout(blameTimer);
              blame = null;
              return false;
            },
            drop: (e, v) => {
              if (!e.dataTransfer || e.dataTransfer.files.length === 0)
                return false;
              e.preventDefault();
              const pos =
                v.posAtCoords({ x: e.clientX, y: e.clientY }) ??
                v.state.selection.main.head;
              attachFilesToEditor(Array.from(e.dataTransfer.files), v, pos);
              return true;
            },
            dragover: (e, _v) => {
              if (e.dataTransfer && e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
              return false;
            },
            paste: (e, v) => {
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
                attachFilesToEditor(files, v, v.state.selection.main.head);
                return true;
              }
              const text = e.clipboardData.getData("text/plain");
              const url = isLikelyUrl(text);
              if (url) {
                e.preventDefault();
                const sel = v.state.selection.main;
                if (!sel.empty) {
                  const label = v.state.sliceDoc(sel.from, sel.to);
                  v.dispatch({
                    changes: {
                      from: sel.from,
                      to: sel.to,
                      insert: `[${label}](${url})`,
                    },
                    selection: {
                      anchor: sel.from + `[${label}](${url})`.length,
                    },
                  });
                  return true;
                }
                const insertAt = sel.head;
                v.dispatch({
                  changes: { from: insertAt, to: insertAt, insert: url },
                  selection: { anchor: insertAt + url.length },
                });
                api
                  .fetchUrlTitle(url)
                  .then((titleStr) => {
                    const trimmed = titleStr.trim();
                    if (!trimmed) return;
                    const current = v.state.doc.sliceString(
                      insertAt,
                      insertAt + url.length,
                    );
                    if (current !== url) return;
                    const replacement = `[${escapeMdLinkText(trimmed)}](${url})`;
                    v.dispatch({
                      changes: {
                        from: insertAt,
                        to: insertAt + url.length,
                        insert: replacement,
                      },
                    });
                  })
                  .catch(() => {
                    /* leave the raw URL */
                  });
                return true;
              }
              return false;
            },
          }),
        ],
      });

      localView = new EditorView({ state, parent: hostEl });
      view = localView;
    };

    mount().catch((err) => {
      console.error("editor mount failed", err);
    });

    return () => {
      cancelled = true;
      if (saveTimer) window.clearTimeout(saveTimer);
      if (quicksaveTimer) window.clearTimeout(quicksaveTimer);
      if (blameTimer) window.clearTimeout(blameTimer);
      if (justSavedTimer) window.clearTimeout(justSavedTimer);
      if (previewTimer) window.clearTimeout(previewTimer);
      if (bodyBroadcastTimer) {
        window.clearTimeout(bodyBroadcastTimer);
        if (localView) {
          try {
            onBodyChangeLatest?.(localView.state.doc.toString());
          } catch {}
        }
      }
      if (localView) {
        try {
          const body = localView.state.doc.toString();
          if (body !== lastSavedBody) {
            lastSavedBody = body;
            const draftId = activeDraftIdRef;
            if (draftId) {
              api
                .draftSave(mountedSlug, draftId, body)
                .catch(() => {});
            } else {
              onSaveLatest(mountedSlug, body, undefined, mountedPath);
            }
          }
        } catch {
          /* swallow */
        }
        localView.destroy();
      }
      view = null;
    };
  });

  // Live-reconfigure the hide-syntax plugin when the mode toggles. Far
  // cheaper than a full editor teardown/remount.
  $effect(() => {
    void showRawMarkdown;
    const v = view;
    if (!v) return;
    v.dispatch({
      effects: hideSyntaxCompartment.reconfigure(
        showRawMarkdown ? [] : hideSyntaxPlugin(),
      ),
    });
  });

  // Note slug change — reset title + clear blame.
  $effect(() => {
    void note.slug;
    void note.body;
    void note.frontmatter.title;
    title = note.frontmatter.title || note.slug;
    if (blameTimer) {
      window.clearTimeout(blameTimer);
      blameTimer = null;
    }
    blameEpoch++;
    blame = null;
  });

  // External body swap.
  $effect(() => {
    void note.body;
    if (activeDraftIdRef) return;
    const v = view;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current === note.body) return;
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    v.dispatch({
      changes: { from: 0, to: current.length, insert: note.body },
    });
    lastSavedBody = note.body;
    onDirtyChange(false);
  });

  // Reset draft state on slug change.
  $effect(() => {
    void note.slug;
    activeDraftId = null;
    mainBodySnapshot = null;
    draftSwitchTarget = undefined;
  });

  // Draft swap effect — fires when the user clicks a different tab.
  $effect(() => {
    void activeDraftId;
    const target = draftSwitchTarget;
    if (target === undefined) return;
    draftSwitchTarget = undefined;
    const v = view;
    if (!v) return;
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    const previousId = activeDraftIdRef;
    const currentDoc = v.state.doc.toString();

    if (currentDoc !== lastSavedBody) {
      if (previousId) {
        api
          .draftSave(mountedSlug, previousId, currentDoc)
          .catch((err) =>
            console.error("draft pre-swap save failed", err),
          );
      } else {
        mainBodySnapshot = currentDoc;
        onSave(mountedSlug, currentDoc, undefined, mountedPath);
      }
    } else if (!previousId) {
      mainBodySnapshot = currentDoc;
    }

    // The reactive write was set by the click handler before this
    // effect fired; we mirror it into the imperative ref now so the
    // CodeMirror callbacks see the right value.
    activeDraftIdRef = target;

    if (target === null) {
      const restored = mainBodySnapshot ?? note.body;
      mainBodySnapshot = null;
      v.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: restored },
      });
      lastSavedBody = restored;
      onDirtyChange(false);
      return;
    }

    api
      .draftRead(mountedSlug, target)
      .then((body) => {
        const vv = view;
        if (!vv) return;
        if (activeDraftIdRef !== target) return;
        const cur = vv.state.doc.toString();
        vv.dispatch({
          changes: { from: 0, to: cur.length, insert: body },
        });
        lastSavedBody = body;
        onDirtyChange(false);
      })
      .catch((err) => console.error("draft read failed", err));
  });

  // Jump to a specific line.
  $effect(() => {
    if (!jumpToLine) return;
    const v = view;
    if (!v) return;
    const lineNum = Math.max(
      1,
      Math.min(jumpToLine.line, v.state.doc.lines),
    );
    const pos = v.state.doc.line(lineNum).from;
    v.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true,
    });
    v.focus();
  });

  // Content-anchored scroll restoration.
  $effect(() => {
    void note.slug;
    const onScroll = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{ slug?: string; line?: number; snippet?: string }>
      ).detail;
      if (!detail) return;
      if (detail.slug && detail.slug !== note.slug) return;
      const v = view;
      if (!v) return;
      const doc = v.state.doc;
      let pos: number | null = null;
      const snippet = (detail.snippet || "").trim();
      if (snippet.length >= 8) {
        const probe = snippet.length > 60 ? snippet.slice(0, 60) : snippet;
        const idx = doc.toString().indexOf(probe);
        if (idx >= 0) pos = idx;
      }
      if (pos === null && detail.line && detail.line > 0) {
        const lineNum = Math.max(1, Math.min(detail.line, doc.lines));
        pos = doc.line(lineNum).from;
      }
      if (pos === null) return;
      v.dispatch({
        selection: { anchor: pos, head: pos },
        scrollIntoView: true,
      });
    };
    window.addEventListener(
      "yarrow:scroll-to-line",
      onScroll as EventListener,
    );
    return () =>
      window.removeEventListener(
        "yarrow:scroll-to-line",
        onScroll as EventListener,
      );
  });

  // External text insertion / clipboard / select-all wiring.
  $effect(() => {
    const onInsert = (ev: Event) => {
      const v = view;
      if (!v) return;
      const text = (ev as CustomEvent<{ text: string }>).detail?.text ?? "";
      if (!text) return;
      const cursor = v.state.selection.main.head;
      const before = v.state.sliceDoc(Math.max(0, cursor - 2), cursor);
      const prefix =
        cursor === 0 || before.endsWith("\n\n")
          ? ""
          : before.endsWith("\n")
            ? "\n"
            : "\n\n";
      const insert = prefix + text + "\n";
      v.dispatch({
        changes: { from: cursor, to: cursor, insert },
        selection: { anchor: cursor + insert.length },
        scrollIntoView: true,
      });
      v.focus();
      try {
        onBodyChangeLatest?.(v.state.doc.toString());
      } catch {}
    };
    window.addEventListener(
      "yarrow:editor-insert",
      onInsert as EventListener,
    );

    const onReplaceRange = (ev: Event) => {
      const v = view;
      if (!v) return;
      const detail = (
        ev as CustomEvent<{ from: number; to: number; text: string }>
      ).detail;
      if (!detail) return;
      const max = v.state.doc.length;
      const from = Math.max(0, Math.min(detail.from, max));
      const to = Math.max(from, Math.min(detail.to, max));
      v.dispatch({
        changes: { from, to, insert: detail.text },
        selection: { anchor: from + detail.text.length },
      });
      v.focus();
      try {
        onBodyChangeLatest?.(v.state.doc.toString());
      } catch {}
    };
    window.addEventListener(
      "yarrow:editor-replace-range",
      onReplaceRange as EventListener,
    );

    const onInsertRaw = (ev: Event) => {
      const v = view;
      if (!v) return;
      const detail = (
        ev as CustomEvent<{
          text: string;
          caretOffset?: number;
          atLineStart?: boolean;
        }>
      ).detail;
      const text = detail?.text ?? "";
      if (!text) return;
      const sel = v.state.selection.main;
      let from = sel.from;
      let to = sel.to;
      let leadingNewline = "";
      if (detail?.atLineStart) {
        const line = v.state.doc.lineAt(sel.head);
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
        from + leadingNewline.length + (detail?.caretOffset ?? text.length);
      v.dispatch({
        changes: { from, to, insert },
        selection: { anchor: caret },
        scrollIntoView: true,
      });
      v.focus();
      try {
        onBodyChangeLatest?.(v.state.doc.toString());
      } catch {}
    };
    window.addEventListener(
      "yarrow:editor-insert-raw",
      onInsertRaw as EventListener,
    );

    const onCut = () => {
      const v = view;
      if (!v) return;
      const sel = v.state.selection.main;
      if (sel.from === sel.to) return;
      const text = v.state.sliceDoc(sel.from, sel.to);
      void import("@tauri-apps/plugin-clipboard-manager")
        .then((mod) => mod.writeText(text))
        .catch(() => {
          try {
            navigator.clipboard?.writeText(text);
          } catch {}
        });
      v.dispatch({
        changes: { from: sel.from, to: sel.to, insert: "" },
        selection: { anchor: sel.from },
      });
      v.focus();
      try {
        onBodyChangeLatest?.(v.state.doc.toString());
      } catch {}
    };
    window.addEventListener("yarrow:editor-cut", onCut);

    const onPaste = async () => {
      const v = view;
      if (!v) return;
      let text = "";
      try {
        const mod = await import("@tauri-apps/plugin-clipboard-manager");
        text = (await mod.readText()) ?? "";
      } catch {
        try {
          text = await navigator.clipboard.readText();
        } catch {
          return;
        }
      }
      if (!text) return;
      const sel = v.state.selection.main;
      v.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text },
        selection: { anchor: sel.from + text.length },
        scrollIntoView: true,
      });
      v.focus();
      try {
        onBodyChangeLatest?.(v.state.doc.toString());
      } catch {}
    };
    window.addEventListener("yarrow:editor-paste", onPaste);

    const onSelectAll = () => {
      const v = view;
      if (!v) return;
      const len = v.state.doc.length;
      v.dispatch({
        selection: { anchor: 0, head: len },
      });
      v.focus();
    };
    window.addEventListener("yarrow:editor-select-all", onSelectAll);

    return () => {
      window.removeEventListener(
        "yarrow:editor-insert",
        onInsert as EventListener,
      );
      window.removeEventListener(
        "yarrow:editor-replace-range",
        onReplaceRange as EventListener,
      );
      window.removeEventListener(
        "yarrow:editor-insert-raw",
        onInsertRaw as EventListener,
      );
      window.removeEventListener("yarrow:editor-cut", onCut);
      window.removeEventListener("yarrow:editor-paste", onPaste);
      window.removeEventListener("yarrow:editor-select-all", onSelectAll);
    };
  });

  function saveNow() {
    if (!view) return;
    if (saveTimer) window.clearTimeout(saveTimer);
    const body = view.state.doc.toString();
    if (body !== lastSavedBody) {
      lastSavedBody = body;
      onSave(mountedSlug, body, undefined, mountedPath);
      onDirtyChange(false);
    }
  }

  function handleTitleBlur() {
    const next = title.trim();
    if (next && next !== note.frontmatter.title) {
      onTitleChange(next);
    } else if (!next) {
      title = note.frontmatter.title || note.slug;
    }
  }

  function acceptFork() {
    const body = view?.state.doc.toString() ?? note.body;
    const paragraphs = body.split(/\n{2,}/);
    const last = paragraphs[paragraphs.length - 1]?.trim();
    if (last) dismissedFork.add(last);
    showForkSuggestion = false;
    onOpenFork();
  }

  function dismissForkFn() {
    const body = view?.state.doc.toString() ?? note.body;
    const paragraphs = body.split(/\n{2,}/);
    const last = paragraphs[paragraphs.length - 1]?.trim();
    if (last) dismissedFork.add(last);
    showForkSuggestion = false;
  }

  let linkTitleMap = $derived.by(() => {
    const m: Record<string, string> = {};
    for (const n of notes) m[n.slug] = n.title;
    return m;
  });

  // ── 2.0 path-tinted caret ──
  let pathColor = $derived(
    colorForPath(currentPath || "main", { overrides: pathColorOverrides }),
  );
  $effect(() => {
    const host = hostEl;
    if (!host) return;
    host.style.setProperty("--caret-path-color", pathColor);
    if (caretTintOn) host.classList.add("yarrow-caret-tinted");
    else host.classList.remove("yarrow-caret-tinted");
  });

  // ── 2.0 typewriter mode ──
  $effect(() => {
    void note.slug;
    if (!typewriterOn) return;
    const v = view;
    if (!v) return;
    let scroller: HTMLElement | null = hostEl;
    while (scroller && scroller.parentElement) {
      const ov = getComputedStyle(scroller).overflowY;
      if (ov === "auto" || ov === "scroll") break;
      scroller = scroller.parentElement;
    }
    if (!scroller) return;
    const localScroller = scroller;
    const centre = () => {
      const vv = view;
      if (!vv) return;
      const pos = vv.state.selection.main.head;
      const coords = vv.coordsAtPos(pos);
      if (!coords) return;
      const rect = localScroller.getBoundingClientRect();
      const caretY = (coords.top + coords.bottom) / 2;
      const targetY = rect.top + rect.height / 2;
      const delta = caretY - targetY;
      if (Math.abs(delta) < 2) return;
      localScroller.scrollBy({ top: delta, behavior: "auto" });
    };
    window.setTimeout(centre, 40);
    const onChange = () => {
      window.requestAnimationFrame(centre);
    };
    window.addEventListener("yarrow:selection-changed", onChange);
    const host = hostEl;
    host?.addEventListener("click", onChange);
    host?.addEventListener("keyup", onChange);
    return () => {
      window.removeEventListener("yarrow:selection-changed", onChange);
      host?.removeEventListener("click", onChange);
      host?.removeEventListener("keyup", onChange);
    };
  });

  let annotations = $derived(note.frontmatter.annotations ?? []);
  let hasAnnotations = $derived(annotations.length > 0);

  // Drafts (Pillar 2) — handlers called by the strip.
  function handleDraftSwitch(id: string | null) {
    if (id === activeDraftIdRef) return;
    draftSwitchTarget = id;
    activeDraftId = id;
  }

  async function handleDraftCreate(displayName: string) {
    const v = view;
    const seedBody = v?.state.doc.toString() ?? note.body;
    try {
      const created = await api.draftCreate(
        mountedSlug,
        displayName,
        seedBody,
      );
      onDraftsChanged?.();
      handleDraftSwitch(created.id);
    } catch (err) {
      console.error("draft create failed", err);
    }
  }

  async function handleDraftRename(id: string, displayName: string) {
    try {
      await api.draftRename(mountedSlug, id, displayName);
      onDraftsChanged?.();
    } catch (err) {
      console.error("draft rename failed", err);
    }
  }

  async function handleDraftDiscard(id: string) {
    try {
      await api.draftDiscard(mountedSlug, id);
      if (activeDraftIdRef === id) {
        handleDraftSwitch(null);
      }
      onDraftsChanged?.();
    } catch (err) {
      console.error("draft discard failed", err);
    }
  }

  async function handleDraftKeep(id: string) {
    try {
      await api.draftPromote(mountedSlug, id);
      handleDraftSwitch(null);
      onDraftsChanged?.();
      onDraftPromoted?.(mountedSlug);
    } catch (err) {
      console.error("draft promote failed", err);
    }
  }

  function onPaneContextMenu(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable='true']")) return;
    if (target.closest(".cm-editor")) return;
    e.preventDefault();
    window.dispatchEvent(
      new CustomEvent("yarrow:editor-contextmenu", {
        detail: { text: "", x: e.clientX, y: e.clientY },
      }),
    );
  }

  function onDivergingPathClick(e: MouseEvent, p: string) {
    peek = {
      sourcePath: p,
      sourcePathLabel: p,
      x: e.clientX,
      y: e.clientY,
    };
  }

  function onLinkChipClick(e: MouseEvent, target: string) {
    if (preview?.mode === "click" && preview.slug === target) {
      if (previewHideTimer) window.clearTimeout(previewHideTimer);
      preview = null;
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const PREVIEW_W = 380;
    const PREVIEW_H_EST = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove =
      spaceBelow < PREVIEW_H_EST + 20 && rect.top > PREVIEW_H_EST;
    const x = Math.max(
      12,
      Math.min(window.innerWidth - PREVIEW_W - 12, rect.left),
    );
    const y = placeAbove ? rect.top - 8 : rect.bottom + 6;

    const cached = sharedGetCachedPreview(target);
    if (cached) {
      preview = {
        x,
        y,
        placeAbove,
        ...cached,
        slug: target,
        mode: "click",
      };
      return;
    }
    const fallbackTitle = linkTitleMap[target] ?? target;
    preview = {
      x,
      y,
      placeAbove,
      title: fallbackTitle,
      body: "",
      slug: target,
      mode: "click",
    };
    api
      .readNote(target)
      .then((n) => {
        const payload = {
          title: n.frontmatter.title || n.slug,
          body: n.body,
        };
        cachePreview(n.slug, payload);
        if (preview?.mode === "click" && preview.slug === target) {
          preview = { ...preview, ...payload };
        }
      })
      .catch(() => {
        if (preview?.mode === "click" && preview.slug === target) {
          preview = { ...preview, missing: true };
        }
      });
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={`note-enter relative flex-1 overflow-y-auto px-12 py-12 2xl:px-24${typewriterOn ? " yarrow-typewriter" : ""}`}
  oncontextmenu={onPaneContextMenu}
>
  <div class="w-full max-w-[680px] xl:max-w-[820px] 2xl:max-w-[960px] mx-auto">
    <div
      class={`font-serif italic text-xs text-t3 mb-5 inline-block px-1 py-0.5 rounded transition-colors ${
        justSaved ? "edited-pulse" : ""
      }`}
    >
      {editorialDate(note.frontmatter.modified)} · {t("editor.note.writtenInThe")}{" "}
      {timeOfDayPhrase(note.frontmatter.modified)}
      <span class="text-t3/70"> · </span>
      <span class="font-mono not-italic text-2xs">{currentPath || "main"}</span>
      <span class="text-t3/70"> · </span>
      <span class="not-italic">
        {justSaved ? t("editor.note.saved") : t("editor.note.edited")}
        {relativeTime(note.frontmatter.modified)}
      </span>
    </div>
    {#if divergingPaths.filter((p) => p !== (currentPath || rootPathName)).length > 0}
      <div
        class="font-serif italic text-2xs text-t3 mb-4 flex items-baseline gap-1.5 flex-wrap"
      >
        <span>{t("paths.aware.alsoExistsOn")}</span>
        {#each divergingPaths.filter((p) => p !== (currentPath || rootPathName)) as p (p)}
          <button
            type="button"
            onclick={(e) => onDivergingPathClick(e, p)}
            title={t("paths.aware.peekTitle", { path: p })}
            class="font-mono not-italic px-1.5 py-0.5 rounded-sm border border-bd hover:border-bd2 hover:bg-s1 hover:text-char transition"
          >
            {p} <span class="text-yeld">·</span>{" "}
            <span class="text-yeld">{t("paths.aware.differs")}</span>
          </button>
        {/each}
      </div>
    {/if}
    <DraftTabStrip
      {drafts}
      {activeDraftId}
      onSwitch={handleDraftSwitch}
      onCreate={handleDraftCreate}
      onRename={handleDraftRename}
      onDiscard={handleDraftDiscard}
      onKeep={handleDraftKeep}
      enabled={draftsEnabled}
    />
    <input
      bind:value={title}
      onblur={handleTitleBlur}
      onkeydown={(e) => {
        if (e.key === "Enter")
          (e.currentTarget as HTMLInputElement).blur();
      }}
      placeholder={t("editor.note.titlePlaceholder")}
      class="w-full font-editor text-char bg-transparent outline-hidden placeholder:text-t3 mb-4 font-semibold"
      style:font-size="60px"
      style:line-height="1.05"
      style:letter-spacing="-1.5px"
    />
    <TagChips
      initial={note.frontmatter.tags ?? []}
      suggestions={tagSuggestions}
      onCommit={(next) => onTagsChange?.(mountedSlug, next)}
    />
    <TagBouquet
      slug={mountedSlug}
      title={note.frontmatter.title ?? ""}
      body={note.body ?? ""}
      existingTags={note.frontmatter.tags ?? []}
      locked={note.locked}
      onAdopt={(tag) => {
        const next = [...(note.frontmatter.tags ?? []), tag];
        onTagsChange?.(mountedSlug, next);
      }}
    />
    {#if onAnnotationsChange}
      <div class={hasAnnotations ? "yarrow-annotations-layout mt-6" : "mt-6"}>
        <div
          bind:this={hostEl}
          onblur={saveNow}
          class="yarrow-note-host min-h-[50vh]"
        ></div>
        {#if hasAnnotations}
          <aside class="yarrow-annotations-gutter">
            <AnnotationsGutter
              {annotations}
              onChange={(next) => onAnnotationsChange(mountedSlug, next)}
            />
          </aside>
        {/if}
      </div>
    {:else}
      <div
        bind:this={hostEl}
        onblur={saveNow}
        class="yarrow-note-host min-h-[50vh] mt-6"
      ></div>
    {/if}

    {#if note.frontmatter.links.length > 0}
      <div
        class="mt-14 pt-7 border-t border-bd flex items-baseline gap-3 flex-wrap"
      >
        <span class="font-serif italic text-xs text-t3">
          {t("editor.note.connectsTo")}
        </span>
        {#each note.frontmatter.links as l (l.target)}
          <button
            onclick={(e) => onLinkChipClick(e, l.target)}
            class="px-2.5 py-0.5 rounded-full bg-s2 text-t2 font-serif italic text-xs hover:bg-s3 hover:text-char transition"
            title={`${l.type.replace("-", " ")} — ${linkTitleMap[l.target] ?? l.target}`}
          >
            {linkTitleMap[l.target] ?? l.target}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <ForkSuggestion
    visible={showForkSuggestion}
    onAccept={acceptFork}
    onDismiss={dismissForkFn}
  />

  {#if blame}
    <div
      style:left="{blame.x}px"
      style:top="{blame.y}px"
      class="fixed z-40 pointer-events-none bg-char text-bg text-2xs px-2 py-1 rounded-sm shadow-lg animate-fadeIn"
    >
      {t("editor.note.blame", {
        when: relativeTime(blame.p.timestamp),
        path: blame.p.path_name,
      })}
    </div>
  {/if}

  {#if preview}
    <WikilinkPreview
      data={preview}
      {currentPath}
      {pathNotes}
      onBranchHere={(slug) => {
        if (previewHideTimer) window.clearTimeout(previewHideTimer);
        preview = null;
        onBranchFromWikilink?.(slug);
      }}
      onOpen={(slug) => {
        if (previewHideTimer) window.clearTimeout(previewHideTimer);
        preview = null;
        onNavigate(slug);
      }}
      onEnter={() => {
        if (previewHideTimer) window.clearTimeout(previewHideTimer);
      }}
      onLeave={() => {
        preview = null;
      }}
    />
  {/if}

  {#if peek}
    <PathPeek
      slug={mountedSlug}
      sourcePath={peek.sourcePath}
      sourcePathLabel={peek.sourcePathLabel}
      destPath={currentPath || ""}
      currentBody={view?.state.doc.toString() ?? note.body ?? ""}
      noteTitle={note.frontmatter.title || note.slug}
      anchorX={peek.x}
      anchorY={peek.y}
      onClose={() => (peek = null)}
      onBorrowed={() => {
        onBorrowed?.(mountedSlug);
      }}
      onCompare={() => {
        if (!peek) return;
        const peekRef = peek;
        window.dispatchEvent(
          new CustomEvent("yarrow:open-compare", {
            detail: {
              leftPath: peekRef.sourcePath || rootPathName,
              rightPath: currentPath || rootPathName,
              slug: mountedSlug,
            },
          }),
        );
      }}
      onToast={(msg) => {
        window.dispatchEvent(
          new CustomEvent("yarrow:toast", { detail: msg }),
        );
      }}
    />
  {/if}
</div>
