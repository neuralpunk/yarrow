// ────────────── Center actions ──────────────
// The radial menu's centre disc supports five gestures:
//
//   · tap           → command palette
//   · long-press    → constellation (connection graph)
//   · double-click  → toggle focus mode
//   · drag-out      → commits the wedge the pointer lands on
//   · scroll wheel  → rotates the radial's hover by one wedge
//
// Drag-out and scroll are handled inside `RadialMenu` itself because
// they operate on the radial (not on global state). The other three
// fire a `yarrow:center-action` window event with a stable id, and
// AppShell routes each id to the right piece of state.

export type CenterActionId = "palette" | "constellation" | "focus";

/** Fire a center action. AppShell listens for this event and dispatches
 *  to its local state (setPaletteOpen / setRailOverlay / setFocusMode). */
export function fireCenterAction(id: CenterActionId) {
  window.dispatchEvent(
    new CustomEvent("yarrow:center-action", { detail: { id } }),
  );
}
