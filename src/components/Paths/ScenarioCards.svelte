<script lang="ts">
  // Cards-style alternative to ForkingRoad — same data, different lens.

  import type { NoteSummary, PathCollection } from "../../lib/types";
  import { isGhostPath } from "../../lib/types";
  import { relativeTime } from "../../lib/format";
  import { tr } from "../../lib/i18n/index.svelte";
  import { NewDirectionIcon } from "../../lib/iconsSvelte";

  interface Props {
    collections: PathCollection[];
    rootName: string;
    notes: NoteSummary[];
    selectedPath: string | null;
    onSelect: (name: string | null) => void;
    onAddFork: (parent: string) => void;
    /** The user's current writing path — this card gets the "YOU" pill. */
    currentPathName?: string;
    /** Per-path divergence count. */
    divergenceByPath?: Record<string, number>;
  }

  let {
    collections,
    rootName,
    notes,
    selectedPath,
    onSelect,
    onAddFork,
    currentPathName,
    divergenceByPath = {},
  }: Props = $props();

  let t = $derived(tr());

  let titleFor = $derived(
    new Map<string, string>(notes.map((n) => [n.slug, n.title || n.slug])),
  );

  function accentFor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) {
      h = (h * 31 + name.charCodeAt(i)) >>> 0;
    }
    const hue = h % 360;
    return `oklch(0.72 0.13 ${hue})`;
  }

  function isGhost(c: PathCollection): boolean {
    return isGhostPath(c, rootName, collections);
  }
  function isArchived(c: PathCollection): boolean {
    return c.archived === true;
  }

  let sorted = $derived(
    [...collections].sort((a, b) => {
      if (a.name === rootName) return -1;
      if (b.name === rootName) return 1;
      const ag = isGhost(a) || isArchived(a) ? 1 : 0;
      const bg = isGhost(b) || isArchived(b) ? 1 : 0;
      if (ag !== bg) return ag - bg;
      return (b.members?.length ?? 0) - (a.members?.length ?? 0);
    }),
  );
</script>

<div class="h-full overflow-y-auto px-6 py-5">
  <div class="max-w-[760px] mx-auto flex flex-col gap-3">
    {#each sorted as coll (coll.name)}
      {@const isSelected = coll.name === selectedPath}
      {@const isCurrent = coll.name === currentPathName}
      {@const isRoot = coll.name === rootName}
      {@const ghost = isGhost(coll)}
      {@const archived = isArchived(coll)}
      {@const noteCount = coll.members?.length ?? 0}
      {@const accent = accentFor(coll.name)}
      {@const mainNoteTitle = coll.main_note ? titleFor.get(coll.main_note) : undefined}
      {@const created = coll.created_at
        ? relativeTime(new Date(coll.created_at * 1000).toISOString())
        : null}
      {@const otherMemberTitles = (coll.members ?? [])
        .filter((slug) => slug !== coll.main_note)
        .map((slug) => titleFor.get(slug) || slug)}
      {@const previewChips = otherMemberTitles.slice(0, 3)}
      {@const moreCount = Math.max(0, otherMemberTitles.length - previewChips.length)}
      <button
        type="button"
        onclick={() => onSelect(isSelected ? null : coll.name)}
        class="group relative text-left rounded-lg border transition px-4 py-3 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-yel focus-visible:ring-offset-2 focus-visible:ring-offset-bg {isSelected
          ? 'border-yel bg-yelp/40 shadow-[0_0_0_1px_var(--yel)]'
          : archived
          ? 'border-bd2 bg-s1/30 opacity-50 hover:opacity-100'
          : ghost
          ? 'border-bd2 bg-s1/40 opacity-70 hover:opacity-100'
          : 'border-bd hover:border-bd2 hover:bg-s1/60'}"
        style:border-left-width="3px"
        style:border-left-color={accent}
      >
        <div class="flex items-baseline gap-2 mb-1">
          <span
            aria-hidden="true"
            class="inline-block w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
            style:background={accent}
          ></span>
          <h3 class="font-serif text-base text-char truncate {ghost ? 'italic' : ''}">
            {coll.name}
          </h3>
          {#if isRoot}
            <span class="text-2xs uppercase tracking-wider text-yeld font-mono shrink-0">
              {t("paths.road.cardMain")}
            </span>
          {/if}
          {#if isCurrent && !isRoot}
            <span class="text-2xs uppercase tracking-wider text-yeld font-mono shrink-0">
              {t("paths.road.cardYouAreHere")}
            </span>
          {/if}
          {#if ghost}
            <span class="text-2xs uppercase tracking-wider text-t3 font-mono shrink-0">
              {t("paths.road.cardWasMain")}
            </span>
          {/if}
          {#if archived && !ghost}
            <span class="text-2xs uppercase tracking-wider text-t3 font-mono shrink-0 italic">
              {t("paths.archive.archivedBadge")}
            </span>
          {/if}
          <span class="ml-auto text-2xs font-mono text-t3 shrink-0">
            {noteCount === 1
              ? t("paths.road.popoverNote", { count: String(noteCount) })
              : t("paths.road.popoverNotePlural", { count: String(noteCount) })}
          </span>
        </div>
        {#if !isRoot && (divergenceByPath[coll.name] ?? 0) > 0}
          <div class="text-2xs font-mono text-yeld ml-[18px] mb-1">
            {divergenceByPath[coll.name]} differ from {rootName}
          </div>
        {/if}
        {#if coll.condition}
          <div class="font-serif italic text-sm text-t2 leading-snug ml-[18px] mb-1.5">
            {coll.condition}
          </div>
        {/if}
        {#if mainNoteTitle}
          <div class="text-2xs text-t3 font-mono ml-[18px] truncate">
            ★ {mainNoteTitle}
          </div>
        {/if}
        {#if previewChips.length > 0}
          <div class="flex flex-wrap gap-1 ml-[18px] mt-1.5">
            {#each previewChips as title, i (i)}
              <span class="px-1.5 py-0.5 bg-s2 rounded-sm text-[10px] text-t2 truncate max-w-[140px]">
                {title}
              </span>
            {/each}
            {#if moreCount > 0}
              <span class="px-1.5 py-0.5 text-[10px] text-t3 italic">
                {t("paths.pane.suggestionMore", { count: String(moreCount) })}
              </span>
            {/if}
          </div>
        {/if}
        {#if created && !ghost}
          <div class="text-2xs text-t3 ml-[18px] mt-1.5 italic">{created}</div>
        {/if}
        {#if !isRoot && !ghost}
          <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition pointer-events-auto">
            <!-- svelte-ignore node_invalid_placement_ssr -->
            <button
              type="button"
              onclick={(e) => {
                e.stopPropagation();
                onAddFork(coll.name);
              }}
              class="text-2xs px-2 py-1 rounded-sm border border-bd text-t2 hover:bg-s2 hover:text-char inline-flex items-center gap-1"
              title={t("paths.pane.newPathFromRootTitle", { root: coll.name })}
            >
              <NewDirectionIcon size={11} />
              <span>+</span>
            </button>
          </div>
        {/if}
      </button>
    {/each}
  </div>
</div>
