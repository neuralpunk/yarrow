import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { NoteSummary } from "../../lib/types";
import { relativeTime } from "../../lib/format";
import { prefetchNote } from "../../lib/notePrefetch";
import {
  PlusIcon,
  UnlinkIcon,
  ChevronRightIcon,
  RenameIcon,
  DeleteIcon,
} from "../../lib/icons";
import { SK } from "../../lib/platform";
import Modal from "../Modal";

interface Props {
  notes: NoteSummary[];
  activeSlug: string | null;
  /** The workspace's designated starting note. Gets a gold ★ in the row
   *  and a gold left-border accent so "here's home" is scannable at a
   *  glance. Matches the gold treatment used in the Map view. */
  mainNoteSlug?: string | null;
  orphans: Set<string>;
  decayDays: number;
  neighbors: Record<string, Set<string>>;
  onSelect: (slug: string) => void;
  onCreate: () => void;
  onRename: (slug: string, newTitle: string) => void;
  onDelete: (slug: string) => void;
  onTogglePin: (slug: string, pinned: boolean) => void;
  onDeleteMany?: (slugs: string[]) => void;
  tagFilter?: string | null;
  onClearTagFilter?: () => void;
  encryptionEnabled?: boolean;
  encryptionUnlocked?: boolean;
  onEncryptNote?: (slug: string) => void;
  onDecryptNote?: (slug: string) => void;
  onReveal?: (slug: string) => void;
  onCopyAsMarkdown?: (slug: string) => void;
}

