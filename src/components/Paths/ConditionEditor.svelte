<script lang="ts">
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    branch: string;
    initial: string;
    onSave: (next: string) => void;
    onCancel: () => void;
    /** Optional copy overrides. */
    kicker?: string;
    heading?: string;
    lead?: string;
    saveLabel?: string;
  }

  let { branch, initial, onSave, onCancel, kicker, heading, lead, saveLabel }: Props = $props();

  let t = $derived(tr());
  // svelte-ignore state_referenced_locally
  let value = $state(initial);
  let inputRef = $state<HTMLTextAreaElement | null>(null);

  $effect(() => {
    const tid = window.setTimeout(() => {
      const el = inputRef;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 30);
    return () => window.clearTimeout(tid);
  });

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function commit() {
    onSave(value.trim());
  }

  let headingTpl = $derived(heading ?? t("paths.condition.heading"));
  let headingParts = $derived(headingTpl.split("{name}"));
  let headingBefore = $derived(headingParts[0]);
  let headingAfter = $derived(headingParts[1] ?? "");

  let presets = $derived([
    t("paths.condition.preset1"),
    t("paths.condition.preset2"),
    t("paths.condition.preset3"),
    t("paths.condition.preset4"),
    t("paths.condition.preset5"),
  ]);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-60 flex items-center justify-center bg-bg/60 animate-fadeIn"
  onclick={onCancel}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-[min(520px,92vw)] bg-bg border border-bd2 rounded-xl shadow-2xl p-5"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="text-2xs uppercase tracking-[0.2em] font-mono text-t3 mb-1">
      {kicker ?? t("paths.condition.kicker")}
    </div>
    <div class="font-serif text-[22px] text-char leading-tight mb-2">
      {headingBefore}<span class="italic text-yeld">{branch}</span>{headingAfter}
    </div>
    <p class="text-xs text-t2 mb-3 leading-relaxed">
      {lead ?? t("paths.condition.lead")}
    </p>
    <textarea
      bind:this={inputRef}
      bind:value
      onkeydown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          commit();
        }
      }}
      rows={2}
      placeholder={t("paths.condition.placeholder")}
      class="w-full px-3 py-2 bg-bg-soft border border-bd rounded-md text-char text-sm resize-none font-serif italic placeholder:not-italic placeholder:text-t3/70"
    ></textarea>
    <div class="mt-2 flex flex-wrap gap-1">
      {#each presets as s (s)}
        <button
          onclick={() => (value = s)}
          class="text-2xs px-2 py-0.5 bg-s2 text-t2 rounded-full hover:bg-s3 hover:text-char transition"
        >
          {s}
        </button>
      {/each}
    </div>
    <div class="mt-4 flex items-center justify-end gap-2">
      <button onclick={onCancel} class="px-3 py-1.5 text-sm text-t2 hover:text-char">
        {t("paths.condition.cancel")}
      </button>
      {#if initial}
        <button
          onclick={() => onSave("")}
          class="px-3 py-1.5 text-sm text-t3 hover:text-char"
          title={t("paths.condition.clearTitle")}
        >
          {t("paths.condition.clear")}
        </button>
      {/if}
      <button onclick={commit} class="btn-yel px-3 py-1.5 text-sm rounded-md">
        {saveLabel ?? t("paths.condition.save")}
      </button>
    </div>
  </div>
</div>
