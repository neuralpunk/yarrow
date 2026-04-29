// Writer plugin — daily writing streak (Svelte 5 port).
//
// State lives entirely in localStorage under `yarrow.writer.streak`.
// A single CustomEvent (`yarrow:writer-streak-changed`) broadcasts
// updates so any subscriber resyncs without prop-drilling — same
// pattern as the Mode/Theme/EditorPrefs stores elsewhere.
//
// Word counting is delta-based against the previously saved version
// of the active note. Deletions don't decrement the day's tally
// (otherwise revising a long passage downward could subtract a
// streak the user already earned). Crossing the goal line increments
// the streak once per day; further writing on the same day stacks
// `todayWords` but doesn't double-count.
//
// Day rollover is checked on read: if the stored `todayDate` is
// older than the local "today," we roll over before returning. The
// streak preserves if `lastHitDate >= yesterday`; otherwise it
// resets to zero on the new day.

const KEY = "yarrow.writer.streak";
const EVT = "yarrow:writer-streak-changed";

const DEFAULT_GOAL = 250;

export interface WritingStreak {
  /** User-configurable daily target. Words. */
  goal: number;
  /** Words written today (since last rollover). */
  todayWords: number;
  /** ISO yyyy-mm-dd. The local-time day this `todayWords` belongs to. */
  todayDate: string;
  /** Consecutive-day streak length. Increments once per day on first
   *  goal cross; resets when a day is missed. */
  streakLength: number;
  /** ISO yyyy-mm-dd of the most recent goal-hit. Drives "did we
   *  break the streak?" on rollover. Null until first hit. */
  lastHitDate: string | null;
  /** Best-ever streak length. Bragging surface. */
  longestStreak: number;
}

function todayIso(): string {
  // Local-time yyyy-mm-dd. Don't use toISOString — that's UTC and
  // would roll over at the wrong moment for users west of UTC who
  // write in the evening.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayIso(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function emptyStreak(): WritingStreak {
  return {
    goal: DEFAULT_GOAL,
    todayWords: 0,
    todayDate: todayIso(),
    streakLength: 0,
    lastHitDate: null,
    longestStreak: 0,
  };
}

function readRaw(): WritingStreak {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStreak();
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || !parsed) return emptyStreak();
    return {
      goal:
        typeof parsed.goal === "number" && parsed.goal > 0
          ? Math.floor(parsed.goal)
          : DEFAULT_GOAL,
      todayWords:
        typeof parsed.todayWords === "number" && parsed.todayWords >= 0
          ? Math.floor(parsed.todayWords)
          : 0,
      todayDate:
        typeof parsed.todayDate === "string" ? parsed.todayDate : todayIso(),
      streakLength:
        typeof parsed.streakLength === "number" && parsed.streakLength >= 0
          ? Math.floor(parsed.streakLength)
          : 0,
      lastHitDate:
        typeof parsed.lastHitDate === "string" ? parsed.lastHitDate : null,
      longestStreak:
        typeof parsed.longestStreak === "number" && parsed.longestStreak >= 0
          ? Math.floor(parsed.longestStreak)
          : 0,
    };
  } catch {
    return emptyStreak();
  }
}

function writeRaw(s: WritingStreak) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent<WritingStreak>(EVT, { detail: s }));
}

/** Roll the streak forward to today if needed. Pure — does not write
 *  to storage. The caller decides whether to persist the result. */
function rollover(s: WritingStreak): WritingStreak {
  const today = todayIso();
  if (s.todayDate === today) return s;
  const yest = yesterdayIso(today);
  const preserve = s.lastHitDate != null && s.lastHitDate >= yest;
  return {
    ...s,
    todayWords: 0,
    todayDate: today,
    streakLength: preserve ? s.streakLength : 0,
  };
}

/** Read current streak with rollover applied. */
export function readStreak(): WritingStreak {
  const raw = readRaw();
  const s = rollover(raw);
  if (
    s.todayDate !== raw.todayDate ||
    s.todayWords !== raw.todayWords ||
    s.streakLength !== raw.streakLength
  ) {
    writeRaw(s);
  }
  return s;
}

/** Add `delta` words to today's tally and detect a fresh goal cross.
 *  Negative deltas are clamped to zero so deletions don't subtract
 *  earned progress. Returns the updated streak. */
export function recordWords(delta: number): WritingStreak {
  if (!Number.isFinite(delta)) return readStreak();
  const add = Math.max(0, Math.floor(delta));
  const cur = rollover(readRaw());
  const nextWords = cur.todayWords + add;
  const wasUnder = cur.todayWords < cur.goal;
  const nowOver = nextWords >= cur.goal;
  let { streakLength, lastHitDate, longestStreak } = cur;
  if (wasUnder && nowOver && lastHitDate !== cur.todayDate) {
    streakLength = streakLength + 1;
    lastHitDate = cur.todayDate;
    if (streakLength > longestStreak) longestStreak = streakLength;
  }
  const next: WritingStreak = {
    ...cur,
    todayWords: nextWords,
    streakLength,
    lastHitDate,
    longestStreak,
  };
  writeRaw(next);
  return next;
}

/** Update the daily goal. Floors and clamps to a sensible range so
 *  a stray paste of "0" or "-1" doesn't brick the widget. */
export function setStreakGoal(goal: number): WritingStreak {
  const cleaned = Math.max(50, Math.min(10000, Math.floor(goal)));
  const cur = rollover(readRaw());
  const next: WritingStreak = { ...cur, goal: cleaned };
  writeRaw(next);
  return next;
}

/** Reset the entire streak surface. Used by Settings → Mode debug
 *  hooks today; could be exposed as a user-facing "reset" later. */
export function resetStreak(): WritingStreak {
  const fresh = emptyStreak();
  writeRaw(fresh);
  return fresh;
}

class WritingStreakStore {
  state = $state<WritingStreak>(readStreak());

  constructor() {
    $effect.root(() => {
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<WritingStreak>).detail;
        if (next && typeof next.goal === "number") this.state = next;
        else this.state = readStreak();
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) this.state = readStreak();
      };
      window.addEventListener(EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      // One round-trip read on mount in case the document was loaded
      // across a midnight boundary and the cached state needs to roll.
      this.state = readStreak();
      return () => {
        window.removeEventListener(EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  get goal() { return this.state.goal; }
  get todayWords() { return this.state.todayWords; }
  get todayDate() { return this.state.todayDate; }
  get streakLength() { return this.state.streakLength; }
  get lastHitDate() { return this.state.lastHitDate; }
  get longestStreak() { return this.state.longestStreak; }
}

export const writingStreak = new WritingStreakStore();
