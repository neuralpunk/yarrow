<script lang="ts">
  import type { NoteSummary, PathCollection } from "../../lib/types";
  import { api } from "../../lib/tauri";
  import { relativeTime } from "../../lib/format";
  import { tr } from "../../lib/i18n/index.svelte";
  import { theme } from "../../lib/theme.svelte";
  import { colorPresetsForTheme } from "../../lib/pathAwareness";

  interface Props {
    collection: PathCollection;
    allNotes: NoteSummary[];
    isRoot: boolean;
    isGhost: boolean;
    parentName: string;
    currentPathName?: string;
    currentPathMembers?: string[];
    onClose: () => void;
    onOpenNote: (slug: string) => void;
    onOpenMap: (slug?: string) => void;
    onEditCondition: () => void;
    onRename: () => void;
    onDelete: () => void;
    onSetColor: (color: string | null) => Promise<void> | void;
    onSetAutoTag: (tag: string | null) => Promise<void> | void;
    onSetMainNote: (slug: string | null) => Promise<void> | void;
    onAddNote: (slug: string) => Promise<void> | void;
    onRemoveNote: (slug: string) => Promise<void> | void;
    onBranchFromNote: (slug: string) => void;
    onRequestPromote?: () => void;
    onSetArchived?: (archived: boolean) => Promise<void> | void;
  }

  let {
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
    onSetArchived,
  }: Props = $props();

  let t = $derived(tr());
  let busy = $state<string | null>(null);
  let filter = $state("");
  let adding = $state(false);
  let dropOver = $state(false);
  let modified = $state<NoteRow[] | null>(null);
  let groupTags = $state(false);

  interface NoteRow {
    slug: string;
    title: string;
    tags: string[];
  }

  let titleFor = $derived.by(() => {
    const m = new Map<string, string>();
    for (const n of allNotes) m.set(n.slug, n.title || n.slug);
    return m;
  });

  let memberSet = $derived(new Set(collection.members));

  function decorateNote(slug: string): NoteRow {
    const found = allNotes.find((n) => n.slug === slug);
    return {
      slug,
      title: titleFor.get(slug) || slug,
      tags: found?.tags ?? [],
    };
  }

  let memberDiff = $derived.by(() => {
    if (!currentPathName || !currentPathMembers || currentPathName === collection.name) return null;
    const baseline = new Set(currentPathMembers);
    const candidate = new Set(collection.members);
    const gained = collection.members
      .filter((s) => !baseline.has(s))
      .map((slug) => decorateNote(slug));
    const lost = currentPathMembers
      .filter((s) => !candidate.has(s))
      .map((slug) => decorateNote(slug));
    if (gained.length === 0 && lost.length === 0) return null;
    return { gained, lost };
  });

  $effect(() => {
    const collName = collection.name;
    if (!currentPathName || currentPathName === collName) {
      modified = null;
      return;
    }
    let alive = true;
    api.comparePaths(currentPathName, collName)
      .then((cmp) => {
        if (!alive) return;
        const rows = cmp.entries
          .filter((e) => e.status === "modified")
          .map((e) => decorateNote(e.slug));
        modified = rows;
      })
      .catch(() => {
        if (alive) modified = [];
      });
    return () => {
      alive = false;
    };
  });

  const UNTAGGED_KEY = "__untagged__";
  function groupByTag(rows: NoteRow[]): Array<[string, NoteRow[]]> {
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
      if (a[0] === UNTAGGED_KEY) return 1;
      if (b[0] === UNTAGGED_KEY) return -1;
      return a[0].localeCompare(b[0]);
    });
  }

  let diff = $derived(
    memberDiff || (modified && modified.length > 0 ? { gained: [], lost: [] } : null),
  );

  $effect(() => {
    const slugs = collection.members;
    window.dispatchEvent(
      new CustomEvent("yarrow:path-highlight", { detail: { slugs } }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("yarrow:path-highlight", { detail: { slugs: null } }),
      );
    };
  });

  let members = $derived(
    collection.members
      .map((slug) => ({ slug, title: titleFor.get(slug) || slug }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  );

  let candidates = $derived.by(() => {
    const needle = filter.trim().toLowerCase();
    return allNotes
      .filter((n) => !memberSet.has(n.slug))
      .filter(
        (n) =>
          !needle ||
          (n.title || n.slug).toLowerCase().includes(needle) ||
          n.slug.toLowerCase().includes(needle),
      )
      .slice(0, 40);
  });

  async function act(slug: string, fn: (s: string) => Promise<void> | void) {
    busy = slug;
    try {
      await fn(slug);
    } finally {
      busy = null;
    }
  }

  let ghostHeaderParts = $derived(t("paths.detail.ghostHeader").split("{parent}"));
  let sideHeaderParts = $derived(t("paths.detail.sideHeader").split("{parent}"));
  let diffVsParts = $derived(t("paths.detail.diffVs").split("{name}"));

  // ── AutoTag local state ──
  let autoEditing = $state(false);
  // svelte-ignore state_referenced_locally
  let autoDraft = $state(collection.auto_membership_tag ?? "");
  $effect(() => {
    autoDraft = collection.auto_membership_tag ?? "";
  });
  async function autoCommit() {
    const next = autoDraft.trim().replace(/^#/, "");
    autoEditing = false;
    await onSetAutoTag(next ? next : null);
  }

  // Theme system spec §2.4 / §3.4 — eight scenario accents tuned to
  // the active theme's canvas. Reactive via $derived so the swatch
  // strip retunes the moment the user switches palette.
  let colorPresets = $derived(colorPresetsForTheme(theme.resolved));

  type Tone = "gain" | "lose" | "modified";
  const TONE_STYLES: Record<Tone, { count: string; glyph: string; glyphColor: string; row: string; strike: string }> = {
    gain: { count: "text-yeld", glyph: "+", glyphColor: "text-yeld", row: "text-char hover:bg-yelp/40", strike: "" },
    lose: { count: "text-danger", glyph: "−", glyphColor: "text-danger", row: "text-t2 hover:bg-s2 line-through decoration-danger/40", strike: "no-underline" },
    modified: { count: "text-amber-700 dark:text-amber-400", glyph: "~", glyphColor: "text-amber-700 dark:text-amber-400", row: "text-char hover:bg-s2", strike: "" },
  };
</script>

{#snippet diffRow(n: NoteRow, styles: { row: string; glyphColor: string; glyph: string; strike: string }, titleSuffix: string | undefined)}
  <li>
    <button
      onclick={() => onOpenNote(n.slug)}
      class="w-full text-left text-xs {styles.row} rounded-sm px-2 py-0.5 truncate flex items-center gap-1.5"
      title={titleSuffix}
    >
      <span class="{styles.glyphColor} {styles.strike}">{styles.glyph}</span>
      <span class="truncate {styles.strike}">{n.title}</span>
    </button>
  </li>
{/snippet}

{#snippet diffGroup(tone: Tone, label: string, rows: NoteRow[], titleSuffix?: string)}
  {#if rows.length > 0}
    {@const styles = TONE_STYLES[tone]}
    {@const sign = tone === "lose" ? "−" : tone === "modified" ? "~" : "+"}
    <div class="mb-2">
      <div class="text-2xs font-mono mb-1 {styles.count}">
        {sign}{rows.length} {label}
      </div>
      {#if groupTags}
        <div class="space-y-1.5">
          {#each groupByTag(rows) as [tag, items] (tag)}
            <div>
              <div class="text-2xs text-t3 font-mono px-2">
                {tag === "__untagged__" ? t("paths.detail.diffUntagged") : `#${tag}`}
                <span class="text-t3/70">· {items.length}</span>
              </div>
              <ul class="space-y-0.5">
                {#each items.slice(0, 5) as r (r.slug + ":" + r.title)}
                  {@render diffRow(r, styles, titleSuffix)}
                {/each}
                {#if items.length > 5}
                  <li class="text-2xs text-t3 italic px-2">
                    {t("paths.detail.diffMore", { count: String(items.length - 5) })}
                  </li>
                {/if}
              </ul>
            </div>
          {/each}
        </div>
      {:else}
        <ul class="space-y-0.5">
          {#each rows.slice(0, 5) as r (r.slug + ":" + r.title)}
            {@render diffRow(r, styles, titleSuffix)}
          {/each}
          {#if rows.length > 5}
            <li class="text-2xs text-t3 italic px-2">
              {t("paths.detail.diffMore", { count: String(rows.length - 5) })}
            </li>
          {/if}
        </ul>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet mapIcon()}
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="3" cy="3" r="1.5" />
    <circle cx="3" cy="11" r="1.5" />
    <circle cx="11" cy="7" r="1.5" />
    <path d="M3 4.5v5M4.3 3.7l5.4 2.6M4.3 10.3l5.4-2.6" />
  </svg>
{/snippet}

<aside class="h-full w-full flex flex-col bg-s1 overflow-hidden">
  <header class="px-4 pt-4 pb-3 border-b border-bd">
    <div class="flex items-center mb-1">
      {#if isGhost}
        <span class="text-2xs uppercase tracking-[0.2em] font-mono text-t3">
          {ghostHeaderParts[0]}<span class="text-t2 not-italic">{collection.parent || t("paths.detail.ghostHeaderUnknown")}</span>{ghostHeaderParts[1] ?? ""}
        </span>
      {:else if isRoot}
        <span class="text-2xs uppercase tracking-[0.2em] font-mono text-yeld">
          {t("paths.detail.mainHeader")}
        </span>
      {:else}
        <span class="text-2xs uppercase tracking-[0.2em] font-mono text-t3">
          {sideHeaderParts[0]}<span class="text-yeld not-italic">{parentName}</span>{sideHeaderParts[1] ?? ""}
        </span>
      {/if}
      <button
        onclick={onClose}
        class="ml-auto text-t3 hover:text-char w-6 h-6 flex items-center justify-center rounded-sm hover:bg-s2"
        aria-label={t("paths.detail.closeAria")}
        title={t("paths.detail.closeTitle")}
      >×</button>
    </div>
    <div class="flex items-center gap-2">
      <div class="font-serif text-[22px] text-char truncate" title={collection.name}>
        {collection.name}
      </div>
      {#if !isRoot}
        <button
          onclick={onRename}
          class="text-2xs text-t3 hover:text-char"
          title={t("paths.detail.renameTitle")}
        >{t("paths.detail.rename")}</button>
      {/if}
    </div>
    <button
      onclick={onEditCondition}
      class="mt-1.5 text-left w-full text-xs leading-snug {collection.condition
        ? 'text-yeld italic hover:text-yel'
        : 'text-t3 italic hover:text-t2'}"
      title={t("paths.detail.editConditionTitle")}
    >
      {collection.condition ? `“${collection.condition}”` : t("paths.detail.namePrompt")}
    </button>
    <div class="mt-2 flex items-center gap-2 text-2xs font-mono text-t3 tracking-wider">
      <span>
        {collection.members.length === 1
          ? t("paths.detail.notesCountOne", { count: String(collection.members.length) })
          : t("paths.detail.notesCountMany", { count: String(collection.members.length) })}
      </span>
      <span>·</span>
      <span>{t("paths.detail.created", { when: relativeTime(collection.created_at) })}</span>
    </div>
    <div class="mt-2.5 flex items-center gap-3 flex-wrap">
      <button
        onclick={() => onOpenMap(collection.main_note || undefined)}
        class="text-xs px-2.5 py-1 rounded-md border border-bd text-t2 hover:bg-s2 hover:text-char inline-flex items-center gap-1.5"
        title={t("paths.detail.openMapTitle")}
      >
        {@render mapIcon()} {t("paths.detail.openMap")}
      </button>

      <!-- ColorPicker -->
      <div class="inline-flex items-center gap-1.5">
        <span class="text-2xs font-serif italic text-t3">{t("paths.detail.accent")}</span>
        <button
          onclick={() => onSetColor(null)}
          title={t("paths.detail.accentClearTitle")}
          class="w-5 h-5 rounded-full border border-bd flex items-center justify-center text-t3 text-[10px] transition {!collection.color
            ? 'ring-2 ring-yeld ring-offset-1 ring-offset-bg'
            : 'hover:border-t2'}"
        >∅</button>
        {#each colorPresets as c (c)}
          <button
            onclick={() => onSetColor(c)}
            style:background={c}
            title={c}
            class="w-5 h-5 rounded-full border border-bd/40 transition {collection.color?.toLowerCase() === c.toLowerCase()
              ? 'ring-2 ring-yeld ring-offset-1 ring-offset-bg'
              : 'hover:scale-110'}"
            aria-label={t("paths.detail.accentSetAria", { value: c })}
          ></button>
        {/each}
        <label
          class="w-5 h-5 rounded-full border border-dashed border-bd flex items-center justify-center text-t3 cursor-pointer hover:border-t2"
          title={t("paths.detail.accentCustomTitle")}
        >
          <input
            type="color"
            value={collection.color ?? "#c97a3a"}
            onchange={(e) => onSetColor((e.currentTarget as HTMLInputElement).value)}
            class="sr-only"
          />
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
            <path d="M7 2v10M2 7h10" />
          </svg>
        </label>
      </div>
    </div>

    <!-- AutoTagRow -->
    {#if !autoEditing && !collection.auto_membership_tag}
      <div class="mt-2">
        <button
          onclick={() => {
            autoEditing = true;
            autoDraft = "";
          }}
          class="text-2xs text-t3 hover:text-char italic font-serif transition"
          title={t("paths.detail.autoTagAddTitle")}
        >
          {t("paths.detail.autoTagAdd")}
        </button>
      </div>
    {:else if !autoEditing && collection.auto_membership_tag}
      <div class="mt-2 flex items-center gap-2 flex-wrap text-2xs">
        <span class="font-serif italic text-t3">{t("paths.detail.autoIncludes")}</span>
        <span class="px-2 py-0.5 rounded-full bg-yelp text-yeld font-mono text-[10px]">
          #{collection.auto_membership_tag}
        </span>
        <span class="font-serif italic text-t3">
          {collection.members.length === 1
            ? t("paths.detail.autoMatchOne", { count: String(collection.members.length) })
            : t("paths.detail.autoMatchMany", { count: String(collection.members.length) })}
        </span>
        <button onclick={() => (autoEditing = true)} class="text-t3 hover:text-char transition">
          {t("paths.detail.change")}
        </button>
        <button onclick={() => onSetAutoTag(null)} class="text-t3 hover:text-char transition">
          {t("paths.detail.clear")}
        </button>
      </div>
    {:else}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          autoCommit();
        }}
        class="mt-2 flex items-center gap-1.5"
      >
        <span class="text-2xs font-serif italic text-t3">{t("paths.detail.autoLead")}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          autofocus
          bind:value={autoDraft}
          placeholder={t("paths.detail.autoTagPlaceholder")}
          class="px-2 py-0.5 bg-s1 border border-bd rounded-sm text-char text-2xs focus:outline-hidden focus:border-yeld w-[140px]"
        />
        <button type="submit" class="px-2 py-0.5 bg-char text-bg rounded-sm text-2xs hover:bg-yeld transition">
          {t("paths.detail.autoSave")}
        </button>
        <button
          type="button"
          onclick={() => {
            autoEditing = false;
            autoDraft = collection.auto_membership_tag ?? "";
          }}
          class="text-2xs text-t3 hover:text-char transition"
        >
          {t("paths.detail.autoCancel")}
        </button>
      </form>
    {/if}
  </header>

  <div class="flex-1 overflow-y-auto">
    {#if diff}
      <section class="px-4 pt-3 pb-3 border-b border-bd/60 bg-bg/40">
        <div class="flex items-baseline gap-2 mb-2">
          <div class="text-2xs uppercase tracking-[0.18em] font-mono text-t3">
            {t("paths.detail.diffHeading")}
            <span class="ml-2 normal-case tracking-normal text-t3/80">
              {diffVsParts[0]}<span class="text-yeld">{currentPathName}</span>{diffVsParts[1] ?? ""}
            </span>
          </div>
          <button
            onclick={() => (groupTags = !groupTags)}
            class="ml-auto text-2xs text-t3 hover:text-char"
            title={t("paths.detail.diffGroupTitle")}
          >
            {groupTags ? t("paths.detail.diffFlat") : t("paths.detail.diffGroup")}
          </button>
        </div>

        {@render diffGroup("gain", t("paths.detail.diffGain"), memberDiff?.gained ?? [])}
        {@render diffGroup("modified", t("paths.detail.diffEdited"), modified ?? [])}
        {@render diffGroup(
          "lose",
          t("paths.detail.diffLose"),
          memberDiff?.lost ?? [],
          t("paths.detail.diffLoseTitle", { name: collection.name }),
        )}

        {#if modified === null}
          <div class="text-2xs text-t3 italic mt-1">
            {t("paths.detail.diffChecking")}
          </div>
        {/if}
      </section>
    {/if}

    <!-- Members -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <section
      class="pt-3 pb-1 transition {dropOver
        ? 'bg-yelp/30 outline-solid outline-2 outline-yel/60 -outline-offset-2'
        : ''}"
      ondragover={(e) => {
        if (!e.dataTransfer || !e.dataTransfer.types.includes("application/x-yarrow-note")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!dropOver) dropOver = true;
      }}
      ondragleave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        dropOver = false;
      }}
      ondrop={(e) => {
        const slug = e.dataTransfer?.getData("application/x-yarrow-note") || "";
        dropOver = false;
        if (!slug || memberSet.has(slug)) return;
        e.preventDefault();
        void onAddNote(slug);
      }}
    >
      <div class="px-4 flex items-baseline gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-yel"></span>
        <span class="font-serif text-[15px] text-char">{t("paths.detail.inThisPath")}</span>
        <span class="text-2xs font-mono text-t3">{members.length}</span>
        <button
          onclick={() => (adding = !adding)}
          class="ml-auto text-2xs text-t3 hover:text-char"
        >
          {adding ? t("paths.detail.adding") : t("paths.detail.add")}
        </button>
      </div>
      {#if members.length === 0 && !adding}
        <div class="px-4 py-3 text-xs text-t3 italic">
          {t("paths.detail.emptyMembers")}
        </div>
      {/if}
      <ul class="mt-1">
        {#each members as m (m.slug)}
          <li class="group flex items-center hover:bg-s2/60 transition">
            <button
              onclick={() => onOpenNote(m.slug)}
              class="flex-1 min-w-0 text-left px-4 py-2 text-sm text-char truncate flex items-center gap-2"
              title={t("paths.detail.openTitle")}
            >
              {#if collection.main_note === m.slug}
                <span class="text-yeld shrink-0" title={t("paths.detail.mainNoteTitle")}>★</span>
              {:else}
                <span class="text-t3 text-xs shrink-0 w-3 text-center">·</span>
              {/if}
              <span class="truncate">{m.title}</span>
            </button>
            <div class="opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 pr-2">
              {#if collection.main_note !== m.slug}
                <button
                  onclick={() => act(m.slug, onSetMainNote)}
                  disabled={busy === m.slug}
                  class="text-2xs px-2 py-0.5 text-t3 hover:text-yeld hover:bg-yelp/40 rounded-sm"
                  title={t("paths.detail.markMainTitle")}
                >
                  {t("paths.detail.markMain")}
                </button>
              {/if}
              <button
                onclick={() => onBranchFromNote(m.slug)}
                class="text-2xs px-2 py-0.5 text-t3 hover:text-yeld hover:bg-yelp/40 rounded-sm"
                title={t("paths.detail.branchTitle")}
              >
                {t("paths.detail.branch")}
              </button>
              {#if !(isRoot && members.length === 1)}
                <button
                  onclick={() => act(m.slug, onRemoveNote)}
                  disabled={busy === m.slug}
                  class="text-2xs px-2 py-0.5 text-t3 hover:text-char hover:bg-s2 rounded-sm"
                  title={t("paths.detail.removeTitle")}
                >
                  {busy === m.slug ? "…" : t("paths.detail.remove")}
                </button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </section>

    {#if adding}
      <section class="px-4 pb-4 border-t border-bd/60 pt-3 bg-bg/40">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          autofocus
          bind:value={filter}
          placeholder={t("paths.detail.filterPlaceholder")}
          class="w-full px-3 py-1.5 bg-bg border border-bd rounded-md text-char text-xs"
        />
        <div class="mt-2 text-2xs text-t3 italic">
          {candidates.length === 0
            ? t("paths.detail.filterEmpty")
            : t("paths.detail.filterCount", { count: String(candidates.length) })}
        </div>
        <ul class="mt-1 max-h-[280px] overflow-y-auto">
          {#each candidates as n (n.slug)}
            <li>
              <button
                onclick={() => act(n.slug, onAddNote)}
                disabled={busy === n.slug}
                class="w-full text-left px-2 py-1.5 text-xs text-t2 hover:text-char hover:bg-s2/70 rounded-sm flex items-center gap-2"
              >
                <span class="text-yeld">+</span>
                <span class="truncate">{n.title || n.slug}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>

  <footer class="border-t border-bd p-3 bg-s1 flex flex-wrap items-center gap-1.5">
    {#if !isRoot && onRequestPromote}
      <button
        onclick={onRequestPromote}
        class="text-xs px-3 py-1.5 rounded-md bg-yel text-on-yel hover:bg-yel2 inline-flex items-center gap-1.5 font-medium"
        title={isGhost
          ? t("paths.detail.promoteTitleGhost", { name: collection.name })
          : t("paths.detail.promoteTitle", { name: collection.name })}
      >
        {isGhost ? t("paths.detail.bringBack") : t("paths.detail.promote")}
      </button>
    {/if}
    {#if !isRoot && !isGhost && onSetArchived}
      <button
        onclick={() => onSetArchived?.(!collection.archived)}
        class="text-xs px-2.5 py-1.5 rounded-md border border-bd/70 text-t2 hover:text-char hover:border-bd"
        title={collection.archived
          ? t("paths.archive.bringBackTitle")
          : t("paths.archive.setAsideTitle")}
      >
        {collection.archived ? t("paths.archive.bringBack") : t("paths.archive.setAside")}
      </button>
    {/if}
    {#if !isRoot && !isGhost}
      <button
        onclick={onDelete}
        class="ml-auto text-xs px-2 py-1.5 rounded-md text-t3 hover:text-danger hover:bg-s2/60 transition"
        title={t("paths.detail.deletePathTitle")}
      >
        {t("paths.detail.deletePath")}
      </button>
    {/if}
    {#if isRoot}
      <div class="text-2xs text-t3 italic w-full text-center">
        {t("paths.detail.trunkNote")}
      </div>
    {/if}
    {#if isGhost}
      <div class="ml-auto text-2xs text-t3 italic">
        {t("paths.detail.ghostNote")}
      </div>
    {/if}
  </footer>
</aside>
