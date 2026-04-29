<script lang="ts">
  import { api } from "../lib/tauri";
  import type { NoteSummary, PathComparison, PathDiffStatus } from "../lib/types";
  import CompareDiff, {
    COMPARE_VIEW_ORDER,
    DEFAULT_COMPARE_VIEW,
    type CompareDiffView,
  } from "./CompareDiff.svelte";
  import { tr, type StringKey } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    paths: string[];
    pathConditions?: Record<string, string | null | undefined>;
    initialLeft?: string;
    initialRight?: string;
    notes: NoteSummary[];
    initialLeftSlug?: string;
    initialRightSlug?: string;
  }

  let {
    open,
    onClose,
    paths,
    pathConditions,
    initialLeft,
    initialRight,
    notes,
    initialLeftSlug,
    initialRightSlug,
  }: Props = $props();
  let t = $derived(tr());

  type CompareMode = "notes" | "paths";
  type ShowKind = "changed" | "differences" | "all";

  const VIEW_LABEL_KEYS: Record<CompareDiffView, StringKey> = {
    summary: "paths.cmpdiff.viewSummary",
    track: "paths.cmpdiff.viewTrack",
    split: "paths.cmpdiff.viewSplit",
    cards: "paths.cmpdiff.viewCards",
    marginalia: "paths.cmpdiff.viewMarginalia",
  };

  let viewLabel = $derived((v: CompareDiffView) => t(VIEW_LABEL_KEYS[v]));

  function statusLabel(status: PathDiffStatus, leftName: string, rightName: string): string {
    switch (status) {
      case "added":
        return t("paths.compare.statusAdded", { name: rightName });
      case "removed":
        return t("paths.compare.statusRemoved", { name: leftName });
      case "modified":
        return t("paths.compare.statusModified");
      case "same":
        return t("paths.compare.statusSame");
    }
  }

  const STATUS_TONE: Record<PathDiffStatus, string> = {
    added: "text-green-700 dark:text-green-400",
    removed: "text-red-700 dark:text-red-400",
    modified: "text-amber-700 dark:text-amber-400",
    same: "text-t3",
  };

  let mode = $state<CompareMode>(
    (() => {
      try {
        const raw = localStorage.getItem("yarrow.compareMode");
        if (raw === "notes" || raw === "paths") return raw;
      } catch {}
      return "notes";
    })(),
  );

  $effect(() => {
    try {
      localStorage.setItem("yarrow.compareMode", mode);
    } catch {}
  });

  // svelte-ignore state_referenced_locally
  let left = $state<string>(initialLeft ?? paths[0] ?? "main");
  // svelte-ignore state_referenced_locally
  let right = $state<string>(
    initialRight ??
      paths.find((p) => p !== (initialLeft ?? paths[0])) ??
      paths[1] ??
      paths[0] ??
      "main",
  );
  let comparison = $state<PathComparison | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let sortedNotes = $derived(
    [...notes].sort((a, b) => {
      const ta = (a.title || a.slug).toLowerCase();
      const tb = (b.title || b.slug).toLowerCase();
      return ta.localeCompare(tb);
    }),
  );

  // svelte-ignore state_referenced_locally
  let leftSlug = $state<string>(initialLeftSlug ?? "");
  // svelte-ignore state_referenced_locally
  let rightSlug = $state<string>(initialRightSlug ?? "");

  $effect(() => {
    if (!leftSlug && sortedNotes.length > 0) leftSlug = sortedNotes[0].slug;
  });

  $effect(() => {
    if (!rightSlug && sortedNotes.length > 0) {
      const lead = leftSlug || sortedNotes[0]?.slug || "";
      rightSlug =
        sortedNotes.find((n) => n.slug !== lead)?.slug ??
        sortedNotes[1]?.slug ??
        sortedNotes[0]?.slug ??
        "";
    }
  });

  let leftBody = $state("");
  let rightBody = $state("");
  let notesLoading = $state(false);
  let notesError = $state<string | null>(null);

  let showKind = $state<ShowKind>(
    (() => {
      try {
        const raw = localStorage.getItem("yarrow.compareShowKind");
        if (raw === "changed" || raw === "differences" || raw === "all") return raw;
      } catch {}
      return "changed";
    })(),
  );

  $effect(() => {
    try {
      localStorage.setItem("yarrow.compareShowKind", showKind);
    } catch {}
  });

  let expandedSlug = $state<string | null>(null);

  let view = $state<CompareDiffView>(
    (() => {
      try {
        const raw = localStorage.getItem("yarrow.compareDiffView");
        if (raw && (COMPARE_VIEW_ORDER as string[]).includes(raw)) {
          return raw as CompareDiffView;
        }
      } catch {}
      return DEFAULT_COMPARE_VIEW;
    })(),
  );

  $effect(() => {
    try {
      localStorage.setItem("yarrow.compareDiffView", view);
    } catch {}
  });

  $effect(() => {
    if (!open) return;
    if (initialLeft && initialLeft !== left) left = initialLeft;
    if (initialRight && initialRight !== right) right = initialRight;
  });

  $effect(() => {
    if (!open) return;
    if (initialLeftSlug && initialLeftSlug !== leftSlug) {
      leftSlug = initialLeftSlug;
      if (rightSlug === initialLeftSlug) {
        const fallback = sortedNotes.find((n) => n.slug !== initialLeftSlug)?.slug ?? "";
        rightSlug = fallback;
      }
    }
    if (initialRightSlug && initialRightSlug !== rightSlug) rightSlug = initialRightSlug;
  });

  $effect(() => {
    if (!open || mode !== "paths") return;
    if (!left || !right) {
      comparison = null;
      return;
    }
    loading = true;
    error = null;
    api
      .comparePaths(left, right)
      .then((c) => (comparison = c))
      .catch((e) => {
        error = String(e);
        comparison = null;
      })
      .finally(() => (loading = false));
  });

  $effect(() => {
    if (!open || mode !== "notes") return;
    if (!leftSlug || !rightSlug) {
      leftBody = "";
      rightBody = "";
      return;
    }
    if (leftSlug === rightSlug) {
      leftBody = "";
      rightBody = "";
      return;
    }
    let cancelled = false;
    notesLoading = true;
    notesError = null;
    Promise.all([api.readNote(leftSlug), api.readNote(rightSlug)])
      .then(([a, b]) => {
        if (cancelled) return;
        leftBody = a.body ?? "";
        rightBody = b.body ?? "";
      })
      .catch((e) => {
        if (cancelled) return;
        notesError = String(e);
        leftBody = "";
        rightBody = "";
      })
      .finally(() => {
        if (!cancelled) notesLoading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  let visible = $derived.by(() => {
    if (!comparison) return [];
    const entries = [...comparison.entries];
    entries.sort((a, b) => {
      const order = { modified: 0, added: 1, removed: 2, same: 3 } as const;
      const oa = order[a.status];
      const ob = order[b.status];
      if (oa !== ob) return oa - ob;
      return a.slug.localeCompare(b.slug);
    });
    return entries.filter((e) => {
      if (showKind === "all") return true;
      if (showKind === "differences") return e.status !== "same";
      return e.status === "modified";
    });
  });

  $effect(() => {
    if (expandedSlug) return;
    const firstChanged =
      visible.find((e) => e.status === "modified") ?? visible.find((e) => e.status !== "same");
    if (firstChanged) expandedSlug = firstChanged.slug;
  });

  let leftCondition = $derived((pathConditions?.[left] ?? "").trim());
  let rightCondition = $derived((pathConditions?.[right] ?? "").trim());
  let sameSelection = $derived(mode === "paths" ? left === right : leftSlug === rightSlug);

  function swap() {
    if (mode === "paths") {
      const a = left;
      left = right;
      right = a;
      expandedSlug = null;
    } else {
      const a = leftSlug;
      leftSlug = rightSlug;
      rightSlug = a;
    }
  }

  function titleFor(slug: string): string {
    const n = sortedNotes.find((x) => x.slug === slug);
    return (n?.title || slug || "").trim() || slug;
  }

  let leftNoteTitle = $derived(titleFor(leftSlug));
  let rightNoteTitle = $derived(titleFor(rightSlug));

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.tagName === "SELECT" ||
          tgt.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "j" || e.key === "J") {
        const scroller = document.querySelector<HTMLElement>(
          "[data-yarrow-compare-scroller]",
        );
        if (scroller) {
          scroller.scrollBy({ top: scroller.clientHeight * 0.3, behavior: "smooth" });
        }
        e.preventDefault();
        return;
      }
      if (e.key === "k" || e.key === "K") {
        const scroller = document.querySelector<HTMLElement>(
          "[data-yarrow-compare-scroller]",
        );
        if (scroller) {
          scroller.scrollBy({ top: -scroller.clientHeight * 0.3, behavior: "smooth" });
        }
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const order = COMPARE_VIEW_ORDER as readonly CompareDiffView[];
        const idx = order.indexOf(view);
        const next =
          e.key === "ArrowRight"
            ? order[(idx + 1) % order.length]
            : order[(idx - 1 + order.length) % order.length];
        view = next;
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let summaryAddedParts = $derived.by(() => {
    if (!comparison || comparison.summary.added === 0) return null;
    const tpl = t("paths.compare.summaryAdded", { count: String(comparison.summary.added) });
    const [before, after] = tpl.split("{name}");
    return { before, after: after ?? "" };
  });

  let summaryRemovedParts = $derived.by(() => {
    if (!comparison || comparison.summary.removed === 0) return null;
    const tpl = t("paths.compare.summaryRemoved", { count: String(comparison.summary.removed) });
    const [before, after] = tpl.split("{name}");
    return { before, after: after ?? "" };
  });

  function getStatusDotColor(status: PathDiffStatus): string {
    return status === "added"
      ? "bg-green-500"
      : status === "removed"
        ? "bg-red-500"
        : status === "modified"
          ? "bg-amber-500"
          : "bg-t3";
  }
</script>

{#snippet pathPicker(caption: string, val: string, condition: string, accent: "left" | "right", onChange: (v: string) => void)}
  <div class="flex-1 min-w-0 rounded-lg border-2 {accent === 'left' ? 'border-bd2' : 'border-yel/60'} bg-bg px-4 py-3">
    <div class="text-2xs text-t3 uppercase tracking-wider font-sans font-semibold mb-1.5">
      {caption}
    </div>
    <select
      value={val}
      onchange={(e) => onChange(e.currentTarget.value)}
      class="w-full bg-transparent text-base text-char font-sans font-medium focus:outline-hidden cursor-pointer"
    >
      {#each paths as p (p)}
        <option value={p}>{p}</option>
      {/each}
    </select>
    {#if condition}
      <div class="text-xs italic text-ch2 font-serif mt-1 leading-snug">
        “{condition}”
      </div>
    {:else}
      <div class="text-xs text-t3 font-serif mt-1 italic opacity-60">
        {t("paths.compare.noCondition")}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet notePicker(caption: string, val: string, accent: "left" | "right", onChange: (slug: string) => void)}
  {@const selected = sortedNotes.find((n) => n.slug === val)}
  <div class="flex-1 min-w-0 rounded-lg border-2 {accent === 'left' ? 'border-bd2' : 'border-yel/60'} bg-bg px-4 py-3">
    <div class="text-2xs text-t3 uppercase tracking-wider font-sans font-semibold mb-1.5">
      {caption}
    </div>
    {#if sortedNotes.length === 0}
      <div class="text-sm text-t3 font-serif italic">{t("paths.compare.notesPickPrompt")}</div>
    {:else}
      <select
        value={val || ""}
        onchange={(e) => onChange(e.currentTarget.value)}
        class="w-full bg-transparent text-base text-char font-sans font-medium focus:outline-hidden cursor-pointer"
      >
        {#if !selected}
          <option value="" disabled>{t("paths.compare.notesPickPrompt")}</option>
        {/if}
        {#each sortedNotes as n (n.slug)}
          <option value={n.slug}>{(n.title || n.slug).trim() || n.slug}</option>
        {/each}
      </select>
    {/if}
    {#if selected && selected.tags && selected.tags.length > 0}
      <div class="text-xs italic text-ch2 font-serif mt-1 leading-snug truncate">
        {selected.tags.slice(0, 4).map((tag) => `#${tag}`).join(" · ")}
      </div>
    {/if}
  </div>
{/snippet}

{#if open}
  <div
    class="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-4"
    onmousedown={onClose}
    role="presentation"
  >
    <div
      onmousedown={(e) => e.stopPropagation()}
      class="w-full max-w-6xl h-[90vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="path-compare-title"
      tabindex="-1"
    >
      <div class="px-6 py-4 border-b border-bd flex items-start gap-4">
        <div class="flex-1 min-w-0">
          <div id="path-compare-title" class="font-serif text-xl text-char leading-tight">
            {t("paths.compare.title")}
          </div>
          <div class="text-2xs text-t2 mt-1 leading-snug max-w-[640px]">
            {mode === "notes" ? t("paths.compare.subtitleNotes") : t("paths.compare.subtitle")}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={t("paths.compare.modeLabel")}
          class="shrink-0 inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg self-center"
        >
          <button
            role="tab"
            aria-selected={mode === "notes"}
            onclick={() => (mode = "notes")}
            class="px-3 py-1.5 text-xs font-sans transition {mode === 'notes'
              ? 'bg-yelp text-yeld font-semibold'
              : 'text-t2 hover:bg-s2 hover:text-char'}"
            title={t("paths.compare.modeNotesTitle")}
          >
            {t("paths.compare.modeNotes")}
          </button>
          <button
            role="tab"
            aria-selected={mode === "paths"}
            onclick={() => (mode = "paths")}
            class="px-3 py-1.5 text-xs font-sans transition {mode === 'paths'
              ? 'bg-yelp text-yeld font-semibold'
              : 'text-t2 hover:bg-s2 hover:text-char'}"
            title={t("paths.compare.modePathsTitle")}
          >
            {t("paths.compare.modePaths")}
          </button>
        </div>
        <button
          onclick={onClose}
          class="shrink-0 w-7 h-7 rounded-sm hover:bg-s2 text-t2 hover:text-char flex items-center justify-center text-lg leading-none"
          title={t("paths.compare.closeTitle")}
        >
          ×
        </button>
      </div>

      <div class="px-6 py-4 border-b border-bd bg-s1/40">
        <div class="flex items-stretch gap-3">
          {#if mode === "paths"}
            {@render pathPicker(
              t("paths.compare.leftCaption"),
              left,
              leftCondition,
              "left",
              (v) => {
                left = v;
                expandedSlug = null;
              },
            )}
            <button
              onclick={swap}
              title={t("paths.compare.swapTitle")}
              class="shrink-0 self-center w-9 h-9 rounded-full border border-bd hover:border-yel hover:text-yel text-t2 flex items-center justify-center transition"
              aria-label={t("paths.compare.swapAria")}
            >
              ↔
            </button>
            {@render pathPicker(
              t("paths.compare.rightCaption"),
              right,
              rightCondition,
              "right",
              (v) => {
                right = v;
                expandedSlug = null;
              },
            )}
          {:else}
            {@render notePicker(
              t("paths.compare.notesLeftCaption"),
              leftSlug,
              "left",
              (v) => (leftSlug = v),
            )}
            <button
              onclick={swap}
              title={t("paths.compare.swapTitle")}
              class="shrink-0 self-center w-9 h-9 rounded-full border border-bd hover:border-yel hover:text-yel text-t2 flex items-center justify-center transition"
              aria-label={t("paths.compare.swapAria")}
            >
              ↔
            </button>
            {@render notePicker(
              t("paths.compare.notesRightCaption"),
              rightSlug,
              "right",
              (v) => (rightSlug = v),
            )}
          {/if}
        </div>
        {#if sameSelection}
          <div class="mt-3 text-2xs text-amber-700 dark:text-amber-400">
            {mode === "notes"
              ? t("paths.compare.notesSameSelection")
              : t("paths.compare.sameSelection")}
          </div>
        {/if}
      </div>

      {#if mode === "paths" && comparison && !sameSelection}
        <div class="px-6 py-3 text-xs border-b border-bd bg-bg flex items-center gap-4 flex-wrap">
          {#if comparison.summary.modified > 0}
            <span class="inline-flex items-center gap-1.5 text-2xs text-t2">
              <span class="font-mono text-amber-700 dark:text-amber-400 font-semibold">~</span>
              <span>
                {comparison.summary.modified === 1
                  ? t("paths.compare.summaryModifiedOne", { count: String(comparison.summary.modified) })
                  : t("paths.compare.summaryModifiedMany", { count: String(comparison.summary.modified) })}
              </span>
            </span>
          {/if}
          {#if summaryAddedParts}
            <span class="inline-flex items-center gap-1.5 text-2xs text-t2">
              <span class="font-mono text-green-700 dark:text-green-400 font-semibold">+</span>
              <span>
                {summaryAddedParts.before}<em class="font-medium not-italic text-char">{right}</em>{summaryAddedParts.after}
              </span>
            </span>
          {/if}
          {#if summaryRemovedParts}
            <span class="inline-flex items-center gap-1.5 text-2xs text-t2">
              <span class="font-mono text-red-700 dark:text-red-400 font-semibold">−</span>
              <span>
                {summaryRemovedParts.before}<em class="font-medium not-italic text-char">{left}</em>{summaryRemovedParts.after}
              </span>
            </span>
          {/if}
          <span class="inline-flex items-center gap-1.5 text-2xs text-t2">
            <span class="font-mono text-t3 font-semibold">=</span>
            <span>{t("paths.compare.summarySame", { count: String(comparison.summary.same) })}</span>
          </span>
          <div class="ml-auto flex items-center gap-3">
            <div class="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg">
              <span class="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
                {t("paths.compare.viewLabel")}
              </span>
              {#each COMPARE_VIEW_ORDER as v (v)}
                <button
                  onclick={() => (view = v)}
                  class="px-2.5 py-1 text-2xs font-sans transition {view === v
                    ? 'bg-yelp text-yeld font-semibold'
                    : 'text-t2 hover:bg-s2 hover:text-char'}"
                  title={t("paths.compare.viewSwitchTitle", { label: viewLabel(v) })}
                >
                  {viewLabel(v)}
                </button>
              {/each}
            </div>
            <div class="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg">
              <span class="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
                {t("paths.compare.show")}
              </span>
              {#each [
                ["changed", t("paths.compare.showChanges"), t("paths.compare.showChangesHelp")],
                ["differences", t("paths.compare.showOneSided"), t("paths.compare.showOneSidedHelp")],
                ["all", t("paths.compare.showIdentical"), t("paths.compare.showIdenticalHelp")],
              ] as [k, label, help] (k)}
                <button
                  onclick={() => (showKind = k as ShowKind)}
                  title={help}
                  class="px-2.5 py-1 text-2xs font-sans transition {showKind === k
                    ? 'bg-yelp text-yeld font-semibold'
                    : 'text-t2 hover:bg-s2 hover:text-char'}"
                >
                  {label}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      {#if mode === "notes" && !sameSelection}
        <div class="px-6 py-3 text-xs border-b border-bd bg-bg flex items-center gap-4 flex-wrap">
          <span class="text-2xs text-t3 italic font-serif">
            {t("paths.compare.notesSummary", {
              left: leftNoteTitle,
              right: rightNoteTitle,
            })}
          </span>
          <div class="ml-auto flex items-center gap-3">
            <div class="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg">
              <span class="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
                {t("paths.compare.viewLabel")}
              </span>
              {#each COMPARE_VIEW_ORDER as v (v)}
                <button
                  onclick={() => (view = v)}
                  class="px-2.5 py-1 text-2xs font-sans transition {view === v
                    ? 'bg-yelp text-yeld font-semibold'
                    : 'text-t2 hover:bg-s2 hover:text-char'}"
                  title={t("paths.compare.viewSwitchTitle", { label: viewLabel(v) })}
                >
                  {viewLabel(v)}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      {#if error || notesError}
        <div class="px-6 py-3 text-xs text-danger bg-danger/10 border-b border-bd">
          <div class="font-medium mb-0.5">{t("paths.compare.errorTitle")}</div>
          <div class="text-2xs text-danger/80">{mode === "notes" ? notesError : error}</div>
        </div>
      {/if}

      <div class="flex-1 overflow-y-auto bg-bg" data-yarrow-compare-scroller>
        {#if mode === "paths"}
          {#if loading}
            <div class="p-8 text-center text-t3 italic font-serif text-sm">
              {t("paths.compare.loading")}
            </div>
          {:else if visible.length === 0}
            {#if !comparison}
              <div class="p-10 text-center">
                <div class="text-sm text-t3 italic font-serif">{t("paths.compare.pickPrompt")}</div>
              </div>
            {:else if showKind === "changed"}
              {@const adds = comparison.summary.added ?? 0}
              {@const rems = comparison.summary.removed ?? 0}
              {@const haveOneSiders = adds + rems > 0}
              <div class="p-10 text-center">
                <div class="font-serif text-lg text-char mb-2">
                  {t("paths.compare.emptyChangedTitle")}
                </div>
                <div class="text-sm text-t2 max-w-md mx-auto leading-relaxed mb-4">
                  {haveOneSiders
                    ? t("paths.compare.emptyChangedOneSiders")
                    : t("paths.compare.emptyChangedIdentical")}
                </div>
                {#if haveOneSiders}
                  <button
                    onclick={() => (showKind = "differences")}
                    class="text-xs px-3 py-1.5 rounded-sm bg-yelp text-yeld hover:brightness-110"
                  >
                    {t("paths.compare.emptyShowOneSided", { count: String(adds + rems) })}
                  </button>
                {/if}
              </div>
            {:else if showKind === "differences"}
              {@const same = comparison.summary.same ?? 0}
              <div class="p-10 text-center">
                <div class="font-serif text-lg text-char mb-2">{t("paths.compare.emptyDiffsTitle")}</div>
                <div class="text-sm text-t2 max-w-md mx-auto leading-relaxed mb-4">
                  {t("paths.compare.emptyDiffsBody")}
                </div>
                {#if same > 0}
                  <button
                    onclick={() => (showKind = "all")}
                    class="text-xs px-3 py-1.5 rounded-sm bg-s2 text-char hover:bg-s3"
                  >
                    {t("paths.compare.emptyShowIdentical", { count: String(same) })}
                  </button>
                {/if}
              </div>
            {:else}
              <div class="p-10 text-center">
                <div class="font-serif text-lg text-char mb-2">{t("paths.compare.emptyAll")}</div>
              </div>
            {/if}
          {:else}
            <ul class="divide-y divide-bd/60">
              {#each visible as e (e.slug)}
                {@const expanded = expandedSlug === e.slug}
                {@const clickable = e.status !== "same"}
                <li class="bg-bg">
                  <button
                    onclick={clickable ? () => (expandedSlug = expanded ? null : e.slug) : undefined}
                    title={clickable
                      ? expanded
                        ? t("paths.compare.rowExpandHide")
                        : t("paths.compare.rowExpandShow")
                      : undefined}
                    class="w-full text-left px-6 py-3 flex items-start gap-3 {clickable
                      ? 'hover:bg-s1 cursor-pointer'
                      : 'cursor-default'}"
                  >
                    <span class="shrink-0 mt-0.5">
                      <span class="inline-block w-2 h-2 rounded-full {getStatusDotColor(e.status)}"></span>
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-3 flex-wrap">
                        <span class="font-serif text-char text-base truncate">{e.slug}</span>
                        <span class="text-2xs uppercase tracking-wider font-sans font-semibold {STATUS_TONE[e.status]}">
                          {statusLabel(e.status, left, right)}
                        </span>
                        {#if clickable}
                          <span class="text-2xs text-t3 ml-auto font-mono">
                            {expanded ? t("paths.compare.rowHide") : t("paths.compare.rowShow")}
                          </span>
                        {/if}
                      </div>
                      {#if !expanded}
                        {#if e.status === "same"}
                          <div class="text-2xs text-t3 italic mt-1 font-serif truncate">
                            {t("paths.compare.rowSamePreview")}
                          </div>
                        {:else}
                          {@const side = e.status === "added" ? right : left}
                          {@const text = e.status === "added" ? e.right_excerpt : e.left_excerpt}
                          {#if text}
                            <div class="mt-1.5 text-2xs text-t2 truncate font-serif italic">
                              {t("paths.compare.rowOnSide", { side })}<span class="text-ch2 not-italic">{text.split("\n")[0].slice(0, 120)}</span>
                            </div>
                          {/if}
                        {/if}
                      {/if}
                    </div>
                  </button>
                  {#if expanded && clickable}
                    <CompareDiff
                      leftText={e.left_excerpt ?? ""}
                      rightText={e.right_excerpt ?? ""}
                      leftName={left}
                      rightName={right}
                      {view}
                    />
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        {:else if sortedNotes.length < 2}
          <div class="p-10 text-center">
            <div class="font-serif text-lg text-char mb-2">
              {t("paths.compare.notesEmptyWorkspaceTitle")}
            </div>
            <div class="text-sm text-t2 max-w-md mx-auto leading-relaxed">
              {t("paths.compare.notesEmptyWorkspaceBody")}
            </div>
          </div>
        {:else if sameSelection}
          <div class="p-10 text-center">
            <div class="font-serif text-lg text-char mb-2">
              {t("paths.compare.notesPickPromptTitle")}
            </div>
            <div class="text-sm text-t2 max-w-md mx-auto leading-relaxed">
              {t("paths.compare.notesPickPrompt")}
            </div>
          </div>
        {:else if notesLoading}
          <div class="p-8 text-center text-t3 italic font-serif text-sm">{t("paths.compare.loading")}</div>
        {:else}
          <CompareDiff
            leftText={leftBody}
            rightText={rightBody}
            leftName={leftNoteTitle}
            rightName={rightNoteTitle}
            {view}
          />
        {/if}
      </div>

      <div class="px-6 py-3 border-t border-bd flex justify-between items-center gap-3">
        <div class="text-2xs text-t3 italic font-serif">{t("paths.compare.footerHelp")}</div>
        <button
          onclick={onClose}
          class="text-xs px-3 py-1.5 rounded-sm bg-s2 text-t2 hover:bg-s3 hover:text-char"
        >
          {t("paths.compare.close")}
        </button>
      </div>
    </div>
  </div>
{/if}
