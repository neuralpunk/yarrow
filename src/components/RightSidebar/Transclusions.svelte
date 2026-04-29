<script lang="ts">
  import { api } from "../../lib/tauri";
  import type { NoteSummary } from "../../lib/types";
  import { parseEmbeds, resolveEmbed, type Embed } from "../../lib/transclusion";
  import { slugify } from "../../lib/format";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    body: string;
    notes: NoteSummary[];
    onNavigate: (slug: string) => void;
    refreshToken?: number;
  }

  let { body, notes, onNavigate, refreshToken }: Props = $props();
  let t = $derived(tr());

  interface Resolved {
    embed: Embed;
    targetSlug: string | null;
    targetTitle: string;
    content: string;
  }

  let resolved = $state<Resolved[]>([]);

  $effect(() => {
    void refreshToken;
    let alive = true;
    const embeds = parseEmbeds(body);
    if (embeds.length === 0) {
      resolved = [];
      return;
    }
    (async () => {
      const titleIndex = new Map<string, NoteSummary>();
      for (const n of notes) {
        titleIndex.set(n.slug, n);
        titleIndex.set(n.title.toLowerCase(), n);
      }
      const out: Resolved[] = [];
      for (const e of embeds) {
        const direct =
          titleIndex.get(e.target) ||
          titleIndex.get(e.target.toLowerCase()) ||
          titleIndex.get(slugify(e.target));
        if (!direct) {
          out.push({ embed: e, targetSlug: null, targetTitle: e.target, content: "" });
          continue;
        }
        try {
          const n = await api.readNote(direct.slug);
          out.push({
            embed: e,
            targetSlug: direct.slug,
            targetTitle: direct.title,
            content: resolveEmbed(e, n.body),
          });
        } catch {
          out.push({ embed: e, targetSlug: direct.slug, targetTitle: direct.title, content: "" });
        }
      }
      if (alive) resolved = out;
    })();
    return () => {
      alive = false;
    };
  });
</script>

{#if resolved.length > 0}
  <div class="px-3 py-3 border-t border-bd">
    <div class="flex items-center justify-between mb-2">
      <div class="text-2xs uppercase tracking-wider text-t3 font-semibold">
        {t("sidebar.transclusions.title")}
      </div>
      <span class="text-2xs text-t3">{resolved.length}</span>
    </div>
    <ul class="space-y-2">
      {#each resolved as r, i (i)}
        <li class="bg-bg border-l-2 border-yel/60 pl-3 pr-2 py-1.5 rounded-r">
          <button
            onclick={() => r.targetSlug && onNavigate(r.targetSlug)}
            disabled={!r.targetSlug}
            class="text-xs text-yeld hover:underline disabled:text-danger disabled:no-underline"
            title={r.embed.raw}
          >
            {r.targetTitle}
            {#if r.embed.heading}<span class="text-t3"> › {r.embed.heading}</span>{/if}
            {#if r.embed.blockId}<span class="text-t3"> ^{r.embed.blockId}</span>{/if}
            {#if !r.targetSlug}<span class="text-danger">{t("sidebar.transclusions.notFound")}</span>{/if}
          </button>
          {#if r.content}
            <div class="mt-1 text-2xs text-t2 leading-relaxed whitespace-pre-wrap line-clamp-6">
              {r.content.slice(0, 320)}
              {r.content.length > 320 ? "…" : ""}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
