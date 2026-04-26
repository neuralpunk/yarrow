import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RadialMenuItem } from "./RadialMenu";

// ────────────── Linear context menu ──────────────
// The fallback when the "Radial right-click menu" Writing Extra is off.
// Vertical drop-down with icon + label + mono sublabel, keyboard
// navigation (↑/↓/Enter/Esc), portal to body to escape the editor's
// overflow-hidden ancestors.
//
// 2.2.0: items can carry a `submenu` array — when a parent has one, we
// render a `▸` and slide a second panel out to the right on hover or
// click. This is how the standard desktop right-click pattern handles
// "Format ▸" / "Inserts ▸" — the radial uses modals for those two
// because a radial doesn't have anywhere natural to nest.

interface Props {
  open: boolean;
  x: number;
  y: number;
  items: RadialMenuItem[];
  onClose: () => void;
}

const WIDTH = 240;
const ROW_H = 30;
const SUBMENU_OPEN_DELAY = 180;

export default function LinearContextMenu({
  open, x, y, items, onClose,
}: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [openSubIdx, setOpenSubIdx] = useState<number | null>(null);
  const [subHoverIdx, setSubHoverIdx] = useState<number | null>(null);
  const [parentRect, setParentRect] = useState<DOMRect | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const openSubTimer = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setHoverIdx(null);
      setOpenSubIdx(null);
      setSubHoverIdx(null);
    }
  }, [open, x, y]);

  useEffect(() => {
    return () => {
      if (openSubTimer.current) window.clearTimeout(openSubTimer.current);
    };
  }, []);

  // Open the submenu after a small dwell so brushing past parent rows
  // doesn't keep flashing them open.
  const scheduleSubmenuOpen = (idx: number) => {
    if (openSubTimer.current) window.clearTimeout(openSubTimer.current);
    openSubTimer.current = window.setTimeout(() => {
      const btn = rowRefs.current[idx];
      if (btn) setParentRect(btn.getBoundingClientRect());
      setOpenSubIdx(idx);
      setSubHoverIdx(null);
    }, SUBMENU_OPEN_DELAY);
  };

  const cancelSubmenuOpen = () => {
    if (openSubTimer.current) {
      window.clearTimeout(openSubTimer.current);
      openSubTimer.current = null;
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (openSubIdx != null) {
          // First Escape closes the submenu; a second Escape closes the
          // parent. Mirrors what GTK / macOS do.
          setOpenSubIdx(null);
          setSubHoverIdx(null);
          return;
        }
        onClose();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        // If a submenu is open, Enter commits its hovered row.
        if (openSubIdx != null && subHoverIdx != null) {
          const sub = items[openSubIdx]?.submenu;
          const it = sub?.[subHoverIdx];
          if (it && !it.disabled) it.onSelect?.();
          return;
        }
        if (hoverIdx != null) {
          const it = items[hoverIdx];
          if (it && !it.disabled) {
            if (it.submenu) {
              const btn = rowRefs.current[hoverIdx];
              if (btn) setParentRect(btn.getBoundingClientRect());
              setOpenSubIdx(hoverIdx);
              setSubHoverIdx(0);
            } else {
              it.onSelect?.();
            }
          }
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = openSubIdx != null ? (items[openSubIdx].submenu ?? []) : items;
        const setter = openSubIdx != null ? setSubHoverIdx : setHoverIdx;
        const cur = openSubIdx != null ? subHoverIdx : hoverIdx;
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const base = cur == null ? (dir > 0 ? -1 : list.length) : cur;
        for (let step = 1; step <= list.length; step++) {
          const next = (base + step * dir + list.length) % list.length;
          if (!list[next].disabled) {
            setter(next);
            break;
          }
        }
        return;
      }
      if (e.key === "ArrowRight" && hoverIdx != null) {
        const it = items[hoverIdx];
        if (it?.submenu) {
          e.preventDefault();
          cancelSubmenuOpen();
          const btn = rowRefs.current[hoverIdx];
          if (btn) setParentRect(btn.getBoundingClientRect());
          setOpenSubIdx(hoverIdx);
          setSubHoverIdx(0);
        }
        return;
      }
      if (e.key === "ArrowLeft" && openSubIdx != null) {
        e.preventDefault();
        setOpenSubIdx(null);
        setSubHoverIdx(null);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, hoverIdx, openSubIdx, subHoverIdx, onClose]);

  if (!open) return null;

  const height = items.length * ROW_H + 10;
  const clampedX = Math.min(x, window.innerWidth - WIDTH - 8);
  const clampedY = Math.min(y, window.innerHeight - height - 8);

  // Submenu placement — to the right of the parent row by default; if
  // it would overflow the viewport, flip to the left edge.
  let submenuLeft = 0, submenuTop = 0, submenuFlipLeft = false;
  if (openSubIdx != null && parentRect) {
    const sub = items[openSubIdx].submenu ?? [];
    const subHeight = sub.length * ROW_H + 10;
    const wantLeft = parentRect.right + 2;
    submenuFlipLeft = wantLeft + WIDTH > window.innerWidth - 8;
    submenuLeft = submenuFlipLeft ? parentRect.left - WIDTH - 2 : wantLeft;
    submenuTop = Math.min(parentRect.top, window.innerHeight - subHeight - 8);
    submenuTop = Math.max(8, submenuTop);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {/* parent panel */}
      <div
        className="absolute bg-bg border border-bd2 rounded-md shadow-xl py-1 animate-fadeIn"
        style={{
          left: Math.max(8, clampedX),
          top: Math.max(8, clampedY),
          width: WIDTH,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.map((it, i) => {
          const selected = i === hoverIdx && !it.disabled;
          const isParent = !!it.submenu;
          const isOpenParent = openSubIdx === i;
          return (
            <button
              key={it.id}
              ref={(el) => { rowRefs.current[i] = el; }}
              disabled={it.disabled}
              onMouseEnter={() => {
                if (it.disabled) return;
                setHoverIdx(i);
                if (isParent) {
                  scheduleSubmenuOpen(i);
                } else {
                  cancelSubmenuOpen();
                  setOpenSubIdx(null);
                  setSubHoverIdx(null);
                }
              }}
              onMouseLeave={() => {
                if (isParent) cancelSubmenuOpen();
              }}
              onClick={() => {
                if (it.disabled) return;
                if (isParent) {
                  // Click on a parent forces the submenu open immediately.
                  cancelSubmenuOpen();
                  const btn = rowRefs.current[i];
                  if (btn) setParentRect(btn.getBoundingClientRect());
                  setOpenSubIdx(i);
                  setSubHoverIdx(null);
                } else {
                  it.onSelect?.();
                }
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors
                ${selected || isOpenParent ? "bg-yelp text-char" : "text-ch2"}
                ${it.disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-s2"}
                [&_svg]:w-3.5 [&_svg]:h-3.5`}
            >
              <span
                className={`w-4 h-4 flex items-center justify-center ${
                  selected || isOpenParent ? "text-char" : "text-t2"
                }`}
              >
                {it.icon}
              </span>
              <span className="flex-1 truncate">{it.label}</span>
              {isParent ? (
                <span className="font-mono text-[12px] text-t3 -mr-1">▸</span>
              ) : it.sublabel ? (
                <span className="font-mono text-[10px] text-t3">
                  {it.sublabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* submenu panel */}
      {openSubIdx != null && parentRect && items[openSubIdx]?.submenu && (
        <div
          className="absolute bg-bg border border-bd2 rounded-md shadow-xl py-1 animate-fadeIn"
          style={{
            left: submenuLeft,
            top: submenuTop,
            width: WIDTH,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseLeave={() => {
            // Closing-on-leave is too aggressive — users brush off the
            // submenu while reaching for an item. Defer the close so the
            // pointer has time to land on a row.
            cancelSubmenuOpen();
          }}
        >
          {(items[openSubIdx].submenu ?? []).map((it, i) => {
            const selected = i === subHoverIdx && !it.disabled;
            return (
              <button
                key={it.id}
                disabled={it.disabled}
                onMouseEnter={() => !it.disabled && setSubHoverIdx(i)}
                onClick={() => {
                  if (!it.disabled) it.onSelect?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors
                  ${selected ? "bg-yelp text-char" : "text-ch2"}
                  ${it.disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-s2"}
                  [&_svg]:w-3.5 [&_svg]:h-3.5`}
              >
                <span
                  className={`w-4 h-4 flex items-center justify-center ${
                    selected ? "text-char" : "text-t2"
                  }`}
                >
                  {it.icon}
                </span>
                <span className="flex-1 truncate">{it.label}</span>
                {it.sublabel && (
                  <span className="font-mono text-[10px] text-t3">
                    {it.sublabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
