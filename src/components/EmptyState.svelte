<script lang="ts">
  import type { Snippet } from "svelte";
  import { tr } from "../lib/i18n/index.svelte";
  import type { StringKey } from "../lib/i18n/index.svelte";

  /**
   * Shared "Kind Empty State" primitive (Svelte 5 port).
   *
   * Every empty surface in Yarrow — no notes, no connections, no
   * pinned, no search matches, empty trash, no checkpoints — gets a
   * warm illustrated panel instead of a terse fallback line. The
   * illustration is a pick from the `kind` prop (plain inline SVG so
   * we stay zero-asset); the copy is split into a gentle headline +
   * a one-line nudge + an optional call to action.
   */
  export type EmptyKind =
    | "notes"           // the whole sidebar is empty (just-initialised vault)
    | "notes-filtered"  // a tag or search filter is on, but matches nothing
    | "search"          // command palette / global search had zero hits
    | "links"           // a specific note has no connections yet
    | "questions"       // side panel — no `??` markers in this note
    | "trash"           // trash is empty
    | "transclusions"   // no `![[embeds]]` in this note
    | "checkpoints"     // history slider / note history has no entries
    | "paths"           // a collection with no notes on it
    | "tags"            // tag graph has nothing to render yet
    | "diff";           // ley lines: no changes against main

  interface Props {
    kind: EmptyKind;
    /** Override the built-in headline. */
    title?: string;
    /** Override the built-in one-liner. */
    hint?: string;
    /** Optional CTA rendered under the hint. */
    action?: { label: string; onClick: () => void };
    /** Extra element below the CTA, for multi-step nudges. */
    extra?: Snippet;
    /** Visual density — `tight` for side-panel slots, `roomy` for modals. */
    size?: "tight" | "roomy";
    class?: string;
  }

  let {
    kind,
    title,
    hint,
    action,
    extra,
    size = "roomy",
    class: className = "",
  }: Props = $props();

  let t = $derived(tr());

  // Centralised copy so the voice is one place, tuned once. A caller
  // can still override with `title`/`hint`, but 95% of sites want
  // the defaults.
  const COPY_KEYS: Record<EmptyKind, { titleKey: StringKey; hintKey: StringKey }> = {
    notes:            { titleKey: "modals.empty.notesTitle",            hintKey: "modals.empty.notesHint" },
    "notes-filtered": { titleKey: "modals.empty.notesFilteredTitle",    hintKey: "modals.empty.notesFilteredHint" },
    search:           { titleKey: "modals.empty.searchTitle",           hintKey: "modals.empty.searchHint" },
    links:            { titleKey: "modals.empty.linksTitle",            hintKey: "modals.empty.linksHint" },
    questions:        { titleKey: "modals.empty.questionsTitle",        hintKey: "modals.empty.questionsHint" },
    trash:            { titleKey: "modals.empty.trashTitle",            hintKey: "modals.empty.trashHint" },
    transclusions:    { titleKey: "modals.empty.transclusionsTitle",    hintKey: "modals.empty.transclusionsHint" },
    checkpoints:      { titleKey: "modals.empty.checkpointsTitle",      hintKey: "modals.empty.checkpointsHint" },
    paths:            { titleKey: "modals.empty.pathsTitle",            hintKey: "modals.empty.pathsHint" },
    tags:             { titleKey: "modals.empty.tagsTitle",             hintKey: "modals.empty.tagsHint" },
    diff:             { titleKey: "modals.empty.diffTitle",             hintKey: "modals.empty.diffHint" },
  };

  let copy = $derived(COPY_KEYS[kind]);
  let headline = $derived(title ?? t(copy.titleKey));
  let subline = $derived(hint ?? t(copy.hintKey));
  let padding = $derived(size === "tight" ? "py-6 px-4" : "py-10 px-6");
  let gap = $derived(size === "tight" ? "mt-2" : "mt-3");

  // Each illustration is a single small SVG (~120×80) drawn with CSS
  // vars so it tracks the current palette (light/dark/paper).
  // Stroke-only where possible so a missing palette doesn't leave
  // white blocks.
  const stroke = "var(--t3)";
  const accent = "var(--yel)";
  const soft = "var(--yelp)";
</script>

