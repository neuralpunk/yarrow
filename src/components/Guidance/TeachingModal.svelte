<script lang="ts">
  // The core guidance surface — a centered overlay with an illustration,
  // eyebrow, title, body, optional aside, and up to two action buttons.

  import type { GuidanceDef, GuidanceAction } from "../../lib/guidance";
  import { renderInlines } from "../../lib/guidance";
  import { guidance } from "../../lib/guidanceStore.svelte";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    def: GuidanceDef;
  }

  let { def }: Props = $props();

  let t = $derived(tr());

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") guidance.dismiss();
      if (e.key === "Enter") runAction(def.primary, "primary");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function runAction(a: GuidanceAction | undefined, which: "primary" | "secondary") {
    if (!a) return;
    let keepOpen: void | boolean = undefined;
    if (a.run) keepOpen = await a.run();
    const overrides = guidance.overrideActions;
    const override = which === "primary" ? overrides?.onPrimary : overrides?.onSecondary;
    if (override) override();
    if (keepOpen !== true) guidance.dismiss();
  }

  let Illustration = $derived(def.illustration);
  let parts = $derived(renderInlines(def.body));
  let asideParts = $derived(def.aside ? renderInlines(def.aside) : null);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-60 flex items-center justify-center bg-char/25 animate-fadeIn"
  onmousedown={() => guidance.dismiss()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-[540px] max-w-[92vw] bg-bg border border-bd2 rounded-2xl shadow-2xl overflow-hidden animate-slideUp"
    onmousedown={(e) => e.stopPropagation()}
  >
    {#if Illustration}
      <div class="px-8 pt-8 pb-2 flex items-center justify-center">
        <Illustration />
      </div>
    {/if}
    <div class="px-8 pt-4 pb-8">
      {#if def.eyebrow}
        <div class="text-2xs text-yeld uppercase tracking-[0.2em] font-semibold mb-3 font-sans">
          {def.eyebrow}
        </div>
      {/if}
      <h2 class="font-serif text-[26px] leading-[1.15] text-char mb-4 tracking-tight">
        {def.title}
      </h2>
      <p class="font-sans text-[15px] leading-[1.65] text-ch2 mb-4">
        {#each parts as p, i (i)}
          {#if p.kind === "bold"}<strong class="text-char font-medium">{p.value}</strong>
          {:else if p.kind === "italic"}<em class="text-accent2">{p.value}</em>
          {:else}<span>{p.value}</span>{/if}
        {/each}
      </p>
      {#if asideParts}
        <p class="font-serif italic text-[14px] leading-[1.6] text-t2 pt-3 border-t border-bd/60">
          {#each asideParts as p, i (i)}
            {#if p.kind === "bold"}<strong class="text-char font-medium">{p.value}</strong>
            {:else if p.kind === "italic"}<em class="text-accent2">{p.value}</em>
            {:else}<span>{p.value}</span>{/if}
          {/each}
        </p>
      {/if}
      <div class="mt-6 flex items-center gap-2 justify-end">
        <button
          onclick={() => guidance.markSeen(def.key)}
          class="text-xs text-t3 hover:text-t2 mr-auto"
          title={t("modals.guidance.stopShowingTitle")}
        >
          {t("modals.guidance.stopShowing")}
        </button>
        {#if def.secondary}
          <button
            onclick={() => runAction(def.secondary, "secondary")}
            class="px-4 py-2 rounded-md text-sm text-ch2 hover:bg-s2 transition"
          >
            {def.secondary.label}
          </button>
        {/if}
        {#if def.primary}
          <!-- svelte-ignore a11y_autofocus -->
          <button
            onclick={() => runAction(def.primary, "primary")}
            class={def.primary.tone === "danger"
              ? "px-4 py-2 rounded-md text-sm bg-danger/90 text-white hover:bg-danger transition"
              : "btn-yel px-4 py-2 rounded-md text-sm font-medium"}
            autofocus
          >
            {def.primary.label}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
