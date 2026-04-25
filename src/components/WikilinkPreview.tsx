// Shared hover-popover for `[[wikilinks]]`. Used by both the writing-mode
// editor and the reading-mode renderer so the two surfaces feel identical.

import { useT } from "../lib/i18n";

const PREVIEW_CACHE_MAX = 40;
const previewCache = new Map<string, { title: string; body: string }>();

export function getCachedPreview(slug: string) {
  const hit = previewCache.get(slug);
  if (hit) {
    // Refresh recency on hit so the LRU eviction doesn't drop hot entries.
    previewCache.delete(slug);
    previewCache.set(slug, hit);
  }
  return hit;
}

export function cachePreview(slug: string, value: { title: string; body: string }) {
  if (previewCache.has(slug)) previewCache.delete(slug);
  previewCache.set(slug, value);
  while (previewCache.size > PREVIEW_CACHE_MAX) {
    const oldest = previewCache.keys().next().value;
    if (oldest === undefined) break;
    previewCache.delete(oldest);
  }
}

/** Trim to ~480 chars, stripping wrapping whitespace/headings for the preview. */
export function excerptForPreview(body: string): string {
  const cleaned = body
    .split("\n")
    .filter((l) => !l.trim().startsWith("---"))
    .join("\n")
    .trimStart();
  if (cleaned.length <= 480) return cleaned;
  return cleaned.slice(0, 480).replace(/\s+\S*$/, "") + "…";
}

export interface WikilinkPreviewData {
  x: number;
  y: number;
  placeAbove: boolean;
  title: string;
  body: string;
  slug?: string;
  missing?: boolean;
}

export interface WikilinkPreviewProps {
  data: WikilinkPreviewData;
  currentPath: string;
  pathNotes?: Record<string, string[]>;
  onBranchHere?: (slug: string) => void;
  onEnter?: () => void;
  onLeave?: () => void;
}

export default function WikilinkPreview({
  data, currentPath, pathNotes, onBranchHere, onEnter, onLeave,
}: WikilinkPreviewProps) {
  const t = useT();
  const style: React.CSSProperties = data.placeAbove
    ? { left: data.x, top: data.y, transform: "translateY(-100%)" }
    : { left: data.x, top: data.y };

  if (data.missing) {
    return (
      <div
        style={style}
        className="fixed z-40 pointer-events-none w-[300px] bg-bg border border-bd2 rounded-lg shadow-2xl p-3 animate-fadeIn"
      >
        <div className="text-2xs uppercase tracking-wider text-t3 font-semibold mb-1">
          {t("modals.wikilinkPreview.noNoteYet")}
        </div>
        <div className="font-serif text-base text-char truncate">{data.title}</div>
        <div className="text-2xs text-t2 mt-1.5 leading-relaxed">
          {t("modals.wikilinkPreview.noNoteHint")}
        </div>
      </div>
    );
  }

  const excerpt = excerptForPreview(data.body);

  // Path membership strip — which paths include this note vs. which don't.
  const membership = (() => {
    if (!data.slug || !pathNotes) return null;
    const slug = data.slug;
    const allBranches = Object.keys(pathNotes);
    const here: string[] = [];
    const absent: string[] = [];
    for (const b of allBranches) {
      if ((pathNotes[b] || []).includes(slug)) here.push(b);
      else absent.push(b);
    }
    if (allBranches.length === 0) return null;
    return { here, absent, total: allBranches.length };
  })();

  return (
    <div
      style={style}
      className="fixed z-40 w-[380px] max-h-[340px] overflow-hidden bg-bg border border-bd2 rounded-lg shadow-2xl animate-fadeIn flex flex-col"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="px-3.5 pt-3 pb-2 border-b border-bd flex items-center gap-2">
        <div className="font-serif text-base text-char leading-tight truncate flex-1">
          {data.title}
        </div>
        <span className="text-2xs text-t3 font-mono shrink-0">{t("modals.wikilinkPreview.clickToOpen")}</span>
      </div>
      <div className="px-3.5 py-2.5 text-xs text-char whitespace-pre-wrap leading-relaxed overflow-y-auto flex-1 pointer-events-none">
        {excerpt || (
          <span className="italic text-t3">{t("modals.wikilinkPreview.empty")}</span>
        )}
      </div>

      {membership && (
        <div className="border-t border-bd px-3.5 py-2 bg-s1/60 text-2xs">
          <div className="flex items-baseline gap-2">
            <span className="text-t3 font-mono tracking-wider">{t("modals.wikilinkPreview.appliesOn")}</span>
            <span className="text-char">
              {membership.total === 1
                ? t("modals.wikilinkPreview.appliesPath", { here: String(membership.here.length), total: String(membership.total) })
                : t("modals.wikilinkPreview.appliesPaths", { here: String(membership.here.length), total: String(membership.total) })}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {membership.here.map((b) => (
              <span
                key={b}
                className={`text-2xs px-1.5 py-0.5 rounded-full font-serif italic truncate max-w-[140px] ${
                  b === currentPath ? "bg-yel text-on-yel" : "bg-yelp text-yeld"
                }`}
                title={b === currentPath ? t("modals.wikilinkPreview.currentPath") : b}
              >
                {b}
              </span>
            ))}
            {membership.absent.map((b) => (
              <span
                key={b}
                className="text-2xs px-1.5 py-0.5 rounded-full font-serif italic truncate max-w-[140px] text-t3 border border-dashed border-bd2 line-through decoration-bd2"
                title={t("modals.wikilinkPreview.notOn", { name: b })}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.slug && onBranchHere && (
        <div className="border-t border-bd px-2 py-1.5 bg-bg flex items-center">
          <button
            onClick={() => onBranchHere(data.slug!)}
            className="w-full text-left px-2.5 py-1 text-xs text-t2 hover:text-char hover:bg-s2 rounded flex items-center gap-2"
            title={t("modals.wikilinkPreview.startPathTitle")}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="3" cy="3" r="1.5"/>
              <circle cx="3" cy="11" r="1.5"/>
              <circle cx="11" cy="7" r="1.5"/>
              <path d="M3 4.5v5M4.3 3.7l5.4 2.6"/>
            </svg>
            <span>{t("modals.wikilinkPreview.startPath")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
