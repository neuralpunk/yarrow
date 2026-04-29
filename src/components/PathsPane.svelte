<script lang="ts">
  import type { ClusterSuggestion, NoteSummary, PathCollectionsView } from "../lib/types";
  import { isGhostPath } from "../lib/types";
  import { api } from "../lib/tauri";
  import { NewDirectionIcon, HelpIcon } from "../lib/iconsSvelte";
  import ForkingRoad from "./Paths/ForkingRoad.svelte";
  import ScenarioCards from "./Paths/ScenarioCards.svelte";
  import PathDetail from "./Paths/PathDetail.svelte";
  import ConditionEditor from "./Paths/ConditionEditor.svelte";
  import PathsEmptyState from "./Paths/PathsEmptyState.svelte";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    notes: NoteSummary[];
    onClose: () => void;
    onNavigate: (slug: string) => void;
    onOpenMap: (collectionName: string, focusSlug?: string) => void;
    onCollectionsChanged?: (view: PathCollectionsView) => void;
    onLinksChanged?: () => void;
    onSwitchToRoot?: (rootName: string) => void;
    currentPathName?: string;
    onOpenDecisionMatrix?: () => void;
  }

  let {
    notes,
    onClose,
    onNavigate,
    onOpenMap,
    onCollectionsChanged,
    onLinksChanged,
    onSwitchToRoot,
    currentPathName,
    onOpenDecisionMatrix,
  }: Props = $props();

  let t = $derived(tr());

  let view = $state<PathCollectionsView | null>(null);
  let err = $state<string | null>(null);
  let selected = $state<string | null>(null);
  let editing = $state<null | { name: string; initial: string }>(null);
  let creating = $state<null | { parent: string; seedSlug?: string }>(null);
  let helpOpen = $state(false);
  let viewMode = $state<"graph" | "cards">((() => {
    try {
      const v = localStorage.getItem("yarrow.pathsPane.viewMode");
      return v === "cards" ? "cards" : "graph";
    } catch {
      return "graph";
    }
  })());

  function setViewModePersist(m: "graph" | "cards") {
    viewMode = m;
    try {
      localStorage.setItem("yarrow.pathsPane.viewMode", m);
    } catch { /* quota */ }
  }

  let newFork = $state<null | { parent: string; seedSlug?: string }>(null);
  let promoteTarget = $state<string | null>(null);
  let suggestions = $state<ClusterSuggestion[]>([]);
  let showSuggestions = $state(false);
  let dismissedSeeds = $state<Set<string>>((() => {
    try {
      const raw = localStorage.getItem("yarrow.pathsPane.dismissedSuggestions");
      if (!raw) return new Set<string>();
      const arr = JSON.parse(raw);
      return new Set<string>(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set<string>();
    }
  })());
  let showDismissed = $state(false);
  let showAllSuggestions = $state(false);
  const SUGGESTION_VISIBLE_CAP = 5;
  function persistDismissed(next: Set<string>) {
    try {
      localStorage.setItem(
        "yarrow.pathsPane.dismissedSuggestions",
        JSON.stringify(Array.from(next)),
      );
    } catch { /* quota */ }
  }

  let divergenceByPath = $state<Record<string, number>>({});

  async function refresh() {
    try {
      const v = await api.listPathCollections();
      view = v;
      err = null;
      onCollectionsChanged?.(v);
      try {
        const summary = await api.pathDivergenceSummary();
        const next: Record<string, number> = {};
        for (const s of summary) next[s.name] = s.differs;
        divergenceByPath = next;
      } catch {
        divergenceByPath = {};
      }
    } catch (e) {
      err = String(e);
    }
  }

  $effect(() => {
    refresh();
  });

  $effect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (editing || creating || newFork || promoteTarget || helpOpen) return;
      const tEl = ev.target as HTMLElement | null;
      const tag = tEl?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (tEl && tEl.isContentEditable)
      )
        return;
      if (selected) {
        selected = null;
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  $effect(() => {
    let alive = true;
    api
      .suggestPathClusters()
      .then((s) => {
        if (alive) suggestions = s;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  });

  async function acceptSuggestion(s: ClusterSuggestion) {
    try {
      await api.createPathCollection(s.name, s.seed_title, rootName, s.seed_slug);
      for (const slug of s.members) {
        if (slug === s.seed_slug) continue;
        await api.addNoteToPathCollection(s.name, slug);
      }
      await refresh();
      suggestions = suggestions.filter((x) => x.seed_slug !== s.seed_slug);
      if (dismissedSeeds.has(s.seed_slug)) {
        const next = new Set(dismissedSeeds);
        next.delete(s.seed_slug);
        persistDismissed(next);
        dismissedSeeds = next;
      }
      selected = s.name;
    } catch (e) {
      err = String(e);
    }
  }

  function dismissSuggestion(s: ClusterSuggestion) {
    const next = new Set(dismissedSeeds);
    next.add(s.seed_slug);
    persistDismissed(next);
    dismissedSeeds = next;
  }

  function undismissSuggestion(seedSlug: string) {
    const next = new Set(dismissedSeeds);
    next.delete(seedSlug);
    persistDismissed(next);
    dismissedSeeds = next;
  }

  let activeSuggestions = $derived(
    suggestions.filter((s) => !dismissedSeeds.has(s.seed_slug)),
  );
  let dismissedSuggestionsList = $derived(
    suggestions.filter((s) => dismissedSeeds.has(s.seed_slug)),
  );

  let collections = $derived(view?.collections ?? []);
  let currentPathMembers = $derived.by(() => {
    if (!currentPathName) return undefined;
    return collections.find((c) => c.name === currentPathName)?.members;
  });
  let rootName = $derived(view?.root ?? "main");
  let selectedCol = $derived(selected ? collections.find((c) => c.name === selected) ?? null : null);

  function parentOf(name: string): string {
    return collections.find((c) => c.name === name)?.parent ?? "";
  }

  function startEditCondition(name: string, initial: string) {
    editing = { name, initial };
  }

  async function saveCondition(next: string) {
    if (!editing) return;
    const { name } = editing;
    editing = null;
    try {
      await api.setPathCollectionCondition(name, next);
      await refresh();
    } catch (e) {
      err = String(e);
    }
  }

  async function createPathFromCondition(parent: string, condition: string, seedSlug?: string) {
    const trimmed = condition.trim();
    if (!trimmed) return;
    const name =
      trimmed
        .toLowerCase()
        .replace(/^(if\s+|what\s+if\s+)/i, "")
        .split(/\s+/)
        .slice(0, 5)
        .join("-")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "new-path";
    try {
      await api.createPathCollection(name, trimmed, parent, seedSlug);
      await refresh();
      selected = name;
    } catch (e) {
      err = String(e);
    }
  }

  async function commitFork(condition: string) {
    if (!newFork) return;
    const { parent, seedSlug } = newFork;
    newFork = null;
    await createPathFromCondition(parent, condition, seedSlug);
  }

  function startFork(parent: string, seedSlug?: string) {
    selected = null;
    if (viewMode === "graph") {
      newFork = { parent, seedSlug };
      return;
    }
    creating = { parent, seedSlug };
  }

  async function handleRename(name: string) {
    const next = window.prompt(t("paths.pane.renamePrompt", { name }), name);
    if (!next || next.trim() === name) return;
    try {
      await api.renamePathCollection(name, next.trim());
      await refresh();
      selected = next.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    } catch (e) {
      err = String(e);
    }
  }

  async function handleDelete(name: string) {
    if (name === rootName) return;
    const ok = window.confirm(t("paths.pane.deleteConfirm", { name }));
    if (!ok) return;
    try {
      await api.deletePathCollection(name);
      await refresh();
      selected = null;
    } catch (e) {
      err = String(e);
    }
  }

  async function handlePromote(name: string) {
    try {
      await api.setPathCollectionRoot(name);
      await refresh();
      onSwitchToRoot?.(name);
      selected = name;
    } catch (e) {
      err = String(e);
    }
  }

  async function handleSetMainNote(name: string, slug: string | null) {
    try {
      await api.setPathCollectionMainNote(name, slug);
      await refresh();
    } catch (e) {
      err = String(e);
    }
  }

  async function handleSetColor(name: string, color: string | null) {
    try {
      await api.setPathCollectionColor(name, color);
      await refresh();
    } catch (e) {
      err = String(e);
    }
  }

  async function handleSetAutoTag(name: string, tag: string | null) {
    try {
      await api.setPathCollectionAutoTag(name, tag);
      await refresh();
    } catch (e) {
      err = String(e);
    }
  }

  async function handleAddNote(name: string, slug: string) {
    try {
      await api.addNoteToPathCollection(name, slug);
      let linked = false;
      const col = collections.find((c) => c.name === name);
      const mainSlug = col?.main_note;
      if (mainSlug && mainSlug !== slug) {
        try {
          await api.addLink(mainSlug, slug, "supports");
          linked = true;
        } catch (e) {
          console.warn("auto-link on add-to-path failed", e);
        }
      }
      await refresh();
      if (linked) onLinksChanged?.();
    } catch (e) {
      err = String(e);
    }
  }

  async function handleRemoveNote(name: string, slug: string) {
    try {
      await api.removeNoteFromPathCollection(name, slug);
      await refresh();
    } catch (e) {
      err = String(e);
    }
  }

  async function handleSetArchived(name: string, archived: boolean) {
    if (archived) {
      const ok = window.confirm(t("paths.archive.confirmSet", { name }));
      if (!ok) return;
    }
    try {
      await api.setPathArchived(name, archived);
      await refresh();
    } catch (e) {
      err = String(e);
    }
  }

  let onlyRoot = $derived(collections.length <= 1);

  let subtitleParts = $derived(t("paths.pane.subtitle").split("{root}"));

  // ── promote confirm modal local state ──
  let promotePhrase = $state("");
  $effect(() => {
    promoteTarget;
    promotePhrase = "";
  });
  let promoteRequired = $derived(promoteTarget ? `make ${promoteTarget} main` : "");
  let promoteMatches = $derived(promotePhrase.trim().toLowerCase() === promoteRequired.toLowerCase());
  let promoteIsGhost = $derived.by(() => {
    if (!promoteTarget) return false;
    const c = collections.find((c) => c.name === promoteTarget);
    return c ? isGhostPath(c, rootName, collections) : false;
  });
  let promoteTypeParts = $derived(t("paths.promote.typeToConfirm").split("{phrase}"));

  let helpRootBodyParts = $derived(t("paths.pane.helpRootBody").split("{root}"));
</script>

{#snippet closeIcon()}
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <path d="M3 3l10 10M13 3L3 13" />
  </svg>
{/snippet}

<div class="fixed inset-0 z-40 bg-bg flex flex-col animate-fadeIn" role="dialog" aria-label={t("paths.pane.title")}>
  <header class="px-6 py-4 border-b border-bd bg-bg flex items-center gap-4">
    <div class="flex items-center gap-2.5">
      <NewDirectionIcon />
      <div>
        <div class="font-serif text-[22px] text-char leading-none">
          {t("paths.pane.title")}
        </div>
        <div class="text-2xs text-t3 italic mt-1">
          {subtitleParts[0]}<span class="text-t2 not-italic">{rootName}</span>{subtitleParts[1] ?? ""}
        </div>
      </div>
    </div>
    <div class="ml-auto flex items-center gap-2">
      {#if !onlyRoot && onSwitchToRoot}
        <button
          onclick={() => {
            onSwitchToRoot?.(rootName);
            selected = rootName;
          }}
          class="text-xs px-3 py-1.5 rounded-md border border-yel/70 text-yeld hover:bg-yelp inline-flex items-center gap-1.5"
          title={t("paths.pane.backToRootTitle", { root: rootName })}
        >
          <span class="inline-block w-2 h-2 rounded-full" style:background="var(--yel)"></span>
          <span>{t("paths.pane.backToRoot", { root: rootName })}</span>
        </button>
      {/if}
      {#if !onlyRoot}
        <button
          onclick={() => startFork(rootName)}
          class="text-xs px-3 py-1.5 rounded-md bg-yel text-on-yel hover:bg-yel2 inline-flex items-center gap-1.5"
          title={t("paths.pane.newPathFromRootTitle", { root: rootName })}
        >
          <NewDirectionIcon />
          <span>{t("paths.pane.newPathFromRoot", { root: rootName })}</span>
        </button>
      {/if}
      {#if (activeSuggestions.length > 0 || dismissedSuggestionsList.length > 0) && !onlyRoot}
        <button
          onclick={() => (showSuggestions = !showSuggestions)}
          class="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition {showSuggestions
            ? 'bg-yelp text-yeld border border-yel'
            : 'border border-bd text-t2 hover:bg-s2 hover:text-char'}"
          title={t("paths.pane.suggestedTitle")}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="4" cy="4" r="1.4" />
            <circle cx="10" cy="4" r="1.4" />
            <circle cx="7" cy="10" r="1.4" />
            <path d="M4.5 4.5L6.5 9.5M9.5 4.5L7.5 9.5M5 4h4" />
          </svg>
          <span>{t("paths.pane.suggestedCount", { count: String(activeSuggestions.length) })}</span>
        </button>
      {/if}
      {#if onOpenDecisionMatrix && !onlyRoot}
        <button
          onclick={onOpenDecisionMatrix}
          class="text-xs px-3 py-1.5 rounded-md border border-bd text-t2 hover:bg-s2 hover:text-char inline-flex items-center gap-1.5"
          title={t("paths.pane.decisionMatrixTitle")}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
            <path d="M1.5 5h11M1.5 9h11M5 1.5v11M9 1.5v11" />
          </svg>
          <span>{t("paths.pane.decisionMatrix")}</span>
        </button>
      {/if}
      {#if !onlyRoot}
        <div
          role="tablist"
          aria-label={t("paths.pane.viewToggleAria")}
          class="inline-flex items-center rounded-md border border-bd overflow-hidden text-2xs font-mono"
        >
          <button
            role="tab"
            aria-selected={viewMode === "graph"}
            onclick={() => setViewModePersist("graph")}
            class="px-2.5 py-1.5 transition {viewMode === 'graph' ? 'bg-char text-bg' : 'text-t3 hover:bg-s2 hover:text-char'}"
            title={t("paths.pane.viewGraphTitle")}
          >
            {t("paths.pane.viewGraph")}
          </button>
          <button
            role="tab"
            aria-selected={viewMode === "cards"}
            onclick={() => setViewModePersist("cards")}
            class="px-2.5 py-1.5 transition {viewMode === 'cards' ? 'bg-char text-bg' : 'text-t3 hover:bg-s2 hover:text-char'}"
            title={t("paths.pane.viewCardsTitle")}
          >
            {t("paths.pane.viewCards")}
          </button>
        </div>
      {/if}
      <button
        onclick={() => (helpOpen = !helpOpen)}
        class="w-9 h-9 flex items-center justify-center rounded-full transition {helpOpen
          ? 'bg-yelp text-yeld'
          : 'text-t3 hover:bg-s2 hover:text-char'}"
        title={t("paths.pane.helpTitle")}
      >
        <HelpIcon />
      </button>
      <button
        onclick={onClose}
        class="w-9 h-9 flex items-center justify-center rounded-full text-t3 hover:bg-s2 hover:text-char"
        title={t("paths.pane.closeTitle")}
      >
        {@render closeIcon()}
      </button>
    </div>
  </header>

  {#if err}
    <div class="px-6 py-2.5 border-b border-bd bg-danger/10 text-xs text-danger">
      {err}
    </div>
  {/if}

  {#if showSuggestions && (activeSuggestions.length > 0 || dismissedSuggestionsList.length > 0)}
    <div class="px-6 py-3 border-b border-bd bg-s1/60">
      <div class="flex items-baseline justify-between mb-2">
        <div class="font-serif text-sm text-char">{t("paths.pane.suggestedHeading")}</div>
        <div class="flex items-center gap-3">
          <div class="font-serif italic text-2xs text-t3">{t("paths.pane.suggestedHelp")}</div>
          {#if dismissedSuggestionsList.length > 0}
            <button
              onclick={() => (showDismissed = !showDismissed)}
              class="text-2xs text-t3 hover:text-char transition underline-offset-2 hover:underline"
              title={t("paths.pane.showDismissedTitle")}
            >
              {showDismissed
                ? t("paths.pane.hideDismissed", { count: String(dismissedSuggestionsList.length) })
                : t("paths.pane.showDismissed", { count: String(dismissedSuggestionsList.length) })}
            </button>
          {/if}
        </div>
      </div>
      {#if activeSuggestions.length > 0}
        {@const visibleList = showAllSuggestions ? activeSuggestions : activeSuggestions.slice(0, SUGGESTION_VISIBLE_CAP)}
        <div class="flex gap-2 overflow-x-auto pb-1">
          {#each visibleList as s (s.seed_slug)}
            <div class="shrink-0 w-[280px] bg-bg border border-bd rounded-md p-3">
              <div class="text-xs text-char font-serif mb-1 truncate" title={s.seed_title}>
                {s.seed_title}
              </div>
              <div class="text-2xs text-t3 font-mono mb-2">
                {t("paths.pane.suggestionEdges", { count: String(s.members.length), edges: String(s.internal_edges) })}
              </div>
              <div class="flex flex-wrap gap-1 mb-2">
                {#each s.member_titles.slice(0, 3) as title, i (i)}
                  <span class="px-1.5 py-0.5 bg-s2 rounded-sm text-[10px] text-t2 truncate max-w-[120px]">
                    {title}
                  </span>
                {/each}
                {#if s.member_titles.length > 3}
                  <span class="px-1.5 py-0.5 text-[10px] text-t3 italic">
                    {t("paths.pane.suggestionMore", { count: String(s.member_titles.length - 3) })}
                  </span>
                {/if}
              </div>
              <div class="flex items-center gap-1">
                <button
                  onclick={() => acceptSuggestion(s)}
                  class="px-2 py-1 bg-char text-bg rounded-sm text-2xs hover:bg-yeld transition"
                >
                  {t("paths.pane.createPath")}
                </button>
                <button
                  onclick={() => dismissSuggestion(s)}
                  class="px-2 py-1 text-2xs text-t3 hover:text-char transition"
                >
                  {t("paths.pane.dismiss")}
                </button>
              </div>
            </div>
          {/each}
          {#if !showAllSuggestions && activeSuggestions.length > SUGGESTION_VISIBLE_CAP}
            <button
              onclick={() => (showAllSuggestions = true)}
              class="shrink-0 w-[140px] bg-bg/40 border border-bd border-dashed rounded-md p-3 text-2xs text-t2 hover:text-char hover:bg-s2/40 transition flex items-center justify-center text-center"
              title={t("paths.pane.showMoreSuggestionsTitle")}
            >
              {t("paths.pane.showMoreSuggestions", { count: String(activeSuggestions.length - SUGGESTION_VISIBLE_CAP) })}
            </button>
          {/if}
          {#if showAllSuggestions && activeSuggestions.length > SUGGESTION_VISIBLE_CAP}
            <button
              onclick={() => (showAllSuggestions = false)}
              class="shrink-0 w-[140px] bg-bg/40 border border-bd border-dashed rounded-md p-3 text-2xs text-t2 hover:text-char hover:bg-s2/40 transition flex items-center justify-center text-center"
            >
              {t("paths.pane.showFewerSuggestions")}
            </button>
          {/if}
        </div>
      {/if}
      {#if showDismissed && dismissedSuggestionsList.length > 0}
        <div class="mt-2 pt-2 border-t border-bd/50">
          <div class="text-2xs text-t3 italic mb-1.5">{t("paths.pane.dismissedHeading")}</div>
          <div class="flex gap-2 overflow-x-auto pb-1">
            {#each dismissedSuggestionsList as s (s.seed_slug)}
              <div class="shrink-0 w-[280px] bg-bg/60 border border-bd2 rounded-md p-3 opacity-60 hover:opacity-100 transition">
                <div class="text-xs text-t2 font-serif mb-1 truncate" title={s.seed_title}>
                  {s.seed_title}
                </div>
                <div class="text-2xs text-t3 font-mono mb-2">
                  {t("paths.pane.suggestionEdges", { count: String(s.members.length), edges: String(s.internal_edges) })}
                </div>
                <div class="flex items-center gap-1">
                  <button
                    onclick={() => undismissSuggestion(s.seed_slug)}
                    class="px-2 py-1 text-2xs text-t2 hover:text-char border border-bd hover:border-bd2 rounded-sm transition"
                  >
                    {t("paths.pane.bringBackSuggestion")}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div
    class="flex-1 min-h-0 grid"
    style:grid-template-columns={selected ? "minmax(0,1fr) 420px" : "minmax(0,1fr)"}
  >
    <div class="relative h-full min-h-0 overflow-hidden">
      {#if onlyRoot}
        <PathsEmptyState
          currentPath={rootName}
          onCreate={async (condition) => {
            const trimmed = condition.trim();
            if (!trimmed) return;
            const name =
              trimmed
                .toLowerCase()
                .replace(/^(if\s+|what\s+if\s+)/i, "")
                .split(/\s+/)
                .slice(0, 5)
                .join("-")
                .replace(/[^a-z0-9-]/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "") || "new-path";
            try {
              await api.createPathCollection(name, trimmed, rootName);
              await refresh();
              selected = name;
            } catch (e) {
              err = String(e);
            }
          }}
        />
      {:else if viewMode === "cards"}
        <ScenarioCards
          {collections}
          {rootName}
          {notes}
          selectedPath={selected}
          onSelect={(n) => (selected = n)}
          onAddFork={startFork}
          {currentPathName}
          {divergenceByPath}
        />
      {:else}
        <ForkingRoad
          {collections}
          {rootName}
          {notes}
          selectedPath={selected}
          onSelect={(n) => (selected = n)}
          onEditCondition={startEditCondition}
          onAddFork={startFork}
          pendingForkParent={newFork?.parent ?? null}
          onCommitPendingFork={commitFork}
          onCancelPendingFork={() => (newFork = null)}
          {currentPathName}
          onDropNoteOnPath={async (pathName, slug) => {
            try {
              await api.addNoteToPathCollection(pathName, slug);
              await refresh();
              onLinksChanged?.();
            } catch (e) {
              err = String(e);
            }
          }}
        />
      {/if}
    </div>

    {#if selected && selectedCol}
      <div class="h-full min-h-0 overflow-hidden border-l border-bd">
        <PathDetail
          collection={selectedCol}
          allNotes={notes}
          isRoot={selected === rootName}
          isGhost={isGhostPath(selectedCol, rootName, collections)}
          parentName={parentOf(selected) || rootName}
          {currentPathName}
          {currentPathMembers}
          onClose={() => (selected = null)}
          onOpenNote={(slug) => onNavigate(slug)}
          onOpenMap={(focusSlug) => onOpenMap(selectedCol!.name, focusSlug)}
          onEditCondition={() => startEditCondition(selectedCol!.name, selectedCol!.condition)}
          onRename={() => handleRename(selectedCol!.name)}
          onDelete={() => handleDelete(selectedCol!.name)}
          onSetMainNote={(slug) => handleSetMainNote(selectedCol!.name, slug)}
          onSetColor={(color) => handleSetColor(selectedCol!.name, color)}
          onSetAutoTag={(tag) => handleSetAutoTag(selectedCol!.name, tag)}
          onAddNote={(slug) => handleAddNote(selectedCol!.name, slug)}
          onRemoveNote={(slug) => handleRemoveNote(selectedCol!.name, slug)}
          onBranchFromNote={(slug) => startFork(selectedCol!.name, slug)}
          onRequestPromote={() => (promoteTarget = selectedCol!.name)}
          onSetArchived={(archived) => handleSetArchived(selectedCol!.name, archived)}
        />
      </div>
    {/if}
  </div>

  {#if !onlyRoot}
    <footer class="px-6 py-2 border-t border-bd bg-s1 flex items-center gap-4 text-2xs text-t3">
      <span class="italic">{t("paths.pane.footerDrag")}</span>
      <span>·</span>
      <span class="italic">{t("paths.pane.footerClick")}</span>
      <span>·</span>
      <span class="italic">{t("paths.pane.footerBranch")}</span>
    </footer>
  {/if}

  {#if helpOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 bg-bg/70 flex items-center justify-center animate-fadeIn"
      onclick={() => (helpOpen = false)}
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="w-[min(600px,92vw)] bg-bg border border-bd2 rounded-xl shadow-2xl p-6"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="font-serif text-[22px] text-char mb-1">
          {t("paths.pane.helpTitleHeading")}
        </div>
        <div class="text-xs text-t3 italic mb-4">
          {t("paths.pane.helpIntro")}
        </div>
        <ul class="space-y-3 text-sm text-t2 leading-relaxed">
          <li>
            <strong class="font-serif text-char">{t("paths.pane.helpRootStrong")}</strong>
            {" "}{helpRootBodyParts[0]}<code class="text-yeld not-italic">{rootName}</code>{helpRootBodyParts[1] ?? ""}
          </li>
          <li>
            <strong class="font-serif text-char">{t("paths.pane.helpSelectStrong")}</strong>
            {" "}{t("paths.pane.helpSelectBody")}
          </li>
          <li>
            <strong class="font-serif text-char">{t("paths.pane.helpDetailStrong")}</strong>:
            {" "}{t("paths.pane.helpDetailBody")}
          </li>
          <li>
            <strong class="font-serif text-char">{t("paths.pane.helpMapStrong")}</strong>
            {" "}{t("paths.pane.helpMapBody")}
          </li>
          <li>
            <strong class="font-serif text-char">{t("paths.pane.helpPlusStrong")}</strong>
            {" "}{t("paths.pane.helpPlusBody")}
          </li>
        </ul>
        <div class="mt-5 text-right">
          <button
            onclick={() => (helpOpen = false)}
            class="btn-yel px-3 py-1.5 text-sm rounded-md"
          >
            {t("paths.pane.helpDone")}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if editing}
    <ConditionEditor
      branch={editing.name}
      initial={editing.initial}
      onSave={saveCondition}
      onCancel={() => (editing = null)}
    />
  {/if}

  {#if creating}
    <ConditionEditor
      branch={creating.parent}
      initial=""
      kicker={t("paths.condition.createKicker")}
      heading={t("paths.condition.createHeading")}
      lead={t("paths.condition.createLead")}
      saveLabel={t("paths.condition.createSave")}
      onSave={(condition) => {
        const c = creating;
        creating = null;
        if (c) void createPathFromCondition(c.parent, condition, c.seedSlug);
      }}
      onCancel={() => (creating = null)}
    />
  {/if}

  {#if promoteTarget}
    {@const target = promoteTarget}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 bg-char/40 flex items-center justify-center animate-fadeIn"
      onmousedown={() => (promoteTarget = null)}
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="w-[min(540px,92vw)] bg-bg border border-bd2 rounded-xl shadow-2xl p-6"
        onmousedown={(e) => e.stopPropagation()}
      >
        <div class="font-serif text-[22px] text-char mb-1">
          {promoteIsGhost ? t("paths.promote.bringBack") : t("paths.promote.promote")}
          {" "}<span class="text-yeld italic">{target}</span>
          {" "}{promoteIsGhost ? t("paths.promote.bringBackSuffix") : t("paths.promote.promoteSuffix")}
        </div>
        <p class="text-xs text-t2 italic mt-1 mb-4 leading-relaxed">
          {t("paths.promote.lead")}
        </p>
        <ul class="space-y-2 text-xs text-t2 leading-relaxed mb-4">
          {#if promoteIsGhost}
            <li>
              <strong class="text-char">
                {t("paths.promote.bringBackTrunkStrong", { name: target })}
              </strong>
              {" "}{t("paths.promote.bringBackTrunkBody")}
            </li>
            <li>
              <strong class="text-char">
                {t("paths.promote.bringBackOldStrong", { root: rootName })}
              </strong>
              {" "}{t("paths.promote.bringBackOldBody")}
            </li>
          {:else}
            <li>
              <strong class="text-char">
                {t("paths.promote.promoteTrunkStrong", { name: target })}
              </strong>
              {" "}{t("paths.promote.promoteTrunkBody", { root: rootName })}
            </li>
            <li>
              <strong class="text-char">{t("paths.promote.promoteRelStrong")}</strong>
              {" "}{t("paths.promote.promoteRelBody")}
            </li>
          {/if}
          <li>
            <strong class="text-char">{t("paths.promote.notesStayStrong")}</strong>
            {" "}{t("paths.promote.notesStayBody")}
          </li>
          <li>
            <strong class="text-char">{t("paths.promote.reversibleStrong")}</strong>
            {" "}{t("paths.promote.reversibleBody")}
          </li>
        </ul>
        <div class="text-2xs font-mono text-t3 mb-1.5 uppercase tracking-wider">
          {promoteTypeParts[0]}<span class="text-yeld">{promoteRequired}</span>{promoteTypeParts[1] ?? ""}
        </div>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          autofocus
          bind:value={promotePhrase}
          onkeydown={(e) => {
            if (e.key === "Enter" && !e.isComposing && promoteMatches) {
              const name = promoteTarget;
              promoteTarget = null;
              if (name) void handlePromote(name);
            }
          }}
          class="w-full px-3 py-2 bg-s1 border border-bd rounded-md text-char text-sm placeholder:text-t3 focus:outline-hidden focus:border-yel"
          placeholder={promoteRequired}
        />
        <div class="mt-5 flex items-center justify-end gap-2">
          <button onclick={() => (promoteTarget = null)} class="px-3 py-1.5 text-sm text-t2 hover:text-char">
            {t("paths.promote.cancel")}
          </button>
          <button
            disabled={!promoteMatches}
            onclick={() => {
              const name = promoteTarget;
              promoteTarget = null;
              if (name) void handlePromote(name);
            }}
            class="px-3 py-1.5 text-sm rounded-md bg-yel text-on-yel font-medium hover:bg-yel2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("paths.promote.confirm")}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
