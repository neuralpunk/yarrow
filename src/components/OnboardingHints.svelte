<script lang="ts">
  import { SK } from "../lib/platform.svelte";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    /** When a workspace is first opened we start the cycle; subsequent
     *  workspace opens on the same machine stay dismissed via localStorage. */
    workspacePath: string;
  }

  let { workspacePath }: Props = $props();

  const STORAGE_KEY = "yarrow.onboardingHints.dismissed";

  let t = $derived(tr());
  let idx = $state(0);
  let dismissed = $state<boolean>((() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  })());
  let visible = $state(false);

  // Don't pop the card immediately on a cold boot — give the app a
  // moment to finish its first render so the hint doesn't collide
  // with layout.
  $effect(() => {
    void workspacePath;
    if (dismissed) return;
    const tid = window.setTimeout(() => { visible = true; }, 900);
    return () => window.clearTimeout(tid);
  });

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* quota */ }
    dismissed = true;
  }

  // Three hints with dynamic-shortcut bodies — translation keys split
  // around the kbd marker so the formatted shortcut can be inserted
  // inline without a t() string interpolation hack.
  const total = 3;
  let isLast = $derived(idx === total - 1);
</script>

{#if !dismissed && visible}
  <div
    class="fixed z-40 bottom-5 right-5 w-[340px] bg-bg border border-bd2 rounded-xl shadow-2xl animate-fadeIn"
    role="dialog"
    aria-label={t("modals.hints.dialogLabel")}
  >
    <div class="px-4 pt-3 pb-2 flex items-baseline gap-2">
      <span class="text-2xs font-mono uppercase tracking-wider text-yeld">
        {t("modals.hints.tipCounter", {
          n: String(idx + 1),
          total: String(total),
        })}
      </span>
      <button
        onclick={dismiss}
        class="ml-auto text-t3 hover:text-char text-sm leading-none w-6 h-6 flex items-center justify-center rounded-sm hover:bg-s2"
        aria-label={t("modals.hints.dismissAria")}
        title={t("modals.hints.dismissTitle")}
      >
        ×
      </button>
    </div>
    <div class="px-4 pb-3">
      {#if idx === 0}
        <div class="font-serif text-base text-char mb-1.5">
          {t("modals.hints.paletteTitle")}
        </div>
        <div class="text-xs text-t2 leading-relaxed">
          {t("modals.hints.paletteBodyPre")}<kbd
            class="px-1.5 py-0.5 rounded-sm bg-s2 text-2xs font-mono text-char border border-bd"
          >{SK.palette}</kbd>{t("modals.hints.paletteBodyPost")}
        </div>
      {:else if idx === 1}
        <div class="font-serif text-base text-char mb-1.5">
          {t("modals.hints.pathsTitle")}
        </div>
        <div class="text-xs text-t2 leading-relaxed">
          {t("modals.hints.pathsBodyPre")}<kbd
            class="px-1.5 py-0.5 rounded-sm bg-s2 text-2xs font-mono text-char border border-bd"
          >{SK.newDirection}</kbd>{t("modals.hints.pathsBodyMid")}<em>{t("modals.hints.pathsBranchThis")}</em>{t("modals.hints.pathsBodyPost")}<em>{t("modals.hints.pathsBodyPath")}</em>{t("modals.hints.pathsBodyTail")}
        </div>
      {:else}
        <div class="font-serif text-base text-char mb-1.5">
          {t("modals.hints.decideTitle")}
        </div>
        <div class="text-xs text-t2 leading-relaxed">
          {t("modals.hints.decideBodyPre")}<strong>{t("modals.hints.decideBodyPaths")}</strong>{t("modals.hints.decideBodyMid")}<strong>{t("modals.hints.decideBodyMatrix")}</strong>{t("modals.hints.decideBodyTail")}
        </div>
      {/if}
    </div>
    <div class="px-4 py-2 border-t border-bd flex items-center gap-2">
      <div class="flex gap-1">
        {#each Array(total) as _, i (i)}
          <span
            class="w-1.5 h-1.5 rounded-full {i === idx ? 'bg-yel' : 'bg-bd2'}"
          ></span>
        {/each}
      </div>
      <button onclick={dismiss} class="ml-auto text-xs text-t3 hover:text-char">
        {t("modals.hints.skip")}
      </button>
      {#if isLast}
        <button
          onclick={dismiss}
          class="text-xs px-3 py-1 rounded-sm bg-yel text-on-yel hover:bg-yel2"
        >
          {t("modals.hints.gotIt")}
        </button>
      {:else}
        <button
          onclick={() => { idx = idx + 1; }}
          class="text-xs px-3 py-1 rounded-sm bg-yel text-on-yel hover:bg-yel2"
        >
          {t("modals.hints.nextTip")}
        </button>
      {/if}
    </div>
  </div>
{/if}
