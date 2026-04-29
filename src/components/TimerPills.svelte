<script lang="ts">
  import {
    dismissTimer,
    formatRemaining,
    subscribeTimers,
    type RunningTimer,
  } from "../lib/timers";

  // 2.2.0 — running-timer overlay. A small stack of pills in the
  // bottom-right of the app showing each active timer, the time
  // remaining, and a dismiss button. Mounted once at AppShell so the
  // stack survives note switches, focus mode toggles, etc.

  interface Props {
    /** Click-to-jump handler. When provided and the timer carries an
     *  origin, the pill body becomes a button that takes the user back
     *  to the note (and scenario) the timer was started from. */
    onJump?: (slug: string, path: string) => void;
  }
  let { onJump }: Props = $props();

  let timers = $state<RunningTimer[]>([]);
  let now = $state<number>(Date.now());

  $effect(() => subscribeTimers((t) => { timers = t; }));

  // Tick once a second while we have timers, so the countdown updates.
  // No timers → no interval, no battery hit.
  $effect(() => {
    if (timers.length === 0) return;
    const id = window.setInterval(() => { now = Date.now(); }, 250);
    return () => window.clearInterval(id);
  });

  function handleJump(t: RunningTimer) {
    if (!onJump || !t.origin) return;
    onJump(t.origin.slug, t.origin.path);
  }
</script>

{#if timers.length > 0}
  <div
    class="fixed z-180 flex flex-col items-end gap-2 pointer-events-none"
    style:right="max(20px, env(safe-area-inset-right))"
    style:bottom="calc(max(28px, env(safe-area-inset-bottom)) + 60px)"
  >
    {#each timers as t (t.id)}
      {@const remaining = Math.max(0, t.endsAt - now)}
      {@const fired = t.fired || remaining === 0}
      {@const canJump = !!(onJump && t.origin)}
      {@const jumpTitle = canJump
        ? `Go back to “${t.origin?.label || t.origin?.slug || "the note"}”${t.origin && t.origin.path && t.origin.path !== "main" ? ` on ${t.origin.path}` : ""}`
        : ""}
      <div
        class="pointer-events-auto flex items-center gap-1 pl-1 pr-2 py-1 rounded-full border-2 shadow-xl animate-slideUp transition-colors {fired
          ? 'bg-yel border-yel text-on-yel'
          : 'bg-bg border-yel text-char'}"
        style:min-width="184px"
      >
        <button
          type="button"
          onclick={canJump ? () => handleJump(t) : undefined}
          tabindex={canJump ? 0 : -1}
          aria-label={canJump ? jumpTitle : t.label}
          title={canJump ? jumpTitle : t.label}
          class="flex-1 min-w-0 flex items-center gap-3 pl-2.5 pr-1 py-1 rounded-full text-left bg-transparent border-0 transition {canJump
            ? 'cursor-pointer hover:bg-yelp/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yel'
            : 'cursor-default'}"
        >
          <span
            aria-hidden="true"
            class="grid place-items-center w-7 h-7 rounded-full shrink-0 {fired
              ? 'bg-yel text-on-yel'
              : 'bg-s2 text-yeld'}"
          >
            {#if fired}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12V8a5 5 0 0 1 10 0v4" />
                <path d="M2 12h12" />
                <path d="M6.5 14.5a1.6 1.6 0 0 0 3 0" />
              </svg>
            {:else}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 4.5V8l2 1.5" />
              </svg>
            {/if}
          </span>
          <span class="flex-1 min-w-0 leading-tight">
            <span class="block font-mono text-[14px] tabular-nums">
              {fired ? "done" : formatRemaining(remaining)}
            </span>
            <span class="block text-[11px] text-t2 truncate font-serif italic">
              {t.label}
            </span>
          </span>
          {#if canJump}
            <span
              aria-hidden="true"
              class="shrink-0 w-5 h-5 grid place-items-center text-yeld opacity-70"
              title=""
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.5 3.5 L4.5 7 L9.5 10.5" />
                <path d="M4.5 7 H12" />
              </svg>
            </span>
          {/if}
        </button>
        <button
          type="button"
          onclick={(e) => { e.stopPropagation(); dismissTimer(t.id); }}
          aria-label="Dismiss timer"
          title="Dismiss"
          class="shrink-0 w-7 h-7 grid place-items-center rounded-full transition {fired
            ? 'text-on-yel hover:bg-yeld/30'
            : 'text-yeld bg-yelp hover:bg-yel hover:text-on-yel border border-yel/40'}"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5" />
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}
