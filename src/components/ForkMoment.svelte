<script lang="ts">
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    pathName: string | null;
    onDone: () => void;
  }

  let { pathName, onDone }: Props = $props();
  let t = $derived(tr());
  let visible = $state(false);

  $effect(() => {
    if (!pathName) {
      visible = false;
      return;
    }
    visible = true;
    const t1 = window.setTimeout(() => { visible = false; }, 1200);
    const t2 = window.setTimeout(() => onDone(), 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  });
</script>

{#if pathName}
  <div
    class="fixed inset-0 z-60 pointer-events-none flex items-center justify-center transition-opacity duration-300 {visible ? 'opacity-100' : 'opacity-0'}"
  >
    <div class="flex flex-col items-center">
      <svg width="160" height="180" viewBox="0 0 160 180">
        <!-- Parent line -->
        <line x1="80" y1="0" x2="80" y2="90" stroke="var(--bd2)" stroke-width="2" />
        <!-- Split -->
        <path
          d="M 80 90 Q 80 110 55 120 L 40 160"
          stroke="var(--bd2)"
          stroke-width="2"
          fill="none"
          class="fork-branch fork-branch-left"
        />
        <path
          d="M 80 90 Q 80 110 105 120 L 120 160"
          stroke="var(--yel)"
          stroke-width="2.5"
          fill="none"
          class="fork-branch fork-branch-right"
        />
        <circle cx="120" cy="160" r="6" fill="var(--yel)" />
      </svg>

      <div class="mt-2 text-center animate-slideUp">
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

<style>
  .fork-branch {
    stroke-dasharray: 140;
    stroke-dashoffset: 140;
    animation: draw 700ms ease-out forwards;
  }
  .fork-branch-left {
    animation-delay: 120ms;
  }
  .fork-branch-right {
    animation-delay: 240ms;
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }
</style>
