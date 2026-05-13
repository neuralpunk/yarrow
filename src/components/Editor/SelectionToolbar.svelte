<script lang="ts">
  import { tick } from "svelte";
  import { animate, utils, reducedMotion } from "../../lib/anim.svelte";
  import type { SelectionToolbarPayload } from "./extensions/selectionToolbar";

  // 3.1 — Floating Selection Toolbar.
  // Listens for `yarrow:editor-selection-toolbar` from the editor and
  // renders six actions over the selection: Bold / Italic / Code /
  // Wikilink / Highlight / Make-open-question. Each action wraps the
  // selection via the same `yarrow:editor-replace-range` channel the
  // editor uses for context-menu insertions, so the editor's undo
  // history captures it as a single user edit.

  let active = $state<NonNullable<SelectionToolbarPayload> | null>(null);
  let toolbarRef = $state<HTMLDivElement | null>(null);
  let toolbarWidth = $state(280);

  $effect(() => {
    const onSel = (ev: Event) => {
      const detail = (ev as CustomEvent<SelectionToolbarPayload>).detail;
      console.info(
        "[yarrow] SelectionToolbar.svelte ← event",
        detail ? `range ${detail.from}-${detail.to}` : "(null/clear)",
      );
      active = detail ?? null;
    };
    window.addEventListener(
      "yarrow:editor-selection-toolbar",
      onSel as EventListener,
    );
    return () =>
      window.removeEventListener(
        "yarrow:editor-selection-toolbar",
        onSel as EventListener,
      );
  });

  // Pop the toolbar in whenever it appears at a new selection. We
  // wait one `tick()` so Svelte has actually mounted the `<div>` and
  // `bind:this={toolbarRef}` is populated — without that, the effect
  // can read a stale (null) ref and skip the animation, leaving the
  // toolbar invisible despite the DOM node existing.
  $effect(() => {
    if (!active) return;
    tick().then(() => {
      const el = toolbarRef;
      if (!el || !active) {
        console.info(
          "[yarrow] SelectionToolbar.svelte: no ref after tick()",
          { hasRef: !!el, hasActive: !!active },
        );
        return;
      }
      console.info("[yarrow] SelectionToolbar.svelte: mounting at", el);
      toolbarWidth = el.offsetWidth || 280;
      if (reducedMotion()) {
        el.style.opacity = "1";
        return;
      }
      utils.set(el, { opacity: 0, scale: 0.94, y: 6 });
      animate(el, {
        opacity: [0, 1],
        scale: [0.94, 1],
        y: [6, 0],
        duration: 240,
        ease: "outBack(1.5)",
      });
    });
  });

  // Escape dismisses without touching the document. The editor still
  // owns the selection, so the user can keep typing.
  $effect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        active = null;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function wrap(prefix: string, suffix: string = prefix) {
    if (!active) return;
    const { from, to, text } = active;
    window.dispatchEvent(
      new CustomEvent("yarrow:editor-replace-range", {
        detail: { from, to, text: `${prefix}${text}${suffix}` },
      }),
    );
    active = null;
  }

  function actionBold() {
    wrap("**");
  }
  function actionItalic() {
    wrap("*");
  }
  function actionCode() {
    wrap("`");
  }
  function actionHighlight() {
    wrap("==");
  }
  function actionWikilink() {
    if (!active) return;
    const { from, to, text } = active;
    window.dispatchEvent(
      new CustomEvent("yarrow:editor-replace-range", {
        detail: { from, to, text: `[[${text}]]` },
      }),
    );
    active = null;
  }
  function actionOpenQuestion() {
    if (!active) return;
    const { from, to, text } = active;
    // Prefix with `?? ` so the existing questionPlugin highlights the
    // line; we don't suffix so the rest of the paragraph stays
    // unmarked.
    window.dispatchEvent(
      new CustomEvent("yarrow:editor-replace-range", {
        detail: { from, to, text: `?? ${text}` },
      }),
    );
    active = null;
  }

  // Position the toolbar above the selection, clamped to the viewport
  // with a small margin. If there isn't room above (very top of the
  // editor), flip below the selection's last line so we don't clip.
  let pos = $derived.by(() => {
    if (!active) return null;
    const margin = 8;
    const toolbarH = 38;
    const half = toolbarWidth / 2;
    const x = Math.max(
      margin,
      Math.min(window.innerWidth - toolbarWidth - margin, active.x - half),
    );
    const above = active.y - toolbarH - 10;
    const below = active.y + 26;
    const y = above < margin ? below : above;
    return { x, y };
  });
