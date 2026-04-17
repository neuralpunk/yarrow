import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/tauri";
import { todayIso } from "../../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (dateIso: string) => void;
  activeDate?: string;
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

export default function JournalCalendar({ open, onClose, onPick, activeDate }: Props) {
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

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 flex items-center justify-center"
      onMouseDown={onClose}
    >
      <div
        className="bg-bg border border-bd rounded-xl shadow-2xl p-4 w-[320px]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-3">
          <button
            onClick={() => shift(-1)}
            className="w-7 h-7 rounded hover:bg-s2 text-t2"
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="flex-1 text-center font-serif text-base text-char">
            {monthLabel}
          </div>
          <button
            onClick={() => shift(1)}
            className="w-7 h-7 rounded hover:bg-s2 text-t2"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-2xs text-t3 font-mono mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
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
            Jump to today
          </button>
          <span className="font-mono">{dates.size} entries</span>
        </div>
      </div>
    </div>
  );
}
