// Cross-platform keyboard-shortcut rendering.
//
// Mac convention: modifier glyphs glued together ("⌘K", "⌘⇧N").
// Windows/Linux convention: words joined with "+" ("Ctrl+K", "Ctrl+Shift+N").
//
// Actual key handling in AppShell already uses `e.ctrlKey || e.metaKey`, so
// the functionality works everywhere — this file only governs how chords are
// *displayed* to the user.

export const IS_MAC: boolean =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export type Chord = {
  mod?: boolean;    // Cmd on Mac, Ctrl elsewhere
  shift?: boolean;
  alt?: boolean;    // Option on Mac, Alt elsewhere
  key: string;      // printable key, e.g. "K", "N", "\\", ","
};

/** Render a chord using the current platform's convention. */
export function kbd(c: Chord): string {
  if (IS_MAC) {
    return [
      c.mod && "⌘",
      c.alt && "⌥",
      c.shift && "⇧",
      c.key,
    ].filter(Boolean).join("");
  }
  return [
    c.mod && "Ctrl",
    c.alt && "Alt",
    c.shift && "Shift",
    c.key,
  ].filter(Boolean).join("+");
}

/** Named shortcut strings — single source of truth for display. */
export const SK = {
  palette:      kbd({ mod: true, key: "K" }),
  newNote:      kbd({ mod: true, key: "N" }),
  newDirection: kbd({ mod: true, shift: true, key: "N" }),
  branchFromHere: kbd({ mod: true, shift: true, key: "B" }),
  focusToggle:  kbd({ mod: true, key: "\\" }),
  settings:     kbd({ mod: true, key: "," }),
  quickSwitch:  kbd({ mod: true, key: "O" }),
  jumpToday:    kbd({ mod: true, key: "T" }),
  scratchpad:   kbd({ mod: true, shift: true, key: "S" }),
  switchWorkspace: kbd({ mod: true, shift: true, key: "O" }),
};
