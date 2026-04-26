import { useEffect, useState } from "react";
import {
  dismissTimer,
  formatRemaining,
  subscribeTimers,
  type RunningTimer,
} from "../lib/timers";

// 2.2.0 — running-timer overlay. A small stack of pills in the bottom-
// right of the app showing each active timer, the time remaining, and
// a dismiss button. Mounted once at AppShell so the stack survives
// note switches, focus mode toggles, etc.

export default function TimerPills() {
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => subscribeTimers(setTimers), []);

  // Tick once a second while we have timers, so the countdown updates.
  // No timers → no interval, no battery hit.
  useEffect(() => {
    if (timers.length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timers.length]);

  if (timers.length === 0) return null;

  return (
    <div
      className="fixed z-[180] flex flex-col items-end gap-2 pointer-events-none"
      style={{
        right: "max(20px, env(safe-area-inset-right))",
        // 2.2.0 round 2: lifted from 28 → 88 px so the pills sit
        // ABOVE the path ribbon ("Back to main · Throw away · Try
        // another version") on non-main paths. On main paths the
        // ribbon isn't shown and the pills just sit a little higher
        // up — preferable to ever overlapping the ribbon's tap targets.
        bottom: "calc(max(28px, env(safe-area-inset-bottom)) + 60px)",
      }}
    >
      {timers.map((t) => {
        const remaining = Math.max(0, t.endsAt - now);
        const fired = t.fired || remaining === 0;
        return (
          <div
            key={t.id}
            // 2.2.0 round 2: solid background (no `/95` alpha + no
            // backdrop-blur) so the pill reads as a real chip in
            // every theme, not a translucent overlay that competes
            // with the bottom-bar copy underneath. Heavier shadow so
            // it lifts off the canvas regardless of palette.
            className={`pointer-events-auto flex items-center gap-3 pl-3.5 pr-2 py-2 rounded-full border-2 shadow-xl animate-slideUp transition-colors ${
              fired
                ? "bg-yel border-yel text-on-yel"
                : "bg-bg border-yel text-char"
            }`}
            style={{ minWidth: 184 }}
          >
            <span
              aria-hidden="true"
              className={`grid place-items-center w-7 h-7 rounded-full ${
                fired ? "bg-yel text-on-yel" : "bg-s2 text-yeld"
              }`}
            >
              {fired ? <DingIcon /> : <ClockIcon />}
            </span>
            <span className="flex-1 min-w-0 leading-tight">
              <span className="block font-mono text-[14px] tabular-nums">
                {fired ? "done" : formatRemaining(remaining)}
              </span>
              <span className="block text-[11px] text-t2 truncate font-serif italic">
                {t.label}
              </span>
            </span>
            <button
              type="button"
              onClick={() => dismissTimer(t.id)}
              aria-label="Dismiss timer"
              title="Dismiss"
              // 2.2.0 round 2: bigger (28×28), higher-contrast × so
              // it's actually findable. The fired state runs on a
              // gold pill; default state on the bg-bg pill — both
              // tones get a noticeable hover ring.
              className={`w-7 h-7 grid place-items-center rounded-full transition ${
                fired
                  ? "text-on-yel hover:bg-yeld/30"
                  : "text-yeld bg-yelp hover:bg-yel hover:text-on-yel border border-yel/40"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2 1.5" />
    </svg>
  );
}

function DingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12V8a5 5 0 0 1 10 0v4" />
      <path d="M2 12h12" />
      <path d="M6.5 14.5a1.6 1.6 0 0 0 3 0" />
    </svg>
  );
}
