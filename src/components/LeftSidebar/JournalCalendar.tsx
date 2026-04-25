import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/tauri";
import { todayIso } from "../../lib/format";
import { useT } from "../../lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (dateIso: string) => void;
  activeDate?: string;
  /** Optional: when supplied, the calendar renders as a popover anchored
   *  just below this rect (captured via `getBoundingClientRect()` at the
   *  moment the trigger was clicked). Without an anchor it falls back to
   *  a centred modal — which is what the left-sidebar trigger wants. */
  anchor?: DOMRect | null;
}

function isoOf(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function JournalCalendar({ open, onClose, onPick, activeDate, anchor }: Props) {
  const t = useT();
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const d = activeDate ? parseIso(activeDate) : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const today = todayIso();

  useEffect(() => {
    if (!open) return;
    api.listDailyDates().then((ds) => setDates(new Set(ds))).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ iso: isoOf(cursor.y, cursor.m, d), day: d });
    }
    return cells;
  }, [cursor]);

  if (!open) return null;

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const shift = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  // Popover geometry: align the card's left edge with the anchor's left,
  // drop it 6px below the anchor's bottom, and clamp inside the viewport
  // so it never spills off the right edge or below the fold.
  const CARD_W = 320;
  const CARD_H_ESTIMATE = 380;
  const GAP = 6;
  const PAD = 8;
  let popoverStyle: React.CSSProperties | null = null;
  if (anchor) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.left;
    if (left + CARD_W > vw - PAD) left = vw - CARD_W - PAD;
    if (left < PAD) left = PAD;
    let top = anchor.bottom + GAP;
    // If there isn't room below, flip above the trigger.
    if (top + CARD_H_ESTIMATE > vh - PAD) {
      top = Math.max(PAD, anchor.top - CARD_H_ESTIMATE - GAP);
    }
    popoverStyle = { position: "fixed", left, top, width: CARD_W };
  }

  return (
    <div
      className={
        anchor
          ? "fixed inset-0 z-50"
          : "fixed inset-0 z-50 bg-char/30 flex items-center justify-center"
      }
      onMouseDown={onClose}
    >
      <div
        className={
          anchor
            ? "bg-bg border border-bd rounded-xl shadow-2xl p-4"
            : "bg-bg border border-bd rounded-xl shadow-2xl p-4 w-[320px]"
        }
        style={popoverStyle ?? undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-3">
          <button
            onClick={() => shift(-1)}
            className="w-7 h-7 rounded hover:bg-s2 text-t2"
            aria-label={t("sidebar.calendar.prevMonth")}
          >
            ‹
          </button>
          <div className="flex-1 text-center font-serif text-base text-char">
            {monthLabel}
          </div>
          <button
            onClick={() => shift(1)}
            className="w-7 h-7 rounded hover:bg-s2 text-t2"
            aria-label={t("sidebar.calendar.nextMonth")}
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-2xs text-t3 font-mono mb-1">
          {[
            t("sidebar.calendar.dayS"),
            t("sidebar.calendar.dayM"),
            t("sidebar.calendar.dayT"),
            t("sidebar.calendar.dayW"),
            t("sidebar.calendar.dayT"),
            t("sidebar.calendar.dayF"),
            t("sidebar.calendar.dayS"),
          ].map((d, i) => (
            <div key={i} className="py-0.5">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const has = dates.has(cell.iso);
            const isToday = cell.iso === today;
            const isActive = cell.iso === activeDate;
            return (
              <button
                key={cell.iso}
                onClick={() => { onPick(cell.iso); onClose(); }}
                className={`relative aspect-square text-xs rounded transition flex items-center justify-center ${
                  isActive
                    ? "bg-yel text-on-yel font-medium"
                    : isToday
                      ? "bg-yelp text-yeld"
                      : has
                        ? "text-char hover:bg-s2"
                        : "text-t3 hover:bg-s2"
                }`}
                title={cell.iso}
              >
                <span>{cell.day}</span>
                {has && !isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-yel" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-bd flex items-center justify-between text-2xs text-t3">
          <button
            onClick={() => { onPick(today); onClose(); }}
            className="hover:text-char"
          >
            {t("sidebar.calendar.jumpToday")}
          </button>
          <span className="font-mono">{t("sidebar.calendar.entries", { count: String(dates.size) })}</span>
        </div>
      </div>
    </div>
  );
}
