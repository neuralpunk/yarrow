// Modes & Personas (3.0) — a thin preset layer over the existing
// Yarrow surface that biases what's visible without locking
// anything away.
//
// Five modes ship in 3.0:
//
//   - basic        — minimum surface; hides paths, the connections
//                    graph, history, kits. For users who want notes
//                    + tags + scratchpad and nothing else.
//   - path         — neutral baseline; the full Yarrow surface as it
//                    existed before 3.0. The default for upgrading
//                    users so nothing changes on their first run.
//   - writer       — Quiet writing surface + writer plugin slot. Hides
//                    Path/Branch chrome by default so prose writers
//                    aren't asked to think in git. Path features remain
//                    reachable via ⌘K. Reserved for typewriter mode,
//                    footnotes, manuscript export, glossary cards
//                    (shipping in 3.x).
//   - researcher   — Path-Based + researcher plugin slot. Reserved
//                    for web clipper, citation pane, argument map,
//                    annotated PDFs (shipping in 3.x).
//   - developer    — Path-Based + developer plugin slot. Reserved
//                    for diff scratchpad, API notebook, issue bridge,
//                    Mermaid + syntax highlighting (shipping in 3.x).
//
// Design principles, captured here so future contributors don't drift:
//
//   1. Modes never gate features. Anything hidden by a mode is still
//      reachable via ⌘K. The rail is a convenience surface, not the
//      only path to a feature.
//   2. Switching modes is non-destructive. No notes, paths, tags,
//      connections, or settings are deleted or rewritten.
//   3. The persona slug exists so future plugin loading can key off
//      it, not so we can mass-disable features today.

export type ModeId =
  | "basic"
  | "path"
  | "writer"
  | "researcher"
  | "developer"
  | "clinician"
  | "cooking";

export type PersonaId =
  | "writer"
  | "researcher"
  | "developer"
  | "clinician"
  | "cooking";

export interface ModeConfig {
  id: ModeId;
  /** Slug for the persona-specific feature group, or null for the
   *  two foundational modes. Future plugin loading keys off this. */
  persona: PersonaId | null;
  /** Show paths/branching, the connections graph, and the history
   *  slider on the rail. False only for Basic. */
  pathFeatures: boolean;
  /** Show the Kits picker on the right rail. False only for Basic. */
  kits: boolean;
}

export const MODES: Readonly<Record<ModeId, ModeConfig>> = {
  basic: {
    id: "basic",
    persona: null,
    pathFeatures: false,
    kits: false,
  },
  path: {
    id: "path",
    persona: null,
    pathFeatures: true,
    kits: true,
  },
  writer: {
    id: "writer",
    persona: "writer",
    pathFeatures: false,
    kits: true,
  },
  researcher: {
    id: "researcher",
    persona: "researcher",
    pathFeatures: true,
    kits: true,
  },
  developer: {
    id: "developer",
    persona: "developer",
    pathFeatures: true,
    kits: true,
  },
  clinician: {
    id: "clinician",
    persona: "clinician",
    pathFeatures: true,
    kits: true,
  },
  cooking: {
    id: "cooking",
    persona: "cooking",
    pathFeatures: true,
    kits: true,
  },
};

/** Per-mode feature bullets for the Modes & Personas picker. The
 *  bullet count is fixed (4 per mode) so the picker can iterate
 *  with a stable index — locales translate each bullet under a
 *  matching key (`settings.mode.option.<id>.bullet<N>`). */
export const MODE_BULLET_COUNT = 4;

/** Display order for the picker — Basic first as the off-ramp,
 *  Path-Based second as the foundation, then the persona skins. */
export const MODE_ORDER: readonly ModeId[] = [
  "basic",
  "path",
  "writer",
  "researcher",
  "developer",
  "clinician",
  "cooking",
];

/** Default for fresh installs and upgrading 2.x users. Path-Based
 *  matches the pre-3.0 surface so nothing visibly changes on upgrade. */
export const DEFAULT_MODE: ModeId = "path";

/** Tailwind-class accent for each mode. Used by the Settings picker
 *  swatch and (eventually) by the persona button group on the rail. */
export const MODE_ACCENT_CLASS: Readonly<Record<ModeId, string>> = {
  basic: "bg-t2 text-bg",
  path: "bg-yel text-yeld",
  writer: "bg-rose-500 text-bg",
  researcher: "bg-emerald-600 text-bg",
  developer: "bg-sky-700 text-bg",
  clinician: "bg-teal-700 text-bg",
  cooking: "bg-orange-600 text-bg",
};

/** Background-only class for the small coloured dot on the
 *  status-bar mode pill. No text colour — the pill's text uses the
 *  generic status-bar foreground so it stays legible across themes. */
export const MODE_DOT_CLASS: Readonly<Record<ModeId, string>> = {
  basic: "bg-t3",
  path: "bg-yel",
  writer: "bg-rose-500",
  researcher: "bg-emerald-600",
  developer: "bg-sky-700",
  clinician: "bg-teal-700",
  cooking: "bg-orange-600",
};

export function isModeId(v: unknown): v is ModeId {
  return typeof v === "string" && (MODE_ORDER as readonly string[]).includes(v);
}
