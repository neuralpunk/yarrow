import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { RadialMenuItem } from "./RadialMenu";

// ────────────── Linear context menu ──────────────
// The fallback when the "Radial right-click menu" Writing Extra is off.
// Same props and items array as `RadialMenu` so swapping is a one-line
// change in `AppShell`. Vertical drop-down with icon + label + mono
// sublabel, keyboard navigation (↑/↓/Enter/Esc), portal to body to
// escape the editor's overflow-hidden ancestors.

interface Props {
  open: boolean;
  x: number;
  y: number;
  items: RadialMenuItem[];
  onClose: () => void;
}

const WIDTH = 240;
const ROW_H = 30;

export default function LinearContextMenu({
  open, x, y, items, onClose,
}: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) setHoverIdx(null);
  }, [open, x, y]);

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
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHoverIdx((i) => {
          const base = i == null ? -1 : i;
          // Skip disabled rows so Down never lands on one.
          for (let step = 1; step <= items.length; step++) {
            const next = (base + step + items.length) % items.length;
            if (!items[next].disabled) return next;
          }
          return i;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHoverIdx((i) => {
          const base = i == null ? items.length : i;
          for (let step = 1; step <= items.length; step++) {
            const prev = (base - step + items.length) % items.length;
            if (!items[prev].disabled) return prev;
          }
          return i;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, hoverIdx, onClose]);

  if (!open) return null;

  const height = items.length * ROW_H + 10;
  const clampedX = Math.min(x, window.innerWidth - WIDTH - 8);
  const clampedY = Math.min(y, window.innerHeight - height - 8);

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
          return (
            <button
              key={it.id}
              disabled={it.disabled}
              onMouseEnter={() => !it.disabled && setHoverIdx(i)}
              onClick={() => {
                if (!it.disabled) it.onSelect();
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
    </div>,
    document.body,
  );
}