</script>

{#if active && pos}
  <div
    bind:this={toolbarRef}
    role="toolbar"
    aria-label="Selection actions"
    class="fixed z-[60] flex items-center gap-1 px-1.5 py-1 bg-char text-bg rounded-md shadow-lg pointer-events-auto select-none yarrow-sel-toolbar"
    style:left="{pos.x}px"
    style:top="{pos.y}px"
  >
    <button
      type="button"
      class="yarrow-sel-btn"
      onclick={actionBold}
      title="Bold (⌘B)"
      aria-label="Bold"
    >
      <span style="font-weight: 700;">B</span>
    </button>
    <button
      type="button"
      class="yarrow-sel-btn"
      onclick={actionItalic}
      title="Italic (⌘I)"
      aria-label="Italic"
    >
      <span style="font-style: italic; font-family: var(--font-serif);">I</span>
    </button>
    <button
      type="button"
      class="yarrow-sel-btn yarrow-sel-btn--mono"
      onclick={actionCode}
      title="Inline code"
      aria-label="Inline code"
    >⟨/⟩</button>
    <span class="yarrow-sel-sep" aria-hidden="true"></span>
    <button
      type="button"
      class="yarrow-sel-btn yarrow-sel-btn--mono"
      onclick={actionWikilink}
      title="Wrap in wikilink"
      aria-label="Wikilink"
    >[[ ]]</button>
    <button
      type="button"
      class="yarrow-sel-btn"
      onclick={actionHighlight}
      title="Highlight"
      aria-label="Highlight"
    >
      <span class="yarrow-sel-hl">a</span>
    </button>
    <button
      type="button"
      class="yarrow-sel-btn yarrow-sel-btn--mono"
      onclick={actionOpenQuestion}
      title="Mark as open question"
      aria-label="Open question"
    >??</button>
  </div>
{/if}

<style>
  :global(.yarrow-sel-toolbar) {
    /* Soft elevation; matches AppShell's toast for tonal consistency. */
    box-shadow: 0 2px 4px rgba(0,0,0,0.10), 0 14px 32px -10px rgba(0,0,0,0.30);
    border: 1px solid color-mix(in srgb, var(--char) 70%, transparent);
  }
  :global(.yarrow-sel-btn) {
    appearance: none;
    background: transparent;
    color: var(--bg);
    border: none;
    padding: 4px 9px;
    border-radius: 5px;
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    transition: background-color 120ms ease, transform 80ms ease;
    min-width: 28px;
    text-align: center;
  }
  :global(.yarrow-sel-btn:hover) {
    background: color-mix(in srgb, var(--bg) 12%, transparent);
  }
  :global(.yarrow-sel-btn:active) {
    transform: scale(0.94);
    background: color-mix(in srgb, var(--bg) 20%, transparent);
  }
  :global(.yarrow-sel-btn--mono) {
    font-family: var(--font-mono);
    font-size: 11.5px;
    letter-spacing: 0.02em;
  }
  :global(.yarrow-sel-sep) {
    width: 1px;
    height: 18px;
    margin: 0 3px;
    background: color-mix(in srgb, var(--bg) 22%, transparent);
  }
  :global(.yarrow-sel-hl) {
    background: var(--yel);
    color: var(--char);
    padding: 0 4px;
    border-radius: 2px;
    font-family: var(--font-serif);
    font-style: italic;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.yarrow-sel-btn) {
      transition: none;
    }
  }
</style>
