import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteSummary } from "../../lib/types";
import { prefetchNote } from "../../lib/notePrefetch";
import { tagPillClass } from "../../lib/tagStyles";
import {
  PlusIcon,
  UnlinkIcon,
  ChevronRightIcon,
  RenameIcon,
  DeleteIcon,
} from "../../lib/icons";
import Modal from "../Modal";
import EmptyState from "../EmptyState";
import { useListMode } from "../../lib/listModePrefs";
import { useT } from "../../lib/i18n";

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
  /** 2.1 Folders. Move a note into / out of a folder. `null` clears the
   *  folder. Pure metadata — the file always stays at `notes/<slug>.md`. */
  onMoveToFolder?: (slug: string, folder: string | null) => void;
  /** Workspace path used to scope localStorage state for collapsed-folder
   *  memory. Folders that the user has collapsed in workspace A shouldn't
   *  affect workspace B. */
  workspacePath?: string;
  /** Optional path count for the pinned-active hero card's meta line —
   *  renders as "{N} notes · {M} paths". Omitted when undefined. */
  pathCount?: number;
}

type TimeBucket = "today" | "yesterday" | "week" | "older";

// 2.1 perf. The list-mode row is extracted to a memoized component so
// hover, selection, and active-slug changes only re-render the rows
// whose primitive props actually flipped. Before this, every keystroke
// in the editor (which fans out to NoteList via the parent's debounced
// note refresh) re-reconciled all 100+ rows. Props are intentionally
// primitive — passing the full `NoteSummary` object would defeat
// memoization, since the enclosing `enriched` array is rebuilt every
// render with fresh object identities.
type NoteRowProps = {
  slug: string;
  title: string;
  encrypted: boolean;
  isPrivate: boolean;
  isOrphan: boolean;
  stale: boolean;
  daysOld: number;
  isActive: boolean;
  isMain: boolean;
  isSelected: boolean;
  isRelated: boolean;
  selectMode: boolean;
  pathHighlight: "none" | "in" | "out";
  // Localized labels — passed in so the memoized row stays as a flat
  // primitive-prop component without pulling the i18n hook directly.
  selectLabel: string;
  staleTooltip: string;
  orphanTooltip: string;
  startingTooltip: string;
  encryptedTooltip: string;
  privateTooltip: string;
  unlinkedTooltip: string;
  onPick: (slug: string) => void;
  onContextMenu: (slug: string, x: number, y: number) => void;
  onHoverEnter: (slug: string) => void;
  onHoverLeave: () => void;
  onToggleSelect: (slug: string) => void;
  onDragStartFor: (slug: string, title: string) => (e: React.DragEvent) => void;
};

