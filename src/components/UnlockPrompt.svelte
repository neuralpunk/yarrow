<script lang="ts">
  import { api } from "../lib/tauri";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    reason?: string;
    onUnlocked: () => void;
    onClose: () => void;
  }

  let { open, reason, onUnlocked, onClose }: Props = $props();
  let t = $derived(tr());

  let password = $state("");
  let phrase = $state("");
  let newPw = $state("");
  let mode = $state<"password" | "recovery">("password");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let showPw = $state(false);
  let inputRef = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!open) return;
    password = "";
    phrase = "";
    newPw = "";
    mode = "password";
    busy = false;
    error = null;
    const id = window.setTimeout(() => inputRef?.focus(), 30);
    return () => window.clearTimeout(id);
  });

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function submit() {
    busy = true;
    error = null;
    try {
      if (mode === "password") {
        await api.unlockEncryption(password);
      } else {
        await api.recoverEncryption(phrase.trim(), newPw);
      }
      onUnlocked();
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-60 flex items-center justify-center bg-char/40 animate-fadeIn"
    onmousedown={onClose}
    role="presentation"
  >
    <div
      class="w-[440px] max-w-[92vw] bg-bg border border-bd2 rounded-xl shadow-2xl p-5 animate-slideUp"
      onmousedown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="flex items-center gap-2 mb-1">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-yel"
        >
          <rect x="2.5" y="6.5" width="9" height="6" rx="1.2" />
          <path d="M4.5 6.5V4.5a2.5 2.5 0 1 1 5 0v2" />
        </svg>
        <h2 class="font-serif text-xl text-char">
          {t("modals.unlock.title")}
        </h2>
      </div>
      <p class="text-xs text-t2 mb-4 leading-relaxed">
        {reason ?? t("modals.unlock.defaultReason")}
      </p>

      {#if mode === "password"}
        <label class="text-xs text-t2 block mb-1" for="unlock-password">
          {t("modals.unlock.passwordLabel")}
        </label>
        <div class="flex items-center gap-2 mb-3">
          <input
            id="unlock-password"
            bind:this={inputRef}
            type={showPw ? "text" : "password"}
            bind:value={password}
            onkeydown={(e) => { if (e.key === "Enter") submit(); }}
            class="flex-1 px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm"
            placeholder={t("modals.unlock.passwordPlaceholder")}
          />
          <button
            type="button"
            onclick={() => { showPw = !showPw; }}
            class="text-2xs text-t2 hover:text-char px-2 py-1 rounded-sm"
          >
            {showPw ? t("modals.unlock.hide") : t("modals.unlock.show")}
          </button>
        </div>
      {:else}
        <label class="text-xs text-t2 block mb-1" for="unlock-phrase">
          {t("modals.unlock.recoveryLabel")}
        </label>
        <textarea
          id="unlock-phrase"
          bind:value={phrase}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs mb-3 resize-none"
          rows={2}
          placeholder={t("modals.unlock.recoveryPlaceholder")}
        ></textarea>
        <label class="text-xs text-t2 block mb-1" for="unlock-newpw">
          {t("modals.unlock.newPasswordLabel")}
        </label>
        <input
          id="unlock-newpw"
          type={showPw ? "text" : "password"}
          bind:value={newPw}
          onkeydown={(e) => { if (e.key === "Enter") submit(); }}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
          placeholder={t("modals.unlock.newPasswordPlaceholder")}
        />
        <p class="text-2xs text-t3 mb-3 leading-relaxed">
          {t("modals.unlock.recoveryNote")}
        </p>
      {/if}

      {#if error}
        <div class="text-xs text-danger bg-danger/10 border border-danger/30 rounded-sm px-3 py-2 mb-3">
          {error}
        </div>
      {/if}

      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={() => { mode = mode === "password" ? "recovery" : "password"; }}
          class="text-2xs text-t2 hover:text-char"
        >
          {mode === "password"
            ? t("modals.unlock.forgot")
            : t("modals.unlock.usePassword")}
        </button>
        <div class="ml-auto flex gap-2">
          <button
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onclick={onClose}
          >
            {t("modals.unlock.notNow")}
          </button>
          <button
            class="btn-yel px-3 py-1.5 text-sm rounded-md"
            onclick={submit}
            disabled={busy ||
              (mode === "password"
                ? !password
                : !phrase.trim() || newPw.length < 8)}
          >
            {busy
              ? t("modals.unlock.unlocking")
              : mode === "password"
                ? t("modals.unlock.unlock")
                : t("modals.unlock.resetUnlock")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
