<script lang="ts">
  import { tr } from "../../lib/i18n/index.svelte";
  import Modal from "../Modal.svelte";
  import type { Draft } from "../../lib/types";

  interface Props {
    drafts: Draft[];
    activeDraftId: string | null;
    onSwitch: (draftId: string | null) => void;
    onCreate: (displayName: string) => void;
    onRename: (draftId: string, displayName: string) => void;
    onDiscard: (draftId: string) => void;
    onKeep: (draftId: string) => void;
    enabled: boolean;
  }

  let {
    drafts,
    activeDraftId,
    onSwitch,
    onCreate,
    onRename,
    onDiscard,
    onKeep,
    enabled,
  }: Props = $props();
  let t = $derived(tr());

  let menuOpen = $state(false);
  let nameModal = $state<
    | null
    | { mode: "new"; initial: string }
    | { mode: "rename"; draftId: string; initial: string }
  >(null);
  let modalValue = $state("");
  let modalInputRef = $state<HTMLInputElement | null>(null);

  let active = $derived(drafts.find((d) => d.id === activeDraftId) ?? null);

  $effect(() => {
    if (!nameModal) return;
    modalValue = nameModal.initial;
    const id = window.setTimeout(() => {
      modalInputRef?.focus();
      modalInputRef?.select();
    }, 30);
    return () => window.clearTimeout(id);
  });

  function handleNew() {
    nameModal = { mode: "new", initial: t("editor.drafts.newDraftDefault") };
  }

  function handleRename() {
    if (!active) return;
    nameModal = { mode: "rename", draftId: active.id, initial: active.display_name };
    menuOpen = false;
  }

  function submitModal() {
    const next = modalValue.trim();
    if (!next || !nameModal) return;
    if (nameModal.mode === "new") onCreate(next);
    else onRename(nameModal.draftId, next);
    nameModal = null;
  }

  function handleDiscard() {
    if (!active) return;
    const ok = window.confirm(
      t("editor.drafts.discardConfirm", { name: active.display_name }),
    );
    if (!ok) return;
    onDiscard(active.id);
    menuOpen = false;
  }

  function handleKeep() {
    if (!active) return;
    const ok = window.confirm(t("editor.drafts.keepConfirm"));
    if (!ok) return;
    onKeep(active.id);
    menuOpen = false;
  }
</script>

{#if enabled}
  <div
    role="tablist"
    aria-label="Drafts"
    class="flex items-center gap-1 mb-3 text-xs font-mono select-none"
  >
    <button
      type="button"
      role="tab"
      aria-selected={activeDraftId === null}
      onclick={() => onSwitch(null)}
      title={t("editor.drafts.mainTitle")}
      class="px-2 py-1 rounded border transition {activeDraftId === null
        ? 'border-yel bg-yelp/40 text-char'
        : 'border-bd text-t2 hover:bg-s1 hover:text-char'}"
    >
      {t("editor.drafts.main")}
    </button>
    {#each drafts as d (d.id)}
      {@const isActive = d.id === activeDraftId}
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onclick={() => onSwitch(d.id)}
        title={t("editor.drafts.tabTitle", { name: d.display_name })}
        class="px-2 py-1 rounded border transition truncate max-w-[160px] {isActive
          ? 'border-yel bg-yelp/40 text-char italic'
          : 'border-bd text-t2 hover:bg-s1 hover:text-char italic'}"
      >
        {d.display_name}
      </button>
    {/each}
    <button
      type="button"
      onclick={handleNew}
      title={t("editor.drafts.newDraftTitle")}
      class="px-2 py-1 rounded-sm border border-bd2 border-dashed text-t3 hover:bg-s1 hover:text-char hover:border-bd transition"
    >
      {t("editor.drafts.newDraft")}
    </button>

    <Modal
      open={nameModal !== null}
      onClose={() => (nameModal = null)}
      title={nameModal?.mode === "new"
        ? t("editor.drafts.newDraftModalTitle")
        : t("editor.drafts.renameModalTitle")}
      width="w-[440px]"
    >
      {#snippet children()}
        <p class="text-xs text-t2 leading-relaxed mb-3">
          {nameModal?.mode === "new"
            ? t("editor.drafts.newDraftModalLead")
            : t("editor.drafts.renameModalLead")}
        </p>
        <input
          bind:this={modalInputRef}
          bind:value={modalValue}
          onkeydown={(e) => {
            if (e.key === "Enter" && !e.isComposing) {
              e.preventDefault();
              submitModal();
            }
          }}
          placeholder={t("editor.drafts.namePlaceholder")}
          class="w-full px-3 py-2 bg-bg-soft border border-bd rounded-md text-char text-sm font-serif italic placeholder:not-italic placeholder:text-t3/70"
        />
        <div class="mt-4 flex items-center justify-end gap-2">
          <button
            onclick={() => (nameModal = null)}
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
          >
            {t("editor.drafts.modalCancel")}
          </button>
          <button
            onclick={submitModal}
            disabled={!modalValue.trim()}
            class="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {nameModal?.mode === "new"
              ? t("editor.drafts.modalCreate")
              : t("editor.drafts.modalSave")}
          </button>
        </div>
      {/snippet}
    </Modal>

    {#if active}
      <div class="relative ml-auto">
        <button
          type="button"
          aria-label={t("editor.drafts.menuAria")}
          aria-expanded={menuOpen}
          onclick={() => (menuOpen = !menuOpen)}
          onblur={() => {
            window.setTimeout(() => (menuOpen = false), 120);
          }}
          class="px-2 py-1 rounded-sm border border-bd text-t2 hover:bg-s1 hover:text-char transition"
        >
          ⋯
        </button>
        {#if menuOpen}
          <div
            class="absolute right-0 top-full mt-1 z-20 min-w-[200px] rounded-sm border border-bd bg-bg shadow-md py-1 text-xs"
            onmousedown={(e) => e.preventDefault()}
            role="presentation"
          >
            <button
              type="button"
              onclick={handleKeep}
              title={t("editor.drafts.keepTitle")}
              class="w-full text-left px-3 py-1.5 hover:bg-s1 text-char"
            >
              {t("editor.drafts.keep")}
            </button>
            <button
              type="button"
              onclick={handleRename}
              title={t("editor.drafts.renameTitle")}
              class="w-full text-left px-3 py-1.5 hover:bg-s1 text-char"
            >
              {t("editor.drafts.rename")}
            </button>
            <button
              type="button"
              onclick={handleDiscard}
              title={t("editor.drafts.discardTitle")}
              class="w-full text-left px-3 py-1.5 hover:bg-s1 text-red-500"
            >
              {t("editor.drafts.discard")}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
