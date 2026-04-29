<script lang="ts">
  import type { Snippet } from "svelte";
  import { tr } from "../../../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    onInsertWikilink: () => void;
    onInsertTask: () => void;
    onInsertTable: () => void;
    onInsertCallout: () => void;
    onInsertTimer: () => void;
    onClipRecipe: () => void;
    onAddToShoppingList: () => void;
    wikilinkDisabled?: boolean;
    shoppingDisabled?: boolean;
    cookingEnabled?: boolean;
  }

  let {
    open,
    onClose,
    onInsertWikilink,
    onInsertTask,
    onInsertTable,
    onInsertCallout,
    onInsertTimer,
    onClipRecipe,
    onAddToShoppingList,
    wikilinkDisabled,
    shoppingDisabled,
    cookingEnabled,
  }: Props = $props();
  let t = $derived(tr());

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function fire(action: () => void) {
    onClose();
    window.setTimeout(action, 0);
  }
</script>

{#snippet modalBtn(icon: Snippet, label: string, keys: string, disabled: boolean, onClick: () => void)}
  <button
    type="button"
    {disabled}
    onclick={onClick}
    class="bg-bg-soft border border-bd rounded-[12px] px-3 py-4 flex flex-col items-center gap-2 cursor-pointer transition-all duration-150 hover:border-yel hover:bg-yelp hover:-translate-y-0.5 active:translate-y-0 text-char focus:outline-hidden focus:border-yel disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-bd disabled:hover:bg-bg-soft disabled:hover:translate-y-0"
  >
    <span class="w-7 h-7 grid place-items-center text-yeld">{@render icon()}</span>
    <span class="font-serif font-medium text-[13.5px] leading-tight tracking-tight text-center">
      {label}
    </span>
    <span class="font-mono text-[9.5px] tracking-wider text-t3 uppercase">
      {keys}
    </span>
  </button>
{/snippet}

{#if open}
  <div
    class="fixed inset-0 z-180 flex items-center justify-center bg-char/30 backdrop-blur-xs animate-fadeIn"
    onmousedown={onClose}
    role="dialog"
    aria-modal="true"
    aria-labelledby="inserts-title"
    tabindex="-1"
  >
    <div
      class="w-[560px] max-w-[calc(100vw-48px)] bg-bg border border-bd2 rounded-[20px] shadow-2xl px-9 pt-8 pb-6 relative animate-slideUp"
      onmousedown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <h2
        id="inserts-title"
        class="text-center font-serif text-[26px] leading-tight tracking-tight text-char mb-1"
      >
        {t("modals.inserts.title")}
      </h2>
      <p class="text-center text-t2 text-[13px] italic mb-6 font-serif">
        {t("modals.inserts.subtitle")}
      </p>

      <div class="grid grid-cols-4 gap-3 mb-3">
        {#snippet wikilinkIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        {/snippet}
        {@render modalBtn(wikilinkIcon, t("modals.inserts.btn.wikilink"), t("modals.inserts.keys.wikilink"), !!wikilinkDisabled, () => fire(onInsertWikilink))}
        {#snippet taskIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="16" height="16" rx="2" />
            <path d="m7 12 3 3 7-7" />
          </svg>
        {/snippet}
        {@render modalBtn(taskIcon, t("modals.inserts.btn.task"), t("modals.inserts.keys.task"), false, () => fire(onInsertTask))}
        {#snippet tableIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M9 4v16M15 4v16" />
          </svg>
        {/snippet}
        {@render modalBtn(tableIcon, t("modals.inserts.btn.table"), t("modals.inserts.keys.table"), false, () => fire(onInsertTable))}
        {#snippet calloutIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4l-4 4v-4H6a2 2 0 0 1-2-2Z" />
            <path d="M12 8v4M12 14h.01" />
          </svg>
        {/snippet}
        {@render modalBtn(calloutIcon, t("modals.inserts.btn.callout"), t("modals.inserts.keys.callout"), false, () => fire(onInsertCallout))}
      </div>

      {#if cookingEnabled}
        <div class="text-2xs uppercase tracking-wider text-t3 mt-4 mb-2 font-mono">
          {t("modals.inserts.recipeGroup")}
        </div>
        <div class="grid grid-cols-3 gap-3">
          {#snippet timerIcon()}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="13" r="7" />
              <path d="M12 9v4l2.5 2" />
              <path d="M9 3h6" />
            </svg>
          {/snippet}
          {@render modalBtn(timerIcon, t("modals.inserts.btn.timer"), t("modals.inserts.keys.timer"), false, () => fire(onInsertTimer))}
          {#snippet recipeUrlIcon()}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
              <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
            </svg>
          {/snippet}
          {@render modalBtn(recipeUrlIcon, t("modals.inserts.btn.clipRecipe"), t("modals.inserts.keys.clipRecipe"), false, () => fire(onClipRecipe))}
          {#snippet shoppingIcon()}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 7h14l-1.4 11.2a1.5 1.5 0 0 1-1.5 1.3H7.9a1.5 1.5 0 0 1-1.5-1.3L5 7z" />
              <path d="M9 10V6a3 3 0 0 1 6 0v4" />
            </svg>
          {/snippet}
          {@render modalBtn(shoppingIcon, t("modals.inserts.btn.shoppingList"), t("modals.inserts.keys.shoppingList"), !!shoppingDisabled, () => fire(onAddToShoppingList))}
        </div>
      {/if}

      <div class="mt-5 pt-4 border-t border-bd flex items-center justify-end text-[12.5px] text-t3">
        <span>
          <kbd class="font-mono text-[10.5px] bg-s1 border border-bd px-1.5 py-0.5 rounded-sm text-t2">
            esc
          </kbd>{" "}
          {t("modals.inserts.escHint")}
        </span>
      </div>
    </div>
  </div>
{/if}
