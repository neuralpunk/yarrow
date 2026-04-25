import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/tauri";
import type { EncryptionStatus, NoteSummary, PathInfo, SearchHit, TagCount } from "../lib/types";
import {
  SearchIcon,
  CommandIcon,
  NoteIcon,
  NewDirectionIcon,
  Kbd,
  EnterKeyIcon,
} from "../lib/icons";
import { SK } from "../lib/platform";
import EmptyState from "./EmptyState";
import { useT } from "../lib/i18n";

interface Action {
  kind: "command" | "note" | "path" | "search" | "tag" | "template";
  key: string;
  label: string;
  sublabel?: string;
  snippet?: string;
  hint?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  notes: NoteSummary[];
  paths: PathInfo[];
  currentPath: string;
  onSelectNote: (slug: string) => void;
  onSwitchPath: (name: string) => void;
  onNewNote: () => void;
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
  /** 2.1 Journal Kits. When provided, surfaces a "Start a journal kit…"
   *  command that opens the kits-only picker. */
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
  onImportObsidian?: () => void;
  onComparePaths?: () => void;
  onOpenDecisionMatrix?: () => void;
  /** When false, path + connect commands are filtered out of the palette. */
  mappingEnabled?: boolean;
}

export default function CommandPalette(props: Props) {
  const { open, onClose } = props;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    // Debounce the full-text search. Each keystroke would otherwise fire a
    // backend scan of every note — expensive on large vaults and wasteful
    // for keystrokes that are immediately superseded.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      api.search(term, 12).then((r) => {
        if (!cancelled) setHits(r);
      }).catch(() => {});
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, open]);

  // 2.1: each action carries a hidden `groupOrder` so the fuzzy re-ranker
  // can sort across groups while still keeping the original top→bottom
  // grouping (commands → templates → notes → search → paths).
  type RankedAction = Action & { groupOrder: number };

  const allActions: RankedAction[] = useMemo(() => {
    const rawTrimmed = q.trim();
    const isTagMode = rawTrimmed.startsWith("#");
    const tagQuery = isTagMode ? rawTrimmed.slice(1).toLowerCase() : "";

    if (isTagMode && props.tags) {
      // Tag mode has its own explicit query prefix and keeps the small
      // substring filter — fuzzy ranking tags by hash would feel weird.
      return props.tags
        .filter((tg) => !tagQuery || tg.tag.toLowerCase().includes(tagQuery))
        .slice(0, 20)
        .map<RankedAction>((tg) => ({
          kind: "tag",
          key: `tag-${tg.tag}`,
          label: `#${tg.tag}`,
          sublabel: tg.count === 1
            ? t("modals.commandPalette.tagFilter", { count: String(tg.count) })
            : t("modals.commandPalette.tagFilterPlural", { count: String(tg.count) }),
          groupOrder: 0,
          run: () => { onClose(); props.onFilterTag?.(tg.tag); },
        }));
    }

    const commands: Action[] = [
      {
        kind: "command",
        key: "new-note",
        label: t("modals.commandPalette.cmdNewNote"),
        hint: SK.newNote,
        run: () => { onClose(); props.onNewNote(); },
      },
      ...(props.onOpenTemplatePicker
        ? [{
            kind: "command" as const,
            key: "new-from-template",
            label: t("modals.commandPalette.cmdNewFromTemplate"),
            sublabel: t("modals.commandPalette.cmdNewFromTemplateSub"),
            run: () => { onClose(); props.onOpenTemplatePicker!(); },
          }]
        : []),
      ...(props.onOpenJournalKits
        ? [{
            kind: "command" as const,
            key: "journal-kit",
            label: t("modals.commandPalette.cmdJournalKit"),
            sublabel: t("modals.commandPalette.cmdJournalKitSub"),
            run: () => { onClose(); props.onOpenJournalKits!(); },
          }]
        : []),
      {
        kind: "command",
        key: "jump-today",
        label: t("modals.commandPalette.cmdJumpToday"),
        sublabel: t("modals.commandPalette.cmdJumpTodaySub"),
        hint: SK.jumpToday,
        run: () => { onClose(); props.onJumpToday(); },
      },
      ...(props.mappingEnabled !== false
        ? [
            {
              kind: "command" as const,
              key: "new-direction",
              label: t("modals.commandPalette.cmdNewDirection"),
              sublabel: t("modals.commandPalette.cmdNewDirectionSub"),
              hint: SK.newDirection,
              run: () => { onClose(); props.onNewDirection(); },
            },
            {
              kind: "command" as const,
              key: "connect",
              label: t("modals.commandPalette.cmdConnect"),
              sublabel: t("modals.commandPalette.cmdConnectSub"),
              run: () => { onClose(); props.onConnect(); },
            },
          ]
        : []),
      {
        kind: "command",
        key: "history",
        label: t("modals.commandPalette.cmdHistory"),
        run: () => { onClose(); props.onOpenHistory(); },
      },
      {
        kind: "command",
        key: "focus",
        label: t("modals.commandPalette.cmdFocus"),
        hint: SK.focusToggle,
        run: () => { onClose(); props.onToggleFocus(); },
      },
      {
        kind: "command",
        key: "scratch",
        label: t("modals.commandPalette.cmdScratchpad"),
        sublabel: t("modals.commandPalette.cmdScratchpadSub"),
        run: () => { onClose(); props.onOpenScratchpad(); },
      },
      {
        kind: "command",
        key: "sync",
        label: t("modals.commandPalette.cmdSync"),
        run: () => { onClose(); props.onSync(); },
      },
      ...(props.onSwitchWorkspace
        ? [{
            kind: "command" as const,
            key: "switch-workspace",
            label: t("modals.commandPalette.cmdSwitchWorkspace"),
            sublabel: t("modals.commandPalette.cmdSwitchWorkspaceSub"),
            hint: SK.switchWorkspace,
            run: () => { onClose(); props.onSwitchWorkspace!(); },
          }]
        : []),
      ...(props.onOpenNewWindow
        ? [{
            kind: "command" as const,
            key: "new-window",
            label: t("modals.commandPalette.cmdNewWindow"),
            sublabel: t("modals.commandPalette.cmdNewWindowSub"),
            run: () => { onClose(); props.onOpenNewWindow!(); },
          }]
        : []),
      ...(props.onFindReplace
        ? [{
            kind: "command" as const,
            key: "find-replace",
            label: t("modals.commandPalette.cmdFindReplace"),
            sublabel: t("modals.commandPalette.cmdFindReplaceSub"),
            run: () => { onClose(); props.onFindReplace!(); },
          }]
        : []),
      ...(props.onPrintActiveNote
        ? [{
            kind: "command" as const,
            key: "print",
            label: t("modals.commandPalette.cmdPrint"),
            sublabel: t("modals.commandPalette.cmdPrintSub"),
            run: () => { onClose(); props.onPrintActiveNote!(); },
          }]
        : []),
      ...(props.onOpenTrash
        ? [{
            kind: "command" as const,
            key: "trash",
            label: t("modals.commandPalette.cmdTrash"),
            sublabel: t("modals.commandPalette.cmdTrashSub"),
            run: () => { onClose(); props.onOpenTrash!(); },
          }]
        : []),
      ...(props.onImportObsidian
        ? [{
            kind: "command" as const,
            key: "import-foreign",
            label: t("modals.commandPalette.cmdImport"),
            sublabel: t("modals.commandPalette.cmdImportSub"),
            run: () => { onClose(); props.onImportObsidian!(); },
          }]
        : []),
      ...(props.onComparePaths
        ? [{
            kind: "command" as const,
            key: "compare-paths",
            label: t("modals.commandPalette.cmdComparePaths"),
            sublabel: t("modals.commandPalette.cmdComparePathsSub"),
            run: () => { onClose(); props.onComparePaths!(); },
          }]
        : []),
      ...(props.onOpenDecisionMatrix
        ? [{
            kind: "command" as const,
            key: "decision-matrix",
            label: t("modals.commandPalette.cmdDecisionMatrix"),
            sublabel: t("modals.commandPalette.cmdDecisionMatrixSub"),
            run: () => { onClose(); props.onOpenDecisionMatrix!(); },
          }]
        : []),
      ...(props.onOpenActivity
        ? [{
            kind: "command" as const,
            key: "activity-heatmap",
            label: t("modals.commandPalette.cmdActivity"),
            sublabel: t("modals.commandPalette.cmdActivitySub"),
            run: () => { onClose(); props.onOpenActivity!(); },
          }]
        : []),
      ...(props.onOpenTagGraph
        ? [{
            kind: "command" as const,
            key: "tag-graph",
            label: t("modals.commandPalette.cmdTagGraph"),
            sublabel: t("modals.commandPalette.cmdTagGraphSub"),
            run: () => { onClose(); props.onOpenTagGraph!(); },
          }]
        : []),
      ...(props.onInsertTable
        ? [{
            kind: "command" as const,
            key: "insert-table",
            label: t("modals.commandPalette.cmdInsertTable"),
            sublabel: t("modals.commandPalette.cmdInsertTableSub"),
            run: () => { onClose(); props.onInsertTable!(); },
          }]
        : []),
    ];

    // ── encryption commands (only surfaced when relevant) ──
    const enc = props.encryption;
    if (enc) {
      if (!enc.enabled) {
        commands.push({
          kind: "command",
          key: "enc-setup",
          label: t("modals.commandPalette.cmdEncSetup"),
          sublabel: t("modals.commandPalette.cmdEncSetupSub"),
          run: () => { onClose(); props.onOpenSecurity?.(); },
        });
      } else if (!enc.unlocked) {
        commands.push({
          kind: "command",
          key: "enc-unlock",
          label: t("modals.commandPalette.cmdEncUnlock"),
          sublabel: t("modals.commandPalette.cmdEncUnlockSub"),
          run: () => { onClose(); props.onUnlockEncryption?.(); },
        });
      } else {
        commands.push({
          kind: "command",
          key: "enc-lock",
          label: t("modals.commandPalette.cmdEncLock"),
          sublabel: t("modals.commandPalette.cmdEncLockSub"),
          hint: "⌃L",
          run: () => { onClose(); props.onLockEncryption?.(); },
        });
        if (props.activeIsEncrypted) {
          commands.push({
            kind: "command",
            key: "enc-decrypt-this",
            label: t("modals.commandPalette.cmdEncDecryptThis"),
            sublabel: t("modals.commandPalette.cmdEncDecryptThisSub"),
            run: () => { onClose(); props.onDecryptActiveNote?.(); },
          });
        } else {
          commands.push({
            kind: "command",
            key: "enc-encrypt-this",
            label: t("modals.commandPalette.cmdEncEncryptThis"),
            sublabel: t("modals.commandPalette.cmdEncEncryptThisSub"),
            run: () => { onClose(); props.onEncryptActiveNote?.(); },
          });
        }
      }
    }
    // 2.1 Fuzzy: we no longer substring-filter per group here. Every
    // candidate gets attached with its group order; the downstream
    // effect runs a single nucleo IPC to decide which survive and in
    // what order. When the query is empty, the group ordering below
    // still holds because fuzzy's empty-query branch preserves input
    // order at equal score.
    const cmdsWithGroup: RankedAction[] = commands.map((c) => ({ ...c, groupOrder: 0 }));

    const templateActions: RankedAction[] = (props.templates ?? [])
      .slice(0, 20)
      .map((tpl) => ({
        kind: "template" as const,
        key: `tpl-${tpl.name}`,
        label: t("modals.commandPalette.tplLabel", { label: tpl.label }),
        sublabel: t("modals.commandPalette.tplSub"),
        groupOrder: 1,
        run: () => { onClose(); props.onNewFromTemplate?.(tpl.name); },
      }));

    const noteActions: RankedAction[] = props.notes.slice(0, 60).map((n) => ({
      kind: "note" as const,
      key: `jump-${n.slug}`,
      label: n.title || n.slug,
      sublabel: t("modals.commandPalette.noteSub"),
      groupOrder: 2,
      run: () => { onClose(); props.onSelectNote(n.slug); },
    }));

    const searchActions: RankedAction[] = hits.map((h) => ({
      kind: "search" as const,
      key: `hit-${h.slug}`,
      label: h.title,
      snippet: h.snippet,
      sublabel: t("modals.commandPalette.searchSub"),
      groupOrder: 3,
      run: () => { onClose(); props.onSelectNote(h.slug); },
    }));

    const pathActions: RankedAction[] = props.mappingEnabled === false
      ? []
      : props.paths
          .filter((p) => !p.is_current)
          .slice(0, 8)
          .map((p) => ({
            kind: "path" as const,
            key: `path-${p.name}`,
            label: t("modals.commandPalette.pathLabel", { name: p.name }),
            sublabel: t("modals.commandPalette.pathSub"),
            groupOrder: 4,
            run: () => { onClose(); props.onSwitchPath(p.name); },
          }));

    return [
      ...cmdsWithGroup,
      ...templateActions,
      ...noteActions,
      ...searchActions,
      ...pathActions,
    ];
  }, [q, hits, props, onClose, t]);

  // 2.1 Nucleo-backed ranker over the whole candidate list. One IPC per
  // query change; typically 100–600 labels, resolved in well under 10
  // ms on a real vault. When the query is empty we skip the IPC and
  // just show the first N candidates per group in their natural order.
  const [actions, setActions] = useState<Action[]>([]);
  useEffect(() => {
    const trimmed = q.trim();
    // Tag-mode is already pre-filtered by the memo above; pass it
    // through verbatim.
    if (trimmed.startsWith("#")) {
      setActions(allActions);
      return;
    }
    if (!trimmed) {
      // Empty query: preserve the original ordering, cap per group so
      // the first paint doesn't blow up with hundreds of note rows.
      const caps: Record<number, number> = { 0: 999, 1: 6, 2: 6, 3: 0, 4: 0 };
      const counters: Record<number, number> = {};
      const capped: Action[] = [];
      for (const a of allActions) {
        const used = counters[a.groupOrder] ?? 0;
        if (used >= (caps[a.groupOrder] ?? 6)) continue;
        counters[a.groupOrder] = used + 1;
        capped.push(a);
      }
      setActions(capped);
      return;
    }
    // Non-empty query: rank by fuzzy score, re-partition by group order.
    let cancelled = false;
    const labels = allActions.map(
      (a) => a.label + (a.sublabel ? " " + a.sublabel : ""),
    );
    api.fuzzyRank(trimmed, labels, 80).then((hits) => {
      if (cancelled) return;
      // Sort: group order asc (keeps the visual rhythm), then score
      // desc within group.
      const decorated = hits.map((h) => ({
        action: allActions[h.index],
        score: h.score,
      }));
      decorated.sort((a, b) => {
        if (a.action.groupOrder !== b.action.groupOrder) {
          return a.action.groupOrder - b.action.groupOrder;
        }
        return b.score - a.score;
      });
      setActions(decorated.map((d) => d.action));
    }).catch(() => {
      // Fuzzy failed (shouldn't happen) — fall back to an unfiltered
      // dump so the palette stays usable rather than empty.
      setActions(allActions);
    });
    return () => { cancelled = true; };
  }, [q, allActions]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(actions.length - 1, c + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        actions[cursor]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, actions, cursor, onClose]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLDivElement>(
      `[data-idx="${cursor}"]`,
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-char/20 pt-24 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-[540px] max-w-[92vw] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-bd">
          <span className="text-t3 mr-2"><SearchIcon size={16} /></span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            placeholder={t("modals.commandPalette.placeholder")}
            className="flex-1 bg-transparent outline-none text-char placeholder:text-t3 text-base"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
          {actions.length === 0 && (
            <EmptyState
              kind="search"
              hint={q.trim() ? t("modals.commandPalette.nothingMatched", { query: q.trim() }) : undefined}
              size="tight"
            />
          )}
          {actions.map((a, i) => (
            <div
              key={a.key}
              data-idx={i}
              onMouseEnter={() => setCursor(i)}
              onClick={() => a.run()}
              className={`px-4 py-2 cursor-pointer transition-colors ${
                i === cursor ? "bg-yelp" : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`shrink-0 ${i === cursor ? "text-yeld" : "text-t3"}`}>
                  {iconFor(a.kind)}
                </span>
                <span className="text-sm text-char flex-1 truncate">{a.label}</span>
                {a.hint && <Kbd>{a.hint}</Kbd>}
              </div>
              {a.sublabel && (
                <div className="pl-[30px] text-2xs text-t3 truncate mt-0.5">{a.sublabel}</div>
              )}
              {a.snippet && (
                <div className="pl-[30px] text-xs text-t2 line-clamp-2 italic mt-0.5">
                  {a.snippet}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-bd bg-s1 text-2xs text-t3 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑↓</Kbd> {t("modals.commandPalette.move")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd><EnterKeyIcon /></Kbd> {t("modals.commandPalette.run")}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Kbd>{SK.palette}</Kbd> {t("modals.commandPalette.toggle")}
          </span>
        </div>
      </div>
    </div>
  );
}

function iconFor(kind: Action["kind"]) {
  switch (kind) {
    case "command": return <CommandIcon size={13} />;
    case "note": return <NoteIcon size={13} />;
    case "path": return <NewDirectionIcon size={13} />;
    case "search": return <SearchIcon size={13} />;
    case "tag": return <span className="text-[13px] font-mono leading-none">#</span>;
    case "template": return <NoteIcon size={13} />;
  }
}
