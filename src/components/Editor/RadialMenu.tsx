import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fireCenterAction } from "./center/actions";
import { useT } from "../../lib/i18n";

// ────────────── Radial menu ──────────────
// A donut-shaped pie menu: right-click in the editor opens this at the
// cursor, with a ring of wedges arranged around a central cancel disc.
// Hover highlights a wedge; click commits. Keyboard: Tab / Shift-Tab
// cycle, Enter commits, Escape cancels. The whole thing renders into
// `document.body` via a portal so nothing in the editor DOM can clip it
// (same lesson the autocomplete tooltip taught us — nested
// overflow-hidden ancestors are hostile to floating UI on webkit2gtk).

export interface RadialMenuItem {
  id: string;
  label: string;
  /** Smaller text under the label (keyboard hint, snippet preview, etc.). */
  sublabel?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  /** Viewport-coord where the right-click happened. */
  x: number;
  y: number;
  items: RadialMenuItem[];
  onClose: () => void;
}

// Geometry. Tuned so a 6-item ring has ~110° of arc per wedge which
// reads clearly without crowding the label foreignObjects.
const OUTER = 134;
const INNER = 46;
const LABEL_RADIUS = (OUTER + INNER) / 2;
// 2.1 tightened: was 320 (left a visible empty annulus between the
// wedge ring and the wrapper edge that read as a "white outer halo"
// on the rose Ashrose palette). Pulling the SVG canvas in to just
// 8px past 2*OUTER hugs the wedges; foreignObject labels (which can
// extend ~16px past OUTER on the longest wedges) still render fine
// because `.radial-menu` has `overflow: visible` set.
const SVG_SIZE = 284;

// Long-press threshold and double-click window, in ms. Tuned to feel
// crisp — shorter than most OS defaults so the radial's own gestures
// don't compete with the OS's.
const LONG_PRESS_MS = 380;
const DOUBLE_CLICK_MS = 280;

