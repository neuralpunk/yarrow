import { getCurrentWindow } from "@tauri-apps/api/window";

/** Tauri 2's `ResizeDirection` enum doesn't export cleanly to TS in some
 *  versions, so we use the string form (which is what the Rust side
 *  ultimately matches against). */
type Direction =
  | "North" | "South" | "East" | "West"
  | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";

/** Thickness of the invisible resize rim, in CSS pixels. The OS window
 *  frame still owns the area outside our webview, but most Linux WMs only
 *  give 3–5 px of grab there — adding our own ~10 px just inside the
 *  webview gives the user a forgiving target without showing any chrome. */
const EDGE = 10;
const CORNER = 16;

function startResize(direction: Direction) {
  return async (e: React.PointerEvent) => {
    // Don't begin a resize on right-click etc.; only the primary button.
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      // Tauri 2 accepts the direction as a string at the IPC boundary.
      // Casting through `unknown` keeps us off the brittle generated enum.
      await (getCurrentWindow() as unknown as {
        startResizeDragging: (d: string) => Promise<void>;
      }).startResizeDragging(direction);
    } catch {
      // No-op: dev/web mode (no Tauri context) or the window is maximized.
    }
  };
}

/** Eight overlay zones around the window perimeter that act as roomy
 *  resize handles. Pure visual transparency — only the cursor changes on
 *  hover. The host needs `position: relative` (App.tsx's root flex column
 *  already is once we put this inside it). */
export default function WindowResizeEdges() {
  // shared base style
  const baseClass = "fixed z-[100] select-none";
  return (
    <>
      {/* edges */}
      <div
        className={baseClass}
        style={{ top: 0, left: CORNER, right: CORNER, height: EDGE, cursor: "ns-resize" }}
        onPointerDown={startResize("North")}
      />
      <div
        className={baseClass}
        style={{ bottom: 0, left: CORNER, right: CORNER, height: EDGE, cursor: "ns-resize" }}
        onPointerDown={startResize("South")}
      />
      <div
        className={baseClass}
        style={{ left: 0, top: CORNER, bottom: CORNER, width: EDGE, cursor: "ew-resize" }}
        onPointerDown={startResize("West")}
      />
      <div
        className={baseClass}
        style={{ right: 0, top: CORNER, bottom: CORNER, width: EDGE, cursor: "ew-resize" }}
        onPointerDown={startResize("East")}
      />
      {/* corners — square, take precedence over edges via larger area */}
      <div
        className={baseClass}
        style={{ top: 0, left: 0, width: CORNER, height: CORNER, cursor: "nwse-resize" }}
        onPointerDown={startResize("NorthWest")}
      />
      <div
        className={baseClass}
        style={{ top: 0, right: 0, width: CORNER, height: CORNER, cursor: "nesw-resize" }}
        onPointerDown={startResize("NorthEast")}
      />
      <div
        className={baseClass}
        style={{ bottom: 0, left: 0, width: CORNER, height: CORNER, cursor: "nesw-resize" }}
        onPointerDown={startResize("SouthWest")}
      />
      <div
        className={baseClass}
        style={{ bottom: 0, right: 0, width: CORNER, height: CORNER, cursor: "nwse-resize" }}
        onPointerDown={startResize("SouthEast")}
      />
    </>
  );
}
