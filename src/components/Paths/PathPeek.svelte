<script lang="ts">
  // PathPeek — inline preview pane that shows how the active note looks
  // on a *different* path, without leaving the current editor view.

  import { tr } from "../../lib/i18n/index.svelte";
  import { api } from "../../lib/tauri";

  interface Props {
    slug: string;
    sourcePath: string;
    sourcePathLabel: string;
    destPath: string;
    currentBody: string;
    noteTitle: string;
    anchorX: number;
    anchorY: number;
    onClose: () => void;
    onBorrowed: () => void;
    onCompare: () => void;
    onToast?: (msg: string) => void;
  }

  let {
    slug,
    sourcePath,
    sourcePathLabel,
    destPath,
    currentBody,
    noteTitle,
    anchorX,
    anchorY,
    onClose,
    onBorrowed,
    onCompare,
    onToast,
  }: Props = $props();

  let t = $derived(tr());
  let body = $state<string | null>(null);
  let err = $state<string | null>(null);
  let busy = $state(false);

  $effect(() => {
    let alive = true;
    void slug;
    void sourcePath;
    (async () => {
      try {
        const note = await api.readNoteOnPath(slug, sourcePath || null);
        if (alive) body = note.body ?? "";
      } catch (e) {
        if (alive) err = String(e);
      }
    })();
    return () => {
      alive = false;
    };
  });

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let differs = $derived(body !== null && body !== currentBody);

  async function handleBorrowAll() {
    if (busy) return;
    if (!window.confirm(t("paths.borrow.confirmAll", { path: sourcePathLabel }))) {
      return;
    }
    busy = true;
    try {
      await api.borrowNote(slug, sourcePath, destPath);
      onToast?.(
        t("paths.borrow.toast", { title: noteTitle || slug, path: sourcePathLabel }),
      );
      onBorrowed();
      onClose();
    } catch (e) {
      onToast?.(t("paths.borrow.errorGeneric", { error: String(e) }));
    } finally {
      busy = false;
    }
  }

  const W = 360;
  const H = 320;
  let left = $derived(Math.max(8, Math.min(window.innerWidth - W - 8, anchorX)));
  let top = $derived(Math.max(8, Math.min(window.innerHeight - H - 8, anchorY + 12)));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" onclick={onClose} aria-hidden="true"></div>
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  class="fixed z-50 bg-bg border border-bd2 rounded-lg shadow-2xl flex flex-col"
  style:left="{left}px"
  style:top="{top}px"
  style:width="{W}px"
  style:max-height="{H}px"
  onclick={(e) => e.stopPropagation()}
>
  <header class="px-3 py-2 border-b border-bd flex items-center gap-2">
    <span class="text-2xs font-mono uppercase tracking-wider text-t3">
      {t("paths.peek.heading", { path: sourcePathLabel })}
    </span>
    <span class="ml-auto text-2xs font-mono {differs ? 'text-yeld' : 'text-t3'}">
      {body === null
        ? "…"
        : differs
        ? t("paths.peek.differs")
        : t("paths.peek.same")}
    </span>
    <button
      type="button"
      onclick={onClose}
      class="text-t3 hover:text-char text-xs px-1"
      aria-label={t("paths.peek.close")}
    >
      ×
    </button>
  </header>
  <div class="flex-1 overflow-y-auto px-3 py-2">
    {#if err}
      <div class="text-xs text-danger italic">
        {t("paths.borrow.errorGeneric", { error: err })}
      </div>
    {:else if body === null}
      <div class="text-2xs text-t3 italic">…</div>
    {:else if body.trim() === ""}
      <div class="text-2xs text-t3 italic">
        {t("paths.peek.empty", { path: sourcePathLabel })}
      </div>
    {:else}
      <pre class="font-serif text-xs leading-snug text-char whitespace-pre-wrap wrap-break-word">{body.length > 1200 ? body.slice(0, 1200) + "…" : body}</pre>
    {/if}
  </div>
  <footer class="px-3 py-2 border-t border-bd flex items-center gap-2">
    <button
      type="button"
      onclick={handleBorrowAll}
      disabled={busy || body === null || !differs}
      title={t("paths.peek.borrowAllTitle", { path: sourcePathLabel })}
      class="text-xs px-2.5 py-1.5 rounded-md border border-yel/60 text-yeld hover:bg-yelp inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      ⇠ {t("paths.peek.borrowAll")}
    </button>
    <button
      type="button"
      onclick={() => {
        onCompare();
        onClose();
      }}
      disabled={destPath === sourcePath}
      class="ml-auto text-xs px-2.5 py-1.5 rounded-md border border-bd text-t2 hover:text-char hover:bg-s1 disabled:opacity-40"
    >
      {t("paths.peek.openSideBySide")}
    </button>
  </footer>
</div>
