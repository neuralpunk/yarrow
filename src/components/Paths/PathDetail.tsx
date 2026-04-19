import { useEffect, useMemo, useState } from "react";
import type { NoteSummary, PathCollection } from "../../lib/types";
import { api } from "../../lib/tauri";
import { relativeTime } from "../../lib/format";

interface Props {
  collection: PathCollection;
  allNotes: NoteSummary[];
  isRoot: boolean;
  /** Derived: this path is a ghost (not live under the current root). */
  isGhost: boolean;
  parentName: string;
  /** The path the user is currently working in. When set, PathDetail shows
   *  an "If you take this path…" diff comparing this path's members to the
   *  current path: which notes you'd gain, which you'd leave behind. */
  currentPathName?: string;
  currentPathMembers?: string[];
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
  currentPathName,
  currentPathMembers,
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
  const [dropOver, setDropOver] = useState(false);

  const titleFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of allNotes) m.set(n.slug, n.title || n.slug);
    return m;
  }, [allNotes]);

  const memberSet = useMemo(() => new Set(collection.members), [collection.members]);

  // Membership-only diff is always cheap to derive client-side; we use it as
  // a baseline so the panel renders instantly even before the backend
  // comparison comes back.
  const memberDiff = useMemo(() => {
    if (!currentPathName || !currentPathMembers || currentPathName === collection.name) return null;
    const baseline = new Set(currentPathMembers);
    const candidate = new Set(collection.members);
    const gained = collection.members
      .filter((s) => !baseline.has(s))
      .map((slug) => decorateNote(slug, allNotes, titleFor));
    const lost = currentPathMembers
      .filter((s) => !candidate.has(s))
      .map((slug) => decorateNote(slug, allNotes, titleFor));
    if (gained.length === 0 && lost.length === 0) return null;
    return { gained, lost };
  }, [collection.name, collection.members, currentPathName, currentPathMembers, titleFor, allNotes]);

  // Modified state ("present on both paths but the body differs") needs the
  // git-aware backend comparison — content can diverge without membership
  // changing. We fetch it lazily so opening the panel stays snappy.
  const [modified, setModified] = useState<NoteRow[] | null>(null);
  useEffect(() => {
    if (!currentPathName || currentPathName === collection.name) {
      setModified(null);
      return;
    }
    let alive = true;
    api.comparePaths(currentPathName, collection.name)
      .then((cmp) => {
        if (!alive) return;
        const rows = cmp.entries
          .filter((e) => e.status === "modified")
          .map((e) => decorateNote(e.slug, allNotes, titleFor));
        setModified(rows);
      })
      .catch(() => { if (alive) setModified([]); });
    return () => { alive = false; };
  }, [currentPathName, collection.name, allNotes, titleFor]);

  // Group a list of decorated notes by tag for the diff panel — notes with
  // multiple tags appear under each, untagged ones gather under "untagged".
  const groupByTag = (rows: NoteRow[]): Array<[string, NoteRow[]]> => {
    if (rows.length === 0) return [];
    const buckets = new Map<string, NoteRow[]>();
    for (const r of rows) {
      const tags = r.tags.length ? r.tags : ["untagged"];
      for (const t of tags) {
        if (!buckets.has(t)) buckets.set(t, []);
        buckets.get(t)!.push(r);
      }
    }
    return [...buckets.entries()].sort((a, b) => {
      // Push "untagged" to the bottom; otherwise alphabetical.
      if (a[0] === "untagged") return 1;
      if (b[0] === "untagged") return -1;
      return a[0].localeCompare(b[0]);
    });
  };

  const diff = memberDiff || (modified && modified.length > 0
    ? { gained: [], lost: [] }
    : null);
  const [groupTags, setGroupTags] = useState(false);

  // While PathDetail is open, keep the note list highlight in sync with the
  // selected path so the user can see "this is what's on this path" at a
  // glance, not only on transient card hover.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("yarrow:path-highlight", {
      detail: { slugs: collection.members },
    }));
    return () => {
      window.dispatchEvent(new CustomEvent("yarrow:path-highlight", {
        detail: { slugs: null },
      }));
    };
  }, [collection.members]);

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
        {diff && (
          <section className="px-4 pt-3 pb-3 border-b border-bd/60 bg-bg/40">
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-2xs uppercase tracking-[0.18em] font-mono text-t3">
                If you take this path
                <span className="ml-2 normal-case tracking-normal text-t3/80">
                  vs <span className="text-yeld">{currentPathName}</span>
                </span>
              </div>
              <button
                onClick={() => setGroupTags((g) => !g)}
                className="ml-auto text-2xs text-t3 hover:text-char"
                title="Cluster the lists by their tags"
              >
                {groupTags ? "flat list" : "group by tag"}
              </button>
            </div>

            <DiffGroup
              tone="gain"
              label="you'd gain"
              rows={memberDiff?.gained ?? []}
              groupTags={groupTags}
              groupByTag={groupByTag}
              onOpenNote={onOpenNote}
            />
            <DiffGroup
              tone="modified"
              label="present on both, but edited differently"
              rows={modified ?? []}
              groupTags={groupTags}
              groupByTag={groupByTag}
              onOpenNote={onOpenNote}
            />
            <DiffGroup
              tone="lose"
              label="you'd leave behind"
              rows={memberDiff?.lost ?? []}
              groupTags={groupTags}
              groupByTag={groupByTag}
              onOpenNote={onOpenNote}
              titleSuffix={`Not on ${collection.name} — open to inspect`}
            />

            {modified === null && (
              <div className="text-2xs text-t3 italic mt-1">
                checking for divergent edits…
              </div>
            )}
          </section>
        )}

        {/* ── Members ── */}
        <section
          className={`pt-3 pb-1 transition ${dropOver ? "bg-yelp/30 outline outline-2 outline-yel/60 outline-offset-[-2px]" : ""}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("application/x-yarrow-note")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (!dropOver) setDropOver(true);
          }}
          onDragLeave={(e) => {
            // Only flip off when the cursor leaves the section, not when it
            // crosses into a child element.
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDropOver(false);
          }}
          onDrop={(e) => {
            const slug = e.dataTransfer.getData("application/x-yarrow-note");
            setDropOver(false);
            if (!slug || memberSet.has(slug)) return;
            e.preventDefault();
            void onAddNote(slug);
          }}
        >
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

interface NoteRow {
  slug: string;
  title: string;
  tags: string[];
}

const TONE_STYLES = {
  gain: { count: "text-yeld", glyph: "+", glyphColor: "text-yeld", row: "text-char hover:bg-yelp/40", strike: "" },
  lose: { count: "text-danger", glyph: "−", glyphColor: "text-danger", row: "text-t2 hover:bg-s2 line-through decoration-danger/40", strike: "no-underline" },
  modified: { count: "text-amber-700 dark:text-amber-400", glyph: "~", glyphColor: "text-amber-700 dark:text-amber-400", row: "text-char hover:bg-s2", strike: "" },
} as const;

type Tone = keyof typeof TONE_STYLES;

function DiffGroup({
  tone, label, rows, groupTags, groupByTag, onOpenNote, titleSuffix,
}: {
  tone: Tone;
  label: string;
  rows: NoteRow[];
  groupTags: boolean;
  groupByTag: (rows: NoteRow[]) => Array<[string, NoteRow[]]>;
  onOpenNote: (slug: string) => void;
  titleSuffix?: string;
}) {
  if (rows.length === 0) return null;
  const styles = TONE_STYLES[tone];
  const sign = tone === "lose" ? "−" : tone === "modified" ? "~" : "+";

  const renderRow = (n: NoteRow) => (
    <li key={n.slug + ":" + n.title}>
      <button
        onClick={() => onOpenNote(n.slug)}
        className={`w-full text-left text-xs ${styles.row} rounded px-2 py-0.5 truncate flex items-center gap-1.5`}
        title={titleSuffix}
      >
        <span className={`${styles.glyphColor} ${styles.strike}`}>{styles.glyph}</span>
        <span className={`truncate ${styles.strike}`}>{n.title}</span>
      </button>
    </li>
  );

  return (
    <div className="mb-2">
      <div className={`text-2xs font-mono mb-1 ${styles.count}`}>
        {sign}{rows.length} {label}
      </div>
      {groupTags ? (
        <div className="space-y-1.5">
          {groupByTag(rows).map(([tag, items]) => (
            <div key={tag}>
              <div className="text-2xs text-t3 font-mono px-2">
                #{tag} <span className="text-t3/70">· {items.length}</span>
              </div>
              <ul className="space-y-0.5">
                {items.slice(0, 5).map(renderRow)}
                {items.length > 5 && (
                  <li className="text-2xs text-t3 italic px-2">
                    … and {items.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {rows.slice(0, 5).map(renderRow)}
          {rows.length > 5 && (
            <li className="text-2xs text-t3 italic px-2">
              … and {rows.length - 5} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function decorateNote(slug: string, allNotes: NoteSummary[], titleFor: Map<string, string>): NoteRow {
  const found = allNotes.find((n) => n.slug === slug);
  return {
    slug,
    title: titleFor.get(slug) || slug,
    tags: found?.tags ?? [],
  };
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