function NoteListInner({
  notes,
  activeSlug,
  mainNoteSlug,
  orphans,
  decayDays,
  neighbors,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onTogglePin,
  onDeleteMany,
  tagFilter,
  onClearTagFilter,
  encryptionEnabled,
  encryptionUnlocked,
  onEncryptNote,
  onDecryptNote,
  onReveal,
  onCopyAsMarkdown,
}: Props) {
  const [menu, setMenu] = useState<{ slug: string; x: number; y: number } | null>(null);
  const [showOrphans, setShowOrphans] = useState(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  // Hover intent timer: only warm the cache if the cursor sticks around for
  // ~120ms, to avoid a prefetch storm when the user flicks through the list.
  const hoverPrefetchTimer = useRef<number | null>(null);
  const [renameState, setRenameState] = useState<{ slug: string; title: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  const orphanCount = orphans.size;
  const now = Date.now();
  const decayCutoff = now - decayDays * 86400 * 1000;

  // Start-of-today for the "today" chip — compared against a note's
  // modified timestamp. Recomputed on each pass so notes cross into / out
  // of the "today" state if the app is left open past midnight.
  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  const enriched = useMemo(() => {
    return notes.map((n) => {
      const mTime = n.modified ? new Date(n.modified).getTime() : now;
      const stale = mTime < decayCutoff;
      const daysOld = Math.floor((now - mTime) / (86400 * 1000));
      const isOrphan = orphans.has(n.slug);
      const touchedToday = mTime >= startOfToday;
      return { ...n, stale, daysOld, isOrphan, touchedToday };
    });
  }, [notes, decayCutoff, orphans, now, startOfToday]);
  void tagFilter; // filtering is applied upstream in AppShell

  const relatedToHovered = hoveredSlug ? neighbors[hoveredSlug] : null;

  const pinned = enriched.filter((n) => n.pinned);
  const rest = enriched.filter((n) => !n.pinned);

  const renderRow = (n: typeof enriched[number]) => {
    const active = n.slug === activeSlug;
    const isMain = !!mainNoteSlug && n.slug === mainNoteSlug;
    const isSelected = selected.has(n.slug);
    const related =
      !active &&
      !!relatedToHovered &&
      hoveredSlug !== n.slug &&
      relatedToHovered.has(n.slug);
    return (
      <li
        key={n.slug}
        className="relative flex items-center gap-1"
        onMouseEnter={() => {
          setHoveredSlug(n.slug);
          if (hoverPrefetchTimer.current) window.clearTimeout(hoverPrefetchTimer.current);
          hoverPrefetchTimer.current = window.setTimeout(() => {
            if (n.slug !== activeSlug) prefetchNote(n.slug);
          }, 120);
        }}
        onMouseLeave={() => {
          setHoveredSlug(null);
          if (hoverPrefetchTimer.current) window.clearTimeout(hoverPrefetchTimer.current);
        }}
      >
        {selectMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {
              const next = new Set(selected);
              if (next.has(n.slug)) next.delete(n.slug);
              else next.add(n.slug);
              setSelected(next);
            }}
            className="ml-2 accent-yel shrink-0"
            aria-label={`Select ${n.title || n.slug}`}
          />
        )}
        <button
          onClick={() => {
            if (selectMode) {
              const next = new Set(selected);
              if (next.has(n.slug)) next.delete(n.slug);
              else next.add(n.slug);
              setSelected(next);
              return;
            }
            onSelect(n.slug);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ slug: n.slug, x: e.clientX, y: e.clientY });
          }}
          data-related={related ? "true" : "false"}
          title={
            n.stale
              ? `Hasn't been visited in ${n.daysOld} days`
              : n.isOrphan
                ? "This note isn't linked to anything yet"
                : undefined
          }
          className={`note-row flex-1 min-w-0 text-left px-3 py-2 rounded-md font-serif text-[15px] group transition-colors ${
            isSelected
              ? "bg-yelp/70 text-char"
              : active
                ? "bg-yelp text-char"
                : related
                  ? "bg-accent2-dim/40 text-ch2"
                  : n.stale
                    ? "text-t2 hover:bg-s2"
                    : "text-ch2 hover:bg-s2"
          }`}
          style={
            isMain
              ? { boxShadow: "inset 3px 0 0 0 #D4A04A" }
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            {isMain && (
              <span
                className="shrink-0 leading-none"
                style={{ color: "#D4A04A", fontSize: 13 }}
                title="Starting note — your workspace's main"
              >
                ★
              </span>
            )}
            {n.pinned && (
              <span className="text-yel shrink-0" title="Pinned">
                <PinIcon />
              </span>
            )}
            {n.encrypted && (
              <span className="text-yeld shrink-0" title="Encrypted">
                <SmallLockIcon />
              </span>
            )}
            <span className={`truncate flex-1 ${active || isMain ? "font-medium" : ""}`}>
              {n.title || n.slug}
            </span>
            {n.isOrphan && !active && (
              <span
                className="text-t3 opacity-0 group-hover:opacity-100 transition"
                title="not linked"
              >
                <UnlinkIcon />
              </span>
            )}
          </div>
          <div className="text-2xs text-t3 font-mono mt-0.5 flex items-center gap-1.5">
            <span>{relativeTime(n.modified)}</span>
            {n.touchedToday && (
              <span
                className="px-1 py-px rounded bg-yel/20 text-yeld text-[9px] uppercase tracking-wider font-sans font-semibold leading-none"
                title="Modified today"
              >
                today
              </span>
            )}
          </div>
        </button>
      </li>
    );
  };

  const menuNote = menu ? enriched.find((n) => n.slug === menu.slug) : null;

  return (
    <div className="pt-3">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="text-[14px] text-t2">
          Your Notes
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectMode((x) => !x)}
            className={`y-tip w-6 h-6 flex items-center justify-center rounded transition ${
              selectMode ? "bg-yelp text-yeld" : "text-t2 hover:text-char hover:bg-s2"
            }`}
            data-tip={selectMode ? "Exit select" : "Select multiple"}
            data-tip-align="right"
            aria-label="Toggle select mode"
          >
            <SelectIcon />
          </button>
          <button
            onClick={onCreate}
            className="y-tip w-6 h-6 flex items-center justify-center text-t2 hover:text-char hover:bg-s2 rounded transition"
            data-tip={`New note (${SK.newNote})`}
            data-tip-align="right"
            aria-label="New note"
          >
            <PlusIcon />
          </button>
        </div>
      </div>
      {tagFilter && (
        <div className="mx-3 mb-2 px-2.5 py-1 text-2xs flex items-center gap-1.5 bg-yelp/60 text-yeld rounded">
          <span>filtering <span className="font-mono">#{tagFilter}</span></span>
          <button
            onClick={onClearTagFilter}
            className="ml-auto hover:text-char"
            aria-label="Clear tag filter"
          >
            ×
          </button>
        </div>
      )}
      {selectMode && (
        <div className="mx-3 mb-2 px-2.5 py-1.5 text-2xs flex items-center gap-2 bg-s2 rounded">
          <span className="text-t2">
            {selected.size} selected
          </span>
          <button
            onClick={() => setSelected(new Set(enriched.map((n) => n.slug)))}
            className="text-yeld hover:text-char"
          >
            all
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-t2 hover:text-char"
          >
            none
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() => {
              if (selected.size === 0) return;
              onDeleteMany?.(Array.from(selected));
              setSelectMode(false);
            }}
            className="ml-auto text-danger hover:text-char disabled:opacity-40"
          >
            delete
          </button>
        </div>
      )}
      {pinned.length > 0 && (
        <>
          <div className="px-4 mb-1 flex items-center gap-1.5 text-2xs uppercase tracking-wider text-t3 font-semibold">
            <PinIcon /> <span>Pinned</span>
          </div>
          <ul className="px-2 space-y-0.5 mb-2">
            {pinned.map((n) => renderRow(n))}
          </ul>
          <div className="mx-3 mb-2 border-t border-bd" />
        </>
      )}
      <ul className="px-2 space-y-0.5">
        {rest.map((n) => renderRow(n))}
        {enriched.length === 0 && (
          <li className="text-xs text-t3 px-3 py-2 italic">
            No notes yet. Click + to start.
          </li>
        )}
      </ul>

      {orphanCount > 0 && (
        <div className="mx-3 mt-2">
          <button
            onClick={() => setShowOrphans((x) => !x)}
            className="w-full text-left px-2 py-1.5 text-2xs text-t3 hover:text-t2 flex items-center gap-1 transition"
            title="Notes with no links yet — a nudge, nothing more"
          >
            <span
              className="inline-flex items-center transition-transform"
              style={{ transform: showOrphans ? "rotate(90deg)" : "none" }}
            >
              <ChevronRightIcon />
            </span>
            <span>{orphanCount} unlinked note{orphanCount === 1 ? "" : "s"}</span>
          </button>
          {showOrphans && (
            <ul className="ml-2 mt-1 space-y-0.5">
              {enriched
                .filter((n) => n.isOrphan)
                .map((n) => (
                  <li key={n.slug}>
                    <button
                      onClick={() => onSelect(n.slug)}
                      className="w-full text-left px-2 py-1.5 text-xs text-t2 hover:bg-s2 rounded italic truncate flex items-center gap-1.5"
                    >
                      <UnlinkIcon />
                      <span className="truncate">{n.title || n.slug}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {menu && menuNote && (
        <div
          style={{ left: menu.x, top: menu.y }}
          className="fixed z-50 w-44 bg-bg border border-bd2 rounded-md shadow-xl text-xs py-1 animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
            onClick={() => {
              onTogglePin(menuNote.slug, !menuNote.pinned);
              setMenu(null);
            }}
          >
            <PinIcon /> {menuNote.pinned ? "Unpin" : "Pin to top"}
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
            onClick={() => {
              setRenameState({ slug: menuNote.slug, title: menuNote.title });
              setMenu(null);
            }}
          >
            <RenameIcon /> Rename
          </button>
          {onCopyAsMarkdown && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
              onClick={() => {
                onCopyAsMarkdown(menuNote.slug);
                setMenu(null);
              }}
            >
              <CopyMdIcon /> Copy as markdown
            </button>
          )}
          {onReveal && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
              onClick={() => {
                onReveal(menuNote.slug);
                setMenu(null);
              }}
            >
              <RevealIcon /> Reveal in file manager
            </button>
          )}
          {encryptionEnabled && (
            menuNote.encrypted ? (
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                disabled={!encryptionUnlocked}
                title={!encryptionUnlocked ? "Unlock the session first" : undefined}
                onClick={() => {
                  onDecryptNote?.(menuNote.slug);
                  setMenu(null);
                }}
              >
                <SmallLockIcon /> Decrypt note
              </button>
            ) : (
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                disabled={!encryptionUnlocked}
                title={!encryptionUnlocked ? "Unlock the session first" : undefined}
                onClick={() => {
                  onEncryptNote?.(menuNote.slug);
                  setMenu(null);
                }}
              >
                <SmallLockIcon /> Encrypt note
              </button>
            )
          )}
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-s2 text-danger flex items-center gap-2"
            onClick={() => {
              onDelete(menuNote.slug);
              setMenu(null);
            }}
          >
            <DeleteIcon /> Delete
          </button>
        </div>
      )}

      <Modal
        open={!!renameState}
        onClose={() => setRenameState(null)}
        title="Rename note"
      >
        <input
          autoFocus
          value={renameState?.title ?? ""}
          onChange={(e) =>
            setRenameState((s) => (s ? { ...s, title: e.target.value } : s))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const next = renameState?.title.trim();
              if (renameState && next) {
                onRename(renameState.slug, next);
                setRenameState(null);
              }
            }
          }}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setRenameState(null)}
          >
            cancel
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={() => {
              const next = renameState?.title.trim();
              if (renameState && next) {
                onRename(renameState.slug, next);
                setRenameState(null);
              }
            }}
            disabled={!renameState?.title.trim()}
          >
            rename
          </button>
        </div>
      </Modal>
    </div>
  );
}

function SelectIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.8" />
      <path d="M4.5 7.2l2 2 3-4" />
    </svg>
  );
}

function SmallLockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6.5" width="9" height="6" rx="1.2" />
      <path d="M4.5 6.5V4.5a2.5 2.5 0 1 1 5 0v2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5v5.5" />
      <path d="M3 2h6" />
      <path d="M4 7h4l-.5 2h-3L4 7z" />
      <path d="M6 9v2" />
    </svg>
  );
}

function CopyMdIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="6.5" height="7" rx="1" />
      <path d="M2 8V2.5A1 1 0 0 1 3 1.5h5" />
    </svg>
  );
}

function RevealIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 4a1 1 0 0 1 1-1h2.2l1 1.2H9.5a1 1 0 0 1 1 1v3.8a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V4Z" />
      <path d="M6 6v2M4.8 7H7.2" />
    </svg>
  );
}

export default memo(NoteListInner);
