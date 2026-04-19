import { useMemo, useState } from "react";
import type { NoteSummary, PathCollection } from "../../lib/types";
import { relativeTime } from "../../lib/format";

interface Props {
  collection: PathCollection;
  allNotes: NoteSummary[];
  isRoot: boolean;
  /** Derived: this path is a ghost (not live under the current root). */
  isGhost: boolean;
  parentName: string;
  onClose: () => void;
  onOpenNote: (slug: string) => void;
  onOpenMap: (slug?: string) => void;
  onEditCondition: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSetMainNote: (slug: string | null) => Promise<void> | void;
  onAddNote: (slug: string) => Promise<void> | void;
  onRemoveNote: (slug: string) => Promise<void> | void;
  onBranchFromNote: (slug: string) => void;
  /** Open the "promote this path to main" confirmation flow. Only shown
   *  when this is a non-root path. */
  onRequestPromote?: () => void;
}

/**
 * Detail panel for a selected path collection. The two panels directly
 * express the new mental model: *these notes are in this path*, *these
 * notes are not*. Click-to-add, click-to-remove, designate-main,
 * "turn into a new path".
 */
export default function PathDetail({
  collection,
  allNotes,
  isRoot,
  isGhost,
  parentName,
  onClose,
  onOpenNote,
  onOpenMap,
  onEditCondition,
  onRename,
  onDelete,
  onSetMainNote,
  onAddNote,
  onRemoveNote,
  onBranchFromNote,
  onRequestPromote,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);

  const titleFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of allNotes) m.set(n.slug, n.title || n.slug);
    return m;
  }, [allNotes]);

  const memberSet = useMemo(() => new Set(collection.members), [collection.members]);

  const members = useMemo(() => {
    return collection.members
      .map((slug) => ({ slug, title: titleFor.get(slug) || slug }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [collection.members, titleFor]);

  const candidates = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return allNotes
      .filter((n) => !memberSet.has(n.slug))
      .filter((n) =>
        !needle ||
        (n.title || n.slug).toLowerCase().includes(needle) ||
        n.slug.toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [allNotes, memberSet, filter]);

  const act = async (slug: string, fn: (s: string) => Promise<void> | void) => {
    setBusy(slug);
    try { await fn(slug); } finally { setBusy(null); }
  };

  return (
    <aside className="h-full w-full flex flex-col bg-s1 overflow-hidden">
      <header className="px-4 pt-4 pb-3 border-b border-bd">
        <div className="flex items-center mb-1">
          {isGhost ? (
            <span className="text-2xs uppercase tracking-[0.2em] font-mono text-t3">
              Ghost path · branched from{" "}
              <span className="text-t2 not-italic">{collection.parent || "—"}</span>
            </span>
          ) : isRoot ? (
            <span className="text-2xs uppercase tracking-[0.2em] font-mono text-yeld">
              ★ Main · the trunk
            </span>
          ) : (
            <span className="text-2xs uppercase tracking-[0.2em] font-mono text-t3">
              Side path · branched from{" "}
              <span className="text-yeld not-italic">{parentName}</span>
            </span>
          )}
          <button
            onClick={onClose}
            className="ml-auto text-t3 hover:text-char w-6 h-6 flex items-center justify-center rounded hover:bg-s2"
            aria-label="Close detail"
            title="Close (Esc)"
          >×</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="font-serif text-[22px] text-char truncate" title={collection.name}>
            {collection.name}
          </div>
          {!isRoot && (
            <button
              onClick={onRename}
              className="text-2xs text-t3 hover:text-char"
              title="Rename this path"
            >rename</button>
          )}
        </div>
        <button
          onClick={onEditCondition}
          className={`mt-1.5 text-left w-full text-xs leading-snug ${
            collection.condition ? "text-yeld italic hover:text-yel" : "text-t3 italic hover:text-t2"
          }`}
          title="Click to edit the question this path is asking"
        >
          {collection.condition
            ? `“${collection.condition}”`
            : "+ Name this path — what 'if…' is it asking?"}
        </button>
        <div className="mt-2 flex items-center gap-2 text-2xs font-mono text-t3 tracking-wider">
          <span>{collection.members.length} note{collection.members.length === 1 ? "" : "s"}</span>
          <span>·</span>
          <span>created {relativeTime(collection.created_at)}</span>
        </div>
        <div className="mt-2.5">
          <button
            onClick={() => onOpenMap(collection.main_note || undefined)}
            className="text-xs px-2.5 py-1 rounded-md border border-bd text-t2 hover:bg-s2 hover:text-char inline-flex items-center gap-1.5"
            title="Show the connection graph filtered to this path's notes"
          >
            <MapIcon /> Open the map for this path
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* ── Members ── */}
        <section className="pt-3 pb-1">
          <div className="px-4 flex items-baseline gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-yel" />
            <span className="font-serif text-[15px] text-char">In this path</span>
            <span className="text-2xs font-mono text-t3">{members.length}</span>
            <button
              onClick={() => setAdding((x) => !x)}
              className="ml-auto text-2xs text-t3 hover:text-char"
            >
              {adding ? "done" : "+ add note"}
            </button>
          </div>
          {members.length === 0 && !adding && (
            <div className="px-4 py-3 text-xs text-t3 italic">
              No notes on this path yet. Use “+ add note”.
            </div>
          )}
          <ul className="mt-1">
            {members.map((m) => (
              <li
                key={m.slug}
                className="group flex items-center hover:bg-s2/60 transition"
              >
                <button
                  onClick={() => onOpenNote(m.slug)}
                  className="flex-1 min-w-0 text-left px-4 py-2 text-sm text-char truncate flex items-center gap-2"
                  title="Open this note"
                >
                  {collection.main_note === m.slug ? (
                    <span
                      className="text-yeld shrink-0"
                      title="Main note for this path"
                    >★</span>
                  ) : (
                    <span className="text-t3 text-xs shrink-0 w-3 text-center">·</span>
                  )}
                  <span className="truncate">{m.title}</span>
                </button>
                <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 pr-2">
                  {collection.main_note !== m.slug && (
                    <button
                      onClick={() => act(m.slug, onSetMainNote)}
                      disabled={busy === m.slug}
                      className="text-2xs px-2 py-0.5 text-t3 hover:text-yeld hover:bg-yelp/40 rounded"
                      title="Designate this as the main note for this path"
                    >
                      mark main
                    </button>
                  )}
                  <button
                    onClick={() => onBranchFromNote(m.slug)}
                    className="text-2xs px-2 py-0.5 text-t3 hover:text-yeld hover:bg-yelp/40 rounded"
                    title="Turn this note into a new child path"
                  >
                    branch
                  </button>
                  {!(isRoot && members.length === 1) && (
                    <button
                      onClick={() => act(m.slug, onRemoveNote)}
                      disabled={busy === m.slug}
                      className="text-2xs px-2 py-0.5 text-t3 hover:text-danger hover:bg-s2 rounded"
                      title="Remove this note from this path (doesn't delete the note)"
                    >
                      {busy === m.slug ? "…" : "remove"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Add picker ── */}
        {adding && (
          <section className="px-4 pb-4 border-t border-bd/60 pt-3 bg-bg/40">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter notes…"
              className="w-full px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs"
            />
            <div className="mt-2 text-2xs text-t3 italic">
              {candidates.length === 0
                ? "No notes match. Every note is already on this path."
                : `${candidates.length} not on this path`}
            </div>
            <ul className="mt-1 max-h-[280px] overflow-y-auto">
              {candidates.map((n) => (
                <li key={n.slug}>
                  <button
                    onClick={() => act(n.slug, onAddNote)}
                    disabled={busy === n.slug}
                    className="w-full text-left px-2 py-1.5 text-xs text-t2 hover:text-char hover:bg-s2/70 rounded flex items-center gap-2"
                  >
                    <span className="text-yeld">+</span>
                    <span className="truncate">{n.title || n.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="border-t border-bd p-3 bg-s1 flex flex-wrap items-center gap-1.5">
        {!isRoot && onRequestPromote && (
          <button
            onClick={onRequestPromote}
            className="text-xs px-2.5 py-1.5 rounded-md border border-yel/60 text-yeld hover:bg-yelp inline-flex items-center gap-1.5"
            title={
              isGhost
                ? `Bring ${collection.name} back as the workspace's main path`
                : `Make ${collection.name} the workspace's main path`
            }
          >
            ★ {isGhost ? "Bring back as main…" : "Promote to main…"}
          </button>
        )}
        {!isRoot && !isGhost && (
          <button
            onClick={onDelete}
            className="ml-auto text-xs px-2.5 py-1.5 rounded-md border border-bd/70 text-t3 hover:text-danger hover:border-danger/60"
            title="Remove this path (doesn't delete any notes)"
          >
            Delete this path
          </button>
        )}
        {isRoot && (
          <div className="text-2xs text-t3 italic w-full text-center">
            This is the trunk. Everything else branches off here.
          </div>
        )}
        {isGhost && (
          <div className="ml-auto text-2xs text-t3 italic">
            Historical · promote to bring this era back.
          </div>
        )}
      </footer>
    </aside>
  );
}

function MapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="3" r="1.5"/>
      <circle cx="3" cy="11" r="1.5"/>
      <circle cx="11" cy="7" r="1.5"/>
      <path d="M3 4.5v5M4.3 3.7l5.4 2.6M4.3 10.3l5.4-2.6"/>
    </svg>
  );
}
