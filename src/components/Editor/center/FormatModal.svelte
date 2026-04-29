<script lang="ts">
  import type { Snippet } from "svelte";
  import { tr } from "../../../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    selection: string;
    insertRaw: (
      text: string,
      opts?: { caretOffset?: number; atLineStart?: boolean },
    ) => void;
    wrapSelection: (opening: string, closing: string) => void;
  }

  let { open, onClose, selection, insertRaw, wrapSelection }: Props = $props();
  let t = $derived(tr());

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function inlineWrap(opening: string, closing: string, emptyCaret: number) {
    if (selection) {
      wrapSelection(opening, closing);
    } else {
      const text = opening + closing;
      insertRaw(text, { caretOffset: emptyCaret });
    }
    onClose();
  }
</script>

{#snippet modalBtn(icon: Snippet, label: string, keys: string, onClick: () => void)}
  <button
    type="button"
    onclick={onClick}
    class="bg-bg-soft border border-bd rounded-[12px] px-2 py-3 flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-150 hover:border-yel hover:bg-yelp hover:-translate-y-0.5 active:translate-y-0 text-char focus:outline-hidden focus:border-yel"
  >
    <span class="w-7 h-7 grid place-items-center text-yeld">{@render icon()}</span>
    <span class="font-serif font-medium text-[13px] leading-tight tracking-tight text-center">
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
    aria-labelledby="format-title"
    tabindex="-1"
  >
    <div
      class="w-[480px] max-w-[calc(100vw-48px)] bg-bg border border-bd2 rounded-[20px] shadow-2xl px-9 pt-8 pb-6 relative animate-slideUp"
      onmousedown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <h2
        id="format-title"
        class="text-center font-serif text-[26px] leading-tight tracking-tight text-char mb-1"
      >
        {t("modals.format.title")}
      </h2>
      <p class="text-center text-t2 text-[13px] italic mb-6 font-serif">
        {selection
          ? t("modals.format.subtitle.wrap")
          : t("modals.format.subtitle.insert")}
      </p>

      <div class="grid grid-cols-3 gap-3">
        {#snippet headingIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 4v16M18 4v16M6 12h12" />
          </svg>
        {/snippet}
        {@render modalBtn(headingIcon, t("modals.format.btn.heading"), t("modals.format.keys.heading"), () => {
          insertRaw("# ", { atLineStart: true });
          onClose();
        })}
        {#snippet codeIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
          </svg>
        {/snippet}
        {@render modalBtn(codeIcon, t("modals.format.btn.code"), t("modals.format.keys.code"), () => {
          insertRaw("```\n\n```\n", {
            atLineStart: true,
            caretOffset: "```\n".length,
          });
          onClose();
        })}
        {#snippet boldIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 5h6a4 4 0 0 1 0 8H7zM7 13h7a4 4 0 0 1 0 8H7z" />
          </svg>
        {/snippet}
        {@render modalBtn(boldIcon, t("modals.format.btn.bold"), t("modals.format.keys.bold"), () => inlineWrap("**", "**", 2))}
        {#snippet italicIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 4h-9M14 20H5M15 4 9 20" />
          </svg>
        {/snippet}
        {@render modalBtn(italicIcon, t("modals.format.btn.italic"), t("modals.format.keys.italic"), () => inlineWrap("*", "*", 1))}
        {#snippet strikeIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14" />
            <path d="M16 7q-3-2-7-1.5T7 9q0 2 4 3" />
            <path d="M8 17q3 2 7 1.5T17 15" />
          </svg>
        {/snippet}
        {@render modalBtn(strikeIcon, t("modals.format.btn.strikethrough"), t("modals.format.keys.strikethrough"), () => inlineWrap("~~", "~~", 2))}
        {#snippet mathIcon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 19h2L13 5h2" />
            <path d="M9 12h6" />
            <path d="M16 14l4 4M20 14l-4 4" />
          </svg>
        {/snippet}
        {@render modalBtn(mathIcon, t("modals.format.btn.math"), t("modals.format.keys.math"), () => inlineWrap("$", "$", 1))}
      </div>

      <div class="mt-5 pt-4 border-t border-bd flex items-center justify-end text-[12.5px] text-t3">
        <span>
          <kbd class="font-mono text-[10.5px] bg-s1 border border-bd px-1.5 py-0.5 rounded-sm text-t2">
            esc
          </kbd>{" "}
          {t("modals.format.escHint")}
        </span>
      </div>
    </div>
  </div>
{/if}
