<script lang="ts">
  import { api } from "../lib/tauri";
  import type { FindReplaceHit } from "../lib/types";
  import { tr } from "../lib/i18n/index.svelte";

  type Scope = "workspace" | "path";

  interface Props {
    open: boolean;
    onClose: () => void;
    currentPathSlugs?: string[] | null;
    currentPathName?: string;
    onChanged: (report: { changed: number; total: number }) => void;
    initialPattern?: string;
  }

  let { open, onClose, currentPathSlugs, currentPathName, onChanged, initialPattern }: Props =
    $props();
  let t = $derived(tr());

  let pattern = $state("");
  $effect(() => {
    if (open && initialPattern && !pattern) pattern = initialPattern;
  });
  let replacement = $state("");
  let caseInsensitive = $state(true);
  let scope = $state<Scope>("workspace");
  let hits = $state<FindReplaceHit[] | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let confirming = $state(false);
  let inputRef = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (open) {
      error = null;
      const id = window.setTimeout(() => inputRef?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  });

  $effect(() => {
    if (!open) return;
    const p = pattern;
    if (!p) {
      hits = null;
      return;
    }
    const ci = caseInsensitive;
    const sc = scope;
    const slugs = currentPathSlugs;
    const tid = setTimeout(async () => {
      loading = true;
      error = null;
      try {
        const slugList = sc === "path" ? (slugs ?? []) : null;
        hits = await api.findReplacePreview(p, false, ci, slugList);
      } catch (e) {
        error = String(e);
        hits = null;
      } finally {
        loading = false;
      }
    }, 300);
    return () => clearTimeout(tid);
  });

  let totalMatches = $derived((hits ?? []).reduce((a, h) => a + h.matches, 0));

  async function apply() {
    if (!hits || hits.length === 0) return;
    busy = true;
    error = null;
    try {
      const slugs = scope === "path" ? (currentPathSlugs ?? []) : null;
      const report = await api.findReplaceApply(
        pattern,
        replacement,
        false,
        caseInsensitive,
        slugs,
      );
      confirming = false;
      onClose();
      onChanged({
        changed: report.notes_changed,
        total: report.total_replacements,
      });
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
    onmousedown={onClose}
    role="presentation"
  >
    <div
      onmousedown={(e) => e.stopPropagation()}
      class="relative w-full max-w-2xl max-h-[85vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="px-5 py-4 border-b border-bd">
        <div class="font-serif text-xl text-char">{t("modals.find.title")}</div>
        <div class="text-2xs text-t3 mt-0.5">{t("modals.find.subtitle")}</div>
      </div>

      <div class="px-5 py-4 space-y-3 border-b border-bd">
        <div>
          <label class="text-2xs text-t3 uppercase tracking-wider font-mono" for="fr-find">
            {t("modals.find.findLabel")}
          </label>
          <input
            id="fr-find"
            bind:this={inputRef}
            bind:value={pattern}
            placeholder={t("modals.find.findPlaceholder")}
            class="mt-1 w-full px-3 py-2 bg-s1 border border-bd rounded-sm text-sm text-char outline-hidden focus:border-yel"
          />
        </div>
        <div>
          <label class="text-2xs text-t3 uppercase tracking-wider font-mono" for="fr-replace">
            {t("modals.find.replaceLabel")}
          </label>
          <input
            id="fr-replace"
            bind:value={replacement}
            placeholder={t("modals.find.replacePlaceholder")}
            class="mt-1 w-full px-3 py-2 bg-s1 border border-bd rounded-sm text-sm text-char outline-hidden focus:border-yel"
          />
        </div>
        <div class="flex items-center gap-4 text-xs flex-wrap">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" bind:checked={caseInsensitive} />
            <span class="text-t2">{t("modals.find.caseInsensitive")}</span>
          </label>
          <div class="flex items-center gap-1.5 ml-auto">
            <span class="text-t3">{t("modals.find.scopeLabel")}</span>
            <select bind:value={scope} class="bg-s1 border border-bd rounded-sm px-2 py-1 text-xs text-char">
              <option value="workspace">{t("modals.find.scopeWorkspace")}</option>
              {#if currentPathSlugs}
                <option value="path">
                  {t("modals.find.scopePath", {
                    name: currentPathName ?? t("modals.find.scopePathFallback"),
                  })}
                </option>
              {/if}
            </select>
          </div>
        </div>
      </div>

      {#if error}
        <div class="px-5 py-2 text-xs text-danger bg-danger/10 border-b border-bd">
          {error}
        </div>
      {/if}

      <div class="overflow-y-auto flex-1 px-5 py-3 text-xs">
        {#if !pattern}
          <div class="text-t3 italic font-serif text-center py-8">
            {t("modals.find.enterTerm")}
          </div>
        {:else if loading}
          <div class="text-t3 italic text-center py-8">{t("modals.find.searching")}</div>
        {:else if !hits || hits.length === 0}
          <div class="text-t3 italic text-center py-8">{t("modals.find.noMatches")}</div>
        {:else}
          <ul class="space-y-3">
            {#each hits as h (h.slug)}
              <li class="border border-bd rounded-sm p-2.5">
                <div class="flex items-baseline justify-between gap-2">
                  <div class="text-sm text-char truncate">{h.title}</div>
                  <div class="text-2xs text-t3 font-mono shrink-0">
                    {h.matches === 1
                      ? t("modals.find.matchSingular", { count: String(h.matches) })
                      : t("modals.find.matchPlural", { count: String(h.matches) })}
                  </div>
                </div>
                <div class="mt-1.5 space-y-0.5 font-mono text-2xs text-t2">
                  {#each h.samples as sample, i (i)}
                    <div class="truncate">
                      <span class="text-t3 mr-2">{sample[0]}</span>
                      <span>{sample[1]}</span>
                    </div>
                  {/each}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="px-5 py-3 border-t border-bd flex items-center gap-2">
        <div class="text-2xs text-t3 flex-1">
          {#if hits && hits.length > 0}
            {#if totalMatches === 1 && hits.length === 1}
              {t("modals.find.totalSummaryOne", { matches: String(totalMatches), notes: String(hits.length) })}
            {:else if totalMatches !== 1 && hits.length !== 1}
              {t("modals.find.totalSummaryMany", { matches: String(totalMatches), notes: String(hits.length) })}
            {:else if totalMatches !== 1 && hits.length === 1}
              {t("modals.find.totalSummaryMixed", { matches: String(totalMatches), notes: String(hits.length) })}
            {:else}
              {t("modals.find.totalSummaryMatchesOne", { matches: String(totalMatches), notes: String(hits.length) })}
            {/if}
          {/if}
        </div>
        <button
          onmousedown={onClose}
          class="text-xs px-3 py-1.5 rounded-sm bg-s2 text-t2 hover:bg-s3 hover:text-char"
        >{t("modals.find.cancel")}</button>
        <button
          disabled={!hits || hits.length === 0 || busy}
          onclick={() => { confirming = true; }}
          class="text-xs px-3 py-1.5 rounded-sm bg-yel text-on-yel hover:bg-yeld disabled:opacity-40 disabled:cursor-not-allowed"
        >{t("modals.find.replaceAll")}</button>
      </div>

      {#if confirming && hits}
        <div
          class="absolute inset-0 z-10 bg-char/40 flex items-center justify-center p-6 rounded-xl"
          onclick={() => { if (!busy) confirming = false; }}
          role="presentation"
        >
          <div
            onmousedown={(e) => e.stopPropagation()}
            class="w-full max-w-sm bg-bg border border-bd2 rounded-lg shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
          >
            <div class="px-5 py-4">
              <div class="font-serif text-lg text-char">{t("modals.find.confirmTitle")}</div>
              <div class="text-xs text-t2 mt-2 leading-relaxed">
                {#if totalMatches === 1 && hits.length === 1}
                  {t("modals.find.confirmBodyOne", { matches: String(totalMatches), notes: String(hits.length) })}
                {:else if totalMatches !== 1 && hits.length !== 1}
                  {t("modals.find.confirmBodyMany", { matches: String(totalMatches), notes: String(hits.length) })}
                {:else if totalMatches === 1 && hits.length !== 1}
                  {t("modals.find.confirmBodyMixedA", { matches: String(totalMatches), notes: String(hits.length) })}
                {:else}
                  {t("modals.find.confirmBodyMixedB", { matches: String(totalMatches), notes: String(hits.length) })}
                {/if}
              </div>
            </div>
            <div class="px-5 py-3 border-t border-bd flex justify-end gap-2">
              <button
                disabled={busy}
                onclick={() => { confirming = false; }}
                class="text-xs px-3 py-1.5 rounded-sm bg-s2 text-t2 hover:bg-s3 hover:text-char disabled:opacity-50"
              >{t("modals.find.cancel")}</button>
              <button
                disabled={busy}
                onclick={apply}
                class="text-xs px-3 py-1.5 rounded-sm bg-yel text-on-yel hover:bg-yeld disabled:opacity-50"
              >{busy ? t("modals.find.replacing") : t("modals.find.replaceAll")}</button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
