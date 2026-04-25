/**
 * "Where you left off" — when the user reopens a workspace, we show a
 * one-line banner with the last note, path, and the sentence they paused on.
 *
 * Stored per-workspace in localStorage under `yarrow.leftOff.<path>`, not a
 * single key, so opening a different workspace doesn't clobber the other's
 * bookmark. Auto-expires after 72 h: the banner stops being a welcome-back
 * and starts being dead weight.
 *
 * Cursor restore (2.1): the snippet now travels with the cursor line the
 * user was on (best-effort) so reopening the note can scroll back to that
 * spot. The line number can drift if the body changed between sessions, so
 * NoteEditor first searches for the snippet text and only falls back to
 * the line number when the text can't be found — content-anchored beats
 * coordinate-anchored when the document moves underneath us.
 */

const MAX_AGE_MS = 72 * 60 * 60 * 1000;
const HIDE_KEY_PREFIX = "yarrow.leftOff.hide";
const DATA_KEY_PREFIX = "yarrow.leftOff";

export interface LeftOffState {
  slug: string;
  /** Note title snapshot at save-time — survives a later rename. */
  title: string;
  /** Path name the user was on (empty string for root / main). */
  path: string;
  /** Short excerpt around the cursor line the user paused on. */
  snippet: string;
  /** 1-based line the cursor was on at save time. Used as a hint for
   *  scroll restoration; only honored when the snippet text can also be
   *  found on or near it (so reopens stay anchored to content, not to
   *  raw line numbers that may have shifted). */
  cursorLine?: number;
  /** Unix ms the state was last persisted. */
  at: number;
}

function dataKey(workspacePath: string): string {
  return `${DATA_KEY_PREFIX}.${workspacePath}`;
}

function hideKey(workspacePath: string): string {
  return `${HIDE_KEY_PREFIX}.${workspacePath}`;
}

export function saveLeftOff(workspacePath: string, state: LeftOffState): void {
  try {
    localStorage.setItem(dataKey(workspacePath), JSON.stringify(state));
  } catch {}
}

export function readLeftOff(workspacePath: string): LeftOffState | null {
  try {
    const raw = localStorage.getItem(dataKey(workspacePath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeftOffState;
    if (!parsed || typeof parsed.slug !== "string") return null;
    if (Date.now() - (parsed.at || 0) > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function forgetLeftOff(workspacePath: string): void {
  try { localStorage.removeItem(dataKey(workspacePath)); } catch {}
}

export function setHideLeftOff(workspacePath: string, hide: boolean): void {
  try {
    if (hide) localStorage.setItem(hideKey(workspacePath), "1");
    else localStorage.removeItem(hideKey(workspacePath));
  } catch {}
}

export function isHiddenLeftOff(workspacePath: string): boolean {
  try { return localStorage.getItem(hideKey(workspacePath)) === "1"; } catch { return false; }
}

/** Short human-friendly "just now" / "2 hours ago" / "yesterday" descriptor
 *  for the banner heading. */
export function relativeBanner(unixMs: number): string {
  const now = Date.now();
  const diffMs = now - unixMs;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return "a moment ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 2) return "yesterday";
  return `${days} days ago`;
}

/** Pick a short excerpt suitable for the third banner line: a sentence
 *  around the last line the user was on. Falls back to the first non-empty
 *  line of the body. */
export function snippetFromBody(body: string, cursorLine?: number): string {
  if (!body) return "";
  const lines = body.split(/\r?\n/);
  const pickIdx = cursorLine != null && cursorLine > 0 && cursorLine <= lines.length
    ? cursorLine - 1
    : lines.findIndex((l) => l.trim().length > 0);
  if (pickIdx < 0) return "";
  const line = (lines[pickIdx] || "").trim();
  if (!line) {
    const fallback = lines.find((l) => l.trim().length > 0) ?? "";
    return truncate(fallback.trim());
  }
  return truncate(line);
}

function truncate(s: string, max = 160): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
