import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/tauri";
import type { Note, NoteSummary } from "../../lib/types";
import { editorialDate, relativeTime, timeOfDayPhrase } from "../../lib/format";
import { useExtraMath } from "../../lib/extraPrefs";
import { useEditorialReading } from "../../lib/editorPrefs";
import WikilinkPreview, {
  cachePreview, getCachedPreview,
  type WikilinkPreviewData,
} from "../WikilinkPreview";
import { decorateChangedBlocks, synthesizeDiffMarkdown } from "../../lib/readerDiff";
import { isExternalHref, openExternal } from "../../lib/openExternal";
import { isTimerHref, parseTimerHref, startTimer, subscribeTimers } from "../../lib/timers";
import { useT } from "../../lib/i18n";

interface Props {
  note: Note;
  currentPath: string;
  /** All notes in the workspace — used to resolve a wikilink target's title
   *  to its slug for the hover popover. */
  notes: NoteSummary[];
  /** Live body from the editor — when present, we render this instead of
   *  the persisted note so unsaved edits show up in the preview too. */
  currentBody?: string;
  /** Main's body for this slug when on a non-root path. Present → we
   *  render ley-line decorations (inline token-level del/ins on
   *  modified lines, ghost strikethrough for deletions). */
  mainBody?: string | null;
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
  note, currentPath, notes, currentBody, mainBody, pathNotes,
  onNavigate, onBranchFromWikilink, onSwitchToWriting,
}: Props) {
  const t = useT();
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WikilinkPreviewData | null>(null);
  const [mathOn] = useExtraMath();
  const [editorialOn, setEditorialOn] = useEditorialReading();
  // Ref onto the rendered `.yarrow-reading` container so we can point
  // KaTeX's auto-render at it after the HTML lands.
  const renderedRef = useRef<HTMLDivElement>(null);
  // Same delayed-show / delayed-hide rhythm as the editor so the user can
  // travel from the link into the popover to click "Start a path here".
  const previewTimer = useRef<number | null>(null);
  const previewHideTimer = useRef<number | null>(null);
  const previewTargetRef = useRef<HTMLElement | null>(null);

  // 2.2.0 — keep the in-note timer link's "running" styling in sync
  // with the actual timer registry. When the user clicks `[label](
  // timer:Xm)` we tag the anchor with `data-timer-id="<id>"` and the
  // CSS `a[href^="timer:"][data-timer-id]` rule flips it into the
  // running palette. This subscription removes the attribute the
  // moment the timer ends or is dismissed, so the link reverts.
  useEffect(() => {
    const root = renderedRef.current;
    if (!root) return;
    const unsubscribe = subscribeTimers((running) => {
      const liveIds = new Set(running.filter((t) => !t.fired).map((t) => t.id));
      // Walk every flagged anchor and clear those whose timer is no
      // longer running. Cheap: there are usually <10 timer links in a
      // note and this only fires when the timer set changes.
      const flagged = root.querySelectorAll<HTMLAnchorElement>(
        'a[href^="timer:"][data-timer-id]',
      );
      flagged.forEach((a) => {
        const id = a.dataset.timerId;
        if (!id || !liveIds.has(id)) {
          delete a.dataset.timerId;
        }
      });
    });
    return unsubscribe;
  }, [html]);

  useEffect(() => {
    let alive = true;
    setError(null);
    // Ley Lines path: synthesize a diffed markdown (path body annotated
    // with inline `<del>/<ins>` for modified lines, ghost placeholders
    // for pure deletions) and render it through the same pulldown-cmark
    // pipeline as a normal note. This keeps tables, fences, callouts,
    // and footnotes rendering correctly — we're just adding inline HTML
    // that pulldown-cmark passes through.
    const pathBody = currentBody ?? note.body;
    if (mainBody != null && mainBody !== pathBody) {
      const { markdown, hasChanges } = synthesizeDiffMarkdown(mainBody, pathBody);
      if (hasChanges) {
        api.renderMarkdownHtml(markdown)
          .then((h) => { if (alive) setHtml(rewriteWikilinks(decoratePullQuotes(h))); })
          .catch((e) => { if (alive) setError(String(e)); });
        return () => { alive = false; };
      }
    }
    // Editorial mode slightly transforms the source: a line starting with
    // `> pull:` becomes a bare blockquote marked `.yarrow-pull` in the
    // post-processor below. When the feature is off, we take the faster
    // prebuilt path (renderNoteBodyHtml reads the file from disk).
    if (editorialOn) {
      api.renderMarkdownHtml(stripPullPrefix(pathBody))
        .then((h) => { if (alive) setHtml(rewriteWikilinks(decoratePullQuotes(h))); })
        .catch((e) => { if (alive) setError(String(e)); });
      return () => { alive = false; };
    }
    api.renderNoteBodyHtml(note.slug)
      .then((h) => { if (alive) setHtml(rewriteWikilinks(decoratePullQuotes(h))); })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [note.slug, note.body, mainBody, currentBody, editorialOn]);

  // After the HTML lands, tag each block that contains a ley-* mark with
  // `.ley-changed` so CSS paints the left change-bar on the paragraph.
  useEffect(() => {
    if (!html) return;
    const el = renderedRef.current;
    if (!el) return;
    decorateChangedBlocks(el);
  }, [html]);

  // When the math extra is on, run KaTeX's auto-render over the rendered
  // HTML so `$…$` / `$$…$$` delimiters turn into typeset equations.
  // Lazy-loaded so the reader doesn't pay for KaTeX when the extra is off.
  useEffect(() => {
    if (!mathOn) return;
    if (!html) return;
    const el = renderedRef.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      const autoMod: any = await import("katex/contrib/auto-render");
      if (cancelled) return;
      const renderMathInElement =
        (autoMod && autoMod.default) || autoMod;
      if (typeof renderMathInElement !== "function") {
        console.warn("[yarrow] katex auto-render import shape:", Object.keys(autoMod));
        return;
      }
      try {
        renderMathInElement(el, {
          // Match the editor's inline/block syntax (single-$ and $$-block).
          // `\(…\)` and `\[…\]` included because they're the KaTeX
          // defaults and some users paste them in.
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
          // Ignore code blocks — `$x$` inside a ```rust fence shouldn't
          // become math.
          ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
        });
        console.info("[yarrow] reader: math auto-rendered");
      } catch (err) {
        console.warn("[yarrow] reader: math auto-render failed", err);
      }
    })();
    return () => { cancelled = true; };
  }, [html, mathOn]);

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
      return;
    }
    // 2.2.0 — `[label](timer:25m)` markdown links become inline timers.
    // Click → start a countdown in the corner pill; the link gets
    // tagged with the timer's id so its style flips to "running" and
    // the timer-state subscription below reverts it when the timer
    // ends or is dismissed.
    if (isTimerHref(href)) {
      e.preventDefault();
      const ms = parseTimerHref(href);
      if (ms != null && ms > 0) {
        const label = (target.textContent || "timer").trim();
        const timer = startTimer(ms, label);
        target.dataset.timerId = timer.id;
        // Brief tactile feedback flash on click — independent of the
        // running-state styling below.
        target.classList.add("yarrow-timer-link-fired");
        window.setTimeout(() => {
          try { target.classList.remove("yarrow-timer-link-fired"); } catch {}
        }, 600);
      }
      return;
    }
    if (isExternalHref(href)) {
      e.preventDefault();
      openExternal(href);
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
          {editorialDate(note.frontmatter.modified)} · {t("editor.note.writtenInThe")}{" "}
          {timeOfDayPhrase(note.frontmatter.modified)}
          <span className="text-t3/70"> · </span>
          <span className="font-mono not-italic text-2xs">{currentPath || "main"}</span>
          <span className="text-t3/70"> · </span>
          <span className="not-italic">{t("editor.note.edited")} {relativeTime(note.frontmatter.modified)}</span>
          <span className="text-t3/70"> · </span>
          <button
            onClick={() => setEditorialOn(!editorialOn)}
            className="not-italic underline decoration-dotted text-yeld hover:text-char mr-2"
            title={editorialOn ? t("editor.reader.editorialOnTitle") : t("editor.reader.editorialOffTitle")}
          >
            {editorialOn ? t("editor.reader.editorialPlain") : t("editor.reader.editorial")}
          </button>
          <button
            onClick={onSwitchToWriting}
            className="not-italic underline decoration-dotted text-yeld hover:text-char"
          >
            {t("editor.reader.switchToWriting")}
          </button>
        </div>
        <h1 className="font-serif text-[44px] leading-[1.1] text-char tracking-[-1px] mb-2">
          {note.frontmatter.title || note.slug}
        </h1>
        {error && (
          <div className="mt-4 text-xs text-danger bg-danger/10 px-3 py-2 rounded">
            {t("editor.reader.couldNotRender", { error })}
          </div>
        )}
        {currentBody !== undefined && currentBody !== note.body && (
          <div className="mt-2 text-2xs italic text-t3 font-serif">
            {t("editor.reader.showingSaved")}
          </div>
        )}
        <div
          ref={renderedRef}
          className={`yarrow-reading mt-6${editorialOn ? " yarrow-editorial" : ""}`}
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

/** Strip the `pull:` tag from the start of a blockquote line so the
 *  pulldown-cmark renderer still sees a plain blockquote. We'll tag it
 *  with `yarrow-pull` in the rendered HTML via `decoratePullQuotes`. */
function stripPullPrefix(md: string): string {
  // Match any number of leading `>` followed by the `pull:` marker
  // (case-insensitive), at the start of a line. Preserves indentation
  // inside nested quotes.
  return md.replace(/^(\s*>+\s*)pull:\s*/gim, "$1[[__YARROW_PULL__]] ");
}

/** Upgrade `<blockquote>` nodes whose first text begins with the pull
 *  marker to `.yarrow-pull`. We use a string-level replace rather than
 *  DOMParser so the html transform runs before the container mounts and
 *  there's no flash of ungraced quote. */
function decoratePullQuotes(html: string): string {
  // Match the opening tag and the marker placed inside by `stripPullPrefix`.
  // `[\s\S]*?` keeps the match non-greedy so we don't consume past the first
  // element.
  return html.replace(
    /<blockquote>([\s\S]*?)\[\[__YARROW_PULL__\]\]\s*/g,
    '<blockquote class="yarrow-pull">$1',
  );
}
