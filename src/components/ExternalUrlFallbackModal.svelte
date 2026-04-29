<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { EXTERNAL_FALLBACK_EVENT } from "../lib/openExternal";
  import { tr } from "../lib/i18n/index.svelte";

  // Shown only when handing a URL off to the OS browser fails. Modern
  // desktop platforms make that essentially never happen, but if it
  // does the user still needs a way to see the URL, copy it, retry, or
  // close — never trapped. Renders an iframe so sites that permit
  // embedding still load inline; sites that block embedding just show
  // a blank pane, but the chrome bar always works.

  let url = $state<string | null>(null);
  let copied = $state(false);
  let copiedTimer = 0;
  let t = $derived(tr());

  $effect(() => {
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url) url = detail.url;
    };
    window.addEventListener(EXTERNAL_FALLBACK_EVENT, onEvt);
    return () => window.removeEventListener(EXTERNAL_FALLBACK_EVENT, onEvt);
  });

  $effect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") url = null;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    url = null;
    if (copiedTimer) {
      window.clearTimeout(copiedTimer);
      copiedTimer = 0;
    }
    copied = false;
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      if (copiedTimer) window.clearTimeout(copiedTimer);
      copiedTimer = window.setTimeout(() => {
        copied = false;
        copiedTimer = 0;
      }, 1400);
    } catch {
      // No clipboard permission — leave the URL visible so the user
      // can select it manually from the address bar.
    }
  }

  function retry() {
    if (!url) return;
    openUrl(url).then(close).catch(() => {
      // Still failing — keep the modal open. User has copy + close.
    });
  }
</script>

{#if url}
  <div
    class="fixed inset-0 z-100 flex flex-col bg-bg"
    role="dialog"
    aria-modal="true"
    aria-label={t("modals.externalUrl.dialogLabel")}
  >
    <div class="flex items-center gap-2 px-3 py-2 border-b border-bd2 bg-s1 text-sm">
      <span class="text-t3 text-xs shrink-0">
        {t("modals.externalUrl.urlLabel")}
      </span>
      <span
        class="font-mono text-xs text-char truncate flex-1 select-text"
        title={url}
      >
        {url}
      </span>
      <button
        type="button"
        onclick={copy}
        class="px-2 py-1 rounded-sm text-xs text-t2 hover:text-char hover:bg-s2 transition"
      >
        {copied ? t("modals.externalUrl.copied") : t("modals.externalUrl.copy")}
      </button>
      <button
        type="button"
        onclick={retry}
        class="px-2 py-1 rounded-sm text-xs text-t2 hover:text-char hover:bg-s2 transition"
      >
        {t("modals.externalUrl.openInBrowser")}
      </button>
      <button
        type="button"
        onclick={close}
        aria-label={t("modals.modal.closeEsc")}
        title={t("modals.modal.closeEsc")}
        class="w-7 h-7 rounded-sm flex items-center justify-center text-t3 hover:text-char hover:bg-s2 transition"
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
    </div>
    <iframe
      src={url}
      class="flex-1 w-full bg-bg"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      referrerpolicy="no-referrer"
      title={t("modals.externalUrl.iframeTitle", { url })}
    ></iframe>
  </div>
{/if}
