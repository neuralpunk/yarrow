<script lang="ts">
  import { api } from "../lib/tauri";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();
  let t = $derived(tr());

  let text = $state("");
  let saving = $state(false);
  let savedFlash = $state(false);
  let ref = $state<HTMLTextAreaElement | null>(null);

  $effect(() => {
    if (open) {
      text = "";
      const id = window.setTimeout(() => ref?.focus(), 20);
      return () => window.clearTimeout(id);
    }
  });

  async function save() {
    const entry = text.trim();
    if (!entry) {
      onClose();
      return;
    }
    saving = true;
    try {
      await api.appendScratchpad(entry);
      savedFlash = true;
      text = "";
      setTimeout(() => {
        savedFlash = false;
        onClose();
      }, 450);
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-55 flex items-start justify-center pt-24 bg-char/30 animate-fadeIn"
    onmousedown={onClose}
    role="presentation"
  >
    <div
      class="w-full max-w-xl mx-4 bg-bg border border-bd rounded-xl shadow-2xl overflow-hidden"
      onmousedown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="px-4 py-2 border-b border-bd bg-s1 flex items-center gap-2">
        <span class="font-serif text-base text-char">{t("modals.capture.title")}</span>
        <span class="text-2xs text-t3">{t("modals.capture.subtitle")}</span>
        <span class="ml-auto text-2xs text-t3 font-mono">{t("modals.capture.shortcutHint")}</span>
      </div>
      <textarea
        bind:this={ref}
        bind:value={text}
        onkeydown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
        placeholder={t("modals.capture.placeholder")}
        class="w-full min-h-[140px] max-h-[300px] p-5 bg-bg text-char outline-hidden resize-none font-sans leading-relaxed"
      ></textarea>
      <div class="px-4 py-2 border-t border-bd bg-s1 flex items-center">
        {#if savedFlash}
          <span class="text-2xs text-yeld">{t("modals.capture.saved")}</span>
        {/if}
        <div class="ml-auto flex gap-2">
          <button
            onclick={onClose}
            class="px-3 py-1 text-xs text-t2 hover:text-char"
          >{t("modals.capture.cancel")}</button>
          <button
            onclick={save}
            disabled={saving || !text.trim()}
            class="btn-yel px-3 py-1 text-xs rounded-md disabled:opacity-40"
          >{t("modals.capture.action")}</button>
        </div>
      </div>
    </div>
  </div>
{/if}
