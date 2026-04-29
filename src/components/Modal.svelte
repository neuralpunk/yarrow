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

  let dialogRef = $state<HTMLDivElement | null>(null);
  let titleId = `yarrow-modal-title-${Math.random().toString(36).slice(2, 10)}`;

  // Escape closes; tracked separately from the focus effect because the
  // listener is window-level and unrelated to dialog node lifetime.
  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Focus management: capture the previously-focused element on open,
  // move focus into the dialog (preferring the first focusable child
  // over the dialog wrapper itself so screen-reader announcements name
  // the actionable control), and restore focus on close. Without this
  // every modal lands the user in an empty focus state and Tab leaks
  // back out to the underlying app, breaking keyboard navigation for
  // both sighted keyboard users and screen-reader users.
  $effect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => {
      if (!dialogRef) return;
      const first = firstFocusable(dialogRef);
      (first ?? dialogRef).focus();
    });
    return () => {
      if (previouslyFocused && document.contains(previouslyFocused)) {
        try { previouslyFocused.focus(); } catch {}
      }
    };
  });

  // Focus trap: Tab cycles within the dialog. We compute the focusable
  // list at trap-time rather than caching, so dynamic content (e.g. a
  // newly-revealed input after toggling "show password") still
  // participates correctly.
  function onDialogKeydown(e: KeyboardEvent) {
    if (e.key !== "Tab" || !dialogRef) return;
    const focusable = focusableWithin(dialogRef);
    if (focusable.length === 0) {
      e.preventDefault();
      dialogRef.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !dialogRef.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !dialogRef.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Tab-order discovery — anything visible and tabbable inside the
  // dialog. Hidden elements (display:none / aria-hidden) are filtered
  // because the browser would skip them on Tab anyway.
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusableWithin(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter((el) => {
        if (el.hasAttribute("disabled")) return false;
        if (el.getAttribute("aria-hidden") === "true") return false;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        return true;
      });
  }

  function firstFocusable(root: HTMLElement): HTMLElement | null {
    const list = focusableWithin(root);
    return list[0] ?? null;
  }

  // Backdrop dismissal — only close when both `mousedown` AND the
  // matching `click` landed on the backdrop itself. A previous shape
  // closed on `mousedown` alone, which dismissed the dialog if the
  // user pressed inside, dragged onto the backdrop, then released
  // (text selection drag-out), and also fired during the down-stroke
  // of an intended drag-in even when the user hadn't yet committed
  // to dismissing.
  let mouseDownOnBackdrop = false;
  function onBackdropMouseDown(e: MouseEvent) {
    mouseDownOnBackdrop = e.target === e.currentTarget;
  }
  function onBackdropClick(e: MouseEvent) {
    if (mouseDownOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
    mouseDownOnBackdrop = false;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-char/10"
    onmousedown={onBackdropMouseDown}
    onclick={onBackdropClick}
    role="presentation"
  >
    <div
      bind:this={dialogRef}
      class="{width} bg-bg border border-bd2 rounded-xl shadow-2xl p-5 relative mac-sheet"
      onkeydown={onDialogKeydown}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : t("modals.modal.dialog")}
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
        <h2 id={titleId} class="font-serif text-xl mb-3 text-char pr-8">{title}</h2>
      {/if}
      {@render children()}
    </div>
  </div>
{/if}
