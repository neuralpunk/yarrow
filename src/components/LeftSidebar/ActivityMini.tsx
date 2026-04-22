import { memo, useEffect, useState } from "react";
import { api } from "../../lib/tauri";
import type { ActivityDay } from "../../lib/types";

interface Props {
  /** Click → open the full Activity modal. */
  onOpen: () => void;
}

// Two weeks reads at a glance in the sidebar and gives enough texture
// to see a streak forming; shorter than that looks like noise.
const DAYS = 14;
const CELL_HEIGHT = 20;

// Same five-step scale as the full heatmap modal, but inlined so we
// don't cross-import across peers (ActivityHeatmap is lazy-loaded).
const INTENSITY_BG = [
  "var(--s2)",
  "color-mix(in srgb, var(--yeld) 25%, var(--s1))",
  "color-mix(in srgb, var(--yeld) 50%, var(--s1))",
  "color-mix(in srgb, var(--yeld) 75%, var(--s1))",
  "var(--yeld)",
];

function intensity(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  const frac = count / max;
  if (frac >= 0.8) return 4;
  if (frac >= 0.55) return 3;
  if (frac >= 0.3) return 2;
  return 1;
}

/** Pad the raw server histogram with zeros for any missing date in the
 *  window, so the strip always shows exactly `DAYS` cells oldest → newest. */
function padDays(raw: ActivityDay[]): ActivityDay[] {
  const byDate = new Map(raw.map((d) => [d.date, d.count]));
  const out: ActivityDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    out.push({ date: iso, count: byDate.get(iso) ?? 0 });
  }
  return out;
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Compact two-week activity strip for the left sidebar. Replaces the
 * old path-minimap block: most of the time the user cares more about
 * "did I write today?" than "what paths exist?", and paths are always
 * one rail-button away anyway.
 *
 * Clicking the strip opens the full ActivityHeatmap modal so the user
 * can drill into longer windows + streak stats.
 */
function ActivityMiniInner({ onOpen }: Props) {
  const [data, setData] = useState<ActivityDay[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .writingActivity(DAYS)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setData([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const padded = data ? padDays(data) : null;
  const max = padded ? padded.reduce((m, d) => Math.max(m, d.count), 0) : 0;
  const total = padded ? padded.reduce((s, d) => s + d.count, 0) : 0;
  // Current streak: scan backward from today while counts stay > 0.
  const streak = (() => {
    if (!padded) return 0;
    let n = 0;
    for (let i = padded.length - 1; i >= 0; i--) {
      if (padded[i].count > 0) n++;
      else break;
    }
    return n;
  })();

  return (
    <div className="mt-5 pt-5 pb-2 border-t border-bd/20">
      <div className="flex items-baseline justify-between px-4 mb-2">
        <div className="text-2xs uppercase tracking-wider text-t3 font-semibold">
          Activity
        </div>
        <div className="text-[10px] text-t3 font-mono">{DAYS} days</div>
      </div>
      <button
        onClick={onOpen}
        title="Open the full activity heatmap"
        className="w-full px-4 py-2 text-left hover:bg-s2/60 transition group"
      >
        {padded ? (
          <div className="flex gap-[2px]">
            {padded.map((d) => (
              <div
                key={d.date}
                title={`${d.count} checkpoint${d.count === 1 ? "" : "s"} · ${shortDate(d.date)}`}
                style={{
                  flex: "1 1 0",
                  height: CELL_HEIGHT,
                  backgroundColor: INTENSITY_BG[intensity(d.count, max)],
                }}
                className="rounded-[2px] min-w-[8px]"
              />
            ))}
          </div>
        ) : (
          <div
            className="w-full rounded-[2px] bg-s2 animate-pulse"
            style={{ height: CELL_HEIGHT }}
          />
        )}
        <div className="mt-2 flex items-baseline justify-between text-[10px] text-t3 font-mono">
          {padded ? (
            <>
              <span>
                <span className="text-char font-medium">{total}</span>{" "}
                checkpoint{total === 1 ? "" : "s"}
              </span>
              {streak > 0 && (
                <span className="text-yeld">
                  {streak}-day streak
                </span>
              )}
            </>
          ) : (
            <span className="italic text-t3">reading history…</span>
          )}
        </div>
      </button>
    </div>
  );
}

export default memo(ActivityMiniInner);
