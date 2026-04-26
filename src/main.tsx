import React from "react";
import ReactDOM from "react-dom/client";
import "katex/dist/katex.min.css";
import "./index.css";
import App from "./App";

// 2.2.0 macOS bottom-cutoff: belt-and-braces viewport sync.
// History — 2.1.5 → 2.1.7 chased this through `titleBarStyle` Overlay /
// Transparent / removed, the `--vp-h` custom property based on
// `window.innerHeight`, the flex chain in `App.tsx`, and `position:
// fixed; inset: 0`. None of those alone fully held on macOS Tahoe.
//
// What 2.2.0 changes — pull the height from every signal we have, in
// priority order, and resync on every event that could possibly move
// it. The fundamental issue is that on macOS Tahoe under Tauri 2's
// WKWebView, `window.innerHeight` is sometimes briefly wrong (off by
// the title-bar height or by a few pixels' worth of OS-chrome
// adjustment) for a frame or two after the window finishes its launch
// animation, after a fullscreen toggle, after a dock-visibility change,
// or after a display-arrangement change. By the time `resize` fires,
// the wrong value has already been applied.
//
// Defences, in order of trustworthiness on macOS WKWebView:
//   1. `visualViewport.height`  — reflects the *visually visible* area
//      and on WKWebView correctly excludes the title-bar region even
//      when `innerHeight` doesn't.
//   2. `documentElement.clientHeight` — fallback when visualViewport
//      is somehow unavailable (older WebKit, headless test envs).
//   3. `window.innerHeight` — last-resort fallback.
//
// Listeners — every plausible signal that the viewport has moved:
//   · `resize` / `orientationchange` on window
//   · `resize` on visualViewport (fires when only the inner viewport
//     changes — e.g. when a software keyboard appears)
//   · `focus` / `visibilitychange` (on Tahoe, dock auto-hide can fire
//     when focus returns to the window)
//   · Tauri's `getCurrentWindow().onResized` (Cocoa-level resize signal,
//     fires before `innerHeight` has caught up — schedule a sync via
//     `requestAnimationFrame` for the next frame)
//   · ResizeObserver on documentElement — catches anything the discrete
//     events miss (e.g. devicePixelRatio adjustments after a display
//     change)
//   · Multi-stage post-load polling (RAF + 50/200/500/1500 ms) — covers
//     the launch-animation tail where the window settles into its
//     final size after first paint.
//
// `setProperty(name, value)` (instead of a useEffect) because this needs
// to run BEFORE the first paint — useEffect would fire after first
// render and flash the wrong height.

// 2.2.0 — set `data-platform="mac"` on <html> before first paint so
// CSS can gate platform-specific styling (e.g., let macOS keep its
// native auto-hiding overlay scrollbars instead of our 10 px chrome).
// Detection mirrors `IS_MAC` in lib/platform.ts; kept inline to avoid
// pulling that module in at the very top of the bootstrap.
(function setPlatformAttr() {
  try {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    document.documentElement.dataset.platform = isMac ? "mac" : "other";
  } catch {
    /* ignore — no DOM in non-browser harnesses */
  }
})();

function readViewportHeight(): number {
  const vv = window.visualViewport;
  if (vv && vv.height > 0) return vv.height;
  const ce = document.documentElement.clientHeight;
  if (ce > 0) return ce;
  return window.innerHeight;
}

function syncViewportHeight() {
  document.documentElement.style.setProperty(
    "--vp-h",
    `${readViewportHeight()}px`,
  );
}

function scheduleSync() {
  // Defer to the next paint frame: most macOS resize signals fire
  // *before* WKWebView has updated `visualViewport.height`, so reading
  // synchronously gives the stale value. RAF puts us on the other side
  // of the layout phase.
  requestAnimationFrame(syncViewportHeight);
}

syncViewportHeight();
window.addEventListener("resize", scheduleSync);
window.addEventListener("orientationchange", scheduleSync);
window.addEventListener("focus", scheduleSync);
document.addEventListener("visibilitychange", scheduleSync);
window.visualViewport?.addEventListener("resize", scheduleSync);

// Catch-all: any layout-affecting change to <html> height retriggers
// the sync. Cheap because the callback only writes a CSS variable.
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(syncViewportHeight).observe(document.documentElement);
}

// Post-load polling — covers the macOS Tahoe launch-animation tail
// where the window settles into its final size only after first paint.
// We run a fixed schedule rather than a recursive RAF loop so the cost
// is bounded and the page eventually returns to event-driven updates.
window.addEventListener("load", () => {
  scheduleSync();
  for (const ms of [50, 200, 500, 1500]) {
    window.setTimeout(syncViewportHeight, ms);
  }
});

// Tauri-level resize signal. The Cocoa-side `windowDidResize` fires
// before WKWebView's `visualViewport` has updated, so we schedule a
// sync for the next frame. Wrapped in a dynamic import so the build
// doesn't require the API for the future web target.
import("@tauri-apps/api/window")
  .then(({ getCurrentWindow }) => {
    try {
      const w = getCurrentWindow();
      w.onResized(scheduleSync).catch(() => {});
      // After the window first becomes ready we also schedule one more
      // late sync — Tahoe sometimes finishes its launch animation here.
      w.onFocusChanged(scheduleSync).catch(() => {});
    } catch {
      /* not running inside Tauri (vite preview, tests) */
    }
  })
  .catch(() => {
    /* @tauri-apps/api/window not present in non-desktop bundle */
  });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
