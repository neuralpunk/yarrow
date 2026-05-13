<script lang="ts">
  import { tr } from "../lib/i18n/index.svelte";
  import {
    animate,
    createTimeline,
    drawPath,
    fadeIn,
    reducedMotion,
    utils,
  } from "../lib/anim.svelte";

  interface Props {
    pathName: string | null;
    onDone: () => void;
  }

  let { pathName, onDone }: Props = $props();
  let t = $derived(tr());
  let visible = $state(false);

  let trunkEl = $state<SVGLineElement | null>(null);
  let leftEl = $state<SVGPathElement | null>(null);
  let rightEl = $state<SVGPathElement | null>(null);
  let glowEl = $state<SVGCircleElement | null>(null);
  let dotEl = $state<SVGCircleElement | null>(null);
  let labelEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!pathName) {
      visible = false;
      return;
    }
    visible = true;
    runAnimation();
    const t2 = window.setTimeout(() => onDone(), 1700);
    return () => {
      window.clearTimeout(t2);
    };
  });

  function runAnimation() {
    if (!trunkEl || !leftEl || !rightEl || !glowEl || !dotEl) return;
    if (reducedMotion()) return;

    // Reset everything to a hidden starting state.
    utils.set(glowEl, { r: 0, opacity: 0.45 });
    utils.set(dotEl, { scale: 0, opacity: 0 });
    if (labelEl) utils.set(labelEl, { opacity: 0, y: 6 });

    // Draw the trunk first, then bloom the glow at the fork point,
    // then unfurl both branches. The right (the new path) lifts on a
    // beat after the left so the eye follows the divergence.
    const tl = createTimeline();
    tl
      .add(trunkEl, {}, 0)
      .add(glowEl, {
        r: [0, 16],
        opacity: [0.4, 0.18],
        duration: 480,
        ease: "outQuad",
      }, 400);

    drawPath(trunkEl, { duration: 480, ease: "outQuart" });
    drawPath(leftEl, { duration: 700, delay: 580, ease: "outQuart" });
    drawPath(rightEl, { duration: 780, delay: 700, ease: "outQuart" });

    animate(dotEl, {
      scale: [0, 1],
      opacity: [0, 1],
      duration: 600,
      delay: 1280,
      ease: "outBack(2)",
    });

    if (labelEl) {
      animate(labelEl, {
        opacity: [0, 1],
        y: [6, 0],
        duration: 460,
        delay: 600,
        ease: "outQuad",
      });
    }

    // After-hold then fade out — gives the user a beat to read the
    // path name before the overlay dismisses.
    window.setTimeout(() => {
      const overlay = document.querySelector(".yarrow-fork-overlay");
      if (overlay) fadeIn(overlay, { duration: 240 });
    }, 0);
  }
</script>

{#if pathName}
  <div
    class="yarrow-fork-overlay fixed inset-0 z-60 pointer-events-none flex items-center justify-center transition-opacity duration-300 {visible ? 'opacity-100' : 'opacity-0'}"
  >
    <div class="flex flex-col items-center">
      <svg width="160" height="180" viewBox="0 0 160 180">
        <!-- Parent line -->
        <line
          bind:this={trunkEl}
          x1="80" y1="0" x2="80" y2="90"
          stroke="var(--bd2)"
          stroke-width="2"
        />
        <!-- Soft glow at the fork point -->
        <circle
          bind:this={glowEl}
          cx="80" cy="90"
          r="0"
          fill="var(--yel)"
          opacity="0.18"
        />
        <!-- Diverging paths -->
        <path
          bind:this={leftEl}
          d="M 80 90 Q 80 110 55 120 L 40 160"
          stroke="var(--bd2)"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
        />
        <path
          bind:this={rightEl}
          d="M 80 90 Q 80 110 105 120 L 120 160"
          stroke="var(--yel)"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
        />
        <!-- Destination marker -->
        <circle
          bind:this={dotEl}
          cx="120" cy="160" r="6"
          fill="var(--yel)"
          style:transform-box="fill-box"
          style:transform-origin="center"
        />
      </svg>

      <div bind:this={labelEl} class="mt-2 text-center">
        <div class="text-2xs uppercase tracking-wider text-t3">
          {t("paths.forkMoment.exploring")}
        </div>
        <div class="font-serif text-xl text-char mt-0.5">
          {pathName}
        </div>
      </div>
    </div>
  </div>
{/if}
