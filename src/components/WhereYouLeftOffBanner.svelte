<script lang="ts">
  import { relativeBanner, type LeftOffState } from "../lib/leftOff";
  import { tr } from "../lib/i18n/index.svelte";

  /**
   * One-line welcome-back banner shown once per workspace-open when a
   * fresh (<72h) bookmark exists. Three actions: pick up where you
   * left off, dismiss for this session, or never again. See
   * `lib/leftOff.ts` for the persistence shape.
   */
  interface Props {
    state: LeftOffState;
    onResume: () => void;
    onDismiss: () => void;
    onHideAlways: () => void;
  }

  let { state, onResume, onDismiss, onHideAlways }: Props = $props();
  let t = $derived(tr());
  let path = $derived(state.path || "main");
</script>

<div class="yarrow-wilo-banner" role="status" aria-live="polite">
  <div class="l1">
    {t("modals.leftOff.welcome", { when: relativeBanner(state.at) })}
  </div>
  <div class="l2">
    {t("modals.leftOff.pausedIn")}
    <em>{state.title}</em>
    {t("modals.leftOff.onPath")}
    <em>{path}</em>
    {t("modals.leftOff.pathSuffix")}
  </div>
  {#if state.snippet}
    <div class="l3">“{state.snippet}”</div>
  {/if}
  <div class="actions">
    <button
      onclick={onResume}
      class="px-3 py-1 text-xs rounded-md bg-yel text-on-yel hover:opacity-95"
    >
      {t("modals.leftOff.pickUp")}
    </button>
    <button
      onclick={onDismiss}
      class="px-3 py-1 text-xs rounded-md bg-bg border border-bd text-t2 hover:text-char hover:border-bd2"
    >
      {t("modals.leftOff.startElsewhere")}
    </button>
    <button
      onclick={onHideAlways}
      class="hide px-2 py-1 text-2xs rounded-md hover:text-t2"
      title={t("modals.leftOff.hideTitle")}
    >
      {t("modals.leftOff.hideNext")}
    </button>
  </div>
</div>
