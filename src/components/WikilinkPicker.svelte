<script lang="ts">
  import Modal from "./Modal.svelte";
  import type { NoteSummary } from "../lib/types";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    notes: NoteSummary[];
    currentSlug?: string;
    onInsert: (text: string) => void;
  }

  let { open, onClose, notes, currentSlug, onInsert }: Props = $props();
  let t = $derived(tr());

  let query = $state("");
  let embed = $state(false);
  let cursor = $state(0);
  let inputRef = $state<HTMLInputElement | null>(null);
  let listRef = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!open) return;
    query = "";
    embed = false;
    cursor = 0;
    const id = window.setTimeout(() => inputRef?.focus(), 30);
    return () => window.clearTimeout(id);
  });

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const pool = notes.filter((n) => n.slug !== currentSlug);
    if (!q) return pool.slice(0, 50);
    return pool
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) || n.slug.toLowerCase().includes(q),
      )
      .slice(0, 50);
  });

  $effect(() => {
    if (cursor >= filtered.length) cursor = Math.max(0, filtered.length - 1);
  });

  $effect(() => {
    const container = listRef;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  });

  function commit(note?: NoteSummary) {
    const target = note ?? filtered[cursor];
    if (!target) return;
    const label = target.title || target.slug;
    const text = embed ? `![[${label}]]` : `[[${label}]]`;
    onInsert(text);
    onClose();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      cursor = Math.min(cursor + 1, Math.max(0, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cursor = Math.max(cursor - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }
</script>

<Modal {open} {onClose} width="w-[480px]">
  {#snippet children()}
    <div class="flex items-baseline justify-between mb-3">
      <h2 class="font-serif text-xl text-char">{t("modals.wikilink.title")}</h2>
      <span class="font-mono text-2xs text-t3">
        {filtered.length === 1
          ? t("modals.wikilink.matchOne", { count: String(filtered.length) })
          : t("modals.wikilink.matchMany", { count: String(filtered.length) })}
      </span>
    </div>

    <input
      bind:this={inputRef}
      bind:value={query}
      oninput={() => { cursor = 0; }}
      onkeydown={onKeyDown}
      placeholder={t("modals.wikilink.searchPlaceholder")}
      class="w-full px-3 py-2 bg-s1 border border-bd rounded-md text-sm text-char placeholder:text-t3 outline-hidden focus:border-yeld"
    />

    <div
      bind:this={listRef}
      class="mt-3 max-h-[320px] overflow-y-auto rounded-md border border-bd divide-y divide-bd"
    >
      {#if filtered.length === 0}
        <div class="px-3 py-8 text-center text-xs text-t3 font-serif italic">
          {notes.length <= 1
            ? t("modals.wikilink.empty")
            : t("modals.wikilink.noMatch")}
        </div>
      {:else}
        {#each filtered as n, i (n.slug)}
          <button
            data-idx={i}
            onmouseenter={() => (cursor = i)}
            onclick={() => commit(n)}
            class="w-full text-left px-3 py-2 flex items-baseline gap-3 transition {i === cursor
              ? 'bg-yelp'
              : 'hover:bg-s2'}"
          >
            <span class="flex-1 truncate text-char text-sm">
              {n.title || n.slug}
            </span>
            <span class="font-mono text-2xs text-t3 truncate max-w-[180px]">
              {n.slug}
            </span>
          </button>
        {/each}
      {/if}
    </div>

    <div class="mt-4 flex items-center justify-between">
      <label class="flex items-center gap-2 text-xs text-t2 cursor-pointer select-none">
        <input
          type="checkbox"
          bind:checked={embed}
          class="accent-yeld"
        />
        <span>
          {t("modals.wikilink.embedLabel")} (<code class="font-mono text-2xs">![[…]]</code>)
        </span>
      </label>

      <div class="flex items-center gap-2">
        <button
          onclick={onClose}
          class="px-3 py-1.5 text-xs text-t2 hover:text-char transition"
        >
          {t("modals.wikilink.cancel")}
        </button>
        <button
          onclick={() => commit()}
          disabled={filtered.length === 0}
          class="px-3 py-1.5 text-xs rounded-md bg-char text-bg hover:bg-yeld transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("modals.wikilink.insert")}
        </button>
      </div>
    </div>

    <div class="mt-3 font-serif italic text-2xs text-t3">
      {t("modals.wikilink.shortcutHint")}
    </div>
  {/snippet}
</Modal>
