<script lang="ts">
  import { api } from "../lib/tauri";
  import type { NoteSummary, WorkspaceConfig } from "../lib/types";
  import Modal from "./Modal.svelte";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    onConfigChange: (cfg: WorkspaceConfig) => void;
    onAfterSet?: (slug: string) => void;
  }

  let { open, onClose, onConfigChange, onAfterSet }: Props = $props();
  let t = $derived(tr());

  let notes = $state<NoteSummary[]>([]);
  let filter = $state("");
  let newTitle = $state("");
  let busy = $state(false);
  let err = $state<string | null>(null);

  $effect(() => {
    if (!open) return;
    err = null;
    filter = "";
    newTitle = "";
    api.listNotes().then((n) => { notes = n; }).catch(() => { notes = []; });
  });

  let filtered = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.slug.toLowerCase().includes(q),
    );
  });

  async function pickExisting(slug: string) {
    busy = true;
    err = null;
    try {
      const cfg = await api.setMainNote(slug);
      onConfigChange(cfg);
      onAfterSet?.(slug);
      onClose();
    } catch (e) {
      err = String(e);
    } finally {
      busy = false;
    }
  }

  async function createAndPick() {
    const title = newTitle.trim();
    if (!title) return;
    busy = true;
    err = null;
    try {
      const note = await api.createNote(title);
      const cfg = await api.setMainNote(note.slug);
      onConfigChange(cfg);
      onAfterSet?.(note.slug);
      onClose();
    } catch (e) {
      err = String(e);
    } finally {
      busy = false;
    }
  }

  async function switchToBasic() {
    busy = true;
    err = null;
    try {
      const cfg = await api.setWorkspaceMode("basic");
      onConfigChange(cfg);
      onClose();
    } catch (e) {
      err = String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Modal {open} {onClose} width="w-[min(92vw,560px)]">
  {#snippet children()}
    <div class="mb-4">
      <div class="font-serif text-2xl text-char leading-tight mb-1">
        {t("modals.mainNote.title")}
      </div>
      <p class="text-xs text-t2 leading-relaxed">
        {t("modals.mainNote.subtitle")}
      </p>
    </div>

    <div class="mb-3">
      <div class="text-2xs font-mono uppercase tracking-wider text-t3 mb-1.5">
        {t("modals.mainNote.useExisting")}
      </div>
      <input
        type="text"
        bind:value={filter}
        placeholder={t("modals.mainNote.filter")}
        class="w-full px-3 py-1.5 bg-s1 border border-bd rounded-md text-char text-sm placeholder:text-t3 focus:outline-hidden focus:border-yel"
      />
      <ul class="mt-2 max-h-[180px] overflow-y-auto border border-bd rounded-md bg-s1">
        {#if filtered.length === 0}
          <li class="px-3 py-2 text-xs text-t3">
            {t("modals.mainNote.noNotes")}
          </li>
        {:else}
          {#each filtered as n (n.slug)}
            <li>
              <button
                disabled={busy}
                onclick={() => pickExisting(n.slug)}
                class="w-full text-left px-3 py-2 text-sm text-char hover:bg-yelp border-b border-bd last:border-b-0 disabled:opacity-50"
              >
                <div class="font-medium truncate">{n.title}</div>
                <div class="text-2xs text-t3 font-mono truncate">{n.slug}</div>
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </div>

    <div class="mb-3 pt-3 border-t border-bd">
      <div class="text-2xs font-mono uppercase tracking-wider text-t3 mb-1.5">
        {t("modals.mainNote.orCreateNew")}
      </div>
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={newTitle}
          onkeydown={(e) => {
            if (e.key === "Enter" && newTitle.trim()) createAndPick();
          }}
          placeholder={t("modals.mainNote.newPlaceholder")}
          class="flex-1 px-3 py-1.5 bg-s1 border border-bd rounded-md text-char text-sm placeholder:text-t3 focus:outline-hidden focus:border-yel"
        />
        <button
          disabled={busy || !newTitle.trim()}
          onclick={createAndPick}
          class="px-3 py-1.5 rounded-md bg-yel text-on-yel text-sm font-medium hover:bg-yel2 disabled:opacity-50"
        >
          {t("modals.mainNote.create")}
        </button>
      </div>
    </div>

    <div class="pt-3 border-t border-bd flex items-center justify-between">
      <button
        disabled={busy}
        onclick={switchToBasic}
        class="text-xs text-t3 hover:text-char underline-offset-2 hover:underline"
      >
        {t("modals.mainNote.basicMode")}
      </button>
      <button
        onclick={onClose}
        disabled={busy}
        class="text-xs text-t3 hover:text-char"
      >
        {t("modals.mainNote.notNow")}
      </button>
    </div>

    {#if err}
      <p class="mt-3 text-xs text-danger">{err}</p>
    {/if}
  {/snippet}
</Modal>
