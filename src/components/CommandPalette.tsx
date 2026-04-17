import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/tauri";
import type { NoteSummary, PathInfo, SearchHit } from "../lib/types";
import {
  SearchIcon,
  CommandIcon,
  NoteIcon,
  NewDirectionIcon,
  Kbd,
  EnterKeyIcon,
} from "../lib/icons";
import { SK } from "../lib/platform";

interface Action {
  kind: "command" | "note" | "path" | "search";
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
}

export default function CommandPalette(props: Props) {
  const { open, onClose } = props;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  const actions: Action[] = useMemo(() => {
    const trimmed = q.trim().toLowerCase();

    const commands: Action[] = [
      {
        kind: "command",
        key: "new-note",
        label: "New note",
        hint: SK.newNote,
        run: () => { onClose(); props.onNewNote(); },
      },
      {
        kind: "command",
        key: "jump-today",
        label: "Jump to today's journal",
        sublabel: "daily notes always live on main — jumps there if needed",
        hint: SK.jumpToday,
        run: () => { onClose(); props.onJumpToday(); },
      },
      {
        kind: "command",
        key: "new-direction",
        label: "Explore a new direction",
        sublabel: "branch this note's path so you can try something without losing what you have",
        hint: SK.newDirection,
        run: () => { onClose(); props.onNewDirection(); },
      },
      {
        kind: "command",
        key: "connect",
        label: "Connect this note to another",
        sublabel: "supports · challenges · came from · open question",
        run: () => { onClose(); props.onConnect(); },
      },
      {
        kind: "command",
        key: "history",
        label: "Open history for this note",
        run: () => { onClose(); props.onOpenHistory(); },
      },
      {
        kind: "command",
        key: "focus",
        label: "Toggle focus mode",
        hint: SK.focusToggle,
        run: () => { onClose(); props.onToggleFocus(); },
      },
      {
        kind: "command",
        key: "scratch",
        label: "Open scratchpad",
        sublabel: "a place to jot without saving",
        run: () => { onClose(); props.onOpenScratchpad(); },
      },
      {
        kind: "command",
        key: "sync",
        label: "Sync workspace",
        run: () => { onClose(); props.onSync(); },
      },
    ];
    const filterCommands = trimmed
      ? commands.filter((c) =>
          (c.label + " " + (c.sublabel ?? "")).toLowerCase().includes(trimmed),
        )
      : commands;

    const noteActions: Action[] = props.notes
      .filter((n) => !trimmed || n.title.toLowerCase().includes(trimmed))
      .slice(0, 6)
      .map((n) => ({
        kind: "note" as const,
        key: `jump-${n.slug}`,
        label: n.title || n.slug,
        sublabel: "jump to note",
        run: () => { onClose(); props.onSelectNote(n.slug); },
      }));

    const pathActions: Action[] = props.paths
      .filter((p) => !p.is_current)
      .filter((p) => !trimmed || p.name.toLowerCase().includes(trimmed))
      .slice(0, 4)
      .map((p) => ({
        kind: "path" as const,
        key: `path-${p.name}`,
        label: `Switch to path: ${p.name}`,
        sublabel: "follow this direction",
        run: () => { onClose(); props.onSwitchPath(p.name); },
      }));

    const searchActions: Action[] = hits.map((h) => ({
      kind: "search" as const,
      key: `hit-${h.slug}`,
      label: h.title,
      snippet: h.snippet,
      sublabel: "search result",
      run: () => { onClose(); props.onSelectNote(h.slug); },
    }));

    // Ordering: commands (if query is short or matches), then notes, then search, then paths
    if (!trimmed) {
      return [...filterCommands, ...noteActions];
    }
    return [...filterCommands, ...noteActions, ...searchActions, ...pathActions];
  }, [q, hits, props, onClose]);

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
      className="fixed inset-0 z-50 flex items-start justify-center bg-char/20 backdrop-blur-[2px] pt-24 animate-fadeIn"
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
            placeholder="Search notes, jump to a path, or do something…"
            className="flex-1 bg-transparent outline-none text-char placeholder:text-t3 text-base"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
          {actions.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-t3">
              Nothing matched "{q}".
            </div>
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
            <Kbd>↑↓</Kbd> move
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd><EnterKeyIcon /></Kbd> run
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Kbd>{SK.palette}</Kbd> to toggle
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
  }
}
