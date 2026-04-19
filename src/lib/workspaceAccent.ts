// Deterministic pastel accent for a workspace, derived from its folder path.
// The same workspace always gets the same color so switchers can glance at
// the monogram square and know where they are before reading the name.
//
// Colors are produced by mixing a hashed hue with the current theme's
// --bg / --char tokens via color-mix, so the accent stays inside Yarrow's
// muted palette in both light and dark mode — no hand-maintained palette.

function hueFromPath(path: string): number {
  // Small non-cryptographic hash; stable across sessions because it only
  // depends on the string content. The multiplier 2654435761 is Knuth's.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 360;
}

export interface WorkspaceAccent {
  /** Background for avatar / monogram square. */
  background: string;
  /** Foreground for monogram letter. */
  color: string;
  /** Ring / border hint for the active workspace. */
  ring: string;
}

/** Returns a style object for a workspace monogram. `active` bumps saturation
 *  so the currently-open workspace reads as "live" at a glance. */
export function workspaceAccent(path: string, active: boolean): WorkspaceAccent {
  const h = hueFromPath(path || "default");
  const seed = `hsl(${h} 55% 50%)`;
  const bgMix = active ? 38 : 18;
  const fgMix = active ? 80 : 65;
  return {
    background: `color-mix(in oklch, ${seed} ${bgMix}%, var(--bg))`,
    color: `color-mix(in oklch, ${seed} ${fgMix}%, var(--char))`,
    ring: `color-mix(in oklch, ${seed} 55%, var(--bg))`,
  };
}
