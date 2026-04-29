<script lang="ts">
  import { api } from "../lib/tauri";
  import type { NoteSummary, PathCollection, PathCollectionsView } from "../lib/types";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    notes: NoteSummary[];
    initialCollections?: PathCollection[];
    currentPathName?: string;
    onOpenNote: (slug: string) => void;
  }

  let {
    open,
    onClose,
    notes,
    initialCollections,
    currentPathName,
    onOpenNote,
  }: Props = $props();
  let t = $derived(tr());

  const STAR_KEY = (workspaceTag: string) => `yarrow.matrixStarred:${workspaceTag}`;

  let collections = $state<PathCollection[]>([]);
  $effect(() => {
    if (initialCollections && collections.length === 0) collections = initialCollections;
  });
  let filter = $state("");
  let tagFilter = $state<string | null>(null);
  let showOnlyStarred = $state(false);
  let starred = $state<Set<string>>(new Set());
  let divergesByPathSlug = $state<Set<string>>(new Set());
  let sortBy = $state<{ path: string; dir: "in-first" | "out-first" } | null>(null);

  let storageKey = $derived(STAR_KEY(notes[0]?.slug || "default"));

  $effect(() => {
    if (!open) return;
    const key = storageKey;
    try {
      const raw = localStorage.getItem(key);
      starred = raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      starred = new Set();
    }
    api
      .listPathCollections()
      .then((v: PathCollectionsView) => (collections = v.collections))
      .catch(() => {});
    api
      .pathDivergenceSummary()
      .then((sum) => {
        const next = new Set<string>();
        for (const p of sum) {
          for (const s of p.slugs) next.add(`${p.name}::${s}`);
        }
        divergesByPathSlug = next;
      })
      .catch(() => (divergesByPathSlug = new Set()));
  });

  function persist(next: Set<string>) {
    starred = next;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {}
  }

  function toggleStar(slug: string) {
    const next = new Set(starred);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    persist(next);
  }

  let memberSets = $derived.by(() => {
    const m = new Map<string, Set<string>>();
    for (const c of collections) m.set(c.name, new Set(c.members));
    return m;
  });

  let tagCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const n of notes) for (const tg of n.tags ?? []) counts.set(tg, (counts.get(tg) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  });

  function cycleColumnSort(path: string) {
    if (!sortBy || sortBy.path !== path) sortBy = { path, dir: "in-first" };
    else if (sortBy.dir === "in-first") sortBy = { path, dir: "out-first" };
    else sortBy = null;
  }

  let rows = $derived.by(() => {
    const needle = filter.trim().toLowerCase();
    return notes
      .filter((n) => !showOnlyStarred || starred.has(n.slug))
      .filter((n) => !tagFilter || (n.tags ?? []).includes(tagFilter))
      .filter(
        (n) =>
          !needle ||
          (n.title || n.slug).toLowerCase().includes(needle) ||
          n.slug.toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        const sa = starred.has(a.slug) ? 0 : 1;
        const sb = starred.has(b.slug) ? 0 : 1;
        if (sa !== sb) return sa - sb;

        if (sortBy) {
          const set = memberSets.get(sortBy.path);
          const ina = set?.has(a.slug) ? 0 : 1;
          const inb = set?.has(b.slug) ? 0 : 1;
          if (ina !== inb) {
            return sortBy.dir === "in-first" ? ina - inb : inb - ina;
          }
        }
        return (a.title || a.slug).localeCompare(b.title || b.slug);
      });
  });

  let maxMustHits = $derived.by(() => {
    if (starred.size === 0) return 0;
    let m = 0;
    for (const c of collections) {
      const set = memberSets.get(c.name);
      if (!set) continue;
      let h = 0;
      for (const slug of starred) if (set.has(slug)) h++;
      if (h > m) m = h;
    }
    return m;
  });

  function isWinnerCol(name: string): boolean {
    if (maxMustHits === 0) return false;
    const set = memberSets.get(name);
    if (!set) return false;
    let h = 0;
    for (const slug of starred) if (set.has(slug)) h++;
    return h === maxMustHits;
  }

  let winnerNames = $derived.by(() => {
    if (maxMustHits === 0) return [] as string[];
    return collections.filter((c) => isWinnerCol(c.name)).map((c) => c.name);
  });
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-4"
    onmousedown={onClose}
    role="presentation"
  >
    <div
      onmousedown={(e) => e.stopPropagation()}
      class="w-full max-w-7xl h-[88vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="px-5 py-4 border-b border-bd flex items-baseline gap-3">
        <div>
          <div class="font-serif text-xl text-char">{t("paths.matrix.title")}</div>
          <div class="text-2xs text-t3 mt-0.5">
            {t("paths.matrix.subtitle")}
          </div>
        </div>
        <div class="ml-auto flex items-center gap-2 text-xs">
          <input
            bind:value={filter}
            placeholder={t("paths.matrix.filterPlaceholder")}
            class="px-2.5 py-1 bg-s1 border border-bd rounded-sm text-char w-44 outline-hidden focus:border-yel"
          />
          <label class="flex items-center gap-1.5 cursor-pointer text-t2">
            <input type="checkbox" bind:checked={showOnlyStarred} />
            <span>{t("paths.matrix.onlyStars")}</span>
          </label>
        </div>
      </div>

      {#if starred.size > 0 && winnerNames.length > 0}
        <div class="px-5 py-2 border-b border-bd bg-yel/8 text-xs text-yeld">
          <span class="font-serif italic">
            {winnerNames.length === 1
              ? t("paths.matrix.bestMatch", {
                  names: winnerNames[0],
                  hits: String(maxMustHits),
                  total: String(starred.size),
                })
              : t("paths.matrix.bestMatchTie", {
                  names: winnerNames.join(", "),
                  hits: String(maxMustHits),
                  total: String(starred.size),
                })}
          </span>
        </div>
      {/if}
      {#if starred.size === 0 && collections.length > 0}
        <div class="px-5 py-2 border-b border-bd text-xs text-t3 italic font-serif">
          {t("paths.matrix.noStars")}
        </div>
      {/if}

      {#if tagCounts.length > 0}
        <div class="px-5 py-2 border-b border-bd flex items-center gap-1.5 flex-wrap text-2xs">
          <span class="text-t3 font-mono mr-1">{t("paths.matrix.tagsLabel")}</span>
          <button
            onclick={() => (tagFilter = null)}
            class="px-2 py-0.5 rounded-full {tagFilter === null
              ? 'bg-yel text-on-yel'
              : 'bg-s2 text-t2 hover:bg-s3'}"
          >
            {t("paths.matrix.allTags")}
          </button>
          {#each tagCounts.slice(0, 12) as [tg, n] (tg)}
            <button
              onclick={() => (tagFilter = tagFilter === tg ? null : tg)}
              class="px-2 py-0.5 rounded-full {tagFilter === tg
                ? 'bg-yel text-on-yel'
                : 'bg-s2 text-t2 hover:bg-s3'}"
            >
              #{tg} <span class="text-t3">{n}</span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="flex-1 overflow-auto">
        <table class="border-collapse text-sm" style:table-layout="fixed">
          <thead class="sticky top-0 bg-bg z-10">
            <tr>
              <th
                class="text-left px-3 align-bottom border-b border-bd font-serif font-normal text-yeld text-xs sticky left-0 bg-yelp z-10 min-w-[260px]"
                style:height="150px"
              >
                <span class="inline-block pb-2">{t("paths.matrix.colHeader")}</span>
              </th>
              {#each collections as c (c.name)}
                {@const isCurrent = c.name === currentPathName}
                {@const isWinner = isWinnerCol(c.name)}
                {@const sortActive = sortBy?.path === c.name}
                <th
                  class="p-0 align-bottom border-b relative {isWinner
                    ? 'bg-yel/8 border-b-yel/45'
                    : isCurrent
                      ? 'bg-yelp/40 border-bd'
                      : 'border-bd'}"
                  style:min-width="44px"
                  style:width="44px"
                  style:height="150px"
                >
                  <button
                    onclick={() => cycleColumnSort(c.name)}
                    class="absolute left-1/2 bottom-2 origin-bottom-left group"
                    style:transform="translateX(6px) rotate(-45deg)"
                    style:transform-origin="bottom left"
                    style:white-space="nowrap"
                    title={t("paths.matrix.colSortTitle", { name: c.name })}
                  >
                    <span
                      class="font-serif text-[13px] leading-none font-medium {isWinner
                        ? 'text-yeld italic'
                        : sortActive
                          ? 'text-yeld'
                          : 'text-char'}"
                    >
                      {c.name}
                    </span>
                    {#if sortActive && sortBy}
                      <span class="ml-1 text-[10px] font-mono text-yeld">
                        {sortBy.dir === "in-first" ? "▼" : "▲"}
                      </span>
                    {/if}
                  </button>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#if rows.length === 0}
              <tr>
                <td colspan={1 + collections.length} class="text-center text-t3 italic py-10">
                  {t("paths.matrix.empty")}
                </td>
              </tr>
            {:else}
              {#each rows as n (n.slug)}
                {@const isStar = starred.has(n.slug)}
                <tr class={isStar ? "bg-yel/4 hover:bg-yel/[0.07]" : "hover:bg-s1/60"}>
                  <td class="px-3 py-1.5 border-b border-bd/40 sticky left-0 {isStar ? 'bg-yelp/90' : 'bg-yelp'}">
                    <div class="flex items-center gap-2 min-w-0">
                      <button
                        onclick={() => toggleStar(n.slug)}
                        class="shrink-0 text-base leading-none transition-colors {isStar
                          ? 'text-yeld'
                          : 'text-t3 hover:text-yel'}"
                        title={isStar ? t("paths.matrix.starOn") : t("paths.matrix.starOff")}
                      >
                        {isStar ? "★" : "☆"}
                      </button>
                      <button
                        onclick={() => onOpenNote(n.slug)}
                        class="text-left hover:text-char truncate flex-1 font-serif {isStar
                          ? 'text-yeld font-medium'
                          : 'text-ch2'}"
                        title={n.title || n.slug}
                      >
                        {n.title || n.slug}
                      </button>
                      {#if (n.tags ?? []).length > 0}
                        <div class="flex gap-1 shrink-0">
                          {#each (n.tags ?? []).slice(0, 2) as tg (tg)}
                            <span class="text-[10px] text-yeld/70 font-mono">#{tg}</span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </td>
                  {#each collections as c (c.name)}
                    {@const inPath = memberSets.get(c.name)?.has(n.slug) ?? false}
                    {@const isCurrent = c.name === currentPathName}
                    {@const isWinner = isWinnerCol(c.name)}
                    {@const differs = divergesByPathSlug.has(`${c.name}::${n.slug}`)}
                    {@const cellBg = isWinner ? "bg-yel/5" : isCurrent ? "bg-yelp/20" : ""}
                    <td
                      class="text-center border-b border-bd/40 px-1 py-1.5 {cellBg}"
                      style:width="44px"
                    >
                      {#if inPath && differs}
                        {@const color = isStar ? "var(--yeld)" : "var(--t2)"}
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          aria-label={t("paths.matrix.cellPresent")}
                          style:display="inline-block"
                          style:vertical-align="middle"
                        >
                          <circle cx="10" cy="10" r="6.5" fill="none" stroke={color} stroke-width={isStar ? 2.5 : 1.8} />
                          <path d="M10 3.5 A6.5 6.5 0 0 1 10 16.5 Z" fill={color} />
                        </svg>
                      {:else if inPath}
                        {@const color = isStar ? "var(--yeld)" : "var(--t2)"}
                        {@const stroke = isStar ? 3 : 2.2}
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke={color}
                          stroke-width={stroke}
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-label={t("paths.matrix.cellPresent")}
                          style:display="inline-block"
                          style:vertical-align="middle"
                        >
                          <path d="M4 10.5 L8.5 15 L16 6" />
                        </svg>
                      {:else if isStar}
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="var(--danger)"
                          stroke-width={3}
                          stroke-linecap="round"
                          aria-label={t("paths.matrix.cellMissing")}
                          style:display="inline-block"
                          style:vertical-align="middle"
                        >
                          <path d="M5 5 L15 15 M15 5 L5 15" />
                        </svg>
                      {:else}
                        <span
                          aria-label={t("paths.matrix.cellAbsent")}
                          class="inline-block w-1.5 h-1.5 rounded-full bg-bd2 align-middle"
                        ></span>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      <div class="px-5 py-3 border-t border-bd flex justify-between items-center text-2xs text-t3">
        <div>{t("paths.matrix.legend")}</div>
        <button
          onclick={onClose}
          class="text-xs px-3 py-1.5 rounded-sm bg-s2 text-t2 hover:bg-s3 hover:text-char"
        >
          {t("paths.matrix.close")}
        </button>
      </div>
    </div>
  </div>
{/if}
