<script lang="ts">
  import Modal from "./Modal.svelte";
  import { api } from "../lib/tauri";
  import type { DiscardOutcome, QuotaBlockInfo } from "../lib/types";
  import { tr } from "../lib/i18n/index.svelte";

  // Sync-paused-by-quota modal. Shown when the stage-1 pre-push check
  // aborts a sync locally — the SyncOutcome.quota_blocked payload
  // drives the body. Copy is deliberately plain-English ("room" /
  // "recent changes") rather than git/storage jargon, per CLAUDE.md's
  // terminology rule. Error code stays visible so support can triage
  // quickly when a user pastes a screenshot.

  interface Props {
    open: boolean;
    blockInfo: QuotaBlockInfo | null;
    onClose: () => void;
    onDiscarded?: (outcome: DiscardOutcome) => void;
    onOpenManageStorage?: () => void;
  }

  type Phase = "info" | "preview" | "running" | "error";

  let { open, blockInfo, onClose, onDiscarded, onOpenManageStorage }: Props =
    $props();
  let t = $derived(tr());

  let phase = $state<Phase>("info");
  let preview = $state<DiscardOutcome | null>(null);
  let errMsg = $state<string | null>(null);
  let copied = $state(false);

  function humanBytes(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "?";
    if (n < 1024) return `${n} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let v = n / 1024;
    for (const u of units) {
      if (v < 1024) return `${v.toFixed(v < 10 ? 1 : 0)} ${u}`;
      v /= 1024;
    }
    return `${v.toFixed(1)} PB`;
  }

  function formatRelative(unixSeconds: number): string {
    const now = Date.now() / 1000;
    const delta = Math.max(0, now - unixSeconds);
    if (delta < 60) return t("modals.quota.relativeJustNow");
    if (delta < 3600)
      return t("modals.quota.relativeMinutes", {
        n: String(Math.floor(delta / 60)),
      });
    if (delta < 86400)
      return t("modals.quota.relativeHours", {
        n: String(Math.floor(delta / 3600)),
      });
    return t("modals.quota.relativeDays", {
      n: String(Math.floor(delta / 86400)),
    });
  }

  function humanizeError(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    return String(e);
  }

  function resetState() {
    phase = "info";
    preview = null;
    errMsg = null;
  }

  async function handleRequestDiscard() {
    errMsg = null;
    try {
      const p = await api.discardUnsyncedChanges(false);
      preview = p;
      phase = "preview";
    } catch (e) {
      errMsg = humanizeError(e);
      phase = "error";
    }
  }

  async function handleConfirmDiscard() {
    phase = "running";
    errMsg = null;
    try {
      const out = await api.discardUnsyncedChanges(true);
      onDiscarded?.(out);
      resetState();
      onClose();
    } catch (e) {
      errMsg = humanizeError(e);
      phase = "error";
    }
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      window.setTimeout(() => { copied = false; }, 1500);
    } catch {
      /* clipboard may be disabled */
    }
  }

  let title = $derived(
    phase === "preview"
      ? t("modals.quota.previewTitle")
      : t("modals.quota.infoTitle"),
  );
</script>

{#if open && blockInfo}
  {@const remaining = humanBytes(blockInfo.remaining_bytes)}
  {@const estimated = humanBytes(blockInfo.estimated_bytes)}
  {@const overBy = humanBytes(
    Math.max(0, blockInfo.estimated_bytes - blockInfo.remaining_bytes),
  )}
  <Modal {open} onClose={handleClose} {title} width="w-[520px]">
    {#snippet children()}
      {#if phase === "info"}
        <div class="space-y-4">
          {#if blockInfo.estimated_bytes > 0}
            <p class="text-t1 leading-relaxed">
              {t("modals.quota.infoBody", { estimated, remaining, over: overBy })}
            </p>
          {:else}
            <p class="text-t1 leading-relaxed">
              {t("modals.quota.infoBodyFallback")}
            </p>
          {/if}

          {#if blockInfo.culprits.length > 0}
            <div class="border border-bd rounded-lg overflow-hidden">
              <div class="px-3 py-2 bg-bg-soft border-b border-bd text-xs uppercase tracking-wide text-t3">
                {t("modals.quota.biggestFiles")}
              </div>
              <div class="divide-y divide-bd/70">
                {#each blockInfo.culprits.slice(0, 5) as c (c.oid)}
                  <div class="flex items-center justify-between px-3 py-2 text-sm">
                    <span class="truncate font-mono text-char" title={c.path}>{c.path}</span>
                    <span class="text-t2 tabular-nums whitespace-nowrap pl-3">{humanBytes(c.size)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <p class="text-sm text-t2 leading-relaxed">{t("modals.quota.optionsBody")}</p>

          {#if errMsg}
            <div class="text-sm text-danger bg-danger/10 border border-danger/30 rounded-sm px-3 py-2">
              {errMsg}
            </div>
          {/if}

          <div class="flex items-center justify-between gap-3 pt-1">
            {#if onOpenManageStorage}
              <button
                type="button"
                onclick={onOpenManageStorage}
                class="text-sm text-yeld hover:underline"
              >{t("modals.quota.manageStorage")}</button>
            {:else}
              <span></span>
            {/if}
            <div class="flex gap-2">
              <button
                type="button"
                onclick={handleClose}
                class="px-4 py-2 rounded-md border border-bd2 bg-bg hover:bg-bg-soft text-char text-sm"
              >{t("modals.quota.close")}</button>
              <button
                type="button"
                onclick={handleRequestDiscard}
                class="px-4 py-2 rounded-md bg-yel text-on-yel hover:bg-yel2 text-sm font-medium"
              >{t("modals.quota.undoAction")}</button>
            </div>
          </div>

          <div class="pt-3 mt-2 border-t border-bd/60 text-[11px] text-t3 flex items-center justify-between">
            <span>
              {t("modals.quota.reference")}{" "}
              <button
                type="button"
                onclick={() => copyCode("E-QUOTA-001")}
                class="font-mono text-t2 hover:text-char underline-offset-2 hover:underline"
                title={t("modals.quota.copyTitle")}
              >E-QUOTA-001</button>
              {#if copied}<span class="ml-2 text-sage">{t("modals.quota.copied")}</span>{/if}
            </span>
            <span class="italic">{t("modals.quota.referenceFooter")}</span>
          </div>
        </div>
      {:else if phase === "preview" && preview}
        <div class="space-y-4">
          <p class="text-t1 leading-relaxed">
            {#if preview.commits_ahead === 0}
              {t("modals.quota.previewNothing")}
            {:else if preview.commits_ahead === 1}
              {t("modals.quota.previewOne", { count: String(preview.commits_ahead) })}
            {:else}
              {t("modals.quota.previewMany", { count: String(preview.commits_ahead) })}
            {/if}
          </p>

          {#if preview.commits.length > 0}
            <div class="border border-bd rounded-lg overflow-hidden max-h-[220px] overflow-y-auto">
              <div class="px-3 py-2 bg-bg-soft border-b border-bd text-xs uppercase tracking-wide text-t3 sticky top-0">
                {t("modals.quota.willBeUndone")}
              </div>
              <div class="divide-y divide-bd/70">
                {#each preview.commits as c (c.oid)}
                  <div class="px-3 py-2 text-sm">
                    <div class="truncate text-char" title={c.summary}>{c.summary}</div>
                    <div class="text-[11px] text-t3 font-mono tabular-nums">
                      {c.oid.slice(0, 7)} · {formatRelative(c.time)}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if preview.reset_to_summary}
            <p class="text-sm text-t2 border-l-2 border-sage pl-3">
              {t("modals.quota.goingBackTo")}{" "}
              <span class="text-char">{preview.reset_to_summary}</span>
            </p>
          {/if}

          {#if errMsg}
            <div class="text-sm text-danger bg-danger/10 border border-danger/30 rounded-sm px-3 py-2">
              {errMsg}
            </div>
          {/if}

          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onclick={() => { phase = "info"; }}
              class="px-4 py-2 rounded-md border border-bd2 bg-bg hover:bg-bg-soft text-char text-sm"
            >{t("modals.quota.previewBack")}</button>
            <button
              type="button"
              onclick={handleConfirmDiscard}
              disabled={preview.commits_ahead === 0}
              class="px-4 py-2 rounded-md bg-danger text-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >{t("modals.quota.confirmDiscard")}</button>
          </div>

          <div class="pt-3 mt-2 border-t border-bd/60 text-[11px] text-t3 flex items-center justify-between">
            <span>
              {t("modals.quota.reference")}{" "}
              <button
                type="button"
                onclick={() => copyCode("E-QUOTA-001")}
                class="font-mono text-t2 hover:text-char underline-offset-2 hover:underline"
                title={t("modals.quota.copyTitle")}
              >E-QUOTA-001</button>
              {#if copied}<span class="ml-2 text-sage">{t("modals.quota.copied")}</span>{/if}
            </span>
            <span class="italic">{t("modals.quota.referenceFooter")}</span>
          </div>
        </div>
      {:else if phase === "running"}
        <div class="py-6 text-center text-t1">
          <div class="text-sm italic">{t("modals.quota.running")}</div>
        </div>
      {:else if phase === "error"}
        <div class="space-y-4">
          <p class="text-t1 leading-relaxed">{t("modals.quota.errorBody")}</p>
          <div class="text-sm text-danger bg-danger/10 border border-danger/30 rounded-sm px-3 py-2">
            {errMsg ?? t("modals.quota.errorUnknown")}
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              onclick={handleClose}
              class="px-4 py-2 rounded-md border border-bd2 bg-bg hover:bg-bg-soft text-char text-sm"
            >{t("modals.quota.close")}</button>
            <button
              type="button"
              onclick={() => { phase = "info"; }}
              class="px-4 py-2 rounded-md bg-yel text-on-yel hover:bg-yel2 text-sm font-medium"
            >{t("modals.quota.tryAgain")}</button>
          </div>
          <div class="pt-3 mt-2 border-t border-bd/60 text-[11px] text-t3 flex items-center justify-between">
            <span>
              {t("modals.quota.reference")}{" "}
              <button
                type="button"
                onclick={() => copyCode("E-QUOTA-002")}
                class="font-mono text-t2 hover:text-char underline-offset-2 hover:underline"
                title={t("modals.quota.copyTitle")}
              >E-QUOTA-002</button>
              {#if copied}<span class="ml-2 text-sage">{t("modals.quota.copied")}</span>{/if}
            </span>
            <span class="italic">{t("modals.quota.referenceFooter")}</span>
          </div>
        </div>
      {/if}
    {/snippet}
  </Modal>
{/if}
