import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/tauri";
import type { ActivityDay } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Height in px of a single day cell. The grid is 7 rows (weekdays) by N
// columns (weeks), so 12 × 12 keeps the whole year on-screen without
// scrolling at typical window widths.
const CELL = 12;
const GAP = 2;

const WINDOWS: Array<{ label: string; days: number }> = [
  { label: "90 days", days: 90 },
  { label: "6 months", days: 183 },
  { label: "1 year", days: 365 },
];

function fmtDateLong(iso: string): string {
  // Guard against malformed input rather than crashing the modal.
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Given `days` of lookback and the raw server histogram, pad to every
 *  day in the window (so gaps show as empty cells, not missing columns). */
function expand(days: number, raw: ActivityDay[]): ActivityDay[] {
  const byDate = new Map(raw.map((d) => [d.date, d.count]));
  const out: ActivityDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Align the end of the window to Saturday so each column is a full week
  // and the last column is today's partial week. Subtract `days - 1` so
  // the total count matches the selected range.
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    out.push({ date: iso, count: byDate.get(iso) ?? 0 });
  }
  return out;
}

/** Bucket a count into one of five intensity steps matching the heatmap
 *  legend. Max is the peak single-day count in the visible window — so
 *  the scale auto-adjusts for quiet vs. busy vaults. */
function intensity(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  const frac = count / max;
  if (frac >= 0.8) return 4;
  if (frac >= 0.55) return 3;
  if (frac >= 0.3) return 2;
  return 1;
}

const INTENSITY_BG = [
  "var(--s2)",
  "color-mix(in srgb, var(--yeld) 25%, var(--s1))",
  "color-mix(in srgb, var(--yeld) 50%, var(--s1))",
  "color-mix(in srgb, var(--yeld) 75%, var(--s1))",
  "var(--yeld)",
];

