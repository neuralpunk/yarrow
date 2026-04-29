// Warm the heavy lazy-loaded bundles during idle time so the first time the
// user actually opens them (Map, Settings, palette, etc.) the JS is already
// parsed. Each import starts the fetch + parse immediately but its result is
// discarded — Vite's module graph reuses the cached module when the component
// finally mounts.

type Idle = (cb: () => void) => void;

const schedule: Idle =
  (typeof window !== "undefined" && "requestIdleCallback" in window)
    ? (cb) => (window as unknown as { requestIdleCallback: (c: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback(cb, { timeout: 2500 })
    : (cb) => window.setTimeout(cb, 1200);

let fired = false;
/** Pre-warm idle-time chunks. The `mappingEnabled` flag (defaults true)
 *  gates the map / paths / decision-matrix surfaces — in basic-notes
 *  mode those screens are never reachable, so warming them is pure
 *  waste (parse cost + memory + mobile bandwidth). */
export function prefetchHeavyChunks(mappingEnabled: boolean = true) {
  if (fired) return;
  fired = true;
  // Highest-priority idle warm: the editor. Its CodeMirror bundle is the
  // single biggest chunk; warming it right after first paint means the user's
  // first click into a note is still instant.
  schedule(() => {
    void import("../components/Editor/NoteEditor.svelte");
  });
  schedule(() => {
    void import("../components/CommandPalette.svelte");
    void import("../components/Settings.svelte");
    if (mappingEnabled) {
      // Map view exists only in mapped workspaces — skipping the
      // ConnectionGraph chunk in basic mode trims a non-trivial amount
      // of D3 + force-graph parse work from cold start.
      void import("../components/RightSidebar/ConnectionGraph.svelte");
    }
  });
  schedule(() => {
    void import("../components/Editor/HistorySlider.svelte");
    void import("../components/QuickSwitcher.svelte");
    void import("../components/QuickCapture.svelte");
    void import("../components/Scratchpad.svelte");
  });
  // 1.1 surfaces — warmed last so they don't compete with the editor warm
  // for first-paint idle time. Reading mode is high-value because flipping
  // into it is a common interaction.
  schedule(() => {
    void import("../components/Editor/NoteReader.svelte");
    if (mappingEnabled) {
      // DecisionMatrix is a paths-only surface — skip in basic mode.
      void import("../components/DecisionMatrix.svelte");
    }
    void import("../components/FindReplace.svelte");
    void import("../components/Trash.svelte");
  });
}
