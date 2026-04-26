import React from "react";
import ReactDOM from "react-dom/client";
import "katex/dist/katex.min.css";
import "./index.css";
import App from "./App";

// 2.1.7 macOS bottom-cutoff fix.
// macOS reports `100dvh` differently from `window.innerHeight` in
// Tauri 2's WKWebView under several conditions documented upstream:
//   · Title-bar height is included in the configured window height
//     on macOS (issue tauri-apps/tauri#6333), so the
//     `tauri.conf.json` `height: 900` is total-window-incl-title-bar
//     on macOS but content-only on Linux/Windows.
//   · Title-bar height varies across macOS versions (Tauri's own
//     docs call this out as a caveat of `titleBarStyle`); Tahoe's
//     standard NSWindow title bar isn't the same height as Sequoia's,
//     and `100dvh` ends up reporting a value that doesn't match the
//     actual visible content area.
//
// `window.innerHeight`, by contrast, reflects exactly what WKWebView
// has laid out for the document — i.e. the actually-visible area.
// We pin a `--vp-h` CSS custom property to that value and use it in
// place of `100dvh` for the root layout. Resize-driven so window
// drags / fullscreen toggles re-sync immediately.
//
// `setProperty(name, value, "")` (rather than React's useEffect)
// because this needs to run BEFORE the first paint — a useEffect
// would fire after first render and flash the wrong height.
function syncViewportHeight() {
  document.documentElement.style.setProperty(
    "--vp-h",
    `${window.innerHeight}px`,
  );
}
syncViewportHeight();
window.addEventListener("resize", syncViewportHeight);
window.addEventListener("orientationchange", syncViewportHeight);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
