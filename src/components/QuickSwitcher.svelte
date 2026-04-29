<script lang="ts">
  import type { NoteSummary } from "../lib/types";
  import { SearchIcon, EnterKeyIcon, NoteIcon } from "../lib/iconsSvelte";
  import { SK } from "../lib/platform.svelte";
  import { tr } from "../lib/i18n/index.svelte";
  import Kbd from "./Kbd.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    notes: NoteSummary[];
    activeSlug: string | null;
    onSelect: (slug: string) => void;
  }

  let { open, onClose, notes, activeSlug, onSelect }: Props = $props();
  let t = $derived(tr());

  let q = $state("");
  let cursor = $state(0);
  let inputRef = $state<HTMLInputElement | null>(null);
  let listRef = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!open) return;
    q = "";
    cursor = 0;
    const id = window.setTimeout(() => inputRef?.focus(), 30);
    return () => window.clearTimeout(id);
  });

  let matches = $derived.by(() => {
    const trimmed = q.trim();
    if (!trimmed) {
      return notes
        .filter((n) => n.slug !== activeSlug)
        .slice(0, 50)
        .map((n) => ({ note: n, score: 0 }));
    }
    const scored = notes
      .map((n) => ({ note: n, score: fuzzyScore(trimmed, n.title || n.slug) }))
      .filter((x) => x.score >= 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20);
  });

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        cursor = Math.min(matches.length - 1, cursor + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        cursor = Math.max(0, cursor - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = matches[cursor];
        if (pick) {
          onSelect(pick.note.slug);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  $effect(() => {
    if (!listRef) return;
    listRef
      .querySelector<HTMLDivElement>(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });

  function fuzzyScore(query: string, target: string): number {
    const lq = query.toLowerCase();
    const lt = target.toLowerCase();
    if (!lq) return 0;
    const idx = lt.indexOf(lq);
    if (idx !== -1) return 10000 - idx + (idx === 0 ? 500 : 0);
    let ti = 0;
    let streak = 0;
    let bestStreak = 0;
    let lastMatch = -1;
    for (let qi = 0; qi < lq.length; qi++) {
      let found = false;
      while (ti < lt.length) {
        if (lt[ti] === lq[qi]) {
          if (lastMatch === ti - 1) streak++;
          else streak = 1;
          bestStreak = Math.max(bestStreak, streak);
          lastMatch = ti;
          ti++;
          found = true;
          break;
        }
        ti++;
      }
      if (!found) return -1;
    }
    return 500 + bestStreak * 80 - lastMatch;
  }

  function highlightSplit(target: string, query: string) {
    const lq = query.trim().toLowerCase();
    if (!lq) return { pre: target, mid: "", post: "" };
    const idx = target.toLowerCase().indexOf(lq);
    if (idx === -1) return { pre: target, mid: "", post: "" };
    return {
      pre: target.slice(0, idx),
      mid: target.slice(idx, idx + lq.length),
      post: target.slice(idx + lq.length),
    };
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-char/20 pt-28 animate-fadeIn"
    onmousedown={onClose}
    role="presentation"
  >
    <div
      class="w-[520px] max-w-[92vw] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden animate-slideUp"
      onmousedown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="flex items-center px-4 py-3 border-b border-bd">
        <span class="text-t3 mr-2"><SearchIcon size={16} weight="light" /></span>
        <input
          bind:this={inputRef}
          bind:value={q}
          oninput={() => { cursor = 0; }}
          placeholder={t("modals.quickSwitcher.placeholder")}
          class="flex-1 bg-transparent outline-hidden text-char placeholder:text-t3 text-base"
        />
        <Kbd>{#snippet children()}esc{/snippet}</Kbd>
      </div>

      <div bind:this={listRef} class="max-h-[380px] overflow-y-auto py-1">
        {#if matches.length === 0}
          <div class="px-4 py-8 text-center text-sm text-t3">
            {t("modals.quickSwitcher.noMatch", { query: q })}
          </div>
        {:else}
          {#each matches as m, i (m.note.slug)}
            {@const parts = highlightSplit(m.note.title || m.note.slug, q)}
            <div
              data-idx={i}
              onmouseenter={() => { cursor = i; }}
              onclick={() => { onSelect(m.note.slug); onClose(); }}
              class="flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors {i === cursor ? 'bg-yelp' : ''}"
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(m.note.slug);
                  onClose();
                }
              }}
            >
              <span class="shrink-0 {i === cursor ? 'text-yeld' : 'text-t3'}">
                <NoteIcon size={14} weight="light" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-char truncate">
                  {parts.pre}<span class="text-yeld font-medium">{parts.mid}</span>{parts.post}
                </div>
                {#if m.note.excerpt}
                  <div class="text-2xs text-t3 truncate">{m.note.excerpt}</div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="px-4 py-2 border-t border-bd bg-s1 text-2xs text-t3 flex items-center gap-3">
        <span class="inline-flex items-center gap-1.5">
          <Kbd>{#snippet children()}↑↓{/snippet}</Kbd>
          {t("modals.quickSwitcher.move")}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <Kbd>{#snippet children()}<EnterKeyIcon weight="light" />{/snippet}</Kbd>
          {t("modals.quickSwitcher.openLabel")}
        </span>
        <span class="ml-auto inline-flex items-center gap-1.5">
          <Kbd>{#snippet children()}{SK.quickSwitch}{/snippet}</Kbd>
          {t("modals.quickSwitcher.toggle")}
        </span>
      </div>
    </div>
  </div>
{/if}
