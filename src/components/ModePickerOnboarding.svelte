<script lang="ts">
  import { tr } from "../lib/i18n/index.svelte";
  import type { ModeId } from "../lib/modes";

  interface Props {
    open: boolean;
    onPick: (mode: ModeId) => void;
    onSkip: () => void;
  }

  let { open, onPick, onSkip }: Props = $props();
  let t = $derived(tr());

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fadeIn"
    style:background="rgba(28, 22, 14, 0.45)"
    onmousedown={onSkip}
    role="dialog"
    aria-modal="true"
    aria-labelledby="yarrow-mode-picker-title"
    tabindex="-1"
  >
    <div
      onmousedown={(e) => e.stopPropagation()}
      class="w-full max-w-[680px] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
      role="presentation"
    >
      <div class="px-8 pt-8 pb-2">
        <div
          id="yarrow-mode-picker-title"
          class="font-serif text-[28px] text-char leading-tight"
        >
          {t("intro.modePicker.title")}
        </div>
        <p class="text-sm text-t2 leading-relaxed mt-3 max-w-[52ch]">
          {t("intro.modePicker.subtitle")}
        </p>
      </div>

      <div class="px-8 pt-6 pb-4 grid gap-3" style:grid-template-columns="1fr 1fr">
        <button
          type="button"
          onclick={() => onPick("basic")}
          class="text-left px-5 py-5 rounded-lg border bg-bg-soft transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-yel/60 border-bd2 hover:border-t2 hover:bg-bg [&_.mode-card-accent]:bg-t2"
        >
          <div class="flex items-center gap-2">
            <span class="mode-card-accent inline-block w-1.5 h-5 rounded-full" aria-hidden="true"></span>
            <span class="text-t3" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
                <line x1="2.5" y1="4" x2="11.5" y2="4" />
                <line x1="2.5" y1="7" x2="9.5" y2="7" />
                <line x1="2.5" y1="10" x2="10.5" y2="10" />
              </svg>
            </span>
            <span class="font-serif text-[18px] text-char">{t("intro.modePicker.quietTitle")}</span>
          </div>
          <p class="text-xs text-t2 leading-relaxed mt-2.5">{t("intro.modePicker.quietBody")}</p>
        </button>

        <button
          type="button"
          onclick={() => onPick("path")}
          class="text-left px-5 py-5 rounded-lg border bg-bg-soft transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-yel/60 border-yel/50 hover:border-yel hover:bg-yelp/40 [&_.mode-card-accent]:bg-yel"
        >
          <div class="flex items-center gap-2">
            <span class="mode-card-accent inline-block w-1.5 h-5 rounded-full" aria-hidden="true"></span>
            <span class="text-t3" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="3" cy="3.5" r="1.4" />
                <circle cx="3" cy="10.5" r="1.4" />
                <circle cx="11" cy="7" r="1.4" />
                <path d="M3 4.9v4.2M4.2 4.4l5.6 1.8M4.2 9.6l5.6-1.8" />
              </svg>
            </span>
            <span class="font-serif text-[18px] text-char">{t("intro.modePicker.fullTitle")}</span>
          </div>
          <p class="text-xs text-t2 leading-relaxed mt-2.5">{t("intro.modePicker.fullBody")}</p>
        </button>
      </div>

      <div class="px-8 pb-6 pt-2 flex items-center justify-between gap-4">
        <span class="text-2xs text-t3 italic max-w-[40ch]">
          {t("intro.modePicker.changeHint")}
        </span>
        <button
          type="button"
          onclick={onSkip}
          class="text-xs text-t2 hover:text-char underline underline-offset-4"
        >
          {t("intro.modePicker.skip")}
        </button>
      </div>
    </div>
  </div>
{/if}
