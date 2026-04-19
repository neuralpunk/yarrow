import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/tauri";
import type { Note, NoteSummary } from "../../lib/types";
import { editorialDate, relativeTime, timeOfDayPhrase } from "../../lib/format";
import WikilinkPreview, {
  cachePreview, getCachedPreview,
  type WikilinkPreviewData,
} from "../WikilinkPreview";

interface Props {
  note: Note;
  currentPath: string;
  /** All notes in the workspace — used to resolve a wikilink target's title
   *  to its slug for the hover popover. */
  notes: NoteSummary[];
  /** Live body from the editor — when present, we render this instead of
   *  the persisted note so unsaved edits show up in the preview too. */
  currentBody?: string;
  /** Path → slugs map; passed through to the popover so it can show which
   *  paths the hovered note belongs to. */
  pathNotes?: Record<string, string[]>;
  /** Click a wikilink in the rendered output. */
  onNavigate: (slug: string) => void;
  /** "Start a path here" CTA on the hover popover. */
  onBranchFromWikilink?: (slug: string) => void;
  /** Click "switch to writing" → flip to writing mode for an immediate edit. */
  onSwitchToWriting: () => void;
}

/** Read-only rendered view of a note. The whole markdown body is parsed
 *  on the backend (pulldown-cmark, same renderer the static-site export
 *  uses) and themed via `.yarrow-reading` CSS so it picks up the user's
 *  current Yarrow theme. Wikilinks are post-processed in JS so clicking
 *  them navigates inside the app instead of trying to load a `[[...]]`
 *  pseudo-URL. */
export default function NoteReader({
  note, currentPath, notes, currentBody, pathNotes,
  onNavigate, onBranchFromWikilink, onSwitchToWriting,
}: Props) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WikilinkPreviewData | null>(null);
  // Same delayed-show / delayed-hide rhythm as the editor so the user can
  // travel from the link into the popover to click "Start a path here".
  const previewTimer = useRef<number | null>(null);
  const previewHideTimer = useRef<number | null>(null);
  const previewTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    api.renderNoteBodyHtml(note.slug)
      .then((h) => { if (alive) setHtml(rewriteWikilinks(h)); })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [note.slug, note.body]);

  const resolveWikilink = (query: string): NoteSummary | undefined => {
    const q = query.toLowerCase();
    return notes.find(
      (n) => n.title.toLowerCase() === q
        || n.slug === query
        || n.slug === q.replace(/\s+/g, "-"),
    );
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
    if (!target) return;
    const href = target.getAttribute("href") || "";
    if (href.startsWith("yarrow:")) {
      e.preventDefault();
      onNavigate(decodeURIComponent(href.slice("yarrow:".length)));
    }
  };

  const onMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest(
      "a.yarrow-wikilink",
    ) as HTMLElement | null;
    if (!a) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
    previewTargetRef.current = a;

    previewTimer.current = window.setTimeout(() => {
      if (previewTargetRef.current !== a) return;
      const rect = a.getBoundingClientRect();
      const PREVIEW_W = 380;
      const PREVIEW_H_EST = 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < PREVIEW_H_EST + 20 && rect.top > PREVIEW_H_EST;
      const x = Math.max(12, Math.min(window.innerWidth - PREVIEW_W - 12, rect.left));
      const y = placeAbove ? rect.top - 8 : rect.bottom + 6;

      const href = a.getAttribute("href") || "";
      const query = href.startsWith("yarrow:")
        ? decodeURIComponent(href.slice("yarrow:".length))
        : (a.textContent || "").trim();

      const match = resolveWikilink(query);
      if (!match) {
        setPreview({ x, y, placeAbove, title: query, body: "", missing: true });
        return;
      }
      const cached = getCachedPreview(match.slug);
      if (cached) {
        setPreview({ x, y, placeAbove, ...cached, slug: match.slug });
        return;
      }
      api.readNote(match.slug)
        .then((n) => {
          if (previewTargetRef.current !== a) return;
          const payload = {
            title: n.frontmatter.title || n.slug,
            body: n.body,
          };
          cachePreview(n.slug, payload);
          setPreview({ x, y, placeAbove, ...payload, slug: n.slug });
        })
        .catch(() => {
          if (previewTargetRef.current !== a) return;
          setPreview({ x, y, placeAbove, title: query, body: "", missing: true });
        });
    }, 140);
  };

  const onMouseOut = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a.yarrow-wikilink");
    if (!a) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
    previewHideTimer.current = window.setTimeout(() => {
      previewTargetRef.current = null;
      setPreview(null);
    }, 220);
  };

  return (
    <div className="note-enter relative flex-1 overflow-y-auto px-12 py-12 2xl:px-24">
      <div className="w-full max-w-[680px] xl:max-w-[820px] 2xl:max-w-[960px] mx-auto">
        <div className="font-serif italic text-xs text-t3 mb-5 inline-block px-1 py-0.5 rounded">
          {editorialDate(note.frontmatter.modified)} · written in the{" "}
          {timeOfDayPhrase(note.frontmatter.modified)}
          <span className="text-t3/70"> · </span>
          <span className="font-mono not-italic text-2xs">{currentPath || "main"}</span>
          <span className="text-t3/70"> · </span>
          <span className="not-italic">edited {relativeTime(note.frontmatter.modified)}</span>
          <span className="text-t3/70"> · </span>
          <button
            onClick={onSwitchToWriting}
            className="not-italic underline decoration-dotted text-yeld hover:text-char"
          >
            switch to writing
          </button>
        </div>
        <h1 className="font-serif text-[44px] leading-[1.1] text-char tracking-[-1px] mb-2">
          {note.frontmatter.title || note.slug}
        </h1>
        {error && (
          <div className="mt-4 text-xs text-danger bg-danger/10 px-3 py-2 rounded">
            Couldn't render: {error}
          </div>
        )}
        {currentBody !== undefined && currentBody !== note.body && (
          <div className="mt-2 text-2xs italic text-t3 font-serif">
            Showing the saved version — switch to writing to see your unsaved edits.
          </div>
        )}
        <div
          className="yarrow-reading mt-6"
          onClick={onClick}
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {preview && (
        <WikilinkPreview
          data={preview}
          currentPath={currentPath}
          pathNotes={pathNotes}
          onBranchHere={onBranchFromWikilink ? (slug) => {
            if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
            setPreview(null);
            onBranchFromWikilink(slug);
          } : undefined}
          onEnter={() => {
            if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
          }}
          onLeave={() => {
            previewTargetRef.current = null;
            setPreview(null);
          }}
        />
      )}
    </div>
  );
}

/** Rewrite `[[Title]]` and `![[Title]]` (which pulldown-cmark passes through
 *  as plain text) into clickable anchors using a `yarrow:` pseudo-scheme so
 *  the click handler can intercept and navigate in-app. */
function rewriteWikilinks(html: string): string {
  // Embeds first so we don't double-rewrite the inner `[[…]]` form.
  return html
    .replace(/!\[\[([^\]\n]+)\]\]/g, (_m, raw: string) => {
      const target = raw.split(/[|#]/)[0].trim();
      const label = raw.split("|").pop() ?? raw;
      return `<a class="yarrow-wikilink yarrow-embed" href="yarrow:${encodeURIComponent(target)}">${escapeHtml(label)}</a>`;
    })
    .replace(/\[\[([^\]\n]+)\]\]/g, (_m, raw: string) => {
      const target = raw.split(/[|#]/)[0].trim();
      const label = raw.split("|").pop() ?? raw;
      return `<a class="yarrow-wikilink" href="yarrow:${encodeURIComponent(target)}">${escapeHtml(label)}</a>`;
    });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
