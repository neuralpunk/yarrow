import { useEffect, useMemo, useState } from "react";
import type { NoteSummary, PathCollection } from "../../lib/types";
import { api } from "../../lib/tauri";
import { relativeTime } from "../../lib/format";
import { useT } from "../../lib/i18n";

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
  /** Persist a user-assigned accent color (CSS hex). Pass `null` to clear
   *  and fall back to the derived palette hue. */
  onSetColor: (color: string | null) => Promise<void> | void;
  /** Set (or clear with `null`) the tag that auto-populates this path. */
  onSetAutoTag: (tag: string | null) => Promise<void> | void;
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
  onSetColor,
  onSetAutoTag,
  onSetMainNote,
  onAddNote,
  onRemoveNote,
  onBranchFromNote,
  onRequestPromote,
}: Props) {
  const t = useT();
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
  // multiple tags appear under each, untagged ones gather under a sentinel
  // bucket displayed with the localized "untagged" label.
  const UNTAGGED_KEY = "__untagged__";
  const groupByTag = (rows: NoteRow[]): Array<[string, NoteRow[]]> => {
    if (rows.length === 0) return [];
    const buckets = new Map<string, NoteRow[]>();
    for (const r of rows) {
      const tags = r.tags.length ? r.tags : [UNTAGGED_KEY];
      for (const tag of tags) {
        if (!buckets.has(tag)) buckets.set(tag, []);
        buckets.get(tag)!.push(r);
      }
    }
    return [...buckets.entries()].sort((a, b) => {
      // Push untagged to the bottom; otherwise alphabetical.
      if (a[0] === UNTAGGED_KEY) return 1;
      if (b[0] === UNTAGGED_KEY) return -1;
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
              {(() => {
                const parts = t("paths.detail.ghostHeader").split("{parent}");
                return (
                  <>
                    {parts[0]}
                    <span className="text-t2 not-italic">
                      {collection.parent || t("paths.detail.ghostHeaderUnknown")}
                    </span>
                    {parts[1] ?? ""}
                  </>
                );
              })()}
            </span>
          ) : isRoot ? (
            <span className="text-2xs uppercase tracking-[0.2em] font-mono text-yeld">
              {t("paths.detail.mainHeader")}
            </span>
          ) : (
            <span className="text-2xs uppercase tracking-[0.2em] font-mono text-t3">
              {(() => {
                const parts = t("paths.detail.sideHeader").split("{parent}");
                return (
                  <>
                    {parts[0]}
                    <span className="text-yeld not-italic">{parentName}</span>
                    {parts[1] ?? ""}
                  </>
                );
              })()}
            </span>
          )}
          <button
            onClick={onClose}
            className="ml-auto text-t3 hover:text-char w-6 h-6 flex items-center justify-center rounded hover:bg-s2"
            aria-label={t("paths.detail.closeAria")}
            title={t("paths.detail.closeTitle")}
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
              title={t("paths.detail.renameTitle")}
            >{t("paths.detail.rename")}</button>
          )}
        </div>
        <button
          onClick={onEditCondition}
          className={`mt-1.5 text-left w-full text-xs leading-snug ${
            collection.condition ? "text-yeld italic hover:text-yel" : "text-t3 italic hover:text-t2"
          }`}
          title={t("paths.detail.editConditionTitle")}
        >
          {collection.condition
            ? `“${collection.condition}”`
            : t("paths.detail.namePrompt")}
        </button>
        <div className="mt-2 flex items-center gap-2 text-2xs font-mono text-t3 tracking-wider">
          <span>
            {collection.members.length === 1
              ? t("paths.detail.notesCountOne", { count: String(collection.members.length) })
              : t("paths.detail.notesCountMany", { count: String(collection.members.length) })}
          </span>
          <span>·</span>
          <span>{t("paths.detail.created", { when: relativeTime(collection.created_at) })}</span>
        </div>
        <div className="mt-2.5 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => onOpenMap(collection.main_note || undefined)}
            className="text-xs px-2.5 py-1 rounded-md border border-bd text-t2 hover:bg-s2 hover:text-char inline-flex items-center gap-1.5"
            title={t("paths.detail.openMapTitle")}
          >
            <MapIcon /> {t("paths.detail.openMap")}
          </button>
          <ColorPicker
            current={collection.color ?? null}
            onPick={onSetColor}
          />
        </div>
        <AutoTagRow
          current={collection.auto_membership_tag ?? null}
          memberCount={collection.members.length}
          onSet={onSetAutoTag}
        />
      </header>

      <div className="flex-1 overflow-y-auto">
        {diff && (
          <section className="px-4 pt-3 pb-3 border-b border-bd/60 bg-bg/40">
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-2xs uppercase tracking-[0.18em] font-mono text-t3">
                {t("paths.detail.diffHeading")}
                <span className="ml-2 normal-case tracking-normal text-t3/80">
                  {(() => {
                    const tpl = t("paths.detail.diffVs");
                    const parts = tpl.split("{name}");
                    return (
                      <>
                        {parts[0]}
                        <span className="text-yeld">{currentPathName}</span>
                        {parts[1] ?? ""}
                      </>
                    );
                  })()}
                </span>
              </div>
              <button
                onClick={() => setGroupTags((g) => !g)}
                className="ml-auto text-2xs text-t3 hover:text-char"
                title={t("paths.detail.diffGroupTitle")}
              >
                {groupTags ? t("paths.detail.diffFlat") : t("paths.detail.diffGroup")}
              </button>
            </div>

            <DiffGroup
              tone="gain"
              label={t("paths.detail.diffGain")}
              rows={memberDiff?.gained ?? []}
              groupTags={groupTags}
              groupByTag={groupByTag}
              onOpenNote={onOpenNote}
            />
            <DiffGroup
              tone="modified"
              label={t("paths.detail.diffEdited")}
              rows={modified ?? []}
              groupTags={groupTags}
              groupByTag={groupByTag}
              onOpenNote={onOpenNote}
            />
            <DiffGroup
              tone="lose"
              label={t("paths.detail.diffLose")}
              rows={memberDiff?.lost ?? []}
              groupTags={groupTags}
              groupByTag={groupByTag}
              onOpenNote={onOpenNote}
              titleSuffix={t("paths.detail.diffLoseTitle", { name: collection.name })}
            />

            {modified === null && (
              <div className="text-2xs text-t3 italic mt-1">
                {t("paths.detail.diffChecking")}
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
            <span className="font-serif text-[15px] text-char">{t("paths.detail.inThisPath")}</span>
            <span className="text-2xs font-mono text-t3">{members.length}</span>
            <button
              onClick={() => setAdding((x) => !x)}
              className="ml-auto text-2xs text-t3 hover:text-char"
            >
              {adding ? t("paths.detail.adding") : t("paths.detail.add")}
            </button>
          </div>
          {members.length === 0 && !adding && (
            <div className="px-4 py-3 text-xs text-t3 italic">
              {t("paths.detail.emptyMembers")}
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
                  title={t("paths.detail.openTitle")}
                >
                  {collection.main_note === m.slug ? (
                    <span
                      className="text-yeld shrink-0"
                      title={t("paths.detail.mainNoteTitle")}
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
                      title={t("paths.detail.markMainTitle")}
                    >
                      {t("paths.detail.markMain")}
                    </button>
                  )}
                  <button
                    onClick={() => onBranchFromNote(m.slug)}
                    className="text-2xs px-2 py-0.5 text-t3 hover:text-yeld hover:bg-yelp/40 rounded"
                    title={t("paths.detail.branchTitle")}
                  >
                    {t("paths.detail.branch")}
                  </button>
                  {!(isRoot && members.length === 1) && (
                    <button
                      onClick={() => act(m.slug, onRemoveNote)}
                      disabled={busy === m.slug}
                      className="text-2xs px-2 py-0.5 text-t3 hover:text-danger hover:bg-s2 rounded"
                      title={t("paths.detail.removeTitle")}
                    >
                      {busy === m.slug ? "…" : t("paths.detail.remove")}
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
              placeholder={t("paths.detail.filterPlaceholder")}
              className="w-full px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs"
            />
            <div className="mt-2 text-2xs text-t3 italic">
              {candidates.length === 0
                ? t("paths.detail.filterEmpty")
                : t("paths.detail.filterCount", { count: String(candidates.length) })}
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
                ? t("paths.detail.promoteTitleGhost", { name: collection.name })
                : t("paths.detail.promoteTitle", { name: collection.name })
            }
          >
            {isGhost ? t("paths.detail.bringBack") : t("paths.detail.promote")}
          </button>
        )}
        {!isRoot && !isGhost && (
          <button
            onClick={onDelete}
            className="ml-auto text-xs px-2.5 py-1.5 rounded-md border border-bd/70 text-t3 hover:text-danger hover:border-danger/60"
            title={t("paths.detail.deletePathTitle")}
          >
            {t("paths.detail.deletePath")}
          </button>
        )}
        {isRoot && (
          <div className="text-2xs text-t3 italic w-full text-center">
            {t("paths.detail.trunkNote")}
          </div>
        )}
        {isGhost && (
          <div className="ml-auto text-2xs text-t3 italic">
            {t("paths.detail.ghostNote")}
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
  const t = useT();
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
                {tag === "__untagged__" ? t("paths.detail.diffUntagged") : `#${tag}`} <span className="text-t3/70">· {items.length}</span>
              </div>
              <ul className="space-y-0.5">
                {items.slice(0, 5).map(renderRow)}
                {items.length > 5 && (
                  <li className="text-2xs text-t3 italic px-2">
                    {t("paths.detail.diffMore", { count: String(items.length - 5) })}
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
              {t("paths.detail.diffMore", { count: String(rows.length - 5) })}
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

// Eight presets picked to read well on both light and dark themes. Users
// who want something custom can override via the color input underneath.
const COLOR_PRESETS = [
  "#c97a3a", // amber
  "#c43d5b", // crimson
  "#a85cc9", // plum
  "#5c6dc9", // indigo
  "#3a91c9", // azure
  "#3aa890", // teal
  "#68a83a", // moss
  "#7a6b5c", // taupe
];

function AutoTagRow({
  current,
  memberCount,
  onSet,
}: {
  current: string | null;
  memberCount: number;
  onSet: (tag: string | null) => Promise<void> | void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current ?? "");
  useEffect(() => {
    setDraft(current ?? "");
  }, [current]);
  const commit = async () => {
    const next = draft.trim().replace(/^#/, "");
    setEditing(false);
    await onSet(next ? next : null);
  };
  if (!editing && !current) {
    return (
      <div className="mt-2">
        <button
          onClick={() => { setEditing(true); setDraft(""); }}
          className="text-2xs text-t3 hover:text-char italic font-serif transition"
          title={t("paths.detail.autoTagAddTitle")}
        >
          {t("paths.detail.autoTagAdd")}
        </button>
      </div>
    );
  }
  if (!editing && current) {
    return (
      <div className="mt-2 flex items-center gap-2 flex-wrap text-2xs">
        <span className="font-serif italic text-t3">{t("paths.detail.autoIncludes")}</span>
        <span className="px-2 py-0.5 rounded-full bg-yelp text-yeld font-mono text-[10px]">
          #{current}
        </span>
        <span className="font-serif italic text-t3">
          {memberCount === 1
            ? t("paths.detail.autoMatchOne", { count: String(memberCount) })
            : t("paths.detail.autoMatchMany", { count: String(memberCount) })}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-t3 hover:text-char transition"
        >
          {t("paths.detail.change")}
        </button>
        <button
          onClick={() => onSet(null)}
          className="text-t3 hover:text-danger transition"
        >
          {t("paths.detail.clear")}
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="mt-2 flex items-center gap-1.5"
    >
      <span className="text-2xs font-serif italic text-t3">{t("paths.detail.autoLead")}</span>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t("paths.detail.autoTagPlaceholder")}
        className="px-2 py-0.5 bg-s1 border border-bd rounded text-char text-2xs focus:outline-none focus:border-yeld w-[140px]"
      />
      <button
        type="submit"
        className="px-2 py-0.5 bg-char text-bg rounded text-2xs hover:bg-yeld transition"
      >
        {t("paths.detail.autoSave")}
      </button>
      <button
        type="button"
        onClick={() => { setEditing(false); setDraft(current ?? ""); }}
        className="text-2xs text-t3 hover:text-char transition"
      >
        {t("paths.detail.autoCancel")}
      </button>
    </form>
  );
}

function ColorPicker({
  current,
  onPick,
}: {
  current: string | null;
  onPick: (color: string | null) => Promise<void> | void;
}) {
  const t = useT();
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-2xs font-serif italic text-t3">{t("paths.detail.accent")}</span>
      <button
        onClick={() => onPick(null)}
        title={t("paths.detail.accentClearTitle")}
        className={`w-5 h-5 rounded-full border border-bd flex items-center justify-center text-t3 text-[10px] transition ${
          !current ? "ring-2 ring-yeld ring-offset-1 ring-offset-bg" : "hover:border-t2"
        }`}
      >
        ∅
      </button>
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          style={{ background: c }}
          title={c}
          className={`w-5 h-5 rounded-full border border-bd/40 transition ${
            current?.toLowerCase() === c.toLowerCase()
              ? "ring-2 ring-yeld ring-offset-1 ring-offset-bg"
              : "hover:scale-110"
          }`}
          aria-label={t("paths.detail.accentSetAria", { value: c })}
        />
      ))}
      <label className="w-5 h-5 rounded-full border border-dashed border-bd flex items-center justify-center text-t3 cursor-pointer hover:border-t2" title={t("paths.detail.accentCustomTitle")}>
        <input
          type="color"
          value={current ?? "#c97a3a"}
          onChange={(e) => onPick(e.target.value)}
          className="sr-only"
        />
        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M7 2v10M2 7h10"/>
        </svg>
      </label>
    </div>
  );
}
