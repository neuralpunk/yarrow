import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { NoteSummary } from "../../lib/types";
import { prefetchNote } from "../../lib/notePrefetch";
import {
  PlusIcon,
  UnlinkIcon,
  ChevronRightIcon,
  RenameIcon,
  DeleteIcon,
} from "../../lib/icons";
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
  /** Optional path count for the pinned-active hero card's meta line —
   *  renders as "{N} notes · {M} paths". Omitted when undefined. */
  pathCount?: number;
}

type TimeBucket = "today" | "yesterday" | "week" | "older";

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
  pathCount,
}: Props) {
  const [menu, setMenu] = useState<{ slug: string; x: number; y: number } | null>(null);
  const [showOrphans, setShowOrphans] = useState(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  // Hover-intent timer: only warm the note cache if the cursor lingers
  // for ~120ms, so flicking down the list doesn't trigger a prefetch storm.
  const hoverPrefetchTimer = useRef<number | null>(null);
  const [renameState, setRenameState] = useState<{ slug: string; title: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Older section is collapsed by default. Users land with a short,
  // recent-first list; deep history is one click away.
  const [showAllOlder, setShowAllOlder] = useState(false);

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

  // Hover-to-highlight: the paths pane fires `yarrow:path-highlight` with a
  // slug list when the user is pointing at a path card. We dim every other
  // row so the slugs from that path "light up" inside the note list.
  const [pathHighlight, setPathHighlight] = useState<Set<string> | null>(null);
  useEffect(() => {
    const onHighlight = (ev: Event) => {
      const detail = (ev as CustomEvent<{ slugs: string[] | null }>).detail;
      if (!detail || !detail.slugs) { setPathHighlight(null); return; }
      setPathHighlight(new Set(detail.slugs));
    };
    window.addEventListener("yarrow:path-highlight", onHighlight as EventListener);
    return () => window.removeEventListener("yarrow:path-highlight", onHighlight as EventListener);
  }, []);

  const orphanCount = orphans.size;
  const now = Date.now();
  const decayCutoff = now - decayDays * 86400 * 1000;

  // Bucket boundaries, recomputed each pass so notes cross at midnight.
  const { startOfToday, startOfYesterday, startOf7DaysAgo } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const t = today.getTime();
    return {
      startOfToday: t,
      startOfYesterday: t - 86400 * 1000,
      startOf7DaysAgo: t - 7 * 86400 * 1000,
    };
  }, [now]);

  const enriched = useMemo(() => {
    return notes.map((n) => {
      const mTime = n.modified ? new Date(n.modified).getTime() : now;
      const stale = mTime < decayCutoff;
      const daysOld = Math.floor((now - mTime) / (86400 * 1000));
      const isOrphan = orphans.has(n.slug);
      const bucket: TimeBucket =
        mTime >= startOfToday ? "today"
        : mTime >= startOfYesterday ? "yesterday"
        : mTime >= startOf7DaysAgo ? "week"
        : "older";
      return { ...n, mTime, stale, daysOld, isOrphan, bucket };
    });
  }, [notes, decayCutoff, orphans, now, startOfToday, startOfYesterday, startOf7DaysAgo]);
  void tagFilter; // filtering is applied upstream in AppShell

  const relatedToHovered = hoveredSlug ? neighbors[hoveredSlug] : null;

  // Sort each bucket newest-first — within a bucket, the most recently
  // touched note reads at the top.
  const sortByMTime = <T extends { mTime: number }>(arr: T[]) =>
    arr.slice().sort((a, b) => b.mTime - a.mTime);

  const pinned = sortByMTime(enriched.filter((n) => n.pinned));
  const rest = enriched.filter((n) => !n.pinned);
  const today = sortByMTime(rest.filter((n) => n.bucket === "today"));
  const yesterday = sortByMTime(rest.filter((n) => n.bucket === "yesterday"));
  const week = sortByMTime(rest.filter((n) => n.bucket === "week"));
  const older = sortByMTime(rest.filter((n) => n.bucket === "older"));

  // "Older" is capped to a preview until the user expands it. Anything
  // over the cap shows as "+ N MORE" on the group header.
  const OLDER_PREVIEW = 3;
  const olderVisible = showAllOlder ? older : older.slice(0, OLDER_PREVIEW);
  const olderHidden = Math.max(0, older.length - OLDER_PREVIEW);

  const activePinned = pinned.find((n) => n.slug === activeSlug) ?? null;
  const otherPinned = activePinned
    ? pinned.filter((n) => n.slug !== activePinned.slug)
    : pinned;

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
        data-path-highlight={
          pathHighlight === null
            ? "none"
            : pathHighlight.has(n.slug) ? "in" : "out"
        }
        className="relative flex items-center yarrow-path-hl"
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
            className="ml-2 mr-1 accent-yel shrink-0"
            aria-label={`Select ${n.title || n.slug}`}
          />
        )}
        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-yarrow-note", n.slug);
            e.dataTransfer.setData("text/plain", n.title || n.slug);
            e.dataTransfer.effectAllowed = "copy";
          }}
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
          className={`note-row flex-1 min-w-0 text-left px-4 py-1.5 font-serif text-[14px] leading-snug group transition-[background-color,color,box-shadow] duration-150 ${
            isSelected
              ? "bg-yelp/60 text-char"
              : active
                ? "bg-yelp text-char"
                : related
                  ? "bg-accent2-dim/40 text-ch2"
                  : n.stale
                    // Modern editorial hover: warm paper wash + a thin
                    // gold rule slides in on the left edge (like a
                    // manuscript margin mark), and the title lifts from
                    // muted to full-contrast so your eye follows the
                    // cursor without a background change shouting at you.
                    ? "text-t2 hover:bg-yelp/25 hover:text-ch2 hover:shadow-[inset_2px_0_0_rgba(227,186,104,0.45)]"
                    : "text-ch2 hover:bg-yelp/25 hover:text-char hover:shadow-[inset_2px_0_0_rgba(227,186,104,0.45)]"
          }`}
          style={
            isMain
              ? { boxShadow: "inset 2px 0 0 0 #D4A04A" }
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            {isMain && (
              <span
                className="shrink-0 leading-none"
                style={{ color: "#D4A04A", fontSize: 12 }}
                title="Starting note — your workspace's main"
              >
                ★
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
        </button>
      </li>
    );
  };

  // Editorial group header — a small uppercase label with optional
  // trailing count text ("+ 4 MORE"). Shared between time groups and the
  // collapsed-older treatment so the rhythm reads consistently.
  const renderGroupHeader = (
    label: string,
    trailing?: { text: string; onClick: () => void },
  ) => (
    <div className="px-4 pt-4 pb-1 flex items-baseline justify-between">
      <span className="text-[10px] uppercase tracking-[0.16em] text-t3 font-sans font-semibold">
        {label}
      </span>
      {trailing && (
        <button
          onClick={trailing.onClick}
          className="text-[10px] uppercase tracking-[0.16em] text-t3 font-sans font-semibold hover:text-ch2 transition"
        >
          {trailing.text}
        </button>
      )}
    </div>
  );

  const renderGroup = (
    label: string,
    rows: typeof enriched,
    trailing?: { text: string; onClick: () => void },
  ) => {
    if (rows.length === 0 && !trailing) return null;
    return (
      <>
        {renderGroupHeader(label, trailing)}
        <ul className="flex flex-col">
          {rows.map((n) => renderRow(n))}
        </ul>
      </>
    );
  };

  // Hero card for a pinned-AND-active note — the editorial "you are here"
  // surface at the top of the list. Highlighted background, PIN/ACTIVE
  // eyebrow, title in serif, quiet meta line.
  const renderPinnedActiveHero = (n: typeof enriched[number]) => (
    <button
      key={n.slug}
      onClick={() => onSelect(n.slug)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ slug: n.slug, x: e.clientX, y: e.clientY });
      }}
      className="text-left mx-3 mt-3 mb-1 px-4 py-3 rounded-lg bg-yelp/50 border border-yel/40 hover:bg-yelp/70 transition block w-[calc(100%-1.5rem)]"
    >
      <div className="text-[9px] uppercase tracking-[0.2em] text-yeld font-sans font-semibold flex items-center gap-1.5">
        <PinIcon />
        <span>Pinned</span>
        <span className="text-t3">·</span>
        <span>Active</span>
      </div>
      <div className="font-serif text-[16px] text-char leading-snug mt-1.5 truncate">
        {n.title || n.slug}
      </div>
      <div className="text-[11px] text-t3 font-sans mt-1 font-feature-settings-['tnum']">
        {notes.length} note{notes.length === 1 ? "" : "s"}
        {typeof pathCount === "number" && pathCount > 0
          ? ` · ${pathCount} path${pathCount === 1 ? "" : "s"}`
          : ""}
      </div>
    </button>
  );

  // Smaller hero variant for pinned notes that aren't currently active —
  // same eyebrow + title layout, quieter background so the active one
  // still reads as the "you are here" anchor.
  const renderPinnedOtherHero = (n: typeof enriched[number]) => (
    <button
      key={n.slug}
      onClick={() => onSelect(n.slug)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ slug: n.slug, x: e.clientX, y: e.clientY });
      }}
      className="text-left mx-3 mb-1 px-4 py-2.5 rounded-lg bg-s1 border border-bd hover:bg-s2 transition block w-[calc(100%-1.5rem)]"
    >
      <div className="text-[9px] uppercase tracking-[0.2em] text-t3 font-sans font-semibold flex items-center gap-1.5">
        <PinIcon />
        <span>Pinned</span>
      </div>
      <div className="font-serif text-[14.5px] text-ch2 leading-snug mt-1 truncate">
        {n.title || n.slug}
      </div>
    </button>
  );

  const menuNote = menu ? enriched.find((n) => n.slug === menu.slug) : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {activePinned && renderPinnedActiveHero(activePinned)}
        {otherPinned.map(renderPinnedOtherHero)}

        {tagFilter && (
          <div className="mx-3 mt-2 mb-1 px-2.5 py-1 text-2xs flex items-center gap-1.5 bg-yelp/60 text-yeld rounded">
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
          <div className="mx-3 mt-2 mb-1 px-2.5 py-1.5 text-2xs flex items-center gap-2 bg-s2 rounded">
            <span className="text-t2">{selected.size} selected</span>
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

        {renderGroup("Today", today)}
        {renderGroup("Yesterday", yesterday)}
        {renderGroup("Last Week", week)}
        {older.length > 0 && renderGroup(
          "Older",
          olderVisible,
          olderHidden > 0
            ? {
                text: showAllOlder ? "collapse" : `+ ${olderHidden} more`,
                onClick: () => setShowAllOlder((x) => !x),
              }
            : undefined,
        )}

        {enriched.length === 0 && (
          <div className="px-4 py-6 text-xs text-t3 italic">
            No notes yet. Click + New to start.
          </div>
        )}

        {orphanCount > 0 && (
          <div className="mx-3 mt-4 mb-2">
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
      </div>

      {/* Sticky footer — count on the left, New button on the right.
          Multi-select is accessible via a tiny text link between them so
          it's discoverable but doesn't add visual weight to the strip. */}
      <div className="shrink-0 border-t border-bd/60 px-4 py-2 flex items-center justify-between text-[11px]">
        <span className="text-t3 font-sans font-feature-settings-['tnum']">
          {notes.length} note{notes.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectMode((x) => !x)}
            className={`text-[11px] transition ${selectMode ? "text-yeld" : "text-t3 hover:text-ch2"}`}
            title={selectMode ? "Exit multi-select" : "Select multiple notes"}
          >
            {selectMode ? "done" : "select"}
          </button>
          <button
            onClick={onCreate}
            className="flex items-center gap-1 text-t2 hover:text-char transition"
            aria-label="New note"
          >
            <PlusIcon size={11} />
            <span>New</span>
          </button>
        </div>
      </div>

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
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
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
