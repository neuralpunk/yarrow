<script lang="ts">
  import { api } from "../lib/tauri";
  import type { TrashEntry } from "../lib/types";
  import { relativeTime } from "../lib/format";
  import EmptyState from "./EmptyState.svelte";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    onChanged: () => void;
  }

  let { open, onClose, onChanged }: Props = $props();
  let t = $derived(tr());

  let entries = $state<TrashEntry[]>([]);
  let busy = $state<string | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!open) return;
    error = null;
    api
      .listTrash()
      .then((list) => { entries = list; })
      .catch((e) => { error = String(e); });
  });

  async function reload() {
    try {
      entries = await api.listTrash();
    } catch (e) {
      error = String(e);
    }
  }

  async function restore(slug: string) {
    busy = slug;
    error = null;
    try {
      await api.restoreFromTrash(slug);
      onChanged();
      await reload();
    } catch (e) {
      error = String(e);
    } finally {
      busy = null;
    }
  }

  async function purge(slug: string) {
    if (!confirm(t("modals.trash.purgeConfirm", { slug }))) return;
    busy = slug;
    try {
      await api.purgeFromTrash(slug);
      await reload();
    } catch (e) {
      error = String(e);
    } finally {
      busy = null;
    }
  }

  async function emptyAll() {
    if (entries.length === 0) return;
    if (
      !confirm(
        entries.length === 1
          ? t("modals.trash.emptyConfirmOne")
          : t("modals.trash.emptyConfirmMany", {
              count: String(entries.length),
            }),
      )
    )
      return;
    try {
      await api.emptyTrash();
      await reload();
    } catch (e) {
      error = String(e);
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
      class="w-full max-w-2xl max-h-[78vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="flex items-baseline justify-between px-5 py-4 border-b border-bd">
        <div>
          <div class="font-serif text-xl text-char">{t("modals.trash.title")}</div>
          <div class="text-2xs text-t3 mt-0.5">{t("modals.trash.subtitle")}</div>
        </div>
        <button
          onclick={emptyAll}
          disabled={entries.length === 0}
          class="text-xs text-t3 hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
        >{t("modals.trash.empty")}</button>
      </div>

      {#if error}
        <div class="px-5 py-2 text-xs text-danger bg-danger/10 border-b border-bd">
          {error}
        </div>
      {/if}

      <div class="overflow-y-auto flex-1">
        {#if entries.length === 0}
          <EmptyState kind="trash" size="roomy" />
        {:else}
          <ul>
            {#each entries as e (e.slug)}
              <li class="px-5 py-3 border-b border-bd/60 flex items-center gap-3 hover:bg-s1/60">
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-char truncate">{e.title}</div>
                  <div class="text-2xs text-t3 font-mono mt-0.5 truncate">
                    {e.slug} · {t("modals.trash.removed", { when: relativeTime(e.deleted_at) })}
                  </div>
                </div>
                <button
                  disabled={busy === e.slug}
                  onclick={() => restore(e.slug)}
                  class="text-xs px-2.5 py-1 rounded-sm bg-yelp text-yeld hover:bg-yel hover:text-on-yel disabled:opacity-50"
                >{t("modals.trash.restore")}</button>
                <button
                  disabled={busy === e.slug}
                  onclick={() => purge(e.slug)}
                  class="text-xs px-2.5 py-1 rounded-sm text-t3 hover:text-danger hover:bg-danger/10 disabled:opacity-50"
                >{t("modals.trash.purge")}</button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="px-5 py-3 border-t border-bd flex justify-end">
        <button
          onclick={onClose}
          class="text-xs px-3 py-1.5 rounded-sm bg-s2 text-t2 hover:bg-s3 hover:text-char"
        >{t("modals.trash.close")}</button>
      </div>
    </div>
  </div>
{/if}
