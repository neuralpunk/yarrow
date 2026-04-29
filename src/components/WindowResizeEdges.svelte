<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";

  type Direction =
    | "North" | "South" | "East" | "West"
    | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";

  const EDGE = 10;
  const CORNER = 16;

  function startResize(direction: Direction) {
    return async (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        await (getCurrentWindow() as unknown as {
          startResizeDragging: (d: string) => Promise<void>;
        }).startResizeDragging(direction);
      } catch {
        /* no-op */
      }
    };
  }
</script>

<div
  class="fixed z-100 select-none"
  style:top="0"
  style:left="{CORNER}px"
  style:right="{CORNER}px"
  style:height="{EDGE}px"
  style:cursor="ns-resize"
  onpointerdown={startResize("North")}
  role="presentation"
></div>
<div
  class="fixed z-100 select-none"
  style:bottom="0"
  style:left="{CORNER}px"
  style:right="{CORNER}px"
  style:height="{EDGE}px"
  style:cursor="ns-resize"
  onpointerdown={startResize("South")}
  role="presentation"
></div>
<div
  class="fixed z-100 select-none"
  style:left="0"
  style:top="{CORNER}px"
  style:bottom="{CORNER}px"
  style:width="{EDGE}px"
  style:cursor="ew-resize"
  onpointerdown={startResize("West")}
  role="presentation"
></div>
<div
  class="fixed z-100 select-none"
  style:right="0"
  style:top="{CORNER}px"
  style:bottom="{CORNER}px"
  style:width="{EDGE}px"
  style:cursor="ew-resize"
  onpointerdown={startResize("East")}
  role="presentation"
></div>
<div
  class="fixed z-100 select-none"
  style:top="0"
  style:left="0"
  style:width="{CORNER}px"
  style:height="{CORNER}px"
  style:cursor="nwse-resize"
  onpointerdown={startResize("NorthWest")}
  role="presentation"
></div>
<div
  class="fixed z-100 select-none"
  style:top="0"
  style:right="0"
  style:width="{CORNER}px"
  style:height="{CORNER}px"
  style:cursor="nesw-resize"
  onpointerdown={startResize("NorthEast")}
  role="presentation"
></div>
<div
  class="fixed z-100 select-none"
  style:bottom="0"
  style:left="0"
  style:width="{CORNER}px"
  style:height="{CORNER}px"
  style:cursor="nesw-resize"
  onpointerdown={startResize("SouthWest")}
  role="presentation"
></div>
<div
  class="fixed z-100 select-none"
  style:bottom="0"
  style:right="0"
  style:width="{CORNER}px"
  style:height="{CORNER}px"
  style:cursor="nwse-resize"
  onpointerdown={startResize("SouthEast")}
  role="presentation"
></div>
