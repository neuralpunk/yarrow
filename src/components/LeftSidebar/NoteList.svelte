<script lang="ts">
  import { tick, onDestroy } from "svelte";
  import type { NoteSummary } from "../../lib/types";
  import { prefetchNote } from "../../lib/notePrefetch";
  import { tagPillClass } from "../../lib/tagStyles";
  import {
    PlusIcon,
    UnlinkIcon,
    ChevronRightIcon,
    RenameIcon,
    DeleteIcon,
    SelectModeIcon,
    NewFolderIcon,
    ChevronUpIcon,
    NoteIcon,
  } from "../../lib/iconsSvelte";
  import Modal from "../Modal.svelte";
  import EmptyState from "../EmptyState.svelte";
  import { listMode as listModeStore } from "../../lib/listModePrefs.svelte";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    notes: NoteSummary[];
    activeSlug: string | null;
    mainNoteSlug?: string | null;
    orphans: Set<string>;
    decayDays: number;
    onSelect: (slug: string) => void;
    onOpenInNewTab?: (slug: string) => void;
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
    onMoveToFolder?: (slug: string, folder: string | null) => void;
    workspacePath?: string;
    workspaceName?: string;
    pathCount?: number;
  }

  let {
    notes,
    activeSlug,
    mainNoteSlug,
    orphans,
    decayDays,
    onSelect,
    onOpenInNewTab,
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
    workspaceName,
    pathCount,
  }: Props = $props();

  let t = $derived(tr());
  let listModeId = $derived(listModeStore.id);

  let menu = $state<{ slug: string; x: number; y: number } | null>(null);
  let menuRef = $state<HTMLDivElement | null>(null);
  let menuPos = $state<{ x: number; y: number }>({ x: 0, y: 0 });

  $effect(() => {
    if (!menu) return;
    tick().then(() => {
      const el = menuRef;
      const margin = 6;
      const w = el?.offsetWidth ?? 176;
      const h = el?.offsetHeight ?? 280;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = menu!.x;
      let y = menu!.y;
      if (x + w + margin > vw) x = Math.max(margin, vw - w - margin);
      if (y + h + margin > vh) y = Math.max(margin, vh - h - margin);
      menuPos = { x, y };
    });
  });

  let showOrphans = $state(false);
  let hoverPrefetchTimer: number | null = null;
  let renameState = $state<{ slug: string; title: string } | null>(null);
  let selectMode = $state(false);
  let selected = $state<Set<string>>(new Set());
  let showAllOlder = $state(false);
  let folderPicker = $state<{ slug: string } | null>(null);

  // FolderPickerModal local state
  let folderCreating = $state(false);
  let folderNewName = $state("");

  // +New drop-up menu + its sibling "New folder" modal
  let createMenuOpen = $state(false);
  let newFolderModalOpen = $state(false);
  let newFolderName = $state("");

  let folderCollapseKey = $derived(workspacePath ? `yarrow.folderCollapsed.${workspacePath}` : null);
  // Folders are pure sidebar metadata derived from notes' frontmatter,
  // so an empty folder has no on-disk representation. To let users
  // create a folder ahead of putting any notes in it, we keep a
  // workspace-scoped list of "pending empty folder names" in
  // localStorage and splice them into folderGroups (with notes: []).
  // Once any note is moved into a pending folder, it disappears from
  // this list — the real folder takes over.
  let emptyFoldersKey = $derived(workspacePath ? `yarrow.emptyFolders.${workspacePath}` : null);

  // svelte-ignore state_referenced_locally
  let collapsedFolders = $state<Set<string>>(loadCollapsedFolders(folderCollapseKey));
  // svelte-ignore state_referenced_locally
  let pendingEmptyFolders = $state<string[]>(loadEmptyFolders(emptyFoldersKey));
  function loadCollapsedFolders(key: string | null): Set<string> {
    if (!key) return new Set();
    try {
      const raw = localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  }
  function loadEmptyFolders(key: string | null): string[] {
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  $effect(() => {
    void workspacePath;
    collapsedFolders = loadCollapsedFolders(folderCollapseKey);
    pendingEmptyFolders = loadEmptyFolders(emptyFoldersKey);
  });

  function persistCollapsed(next: Set<string>) {
    collapsedFolders = new Set(next);
    if (!folderCollapseKey) return;
    try {
      localStorage.setItem(folderCollapseKey, JSON.stringify([...next]));
    } catch {}
  }
  function persistEmptyFolders(next: string[]) {
    pendingEmptyFolders = [...next];
    if (!emptyFoldersKey) return;
    try {
      localStorage.setItem(emptyFoldersKey, JSON.stringify(next));
    } catch {}
  }

  $effect(() => {
    if (!menu) return;
    const close = () => (menu = null);
    // Defer the click-close registration by a tick. macOS WebKit emits
    // a `click` event after Ctrl+Click (alongside `contextmenu`), and
    // without this defer that click would close the menu the same beat
    // it opened. The user had to keep Ctrl held to keep the menu alive.
    const timer = window.setTimeout(() => {
      window.addEventListener("click", close);
    }, 0);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  });

  $effect(() => {
    if (!createMenuOpen) return;
    const close = () => (createMenuOpen = false);
    // Defer one tick — otherwise the click that opened the menu also
    // closes it on the same event.
    const timer = window.setTimeout(() => {
      window.addEventListener("click", close);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("click", close);
    };
  });

  $effect(() => {
    if (!selectMode) selected = new Set();
  });

  let pathHighlight = $state<Set<string> | null>(null);
  $effect(() => {
    const onHighlight = (ev: Event) => {
      const detail = (ev as CustomEvent<{ slugs: string[] | null }>).detail;
      if (!detail || !detail.slugs) {
        pathHighlight = null;
        return;
      }
      pathHighlight = new Set(detail.slugs);
    };
    window.addEventListener("yarrow:path-highlight", onHighlight as EventListener);
    return () => window.removeEventListener("yarrow:path-highlight", onHighlight as EventListener);
  });

  let orphanCount = $derived(orphans.size);
  // Reactive clock. NoteList persists for the entire session; if `now`
  // were a plain `let`, the time buckets ("Today / Yesterday / This
  // week") and the decay-cutoff would freeze at component init and
  // start lying after midnight (or after the user leaves the app open
  // for a few hours). Refresh on a coarse 5-minute interval so the
  // buckets re-evaluate without paying for a derived re-run on every
  // animation frame.
  let now = $state(Date.now());
  $effect(() => {
    const id = window.setInterval(() => { now = Date.now(); }, 300_000);
    return () => window.clearInterval(id);
  });
  let decayCutoff = $derived(now - decayDays * 86400 * 1000);

  let bucketBounds = $derived.by(() => {
    // Read `now` so the derived re-evaluates whenever the tick fires
    // — without it, the day-boundary calc wouldn't advance.
    void now;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tt = today.getTime();
    return {
      startOfToday: tt,
      startOfYesterday: tt - 86400 * 1000,
      startOf7DaysAgo: tt - 7 * 86400 * 1000,
    };
  });

  type TimeBucket = "today" | "yesterday" | "week" | "older";

  let enriched = $derived.by(() => {
    return notes.map((n) => {
      const mTime = n.modified ? new Date(n.modified).getTime() : now;
      const stale = mTime < decayCutoff;
      const daysOld = Math.floor((now - mTime) / (86400 * 1000));
      const isOrphan = orphans.has(n.slug);
      const bucket: TimeBucket =
        mTime >= bucketBounds.startOfToday ? "today"
        : mTime >= bucketBounds.startOfYesterday ? "yesterday"
        : mTime >= bucketBounds.startOf7DaysAgo ? "week"
        : "older";
      return { ...n, mTime, stale, daysOld, isOrphan, bucket };
    });
  });

  function sortByMTime<T extends { mTime: number }>(arr: T[]): T[] {
    return arr.slice().sort((a, b) => b.mTime - a.mTime);
  }

  let pinned = $derived(sortByMTime(enriched.filter((n) => n.pinned)));
  let rest = $derived(enriched.filter((n) => !n.pinned));
  let foldered = $derived(rest.filter((n) => !!n.folder));
  let unfoldered = $derived(rest.filter((n) => !n.folder));

  let folderGroups = $derived.by(() => {
    const map = new Map<string, typeof enriched>();
    for (const n of foldered) {
      const key = (n.folder ?? "").trim();
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    // Splice in pending empty folders that don't yet have any notes.
    for (const f of pendingEmptyFolders) {
      const key = f.trim();
      if (!key || map.has(key)) continue;
      map.set(key, []);
    }
    return [...map.entries()]
      .map(([name, ns]) => ({ name, notes: sortByMTime(ns) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // Once a pending folder gets any note in it, the real folder takes
  // over — drop the pending entry so we don't keep shadow-spawning it.
  $effect(() => {
    if (pendingEmptyFolders.length === 0) return;
    const realFolders = new Set(
      notes.map((n) => (n.folder ?? "").trim()).filter((f) => !!f),
    );
    const stillPending = pendingEmptyFolders.filter((f) => !realFolders.has(f));
    if (stillPending.length !== pendingEmptyFolders.length) {
      persistEmptyFolders(stillPending);
    }
  });

  let today = $derived(sortByMTime(unfoldered.filter((n) => n.bucket === "today")));
  let yesterday = $derived(sortByMTime(unfoldered.filter((n) => n.bucket === "yesterday")));
  let week = $derived(sortByMTime(unfoldered.filter((n) => n.bucket === "week")));
  let older = $derived(sortByMTime(unfoldered.filter((n) => n.bucket === "older")));
  const OLDER_PREVIEW = 3;
  let olderVisible = $derived(showAllOlder ? older : older.slice(0, OLDER_PREVIEW));
  let olderHidden = $derived(Math.max(0, older.length - OLDER_PREVIEW));

  let activePinned = $derived(pinned.find((n) => n.slug === activeSlug) ?? null);
  let otherPinned = $derived(activePinned ? pinned.filter((n) => n.slug !== activePinned!.slug) : pinned);

  function isHomeNote(n: { slug: string; title: string | null }): boolean {
    if (mainNoteSlug && n.slug === mainNoteSlug) return true;
    if (workspaceName) {
      const a = (n.title || "").trim().toLowerCase();
      const b = workspaceName.trim().toLowerCase();
      if (a && a === b) return true;
    }
    return false;
  }

  function accentFor(tags: string[] | undefined): string {
    if (!tags || tags.length === 0) return "var(--bd)";
    const s = tags[0];
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
    const palette = [
      "#C89B3C", "#B85C38", "#3E5C3A", "#4A6E45",
      "#4E7185", "#6D5070", "#C67E8C", "#8A6F3E",
    ];
    return palette[h % palette.length];
  }

  function relTime(ms: number): string {
    const dt = now - ms;
    if (dt < 60_000) return t("sidebar.notes.justNow");
    if (dt < 3_600_000) return t("sidebar.notes.relMinutes", { n: String(Math.floor(dt / 60_000)) });
    if (dt < 86_400_000) return t("sidebar.notes.relHours", { n: String(Math.floor(dt / 3_600_000)) });
    const d = Math.floor(dt / 86_400_000);
    if (d < 7) return t("sidebar.notes.relDays", { n: String(d) });
    if (d < 31) return t("sidebar.notes.relWeeks", { n: String(Math.floor(d / 7)) });
    return t("sidebar.notes.relMonths", { n: String(Math.floor(d / 30)) });
  }

  function pickRow(slug: string) {
    if (selectMode) {
      const next = new Set(selected);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      selected = next;
      return;
    }
    onSelect(slug);
  }

  function toggleSelect(slug: string) {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    selected = next;
  }

  function rowDragStart(e: DragEvent, slug: string, title: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData("application/x-yarrow-note", slug);
    e.dataTransfer.setData("text/plain", title || slug);
    e.dataTransfer.effectAllowed = "copy";
  }

  function hoverEnter(slug: string) {
    if (hoverPrefetchTimer) window.clearTimeout(hoverPrefetchTimer);
    hoverPrefetchTimer = window.setTimeout(() => {
      hoverPrefetchTimer = null;
      if (slug !== activeSlug) prefetchNote(slug);
    }, 120);
  }
  function hoverLeave() {
    if (hoverPrefetchTimer) {
      window.clearTimeout(hoverPrefetchTimer);
      hoverPrefetchTimer = null;
    }
  }
  onDestroy(() => {
    // The hover-prefetch timer fires 120 ms after a row enters; if the
    // user navigates away (workspace switch, sidebar collapse) within
    // that window, the pending timer would otherwise call
    // `prefetchNote` against a torn-down sidebar instance.
    if (hoverPrefetchTimer) {
      window.clearTimeout(hoverPrefetchTimer);
      hoverPrefetchTimer = null;
    }
  });

  let menuNote = $derived(menu ? enriched.find((n) => n.slug === menu!.slug) ?? null : null);

  function commitFolderNew() {
    const trimmed = folderNewName.trim();
    const cleaned = trimmed.replace(/\//g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned || !folderPicker || !onMoveToFolder) return;
    onMoveToFolder(folderPicker.slug, cleaned);
    folderPicker = null;
    folderCreating = false;
    folderNewName = "";
  }

  function commitNewFolder() {
    const cleaned = newFolderName.trim().replace(/\//g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    const realFolders = new Set(
      notes.map((n) => (n.folder ?? "").trim()).filter((f) => !!f),
    );
    if (!realFolders.has(cleaned) && !pendingEmptyFolders.includes(cleaned)) {
      persistEmptyFolders([...pendingEmptyFolders, cleaned]);
    }
    newFolderModalOpen = false;
    newFolderName = "";
  }
  function cancelNewFolder() {
    newFolderModalOpen = false;
    newFolderName = "";
  }

  function pickFolder(folder: string | null) {
    if (!folderPicker || !onMoveToFolder) return;
    onMoveToFolder(folderPicker.slug, folder);
    folderPicker = null;
  }

  let existingFolders = $derived(
    [
      ...new Set(
        notes.map((n) => n.folder).filter((f): f is string => !!f),
      ),
    ].sort(),
  );
  let folderPickerCurrent = $derived(
    folderPicker ? notes.find((n) => n.slug === folderPicker!.slug)?.folder ?? null : null,
  );
</script>

{#snippet smallLockIcon()}
  <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.5" y="6.5" width="9" height="6" rx="1.2" />
    <path d="M4.5 6.5V4.5a2.5 2.5 0 1 1 5 0v2" />
  </svg>
{/snippet}

{#snippet pinIcon()}
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 1.5v5.5" />
    <path d="M3 2h6" />
    <path d="M4 7h4l-.5 2h-3L4 7z" />
    <path d="M6 9v2" />
  </svg>
{/snippet}

{#snippet copyMdIcon()}
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="3.5" width="6.5" height="7" rx="1" />
    <path d="M2 8V2.5A1 1 0 0 1 3 1.5h5" />
  </svg>
{/snippet}

{#snippet folderIcon()}
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 4V3a1 1 0 0 1 1-1h2.5l1 1.2H9.5a1 1 0 0 1 1 1V4" />
    <rect x="1.5" y="4" width="9" height="6" rx="1" />
  </svg>
{/snippet}

{#snippet cardViewIcon()}
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">
    <rect x="1.5" y="2" width="9" height="3" rx="0.8" />
    <rect x="1.5" y="7" width="9" height="3" rx="0.8" />
  </svg>
{/snippet}

{#snippet listViewIcon()}
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
    <line x1="2" y1="3.5" x2="10" y2="3.5" />
    <line x1="2" y1="6"   x2="10" y2="6" />
    <line x1="2" y1="8.5" x2="10" y2="8.5" />
  </svg>
{/snippet}

{#snippet revealIcon()}
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 4a1 1 0 0 1 1-1h2.2l1 1.2H9.5a1 1 0 0 1 1 1v3.8a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V4Z" />
    <path d="M6 6v2M4.8 7H7.2" />
  </svg>
{/snippet}

{#snippet newTabIcon()}
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.5" y="2.5" width="9" height="7" rx="1.2" />
    <line x1="6" y1="4.5" x2="6" y2="7.5" />
    <line x1="4.5" y1="6" x2="7.5" y2="6" />
  </svg>
{/snippet}

{#snippet noteRow(n: typeof enriched[number])}
  {@const active = n.slug === activeSlug}
  {@const isMain = !!mainNoteSlug && n.slug === mainNoteSlug}
  {@const isSelected = selected.has(n.slug)}
  {@const ph = pathHighlight === null ? "none" : pathHighlight.has(n.slug) ? "in" : "out"}
  <li
    data-path-highlight={ph}
    class="relative flex items-center yarrow-path-hl yarrow-row-island"
    onmouseenter={() => hoverEnter(n.slug)}
    onmouseleave={hoverLeave}
    role="presentation"
  >
    {#if selectMode}
      <input
        type="checkbox"
        checked={isSelected}
        onchange={() => toggleSelect(n.slug)}
        class="ml-2 mr-1 accent-yel shrink-0"
        aria-label={t("sidebar.notes.selectAria", { title: n.title || n.slug })}
      />
    {/if}
    <button
      type="button"
      draggable="true"
      ondragstart={(e) => rowDragStart(e, n.slug, n.title || "")}
      onclick={() => pickRow(n.slug)}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        menu = { slug: n.slug, x: e.clientX, y: e.clientY };
      }}
      title={n.stale
        ? t("sidebar.notes.staleTooltip", { days: String(n.daysOld) })
        : n.isOrphan
          ? t("sidebar.notes.orphanTooltip")
          : undefined}
      class="note-row flex-1 min-w-0 text-left px-4 py-1.5 font-serif text-[14px] leading-snug font-[560] group transition-[background-color,color,box-shadow] duration-150 {isSelected
        ? 'bg-yelp/60 text-char'
        : active
          ? 'bg-black/[0.07] dark:bg-black/32 text-char shadow-[inset_3px_0_0_var(--yel)]'
          : n.stale
            ? 'text-t2 hover:bg-s3 hover:text-ch2 hover:shadow-[inset_3px_0_0_var(--yel)]'
            : 'text-ch2 hover:bg-s3 hover:text-char hover:shadow-[inset_3px_0_0_var(--yel)]'}"
      style={isMain ? "box-shadow: inset 2px 0 0 0 var(--home-ring);" : undefined}
    >
      <div class="flex items-center gap-2">
        {#if isMain}
          <span class="shrink-0 leading-none" style:color="var(--home-ring)" style:font-size="12px" title={t("sidebar.notes.starTooltip")}>★</span>
        {/if}
        {#if n.encrypted}
          <span class="text-yeld shrink-0" title={t("sidebar.notes.encryptedTooltip")}>{@render smallLockIcon()}</span>
        {/if}
        {#if n.private && !n.encrypted}
          <span class="shrink-0 leading-none" style:color="#c97a3a" style:font-size="11px" title={t("sidebar.notes.privateTooltip")}>⊘</span>
        {/if}
        <span class="truncate flex-1 {active || isMain ? 'font-medium' : ''}">
          {n.title || n.slug}
        </span>
        {#if n.isOrphan && !active}
          <span class="text-t3 opacity-0 group-hover:opacity-100 transition" title={t("sidebar.notes.unlinkedTooltip")}>
            <UnlinkIcon />
          </span>
        {/if}
      </div>
    </button>
  </li>
{/snippet}

{#snippet groupHeader(label: string, trailing: { text: string; onClick: () => void } | null)}
  <div class="px-4 pt-4 pb-1 flex items-baseline justify-between">
    <span class="text-[10px] uppercase tracking-[0.16em] text-t3 font-sans font-semibold">{label}</span>
    {#if trailing}
      <button
        type="button"
        onclick={trailing.onClick}
        class="text-[10px] uppercase tracking-[0.16em] text-t3 font-sans font-semibold hover:text-ch2 transition"
      >
        {trailing.text}
      </button>
    {/if}
  </div>
{/snippet}

{#snippet group(label: string, rows: typeof enriched, trailing: { text: string; onClick: () => void } | null)}
  {#if rows.length > 0 || trailing}
    {@render groupHeader(label, trailing)}
    <ul class="flex flex-col">
      {#each rows as n (n.slug)}
        {@render noteRow(n)}
      {/each}
    </ul>
  {/if}
{/snippet}

{#snippet pinnedActiveHero(n: typeof enriched[number])}
  {@const home = isHomeNote(n)}
  <button
    type="button"
    onclick={() => onSelect(n.slug)}
    oncontextmenu={(e) => {
      e.preventDefault();
      e.stopPropagation();
      menu = { slug: n.slug, x: e.clientX, y: e.clientY };
    }}
    class="text-left mx-3 mt-3 mb-1 px-4 py-3 rounded-lg bg-yelp/50 border border-yel/40 hover:bg-yelp/70 transition block w-[calc(100%-1.5rem)]"
  >
    <div class="text-[9px] uppercase tracking-[0.2em] text-yeld font-sans font-semibold flex items-center gap-1.5">
      {@render pinIcon()}
      <span>{home ? t("sidebar.notes.homeNote") : t("sidebar.notes.pinned")}</span>
      <span class="text-t3">·</span>
      <span>{t("sidebar.notes.active")}</span>
    </div>
    <div class="font-serif text-[16px] text-char leading-snug mt-1.5 truncate" title={n.title || n.slug}>
      {home ? t("sidebar.notes.homeNoteOpenLabel") : (n.title || n.slug)}
    </div>
    <div class="text-[11px] text-t3 font-sans mt-1 font-feature-settings-['tnum']">
      {t(notes.length === 1 ? "sidebar.notes.metaNotesOne" : "sidebar.notes.metaNotesMany", { count: String(notes.length) })}
      {typeof pathCount === "number" && pathCount > 0
        ? t(pathCount === 1 ? "sidebar.notes.metaPathsOne" : "sidebar.notes.metaPathsMany", { count: String(pathCount) })
        : ""}
    </div>
  </button>
{/snippet}

{#snippet pinnedOtherHero(n: typeof enriched[number])}
  {@const home = isHomeNote(n)}
  <button
    type="button"
    onclick={() => onSelect(n.slug)}
    oncontextmenu={(e) => {
      e.preventDefault();
      e.stopPropagation();
      menu = { slug: n.slug, x: e.clientX, y: e.clientY };
    }}
    class="text-left mx-3 mb-1 px-4 py-2.5 rounded-lg bg-s1 border border-bd hover:bg-s2 transition block w-[calc(100%-1.5rem)]"
  >
    <div class="text-[9px] uppercase tracking-[0.2em] text-t3 font-sans font-semibold flex items-center gap-1.5">
      {@render pinIcon()}
      <span>{home ? t("sidebar.notes.homeNote") : t("sidebar.notes.pinned")}</span>
    </div>
    <div class="font-serif text-[14.5px] text-ch2 leading-snug mt-1 truncate" title={n.title || n.slug}>
      {home ? t("sidebar.notes.homeNoteOpenLabel") : (n.title || n.slug)}
    </div>
  </button>
{/snippet}

{#snippet card(n: typeof enriched[number])}
  {@const active = n.slug === activeSlug}
  {@const isMain = !!mainNoteSlug && n.slug === mainNoteSlug}
  {@const isSelected = selected.has(n.slug)}
  {@const accent = accentFor(n.tags)}
  {@const ph = pathHighlight === null ? "none" : pathHighlight.has(n.slug) ? "in" : "out"}
  <li data-path-highlight={ph} class="relative yarrow-path-hl yarrow-card-island">
    <button
      type="button"
      draggable="true"
      ondragstart={(e) => rowDragStart(e, n.slug, n.title || "")}
      onclick={() => pickRow(n.slug)}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        menu = { slug: n.slug, x: e.clientX, y: e.clientY };
      }}
      onmouseenter={() => hoverEnter(n.slug)}
      onmouseleave={hoverLeave}
      class="w-full text-left rounded-lg p-3 pl-4 border transition hover:shadow-[0_6px_18px_-12px_rgba(42,35,28,0.18)] {isSelected ? 'border-yel bg-yelp/70' : active ? 'border-yel bg-yelp' : 'border-bd bg-bg hover:bg-s1'}"
      style:border-left="3px solid {accent}"
    >
      <div class="flex items-center gap-2 mb-1">
        {#if selectMode}
          <span class="w-3 h-3 rounded-xs border {isSelected ? 'bg-yel border-yel' : 'border-bd'}"></span>
        {/if}
        {#if isMain}
          <span class="shrink-0 leading-none" style:color="var(--home-ring)" style:font-size="11px" title={t("sidebar.notes.startingNote")}>★</span>
        {/if}
        {#if n.encrypted}
          <span class="text-yeld shrink-0" title={t("sidebar.notes.encryptedTooltip")}>{@render smallLockIcon()}</span>
        {/if}
        {#if n.private && !n.encrypted}
          <span class="shrink-0 leading-none" style:color="#c97a3a" style:font-size="11px" title={t("sidebar.notes.privateTooltipShort")}>⊘</span>
        {/if}
        {#if n.pinned}
          <span class="text-yeld shrink-0" title={t("sidebar.notes.pinned")}>{@render pinIcon()}</span>
        {/if}
        <span class="truncate flex-1 font-serif text-[14.5px] leading-tight {active || isMain ? 'font-medium text-char' : 'text-char'}" title={n.title || n.slug}>
          {n.title || n.slug}
        </span>
        <span class="shrink-0 text-2xs text-t3 font-mono">{relTime(n.mTime)}</span>
      </div>
      {#if n.excerpt && !n.encrypted}
        <div class="text-xs text-t2 leading-snug line-clamp-3 mt-1">{n.excerpt}</div>
      {/if}
      {#if n.tags && n.tags.length > 0}
        <div class="mt-2 flex flex-wrap gap-1">
          {#each n.tags.slice(0, 3) as tg (tg)}
            <span class="text-2xs px-1.5 py-px rounded-full font-mono {tagPillClass(tg, 'muted')}">#{tg}</span>
          {/each}
          {#if n.tags.length > 3}
            <span class="text-2xs text-t3">+{n.tags.length - 3}</span>
          {/if}
        </div>
      {/if}
    </button>
  </li>
{/snippet}

<div class="flex flex-col h-full min-h-0">
  <div class="flex-1 overflow-y-auto overflow-x-hidden yarrow-paint-island yarrow-gpu-scroll">
    {#if listModeId === "list" && activePinned}
      {@render pinnedActiveHero(activePinned)}
    {/if}
    {#if listModeId === "list"}
      {#each otherPinned as n (n.slug)}
        {@render pinnedOtherHero(n)}
      {/each}
    {/if}

    {#if tagFilter}
      <div class="mx-3 mt-2 mb-1 px-2.5 py-1 text-2xs flex items-center gap-1.5 bg-yelp/60 text-yeld rounded-sm">
        <span>{t("sidebar.notes.filteringPrefix")} <span class="font-mono">#{tagFilter}</span></span>
        <button
          type="button"
          onclick={onClearTagFilter}
          class="ml-auto hover:text-char"
          aria-label={t("sidebar.notes.clearTagFilter")}
        >×</button>
      </div>
    {/if}

    {#if selectMode}
      <div class="mx-3 mt-2 mb-1 px-2.5 py-1.5 text-2xs flex items-center gap-2 bg-s2 rounded-sm">
        <span class="text-t2">{t("sidebar.notes.selected", { count: String(selected.size) })}</span>
        <button type="button" onclick={() => (selected = new Set(enriched.map((n) => n.slug)))} class="text-yeld hover:text-char">
          {t("sidebar.notes.selectAll")}
        </button>
        <button type="button" onclick={() => (selected = new Set())} class="text-t2 hover:text-char">
          {t("sidebar.notes.selectNone")}
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onclick={() => {
            if (selected.size === 0) return;
            onDeleteMany?.(Array.from(selected));
            selectMode = false;
          }}
          class="ml-auto text-danger hover:text-char disabled:opacity-40"
        >
          {t("sidebar.notes.selectDelete")}
        </button>
      </div>
    {/if}

    {#if listModeId === "cards"}
      {#if enriched.length > 0}
        <ul class="flex flex-col gap-2 px-3 pt-3 pb-1">
          {#each [...pinned, ...today, ...yesterday, ...week, ...olderVisible] as n (n.slug)}
            {@render card(n)}
          {/each}
          {#if olderHidden > 0}
            <li class="text-center pt-1">
              <button
                type="button"
                onclick={() => (showAllOlder = !showAllOlder)}
                class="text-[10px] uppercase tracking-[0.16em] text-t3 font-sans font-semibold hover:text-ch2 transition"
              >
                {showAllOlder ? t("sidebar.notes.olderCollapse") : t("sidebar.notes.olderShow", { n: String(olderHidden) })}
              </button>
            </li>
          {/if}
        </ul>
      {/if}
    {:else}
      {#each folderGroups as g (g.name)}
        {@const collapsed = collapsedFolders.has(g.name)}
        <section>
          <button
            type="button"
            onclick={() => {
              const next = new Set(collapsedFolders);
              if (collapsed) next.delete(g.name);
              else next.add(g.name);
              persistCollapsed(next);
            }}
            class="w-full px-4 pt-4 pb-1 flex items-baseline justify-between text-left group"
            aria-expanded={!collapsed}
          >
            <span class="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-t3 font-sans font-semibold group-hover:text-ch2 transition">
              <span class="inline-block transition-transform duration-150" style:transform={collapsed ? "rotate(-90deg)" : "rotate(0deg)"}>▾</span>
              <span>{g.name}</span>
              <span class="font-mono text-[10px] text-t3 normal-case tracking-normal">{g.notes.length}</span>
            </span>
          </button>
          {#if !collapsed}
            <div class="ml-5 border-l border-bd2/70">
              {#each g.notes as n (n.slug)}
                {@render noteRow(n)}
              {/each}
            </div>
          {/if}
        </section>
      {/each}
      {@render group(t("sidebar.notes.groupToday"), today, null)}
      {@render group(t("sidebar.notes.groupYesterday"), yesterday, null)}
      {@render group(t("sidebar.notes.groupLastWeek"), week, null)}
      {#if older.length > 0}
        {@render group(
          t("sidebar.notes.groupOlder"),
          olderVisible,
          olderHidden > 0
            ? { text: showAllOlder ? t("sidebar.notes.olderCollapse") : t("sidebar.notes.olderMore", { n: String(olderHidden) }), onClick: () => (showAllOlder = !showAllOlder) }
            : null,
        )}
      {/if}
    {/if}

    {#if enriched.length === 0}
      {#if tagFilter}
        <EmptyState
          kind="notes-filtered"
          hint={t("sidebar.notes.emptyFilteredHint", { tag: tagFilter })}
          action={onClearTagFilter ? { label: t("sidebar.notes.clearFilter"), onClick: onClearTagFilter } : undefined}
          size="tight"
        />
      {:else}
        <EmptyState
          kind="notes"
          action={{ label: t("sidebar.notes.newNote"), onClick: onCreate }}
          size="tight"
        />
      {/if}
    {/if}

    {#if orphanCount > 0}
      <div class="mx-3 mt-4 mb-2">
        <button
          type="button"
          onclick={() => (showOrphans = !showOrphans)}
          class="w-full text-left px-2 py-1.5 text-2xs text-t3 hover:text-t2 flex items-center gap-1 transition"
          title={t("sidebar.notes.orphansTitle")}
        >
          <span class="inline-flex items-center transition-transform" style:transform={showOrphans ? "rotate(90deg)" : "none"}>
            <ChevronRightIcon />
          </span>
          <span>
            {t(orphanCount === 1 ? "sidebar.notes.orphansOne" : "sidebar.notes.orphansMany", { count: String(orphanCount) })}
          </span>
        </button>
        {#if showOrphans}
          <ul class="ml-2 mt-1 space-y-0.5">
            {#each enriched.filter((n) => n.isOrphan) as n (n.slug)}
              <li>
                <button
                  type="button"
                  onclick={() => onSelect(n.slug)}
                  title={n.title || n.slug}
                  class="w-full text-left px-2 py-1.5 text-xs text-t2 hover:bg-s2 rounded-sm italic truncate flex items-center gap-1.5"
                >
                  <UnlinkIcon />
                  <span class="truncate">{n.title || n.slug}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>

  <div class="shrink-0 border-t border-bd/60 px-4 py-2 flex items-center justify-between text-[11px]">
    <span class="text-t3 font-sans font-feature-settings-['tnum']">
      {t(notes.length === 1 ? "sidebar.notes.footerCountOne" : "sidebar.notes.footerCountMany", { count: String(notes.length) })}
    </span>
    <div class="flex items-center gap-3">
      <button
        type="button"
        onclick={() => listModeStore.set(listModeId === "list" ? "cards" : "list")}
        class="text-t3 hover:text-ch2 transition"
        title={listModeId === "list" ? t("sidebar.notes.viewSwitchToCards") : t("sidebar.notes.viewSwitchToList")}
        aria-label={listModeId === "list" ? t("sidebar.notes.viewCards") : t("sidebar.notes.viewList")}
      >
        {#if listModeId === "list"}{@render cardViewIcon()}{:else}{@render listViewIcon()}{/if}
      </button>
      <button
        type="button"
        onclick={() => (selectMode = !selectMode)}
        class="transition flex items-center {selectMode ? 'text-yeld' : 'text-t3 hover:text-ch2'}"
        title={selectMode ? t("sidebar.notes.exitMultiSelect") : t("sidebar.notes.enterMultiSelect")}
        aria-label={selectMode ? t("sidebar.notes.exitMultiSelect") : t("sidebar.notes.enterMultiSelect")}
        aria-pressed={selectMode}
      >
        <SelectModeIcon size={14} weight={selectMode ? "fill" : "regular"} />
      </button>
      <div class="relative">
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            createMenuOpen = !createMenuOpen;
          }}
          class="flex items-center gap-1 text-t2 hover:text-char transition"
          aria-label={t("sidebar.notes.newAria")}
          aria-haspopup="menu"
          aria-expanded={createMenuOpen}
        >
          <PlusIcon size={11} />
          <span>{t("sidebar.notes.newShort")}</span>
          <ChevronUpIcon size={9} class={createMenuOpen ? "opacity-80" : "opacity-50"} />
        </button>
        {#if createMenuOpen}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            role="menu"
            tabindex="-1"
            class="absolute right-0 bottom-full mb-1.5 min-w-[148px] bg-bg border border-bd2 rounded-md shadow-xl text-xs py-1 z-40"
            onclick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
              onclick={() => {
                createMenuOpen = false;
                onCreate();
              }}
            >
              <NoteIcon size={12} />
              <span>{t("sidebar.notes.newNote")}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
              onclick={() => {
                createMenuOpen = false;
                newFolderModalOpen = true;
              }}
            >
              <NewFolderIcon size={12} />
              <span>{t("sidebar.folders.newFolder")}</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if menu && menuNote}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      bind:this={menuRef}
      style:left="{menuPos.x}px"
      style:top="{menuPos.y}px"
      class="fixed z-50 w-48 bg-bg border border-bd2 rounded-md shadow-xl text-xs py-1 animate-fadeIn"
      onclick={(e) => e.stopPropagation()}
      role="menu"
      tabindex="-1"
    >
      {#if onOpenInNewTab}
        <button
          type="button"
          class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
          onclick={() => {
            onOpenInNewTab!(menuNote!.slug);
            menu = null;
          }}
        >
          {@render newTabIcon()} {t("sidebar.notes.menuOpenInNewTab")}
        </button>
        <div class="my-1 border-t border-bd/60"></div>
      {/if}
      <button
        type="button"
        class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
        onclick={() => {
          onTogglePin(menuNote!.slug, !menuNote!.pinned);
          menu = null;
        }}
      >
        {@render pinIcon()} {menuNote.pinned ? t("sidebar.notes.menuUnpin") : t("sidebar.notes.menuPin")}
      </button>
      <button
        type="button"
        class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
        onclick={() => {
          renameState = { slug: menuNote!.slug, title: menuNote!.title || "" };
          menu = null;
        }}
      >
        <RenameIcon /> {t("sidebar.notes.menuRename")}
      </button>
      {#if onCopyAsMarkdown}
        <button
          type="button"
          class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
          onclick={() => {
            onCopyAsMarkdown(menuNote!.slug);
            menu = null;
          }}
        >
          {@render copyMdIcon()} {t("sidebar.notes.menuCopyMd")}
        </button>
      {/if}
      {#if onMoveToFolder}
        <button
          type="button"
          class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
          onclick={() => {
            folderPicker = { slug: menuNote!.slug };
            folderCreating = false;
            folderNewName = "";
            menu = null;
          }}
        >
          {@render folderIcon()} {t("sidebar.notes.menuMoveToFolder")}
        </button>
      {/if}
      {#if onReveal}
        <button
          type="button"
          class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2"
          onclick={() => {
            onReveal(menuNote!.slug);
            menu = null;
          }}
        >
          {@render revealIcon()} {t("sidebar.notes.menuReveal")}
        </button>
      {/if}
      {#if encryptionEnabled}
        {#if menuNote.encrypted}
          <button
            type="button"
            class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            disabled={!encryptionUnlocked}
            title={!encryptionUnlocked ? t("sidebar.notes.menuUnlockHint") : undefined}
            onclick={() => {
              onDecryptNote?.(menuNote!.slug);
              menu = null;
            }}
          >
            {@render smallLockIcon()} {t("sidebar.notes.menuDecrypt")}
          </button>
        {:else}
          <button
            type="button"
            class="w-full px-3 py-1.5 text-left hover:bg-s2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            disabled={!encryptionUnlocked}
            title={!encryptionUnlocked ? t("sidebar.notes.menuUnlockHint") : undefined}
            onclick={() => {
              onEncryptNote?.(menuNote!.slug);
              menu = null;
            }}
          >
            {@render smallLockIcon()} {t("sidebar.notes.menuEncrypt")}
          </button>
        {/if}
      {/if}
      <button
        type="button"
        class="w-full px-3 py-1.5 text-left hover:bg-s2 text-danger flex items-center gap-2"
        onclick={() => {
          onDelete(menuNote!.slug);
          menu = null;
        }}
      >
        <DeleteIcon /> {t("sidebar.notes.menuDelete")}
      </button>
    </div>
  {/if}

  <Modal
    open={!!renameState}
    onClose={() => (renameState = null)}
    title={t("sidebar.notes.renameTitle")}
  >
    {#snippet children()}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        autofocus
        value={renameState?.title ?? ""}
        oninput={(e) => {
          if (renameState) renameState = { ...renameState, title: (e.currentTarget as HTMLInputElement).value };
        }}
        onkeydown={(e) => {
          if (e.key === "Enter" && !e.isComposing) {
            const next = renameState?.title.trim();
            if (renameState && next) {
              onRename(renameState.slug, next);
              renameState = null;
            }
          }
        }}
        class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
      />
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm text-t2 hover:text-char"
          onclick={() => (renameState = null)}
        >
          {t("sidebar.notes.renameCancel")}
        </button>
        <button
          type="button"
          class="btn-yel px-3 py-1.5 text-sm rounded-md"
          onclick={() => {
            const next = renameState?.title.trim();
            if (renameState && next) {
              onRename(renameState.slug, next);
              renameState = null;
            }
          }}
          disabled={!renameState?.title.trim()}
        >
          {t("sidebar.notes.renameAction")}
        </button>
      </div>
    {/snippet}
  </Modal>

  {#if folderPicker && onMoveToFolder}
    <Modal
      open
      onClose={() => (folderPicker = null)}
      title={t("sidebar.folders.title")}
      width="w-[360px]"
    >
      {#snippet children()}
        <p class="text-xs text-t2 mb-3 leading-relaxed">
          {t("sidebar.folders.intro")}
          <span class="font-mono">.md</span>
          {t("sidebar.folders.introMd")}
          <span class="font-mono">notes/</span>
          {t("sidebar.folders.introTrail")}
        </p>
        <div class="max-h-[260px] overflow-y-auto -mx-1">
          <button
            type="button"
            onclick={() => pickFolder(null)}
            class="w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center gap-2 hover:bg-s2 {folderPickerCurrent === null ? 'bg-s2 text-char' : 'text-t2'}"
          >
            <span class="text-t3">↻</span>
            <span>{t("sidebar.folders.none")}</span>
          </button>
          {#each existingFolders as f (f)}
            {@const activeF = f === folderPickerCurrent}
            <button
              type="button"
              onclick={() => pickFolder(f)}
              class="w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center gap-2 hover:bg-s2 {activeF ? 'bg-yelp text-char' : 'text-ch2'}"
            >
              {@render folderIcon()}
              <span class="truncate">{f}</span>
              {#if activeF}
                <span class="ml-auto text-2xs text-t3">{t("sidebar.folders.current")}</span>
              {/if}
            </button>
          {/each}
        </div>
        <div class="mt-3 pt-3 border-t border-bd">
          {#if folderCreating}
            <div class="flex gap-2">
              <!-- svelte-ignore a11y_autofocus -->
              <input
                autofocus
                bind:value={folderNewName}
                onkeydown={(e) => {
                  if (e.key === "Enter" && !e.isComposing) commitFolderNew();
                  if (e.key === "Escape") {
                    folderCreating = false;
                    folderNewName = "";
                  }
                }}
                placeholder={t("sidebar.folders.namePlaceholder")}
                class="flex-1 px-3 py-1.5 bg-bg border border-bd rounded-md text-sm text-char"
              />
              <button
                type="button"
                onclick={commitFolderNew}
                disabled={!folderNewName.trim()}
                class="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-50"
              >
                {t("sidebar.folders.create")}
              </button>
            </div>
          {:else}
            <button
              type="button"
              onclick={() => (folderCreating = true)}
              class="text-xs text-yeld hover:text-char flex items-center gap-1.5"
            >
              <PlusIcon size={11} /> {t("sidebar.folders.newFolder")}
            </button>
          {/if}
        </div>
      {/snippet}
    </Modal>
  {/if}

  {#if newFolderModalOpen}
    <Modal
      open
      onClose={cancelNewFolder}
      title={t("sidebar.folders.newFolder")}
      width="w-[360px]"
    >
      {#snippet children()}
        <p class="text-xs text-t2 mb-3 leading-relaxed">
          {t("sidebar.folders.newFolderHint")}
        </p>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          autofocus
          bind:value={newFolderName}
          onkeydown={(e) => {
            if (e.key === "Enter" && !e.isComposing) commitNewFolder();
            if (e.key === "Escape") cancelNewFolder();
          }}
          placeholder={t("sidebar.folders.namePlaceholder")}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-sm text-char focus:outline-none focus:border-yel"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onclick={cancelNewFolder}
          >
            {t("sidebar.notes.renameCancel")}
          </button>
          <button
            type="button"
            class="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-50"
            onclick={commitNewFolder}
            disabled={!newFolderName.trim()}
          >
            {t("sidebar.folders.create")}
          </button>
        </div>
      {/snippet}
    </Modal>
  {/if}
</div>
