// Warm the heavy lazy-loaded bundles during idle time so the first time the
// user actually opens them (Map, Settings, palette, etc.) the JS is already
// parsed. Each import starts the fetch + parse immediately but its result is
// discarded — React.lazy will reuse the cached module when the component
// finally mounts.

type Idle = (cb: () => void) => void;

const schedule: Idle =
  (typeof window !== "undefined" && "requestIdleCallback" in window)
    ? (cb) => (window as unknown as { requestIdleCallback: (c: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback(cb, { timeout: 2500 })
    : (cb) => window.setTimeout(cb, 1200);

let fired = false;
export function prefetchHeavyChunks() {
  if (fired) return;
  fired = true;
  // Highest-priority idle warm: the editor. Its CodeMirror bundle is the
  // single biggest chunk; warming it right after first paint means the user's
  // first click into a note is still instant.
  schedule(() => {
    void import("../components/Editor/NoteEditor");
  });
  schedule(() => {
    void import("../components/CommandPalette");
    void import("../components/Settings");
    void import("../components/RightSidebar/ConnectionGraph");
  });
  schedule(() => {
    void import("../components/Editor/HistorySlider");
    void import("../components/QuickSwitcher");
    void import("../components/QuickCapture");
    void import("../components/Scratchpad");
  });
}