<div class="flex flex-col items-center text-center {padding} {className}">
  <div class="mb-2 opacity-90">
    {#if kind === "notes"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <rect x="30" y="18" width="80" height="60" rx="6" fill={soft} stroke={stroke} stroke-width="1.2" />
        <line x1="40" y1="34" x2="86" y2="34" stroke={stroke} stroke-width="1" />
        <line x1="40" y1="46" x2="98" y2="46" stroke={stroke} stroke-width="1" />
        <line x1="40" y1="58" x2="72" y2="58" stroke={stroke} stroke-width="1" />
        <circle cx="104" cy="22" r="5.5" fill={accent} />
      </svg>
    {:else if kind === "notes-filtered"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <path d="M34 22h72l-24 26v18l-24 8V48z" fill="none" stroke={stroke} stroke-width="1.4" stroke-linejoin="round" />
        <circle cx="70" cy="72" r="3" fill={accent} />
      </svg>
    {:else if kind === "search"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <circle cx="58" cy="44" r="20" fill="none" stroke={stroke} stroke-width="1.4" />
        <line x1="74" y1="60" x2="96" y2="78" stroke={stroke} stroke-width="1.6" stroke-linecap="round" />
        <path d="M50 44 q8 -6 16 0" stroke={accent} stroke-width="1.4" fill="none" stroke-linecap="round" />
      </svg>
    {:else if kind === "links"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <circle cx="48" cy="46" r="14" fill={soft} stroke={stroke} stroke-width="1.2" />
        <circle cx="94" cy="46" r="14" fill="none" stroke={stroke} stroke-width="1.2" stroke-dasharray="2 3" />
        <path d="M62 46h18" stroke={accent} stroke-width="1.4" stroke-dasharray="2 3" />
        <path d="M90 40 l6 6 -6 6" fill="none" stroke={accent} stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {:else if kind === "questions"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <path d="M52 58 q0 -22 18 -22 t18 22" fill="none" stroke={stroke} stroke-width="1.4" stroke-linecap="round" />
        <line x1="70" y1="62" x2="70" y2="66" stroke={stroke} stroke-width="1.4" stroke-linecap="round" />
        <circle cx="70" cy="72" r="1.6" fill={stroke} />
        <circle cx="38" cy="30" r="2.5" fill={accent} />
        <circle cx="102" cy="32" r="2.5" fill={accent} />
      </svg>
    {:else if kind === "trash"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <rect x="50" y="30" width="40" height="44" rx="4" fill={soft} stroke={stroke} stroke-width="1.2" />
        <line x1="46" y1="30" x2="94" y2="30" stroke={stroke} stroke-width="1.4" stroke-linecap="round" />
        <line x1="58" y1="40" x2="58" y2="66" stroke={stroke} stroke-width="1" />
        <line x1="70" y1="40" x2="70" y2="66" stroke={stroke} stroke-width="1" />
        <line x1="82" y1="40" x2="82" y2="66" stroke={stroke} stroke-width="1" />
        <path d="M60 24 q10 -6 20 0" fill="none" stroke={stroke} stroke-width="1.4" stroke-linecap="round" />
      </svg>
    {:else if kind === "transclusions"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <rect x="30" y="22" width="50" height="36" rx="4" fill={soft} stroke={stroke} stroke-width="1.2" />
        <rect x="70" y="40" width="40" height="30" rx="4" fill="none" stroke={stroke} stroke-width="1.2" stroke-dasharray="2 3" />
        <path d="M58 56 l12 0" stroke={accent} stroke-width="1.4" />
      </svg>
    {:else if kind === "checkpoints"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <path d="M20 60 q 30 -30 50 0 t 50 0" fill="none" stroke={stroke} stroke-width="1.4" stroke-linecap="round" />
        <circle cx="20" cy="60" r="3.5" fill={accent} />
        <circle cx="70" cy="60" r="3.5" fill={stroke} />
        <circle cx="120" cy="60" r="3.5" fill={stroke} />
      </svg>
    {:else if kind === "paths"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <path d="M20 70 q 30 -40 60 -20 t 40 -20" fill="none" stroke={stroke} stroke-width="1.4" stroke-linecap="round" />
        <circle cx="20" cy="70" r="3.5" fill={accent} />
        <path d="M70 54 l 3 -8 3 8 z" fill={stroke} />
      </svg>
    {:else if kind === "tags"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <path d="M40 24h28l28 28-28 28H40z" fill="none" stroke={stroke} stroke-width="1.4" stroke-linejoin="round" />
        <circle cx="54" cy="38" r="3" fill={accent} />
      </svg>
    {:else if kind === "diff"}
      <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden="true">
        <rect x="28" y="22" width="36" height="46" rx="4" fill={soft} stroke={stroke} stroke-width="1.2" />
        <rect x="76" y="22" width="36" height="46" rx="4" fill="none" stroke={stroke} stroke-width="1.2" stroke-dasharray="2 3" />
        <line x1="36" y1="36" x2="56" y2="36" stroke={stroke} stroke-width="1" />
        <line x1="36" y1="46" x2="52" y2="46" stroke={stroke} stroke-width="1" />
        <line x1="84" y1="36" x2="104" y2="36" stroke={stroke} stroke-width="1" stroke-dasharray="2 3" />
      </svg>
    {/if}
  </div>
  <div class="font-serif text-char text-[15px] leading-tight">
    {headline}
  </div>
  <div class="text-2xs text-t2 leading-relaxed max-w-[32ch] {gap}">
    {subline}
  </div>
  {#if action}
    <button
      onclick={action.onClick}
      class="mt-4 text-xs px-3 py-1.5 rounded-md bg-yelp text-yeld hover:bg-yel hover:text-on-yel transition"
    >
      {action.label}
    </button>
  {/if}
  {#if extra}
    <div class="mt-3">{@render extra()}</div>
  {/if}
</div>
