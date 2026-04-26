import { APP_VERSION } from "../lib/version";

interface Props {
  workspaceName?: string;
}

// Platform detection at module load. With 2.1.5's `decorations: true`
// + `titleBarStyle: "Transparent"` configuration, the OS provides a
// fully-functional native title bar on every platform — Linux's
// GNOME / KDE / etc. paint their own with min/max/close, Windows
// paints the standard one, and macOS draws a transparent title bar
// with traffic lights at the standard top-left position. Rendering
// our own identity strip below the OS bar on Linux/Windows turned
// out to look like a duplicate (per Fedora 43 user report), so the
// custom Titlebar is now macOS-only — there it sits as a thin
// wordmark/workspace-name strip just below the transparent OS title
// bar (which carries the traffic lights). On Linux/Windows we let
// the native title bar carry the window's identity via its title
// text, and skip the second bar entirely.
const IS_MAC = (() => {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator.userAgent || "").toLowerCase();
  const p = (navigator.platform || "").toLowerCase();
  return p.includes("mac") || /iphone|ipad|ipod/.test(p) || /mac os x/.test(ua);
})();

export default function Titlebar({ workspaceName }: Props) {
  if (!IS_MAC) return null;
  return (
    <div
      data-tauri-drag-region
      className="h-7 shrink-0 flex items-center gap-2 bg-bg-soft border-b border-bd select-none px-3"
    >
      <span
        data-tauri-drag-region
        className="font-serif italic text-[13px] text-char pointer-events-none"
      >
        Yarrow
      </span>
      <span
        data-tauri-drag-region
        className="text-2xs text-t3 font-mono pointer-events-none"
      >
        v{APP_VERSION}
      </span>
      {workspaceName && (
        <>
          <span
            data-tauri-drag-region
            className="text-t3 text-xs pointer-events-none"
          >
            ·
          </span>
          <span
            data-tauri-drag-region
            className="text-xs text-t2 truncate pointer-events-none"
          >
            {workspaceName}
          </span>
        </>
      )}
      {/* No window controls — the OS-drawn traffic lights in the
          transparent title bar above us handle close / minimize /
          zoom on macOS. */}
    </div>
  );
}
