<script lang="ts">
  import type { Snippet } from "svelte";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    title?: string;
    width?: string;
    /**
     * Render a small X close affordance in the top-right. Default true
     * since most modals want it. Callers that display their own bespoke
     * header (e.g. a full-screen wizard with its own chrome) can pass
     * `showClose={false}` to suppress.
     */
    showClose?: boolean;
    children: Snippet;
  }

  let {
    open,
    onClose,
    title,
    width = "w-[420px]",
    showClose = true,
    children,
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
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-char/10"
    onmousedown={onClose}
    role="presentation"
  >
    <div
      class="{width} bg-bg border border-bd2 rounded-xl shadow-2xl p-5 relative mac-sheet"
      onmousedown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      {#if showClose}
        <button
          type="button"
          onclick={onClose}
          aria-label={t("modals.modal.close")}
          title={t("modals.modal.closeEsc")}
          class="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-char hover:bg-s2 transition"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          >
            <path d="M 3 3 L 11 11 M 11 3 L 3 11" />
          </svg>
        </button>
      {/if}
      {#if title}
        <h2 class="font-serif text-xl mb-3 text-char pr-8">{title}</h2>
      {/if}
      {@render children()}
    </div>
  </div>
{/if}