export default function ActivityHeatmap({ open, onClose }: Props) {
  const [days, setDays] = useState(365);
  const [data, setData] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<ActivityDay | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .writingActivity(days)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, days]);

  const expanded = useMemo(() => expand(days, data), [days, data]);

  const stats = useMemo(() => {
    const total = expanded.reduce((acc, d) => acc + d.count, 0);
    const activeDays = expanded.filter((d) => d.count > 0).length;
    const max = expanded.reduce((m, d) => Math.max(m, d.count), 0);
    // Current streak: count backward from today until we hit a gap.
    let streak = 0;
    for (let i = expanded.length - 1; i >= 0; i--) {
      if (expanded[i].count > 0) streak++;
      else break;
    }
    // Best streak: longest run of consecutive non-zero days in the window.
    let best = 0;
    let run = 0;
    for (const d of expanded) {
      if (d.count > 0) {
        run++;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    return { total, activeDays, max, streak, best };
  }, [expanded]);

  /** Build the 7-row × N-col grid. Column 0 = oldest week, rightmost =
   *  current week. The first column is left-padded with empty cells so
   *  rows align to weekdays (Sun … Sat). */
  const grid = useMemo(() => {
    if (expanded.length === 0) return { weeks: [] as (ActivityDay | null)[][], months: [] as { col: number; label: string }[] };
    const firstDay = new Date(expanded[0].date + "T00:00:00");
    const firstWeekday = firstDay.getDay(); // 0 = Sunday
    const cells: (ActivityDay | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    cells.push(...expanded);
    const weeks: (ActivityDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    // Month labels: emit the month name above the first week whose Sunday
    // falls inside that month. Skip weeks that share a month with the
    // previous label so the header doesn't repeat.
    const months: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const first = week.find((c) => c !== null) ?? null;
      if (!first) return;
      const d = new Date(first.date + "T00:00:00");
      if (d.getMonth() !== lastMonth) {
        months.push({
          col,
          label: d.toLocaleDateString(undefined, { month: "short" }),
        });
        lastMonth = d.getMonth();
      }
    });
    return { weeks, months };
  }, [expanded]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-bd2 rounded-xl shadow-2xl w-full max-w-[880px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between px-6 pt-5 pb-3 border-b border-bd">
          <div>
            <h2 className="font-serif text-2xl text-char">Activity</h2>
            <p className="font-serif italic text-xs text-t3 mt-0.5">
              checkpoints per day, across every path
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                onClick={() => setDays(w.days)}
                className={`px-2.5 py-1 rounded-md transition ${
                  days === w.days
                    ? "bg-char text-bg"
                    : "text-t2 hover:bg-s2 hover:text-char"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 overflow-auto">
          {error ? (
            <div className="text-xs text-danger font-mono">{error}</div>
          ) : loading && expanded.every((d) => d.count === 0) ? (
            <div className="text-xs text-t3 font-serif italic py-8 text-center">
              Reading your history…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-4 mb-5">
                <StatBlock label="Checkpoints" value={stats.total} />
                <StatBlock label="Active days" value={stats.activeDays} />
                <StatBlock
                  label="Current streak"
                  value={stats.streak}
                  unit={stats.streak === 1 ? "day" : "days"}
                />
                <StatBlock
                  label="Longest streak"
                  value={stats.best}
                  unit={stats.best === 1 ? "day" : "days"}
                />
              </div>

              <div className="relative">
                {/* month labels */}
                <div
                  className="flex text-2xs text-t3 font-mono mb-1 pl-7"
                  style={{ gap: `${GAP}px` }}
                >
                  {grid.weeks.map((_, col) => {
                    const m = grid.months.find((mm) => mm.col === col);
                    return (
                      <div
                        key={col}
                        style={{ width: `${CELL}px`, flexShrink: 0 }}
                        className="text-left"
                      >
                        {m ? m.label : ""}
                      </div>
                    );
                  })}
                </div>

                <div className="flex" style={{ gap: `${GAP}px` }}>
                  {/* weekday labels on the left */}
                  <div
                    className="flex flex-col text-2xs text-t3 font-mono mr-1"
                    style={{ gap: `${GAP}px` }}
                  >
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d, i) => (
                        <div
                          key={d}
                          style={{ height: `${CELL}px`, lineHeight: `${CELL}px` }}
                        >
                          {i % 2 === 1 ? d : ""}
                        </div>
                      ),
                    )}
                  </div>
                  {grid.weeks.map((week, col) => (
                    <div
                      key={col}
                      className="flex flex-col"
                      style={{ gap: `${GAP}px` }}
                    >
                      {Array.from({ length: 7 }).map((_, row) => {
                        const cell = week[row] ?? null;
                        if (!cell) {
                          return (
                            <div
                              key={row}
                              style={{ width: `${CELL}px`, height: `${CELL}px` }}
                            />
                          );
                        }
                        const step = intensity(cell.count, stats.max);
                        return (
                          <div
                            key={row}
                            onMouseEnter={() => setHovered(cell)}
                            onMouseLeave={() => setHovered((h) => (h === cell ? null : h))}
                            style={{
                              width: `${CELL}px`,
                              height: `${CELL}px`,
                              backgroundColor: INTENSITY_BG[step],
                            }}
                            className="rounded-[2px] transition hover:outline hover:outline-1 hover:outline-yeld"
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-2xs text-t3 font-serif italic min-h-[18px]">
                    {hovered
                      ? `${hovered.count} ${
                          hovered.count === 1 ? "checkpoint" : "checkpoints"
                        } on ${fmtDateLong(hovered.date)}`
                      : "Hover a square for the date."}
                  </div>
                  <div className="flex items-center gap-1.5 text-2xs text-t3 font-mono">
                    <span>less</span>
                    {INTENSITY_BG.map((bg, i) => (
                      <div
                        key={i}
                        style={{
                          width: `${CELL}px`,
                          height: `${CELL}px`,
                          backgroundColor: bg,
                        }}
                        className="rounded-[2px]"
                      />
                    ))}
                    <span>more</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-bd flex items-center justify-between">
          <span className="font-serif italic text-2xs text-t3">
            Esc to close
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md text-t2 hover:bg-s2 hover:text-char transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="bg-s1 rounded-md px-3 py-2 border border-bd">
      <div className="font-serif italic text-2xs text-t3">{label}</div>
      <div className="font-serif text-2xl text-char leading-none mt-1">
        {value}
        {unit && (
          <span className="font-sans text-xs text-t2 not-italic ml-1.5">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
