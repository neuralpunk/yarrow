<script lang="ts">
  import { api } from "../../lib/tauri";
  import type { Note, NoteSummary } from "../../lib/types";
  import { editorialDate, relativeTime, timeOfDayPhrase } from "../../lib/format";
  import { mode } from "../../lib/mode.svelte";
  import { editorialReading } from "../../lib/editorPrefs.svelte";
  import WikilinkPreview, {
    cachePreview,
    getCachedPreview,
    type WikilinkPreviewData,
  } from "../WikilinkPreview.svelte";
  import { decorateChangedBlocks, synthesizeDiffMarkdown } from "../../lib/readerDiff";
  import { isExternalHref, openExternal } from "../../lib/openExternal";
  import { isTimerHref, parseTimerHref, startTimer, subscribeTimers } from "../../lib/timers";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    note: Note;
    currentPath: string;
    notes: NoteSummary[];
    currentBody?: string;
    mainBody?: string | null;
    pathNotes?: Record<string, string[]>;
    onNavigate: (slug: string) => void;
    onBranchFromWikilink?: (slug: string) => void;
    onSwitchToWriting: () => void;
  }

  let {
    note,
    currentPath,
    notes,
    currentBody,
    mainBody,
    pathNotes,
    onNavigate,
    onBranchFromWikilink,
    onSwitchToWriting,
  }: Props = $props();

  let t = $derived(tr());
  let mathOn = $derived(mode.config.persona === "researcher");
  let editorialOn = $derived(editorialReading.value);

  let html = $state("");
  let error = $state<string | null>(null);
  let preview = $state<WikilinkPreviewData | null>(null);
  let renderedRef = $state<HTMLDivElement | null>(null);
  let previewHideTimer: number | null = null;

  $effect(() => {
    const root = renderedRef;
    if (!root) return;
    void html;
    const unsubscribe = subscribeTimers((running) => {
      const liveIds = new Set(running.filter((tt) => !tt.fired).map((tt) => tt.id));
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
  });

  $effect(() => {
    let alive = true;
    error = null;
    const pathBody = currentBody ?? note.body;
    if (mainBody != null && mainBody !== pathBody) {
      const { markdown, hasChanges } = synthesizeDiffMarkdown(mainBody, pathBody);
      if (hasChanges) {
        api.renderMarkdownHtml(markdown)
          .then((h) => { if (alive) html = rewriteWikilinks(decoratePullQuotes(h)); })
          .catch((e) => { if (alive) error = String(e); });
        return () => { alive = false; };
      }
    }
    if (editorialOn) {
      api.renderMarkdownHtml(stripPullPrefix(pathBody))
        .then((h) => { if (alive) html = rewriteWikilinks(decoratePullQuotes(h)); })
        .catch((e) => { if (alive) error = String(e); });
      return () => { alive = false; };
    }
    api.renderNoteBodyHtml(note.slug)
      .then((h) => { if (alive) html = rewriteWikilinks(decoratePullQuotes(h)); })
      .catch((e) => { if (alive) error = String(e); });
    return () => { alive = false; };
  });

  $effect(() => {
    if (!html) return;
    const el = renderedRef;
    if (!el) return;
    decorateChangedBlocks(el);
  });

  $effect(() => {
    if (!mathOn || !html) return;
    const el = renderedRef;
    if (!el) return;
    let cancelled = false;
    (async () => {
      const autoMod: any = await import("katex/contrib/auto-render");
      if (cancelled) return;
      const renderMathInElement = (autoMod && autoMod.default) || autoMod;
      if (typeof renderMathInElement !== "function") return;
      try {
        renderMathInElement(el, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
          ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
        });
      } catch {}
    })();
    return () => { cancelled = true; };
  });

  function resolveWikilink(query: string): NoteSummary | undefined {
    const q = query.toLowerCase();
    return notes.find(
      (n) => n.title.toLowerCase() === q ||
        n.slug === query ||
        n.slug === q.replace(/\s+/g, "-"),
    );
  }

  function onClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
    if (!target) return;
    const href = target.getAttribute("href") || "";
    if (href.startsWith("yarrow:")) {
      e.preventDefault();
      const query = decodeURIComponent(href.slice("yarrow:".length));
      const match = resolveWikilink(query);
      const targetSlug = match?.slug;

      if (
        preview?.mode === "click" &&
        ((targetSlug && preview.slug === targetSlug) ||
          (!targetSlug && preview.title === query && preview.missing))
      ) {
        if (previewHideTimer) window.clearTimeout(previewHideTimer);
        preview = null;
        return;
      }

      const rect = target.getBoundingClientRect();
      const PREVIEW_W = 380;
      const PREVIEW_H_EST = 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < PREVIEW_H_EST + 20 && rect.top > PREVIEW_H_EST;
      const x = Math.max(12, Math.min(window.innerWidth - PREVIEW_W - 12, rect.left));
      const y = placeAbove ? rect.top - 8 : rect.bottom + 6;

      if (!match) {
        preview = { x, y, placeAbove, title: query, body: "", missing: true, mode: "click" };
        return;
      }
      const cached = getCachedPreview(match.slug);
      if (cached) {
        preview = { x, y, placeAbove, ...cached, slug: match.slug, mode: "click" };
        return;
      }
      const fallbackTitle = match.title || match.slug;
      preview = { x, y, placeAbove, title: fallbackTitle, body: "", slug: match.slug, mode: "click" };
      api.readNote(match.slug)
        .then((n) => {
          const payload = {
            title: n.frontmatter.title || n.slug,
            body: n.body,
          };
          cachePreview(n.slug, payload);
          if (preview?.mode === "click" && preview.slug === match.slug) {
            preview = { ...preview, ...payload };
          }
        })
        .catch(() => {
          if (preview?.mode === "click" && preview.slug === match.slug) {
            preview = { ...preview, missing: true };
          }
        });
      return;
    }
    if (isTimerHref(href)) {
      e.preventDefault();
      const ms = parseTimerHref(href);
      if (ms != null && ms > 0) {
        const label = (target.textContent || "timer").trim();
        const timer = startTimer(ms, label, {
          slug: note.slug,
          path: currentPath,
          label: note.frontmatter.title || note.slug,
        });
        target.dataset.timerId = timer.id;
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
  }
</script>

<div class="note-enter relative flex-1 overflow-y-auto px-12 py-12 2xl:px-24">
  <div class="w-full max-w-[680px] xl:max-w-[820px] 2xl:max-w-[960px] mx-auto">
    <div class="font-serif italic text-xs text-t3 mb-5 inline-block px-1 py-0.5 rounded-sm">
      {editorialDate(note.frontmatter.modified)} · {t("editor.note.writtenInThe")}{" "}
      {timeOfDayPhrase(note.frontmatter.modified)}
      <span class="text-t3/70"> · </span>
      <span class="font-mono not-italic text-2xs">{currentPath || "main"}</span>
      <span class="text-t3/70"> · </span>
      <span class="not-italic">{t("editor.note.edited")} {relativeTime(note.frontmatter.modified)}</span>
      <span class="text-t3/70"> · </span>
      <button
        type="button"
        onclick={() => editorialReading.toggle()}
        class="not-italic underline decoration-dotted text-yeld hover:text-char mr-2"
        title={editorialOn ? t("editor.reader.editorialOnTitle") : t("editor.reader.editorialOffTitle")}
      >
        {editorialOn ? t("editor.reader.editorialPlain") : t("editor.reader.editorial")}
      </button>
      <button
        type="button"
        onclick={onSwitchToWriting}
        class="not-italic underline decoration-dotted text-yeld hover:text-char"
      >
        {t("editor.reader.switchToWriting")}
      </button>
    </div>
    <h1
      class="font-editor text-char mb-4 font-semibold"
      style:font-size="60px"
      style:line-height="1.05"
      style:letter-spacing="-1.5px"
    >
      {note.frontmatter.title || note.slug}
    </h1>
    {#if error}
      <div class="mt-4 text-xs text-danger bg-danger/10 px-3 py-2 rounded-sm">
        {t("editor.reader.couldNotRender", { error })}
      </div>
    {/if}
    {#if currentBody !== undefined && currentBody !== note.body}
      <div class="mt-2 text-2xs italic text-t3 font-serif">
        {t("editor.reader.showingSaved")}
      </div>
    {/if}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={renderedRef}
      class="yarrow-reading mt-6{editorialOn ? ' yarrow-editorial' : ''}"
      onclick={onClick}
    >
      {@html html}
    </div>
  </div>

  {#if preview}
    <WikilinkPreview
      data={preview}
      {currentPath}
      {pathNotes}
      onBranchHere={onBranchFromWikilink ? (slug) => {
        if (previewHideTimer) window.clearTimeout(previewHideTimer);
        preview = null;
        onBranchFromWikilink(slug);
      } : undefined}
      onOpen={(slug) => {
        if (previewHideTimer) window.clearTimeout(previewHideTimer);
        preview = null;
        onNavigate(slug);
      }}
      onLeave={() => {
        preview = null;
      }}
    />
  {/if}
</div>

<script module lang="ts">
  function rewriteWikilinks(html: string): string {
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
  function stripPullPrefix(md: string): string {
    return md.replace(/^(\s*>+\s*)pull:\s*/gim, "$1[[__YARROW_PULL__]] ");
  }
  function decoratePullQuotes(html: string): string {
    return html.replace(
      /<blockquote>([\s\S]*?)\[\[__YARROW_PULL__\]\]\s*/g,
      '<blockquote class="yarrow-pull">$1',
    );
  }
  export { rewriteWikilinks, escapeHtml, stripPullPrefix, decoratePullQuotes };
</script>
