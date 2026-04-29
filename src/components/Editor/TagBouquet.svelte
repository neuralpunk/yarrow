<script lang="ts">
  import { api } from "../../lib/tauri";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    slug: string;
    title: string;
    body: string;
    existingTags: string[];
    onAdopt: (tag: string) => void;
    locked?: boolean;
  }

  let { slug, title, body, existingTags, onAdopt, locked }: Props = $props();
  let t = $derived(tr());

  const COLLAPSED_VISIBLE = 2;

  let suggestions = $state<string[]>([]);
  let dismissed = $state(false);
  let expanded = $state(false);
  // svelte-ignore state_referenced_locally
  let lastSlug = $state(slug);

  $effect(() => {
    if (lastSlug !== slug) {
      lastSlug = slug;
      dismissed = false;
      expanded = false;
      suggestions = [];
    }
  });

  $effect(() => {
    void slug;
    void body;
    void title;
    void existingTags;
    if (locked) {
      suggestions = [];
      return;
    }
    if (dismissed) return;
    if (body.trim().length < 20) {
      suggestions = [];
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const next = await api.suggestTags(body, title, existingTags, 5);
        if (!cancelled) suggestions = next;
      } catch {
        if (!cancelled) suggestions = [];
      }
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  });

  let visible = $derived(expanded ? suggestions : suggestions.slice(0, COLLAPSED_VISIBLE));
  let hiddenCount = $derived(Math.max(0, suggestions.length - visible.length));
</script>

{#if !locked && !dismissed && suggestions.length > 0}
  <div class="-mt-1 mb-3 px-0">
    <div class="flex items-baseline gap-2 flex-wrap">
      <span class="text-2xs uppercase tracking-[0.14em] text-t3 font-sans">
        {t("editor.tagBouquet.suggested")}
      </span>
      {#each visible as tag (tag)}
        <button
          onclick={() => {
            suggestions = suggestions.filter((x) => x !== tag);
            onAdopt(tag);
          }}
          class="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-bg border border-dashed border-bd2 text-t2 hover:bg-yelp hover:border-yel hover:text-yeld font-mono transition"
          title={t("editor.tagBouquet.addTitle", { tag })}
        >
          <span class="text-yel">+</span>
          <span>#{tag}</span>
        </button>
      {/each}
      {#if hiddenCount > 0}
        <button
          onclick={() => (expanded = true)}
          class="text-2xs text-t3 hover:text-yeld font-mono"
          title={t("editor.tagBouquet.moreTitle", { count: String(hiddenCount) })}
        >
          {t("editor.tagBouquet.more", { count: String(hiddenCount) })}
        </button>
      {/if}
      <button
        onclick={() => (dismissed = true)}
        class="ml-1 text-2xs text-t3 hover:text-ch2"
        title={t("editor.tagBouquet.dismissTitle")}
      >
        {t("editor.tagBouquet.dismiss")}
      </button>
    </div>
  </div>
{/if}
