<script lang="ts">
  // Sidebar tag list with persona-group folders.
  //
  // Tags are bucketed by their `TagDef.group` (looked up via
  // `tagsStore.get(name)`). Pack-seeded tags get this stamped at apply
  // time; user-typed tags can have any string. Anything ungrouped
  // (including tags that exist on notes but have no TagDef yet — e.g.
  // ad-hoc tags typed straight into the chip strip) falls into an
  // "Other" bucket that's only rendered when it's non-empty.
  //
  // Each group renders as a collapsible header. Collapsed-state is
  // persisted per-workspace under `yarrow.taglist.collapsed.v1` so
  // collapsing "Recipes" in one vault doesn't bleed into another.

  import type { TagCount } from "../../lib/types";
  import { ChevronRightIcon } from "../../lib/iconsSvelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import { tags as tagsStore } from "../../lib/tags.svelte";
  import {
    KNOWN_GROUPS,
    OTHER_GROUP,
    fallbackGroupLabel,
    groupSortKey,
    groupSwatchClass,
  } from "../../lib/personaGroups";
  import {
    workspaceScope,
    readScoped,
    wsKey,
    writeScoped,
  } from "../../lib/workspaceScope.svelte";

  interface Props {
    tags: TagCount[];
    activeTag: string | null;
    onSelect: (tag: string | null) => void;
  }

  let { tags, activeTag, onSelect }: Props = $props();
  let t = $derived(tr());

  const COLLAPSED_KEY = "yarrow.taglist.collapsed.v1";
  const COLLAPSED_EVT = "yarrow:taglist-collapsed-changed";

  function readCollapsed(): Set<string> {
    const raw = readScoped(COLLAPSED_KEY);
    if (!raw) return new Set();
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    } catch {
      return new Set();
    }
  }

  let collapsed = $state<Set<string>>(readCollapsed());

  $effect(() => {
    void workspaceScope.scope;
    collapsed = readCollapsed();
  });

  $effect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === COLLAPSED_KEY || e.key === wsKey(COLLAPSED_KEY)) {
        collapsed = readCollapsed();
      }
    };
    const onCustom = () => { collapsed = readCollapsed(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(COLLAPSED_EVT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(COLLAPSED_EVT, onCustom);
    };
  });

  function toggleGroup(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    collapsed = next;
    writeScoped(COLLAPSED_KEY, JSON.stringify([...next]));
    window.dispatchEvent(new CustomEvent(COLLAPSED_EVT));
  }

  function groupLabelFor(id: string): string {
    if (id === OTHER_GROUP) return t("sidebar.tags.groupOther");
    const known = KNOWN_GROUPS[id];
    if (known) return t(known.labelKey);
    return fallbackGroupLabel(id);
  }

  interface GroupBucket {
    id: string;
    label: string;
    swatch: string;
    items: TagCount[];
    count: number;
  }

  let bucketed = $derived.by<GroupBucket[]>(() => {
    void tagsStore.config;
    const buckets = new Map<string, TagCount[]>();
    for (const tc of tags) {
      const def = tagsStore.get(tc.tag);
      const id = def?.group && def.group.length > 0 ? def.group : OTHER_GROUP;
      const list = buckets.get(id);
      if (list) list.push(tc); else buckets.set(id, [tc]);
    }
    const out: GroupBucket[] = [];
    for (const [id, items] of buckets) {
      out.push({
        id,
        label: groupLabelFor(id),
        swatch: groupSwatchClass(id),
        items,
        count: items.reduce((sum, x) => sum + x.count, 0),
      });
    }
    out.sort((a, b) => {
      const [ao, an] = groupSortKey(a.id);
      const [bo, bn] = groupSortKey(b.id);
      if (ao !== bo) return ao - bo;
      return an.localeCompare(bn);
    });
    return out;
  });
</script>

{#if tags.length > 0}
  <div class="px-2 pt-3 pb-2">
    <div class="px-2 mb-1.5 text-2xs uppercase tracking-wider text-t3 font-semibold">
      <span>{t("sidebar.tags.title")}</span>
      <span class="text-t3/60 font-mono normal-case tracking-normal ml-1">· {tags.length}</span>
    </div>

    {#each bucketed as bucket (bucket.id)}
      {@const isCollapsed = collapsed.has(bucket.id)}
      <div class="mb-1">
        <button
          type="button"
          onclick={() => toggleGroup(bucket.id)}
          class="w-full flex items-center gap-1.5 px-2 py-1 rounded text-2xs uppercase tracking-wider text-t2 hover:bg-s2 hover:text-char transition"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed
            ? t("sidebar.tags.groupExpand", { group: bucket.label })
            : t("sidebar.tags.groupCollapse", { group: bucket.label })}
        >
          <span
            class="inline-flex items-center transition-transform"
            style:transform={isCollapsed ? "none" : "rotate(90deg)"}
          >
            <ChevronRightIcon />
          </span>
          <span class="w-1.5 h-1.5 rounded-full {bucket.swatch} shrink-0"></span>
          <span class="truncate">{bucket.label}</span>
          <span class="ml-auto text-t3/60 font-mono normal-case tracking-normal">
            {bucket.items.length}
          </span>
        </button>

        {#if !isCollapsed}
          <ul class="mt-0.5 space-y-0.5">
            {#each bucket.items as tg (tg.tag)}
              {@const isActive = activeTag === tg.tag}
              <li>
                <button
                  type="button"
                  onclick={() => onSelect(isActive ? null : tg.tag)}
                  class="w-full text-left pl-7 pr-2 py-1 rounded text-xs flex items-center gap-2 transition {isActive
                    ? 'bg-yelp text-yeld'
                    : 'text-t2 hover:bg-s2 hover:text-char'}"
                >
                  <span class="font-mono text-t3">#</span>
                  <span class="truncate flex-1">{tg.tag}</span>
                  <span class="text-2xs text-t3 font-mono">{tg.count}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>
{/if}
