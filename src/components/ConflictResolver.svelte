<script lang="ts">
  import { api } from "../lib/tauri";
  import type { ConflictContent } from "../lib/types";
  import Modal from "./Modal.svelte";
  import { tr } from "../lib/i18n/index.svelte";
  import { relativeTime } from "../lib/format";

  interface Props {
    relpaths: string[];
    currentPath: string;
    otherPath: string;
    onResolvedAll: () => void;
    onAbort: () => void;
  }

  let { relpaths, currentPath, otherPath, onResolvedAll, onAbort }: Props = $props();
  let t = $derived(tr());

  let idx = $state(0);
  let conflict = $state<ConflictContent | null>(null);
  let combined = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let confirmAbort = $state(false);

  let cur = $derived(relpaths[idx]);

  $effect(() => {
    error = null;
    const c = cur;
    if (!c) return;
    api
      .getConflict(c)
      .then((res) => {
        conflict = res;
        combined = res.working ?? res.ours ?? res.theirs ?? "";
      })
      .catch((e) => (error = String(e)));
  });

  async function accept() {
    if (!cur) return;
    busy = true;
    try {
      await api.resolveConflict(cur, combined);
      if (idx === relpaths.length - 1) {
        await api.finalizeMerge();
        onResolvedAll();
      } else {
        idx = idx + 1;
      }
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }

  function abort() {
    confirmAbort = true;
  }

  async function confirmAbortNow() {
    confirmAbort = false;
    await api.abortMerge();
    onAbort();
  }

  function splitWithMarkers(s: string, markers: string[]): string[] {
    let parts: string[] = [s];
    for (const m of markers) {
      const next: string[] = [];
      for (const p of parts) {
        const segs = p.split(m);
        for (let i = 0; i < segs.length; i++) {
          if (i > 0) next.push(m);
          next.push(segs[i]);
        }
      }
      parts = next;
    }
    return parts.filter((p) => p !== "");
  }

  let displayName = $derived(cur ? cur.replace(/^notes\//, "").replace(/\.md$/, "") : "");
  let bodyTpl = $derived(t("paths.conflict.body"));
  let bodyParts = $derived(
    splitWithMarkers(bodyTpl, ["{name}", "{currentPath}", "{otherPath}"]),
  );

  let oursRel = $derived(
    conflict?.ours_timestamp ? relativeTime(conflict.ours_timestamp) : "",
  );
  let theirsRel = $derived(
    conflict?.theirs_timestamp ? relativeTime(conflict.theirs_timestamp) : "",
  );
</script>

{#if !cur || !conflict}
  <div class="fixed inset-0 z-50 bg-bg flex items-center justify-center">
    <div class="text-t2">{t("paths.conflict.loading")}</div>
  </div>
{:else}
  <div class="fixed inset-0 z-50 bg-bg flex flex-col animate-fadeIn">
    <div class="px-6 py-4 border-b border-bd flex items-center">
      <div>
        <div class="font-serif text-2xl text-char">
          {t("paths.conflict.heading")}
        </div>
        <div class="text-sm text-t2 mt-1">
          {#each bodyParts as p, i (i)}
            {#if p === "{name}"}
              <span class="font-medium text-char">{displayName}</span>
            {:else if p === "{currentPath}"}
              <span class="px-1.5 py-0.5 bg-yelp text-yeld rounded-xs text-xs">
                {currentPath}
              </span>
            {:else if p === "{otherPath}"}
              <span class="px-1.5 py-0.5 bg-s3 text-ch2 rounded-xs text-xs">
                {otherPath}
              </span>
            {:else}
              <span>{p}</span>
            {/if}
          {/each}
        </div>
      </div>
      <div class="ml-auto text-xs text-t3">
        {t("paths.conflict.progress", { idx: String(idx + 1), total: String(relpaths.length) })}
      </div>
    </div>

    <div class="flex-1 overflow-hidden flex">
      <div class="w-1/3 min-w-0 flex flex-col border-l border-yel/60">
        <div class="px-4 py-2 border-b border-bd flex items-center">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-char font-medium truncate">
              {t("paths.conflict.onPath", { name: currentPath })}
            </div>
            <div class="text-2xs text-t3 flex items-center gap-1.5">
              <span>{t("paths.conflict.subtitleOurs")}</span>
              {#if oursRel && conflict.ours_timestamp}
                <span aria-hidden="true">·</span>
                <span
                  class="font-mono text-t2"
                  title={new Date(conflict.ours_timestamp * 1000).toLocaleString()}
                >
                  {oursRel}
                </span>
              {/if}
            </div>
          </div>
          <button
            onclick={() => (combined = conflict?.ours ?? "")}
            class="ml-2 px-2 py-1 text-2xs bg-s2 text-ch2 rounded-sm hover:bg-s3 whitespace-nowrap"
          >
            {t("paths.conflict.useThis")}
          </button>
        </div>
        <pre class="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap text-ch2 bg-bg/60">{conflict.ours ?? t("paths.conflict.noVersion")}</pre>
      </div>

      <div class="w-1/3 min-w-0 flex flex-col border-l border-ch2/60">
        <div class="px-4 py-2 border-b border-bd flex items-center">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-char font-medium truncate">
              {t("paths.conflict.onPath", { name: otherPath })}
            </div>
            <div class="text-2xs text-t3 flex items-center gap-1.5">
              <span>{t("paths.conflict.subtitleTheirs")}</span>
              {#if theirsRel && conflict.theirs_timestamp}
                <span aria-hidden="true">·</span>
                <span
                  class="font-mono text-t2"
                  title={new Date(conflict.theirs_timestamp * 1000).toLocaleString()}
                >
                  {theirsRel}
                </span>
              {/if}
            </div>
          </div>
          <button
            onclick={() => (combined = conflict?.theirs ?? "")}
            class="ml-2 px-2 py-1 text-2xs bg-s2 text-ch2 rounded-sm hover:bg-s3 whitespace-nowrap"
          >
            {t("paths.conflict.useThis")}
          </button>
        </div>
        <pre class="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap text-ch2 bg-bg/60">{conflict.theirs ?? t("paths.conflict.noVersion")}</pre>
      </div>

      <div class="flex-1 min-w-0 flex flex-col border-l border-bd bg-s1/60">
        <div class="px-4 py-2 border-b border-bd">
          <div class="text-2xs uppercase tracking-wider text-t3">
            {t("paths.conflict.combinedHeading")}
          </div>
          <div class="text-xs text-t2">{t("paths.conflict.combinedHelp")}</div>
        </div>
        <textarea
          bind:value={combined}
          class="flex-1 w-full p-4 bg-bg text-char outline-hidden resize-none font-mono text-xs leading-relaxed"
        ></textarea>
      </div>
    </div>

    {#if error}
      <div class="px-6 py-2 bg-danger/10 text-danger text-xs">{error}</div>
    {/if}

    <div class="px-6 py-3 border-t border-bd flex items-center gap-3">
      <button onclick={abort} class="text-xs text-t2 hover:text-char">
        {t("paths.conflict.stop")}
      </button>
      <div class="ml-auto flex gap-2">
        <button
          disabled={busy}
          onclick={accept}
          class="px-4 py-1.5 text-sm bg-yel text-on-yel rounded-sm hover:bg-yel2 disabled:opacity-50"
        >
          {idx === relpaths.length - 1
            ? t("paths.conflict.acceptFinal")
            : t("paths.conflict.acceptNext")}
        </button>
      </div>
    </div>

    <Modal
      open={confirmAbort}
      onClose={() => (confirmAbort = false)}
      title={t("paths.conflict.abortTitle")}
    >
      {#snippet children()}
        <p class="text-sm text-t2 mb-4 leading-relaxed">
          {t("paths.conflict.abortBody")}
        </p>
        <div class="flex justify-end gap-2">
          <button
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onclick={() => (confirmAbort = false)}
          >
            {t("paths.conflict.abortKeep")}
          </button>
          <button
            class="px-3 py-1.5 text-sm bg-danger text-bg rounded-md hover:opacity-90"
            onclick={confirmAbortNow}
          >
            {t("paths.conflict.abortConfirm")}
          </button>
        </div>
      {/snippet}
    </Modal>
  </div>
{/if}
