import { useState } from "react";
import type { NoteSummary } from "../../lib/types";
import { dailyLabel, todayIso } from "../../lib/format";
import { JournalIcon } from "../../lib/icons";
import { SK } from "../../lib/platform";
import JournalCalendar from "./JournalCalendar";

interface Props {
  entries: NoteSummary[];
  activeSlug: string | null;
  onOpenDaily: (dateIso: string) => void;
}

/**
 * Journal section in the left sidebar — a "Today" pill plus the most recent
 * entries. Daily notes always live on `main`, so opening one may auto-switch
 * the current path (AppShell surfaces that to the user).
 */
export default function JournalList({ entries, activeSlug, onOpenDaily }: Props) {
  const today = todayIso();
  const todaySlug = `daily/${today}`;
  const todayActive = activeSlug === todaySlug;
  const [calOpen, setCalOpen] = useState(false);
  const activeDate =
    activeSlug && activeSlug.startsWith("daily/")
      ? activeSlug.slice("daily/".length)
      : undefined;

  // Show last 5 entries, excluding today (it's always rendered as the pill).
  const recent = entries.filter((e) => e.slug !== todaySlug).slice(0, 5);

  return (
    <div className="mt-5 pt-5 border-t border-bd/20">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wider text-t3 font-semibold">
          <JournalIcon size={12} />
          <span>Journal</span>
        </div>
        <button
          onClick={() => setCalOpen(true)}
          className="text-2xs text-t3 hover:text-char transition"
          title="Browse the calendar"
        >
          calendar
        </button>
      </div>
      <JournalCalendar
        open={calOpen}
        onClose={() => setCalOpen(false)}
        onPick={onOpenDaily}
        activeDate={activeDate}
      />

      <div className="px-2">
        <button
          onClick={() => onOpenDaily(today)}
          className={`y-tip w-full text-left px-3 py-2 rounded transition flex items-center gap-2 text-xs ${
            todayActive
              ? "bg-yelp text-yeld"
              : "text-t2 hover:bg-s2 hover:text-char"
          }`}
          data-tip={`Jump to today's journal (${SK.jumpToday})`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              todayActive ? "bg-yel" : "bg-bd2"
            }`}
          />
          <span className="font-medium">Today</span>
          <span className="ml-auto text-2xs text-t3 font-mono">{today}</span>
        </button>
      </div>

      {recent.length > 0 && (
        <ul className="px-2 mt-1 space-y-0.5">
          {recent.map((e) => {
            const iso = e.slug.replace(/^daily\//, "");
            const active = e.slug === activeSlug;
            return (
              <li key={e.slug}>
                <button
                  onClick={() => onOpenDaily(iso)}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs transition flex items-center gap-2 ${
                    active
                      ? "bg-s3 text-char"
                      : "text-t2 hover:bg-s2 hover:text-char"
                  }`}
                >
                  <span>{dailyLabel(e.slug)}</span>
                  {e.excerpt && (
                    <span className="ml-auto truncate text-2xs text-t3 max-w-[120px]">
                      {e.excerpt}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
