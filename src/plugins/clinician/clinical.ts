// Clinician plugin — sensitive-note + follow-up filters, plus the
// list of session-note kits we surface in the picker.
//
// Reuses the existing tag-kind machinery in `lib/tagStyles.ts`:
//
//   - `isSensitiveTag(tag)` → matches the four sensitive aliases
//     (`#clinical`, `#private`, `#phi`, `#confidential`). This is
//     the same gate the autocomplete-suppression and sync-redaction
//     paths use, so the Clinician roster always shows exactly the
//     notes Yarrow already considers PHI.
//
//   - `tagKind(tag) === "attention"` → matches the four attention
//     aliases (`#review`, `#followup`, `#todo`, `#wip`). This is
//     what the existing tag styles render in amber, so the
//     Clinician follow-up surface lines up with what the user
//     already triages on at a glance.
//
// `SESSION_KITS` is the curated list shown in the kit-picker
// modal. It's a subset of the 14 clinical kits seeded by the Rust
// backend in `templates.rs` — the four we surface here are the
// ones a clinician reaches for at the start of every session.

import type { NoteSummary } from "../../lib/types";
import { isSensitiveTag, tagKind } from "../../lib/tagStyles";

/** True if any of the note's tags is one of the recognised
 *  sensitive aliases (#clinical / #private / #phi / #confidential). */
export function isSensitiveNote(n: NoteSummary): boolean {
  if (!n.tags) return false;
  for (const t of n.tags) {
    if (isSensitiveTag(t)) return true;
  }
  return false;
}

/** True if any of the note's tags is one of the attention aliases
 *  (#review / #followup / #todo / #wip). */
export function isFollowUpNote(n: NoteSummary): boolean {
  if (!n.tags) return false;
  for (const t of n.tags) {
    if (tagKind(t) === "attention") return true;
  }
  return false;
}

export function filterSensitive(notes: NoteSummary[]): NoteSummary[] {
  return notes
    .filter(isSensitiveNote)
    .slice()
    .sort((a, b) => (a.modified < b.modified ? 1 : -1));
}

export function filterFollowUps(notes: NoteSummary[]): NoteSummary[] {
  return notes
    .filter(isFollowUpNote)
    .slice()
    .sort((a, b) => (a.modified < b.modified ? 1 : -1));
}

export interface SessionKit {
  /** Template name registered in the Rust backend's
   *  `templates::bundled()` table. */
  template: string;
  /** i18n key for the human label shown in the picker. */
  labelKey:
    | "plugin.clinician.kits.soap"
    | "plugin.clinician.kits.birp"
    | "plugin.clinician.kits.dap"
    | "plugin.clinician.kits.intake";
  /** i18n key for the one-line description. */
  descKey:
    | "plugin.clinician.kits.soapDesc"
    | "plugin.clinician.kits.birpDesc"
    | "plugin.clinician.kits.dapDesc"
    | "plugin.clinician.kits.intakeDesc";
  /** Initial slug prefix for the new note's title. The picker
   *  appends today's ISO date so notes file naturally by session
   *  date in the sidebar. */
  titlePrefix: string;
}

export const SESSION_KITS: readonly SessionKit[] = [
  {
    template: "soap-note",
    labelKey: "plugin.clinician.kits.soap",
    descKey: "plugin.clinician.kits.soapDesc",
    titlePrefix: "SOAP",
  },
  {
    template: "birp-note",
    labelKey: "plugin.clinician.kits.birp",
    descKey: "plugin.clinician.kits.birpDesc",
    titlePrefix: "BIRP",
  },
  {
    template: "dap-note",
    labelKey: "plugin.clinician.kits.dap",
    descKey: "plugin.clinician.kits.dapDesc",
    titlePrefix: "DAP",
  },
  {
    template: "intake-first-session",
    labelKey: "plugin.clinician.kits.intake",
    descKey: "plugin.clinician.kits.intakeDesc",
    titlePrefix: "Intake",
  },
];

export function isoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