export default function RadialMenu({ open, x, y, items, onClose }: Props) {
  const t = useT();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Measure-and-correct centering. The body may have `zoom:
  // var(--ui-zoom)` for the UI-scale pref; plain `left: x - half`
  // math in bare pixels puts the menu off-center under any zoom
  // other than 1, because the `left` value and the `clientX` the
  // user clicked at are in different coord spaces (local layout
  // vs. visual pixels). Solution: let the browser position the
  // wrapper however it wants, then read its visual rect via
  // `getBoundingClientRect` (always viewport CSS pixels, aka
  // visual) and apply a translate correction so its visual
  // centre ends up exactly at `(x, y)`.
  useLayoutEffect(() => {
    if (!open) return;
    const el = wrapperRef.current;
    if (!el) return;
    // Reset so the measurement is consistent across re-opens.
    el.style.transform = "translate(-50%, -50%)";
    // rAF so the browser has committed the initial translate
    // before we measure.
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const centreX = rect.left + rect.width / 2;
      const centreY = rect.top + rect.height / 2;
      // 2.1 sharpness fix: `getBoundingClientRect()` returns fractional
      // pixels (e.g. left=0.372), and dropping a fractional offset into
      // the transform makes webkit2gtk rasterize the SVG at sub-pixel
      // boundaries — every wedge edge gets anti-aliased into a blur.
      // Math.round snaps to pixel boundaries so the whole radial lands
      // exactly on a pixel grid and wedge boundaries render as a
      // single-pixel-wide hard line.
      const dx = Math.round(x - centreX);
      const dy = Math.round(y - centreY);
      // Add the correction on top of the half-size translate. If
      // body zoom is 1 (no mismatch), dx/dy resolve to 0.
      el.style.transform =
        `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    return () => cancelAnimationFrame(raf);
  }, [open, x, y]);

  // ─── Centre disc gesture machinery ───
  // `pressing` drives the ring-fill animation. `longPressFiredRef`
  // tells the mouseup handler to skip the click-resolution branch
  // because the long-press already handled it. `lastClickAtRef`
  // tracks the previous resolved click so a second one inside the
  // double-click window upgrades it to a dbl-click. `singleClickTimer`
  // defers the single-click action long enough to see whether a
  // second click is coming.
  const [pressing, setPressing] = useState(false);
  const longPressFiredRef = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const singleClickTimer = useRef<number | null>(null);
  const lastClickAtRef = useRef<number>(0);
  const hoverIdxRef = useRef<number | null>(null);
  hoverIdxRef.current = hoverIdx;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Reset hover when the menu re-opens so the previous highlight
  // doesn't bleed into a fresh invocation at a different location.
  useEffect(() => {
    if (open) setHoverIdx(null);
  }, [open, x, y]);

  // Keyboard: Esc closes, Enter commits hovered wedge, Tab cycles.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter" && hoverIdx != null) {
        e.preventDefault();
        const it = items[hoverIdx];
        if (it && !it.disabled) it.onSelect();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setHoverIdx((i) => {
          const base = i == null ? -1 : i;
          const delta = e.shiftKey ? -1 : 1;
          return (base + delta + items.length) % items.length;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, hoverIdx, onClose]);

  // ─── Centre disc: resolve tap / long-press / double-click / drag-out
  //
  // Press on the centre → start the long-press timer and the
  // ring-fill animation. On release, we decide:
  //   1. If long-press already fired → nothing to do.
  //   2. If the pointer is over a wedge → commit that wedge
  //      (drag-out gesture, no second click needed).
  //   3. If a previous click is within the dbl-click window →
  //      fire the double-click action.
  //   4. Otherwise → schedule the single-click action, which fires
  //      after the dbl-click window expires (so a follow-up click
  //      can still upgrade to dbl-click).
  useEffect(() => {
    if (!pressing) return;
    const onUp = () => {
      setPressing(false);
      if (longPressTimer.current != null) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false;
        return;
      }
      // Drag-out wins before click resolution: if the pointer left
      // the centre and is now hovering a wedge, commit it.
      const hi = hoverIdxRef.current;
      if (hi != null) {
        const it = itemsRef.current[hi];
        if (it && !it.disabled) {
          it.onSelect();
          return;
        }
      }
      // Click resolution — tap or dbl-click?
      const now = Date.now();
      const sinceLast = now - lastClickAtRef.current;
      if (sinceLast < DOUBLE_CLICK_MS && singleClickTimer.current != null) {
        // Second click inside the window → upgrade to dbl-click.
        window.clearTimeout(singleClickTimer.current);
        singleClickTimer.current = null;
        lastClickAtRef.current = 0;
        fireCenterAction("focus");
        onClose();
        return;
      }
      // Single click: defer so a second one can still upgrade.
      lastClickAtRef.current = now;
      singleClickTimer.current = window.setTimeout(() => {
        singleClickTimer.current = null;
        lastClickAtRef.current = 0;
        fireCenterAction("palette");
        onClose();
      }, DOUBLE_CLICK_MS);
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [pressing, onClose]);

  // ─── Scroll wheel anywhere over the radial → rotate hover.
  // Bound via a native listener with passive:false so we can block the
  // page behind the backdrop from scrolling at the same time.
  useEffect(() => {
    if (!open) return;
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 1 : -1;
      setHoverIdx((i) => {
        const n = itemsRef.current.length;
        if (n === 0) return i;
        const base = i == null ? -1 : i;
        return (base + delta + n) % n;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  // Cancel pending timers if the menu closes mid-press (e.g. a click
  // on the backdrop before the gesture resolved).
  useEffect(() => {
    if (open) return;
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (singleClickTimer.current != null) {
      window.clearTimeout(singleClickTimer.current);
      singleClickTimer.current = null;
    }
    setPressing(false);
    longPressFiredRef.current = false;
    lastClickAtRef.current = 0;
  }, [open]);

  if (!open) return null;

  // The whole premise of a radial menu is "cursor = center" — your
  // pointer starts at the middle and only needs to flick out to any
  // wedge. A clamp that tries to keep the whole disc inside the
  // viewport (by snapping the centre `half + margin` from any edge)
  // defeats that promise — any click within ~170 px of the top edge
  // would shove the ring downward so the cursor landed on the top
  // wedge.
  //
  // Tiny 4 px clamp only, so the centre can't literally be off the
  // screen. The actual centering math is done in CSS below via
  // `transform: translate(-50%, -50%)` — that's the one technique
  // that's robust to ancestor zoom/transform, because it shifts by
  // HALF THE RENDERED ELEMENT'S OWN size (computed after zoom) rather
  // than by a pixel constant we've baked in.
  const half = SVG_SIZE / 2;
  const margin = 4;
  const clampedX = Math.min(Math.max(margin, x), window.innerWidth - margin);
  const clampedY = Math.min(Math.max(margin, y), window.innerHeight - margin);

  const N = items.length;
  // First wedge centered at the top (-90°).
  const startAng = -Math.PI / 2 - Math.PI / N;
  const step = (2 * Math.PI) / N;
  const largeArc = step > Math.PI ? 1 : 0;

  const wedges = items.map((it, i) => {
    const a0 = startAng + i * step;
    const a1 = a0 + step;
    const am = (a0 + a1) / 2;

    const x0o = half + OUTER * Math.cos(a0);
    const y0o = half + OUTER * Math.sin(a0);
    const x1o = half + OUTER * Math.cos(a1);
    const y1o = half + OUTER * Math.sin(a1);
    const x0i = half + INNER * Math.cos(a0);
    const y0i = half + INNER * Math.sin(a0);
    const x1i = half + INNER * Math.cos(a1);
    const y1i = half + INNER * Math.sin(a1);

    // Donut-wedge path: inner corner → outer corner → outer arc →
    // inner corner → inner arc (reversed) → close.
    const d = [
      `M ${x0i} ${y0i}`,
      `L ${x0o} ${y0o}`,
      `A ${OUTER} ${OUTER} 0 ${largeArc} 1 ${x1o} ${y1o}`,
      `L ${x1i} ${y1i}`,
      `A ${INNER} ${INNER} 0 ${largeArc} 0 ${x0i} ${y0i}`,
      "Z",
    ].join(" ");

    const lx = half + LABEL_RADIUS * Math.cos(am);
    const ly = half + LABEL_RADIUS * Math.sin(am);
    return { d, lx, ly, item: it, idx: i };
  });

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[200]"
      // Click anywhere that isn't the menu itself → close.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // Block the contextmenu on the backdrop so a second right-click
      // doesn't spawn an OS-level menu behind ours.
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={wrapperRef}
        className="radial-menu-wrapper absolute"
        style={{
          // `left`/`top` are the *initial* anchor. The layout effect
          // above measures where this element actually rendered in
          // visual pixels and applies a translate correction so its
          // visual centre lands precisely at (x, y) — robust to body
          // zoom, ancestor transforms, and any future containing-
          // block quirks.
          left: clampedX,
          top: clampedY,
          width: SVG_SIZE,
          height: SVG_SIZE,
          transform: "translate(-50%, -50%)",
          transformOrigin: "center center",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <svg
          ref={svgRef}
          width={SVG_SIZE}
          height={SVG_SIZE}
          className="radial-menu animate-radialIn"
        >
          {wedges.map((w) => {
            const selected = hoverIdx === w.idx;
            const dis = !!w.item.disabled;
            return (
              <g
                key={w.item.id}
                className={`radial-wedge ${selected ? "is-selected" : ""} ${
                  dis ? "is-disabled" : ""
                }`}
                onMouseEnter={() => {
                  if (!dis) setHoverIdx(w.idx);
                }}
                onMouseLeave={() => {
                  setHoverIdx((i) => (i === w.idx ? null : i));
                }}
                onClick={() => {
                  if (!dis) w.item.onSelect();
                }}
              >
                <path d={w.d} />
                <foreignObject
                  x={w.lx - 52}
                  y={w.ly - 30}
                  width={104}
                  height={60}
                  pointerEvents="none"
                >
                  <div className="radial-label">
                    <div className="radial-icon">{w.item.icon}</div>
                    <div className="radial-text">{w.item.label}</div>
                    {w.item.sublabel && (
                      <div className="radial-sub">{w.item.sublabel}</div>
                    )}
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* Centre disc — five gestures live here.
              · tap           → command palette
              · long-press    → constellation (ring fills as feedback)
              · double-click  → toggle focus mode
              · drag-out      → handled in the mouseup handler
              · scroll wheel  → bound on the svg, rotates hover
              Right-click on the centre still closes the menu. */}
          <g className={pressing ? "radial-center-pressing" : ""}>
            <circle
              cx={half}
              cy={half}
              r={INNER - 3}
              className="radial-center"
              onMouseDown={(e) => {
                if (e.button !== 0) return; // only left button
                e.stopPropagation();
                e.preventDefault();
                longPressFiredRef.current = false;
                setPressing(true);
                if (longPressTimer.current != null) {
                  window.clearTimeout(longPressTimer.current);
                }
                longPressTimer.current = window.setTimeout(() => {
                  longPressFiredRef.current = true;
                  setPressing(false);
                  longPressTimer.current = null;
                  // Cancel any pending single-click so the long-press
                  // doesn't get a trailing palette open.
                  if (singleClickTimer.current != null) {
                    window.clearTimeout(singleClickTimer.current);
                    singleClickTimer.current = null;
                    lastClickAtRef.current = 0;
                  }
                  fireCenterAction("constellation");
                  onClose();
                }, LONG_PRESS_MS);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
            />
            {/* Ring-fill animation — rotated -90° so it starts at
                12 o'clock and sweeps clockwise while the user holds. */}
            <circle
              cx={half}
              cy={half}
              r={INNER - 3}
              className="radial-center-fill"
              transform={`rotate(-90 ${half} ${half})`}
              pointerEvents="none"
            />
            {/* ── The Still Point ──
                A 3×3 pixel-grid sitting at the centre of the disc,
                with a lifted core dot. Eight ghost interstitials
                layered at half-distance give the glyph a fading
                wireframe-mesh feel — the mark reads as "a grid
                receding into the back with one pixel held in
                focus." All coordinates are ±8 (main) and ±4 (ghost)
                from centre, well inside the r=43 disc. */}
            <title>{t("editor.radial.stillPointTitle")}</title>
            <g className="radial-still-point" pointerEvents="none">
              {/* Ghost interstitial layer — 8 barely-visible dots at
                  half the main-grid spacing. Sits under the main
                  grid so the 3×3 stays prominent. */}
              {[
                [-1, -1], [0, -1], [1, -1],
                [-1,  0],          [1,  0],
                [-1,  1], [0,  1], [1,  1],
              ].map(([dx, dy]) => (
                <circle
                  key={`g${dx}${dy}`}
                  cx={half + dx * 4}
                  cy={half + dy * 4}
                  r={0.55}
                  className="radial-still-ghost"
                />
              ))}
              {/* Main 3×3 — corners + edges muted, centre dot lifted
                  and reskinned on press so the mark has a clear
                  focal point and interactive feedback. */}
              {[
                [-1, -1], [0, -1], [1, -1],
                [-1,  0], [0,  0], [1,  0],
                [-1,  1], [0,  1], [1,  1],
              ].map(([dx, dy]) => {
                const isCore = dx === 0 && dy === 0;
                return (
                  <circle
                    key={`m${dx}${dy}`}
                    cx={half + dx * 8}
                    cy={half + dy * 8}
                    r={isCore ? 2.4 : 1.3}
                    className={isCore ? "radial-still-dot" : "radial-still-muted"}
                  />
                );
              })}
            </g>
          </g>
        </svg>
      </div>
    </div>,
    // Mount inside <body>, NOT <html>. Body has `zoom: var(--ui-zoom)`
    // from the UI-scale pref (compact/cozy/roomy) — and crucially
    // `e.clientX` / `e.clientY` are reported in body's local coord
    // space too, because the event fires on elements inside body.
    // Keeping the portal there means both speak the same units, so
    // `left: clientX - half` centers correctly regardless of zoom.
    // Hosting the portal in <html> breaks that symmetry — the
    // positioning and the click coords end up in different spaces.
    document.body,
  );
}
