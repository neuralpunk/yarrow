import React from "react";
import ReactDOM from "react-dom/client";
import "katex/dist/katex.min.css";
import "./index.css";
import App from "./App";
import {
  getMacViewportFudge,
  VP_FUDGE_CHANGED_EVENT,
} from "./lib/macViewportFudge";

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

// macOS Tahoe + Tauri 2 + WKWebView consistently over-reports the
// visible viewport height by a sizeable margin — far more than the
// 28 px title-bar deficit alone would explain. The combined error
// is the sum of: title bar (~28 px), the system status strip
// allocation that WKWebView reserves but doesn't subtract from
// `visualViewport.height`, and (with `decorations: true` and the
// transparent traffic-light overlay) a window-server fudge that
// reserves a few extra rows for the OS to paint into. Empirically
// the deficit is ~100-260 px on Tahoe and varies across macOS
// versions, so the actual value lives in `lib/macViewportFudge.ts`
// and is exposed as a five-rung preset slider in Settings →
// Appearance (Mac only) so users who hit the cutoff bug can self-
// fix without waiting for a release. See that module for the full
// rationale and the storage / event protocol.

function readViewportHeight(): number {
  const vv = window.visualViewport;
  let h = 0;
  if (vv && vv.height > 0) h = vv.height;
  else if (document.documentElement.clientHeight > 0)
    h = document.documentElement.clientHeight;
  else h = window.innerHeight;

  if (document.documentElement.dataset.platform === "mac") {
    h -= getMacViewportFudge();
  }
  // Sanity floor — no matter what the OS or override claims, never
  // collapse the layout to less than 200 px. The min window height
  // is 560 px in tauri.conf.json, so this floor only kicks in if a
  // hostile localStorage override would otherwise hide the chrome.
  return Math.max(h, 200);
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
// Settings → Appearance → "macOS bottom-edge correction" dispatches
// this when the user picks a different preset. Resync immediately so
// the layout reflows on the spot — no reload required.
window.addEventListener(VP_FUDGE_CHANGED_EVENT, scheduleSync);

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
