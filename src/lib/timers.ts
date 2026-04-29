// 2.2.0 — Inline timers
//
// A small running-timer registry. Use cases are baking-first ("rest 20
// minutes," "proof 1h30m," "cool 60m") but the surface is generic. The
// canonical syntax in note bodies is a standard markdown link:
//
//   [label](timer:25m)         → 25-minute timer named "label"
//   [proof](timer:1h30m)       → 1h30m timer
//   [cool](timer:90s)          → 90-second timer
//
// Pulldown-cmark renders the link as a normal anchor. NoteReader (and
// other rendered surfaces) install a click delegate that catches
// `a[href^="timer:"]`, parses the duration, calls `startTimer`, and
// prevents default. The TimerPills component subscribed below shows
// running timers as a small stack in the bottom-right of the app.
//
// State lives outside React so multiple components can fire timers and
// the running list survives across surface re-mounts (e.g. swapping
// notes while a timer is counting down).

export interface TimerOrigin {
  /** Slug of the note where the timer was started. */
  slug: string;
  /** Scenario the user was on when the timer was started. */
  path: string;
  /** Human-readable note title at the moment of starting. Used for
   *  tooltips on the pill; the slug is what we navigate by. */
  label?: string;
}

export interface RunningTimer {
  /** Stable id used for keying + dismissal. */
  id: string;
  /** Human-readable label from the link text. */
  label: string;
  /** Total duration in milliseconds. */
  totalMs: number;
  /** Wall-clock end time in `Date.now()` ms. */
  endsAt: number;
  /** True once the timer has fired. Stays in the list briefly so the
   *  user can dismiss the celebration manually. */
  fired: boolean;
  /** Note + scenario the timer was started from. Optional because
   *  callers pre-2.2.x didn't pass one; the pill becomes click-to-jump
   *  when this is present. */
  origin?: TimerOrigin;
}

let timers: RunningTimer[] = [];
const subscribers = new Set<(timers: RunningTimer[]) => void>();

function notify() {
  const snap = [...timers];
  subscribers.forEach((cb) => {
    try { cb(snap); } catch {}
  });
}

/** Parse strings like `25m`, `1h`, `1h30m`, `90s`, `2h15m30s` to ms.
 *  Whitespace and case don't matter. Returns null when nothing parses. */
export function parseDuration(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  const re = /(\d+(?:\.\d+)?)\s*(h|m|s)/g;
  let total = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    matched = true;
    const n = parseFloat(m[1]);
    const unit = m[2];
    if (unit === "h") total += n * 60 * 60;
    else if (unit === "m") total += n * 60;
    else if (unit === "s") total += n;
  }
  if (!matched) return null;
  return Math.round(total * 1000);
}

/** Format remaining ms as `1:23:45` or `5:42` or `0:09`. */
export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function startTimer(
  durationMs: number,
  label: string,
  origin?: TimerOrigin,
): RunningTimer {
  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const t: RunningTimer = {
    id,
    label: label || "timer",
    totalMs: durationMs,
    endsAt: Date.now() + durationMs,
    fired: false,
    origin,
  };
  timers = [...timers, t];
  notify();
  // Schedule the firing. We don't use setInterval — TimerPills polls
  // its own clock to render the countdown, but the firing instant is
  // pinned to wall-clock time. Drift from setTimeout is fine for the
  // few-minutes-to-hour range we care about.
  window.setTimeout(() => {
    const idx = timers.findIndex((x) => x.id === id);
    if (idx === -1) return;
    timers = timers.map((x) => (x.id === id ? { ...x, fired: true } : x));
    notify();
    // Soft chime. Best-effort; errors silently swallowed (e.g. webview
    // without audio context, or user gesture not yet granted).
    void playChime();
  }, durationMs);
  return t;
}

export function dismissTimer(id: string) {
  const before = timers.length;
  timers = timers.filter((t) => t.id !== id);
  if (timers.length !== before) notify();
}

export function listTimers(): RunningTimer[] {
  return [...timers];
}

export function subscribeTimers(cb: (t: RunningTimer[]) => void): () => void {
  subscribers.add(cb);
  // Fire immediately so subscribers don't have to do an extra read.
  try { cb([...timers]); } catch {}
  return () => { subscribers.delete(cb); };
}

// ──────────────── chime ────────────────

let cachedCtx: AudioContext | null = null;

async function playChime() {
  try {
    if (!cachedCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      cachedCtx = new Ctor();
    }
    const ctx = cachedCtx;
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }
    // A two-note "ding-dong" — gentle, attention without alarm.
    const now = ctx.currentTime;
    const noteOne = makeNote(ctx, 880, now, 0.55);            // A5
    const noteTwo = makeNote(ctx, 660, now + 0.34, 0.6);      // E5
    noteOne();
    noteTwo();
  } catch {
    /* audio unavailable */
  }
}

function makeNote(ctx: AudioContext, freq: number, start: number, dur: number): () => void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // Soft attack + release so the sine wave doesn't click.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  return () => {
    osc.start(start);
    osc.stop(start + dur + 0.05);
  };
}

// ──────────────── href helpers ────────────────

/** True if `href` is one of our timer directives. */
export function isTimerHref(href: string | null | undefined): boolean {
  return !!href && href.startsWith("timer:");
}

/** Parse a `timer:25m` href into milliseconds. */
export function parseTimerHref(href: string): number | null {
  const stripped = href.replace(/^timer:/, "");
  return parseDuration(stripped);
}
