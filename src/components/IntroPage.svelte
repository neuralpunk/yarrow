<script lang="ts">
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { api } from "../lib/tauri";
  import type { RecentWorkspace, WelcomeStats } from "../lib/types";
  import { APP_VERSION } from "../lib/version";
  import { language, LANGUAGE_ORDER, type LanguageCode } from "../lib/language.svelte";
  import { tr, type StringKey } from "../lib/i18n/index.svelte";
  import { SK } from "../lib/platform.svelte";
  import { formatNumber, relativeTime } from "../lib/format";
  import NewWorkspaceWizard from "./NewWorkspaceWizard.svelte";

  interface Props {
    onReady: (path: string) => void;
  }

  let { onReady }: Props = $props();
  let t = $derived(tr());

  type SortMode = "recency" | "alphabetical";

  let recent = $state<RecentWorkspace[]>([]);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let wizardOpen = $state(false);
  let showAll = $state(false);
  let selectedIdx = $state(0);
  let query = $state("");
  let sortBy = $state<SortMode>("recency");
  let searchRef = $state<HTMLInputElement | null>(null);
  let flash = $state<string | null>(null);
  let renameTarget = $state<RecentWorkspace | null>(null);
  let renameDraft = $state("");
  let renameInputRef = $state<HTMLInputElement | null>(null);

  let menuFor = $state<{ recent: RecentWorkspace; x: number; y: number } | null>(null);

  let langOpen = $state(false);
  let langTriggerRef = $state<HTMLButtonElement | null>(null);
  let langPopoverRef = $state<HTMLUListElement | null>(null);

  let dedicationKey = (() => {
    const i = Math.floor(Math.random() * 5);
    return ([
      "intro.dedications.0",
      "intro.dedications.1",
      "intro.dedications.2",
      "intro.dedications.3",
      "intro.dedications.4",
    ] as const)[i] as StringKey;
  })();

  $effect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => (flash = null), 2400);
    return () => window.clearTimeout(id);
  });

  $effect(() => {
    api.listRecentWorkspaces().then((r) => (recent = r)).catch(() => (recent = []));
  });

  // Welcome-screen stats — three quiet figures + Continue line. The
  // backend walks every recent workspace, so the cost scales with vault
  // size; we load once on mount and refresh on window focus (debounced
  // to once every 30s) so the figures stay fresh after the user closes
  // a different workspace and lands back here.
  let welcomeStats = $state<WelcomeStats | null>(null);
  let lastStatsLoad = 0;

  function loadWelcomeStats() {
    api.welcomeStats().then((s) => (welcomeStats = s)).catch(() => {});
    lastStatsLoad = Date.now();
  }

  $effect(() => {
    loadWelcomeStats();
    const onFocus = () => {
      if (Date.now() - lastStatsLoad > 30_000) loadWelcomeStats();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  });

  let hasStats = $derived(
    !!welcomeStats &&
      (welcomeStats.notes_this_month > 0 ||
        welcomeStats.day_streak > 0 ||
        welcomeStats.words_this_month > 0),
  );

  function statLabel(
    n: number,
    singularKey: StringKey,
    pluralKey: StringKey,
  ): string {
    return n === 1 ? t(singularKey) : t(pluralKey);
  }

  async function openContinue() {
    if (!welcomeStats?.continue_note) return;
    await openRecent(welcomeStats.continue_note.workspace_path);
  }

  let filteredSorted = $derived.by(() => {
    const qq = query.trim().toLowerCase();
    let list = recent;
    if (qq) {
      list = list.filter((r) =>
        r.name.toLowerCase().includes(qq) ||
        r.path.toLowerCase().includes(qq),
      );
    }
    if (sortBy === "alphabetical") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }
    return list;
  });

  let visibleRecents = $derived(showAll ? filteredSorted : filteredSorted.slice(0, 4));
  let overflowCount = $derived(filteredSorted.length);
  let showSearchBar = $derived(recent.length > 4);
  let isReturning = $derived(recent.length > 0);

  async function openRecent(path: string) {
    error = null;
    busy = true;
    try {
      await api.openWorkspace(path);
      onReady(path);
    } catch (e) {
      error = String(e);
      await api.forgetRecentWorkspace(path).catch(() => {});
      recent = await api.listRecentWorkspaces();
    } finally {
      busy = false;
    }
  }

  async function pickFolder() {
    error = null;
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (!selected || Array.isArray(selected)) return;
      busy = true;
      await api.openWorkspace(selected);
      onReady(selected);
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }

  async function removeRecent(path: string) {
    await api.forgetRecentWorkspace(path);
    const next = await api.listRecentWorkspaces();
    recent = next;
    if (selectedIdx >= next.length) selectedIdx = Math.max(0, next.length - 1);
  }

  async function copyPathToClipboard(path: string) {
    try {
      await navigator.clipboard.writeText(path);
      flash = t("intro.recent.copied");
    } catch {
      flash = path;
    }
  }

  async function commitRename(target: RecentWorkspace, name: string) {
    error = null;
    try {
      await api.renameRecentWorkspace(target.path, name);
      const next = await api.listRecentWorkspaces();
      recent = next;
      renameTarget = null;
    } catch (e) {
      error = t("intro.recent.renameError", { error: String(e) });
    }
  }

  $effect(() => {
    if (selectedIdx >= visibleRecents.length) {
      selectedIdx = Math.max(0, visibleRecents.length - 1);
    }
  });

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wizardOpen) return;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "n") {
        e.preventDefault();
        wizardOpen = true;
        return;
      }
      if (e.key === "/" && showSearchBar && document.activeElement !== searchRef) {
        e.preventDefault();
        searchRef?.focus();
        searchRef?.select();
        return;
      }
      if (visibleRecents.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIdx = Math.min(visibleRecents.length - 1, selectedIdx + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIdx = Math.max(0, selectedIdx - 1);
      } else if (e.key === "Enter") {
        const target = visibleRecents[selectedIdx];
        if (target) {
          e.preventDefault();
          openRecent(target.path);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Rename modal effects
  $effect(() => {
    if (!renameTarget) return;
    renameDraft = renameTarget.name;
    const id = window.setTimeout(() => {
      renameInputRef?.focus();
      renameInputRef?.select();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") renameTarget = null;
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  });

  // Context menu close
  $effect(() => {
    if (!menuFor) return;
    const onDocClick = () => (menuFor = null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") menuFor = null;
    };
    window.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  });

  $effect(() => {
    if (!langOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (langTriggerRef?.contains(e.target as Node) || langPopoverRef?.contains(e.target as Node)) return;
      langOpen = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") langOpen = false;
    };
    window.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  });

  function displayPath(absolute: string): string {
    return absolute
      .replace(/^\/home\/[^/]+/, "~")
      .replace(/^\/Users\/[^/]+/, "~");
  }

  function relativeTimeI18n(iso: string | number | null | undefined): string {
    if (!iso) return "";
    const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return t("intro.time.justNow");
    if (diff < 86400 * 2) return t("intro.time.yesterday");
    if (diff < 86400 * 7) return t("intro.time.daysAgo", { n: String(Math.floor(diff / 86400)) });
    if (diff < 86400 * 14) return t("intro.time.lastWeek");
    if (diff < 86400 * 21) return t("intro.time.weeksAgo", { n: String(Math.floor(diff / (86400 * 7))) });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  async function revealRecent(path: string) {
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(path);
    } catch {}
    menuFor = null;
  }

  let trimmedRenameDraft = $derived(renameDraft.trim());
  let canSaveRename = $derived(!!renameTarget && trimmedRenameDraft.length > 0 && trimmedRenameDraft !== renameTarget.name);
</script>

{#snippet kbdPair(keyLabel: string, hint: string)}
  <span style:display="inline-flex" style:align-items="center">
    <kbd
      class="yarrow-intro-mono"
      style:background="var(--i-key-bg)"
      style:border="1px solid var(--i-rule-strong)"
      style:padding="2px 6px"
      style:border-radius="4px"
      style:margin-right="6px"
      style:font-size="10.5px"
      style:color="var(--i-ink)"
      style:letter-spacing="0.04em"
    >
      {keyLabel}
    </kbd>
    <span>{hint}</span>
  </span>
{/snippet}

{#snippet ctxItem(icon: import("svelte").Snippet, label: string, onClick: (e: MouseEvent) => void, danger: boolean)}
  <button
    type="button"
    role="menuitem"
    onclick={onClick}
    class="yarrow-intro-figtree text-left w-full inline-flex items-center"
    style:background="transparent"
    style:border="0"
    style:padding="8px 14px"
    style:color={danger ? "var(--danger, #b04646)" : "var(--i-ink)"}
    style:font-size="13px"
    style:cursor="pointer"
    style:gap="10px"
  >
    <span aria-hidden="true" style:display="inline-flex" style:width="16px" style:height="16px" style:color={danger ? "var(--danger, #b04646)" : "var(--i-ink)"}>
      {@render icon()}
    </span>
    <span>{label}</span>
  </button>
{/snippet}

{#snippet iconClipboard()}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="3" width="8" height="11" rx="1" />
    <path d="M6 3v-.5A1.5 1.5 0 0 1 7.5 1h1A1.5 1.5 0 0 1 10 2.5V3" />
  </svg>
{/snippet}
{#snippet iconPencil()}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11z" />
    <path d="M9.5 4l2.5 2.5" />
  </svg>
{/snippet}
{#snippet iconFolderOpen()}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12V4a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1v1" />
    <path d="M2 12l1.6-4.5a1 1 0 0 1 .94-.7H14a.6.6 0 0 1 .57.79L13 12.4a1 1 0 0 1-.94.6H3a1 1 0 0 1-1-1z" />
  </svg>
{/snippet}
{#snippet iconWindow()}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="12" height="10" rx="1" />
    <path d="M2 6h12" />
  </svg>
{/snippet}
{#snippet iconCloseSvg()}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
{/snippet}
{#snippet iconKebab()}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="8" cy="3.2" r="1.3" />
    <circle cx="8" cy="8" r="1.3" />
    <circle cx="8" cy="12.8" r="1.3" />
  </svg>
{/snippet}

<div class="yarrow-intro h-full overflow-auto" role="main">
  <div class="grid min-h-full" style:grid-template-columns="1.2fr 1fr">
    <!-- Title slab -->
    <div
      class="flex flex-col"
      style:padding-top={isReturning ? "72px" : "92px"}
      style:padding-left="72px"
      style:padding-right="48px"
      style:padding-bottom="56px"
      style:justify-content="space-between"
    >
      <div>
        <div class="yarrow-intro-mono uppercase" style:font-size="11px" style:letter-spacing="0.18em" style:color="var(--i-mute)" style:margin-bottom="18px">
          {t("intro.tagline")}
        </div>
        <div class="flex items-baseline" style:gap="14px">
          <span class="yarrow-intro-mark" style:font-size={isReturning ? "78px" : "120px"}>yarrow</span>
          <span class="yarrow-intro-mono" style:font-size={isReturning ? "15px" : "19px"} style:color="var(--i-accent)" style:border="1px solid var(--i-accent)" style:padding="3px 8px" style:border-radius="999px" style:background="transparent">
            v{APP_VERSION}
          </span>
        </div>
        <div aria-hidden="true" style:width="64px" style:height="2px" style:background="var(--i-accent)" style:margin={isReturning ? "18px 0 16px" : "26px 0 22px"}></div>
        <p class="yarrow-intro-dedication" style:font-size={isReturning ? "19px" : "26px"} style:max-width="22ch" style:margin="0">
          {t(dedicationKey)}
        </p>
      </div>
      <div class="flex flex-col">
        {#if welcomeStats && hasStats}
          <div class="welcome-stats" aria-label={t("intro.tagline")}>
            <div class="welcome-stat">
              <span class="welcome-stat-figure">{formatNumber(welcomeStats.notes_this_month)}</span>
              <span class="welcome-stat-label">
                {statLabel(welcomeStats.notes_this_month, "intro.stats.notesThisMonthSingular", "intro.stats.notesThisMonthPlural")}
              </span>
            </div>
            <div class="welcome-stat">
              <span class="welcome-stat-figure">{formatNumber(welcomeStats.day_streak)}</span>
              <span class="welcome-stat-label">
                {statLabel(welcomeStats.day_streak, "intro.stats.dayStreakSingular", "intro.stats.dayStreakPlural")}
              </span>
            </div>
            <div class="welcome-stat">
              <span class="welcome-stat-figure">{formatNumber(welcomeStats.words_this_month)}</span>
              <span class="welcome-stat-label">
                {statLabel(welcomeStats.words_this_month, "intro.stats.wordsThisMonthSingular", "intro.stats.wordsThisMonthPlural")}
              </span>
            </div>
          </div>
        {/if}

        {#if welcomeStats?.continue_note}
          <button
            type="button"
            class="welcome-continue"
            onclick={openContinue}
            disabled={busy}
            aria-label={t("intro.continue.aria")
              .replace("{title}", welcomeStats.continue_note.note_title)
              .replace("{workspace}", welcomeStats.continue_note.workspace_name)}
          >
            <span class="welcome-continue-arrow" aria-hidden="true">→</span>
            <span class="welcome-continue-verb">{t("intro.continue.verb")}</span>
            <span class="welcome-continue-name">{welcomeStats.continue_note.note_title}</span>
            <span class="welcome-continue-time">{relativeTime(welcomeStats.continue_note.modified)}</span>
          </button>
        {/if}

        <div class="flex items-baseline" style:gap="28px" style:flex-wrap="wrap" style:margin-top="32px">
        <button
          type="button"
          onclick={() => { error = null; wizardOpen = true; }}
          disabled={busy}
          class="yarrow-intro-figtree inline-flex items-center"
          style:background="var(--i-ink-2)"
          style:color="var(--i-ink-on-btn)"
          style:border="0"
          style:padding="12px 22px"
          style:border-radius="999px"
          style:font-size="14px"
          style:font-weight="500"
          style:gap="10px"
          style:cursor={busy ? "not-allowed" : "pointer"}
          style:opacity={busy ? 0.6 : 1}
          style:transition="transform 120ms ease"
        >
          <span aria-hidden="true" style:width="6px" style:height="6px" style:border-radius="999px" style:background="var(--i-accent-soft)" style:display="inline-block"></span>
          {t("intro.actions.new")}
        </button>
        <button
          type="button"
          onclick={pickFolder}
          disabled={busy}
          class="yarrow-intro-figtree"
          style:background="transparent"
          style:border="1px solid var(--i-rule-strong)"
          style:border-radius="999px"
          style:padding="11px 22px"
          style:color="var(--i-ink)"
          style:font-size="14px"
          style:font-weight="500"
          style:cursor={busy ? "not-allowed" : "pointer"}
          style:opacity={busy ? 0.6 : 1}
          style:transition="background 120ms ease, border-color 120ms ease"
        >
          {t("intro.actions.open")}
        </button>
        </div>
      </div>
    </div>

    <!-- Right column -->
    <div class="relative flex flex-col" style:padding-top="92px" style:padding-left="64px" style:padding-right="64px" style:padding-bottom="56px" style:border-left="1px solid var(--i-rule-strong)">
      {#if recent.length === 0}
        <div class="flex flex-col items-center justify-center text-center" style:flex="1">
          <p class="yarrow-intro-dedication" style:font-size="20px" style:margin-bottom="20px">
            {t("intro.empty.title")}
          </p>
          <button
            type="button"
            onclick={() => (wizardOpen = true)}
            class="yarrow-intro-figtree inline-flex items-center"
            style:background="var(--i-ink-2)"
            style:color="var(--i-ink-on-btn)"
            style:border="0"
            style:padding="12px 22px"
            style:border-radius="999px"
            style:font-size="14px"
            style:font-weight="500"
            style:gap="10px"
            style:cursor="pointer"
          >
            <span aria-hidden="true" style:width="6px" style:height="6px" style:border-radius="999px" style:background="var(--i-accent-soft)" style:display="inline-block"></span>
            {t("intro.actions.new")}
          </button>
        </div>
      {:else}
        <div>
          <div class="yarrow-intro-mono uppercase" style:font-size="10.5px" style:letter-spacing="0.20em" style:color="var(--i-mute)" style:margin-bottom={showSearchBar ? "14px" : "22px"}>
            {t("intro.recentEyebrow")}
          </div>

          {#if showSearchBar}
            <div class="yarrow-intro-figtree" style:display="flex" style:align-items="center" style:gap="12px" style:margin-bottom="18px">
              <input
                bind:this={searchRef}
                type="search"
                bind:value={query}
                onkeydown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    query = "";
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                placeholder={t("intro.search.placeholder")}
                aria-label={t("intro.search.aria")}
                class="yarrow-intro-figtree"
                style:flex="1"
                style:min-width="0"
                style:background="var(--i-key-bg)"
                style:border="1px solid var(--i-rule)"
                style:border-radius="6px"
                style:padding="8px 12px"
                style:font-size="13px"
                style:color="var(--i-ink)"
                style:outline="none"
              />
              <select
                bind:value={sortBy}
                aria-label={t("intro.sort.aria")}
                class="yarrow-intro-figtree"
                style:background="transparent"
                style:border="1px solid var(--i-rule)"
                style:border-radius="6px"
                style:padding="8px 10px"
                style:font-size="12.5px"
                style:color="var(--i-ink)"
                style:cursor="pointer"
              >
                <option value="recency">{t("intro.sort.recency")}</option>
                <option value="alphabetical">{t("intro.sort.alphabetical")}</option>
              </select>
            </div>
          {/if}

          {#if visibleRecents.length === 0 && query.trim()}
            <div class="yarrow-intro-figtree italic" style:font-size="13.5px" style:color="var(--i-mute)" style:padding="16px 0" role="status">
              {t("intro.search.noMatches", { query: query.trim() })}
            </div>
          {:else}
            <ul style:list-style="none" style:margin="0" style:padding="0">
              {#each visibleRecents as r, i (r.path)}
                {@const numeral = String(i + 1).padStart(2, "0")}
                {@const display = displayPath(r.path)}
                {@const when = relativeTimeI18n(r.last_opened)}
                {@const selected = i === selectedIdx}
                {@const isLast = i === visibleRecents.length - 1}
                <li style:position="relative">
                  <button
                    type="button"
                    disabled={busy}
                    onmouseenter={() => (selectedIdx = i)}
                    onclick={() => openRecent(r.path)}
                    oncontextmenu={(e) => {
                      e.preventDefault();
                      menuFor = { recent: r, x: e.clientX, y: e.clientY };
                    }}
                    aria-label={t("intro.recent.openAria", { name: r.name, when })}
                    class="grid w-full text-left yarrow-intro-figtree"
                    style:grid-template-columns="32px 1fr auto 36px"
                    style:align-items="center"
                    style:gap="12px"
                    style:padding="14px 14px"
                    style:border-radius="10px"
                    style:background={selected ? "var(--i-row-selected)" : "transparent"}
                    style:box-shadow={selected ? "inset 3px 0 0 var(--i-accent)" : "none"}
                    style:border="0"
                    style:cursor={busy ? "not-allowed" : "pointer"}
                    style:transition="background 120ms ease, box-shadow 120ms ease"
                  >
                    <span aria-hidden="true" class="yarrow-intro-mono" style:font-size="12px" style:color={selected ? "var(--i-ink)" : "var(--i-accent)"}>
                      {numeral}
                    </span>
                    <span style:min-width="0">
                      <span class="yarrow-intro-name block" style:font-size="22px">{r.name}</span>
                      <span class="yarrow-intro-mono block truncate" style:font-size="11px" style:color="var(--i-mute)" style:margin-top="3px">
                        {display}
                      </span>
                    </span>
                    <span class="yarrow-intro-figtree italic" style:font-size="11.5px" style:color="var(--i-mute)" style:text-align="right" style:white-space="nowrap">
                      {when}
                    </span>
                    <span aria-hidden="true" style:width="36px"></span>
                  </button>
                  <button
                    type="button"
                    aria-label={t("intro.recent.menuAria", { name: r.name })}
                    onclick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      const menuWidth = 220;
                      const x = Math.max(8, rect.right - menuWidth);
                      const y = rect.bottom + 4;
                      menuFor = { recent: r, x, y };
                    }}
                    style:position="absolute"
                    style:top="50%"
                    style:right="8px"
                    style:transform="translateY(-50%)"
                    style:width="28px"
                    style:height="28px"
                    style:display="inline-flex"
                    style:align-items="center"
                    style:justify-content="center"
                    style:background="transparent"
                    style:border="0"
                    style:border-radius="6px"
                    style:color="var(--i-mute)"
                    style:cursor={busy ? "not-allowed" : "pointer"}
                    style:transition="background 120ms ease, color 120ms ease"
                  >
                    {@render iconKebab()}
                  </button>
                  {#if !isLast}
                    <div aria-hidden="true" style:height="1px" style:background="var(--i-rule)" style:margin="0 8px"></div>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}

          {#if !showAll && overflowCount > 4}
            <button
              type="button"
              onclick={() => (showAll = true)}
              class="yarrow-intro-figtree"
              style:background="transparent"
              style:border="0"
              style:padding="0"
              style:color="var(--i-mute)"
              style:font-size="12px"
              style:margin-top="12px"
              style:text-decoration="underline"
              style:text-decoration-style="dotted"
              style:text-underline-offset="4px"
              style:cursor="pointer"
            >
              {t("intro.recents.showAll", { count: String(overflowCount) })}
            </button>
          {/if}
        </div>
      {/if}

      <div class="mt-auto pt-12">
        <div class="yarrow-intro-mono" style:display="flex" style:justify-content="space-between" style:align-items="center" style:gap="24px" style:font-size="10.5px" style:color="var(--i-mute)" style:letter-spacing="0.08em" aria-label={t("intro.kbd.aria")}>
          <div style:display="flex" style:align-items="center" style:gap="14px" style:flex-wrap="wrap">
            {@render kbdPair("↑↓", t("intro.kbd.navigate"))}
            {@render kbdPair("↵", t("intro.kbd.open"))}
            {@render kbdPair(SK.newNote, t("intro.kbd.new"))}
          </div>
          <div style:position="relative">
            <button
              bind:this={langTriggerRef}
              type="button"
              onclick={() => (langOpen = !langOpen)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t("intro.lang.aria")}
              class="yarrow-intro-mono uppercase"
              style:background="transparent"
              style:border="0"
              style:padding="4px 8px"
              style:border-radius="4px"
              style:font-size="10.5px"
              style:color="var(--i-mute)"
              style:letter-spacing="0.08em"
              style:cursor="pointer"
            >
              {language.lang} ▾
            </button>
            {#if langOpen}
              <ul
                bind:this={langPopoverRef}
                role="listbox"
                aria-label={t("intro.lang.picker")}
                class="yarrow-intro-figtree"
                style:position="absolute"
                style:bottom="100%"
                style:right="0"
                style:margin-bottom="6px"
                style:background="var(--i-paper)"
                style:border="1px solid var(--i-rule-strong)"
                style:border-radius="6px"
                style:box-shadow="0 8px 24px -8px rgba(31,26,8,0.2)"
                style:min-width="160px"
                style:padding="6px 0"
                style:margin="0"
                style:list-style="none"
                style:z-index="50"
              >
                {#each LANGUAGE_ORDER as l (l.id)}
                  <li
                    role="option"
                    aria-selected={l.id === language.lang}
                    onclick={() => {
                      language.set(l.id as LanguageCode);
                      langOpen = false;
                    }}
                    onkeydown={(e) => {
                      if (e.key === "Enter") {
                        language.set(l.id as LanguageCode);
                        langOpen = false;
                      }
                    }}
                    class="yarrow-intro-figtree"
                    style:padding="7px 14px"
                    style:font-size="13px"
                    style:color="var(--i-ink)"
                    style:cursor="pointer"
                    style:display="flex"
                    style:align-items="center"
                    style:justify-content="space-between"
                    style:gap="12px"
                    tabindex="0"
                  >
                    <span>
                      <span style:font-weight="500">{l.id.toUpperCase()}</span>
                      <span style:margin-left="8px">— {l.label}</span>
                    </span>
                    {#if l.id === language.lang}
                      <span aria-hidden="true" style:width="6px" style:height="6px" style:border-radius="999px" style:background="var(--i-accent)"></span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if error}
    <div class="yarrow-intro-figtree absolute" style:bottom="24px" style:left="64px" style:color="#a04a4a" style:font-size="13px" role="alert">
      {error}
    </div>
  {/if}

  <NewWorkspaceWizard
    open={wizardOpen}
    onClose={() => (wizardOpen = false)}
    onReady={(p) => { wizardOpen = false; onReady(p); }}
    firstRun={recent.length === 0}
  />

  {#if renameTarget}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
      style:background="rgba(31,26,8,0.30)"
      onclick={() => (renameTarget = null)}
      role="presentation"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="yarrow-intro yarrow-intro-figtree"
        style:background="var(--i-paper)"
        style:border="1px solid var(--i-rule-strong)"
        style:border-radius="10px"
        style:padding="22px 24px"
        style:min-width="440px"
        style:max-width="520px"
        style:color="var(--i-ink)"
        style:box-shadow="0 18px 48px -16px rgba(31,26,8,0.36)"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("intro.recent.renamePromptTitle", { name: renameTarget.name })}
        tabindex="-1"
      >
        <div class="yarrow-intro-mark" style:font-size="22px" style:margin-bottom="14px">
          {t("intro.recent.renamePromptTitle", { name: renameTarget.name })}
        </div>
        <input
          bind:this={renameInputRef}
          type="text"
          bind:value={renameDraft}
          onkeydown={(e) => {
            if (e.key === "Enter" && canSaveRename && renameTarget) {
              e.preventDefault();
              void commitRename(renameTarget, trimmedRenameDraft);
            }
          }}
          class="yarrow-intro-figtree"
          style:width="100%"
          style:background="var(--i-key-bg)"
          style:border="1px solid var(--i-rule)"
          style:border-radius="6px"
          style:padding="9px 12px"
          style:font-size="14px"
          style:color="var(--i-ink)"
          style:outline="none"
          style:margin-bottom="10px"
        />
        <p class="yarrow-intro-figtree" style:font-size="12px" style:color="var(--i-mute)" style:line-height="1.55" style:margin="0 0 18px">
          {t("intro.recent.renamePromptHelp")}
        </p>
        <div style:display="flex" style:justify-content="flex-end" style:gap="8px">
          <button
            type="button"
            onclick={() => (renameTarget = null)}
            class="yarrow-intro-figtree"
            style:background="transparent"
            style:border="1px solid var(--i-rule-strong)"
            style:color="var(--i-ink)"
            style:border-radius="999px"
            style:padding="8px 16px"
            style:font-size="13px"
            style:cursor="pointer"
          >
            {t("intro.recent.renamePromptCancel")}
          </button>
          <button
            type="button"
            disabled={!canSaveRename}
            onclick={() => { if (renameTarget) void commitRename(renameTarget, trimmedRenameDraft); }}
            class="yarrow-intro-figtree"
            style:background="var(--i-ink-2)"
            style:color="var(--i-ink-on-btn)"
            style:border="0"
            style:border-radius="999px"
            style:padding="8px 18px"
            style:font-size="13px"
            style:font-weight="500"
            style:cursor={canSaveRename ? "pointer" : "not-allowed"}
            style:opacity={canSaveRename ? 1 : 0.5}
          >
            {t("intro.recent.renamePromptSave")}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if flash}
    <div
      class="yarrow-intro-figtree fixed"
      role="status"
      aria-live="polite"
      style:bottom="24px"
      style:left="50%"
      style:transform="translateX(-50%)"
      style:background="var(--i-ink)"
      style:color="var(--i-paper)"
      style:padding="9px 16px"
      style:border-radius="999px"
      style:font-size="12.5px"
      style:box-shadow="0 12px 28px -10px rgba(31,26,8,0.32)"
      style:z-index="60"
    >
      {flash}
    </div>
  {/if}

  {#if menuFor}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="yarrow-intro-figtree fixed z-50"
      style:top="{menuFor.y}px"
      style:left="{menuFor.x}px"
      style:background="var(--i-paper)"
      style:border="1px solid var(--i-rule-strong)"
      style:border-radius="8px"
      style:box-shadow="0 12px 28px -10px rgba(31,26,8,0.28)"
      style:min-width="220px"
      style:padding="6px 0"
      style:font-size="13px"
      style:color="var(--i-ink)"
      onclick={(e) => e.stopPropagation()}
      role="menu"
      tabindex="-1"
    >
      {@render ctxItem(iconClipboard, t("intro.recent.contextCopyPath"), (e) => { e.stopPropagation(); if (menuFor) { void copyPathToClipboard(menuFor.recent.path); menuFor = null; } }, false)}
      {@render ctxItem(iconPencil, t("intro.recent.contextRename"), (e) => { e.stopPropagation(); if (menuFor) { renameTarget = menuFor.recent; menuFor = null; } }, false)}
      {@render ctxItem(iconFolderOpen, t("intro.recent.contextReveal"), (e) => { e.stopPropagation(); if (menuFor) void revealRecent(menuFor.recent.path); }, false)}
      {@render ctxItem(iconWindow, t("intro.recent.contextOpenInNewWindow"), (e) => { e.stopPropagation(); if (menuFor) { void openRecent(menuFor.recent.path); menuFor = null; } }, false)}
      <div aria-hidden="true" style:height="1px" style:margin="5px 0" style:background="var(--i-rule)"></div>
      {@render ctxItem(iconCloseSvg, t("intro.recent.contextRemove"), (e) => { e.stopPropagation(); if (menuFor) { void removeRecent(menuFor.recent.path); menuFor = null; } }, true)}
    </div>
  {/if}
</div>
