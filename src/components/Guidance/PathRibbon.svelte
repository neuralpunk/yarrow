<script lang="ts">
  // Teaching coach strip above the editor.

  import { guidance } from "../../lib/guidanceStore.svelte";
  import { GUIDANCE } from "../../lib/guidance";
  import { colorForPath } from "../../lib/pathAwareness";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    pathName: string;
    condition?: string | null;
    rootName: string;
    onSwitchPath: (name: string) => void;
    pathColorOverrides?: Record<string, string>;
    onToggleInlineDiff?: () => void;
    inlineDiffActive?: boolean;
    onOpenCompare?: () => void;
    onPromote?: () => void;
    onThrowAway?: () => void;
  }

  let {
    pathName,
    condition,
    rootName,
    onSwitchPath,
    pathColorOverrides,
    onToggleInlineDiff,
    inlineDiffActive,
    onOpenCompare,
    onPromote,
    onThrowAway,
  }: Props = $props();

  let t = $derived(tr());
  let def = GUIDANCE["path.stepInto.coach"];
  let onPath = $derived(
    !!pathName && pathName !== rootName && pathName !== "main" && pathName !== "master",
  );
  let accent = $derived(colorForPath(pathName, { overrides: pathColorOverrides }));
  let accentSoft = $derived(`color-mix(in srgb, ${accent} 12%, transparent)`);
</script>

{#if onPath && guidance.enabled}
  <div
    class="flex items-start gap-3 px-4 py-2.5 border-b border-bd animate-fadeIn"
    style:background="linear-gradient(to right, {accentSoft}, transparent 55%)"
    style:border-left="3px solid {accent}"
    role="status"
    aria-label={t("modals.pathRibbon.aria")}
  >
    <div class="flex-1 min-w-0">
      <div
        class="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-semibold font-sans"
        style:color={accent}
      >
        <span>{def?.eyebrow ?? t("modals.pathRibbon.eyebrowFallback")}</span>
        <span class="text-t3 normal-case tracking-normal font-normal font-serif italic truncate">
          — {pathName}{#if condition}
            {" "}· <span class="not-italic">{condition}</span>
          {/if}
        </span>
      </div>
      <div class="text-[12px] font-sans text-ch2 mt-0.5 leading-snug">
        {def?.body ?? t("modals.pathRibbon.bodyFallback")}
      </div>
    </div>

    <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
      {#if onToggleInlineDiff}
        <button
          onclick={onToggleInlineDiff}
          class="px-2.5 py-1 rounded text-[11px] font-sans font-medium border transition {inlineDiffActive
            ? 'bg-yel/90 text-on-yel border-yel'
            : 'border-bd2 bg-bg hover:bg-s2 text-ch2'}"
          title={t("modals.pathRibbon.diffTitle")}
        >
          {inlineDiffActive ? t("modals.pathRibbon.stopDiffing") : t("modals.pathRibbon.diffVsMain")}
        </button>
      {/if}
      {#if onOpenCompare}
        <button
          onclick={onOpenCompare}
          class="px-2.5 py-1 rounded-sm text-[11px] font-sans font-medium border border-bd2 bg-bg hover:bg-s2 text-ch2 transition"
          title={t("modals.pathRibbon.compareAllTitle")}
        >
          {t("modals.pathRibbon.compareAll")}
        </button>
      {/if}
      {#if onPromote}
        <button
          onclick={onPromote}
          class="px-2.5 py-1 rounded-sm text-[11px] font-sans font-medium bg-yel text-on-yel hover:opacity-90 transition"
          title={t("modals.pathRibbon.promoteTitle")}
          style:background={accent}
          style:color="white"
        >
          {t("modals.pathRibbon.promote")}
        </button>
      {/if}
      <button
        onclick={() => onSwitchPath(rootName)}
        class="px-2.5 py-1 rounded-sm text-[11px] font-sans font-medium border border-bd2 bg-bg hover:bg-s2 text-ch2 transition"
        title={t("modals.pathRibbon.backToMainTitle")}
      >
        {t("modals.pathRibbon.backToMain")}
      </button>
      {#if onThrowAway}
        <button
          onclick={onThrowAway}
          class="px-2.5 py-1 rounded-sm text-[11px] font-sans font-medium border border-bd2 bg-bg text-danger hover:bg-danger/10 transition"
          title={t("modals.pathRibbon.throwAwayTitle")}
        >
          {t("modals.pathRibbon.throwAway")}
        </button>
      {/if}
    </div>
  </div>
{/if}