const NoteRow = memo(function NoteRow({
  slug,
  title,
  encrypted,
  isPrivate,
  isOrphan,
  stale,
  daysOld,
  isActive,
  isMain,
  isSelected,
  isRelated,
  selectMode,
  pathHighlight,
  selectLabel,
  staleTooltip,
  orphanTooltip,
  startingTooltip,
  encryptedTooltip,
  privateTooltip,
  unlinkedTooltip,
  onPick,
  onContextMenu,
  onHoverEnter,
  onHoverLeave,
  onToggleSelect,
  onDragStartFor,
}: NoteRowProps) {
  void daysOld;
  return (
    <li
      data-path-highlight={pathHighlight}
      className="relative flex items-center yarrow-path-hl yarrow-row-island"
      onMouseEnter={() => onHoverEnter(slug)}
      onMouseLeave={onHoverLeave}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(slug)}
          className="ml-2 mr-1 accent-yel shrink-0"
          aria-label={selectLabel}
        />
      )}
      <button
        draggable
        onDragStart={onDragStartFor(slug, title)}
        onClick={() => onPick(slug)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(slug, e.clientX, e.clientY);
        }}
        data-related={isRelated ? "true" : "false"}
        title={
          stale
            ? staleTooltip
            : isOrphan
              ? orphanTooltip
              : undefined
        }
        className={`note-row flex-1 min-w-0 text-left px-4 py-1.5 font-serif text-[14px] leading-snug font-[560] group transition-[background-color,color,box-shadow] duration-150 ${
          isSelected
            ? "bg-yelp/60 text-char"
            : isActive
              ? "bg-yelp text-char"
              : isRelated
                ? "bg-accent2-dim/40 text-ch2"
                : stale
                  ? "text-t2 hover:bg-yelp/25 hover:text-ch2 hover:shadow-[inset_2px_0_0_rgba(227,186,104,0.45)]"
                  : "text-ch2 hover:bg-yelp/25 hover:text-char hover:shadow-[inset_2px_0_0_rgba(227,186,104,0.45)]"
        }`}
        style={
          isMain
            ? { boxShadow: "inset 2px 0 0 0 var(--home-ring)" }
            : undefined
        }
      >
        <div className="flex items-center gap-2">
          {isMain && (
            <span
              className="shrink-0 leading-none"
              style={{ color: "var(--home-ring)", fontSize: 12 }}
              title={startingTooltip}
            >
              ★
            </span>
          )}
          {encrypted && (
            <span className="text-yeld shrink-0" title={encryptedTooltip}>
              <SmallLockIcon />
            </span>
          )}
          {isPrivate && !encrypted && (
            <span
              className="shrink-0 leading-none"
              style={{ color: "#c97a3a", fontSize: 11 }}
              title={privateTooltip}
            >
              ⊘
            </span>
          )}
          <span className={`truncate flex-1 ${isActive || isMain ? "font-medium" : ""}`}>
            {title || slug}
          </span>
          {isOrphan && !isActive && (
            <span
              className="text-t3 opacity-0 group-hover:opacity-100 transition"
              title={unlinkedTooltip}
            >
              <UnlinkIcon />
            </span>
          )}
        </div>
      </button>
    </li>
  );
});

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
  onMoveToFolder,
  workspacePath,
  pathCount,
}: Props) {
  const t = useT();
  const [listMode, setListMode] = useListMode();
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

  // 2.1 Folders. The picker modal opens from "Move to folder…" in the
  // row context menu and from the new "+ New folder" affordance below
  // the bucketed list. State is local; the actual write goes through
  // the parent's `onMoveToFolder` callback (which calls `setNoteFolder`).
  const [folderPicker, setFolderPicker] = useState<{ slug: string } | null>(null);
  // Per-workspace memory of which folders the user has collapsed. Stored
  // in localStorage so a deep-folder-heavy workspace stays scannable on
  // re-open.
  const folderCollapseKey = workspacePath
    ? `yarrow.folderCollapsed.${workspacePath}`
    : null;
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => {
    if (!folderCollapseKey) return new Set();
    try {
      const raw = localStorage.getItem(folderCollapseKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const persistCollapsed = (next: Set<string>) => {
    setCollapsedFolders(new Set(next));
    if (!folderCollapseKey) return;
    try {
      localStorage.setItem(folderCollapseKey, JSON.stringify([...next]));
    } catch {}
  };

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

  // 2.1 Folders. Notes with a folder render in their own collapsible
  // section above the time-based groups; notes without keep flowing
  // into the existing today/week/older buckets exactly as they always
  // did. Pinned notes always show at the top regardless of folder.
  const foldered = rest.filter((n) => !!n.folder);
  const unfoldered = rest.filter((n) => !n.folder);
  const folderGroups = (() => {
    const map = new Map<string, typeof enriched>();
    for (const n of foldered) {
      const key = (n.folder ?? "").trim();
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return [...map.entries()]
      .map(([name, notes]) => ({ name, notes: sortByMTime(notes) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const today = sortByMTime(unfoldered.filter((n) => n.bucket === "today"));
  const yesterday = sortByMTime(unfoldered.filter((n) => n.bucket === "yesterday"));
  const week = sortByMTime(unfoldered.filter((n) => n.bucket === "week"));
  const older = sortByMTime(unfoldered.filter((n) => n.bucket === "older"));

  // "Older" is capped to a preview until the user expands it. Anything
  // over the cap shows as "+ N MORE" on the group header.
  const OLDER_PREVIEW = 3;
  const olderVisible = showAllOlder ? older : older.slice(0, OLDER_PREVIEW);
  const olderHidden = Math.max(0, older.length - OLDER_PREVIEW);

  const activePinned = pinned.find((n) => n.slug === activeSlug) ?? null;
  const otherPinned = activePinned
    ? pinned.filter((n) => n.slug !== activePinned.slug)
    : pinned;

  // Refs so the row callbacks below can read fresh state without
  // listing it as a useCallback dep — without this the callbacks would
  // change identity every render and defeat NoteRow's memoization.
  const activeSlugRef = useRef(activeSlug);
  activeSlugRef.current = activeSlug;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectModeRef = useRef(selectMode);
  selectModeRef.current = selectMode;

  const handleHoverEnter = useCallback((slug: string) => {
    setHoveredSlug(slug);
    if (hoverPrefetchTimer.current) window.clearTimeout(hoverPrefetchTimer.current);
    hoverPrefetchTimer.current = window.setTimeout(() => {
      if (slug !== activeSlugRef.current) prefetchNote(slug);
    }, 120);
  }, []);
  const handleHoverLeave = useCallback(() => {
    setHoveredSlug(null);
    if (hoverPrefetchTimer.current) window.clearTimeout(hoverPrefetchTimer.current);
  }, []);
  const handlePick = useCallback((slug: string) => {
    if (selectModeRef.current) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return next;
      });
      return;
    }
    onSelectRef.current(slug);
  }, []);
  const handleContextMenu = useCallback((slug: string, x: number, y: number) => {
    setMenu({ slug, x, y });
  }, []);
  const handleToggleSelect = useCallback((slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);
  const handleDragStartFor = useCallback(
    (slug: string, title: string) => (e: React.DragEvent) => {
      e.dataTransfer.setData("application/x-yarrow-note", slug);
      e.dataTransfer.setData("text/plain", title || slug);
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  const renderRow = (n: typeof enriched[number]) => {
    const active = n.slug === activeSlug;
    const isMain = !!mainNoteSlug && n.slug === mainNoteSlug;
    const isSelected = selected.has(n.slug);
    const related =
      !active &&
      !!relatedToHovered &&
      hoveredSlug !== n.slug &&
      relatedToHovered.has(n.slug);
    const ph: "none" | "in" | "out" =
      pathHighlight === null
        ? "none"
        : pathHighlight.has(n.slug)
          ? "in"
          : "out";
    return (
      <NoteRow
        key={n.slug}
        slug={n.slug}
        title={n.title || ""}
        encrypted={!!n.encrypted}
        isPrivate={!!n.private}
        isOrphan={n.isOrphan}
        stale={n.stale}
        daysOld={n.daysOld}
        isActive={active}
        isMain={isMain}
        isSelected={isSelected}
        isRelated={related}
        selectMode={selectMode}
        pathHighlight={ph}
        selectLabel={t("sidebar.notes.selectAria", { title: n.title || n.slug })}
        staleTooltip={t("sidebar.notes.staleTooltip", { days: String(n.daysOld) })}
        orphanTooltip={t("sidebar.notes.orphanTooltip")}
        startingTooltip={t("sidebar.notes.starTooltip")}
        encryptedTooltip={t("sidebar.notes.encryptedTooltip")}
        privateTooltip={t("sidebar.notes.privateTooltip")}
        unlinkedTooltip={t("sidebar.notes.unlinkedTooltip")}
        onPick={handlePick}
        onContextMenu={handleContextMenu}
        onHoverEnter={handleHoverEnter}
        onHoverLeave={handleHoverLeave}
        onToggleSelect={handleToggleSelect}
        onDragStartFor={handleDragStartFor}
      />
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
        <span>{t("sidebar.notes.pinned")}</span>
        <span className="text-t3">·</span>
        <span>{t("sidebar.notes.active")}</span>
      </div>
      <div className="font-serif text-[16px] text-char leading-snug mt-1.5 truncate">
        {n.title || n.slug}
      </div>
      <div className="text-[11px] text-t3 font-sans mt-1 font-feature-settings-['tnum']">
        {t(
          notes.length === 1
            ? "sidebar.notes.metaNotesOne"
            : "sidebar.notes.metaNotesMany",
          { count: String(notes.length) },
        )}
        {typeof pathCount === "number" && pathCount > 0
          ? t(
              pathCount === 1
                ? "sidebar.notes.metaPathsOne"
                : "sidebar.notes.metaPathsMany",
              { count: String(pathCount) },
            )
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
        <span>{t("sidebar.notes.pinned")}</span>
      </div>
      <div className="font-serif text-[14.5px] text-ch2 leading-snug mt-1 truncate">
        {n.title || n.slug}
      </div>
    </button>
  );

  // Card Library View (2.1): a stacked-index-card layout for the sidebar
  // note list. The tag-derived accent stripe on the left gives the grid
  // visual rhythm without shouting. Falls back to a neutral wash when a
  // note has no tags.
  const accentFor = (tags: string[] | undefined): string => {
    if (!tags || tags.length === 0) return "var(--bd)";
    const s = tags[0];
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
    const palette = [
      "#C89B3C", "#B85C38", "#3E5C3A", "#4A6E45",
      "#4E7185", "#6D5070", "#C67E8C", "#8A6F3E",
    ];
    return palette[h % palette.length];
  };

  const relTime = (ms: number): string => {
    const dt = now - ms;
    if (dt < 60_000) return t("sidebar.notes.justNow");
    if (dt < 3_600_000)
      return t("sidebar.notes.relMinutes", {
        n: String(Math.floor(dt / 60_000)),
      });
    if (dt < 86_400_000)
      return t("sidebar.notes.relHours", {
        n: String(Math.floor(dt / 3_600_000)),
      });
    const d = Math.floor(dt / 86_400_000);
    if (d < 7) return t("sidebar.notes.relDays", { n: String(d) });
    if (d < 31)
      return t("sidebar.notes.relWeeks", { n: String(Math.floor(d / 7)) });
    return t("sidebar.notes.relMonths", { n: String(Math.floor(d / 30)) });
  };

  const renderCard = (n: typeof enriched[number]) => {
    const active = n.slug === activeSlug;
    const isMain = !!mainNoteSlug && n.slug === mainNoteSlug;
    const isSelected = selected.has(n.slug);
    const accent = accentFor(n.tags);
    return (
      <li
        key={n.slug}
        data-path-highlight={
          pathHighlight === null ? "none" : pathHighlight.has(n.slug) ? "in" : "out"
        }
        className="relative yarrow-path-hl yarrow-card-island"
      >
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
              if (next.has(n.slug)) next.delete(n.slug); else next.add(n.slug);
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
          className={`w-full text-left rounded-lg p-3 pl-4 border transition hover:shadow-[0_6px_18px_-12px_rgba(42,35,28,0.18)] ${
            isSelected
              ? "border-yel bg-yelp/70"
              : active
                ? "border-yel bg-yelp"
                : "border-bd bg-bg hover:bg-s1"
          }`}
          style={{ borderLeft: `3px solid ${accent}` }}
        >
          <div className="flex items-center gap-2 mb-1">
            {selectMode && (
              <span
                className={`w-3 h-3 rounded-sm border ${isSelected ? "bg-yel border-yel" : "border-bd"}`}
              />
            )}
            {isMain && (
              <span className="shrink-0 leading-none" style={{ color: "var(--home-ring)", fontSize: 11 }} title={t("sidebar.notes.startingNote")}>★</span>
            )}
            {n.encrypted && (
              <span className="text-yeld shrink-0" title={t("sidebar.notes.encryptedTooltip")}>
                <SmallLockIcon />
              </span>
            )}
            {n.private && !n.encrypted && (
              <span
                className="shrink-0 leading-none"
                style={{ color: "#c97a3a", fontSize: 11 }}
                title={t("sidebar.notes.privateTooltipShort")}
              >
                ⊘
              </span>
            )}
            {n.pinned && (
              <span className="text-yeld shrink-0" title={t("sidebar.notes.pinned")}><PinIcon /></span>
            )}
            <span className={`truncate flex-1 font-serif text-[14.5px] leading-tight ${active || isMain ? "font-medium text-char" : "text-char"}`}>
              {n.title || n.slug}
            </span>
            <span className="shrink-0 text-2xs text-t3 font-mono">{relTime(n.mTime)}</span>
          </div>
          {n.excerpt && !n.encrypted && (
            <div className="text-xs text-t2 leading-snug line-clamp-3 mt-1">
              {n.excerpt}
            </div>
          )}
          {n.tags && n.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {n.tags.slice(0, 3).map((t) => (
                <span key={t} className={`text-2xs px-1.5 py-px rounded-full font-mono ${tagPillClass(t, "muted")}`}>
                  #{t}
                </span>
              ))}
              {n.tags.length > 3 && (
                <span className="text-2xs text-t3">+{n.tags.length - 3}</span>
              )}
            </div>
          )}
        </button>
      </li>
    );
  };

  const menuNote = menu ? enriched.find((n) => n.slug === menu.slug) : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto overflow-x-hidden yarrow-paint-island yarrow-gpu-scroll">
        {listMode === "list" && activePinned && renderPinnedActiveHero(activePinned)}
        {listMode === "list" && otherPinned.map(renderPinnedOtherHero)}

        {tagFilter && (
          <div className="mx-3 mt-2 mb-1 px-2.5 py-1 text-2xs flex items-center gap-1.5 bg-yelp/60 text-yeld rounded">
            <span>{t("sidebar.notes.filteringPrefix")} <span className="font-mono">#{tagFilter}</span></span>
            <button
              onClick={onClearTagFilter}
              className="ml-auto hover:text-char"
              aria-label={t("sidebar.notes.clearTagFilter")}
            >
              ×
            </button>
          </div>
        )}

        {selectMode && (
          <div className="mx-3 mt-2 mb-1 px-2.5 py-1.5 text-2xs flex items-center gap-2 bg-s2 rounded">
            <span className="text-t2">{t("sidebar.notes.selected", { count: String(selected.size) })}</span>
            <button
              onClick={() => setSelected(new Set(enriched.map((n) => n.slug)))}
              className="text-yeld hover:text-char"
            >
              {t("sidebar.notes.selectAll")}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-t2 hover:text-char"
            >
              {t("sidebar.notes.selectNone")}
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
              {t("sidebar.notes.selectDelete")}
            </button>
          </div>
        )}

        {listMode === "cards" ? (
          enriched.length > 0 && (
            <ul className="flex flex-col gap-2 px-3 pt-3 pb-1">
              {[...pinned, ...today, ...yesterday, ...week, ...olderVisible].map((n) => renderCard(n))}
              {olderHidden > 0 && (
                <li className="text-center pt-1">
                  <button
                    onClick={() => setShowAllOlder((x) => !x)}
                    className="text-[10px] uppercase tracking-[0.16em] text-t3 font-sans font-semibold hover:text-ch2 transition"
                  >
                    {showAllOlder
                      ? t("sidebar.notes.olderCollapse")
                      : t("sidebar.notes.olderShow", { n: String(olderHidden) })}
                  </button>
                </li>
              )}
            </ul>
          )
        ) : (
          <>
            {/* 2.1 Folders. Render before the time-based buckets so the
                user's organized notes are surfaced first. Each header
                is a click target that toggles collapse; the chevron
                rotates to communicate state. Notes assigned to a
                folder appear ONLY in their folder — they're filtered
                out of the time-based groups below. */}
            {folderGroups.map((g) => {
              const collapsed = collapsedFolders.has(g.name);
              const toggle = () => {
                const next = new Set(collapsedFolders);
                if (collapsed) next.delete(g.name);
                else next.add(g.name);
                persistCollapsed(next);
              };
              return (
                <section key={`folder:${g.name}`}>
                  <button
                    type="button"
                    onClick={toggle}
                    className="w-full px-4 pt-4 pb-1 flex items-baseline justify-between text-left group"
                    aria-expanded={!collapsed}
                  >
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-t3 font-sans font-semibold group-hover:text-ch2 transition">
                      <span
                        className="inline-block transition-transform duration-150"
                        style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                      >
                        ▾
                      </span>
                      <span>{g.name}</span>
                      <span className="font-mono text-[10px] text-t3 normal-case tracking-normal">
                        {g.notes.length}
                      </span>
                    </span>
                  </button>
                  {!collapsed && g.notes.map((n) => renderRow(n))}
                </section>
              );
            })}
            {renderGroup(t("sidebar.notes.groupToday"), today)}
            {renderGroup(t("sidebar.notes.groupYesterday"), yesterday)}
            {renderGroup(t("sidebar.notes.groupLastWeek"), week)}
            {older.length > 0 && renderGroup(
              t("sidebar.notes.groupOlder"),
              olderVisible,
              olderHidden > 0
                ? {
                    text: showAllOlder
                      ? t("sidebar.notes.olderCollapse")
                      : t("sidebar.notes.olderMore", { n: String(olderHidden) }),
                    onClick: () => setShowAllOlder((x) => !x),
                  }
                : undefined,
            )}
          </>
        )}

        {enriched.length === 0 && (
          tagFilter ? (
            <EmptyState
              kind="notes-filtered"
              hint={t("sidebar.notes.emptyFilteredHint", { tag: tagFilter })}
              action={onClearTagFilter ? { label: t("sidebar.notes.clearFilter"), onClick: onClearTagFilter } : undefined}
              size="tight"
            />
          ) : (
            <EmptyState
              kind="notes"
              action={{ label: t("sidebar.notes.newNote"), onClick: onCreate }}
              size="tight"
            />
          )
        )}

        {orphanCount > 0 && (
          <div className="mx-3 mt-4 mb-2">
            <button
              onClick={() => setShowOrphans((x) => !x)}
              className="w-full text-left px-2 py-1.5 text-2xs text-t3 hover:text-t2 flex items-center gap-1 transition"
              title={t("sidebar.notes.orphansTitle")}
            >
              <span
                className="inline-flex items-center transition-transform"
                style={{ transform: showOrphans ? "rotate(90deg)" : "none" }}
              >
                <ChevronRightIcon />
              </span>
              <span>
                {t(
                  orphanCount === 1
                    ? "sidebar.notes.orphansOne"
                    : "sidebar.notes.orphansMany",
                  { count: String(orphanCount) },
                )}
              </span>
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
          {t(
            notes.length === 1
              ? "sidebar.notes.footerCountOne"
              : "sidebar.notes.footerCountMany",
            { count: String(notes.length) },
          )}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setListMode(listMode === "list" ? "cards" : "list")}
            className="text-t3 hover:text-ch2 transition"
            title={listMode === "list" ? t("sidebar.notes.viewSwitchToCards") : t("sidebar.notes.viewSwitchToList")}
            aria-label={listMode === "list" ? t("sidebar.notes.viewCards") : t("sidebar.notes.viewList")}
          >
            {listMode === "list" ? <CardViewIcon /> : <ListViewIcon />}
          </button>
          <button
            onClick={() => setSelectMode((x) => !x)}
            className={`text-[11px] transition ${selectMode ? "text-yeld" : "text-t3 hover:text-ch2"}`}
            title={selectMode ? t("sidebar.notes.exitMultiSelect") : t("sidebar.notes.enterMultiSelect")}
          >
            {selectMode ? t("sidebar.notes.selectModeDone") : t("sidebar.notes.selectMode")}
          </button>
          <button
            onClick={onCreate}
            className="flex items-center gap-1 text-t2 hover:text-char transition"
            aria-label={t("sidebar.notes.newAria")}
          >
            <PlusIcon size={11} />
            <span>{t("sidebar.notes.newShort")}</span>
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
            <PinIcon /> {menuNote.pinned ? t("sidebar.notes.menuUnpin") : t("sidebar.notes.menuPin")}
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
            onClick={() => {
              setRenameState({ slug: menuNote.slug, title: menuNote.title });
              setMenu(null);
            }}
          >
            <RenameIcon /> {t("sidebar.notes.menuRename")}
          </button>
          {onCopyAsMarkdown && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
              onClick={() => {
                onCopyAsMarkdown(menuNote.slug);
                setMenu(null);
              }}
            >
              <CopyMdIcon /> {t("sidebar.notes.menuCopyMd")}
            </button>
          )}
          {onMoveToFolder && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
              onClick={() => {
                setFolderPicker({ slug: menuNote.slug });
                setMenu(null);
              }}
            >
              <FolderIcon /> {t("sidebar.notes.menuMoveToFolder")}
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
              <RevealIcon /> {t("sidebar.notes.menuReveal")}
            </button>
          )}
          {encryptionEnabled && (
            menuNote.encrypted ? (
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                disabled={!encryptionUnlocked}
                title={!encryptionUnlocked ? t("sidebar.notes.menuUnlockHint") : undefined}
                onClick={() => {
                  onDecryptNote?.(menuNote.slug);
                  setMenu(null);
                }}
              >
                <SmallLockIcon /> {t("sidebar.notes.menuDecrypt")}
              </button>
            ) : (
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                disabled={!encryptionUnlocked}
                title={!encryptionUnlocked ? t("sidebar.notes.menuUnlockHint") : undefined}
                onClick={() => {
                  onEncryptNote?.(menuNote.slug);
                  setMenu(null);
                }}
              >
                <SmallLockIcon /> {t("sidebar.notes.menuEncrypt")}
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
            <DeleteIcon /> {t("sidebar.notes.menuDelete")}
          </button>
        </div>
      )}

      <Modal
        open={!!renameState}
        onClose={() => setRenameState(null)}
        title={t("sidebar.notes.renameTitle")}
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
            {t("sidebar.notes.renameCancel")}
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
            {t("sidebar.notes.renameAction")}
          </button>
        </div>
      </Modal>

      {folderPicker && onMoveToFolder && (
        <FolderPickerModal
          slug={folderPicker.slug}
          currentFolder={
            notes.find((n) => n.slug === folderPicker.slug)?.folder ?? null
          }
          existingFolders={[
            ...new Set(
              notes.map((n) => n.folder).filter((f): f is string => !!f),
            ),
          ].sort()}
          onPick={(folder) => {
            onMoveToFolder(folderPicker.slug, folder);
            setFolderPicker(null);
          }}
          onClose={() => setFolderPicker(null)}
        />
      )}
    </div>
  );
}

function FolderPickerModal({
  slug,
  currentFolder,
  existingFolders,
  onPick,
  onClose,
}: {
  slug: string;
  currentFolder: string | null;
  existingFolders: string[];
  onPick: (folder: string | null) => void;
  onClose: () => void;
}) {
  void slug;
  const t = useT();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const commitNew = () => {
    const trimmed = newName.trim();
    // Strip slashes so a name like "research/papers" can't get mistaken
    // for a nested folder later — the v2.1 model is flat. Empty after
    // strip → nothing to do.
    const cleaned = trimmed.replace(/\//g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    onPick(cleaned);
  };

  return (
    <Modal open onClose={onClose} title={t("sidebar.folders.title")} width="w-[360px]">
      <p className="text-xs text-t2 mb-3 leading-relaxed">
        {t("sidebar.folders.intro")}
        <span className="font-mono">.md</span>
        {t("sidebar.folders.introMd")}
        <span className="font-mono">notes/</span>
        {t("sidebar.folders.introTrail")}
      </p>
      <div className="max-h-[260px] overflow-y-auto -mx-1">
        <button
          onClick={() => onPick(null)}
          className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center gap-2 hover:bg-s2 ${
            currentFolder === null ? "bg-s2 text-char" : "text-t2"
          }`}
        >
          <span className="text-t3">↻</span>
          <span>{t("sidebar.folders.none")}</span>
        </button>
        {existingFolders.map((f) => {
          const active = f === currentFolder;
          return (
            <button
              key={f}
              onClick={() => onPick(f)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center gap-2 hover:bg-s2 ${
                active ? "bg-yelp text-char" : "text-ch2"
              }`}
            >
              <FolderIcon />
              <span className="truncate">{f}</span>
              {active && <span className="ml-auto text-2xs text-t3">{t("sidebar.folders.current")}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-bd">
        {creating ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNew();
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
              placeholder={t("sidebar.folders.namePlaceholder")}
              className="flex-1 px-3 py-1.5 bg-bg border border-bd rounded-md text-sm text-char"
            />
            <button
              onClick={commitNew}
              disabled={!newName.trim()}
              className="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-50"
            >
              {t("sidebar.folders.create")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="text-xs text-yeld hover:text-char flex items-center gap-1.5"
          >
            <PlusIcon size={11} /> {t("sidebar.folders.newFolder")}
          </button>
        )}
      </div>
    </Modal>
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

function FolderIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 4V3a1 1 0 0 1 1-1h2.5l1 1.2H9.5a1 1 0 0 1 1 1V4" />
      <rect x="1.5" y="4" width="9" height="6" rx="1" />
    </svg>
  );
}

function CardViewIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
      <rect x="1.5" y="2" width="9" height="3" rx="0.8" />
      <rect x="1.5" y="7" width="9" height="3" rx="0.8" />
    </svg>
  );
}

function ListViewIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <line x1="2" y1="3.5" x2="10" y2="3.5" />
      <line x1="2" y1="6"   x2="10" y2="6" />
      <line x1="2" y1="8.5" x2="10" y2="8.5" />
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
