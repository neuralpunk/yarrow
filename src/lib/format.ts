export function relativeTime(iso: string | number | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 12) return "moments ago";
  if (diff < 45) return `${Math.floor(diff)}s ago`;
  if (diff < 90) return "a minute ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 7200) return "an hour ago";
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 86400 * 2) return "yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Local-calendar ISO date (YYYY-MM-DD) — used for daily-note slugs. */
export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human-readable label for a daily-note slug ("daily/2026-04-17" → "April 17"). */
export function dailyLabel(slug: string): string {
  const iso = slug.replace(/^daily\//, "");
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const today = todayIso();
  const yday = todayIso(new Date(Date.now() - 86400000));
  if (iso === today) return "Today";
  if (iso === yday) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

/** Lower-kebab slug derived from a title — mirrors the backend's `slug::slugify`. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function timeOfDayPhrase(iso: string | number | null | undefined): string {
  if (!iso) return "day";
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "day";
  const h = d.getHours();
  if (h < 5)  return "small hours";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

/** Editorial date: "April 17" — no time, used in note metadata line. */
export function editorialDate(iso: string | number | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

export function friendlyDate(iso: string | number | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
