// Cross-platform keyboard-shortcut rendering (Svelte 5 port).
//
// Mac convention: modifier glyphs glued together ("⌘K", "⌘⇧N").
// Windows/Linux convention: words joined with "+" ("Ctrl+K", "Ctrl+Shift+N").
//
// Actual key handling in AppShell already uses `e.ctrlKey || e.metaKey`,
// so the functionality works everywhere — this file only governs how
// chords are *displayed* to the user.

export const IS_MAC: boolean =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** True when the app is running on Linux. Used to opt into
 *  Linux/webkit2gtk-specific font-rendering tweaks — different from
 *  IS_MAC because Linux's text-rendering pipeline (FreeType +
 *  fontconfig + harfbuzz, with no `-webkit-font-smoothing` knob) needs
 *  different defaults than the macOS pipeline to look crisp. */
export const IS_LINUX: boolean =
  typeof navigator !== "undefined" &&
  /Linux|X11/.test(navigator.platform) &&
  !/Android/.test(navigator.userAgent ?? "");

export type Chord = {
  mod?: boolean;    // Cmd on Mac, Ctrl elsewhere
  shift?: boolean;
  alt?: boolean;    // Option on Mac, Alt elsewhere
  key: string;      // printable key, e.g. "K", "N", "\\", ","
};

/** Sticky-keys-aware separator. When the user has enabled the
 *  accessibility "Sticky-keys aware" preference, we render shortcuts
 *  as sequences (⌘ then K) instead of chords (⌘K). Read at call time
 *  so a flip in Settings → Accessibility takes effect immediately. */
function stickyKeysAware(): boolean {
  try {
    const raw = localStorage.getItem("yarrow.a11y.stickyKeysAware");
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

/** Render a chord using the current platform's convention. */
export function kbd(c: Chord): string {
  const sticky = stickyKeysAware();
  if (IS_MAC) {
    const parts = [
      c.mod && "⌘",
      c.alt && "⌥",
      c.shift && "⇧",
      c.key,
    ].filter(Boolean) as string[];
    return sticky ? parts.join(" then ") : parts.join("");
  }
  const parts = [
    c.mod && "Ctrl",
    c.alt && "Alt",
    c.shift && "Shift",
    c.key,
  ].filter(Boolean) as string[];
  return parts.join(sticky ? " then " : "+");
}

// Compress a filesystem path for display by replacing the user's home
// directory with `~`.
export function tildify(path: string): string {
  if (!path) return path;
  const posix = path.match(/^(\/home\/|\/Users\/)([^/]+)(\/.*)?$/);
  if (posix) {
    return "~" + (posix[3] ?? "");
  }
  const win = path.match(/^([A-Za-z]:[\\/])Users[\\/]([^\\/]+)([\\/].*)?$/);
  if (win) {
    return "~" + (win[3] ?? "");
  }
  return path;
}

/** Compute the named-shortcut bundle from the current platform +
 *  sticky-keys preference. */
export function namedShortcuts() {
  return {
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
    navBack:      kbd({ mod: true, key: "[" }),
  };
}

/** Named shortcut strings — single source of truth for display.
 *  Most callers read these at module load. The Shortcuts settings
 *  pane uses `namedShortcutsStore` for current sticky-aware values. */
export const SK = namedShortcuts();

class NamedShortcutsStore {
  value = $state<ReturnType<typeof namedShortcuts>>(namedShortcuts());

  constructor() {
    $effect.root(() => {
      const onChange = () => {
        this.value = namedShortcuts();
      };
      window.addEventListener("yarrow.a11y.stickyKeysAware-changed", onChange);
      return () =>
        window.removeEventListener("yarrow.a11y.stickyKeysAware-changed", onChange);
    });
  }
}

export const namedShortcutsStore = new NamedShortcutsStore();
