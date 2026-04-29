<script lang="ts">
  import { api } from "../lib/tauri";
  import { ScratchpadIcon } from "../lib/iconsSvelte";
  import type { Note } from "../lib/types";
  import { SK } from "../lib/platform.svelte";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    activeNote: Note | null;
    width: number;
    onWidthChange: (w: number) => void;
    reloadNonce?: number;
    onClose: () => void;
    onPromoted: (newSlug: string) => void;
  }

  let {
    activeNote,
    width,
    onWidthChange,
    reloadNonce,
    onClose,
    onPromoted,
  }: Props = $props();
  let t = $derived(tr());

  const MIN_W = 280;
  const MAX_W = 640;

  let content = $state("");
  let title = $state("");
  let linkFromActive = $state(true);
  let busy = $state(false);
  let msg = $state<string | null>(null);
  let flash = $state<null | "sent">(null);
  let saveTimer: number | null = null;
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  let resizing: { startX: number; startW: number } | null = null;

  $effect(() => {
    api
      .readScratchpad()
      .then((c) => (content = c))
      .catch(() => (content = ""));
    const id = window.setTimeout(() => textareaRef?.focus(), 60);
    return () => {
      window.clearTimeout(id);
      if (saveTimer != null) window.clearTimeout(saveTimer);
    };
  });

  $effect(() => {
    if (reloadNonce === undefined || reloadNonce === 0) return;
    api
      .readScratchpad()
      .then((fresh) => {
        content = fresh;
        requestAnimationFrame(() => {
          const ta = textareaRef;
          if (!ta) return;
          ta.scrollTop = ta.scrollHeight;
          ta.setSelectionRange(fresh.length, fresh.length);
        });
      })
      .catch(() => {});
  });

  function onChange(v: string) {
    content = v;
    if (saveTimer != null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      api.saveScratchpad(v).catch(() => {});
    }, 400);
  }

  function suggestedTitle(): string {
    const first = content
      .split("\n")
      .map((s) => s.replace(/^#+\s*/, "").trim())
      .find(Boolean);
    return (first || t("modals.scratchpad.fallbackTitle")).slice(0, 80);
  }

  let trimmed = $derived(content.trim());

  async function keepAsNote() {
    const tt = (title.trim() || suggestedTitle()).trim();
    if (!tt || !trimmed || busy) return;
    busy = true;
    msg = null;
    try {
      const newNote = await api.promoteScratchpad(tt);
      if (linkFromActive && activeNote && newNote.slug !== activeNote.slug) {
        try {
          await api.addLink(activeNote.slug, newNote.slug, "came-from");
        } catch {}
      }
      content = "";
      title = "";
      onPromoted(newNote.slug);
    } catch (e) {
      msg = String(e);
    } finally {
      busy = false;
    }
  }

  function sendToNote() {
    if (!activeNote || !trimmed) return;
    window.dispatchEvent(
      new CustomEvent("yarrow:editor-insert", {
        detail: { text: trimmed },
      }),
    );
    flash = "sent";
    window.setTimeout(() => (flash = null), 1400);
  }

  function clearScratchpad() {
    if (!content) return;
    onChange("");
    textareaRef?.focus();
  }

  function onResizeStart(e: MouseEvent) {
    resizing = { startX: e.clientX, startW: width };
    const onMove = (ev: MouseEvent) => {
      if (!resizing) return;
      const dx = resizing.startX - ev.clientX;
      const next = Math.max(
        MIN_W,
        Math.min(MAX_W, resizing.startW + dx),
      );
      onWidthChange(next);
    };
    const onUp = () => {
      resizing = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  let activeTitle = $derived(
    activeNote?.frontmatter.title || activeNote?.slug || "",
  );
</script>

<aside
  class="relative shrink-0 bg-s1 border-l border-bd flex flex-col animate-slideInRight"
  style:width="{width}px"
>
  <button
    type="button"
    onmousedown={onResizeStart}
    class="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-yel/40 transition z-10"
    title={t("modals.scratchpad.dragResize")}
    aria-label={t("modals.scratchpad.dragResize")}
  ></button>

  <header class="px-3.5 pt-3 pb-2 border-b border-bd">
    <div class="flex items-center gap-2">
      <ScratchpadIcon size={14} />
      <div class="font-serif text-base text-char leading-none">
        {t("modals.scratchpad.title")}
      </div>
      <button
        onclick={clearScratchpad}
        disabled={!content}
        class="ml-auto text-2xs text-t3 hover:text-char disabled:opacity-30"
        title={t("modals.scratchpad.clearTitle")}
      >
        {t("modals.scratchpad.clear")}
      </button>
      <button
        onclick={onClose}
        class="text-t3 hover:text-char w-5 h-5 flex items-center justify-center rounded-sm hover:bg-s2"
        aria-label={t("modals.scratchpad.closeAria")}
        title={t("modals.scratchpad.closeTitle", { shortcut: SK.scratchpad })}
      >
        ×
      </button>
    </div>
    <div class="text-2xs text-t3 italic mt-1">
      {t("modals.scratchpad.notSaved")}
    </div>
  </header>

  {#if activeNote}
    <div class="px-3.5 py-2 border-b border-bd/60 bg-bg/40">
      <div class="flex items-center gap-1.5 text-2xs">
        <span class="text-t3 shrink-0">{t("modals.scratchpad.with")}</span>
        <span class="text-char truncate" title={activeTitle}>
          {activeTitle}
        </span>
      </div>
      <div class="mt-1.5 flex items-center gap-1.5">
        <button
          onclick={sendToNote}
          disabled={!trimmed}
          class="px-2 py-1 text-2xs bg-s2 text-ch2 rounded-sm hover:bg-s3 disabled:opacity-40 flex items-center gap-1"
          title={t("modals.scratchpad.sendTitle")}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 5h6M6 2l2.5 3L6 8" />
          </svg>
          <span>{t("modals.scratchpad.sendToNote")}</span>
        </button>
        {#if flash === "sent"}
          <span class="text-2xs text-yeld italic">{t("modals.scratchpad.inserted")}</span>
        {/if}
      </div>
    </div>
  {/if}

  <textarea
    bind:this={textareaRef}
    value={content}
    oninput={(e) => onChange(e.currentTarget.value)}
    placeholder={activeNote
      ? t("modals.scratchpad.placeholderActive", { name: activeTitle })
      : t("modals.scratchpad.placeholderIdle")}
    class="flex-1 w-full px-4 py-3 bg-bg text-char outline-hidden resize-none font-sans text-sm leading-relaxed"
    spellcheck="true"
  ></textarea>

  <footer class="border-t border-bd p-2.5 bg-s1 flex flex-col gap-1.5">
    <div class="flex gap-1.5">
      <input
        type="text"
        bind:value={title}
        onkeydown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            keepAsNote();
          }
        }}
        placeholder={trimmed ? suggestedTitle() : t("modals.scratchpad.titlePlaceholder")}
        disabled={busy}
        class="flex-1 min-w-0 px-2 py-1.5 bg-bg border border-bd rounded-md text-char text-xs placeholder:text-t3"
      />
      <button
        onclick={keepAsNote}
        disabled={busy || !trimmed}
        class="btn-yel px-2.5 py-1.5 text-xs rounded-md disabled:opacity-40 shrink-0"
        title={t("modals.scratchpad.keepTitle")}
      >
        {busy ? t("modals.scratchpad.saving") : t("modals.scratchpad.keepAsNote")}
      </button>
    </div>
    {#if activeNote}
      <label class="flex items-center gap-1.5 text-2xs text-t2 select-none cursor-pointer">
        <input
          type="checkbox"
          bind:checked={linkFromActive}
          class="accent-yel"
        />
        <span>
          {t("modals.scratchpad.linkFrom")}{" "}
          <span class="text-char">{activeTitle}</span>
        </span>
      </label>
    {/if}
    {#if msg}<div class="text-2xs text-danger leading-snug">{msg}</div>{/if}
  </footer>
</aside>
