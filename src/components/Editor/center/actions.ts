// ────────────── Center actions ──────────────
// The radial menu's centre disc supports five gestures. Three are
// user-configurable in Settings → Gestures; two are structural to the
// radial:
//
//   · tap           → user-bound (default: open command palette)
//   · long-press    → user-bound (default: open the Quick Hand modal)
//   · double-click  → user-bound (default: toggle focus mode)
//   · drag-out      → commits the wedge the pointer lands on
//   · scroll wheel  → rotates the radial's hover by one wedge
//
// Drag-out and scroll are handled inside `RadialMenu` itself because
// they operate on the radial (not on global state). The other three
// fire a `yarrow:center-action` window event with a stable id that the
// user has bound for that gesture, and AppShell routes each id to the
// matching piece of state.
//
// The full id catalogue mirrors `BINDABLE_ACTIONS` in `gesturePrefs.ts`
// — keep the two in sync when adding a new bindable action.

export type CenterActionId =
  | "palette"             // command palette
  | "quickHand"           // version A modal: 3×3 grid of small actions
  | "constellationModal"  // version B modal: 8 petals around the click point
  | "constellation"       // legacy long-press: connection graph rail overlay
  | "focus"               // toggle focus / zen mode
  | "scratchpad"          // toggle the scratchpad pane
  | "todayJournal"        // open today's daily journal
  | "newNote"             // create new note
  | "newPath"             // explore a new direction (path)
  | "outline"             // open the outline rail overlay
  | "livePreview"         // toggle the side-by-side rendered pane
  | "cookMode"            // toggle big-text reading mode for hands-free recipe reading
  | "settings";           // open Settings

/** Fire a center action. AppShell listens for this event and dispatches
 *  to its local state. */
export function fireCenterAction(id: CenterActionId) {
  window.dispatchEvent(
    new CustomEvent("yarrow:center-action", { detail: { id } }),
  );
}
