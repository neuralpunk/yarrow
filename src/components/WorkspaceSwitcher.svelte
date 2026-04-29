<script lang="ts">
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { api } from "../lib/tauri";
  import type { RecentWorkspace } from "../lib/types";
  import { PlusIcon, XIcon } from "../lib/iconsSvelte";
  import { workspaceAccent } from "../lib/workspaceAccent";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    /** Element ref to the chip that anchors the popover; clicks on it should not close. */
    anchorEl: HTMLElement | null;
    currentPath: string;
    onClose: () => void;
    onSwitch: (path: string) => void;
  }

  let { open, anchorEl, currentPath, onClose, onSwitch }: Props = $props();
  let t = $derived(tr());

  let recent = $state<RecentWorkspace[]>([]);
  let busy = $state(false);
  let err = $state<string | null>(null);
  let cursor = $state(0);
  let popRef = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!open) return;
    err = null;
    cursor = 0;
    api
      .listRecentWorkspaces()
      .then((r) => (recent = r))
      .catch(() => (recent = []));
  });

  $effect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popRef?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  });

  let selectable = $derived(recent.filter((r) => r.path !== currentPath));

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
        cursor = Math.min(cursor + 1, Math.max(0, selectable.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        cursor = Math.max(cursor - 1, 0);
        return;
      }
      if (e.key === "Enter" && !e.isComposing && selectable[cursor]) {
        e.preventDefault();
        handleSwitch(selectable[cursor].path);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function handleSwitch(path: string) {
    if (path === currentPath) {
      onClose();
      return;
    }
    err = null;
    busy = true;
    try {
      await api.openWorkspace(path);
      onSwitch(path);
      onClose();
    } catch (e) {
      err = String(e);
      await api.forgetRecentWorkspace(path).catch(() => {});
      recent = await api.listRecentWorkspaces();
    } finally {
      busy = false;
    }
  }

  async function handleBrowseOpen() {
    err = null;
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: t("modals.workspaceSwitcher.openTitle"),
      });
      if (!selected || Array.isArray(selected)) return;
      if (selected === currentPath) {
        onClose();
        return;
      }
      busy = true;
      await api.openWorkspace(selected);
      onSwitch(selected);
      onClose();
    } catch (e) {
      err = String(e);
    } finally {
      busy = false;
    }
  }

  async function handleCreateNew() {
    err = null;
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: t("modals.workspaceSwitcher.pickFolderTitle"),
      });
      if (!selected || Array.isArray(selected)) return;
      busy = true;
      await api.initWorkspace(selected);
      onSwitch(selected);
      onClose();
    } catch (e) {
      err = String(e);
    } finally {
      busy = false;
    }
  }

  async function handleForget(e: MouseEvent, path: string) {
    e.stopPropagation();
    await api.forgetRecentWorkspace(path).catch(() => {});
    recent = await api.listRecentWorkspaces();
  }
</script>

{#if open}
  <div
    bind:this={popRef}
    class="absolute left-3 right-3 top-[calc(100%+6px)] z-40 bg-bg border border-bd2 rounded-lg shadow-xl overflow-hidden animate-slideUp"
    role="dialog"
    aria-label={t("modals.workspaceSwitcher.dialogLabel")}
    tabindex="-1"
  >
    {#if selectable.length > 0}
      <div class="py-1 max-h-[240px] overflow-y-auto">
        <div class="px-3 pt-1.5 pb-1 text-2xs uppercase tracking-wider text-t3 font-semibold">
          {t("modals.workspaceSwitcher.jumpTo")}
        </div>
        <ul>
          {#each selectable as r, i (r.path)}
            {@const active = i === cursor}
            {@const accent = workspaceAccent(r.path, false)}
            <li class="group">
              <div
                class="w-full text-left flex items-center gap-2.5 px-3 py-2 transition cursor-pointer {active
                  ? 'bg-s2 text-char'
                  : 'hover:bg-s2/60 text-t2 hover:text-char'} {busy ? 'opacity-50 pointer-events-none' : ''}"
                onclick={() => handleSwitch(r.path)}
                onmouseenter={() => (cursor = i)}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSwitch(r.path);
                  }
                }}
              >
                <span
                  class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-serif text-[12.5px]"
                  style:background={accent.background}
                  style:color={accent.color}
                >
                  {(r.name || "W").charAt(0).toUpperCase()}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm truncate">{r.name}</div>
                  <div class="text-2xs text-t3 font-mono truncate">{r.path}</div>
                </div>
                <button
                  onclick={(e) => handleForget(e, r.path)}
                  class="opacity-0 group-hover:opacity-100 text-t3 hover:text-danger transition shrink-0 w-5 h-5 flex items-center justify-center rounded-sm hover:bg-s3"
                  title={t("modals.workspaceSwitcher.removeFromRecents")}
                  aria-label={t("modals.workspaceSwitcher.removeFromRecents")}
                >
                  <XIcon size={11} />
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if selectable.length === 0}
      <div class="px-3 py-4 text-xs text-t3 italic text-center">
        {t("modals.workspaceSwitcher.empty")}
      </div>
    {/if}

    <div class="border-t border-bd px-2 py-2 flex flex-col gap-1 bg-s1">
      <button
        onclick={handleCreateNew}
        disabled={busy}
        class="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-char rounded-sm hover:bg-yelp transition text-left"
      >
        <span class="w-5 h-5 rounded-full bg-yel/20 text-yeld flex items-center justify-center shrink-0">
          <PlusIcon size={12} weight="bold" />
        </span>
        <div class="flex-1 min-w-0">
          <div class="leading-tight">{t("modals.workspaceSwitcher.newWorkspace")}</div>
          <div class="text-2xs text-t3 leading-tight">{t("modals.workspaceSwitcher.newWorkspaceSub")}</div>
        </div>
      </button>
      <button
        onclick={handleBrowseOpen}
        disabled={busy}
        class="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-char rounded-sm hover:bg-s2 transition text-left"
      >
        <span class="w-5 h-5 rounded-full bg-s2 text-t2 flex items-center justify-center shrink-0">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h2.2l1 1.2H9.5a1 1 0 0 1 1 1v4.3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3.5Z" />
          </svg>
        </span>
        <div class="flex-1 min-w-0">
          <div class="leading-tight">{t("modals.workspaceSwitcher.openAnother")}</div>
          <div class="text-2xs text-t3 leading-tight">{t("modals.workspaceSwitcher.openAnotherSub")}</div>
        </div>
      </button>
    </div>

    {#if err}
      <div class="border-t border-bd px-3 py-2 text-2xs text-danger bg-danger/5 leading-snug">
        {err}
      </div>
    {/if}
  </div>
{/if}
