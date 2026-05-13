<script lang="ts">
  import { tick } from "svelte";
  import { api } from "../lib/tauri";
  import type { EncryptionStatus, NoteSummary, PathInfo, SearchHit, TagCount } from "../lib/types";
  import {
    SearchIcon,
    NoteIcon,
    NewDirectionIcon,
    EnterKeyIcon,
  } from "../lib/iconsSvelte";
  import { SK } from "../lib/platform.svelte";
  import EmptyState from "./EmptyState.svelte";
  import { tr } from "../lib/i18n/index.svelte";
  import { defaultLabel, type TagDef } from "../lib/tags.svelte";
  import { animate, utils, stagger, reducedMotion } from "../lib/anim.svelte";

  type Section = "recents" | "actions" | "notes" | "tags" | "paths";
  const SECTION_ORDER: Section[] = ["recents", "actions", "notes", "tags", "paths"];

  interface Action {
    kind: "command" | "note" | "path" | "search" | "tag" | "template";
    key: string;
    label: string;
    sublabel?: string;
    snippet?: string;
    hint?: string;
    section: Section;
    run: () => void;
  }

  const MRU_KEY = "yarrow.cmdPalette.recents";
  const MRU_LIMIT = 8;
  function readMru(): string[] {
    try {
      const raw = localStorage.getItem(MRU_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((s) => typeof s === "string").slice(0, MRU_LIMIT) : [];
    } catch {
      return [];
    }
  }
  function writeMru(key: string): void {
    try {
      const cur = readMru().filter((k) => k !== key);
      const next = [key, ...cur].slice(0, MRU_LIMIT);
      localStorage.setItem(MRU_KEY, JSON.stringify(next));
    } catch {}
  }

  interface Props {
    open: boolean;
    onClose: () => void;
    notes: NoteSummary[];
    paths: PathInfo[];
    currentPath: string;
    onSelectNote: (slug: string) => void;
    onSwitchPath: (name: string) => void;
    onNewNote: (prefilledTitle?: string) => void;
    onNewDirection: () => void;
    onOpenScratchpad: () => void;
    onToggleFocus: () => void;
    onSync: () => void;
    onConnect: () => void;
    onOpenHistory: () => void;
    onJumpToday: () => void;
    tags?: TagCount[];
    onFilterTag?: (tag: string) => void;
    templates?: { name: string; label: string }[];
    onNewFromTemplate?: (name: string) => void;
    onOpenTemplatePicker?: () => void;
    onOpenJournalKits?: () => void;
    encryption?: EncryptionStatus;
    activeIsEncrypted?: boolean;
    onLockEncryption?: () => void;
    onUnlockEncryption?: () => void;
    onEncryptActiveNote?: () => void;
    onDecryptActiveNote?: () => void;
    onOpenSecurity?: () => void;
    onSwitchWorkspace?: () => void;
    onOpenNewWindow?: () => void;
    onFindReplace?: () => void;
    onPrintActiveNote?: () => void;
    onOpenTrash?: () => void;
    onOpenActivity?: () => void;
    onOpenTagGraph?: () => void;
    onInsertTable?: () => void;
    onInsertBibliography?: () => void;
    onOpenOutline?: () => void;
    livePreviewOn?: boolean;
    onToggleLivePreview?: () => void;
    onPrintCurrentPath?: () => void;
    onImportObsidian?: () => void;
    onComparePaths?: () => void;
    onOpenDecisionMatrix?: () => void;
    mappingEnabled?: boolean;
    /** 3.2+ — open-questions panel and code-highlight toggle survived
     *  the persona retirement as generic features. Wired here so they
     *  stay reachable from ⌘K. */
    onOpenOpenQuestions?: () => void;
    hasOpenQuestions?: boolean;
    onToggleCodeHighlight?: () => void;
    codeHighlightOn?: boolean;
    /** 3.2+ tag-driven saved views. Each configured tag becomes a "View
     *  <label>" command that opens SavedViewModal filtered to that tag. */
    pinnedTags?: readonly TagDef[];
    onOpenSavedView?: (tagName: string) => void;
  }

  let props: Props = $props();
  let { open, onClose } = $derived(props);

  let t = $derived(tr());

  let q = $state("");
  let hits = $state<SearchHit[]>([]);
  let cursor = $state(0);
  let inputRef = $state<HTMLInputElement | null>(null);
  let listRef = $state<HTMLDivElement | null>(null);
  let backdropRef = $state<HTMLDivElement | null>(null);
  let paletteRef = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (open) {
      q = "";
      hits = [];
      cursor = 0;
      const id = window.setTimeout(() => inputRef?.focus(), 30);
      // Two-phase entrance via anime.js: backdrop fades, panel rises
      // with a soft overshoot, then the first batch of rows cascades
      // in. We gate everything on tick() so bind:this refs are
      // populated; we also imperatively set initial state via
      // utils.set rather than relying on `style:opacity="0"`, so a
      // failed animation degrades to visible-and-snapped instead of
      // permanently invisible.
      tick().then(() => {
        if (!open) return;
        const bd = backdropRef;
        const pl = paletteRef;
        const ls = listRef;
        if (reducedMotion()) {
          if (bd) bd.style.opacity = "1";
          if (pl) pl.style.opacity = "1";
          return;
        }
        if (bd) {
          utils.set(bd, { opacity: 0 });
          animate(bd, {
            opacity: [0, 1],
            duration: 220,
            ease: "outQuad",
          });
        }
        if (pl) {
          utils.set(pl, { opacity: 0, scale: 0.96, y: 14 });
          animate(pl, {
            opacity: [0, 1],
            scale: [0.96, 1],
            y: [14, 0],
            duration: 380,
            ease: "outBack(1.2)",
          });
        }
        if (ls) {
          const rows = Array.from(
            ls.querySelectorAll<HTMLElement>("[data-idx]"),
          ).slice(0, 9);
          if (rows.length > 0) {
            utils.set(rows, { opacity: 0, y: 4 });
            animate(rows, {
              opacity: [0, 1],
              y: [4, 0],
              duration: 260,
              delay: stagger(28, { start: 80 }),
              ease: "outCubic",
            });
          }
        }
      });
      return () => window.clearTimeout(id);
    }
  });

  $effect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      hits = [];
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      api.search(term, 12).then((r) => {
        if (!cancelled) hits = r;
      }).catch(() => {});
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  });

  let rawTrimmed = $derived(q.trim());
  let scopeFilter = $derived<Section | null>(
    rawTrimmed.startsWith("#")
      ? "tags"
      : rawTrimmed.startsWith(">")
        ? "actions"
        : rawTrimmed.startsWith(":")
          ? "notes"
          : null,
  );
  let residualQuery = $derived(scopeFilter ? rawTrimmed.slice(1).trim() : rawTrimmed);

  let allActions = $derived.by<Action[]>(() => {
    if (scopeFilter === "tags" && props.tags) {
      const tq = residualQuery.toLowerCase();
      return props.tags
        .filter((tg) => !tq || tg.tag.toLowerCase().includes(tq))
        .slice(0, 20)
        .map<Action>((tg) => ({
          kind: "tag",
          key: `tag-${tg.tag}`,
          label: `#${tg.tag}`,
          sublabel: tg.count === 1
            ? t("modals.commandPalette.tagFilter", { count: String(tg.count) })
            : t("modals.commandPalette.tagFilterPlural", { count: String(tg.count) }),
          section: "tags",
          run: () => { onClose(); props.onFilterTag?.(tg.tag); },
        }));
    }

    type Cmd = Omit<Action, "section">;
    const commands: Cmd[] = [
      { kind: "command", key: "new-note", label: t("modals.commandPalette.cmdNewNote"), hint: SK.newNote, run: () => { onClose(); props.onNewNote(); } },
      ...(props.onOpenTemplatePicker ? [{ kind: "command" as const, key: "new-from-template", label: t("modals.commandPalette.cmdNewFromTemplate"), sublabel: t("modals.commandPalette.cmdNewFromTemplateSub"), run: () => { onClose(); props.onOpenTemplatePicker!(); } }] : []),
      ...(props.onOpenJournalKits ? [{ kind: "command" as const, key: "journal-kit", label: t("modals.commandPalette.cmdJournalKit"), sublabel: t("modals.commandPalette.cmdJournalKitSub"), run: () => { onClose(); props.onOpenJournalKits!(); } }] : []),
      { kind: "command", key: "jump-today", label: t("modals.commandPalette.cmdJumpToday"), sublabel: t("modals.commandPalette.cmdJumpTodaySub"), hint: SK.jumpToday, run: () => { onClose(); props.onJumpToday(); } },
      ...(props.mappingEnabled !== false ? [
        { kind: "command" as const, key: "new-direction", label: t("modals.commandPalette.cmdNewDirection"), sublabel: t("modals.commandPalette.cmdNewDirectionSub"), hint: SK.newDirection, run: () => { onClose(); props.onNewDirection(); } },
        { kind: "command" as const, key: "connect", label: t("modals.commandPalette.cmdConnect"), sublabel: t("modals.commandPalette.cmdConnectSub"), run: () => { onClose(); props.onConnect(); } },
      ] : []),
      { kind: "command", key: "history", label: t("modals.commandPalette.cmdHistory"), sublabel: t("modals.commandPalette.cmdHistorySub"), run: () => { onClose(); props.onOpenHistory(); } },
      { kind: "command", key: "focus", label: t("modals.commandPalette.cmdFocus"), sublabel: t("modals.commandPalette.cmdFocusSub"), hint: SK.focusToggle, run: () => { onClose(); props.onToggleFocus(); } },
      { kind: "command", key: "scratch", label: t("modals.commandPalette.cmdScratchpad"), sublabel: t("modals.commandPalette.cmdScratchpadSub"), hint: SK.scratchpad, run: () => { onClose(); props.onOpenScratchpad(); } },
      { kind: "command", key: "sync", label: t("modals.commandPalette.cmdSync"), run: () => { onClose(); props.onSync(); } },
      ...(props.onSwitchWorkspace ? [{ kind: "command" as const, key: "switch-workspace", label: t("modals.commandPalette.cmdSwitchWorkspace"), sublabel: t("modals.commandPalette.cmdSwitchWorkspaceSub"), hint: SK.switchWorkspace, run: () => { onClose(); props.onSwitchWorkspace!(); } }] : []),
      ...(props.onOpenNewWindow ? [{ kind: "command" as const, key: "new-window", label: t("modals.commandPalette.cmdNewWindow"), sublabel: t("modals.commandPalette.cmdNewWindowSub"), run: () => { onClose(); props.onOpenNewWindow!(); } }] : []),
      ...(props.onFindReplace ? [{ kind: "command" as const, key: "find-replace", label: t("modals.commandPalette.cmdFindReplace"), sublabel: t("modals.commandPalette.cmdFindReplaceSub"), run: () => { onClose(); props.onFindReplace!(); } }] : []),
      ...(props.onPrintActiveNote ? [{ kind: "command" as const, key: "print", label: t("modals.commandPalette.cmdPrint"), sublabel: t("modals.commandPalette.cmdPrintSub"), run: () => { onClose(); props.onPrintActiveNote!(); } }] : []),
      ...(props.onOpenTrash ? [{ kind: "command" as const, key: "trash", label: t("modals.commandPalette.cmdTrash"), sublabel: t("modals.commandPalette.cmdTrashSub"), run: () => { onClose(); props.onOpenTrash!(); } }] : []),
      ...(props.onImportObsidian ? [{ kind: "command" as const, key: "import-foreign", label: t("modals.commandPalette.cmdImport"), sublabel: t("modals.commandPalette.cmdImportSub"), run: () => { onClose(); props.onImportObsidian!(); } }] : []),
      ...(props.onComparePaths ? [{ kind: "command" as const, key: "compare-paths", label: t("modals.commandPalette.cmdComparePaths"), sublabel: t("modals.commandPalette.cmdComparePathsSub"), run: () => { onClose(); props.onComparePaths!(); } }] : []),
      ...(props.onOpenDecisionMatrix ? [{ kind: "command" as const, key: "decision-matrix", label: t("modals.commandPalette.cmdDecisionMatrix"), sublabel: t("modals.commandPalette.cmdDecisionMatrixSub"), run: () => { onClose(); props.onOpenDecisionMatrix!(); } }] : []),
      ...(props.onOpenActivity ? [{ kind: "command" as const, key: "activity-heatmap", label: t("modals.commandPalette.cmdActivity"), sublabel: t("modals.commandPalette.cmdActivitySub"), run: () => { onClose(); props.onOpenActivity!(); } }] : []),
      ...(props.onOpenTagGraph ? [{ kind: "command" as const, key: "tag-graph", label: t("modals.commandPalette.cmdTagGraph"), sublabel: t("modals.commandPalette.cmdTagGraphSub"), run: () => { onClose(); props.onOpenTagGraph!(); } }] : []),
      ...(props.onInsertTable ? [{ kind: "command" as const, key: "insert-table", label: t("modals.commandPalette.cmdInsertTable"), sublabel: t("modals.commandPalette.cmdInsertTableSub"), run: () => { onClose(); props.onInsertTable!(); } }] : []),
      ...(props.onInsertBibliography ? [{ kind: "command" as const, key: "insert-bibliography", label: t("modals.commandPalette.cmdInsertBibliography"), sublabel: t("modals.commandPalette.cmdInsertBibliographySub"), run: () => { onClose(); props.onInsertBibliography!(); } }] : []),
      ...(props.onOpenOutline ? [{ kind: "command" as const, key: "open-outline", label: t("modals.commandPalette.cmdOpenOutline"), sublabel: t("modals.commandPalette.cmdOpenOutlineSub"), run: () => { onClose(); props.onOpenOutline!(); } }] : []),
      ...(props.onToggleLivePreview ? [{
        kind: "command" as const,
        key: "toggle-live-preview",
        label: props.livePreviewOn ? t("modals.commandPalette.cmdLivePreviewOff") : t("modals.commandPalette.cmdLivePreviewOn"),
        sublabel: t("modals.commandPalette.cmdLivePreviewSub"),
        run: () => { onClose(); props.onToggleLivePreview!(); },
      }] : []),
      ...(props.onPrintCurrentPath ? [{ kind: "command" as const, key: "print-current-path", label: t("modals.commandPalette.cmdPrintPath"), sublabel: t("modals.commandPalette.cmdPrintPathSub"), run: () => { onClose(); props.onPrintCurrentPath!(); } }] : []),
      ...(props.onOpenOpenQuestions ? [{ kind: "command" as const, key: "open-questions", label: t("modals.commandPalette.cmdOpenQuestions"), sublabel: props.hasOpenQuestions ? t("modals.commandPalette.cmdOpenQuestionsSub") : t("modals.commandPalette.cmdOpenQuestionsSubEmpty"), run: () => { onClose(); props.onOpenOpenQuestions!(); } }] : []),
      ...(props.onToggleCodeHighlight ? [{ kind: "command" as const, key: "code-highlight", label: props.codeHighlightOn ? t("modals.commandPalette.cmdCodeHighlightOff") : t("modals.commandPalette.cmdCodeHighlightOn"), sublabel: t("modals.commandPalette.cmdCodeHighlightSub"), run: () => { onClose(); props.onToggleCodeHighlight!(); } }] : []),
      // 3.2+ saved-view commands. One per configured tag — palette is
      // the universal fallback regardless of whether the tag is pinned
      // to the rail or status bar.
      ...((props.pinnedTags && props.onOpenSavedView)
        ? props.pinnedTags.map((tag) => ({
            kind: "command" as const,
            key: `view-${tag.name}`,
            label: `View ${defaultLabel(tag)}`,
            sublabel: `Show notes tagged #${tag.name}`,
            run: () => { onClose(); props.onOpenSavedView!(tag.name); },
          }))
        : []),
    ];

    const enc = props.encryption;
    if (enc) {
      if (!enc.enabled) {
        commands.push({ kind: "command", key: "enc-setup", label: t("modals.commandPalette.cmdEncSetup"), sublabel: t("modals.commandPalette.cmdEncSetupSub"), run: () => { onClose(); props.onOpenSecurity?.(); } });
      } else if (!enc.unlocked) {
        commands.push({ kind: "command", key: "enc-unlock", label: t("modals.commandPalette.cmdEncUnlock"), sublabel: t("modals.commandPalette.cmdEncUnlockSub"), run: () => { onClose(); props.onUnlockEncryption?.(); } });
      } else {
        commands.push({ kind: "command", key: "enc-lock", label: t("modals.commandPalette.cmdEncLock"), sublabel: t("modals.commandPalette.cmdEncLockSub"), hint: "⌃L", run: () => { onClose(); props.onLockEncryption?.(); } });
        if (props.activeIsEncrypted) {
          commands.push({ kind: "command", key: "enc-decrypt-this", label: t("modals.commandPalette.cmdEncDecryptThis"), sublabel: t("modals.commandPalette.cmdEncDecryptThisSub"), run: () => { onClose(); props.onDecryptActiveNote?.(); } });
        } else {
          commands.push({ kind: "command", key: "enc-encrypt-this", label: t("modals.commandPalette.cmdEncEncryptThis"), sublabel: t("modals.commandPalette.cmdEncEncryptThisSub"), run: () => { onClose(); props.onEncryptActiveNote?.(); } });
        }
      }
    }

    const cmdsWithSection: Action[] = commands.map((c) => ({ ...c, section: "actions" as const }));

    const templateActions: Action[] = (props.templates ?? [])
      .slice(0, 20)
      .map((tpl) => ({
        kind: "template" as const,
        key: `tpl-${tpl.name}`,
        label: t("modals.commandPalette.tplLabel", { label: tpl.label }),
        sublabel: t("modals.commandPalette.tplSub"),
        section: "actions",
        run: () => { onClose(); props.onNewFromTemplate?.(tpl.name); },
      }));

    const noteActions: Action[] = props.notes.slice(0, 60).map((n) => ({
      kind: "note" as const,
      key: `jump-${n.slug}`,
      label: n.title || n.slug,
      sublabel: t("modals.commandPalette.noteSub"),
      section: "notes",
      run: () => { onClose(); props.onSelectNote(n.slug); },
    }));

    const searchActions: Action[] = hits.map((h) => ({
      kind: "search" as const,
      key: `hit-${h.slug}`,
      label: h.title,
      snippet: h.snippet,
      sublabel: t("modals.commandPalette.searchSub"),
      section: "notes",
      run: () => { onClose(); props.onSelectNote(h.slug); },
    }));

    const tagActions: Action[] = (props.tags ?? [])
      .slice(0, 30)
      .map((tg) => ({
        kind: "tag" as const,
        key: `tag-${tg.tag}`,
        label: `#${tg.tag}`,
        sublabel: tg.count === 1
          ? t("modals.commandPalette.tagFilter", { count: String(tg.count) })
          : t("modals.commandPalette.tagFilterPlural", { count: String(tg.count) }),
        section: "tags",
        run: () => { onClose(); props.onFilterTag?.(tg.tag); },
      }));

    const pathActions: Action[] = props.mappingEnabled === false
      ? []
      : props.paths
          .filter((p) => !p.is_current)
          .slice(0, 8)
          .map((p) => ({
            kind: "path" as const,
            key: `path-${p.name}`,
            label: t("modals.commandPalette.pathLabel", { name: p.name }),
            sublabel: t("modals.commandPalette.pathSub"),
            section: "paths",
            run: () => { onClose(); props.onSwitchPath(p.name); },
          }));

    const all = [
      ...cmdsWithSection,
      ...templateActions,
      ...noteActions,
      ...searchActions,
      ...tagActions,
      ...pathActions,
    ];
    return scopeFilter ? all.filter((a) => a.section === scopeFilter) : all;
  });

  function sectionRank(s: Section): number {
    return SECTION_ORDER.indexOf(s);
  }

  let actions = $state<Action[]>([]);

  $effect(() => {
    if (scopeFilter === "tags") {
      actions = allActions;
      return;
    }
    const mru = readMru();
    const liftRecents = (rows: Action[]): Action[] => {
      if (residualQuery || mru.length === 0) return rows;
      const byKey = new Map(rows.map((a) => [a.key, a] as const));
      const recents: Action[] = [];
      for (const k of mru) {
        const a = byKey.get(k);
        if (!a) continue;
        byKey.delete(k);
        recents.push({ ...a, section: "recents" });
        if (recents.length >= 5) break;
      }
      return [...recents, ...byKey.values()];
    };

    if (!residualQuery) {
      const caps: Record<Section, number> = {
        recents: 5, actions: 999, notes: 6, tags: 0, paths: 0,
      };
      const lifted = liftRecents(allActions);
      const counters: Record<Section, number> = {
        recents: 0, actions: 0, notes: 0, tags: 0, paths: 0,
      };
      const decorated = lifted.map((a, i) => ({ a, idx: i }));
      decorated.sort((x, y) => {
        const dr = sectionRank(x.a.section) - sectionRank(y.a.section);
        if (dr !== 0) return dr;
        return x.idx - y.idx;
      });
      const capped: Action[] = [];
      for (const { a } of decorated) {
        const used = counters[a.section];
        if (used >= caps[a.section]) continue;
        counters[a.section] = used + 1;
        capped.push(a);
      }
      actions = capped;
      return;
    }

    let cancelled = false;
    const labels = allActions.map(
      (a) => a.label + (a.sublabel ? " " + a.sublabel : ""),
    );
    api.fuzzyRank(residualQuery, labels, 80).then((fuzzyHits) => {
      if (cancelled) return;
      const decorated = fuzzyHits.map((h) => ({
        action: allActions[h.index],
        score: h.score,
      }));
      decorated.sort((a, b) => {
        const dr = sectionRank(a.action.section) - sectionRank(b.action.section);
        if (dr !== 0) return dr;
        return b.score - a.score;
      });
      actions = decorated.map((d) => d.action);
    }).catch(() => {
      actions = allActions;
    });
    return () => { cancelled = true; };
  });

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        cursor = Math.min(actions.length - 1, cursor + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        cursor = Math.max(0, cursor - 1);
      } else if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        const a = actions[cursor];
        if (a) {
          writeMru(a.key);
          a.run();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  $effect(() => {
    void cursor;
    if (!listRef) return;
    tick().then(() => {
      const active = listRef!.querySelector<HTMLDivElement>(`[data-idx="${cursor}"]`);
      active?.scrollIntoView({ block: "nearest" });
    });
  });

  function sectionLabel(s: Section): string {
    switch (s) {
      case "recents": return t("modals.commandPalette.groupRecents");
      case "actions": return t("modals.commandPalette.groupActions");
      case "notes":   return t("modals.commandPalette.groupNotes");
      case "tags":    return t("modals.commandPalette.groupTags");
      case "paths":   return t("modals.commandPalette.groupPaths");
    }
  }

  function closestTitle(query: string): string | null {
    const qq = (query || "").trim().toLowerCase();
    if (!qq || qq.length < 2) return null;
    let best: { title: string; score: number } | null = null;
    for (const n of props.notes) {
      const raw = n.title || n.slug;
      const tt = raw.toLowerCase();
      if (tt === qq) return raw;
      let score = 0;
      if (tt.startsWith(qq)) score += 5;
      if (tt.includes(qq)) score += 3;
      let qi = 0;
      for (let i = 0; i < tt.length && qi < qq.length; i++) {
        if (tt[i] === qq[qi]) { score++; qi++; }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { title: raw, score };
      }
    }
    return best && best.score >= Math.min(qq.length + 1, 4) ? best.title : null;
  }

  let emptyHint = $derived.by(() => {
    if (!q.trim()) return undefined;
    const shown = (residualQuery || q.trim()).trim();
    const guess = closestTitle(residualQuery);
    const baseHint = t("modals.commandPalette.nothingMatched", { query: shown });
    return guess
      ? baseHint + "  " + t("modals.commandPalette.didYouMean", { suggestion: guess })
      : baseHint;
  });

  // Backdrop dismissal — close only when both `mousedown` and the
  // matching `click` landed on the backdrop itself, so a drag that
  // started inside the palette (text selection in the input, etc.)
  // and bled out onto the backdrop doesn't dismiss.
  let mouseDownOnBackdrop = false;
  function onBackdropMouseDown(e: MouseEvent) {
    mouseDownOnBackdrop = e.target === e.currentTarget;
  }
  function onBackdropClick(e: MouseEvent) {
    if (mouseDownOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
    mouseDownOnBackdrop = false;
  }
</script>

{#snippet kbd(label: string)}
  <kbd class="font-mono text-[11px] text-t3 bg-s2 border border-bd rounded-sm px-1.5 py-px" style:font-feature-settings='"cv02"'>
    {label}
  </kbd>
{/snippet}

{#snippet kbdIcon()}
  <kbd class="font-mono text-[11px] text-t3 bg-s2 border border-bd rounded-sm px-1.5 py-px" style:font-feature-settings='"cv02"'>
    <EnterKeyIcon />
  </kbd>
{/snippet}

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={backdropRef}
    class="fixed inset-0 z-50 flex items-start justify-center bg-char/20 pt-24"
    onmousedown={onBackdropMouseDown}
    onclick={onBackdropClick}
    role="presentation"
  >
    <div
      bind:this={paletteRef}
      class="w-[540px] max-w-[92vw] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t("modals.commandPalette.placeholder")}
      tabindex="-1"
    >
      <div class="flex items-center px-4 py-3 border-b border-bd">
        <span class="text-t3 mr-2"><SearchIcon size={16} /></span>
        <input
          bind:this={inputRef}
          bind:value={q}
          oninput={() => (cursor = 0)}
          placeholder={t("modals.commandPalette.placeholder")}
          class="flex-1 bg-transparent outline-hidden text-char placeholder:text-t3 text-base"
        />
        {@render kbd("esc")}
      </div>

      <div bind:this={listRef} class="max-h-[400px] overflow-y-auto py-1">
        {#if actions.length === 0}
          <EmptyState
            kind="search"
            hint={emptyHint}
            size="tight"
            action={q.trim()
              ? {
                  label: t("modals.commandPalette.createNoteWithTitle", { query: residualQuery || q.trim() }),
                  onClick: () => {
                    const title = (residualQuery || q.trim()).trim();
                    onClose();
                    props.onNewNote(title);
                  },
                }
              : undefined}
          />
        {/if}
        {#each actions as a, i (a.key)}
          {@const prev = i > 0 ? actions[i - 1] : null}
          {@const showHeader = !prev || prev.section !== a.section}
          {@const sectionCount = showHeader
            ? actions.reduce((n, x) => (x.section === a.section ? n + 1 : n), 0)
            : 0}
          <div>
            {#if showHeader}
              <div class="px-4 pt-3 pb-1 flex items-baseline justify-between">
                <span class="text-[10px] uppercase tracking-[0.16em] text-t3 font-sans font-semibold">{sectionLabel(a.section)}</span>
                <span class="text-[10px] font-mono text-t3">{sectionCount}</span>
              </div>
            {/if}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              data-idx={i}
              onmouseenter={() => (cursor = i)}
              onclick={() => { writeMru(a.key); a.run(); }}
              class="px-4 py-2 cursor-pointer transition-colors {i === cursor ? 'bg-yelp' : ''}"
            >
              <div class="flex items-center gap-2.5">
                {#if a.kind !== "command" && a.kind !== "template"}
                  <span class="shrink-0 {i === cursor ? 'text-yeld' : 'text-t3'}">
                    {#if a.kind === "note"}<NoteIcon size={13} />{:else if a.kind === "path"}<NewDirectionIcon size={13} />{:else if a.kind === "search"}<SearchIcon size={13} />{:else if a.kind === "tag"}<span class="text-[13px] font-mono leading-none">#</span>{/if}
                  </span>
                {:else}
                  <span class="shrink-0 w-[13px]" aria-hidden="true"></span>
                {/if}
                <span class="text-sm text-char flex-1 truncate">{a.label}</span>
                {#if a.hint}
                  {@render kbd(a.hint)}
                {/if}
              </div>
              {#if a.sublabel}
                <div class="pl-[30px] pr-2 text-2xs text-t3 leading-snug line-clamp-2 mt-0.5">{a.sublabel}</div>
              {/if}
              {#if a.snippet}
                <div class="pl-[30px] text-xs text-t2 line-clamp-2 italic mt-0.5">{a.snippet}</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <div class="px-4 py-2 border-t border-bd bg-s1 text-2xs text-t3 flex items-center gap-3 flex-wrap">
        <span class="inline-flex items-center gap-1.5">
          {@render kbd("↑↓")} {t("modals.commandPalette.move")}
        </span>
        <span class="inline-flex items-center gap-1.5">
          {@render kbdIcon()} {t("modals.commandPalette.run")}
        </span>
        <span class="hidden sm:inline-flex items-center gap-1.5 text-t3/80">
          <span class="font-mono">{t("modals.commandPalette.scopeTags")}</span>
          <span class="font-mono">{t("modals.commandPalette.scopeActions")}</span>
          <span class="font-mono">{t("modals.commandPalette.scopeNotes")}</span>
        </span>
        <span class="ml-auto inline-flex items-center gap-1.5">
          {@render kbd(SK.palette)} {t("modals.commandPalette.close")}
        </span>
      </div>
    </div>
  </div>
{/if}
