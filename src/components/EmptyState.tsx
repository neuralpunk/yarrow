import { memo, type ReactNode } from "react";
import { useT, type StringKey } from "../lib/i18n";

/**
 * Shared "Kind Empty State" primitive (2.1).
 *
 * Every empty surface in Yarrow — no notes, no connections, no pinned, no
 * search matches, empty trash, no checkpoints — gets a warm illustrated
 * panel instead of a terse fallback line. The illustration is a pick from
 * the `kind` prop (plain inline SVG so we stay zero-asset); the copy is
 * split into a gentle headline + a one-line nudge + an optional call to
 * action. Matches the visual voice from the 2.1 Everyday mockup.
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
  /** Override the built-in headline for this kind. */
  title?: string;
  /** Override the built-in one-liner. */
  hint?: string;
  /** Optional call-to-action button rendered under the hint. */
  action?: { label: string; onClick: () => void };
  /** Extra element below the CTA, for multi-step nudges. */
  extra?: ReactNode;
  /** Visual density. `tight` is for side-panel slots; `roomy` fills a modal. */
  size?: "tight" | "roomy";
  /** Extra classes on the wrapper — lets callers slot this into existing
   *  padding contexts without the built-in padding fighting with them. */
  className?: string;
}

// Centralised copy so the voice is one place, tuned once. A caller can
// still override with `title`/`hint` but 95% of sites want the defaults.
const COPY_KEYS: Record<EmptyKind, { titleKey: StringKey; hintKey: StringKey }> = {
  notes:          { titleKey: "modals.empty.notesTitle",          hintKey: "modals.empty.notesHint" },
  "notes-filtered": { titleKey: "modals.empty.notesFilteredTitle", hintKey: "modals.empty.notesFilteredHint" },
  search:         { titleKey: "modals.empty.searchTitle",         hintKey: "modals.empty.searchHint" },
  links:          { titleKey: "modals.empty.linksTitle",          hintKey: "modals.empty.linksHint" },
  questions:      { titleKey: "modals.empty.questionsTitle",      hintKey: "modals.empty.questionsHint" },
  trash:          { titleKey: "modals.empty.trashTitle",          hintKey: "modals.empty.trashHint" },
  transclusions:  { titleKey: "modals.empty.transclusionsTitle",  hintKey: "modals.empty.transclusionsHint" },
  checkpoints:    { titleKey: "modals.empty.checkpointsTitle",    hintKey: "modals.empty.checkpointsHint" },
  paths:          { titleKey: "modals.empty.pathsTitle",          hintKey: "modals.empty.pathsHint" },
  tags:           { titleKey: "modals.empty.tagsTitle",           hintKey: "modals.empty.tagsHint" },
  diff:           { titleKey: "modals.empty.diffTitle",           hintKey: "modals.empty.diffHint" },
};

