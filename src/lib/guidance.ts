// Guidance registry.
//
// Each entry describes a teachable moment — a Yarrow-specific concept that
// a new user can't be expected to understand without explanation. The
// registry is intentionally plain data: to teach a new feature, append an
// entry here and call `guidance.trigger(key)` at the right place.
//
// Surfaces:
//   "modal" — full teaching modal with illustration, shown up to
//             `maxShows` times. Use for irreversible or paradigm-breaking
//             concepts (paths, merges, wikilinks).
//   "coach" — inline coach card rendered by its host component. The
//             registry only stores the copy; the component decides when
//             to show. Use for persistent, contextual hand-holding
//             (the "you're on a try path" ribbon).

import type { ComponentType } from "react";
import PathCreateIllustration from "../components/Guidance/illustrations/PathCreateIllustration";
import WikilinkIllustration from "../components/Guidance/illustrations/WikilinkIllustration";
import CompareIllustration from "../components/Guidance/illustrations/CompareIllustration";
// PathStepIntoIllustration is available for future step-into modals; the
// current v1 uses it only via the PathRibbon coach card (no illustration).

export type GuidanceSurface = "modal" | "coach";

export interface GuidanceAction {
  /** Button label */
  label: string;
  /** If omitted, clicking dismisses the guidance. Return false to keep open. */
  run?: () => void | boolean | Promise<void | boolean>;
  /** Visual weight. Defaults to "ghost" on secondary, "primary" on primary. */
  tone?: "primary" | "ghost" | "danger";
}

export interface GuidanceDef {
  key: string;
  surface: GuidanceSurface;
  /** Short eyebrow, ALL CAPS in UI. E.g. "A NEW PATH". */
  eyebrow?: string;
  title: string;
  /** Body text. Supports two markdown-ish inlines: **bold** and *italic*. */
  body: string;
  illustration?: ComponentType;
  /** Shown after body, more muted. Optional examples or follow-ups. */
  aside?: string;
  primary?: GuidanceAction;
  secondary?: GuidanceAction;
  /** For modals: after this many shows, stop triggering. Default 1. */
  maxShows?: number;
}

export const GUIDANCE: Record<string, GuidanceDef> = {
  // --------------------------------------------------------------------
  // Fired every time the user creates a path. If they've already seen
  // this a hundred times and want to silence it, the modal has a
  // "Don't show this one again" opt-out.
  "path.create": {
    key: "path.create",
    surface: "modal",
    eyebrow: "You're on a new path",
    title: "Make a mess in a safe copy of your workspace.",
    body:
      "Yarrow just created a **full copy** of your workspace for this scenario. Every note is here, and so is every link. Edit any note, add new ones, delete ones that wouldn't apply — **nothing touches main** until you decide to promote this path.",
    aside:
      "Use the ribbon above the editor to compare against main, go back, or — when this scenario becomes your reality — make this path the new main.",
    illustration: PathCreateIllustration,
    primary: { label: "Got it, let me explore", tone: "primary" },
    secondary: { label: "Oops, take me back to main", tone: "ghost" },
  },

  // --------------------------------------------------------------------
  // The persistent ribbon above the editor on any non-main path.
  "path.stepInto.coach": {
    key: "path.stepInto.coach",
    surface: "coach",
    eyebrow: "You're on a path",
    title: "Anything you write here stays here.",
    body:
      "Edits on this path are kept separate from main — you can rewrite the budget, rearrange the plan, whatever the scenario calls for. Main stays untouched until you promote this path.",
    aside: "The colored stripe on the left of the editor tells you which path you're on.",
  },

  // --------------------------------------------------------------------
  // Fired every time the user switches back to main from a non-main
  // path. The primary button opens the compare view so they can see
  // which notes belong to each path.
  "path.returnedToMain": {
    key: "path.returnedToMain",
    surface: "modal",
    eyebrow: "Back on main",
    title: "Your edits on that path are still there.",
    body:
      "Anything you rewrote over there is saved to the path. Main is still the original. Open the **compare view** to see exactly what's different, note by note and line by line — or step back into the path any time to keep working.",
    aside:
      "Ready to live that version for real? From the path, click **Promote to main** and every edit on it becomes the new main.",
    illustration: CompareIllustration,
    primary: { label: "Show me the differences", tone: "primary" },
    secondary: { label: "Not right now", tone: "ghost" },
  },

  // --------------------------------------------------------------------
  // Fires after a successful "Promote to main". Tells the user the path is
  // now the real thing — overrides applied, path archived.
  "path.promoted": {
    key: "path.promoted",
    surface: "modal",
    eyebrow: "Promoted to main",
    title: "This version is your life now.",
    body:
      "Every edit you made on that path has been applied to main. The path itself has been archived — it's no longer in your list.",
    aside:
      "If something wasn't supposed to land, you can always restore an older version from the note's history (click the clock icon in the toolbar).",
    illustration: CompareIllustration,
    primary: { label: "Got it", tone: "primary" },
  },

  // --------------------------------------------------------------------
  // Fired every time the user inserts a wikilink via the picker.
  "wikilink.inserted": {
    key: "wikilink.inserted",
    surface: "modal",
    eyebrow: "A link between notes",
    title: "You just wired two notes together.",
    body:
      "Yarrow stores every link in both directions. The note you linked to now knows you pointed at it — it has a **backlink** pointing back here. As your workspace grows, those links weave into a graph you can see, search, and navigate.",
    aside:
      "Type `[[` any time to link to another note. Right-click to pick one from a list.",
    illustration: WikilinkIllustration,
    primary: { label: "Got it", tone: "primary" },
  },
};

/** All keys, typed. Extend this union when adding to GUIDANCE. */
export type GuidanceKey = keyof typeof GUIDANCE;

/** Render helper: **bold** and *italic* as minimal inline styling. */
export function renderInlines(text: string): Array<{ kind: "text" | "bold" | "italic"; value: string }> {
  const out: Array<{ kind: "text" | "bold" | "italic"; value: string }> = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith("**")) out.push({ kind: "bold", value: t.slice(2, -2) });
    else out.push({ kind: "italic", value: t.slice(1, -1) });
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}
