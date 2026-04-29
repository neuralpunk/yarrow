<script lang="ts">
  import { api } from "../lib/tauri";
  import CompareDiff, {
    COMPARE_VIEW_ORDER,
    DEFAULT_COMPARE_VIEW,
    type CompareDiffView,
  } from "./CompareDiff.svelte";
  import EmptyState from "./EmptyState.svelte";
  import { tr, type StringKey } from "../lib/i18n/index.svelte";

  interface Props {
    slug: string;
    mainName: string;
    pathName: string;
    onExit: () => void;
  }

  let { slug, mainName, pathName, onExit }: Props = $props();
  let t = $derived(tr());

  const VIEW_LABEL_KEYS: Record<CompareDiffView, StringKey> = {
    summary: "paths.cmpdiff.viewSummary",
    track: "paths.cmpdiff.viewTrack",
    split: "paths.cmpdiff.viewSplit",
    cards: "paths.cmpdiff.viewCards",
    marginalia: "paths.cmpdiff.viewMarginalia",
  };

  let viewLabel = $derived((v: CompareDiffView) => t(VIEW_LABEL_KEYS[v]));
  let mainBody = $state<string | null>(null);
  let pathBody = $state<string | null>(null);
  let error = $state<string | null>(null);

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
    const s = slug;
    const p = pathName;
    let alive = true;
    error = null;
    Promise.all([api.readNote(s), api.readNoteOnPath(s, p)])
      .then(([mn, pn]) => {
        if (!alive) return;
        mainBody = mn.body;
        pathBody = pn.body;
      })
      .catch((e) => {
        if (!alive) return;
        error = String(e);
      });
    return () => {
      alive = false;
    };
  });

  let hasNoDiff = $derived(
    mainBody != null && pathBody != null && mainBody === pathBody,
  );

  let headingParts = $derived(t("paths.inline.heading").split("{main}"));
  let youAreOnParts = $derived(t("paths.inline.youAreOn").split("{name}"));
  let loadErrorParts = $derived(t("paths.inline.loadError").split("{message}"));
</script>

<div class="flex-1 min-h-0 flex flex-col bg-bg">
  <div class="px-5 py-3 border-b border-bd flex items-center gap-3 bg-s1/40 flex-wrap">
    <div class="flex-1 min-w-0">
      <div class="font-serif text-base text-char leading-tight">
        {headingParts[0]}
        <span class="font-mono text-sm">{mainName}</span>
        {headingParts[1] ?? ""}
      </div>
      <div class="text-2xs text-t2 mt-0.5 truncate">
        <span class="font-mono">{slug}</span> · {youAreOnParts[0]}
        <span class="text-accent2 font-medium">{pathName}</span>
        {youAreOnParts[1] ?? ""}
      </div>
    </div>
    <div class="inline-flex items-center gap-0.5 border border-bd rounded-md overflow-hidden bg-bg shrink-0">
      <span class="px-2 py-1 text-2xs uppercase tracking-wider font-sans font-semibold text-t3">
        {t("paths.inline.viewLabel")}
      </span>
      {#each COMPARE_VIEW_ORDER as v (v)}
        <button
          onclick={() => (view = v)}
          class="px-2.5 py-1 text-2xs font-sans transition {view === v
            ? 'bg-yelp text-yeld font-semibold'
            : 'text-t2 hover:bg-s2 hover:text-char'}"
          title={t("paths.inline.viewSwitchTitle", { label: viewLabel(v) })}
        >
          {viewLabel(v)}
        </button>
      {/each}
    </div>
    <button
      onclick={onExit}
      class="shrink-0 text-xs px-3 py-1.5 rounded-sm bg-yel/90 text-on-yel hover:bg-yel font-medium"
      title={t("paths.inline.backTitle")}
    >
      {t("paths.inline.back")}
    </button>
  </div>

  <div class="flex-1 overflow-auto">
    {#if error}
      <div class="p-8 text-sm text-danger">
        {loadErrorParts[0]}
        <span class="font-mono text-2xs">{error}</span>
        {loadErrorParts[1] ?? ""}
      </div>
    {:else if mainBody == null || pathBody == null}
      <div class="p-8 text-center text-t3 italic font-serif text-sm">{t("paths.inline.loading")}</div>
    {:else if hasNoDiff}
      <EmptyState
        kind="diff"
        hint={t("paths.inline.noDiffHint", { name: pathName })}
      />
    {:else}
      <CompareDiff
        leftText={mainBody}
        rightText={pathBody}
        leftName={mainName}
        rightName={pathName}
        {view}
      />
    {/if}
  </div>
</div>
