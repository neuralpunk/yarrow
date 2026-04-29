<script lang="ts">
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    word: string;
    suggestions: string[];
    /** Range in the editor doc to replace when a suggestion is picked. */
    from: number;
    to: number;
    /** Anchor coordinates (window-relative). */
    x: number;
    y: number;
    onClose: () => void;
    /** Persist the word into the workspace dictionary. */
    onAddToDictionary: (word: string) => void;
  }

  let { word, suggestions, from, to, x, y, onClose, onAddToDictionary }: Props =
    $props();
  let t = $derived(tr());
  let ref = $state<HTMLDivElement | null>(null);

  $effect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref && !ref.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  });

  function replace(text: string) {
    window.dispatchEvent(
      new CustomEvent("yarrow:editor-replace-range", {
        detail: { from, to, text },
      }),
    );
    onClose();
  }

  // Clamp to viewport so the popover never spills off the right/bottom edges.
  const W = 220;
  const H = 240;
  let left = $derived(Math.min(x, window.innerWidth - W - 8));
  let top = $derived(Math.min(y, window.innerHeight - H - 8));
</script>

<div
  bind:this={ref}
  style:left="{left}px"
  style:top="{top}px"
  style:width="{W}px"
  class="fixed z-60 bg-bg border border-bd2 rounded-lg shadow-2xl py-1.5 text-xs animate-fadeIn"
>
  <div class="px-3 pb-1.5 border-b border-bd text-2xs text-t3 font-mono uppercase tracking-wider">
    “{word}”
  </div>
  {#if suggestions.length === 0}
    <div class="px-3 py-2 italic text-t3 font-serif">
      {t("modals.spell.noSuggestions")}
    </div>
  {:else}
    <ul class="max-h-44 overflow-y-auto">
      {#each suggestions as s (s)}
        <li>
          <button
            onclick={() => replace(s)}
            class="w-full text-left px-3 py-1.5 text-char hover:bg-yelp"
          >
            {s}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="border-t border-bd mt-1 pt-1">
    <button
      onclick={() => { onAddToDictionary(word); onClose(); }}
      class="w-full text-left px-3 py-1.5 text-t2 hover:bg-s2 hover:text-char"
    >
      {t("modals.spell.addToDictionary", { word })}
    </button>
  </div>
</div>