function Illustration({ kind }: { kind: EmptyKind }) {
  // Each illustration is a single small SVG, ~120×80, drawn with CSS vars
  // so it tracks the current palette (light/dark/paper). Stroke-only where
  // possible so a missing palette doesn't leave white blocks.
  const stroke = "var(--t3)";
  const accent = "var(--yel)";
  const soft   = "var(--yelp)";
  switch (kind) {
    case "notes":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <rect x="30" y="18" width="80" height="60" rx="6" fill={soft} stroke={stroke} strokeWidth="1.2" />
          <line x1="40" y1="34" x2="86" y2="34" stroke={stroke} strokeWidth="1" />
          <line x1="40" y1="46" x2="98" y2="46" stroke={stroke} strokeWidth="1" />
          <line x1="40" y1="58" x2="72" y2="58" stroke={stroke} strokeWidth="1" />
          <circle cx="104" cy="22" r="5.5" fill={accent} />
        </svg>
      );
    case "notes-filtered":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <path d="M34 22h72l-24 26v18l-24 8V48z" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="70" cy="72" r="3" fill={accent} />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <circle cx="58" cy="44" r="20" fill="none" stroke={stroke} strokeWidth="1.4" />
          <line x1="74" y1="60" x2="96" y2="78" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M50 44 q8 -6 16 0" stroke={accent} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "links":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <circle cx="48" cy="46" r="14" fill={soft} stroke={stroke} strokeWidth="1.2" />
          <circle cx="94" cy="46" r="14" fill="none" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 3" />
          <path d="M62 46h18" stroke={accent} strokeWidth="1.4" strokeDasharray="2 3" />
          <path d="M90 40 l6 6 -6 6" fill="none" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "questions":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <path d="M52 58 q0 -22 18 -22 t18 22" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="70" y1="62" x2="70" y2="66" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="70" cy="72" r="1.6" fill={stroke} />
          <circle cx="38" cy="30" r="2.5" fill={accent} />
          <circle cx="102" cy="32" r="2.5" fill={accent} />
        </svg>
      );
    case "trash":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <rect x="50" y="30" width="40" height="44" rx="4" fill={soft} stroke={stroke} strokeWidth="1.2" />
          <line x1="46" y1="30" x2="94" y2="30" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="58" y1="40" x2="58" y2="66" stroke={stroke} strokeWidth="1" />
          <line x1="70" y1="40" x2="70" y2="66" stroke={stroke} strokeWidth="1" />
          <line x1="82" y1="40" x2="82" y2="66" stroke={stroke} strokeWidth="1" />
          <path d="M60 24 q10 -6 20 0" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "transclusions":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <rect x="30" y="22" width="50" height="36" rx="4" fill={soft} stroke={stroke} strokeWidth="1.2" />
          <rect x="70" y="40" width="40" height="30" rx="4" fill="none" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 3" />
          <path d="M58 56 l12 0" stroke={accent} strokeWidth="1.4" />
        </svg>
      );
    case "checkpoints":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <path d="M20 60 q 30 -30 50 0 t 50 0" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="20" cy="60" r="3.5" fill={accent} />
          <circle cx="70" cy="60" r="3.5" fill={stroke} />
          <circle cx="120" cy="60" r="3.5" fill={stroke} />
        </svg>
      );
    case "paths":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <path d="M20 70 q 30 -40 60 -20 t 40 -20" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="20" cy="70" r="3.5" fill={accent} />
          <path d="M70 54 l 3 -8 3 8 z" fill={stroke} />
        </svg>
      );
    case "tags":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <path d="M40 24h28l28 28-28 28H40z" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="54" cy="38" r="3" fill={accent} />
        </svg>
      );
    case "diff":
      return (
        <svg viewBox="0 0 140 90" width="132" height="84" aria-hidden>
          <rect x="28" y="22" width="36" height="46" rx="4" fill={soft} stroke={stroke} strokeWidth="1.2" />
          <rect x="76" y="22" width="36" height="46" rx="4" fill="none" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 3" />
          <line x1="36" y1="36" x2="56" y2="36" stroke={stroke} strokeWidth="1" />
          <line x1="36" y1="46" x2="52" y2="46" stroke={stroke} strokeWidth="1" />
          <line x1="84" y1="36" x2="104" y2="36" stroke={stroke} strokeWidth="1" strokeDasharray="2 3" />
        </svg>
      );
  }
}

function EmptyStateInner({ kind, title, hint, action, extra, size = "roomy", className = "" }: Props) {
  const t = useT();
  const copy = COPY_KEYS[kind];
  const headline = title ?? t(copy.titleKey);
  const subline = hint ?? t(copy.hintKey);
  const padding = size === "tight" ? "py-6 px-4" : "py-10 px-6";
  const gap = size === "tight" ? "mt-2" : "mt-3";
  return (
    <div className={`flex flex-col items-center text-center ${padding} ${className}`}>
      <div className="mb-2 opacity-90">
        <Illustration kind={kind} />
      </div>
      <div className="font-serif text-char text-[15px] leading-tight">
        {headline}
      </div>
      <div className={`text-2xs text-t2 leading-relaxed max-w-[32ch] ${gap}`}>
        {subline}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-xs px-3 py-1.5 rounded-md bg-yelp text-yeld hover:bg-yel hover:text-on-yel transition"
        >
          {action.label}
        </button>
      )}
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}

export default memo(EmptyStateInner);
