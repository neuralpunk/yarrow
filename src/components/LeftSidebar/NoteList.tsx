import { useMemo, useState } from "react";
import type { NoteSummary } from "../../lib/types";
import { relativeTime } from "../../lib/format";
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
  orphans: Set<string>;
  decayDays: number;
  neighbors: Record<string, Set<string>>;
  onSelect: (slug: string) => void;
  onCreate: () => void;
  onRename: (slug: string, newTitle: string) => void;
  onDelete: (slug: string) => void;
  onTogglePin: (slug: string, pinned: boolean) => void;
}

export default function NoteList({
  notes,
  activeSlug,
  orphans,
  decayDays,
  neighbors,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onTogglePin,
}: Props) {
  const [menuSlug, setMenuSlug] = useState<string | null>(null);
  const [showOrphans, setShowOrphans] = useState(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{ slug: string; title: string } | null>(null);

  const orphanCount = orphans.size;
  const now = Date.now();
  const decayCutoff = now - decayDays * 86400 * 1000;

  const enriched = useMemo(() => {
    return notes.map((n) => {
      const mTime = n.modified ? new Date(n.modified).getTime() : now;
      const stale = mTime < decayCutoff;
      const daysOld = Math.floor((now - mTime) / (86400 * 1000));
      const isOrphan = orphans.has(n.slug);
      return { ...n, stale, daysOld, isOrphan };
    });
  }, [notes, decayCutoff, orphans, now]);

  const relatedToHovered = hoveredSlug ? neighbors[hoveredSlug] : null;

  const pinned = enriched.filter((n) => n.pinned);
  const rest = enriched.filter((n) => !n.pinned);

  const renderRow = (n: typeof enriched[number]) => {
    const active = n.slug === activeSlug;
    const related =
      !active &&
      !!relatedToHovered &&
      hoveredSlug !== n.slug &&
      relatedToHovered.has(n.slug);
    return (
      <li
        key={n.slug}
        className="relative"
        onMouseEnter={() => setHoveredSlug(n.slug)}
        onMouseLeave={() => setHoveredSlug(null)}
      >
        <button
          onClick={() => onSelect(n.slug)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuSlug(menuSlug === n.slug ? null : n.slug);
          }}
          data-related={related ? "true" : "false"}
          title={
            n.stale
              ? `Hasn't been visited in ${n.daysOld} days`
              : n.isOrphan
                ? "This note isn't linked to anything yet"
                : undefined
          }
          className={`note-row w-full text-left px-3 py-2 rounded-md text-sm group transition-colors ${
            active
              ? "bg-yelp text-char border-l-[3px] border-yel pl-[9px] shadow-sm"
              : related
                ? "bg-accent2-dim/40 text-ch2"
                : n.stale
                  ? "text-t2 hover:bg-s2"
                  : "text-ch2 hover:bg-s2"
          }`}
        >
          <div className="flex items-center gap-2">
            {n.pinned && (
              <span className="text-yel shrink-0" title="Pinned">
                <PinIcon />
              </span>
            )}
            <span className={`truncate flex-1 ${active ? "font-medium" : ""}`}>
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
          <div className="text-2xs text-t3 font-mono mt-0.5">
            {relativeTime(n.modified)}
          </div>
        </button>
        {menuSlug === n.slug && (
          <div
            className="absolute left-full top-0 ml-1 z-10 w-44 bg-bg border border-bd2 rounded-md shadow-lg text-xs py-1"
            onMouseLeave={() => setMenuSlug(null)}
          >
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
              onClick={() => {
                setMenuSlug(null);
                onTogglePin(n.slug, !n.pinned);
              }}
            >
              <PinIcon /> {n.pinned ? "Unpin" : "Pin to top"}
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
              onClick={() => {
                setMenuSlug(null);
                setRenameState({ slug: n.slug, title: n.title });
              }}
            >
              <RenameIcon /> Rename
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-s2 text-danger flex items-center gap-2"
              onClick={() => {
                setMenuSlug(null);
                onDelete(n.slug);
              }}
            >
              <DeleteIcon /> Delete
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="pt-3">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="text-2xs uppercase tracking-wider text-t3 font-semibold">
          Your Notes
        </div>
        <button
          onClick={onCreate}
          className="y-tip w-6 h-6 flex items-center justify-center text-t2 hover:text-char hover:bg-s2 rounded transition"
          data-tip={`New note (${SK.newNote})`}
          aria-label="New note"
        >
          <PlusIcon />
        </button>
      </div>
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
