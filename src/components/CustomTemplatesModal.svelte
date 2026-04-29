<script lang="ts">
  import type { TemplateInfo } from "../lib/types";
  import Modal from "./Modal.svelte";
  import EmptyState from "./EmptyState.svelte";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    templates: TemplateInfo[];
    onClose: () => void;
    onPick: (templateName: string, title: string) => void;
  }

  let { open, templates, onClose, onPick }: Props = $props();
  let t = $derived(tr());

  let pending = $state<string | null>(null);
  let title = $state("");
  let search = $state("");
  let searchRef = $state<HTMLInputElement | null>(null);
  let titleInputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!open) {
      pending = null;
      title = "";
      search = "";
    } else {
      const id = window.setTimeout(() => searchRef?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  });

  $effect(() => {
    if (pending) {
      const id = window.setTimeout(() => titleInputEl?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  });

  let filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return templates
      .filter((tpl) => tpl.is_bundled === false)
      .filter((tpl) => {
        if (!q) return true;
        return (
          tpl.label.toLowerCase().includes(q) ||
          tpl.name.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  let pendingTpl = $derived(
    pending ? templates.find((tpl) => tpl.name === pending) ?? null : null,
  );

  function defaultTitleFor(tt: TemplateInfo): string {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    return `${tt.label} — ${iso}`;
  }

  function commitPending() {
    const tt = title.trim();
    if (tt && pending) onPick(pending, tt);
  }
</script>

{#if open}
  {#if pending}
    <Modal
      open
      {onClose}
      title={pendingTpl
        ? t("modals.customTemplates.startTitle", { label: pendingTpl.label })
        : t("modals.customTemplates.startFallbackTitle")}
    >
      {#snippet children()}
        <p class="text-xs text-t2 mb-3 leading-relaxed">
          {t("modals.customTemplates.startBody")}
        </p>
        <input
          bind:this={titleInputEl}
          bind:value={title}
          onkeydown={(e) => {
            if (e.key === "Enter" && !e.isComposing) commitPending();
            else if (e.key === "Escape") pending = null;
          }}
          placeholder={pendingTpl ? defaultTitleFor(pendingTpl) : ""}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onclick={() => { pending = null; }}
          >{t("modals.customTemplates.back")}</button>
          <button
            class="btn-yel px-3 py-1.5 text-sm rounded-md"
            disabled={!title.trim()}
            onclick={commitPending}
          >{t("modals.customTemplates.create")}</button>
        </div>
      {/snippet}
    </Modal>
  {:else}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-char/30 animate-fadeIn"
      onmousedown={onClose}
      role="presentation"
    >
      <div
        class="w-[640px] max-w-[94vw] max-h-[80vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden animate-slideUp flex flex-col"
        onmousedown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        <div class="shrink-0 px-6 py-5 border-b border-bd">
          <div class="font-serif text-2xl text-char">{t("modals.customTemplates.title")}</div>
          <div class="font-serif italic text-sm text-t2 mt-1">
            {#if filtered.length === 1}
              {t("modals.customTemplates.subtitleOne", { count: String(filtered.length) })}
            {:else}
              {t("modals.customTemplates.subtitleMany", { count: String(filtered.length) })}
            {/if}
          </div>
          <div class="mt-3">
            <input
              bind:this={searchRef}
              type="text"
              bind:value={search}
              onkeydown={(e) => {
                if (e.key === "Escape" && search) {
                  e.stopPropagation();
                  search = "";
                }
              }}
              placeholder={t("modals.customTemplates.searchPlaceholder")}
              class="w-full px-3.5 py-2 bg-bg border border-bd rounded-full text-sm text-char placeholder:text-t3 focus:outline-hidden focus:border-bd2 transition"
            />
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-6">
          {#if filtered.length === 0}
            <EmptyState
              kind="checkpoints"
              title={search
                ? t("modals.customTemplates.noMatchTitle", { query: search })
                : t("modals.customTemplates.noTemplatesTitle")}
              hint={search
                ? t("modals.customTemplates.noMatchHint")
                : t("modals.customTemplates.noTemplatesHint")}
            />
          {:else}
            <ul class="space-y-1.5">
              {#each filtered as tpl (tpl.name)}
                <li>
                  <button
                    onclick={() => {
                      pending = tpl.name;
                      title = defaultTitleFor(tpl);
                    }}
                    class="w-full text-left bg-bg border border-bd rounded-lg px-4 py-3 hover:border-yel hover:bg-yelp/30 transition"
                  >
                    <div class="font-serif text-[15px] text-char leading-tight">{tpl.label}</div>
                    <div class="text-2xs text-t3 font-mono mt-0.5">{tpl.name}</div>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}
