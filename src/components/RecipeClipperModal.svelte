<script lang="ts">
  import { api } from "../lib/tauri";
  import type { Note } from "../lib/types";
  import Modal from "./Modal.svelte";
  import { tr, type StringKey } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    onClipped: (note: Note) => void;
  }

  let { open, onClose, onClipped }: Props = $props();
  let t = $derived(tr());

  type ErrorKind = "bad-url" | "no-network" | "blocked" | "no-recipe" | "unknown";

  function categorise(msg: string): ErrorKind {
    const m = msg.toLowerCase();
    if (m.includes("cloudflare") || m.includes("bot protection")) return "blocked";
    if (
      m.includes("not a valid url") ||
      m.includes("only http(s)") ||
      m.includes("redirect to non-http") ||
      m.includes("malformed redirect") ||
      m.includes("private / loopback") ||
      m.includes("private host")
    )
      return "bad-url";
    if (m.includes("no recipe metadata")) return "no-recipe";
    if (
      m.includes("fetch failed") ||
      m.includes("couldn't decode") ||
      m.includes("too many redirects") ||
      m.includes("redirect with no location") ||
      m.includes("server returned http") ||
      m.includes("client init failed")
    )
      return "no-network";
    return "unknown";
  }

  function presentationFor(kind: ErrorKind): {
    titleKey: StringKey;
    bodyKey: StringKey;
    actionKey: StringKey;
  } {
    switch (kind) {
      case "bad-url":
        return {
          titleKey: "modals.recipeClip.err.badUrl.title",
          bodyKey: "modals.recipeClip.err.badUrl.body",
          actionKey: "modals.recipeClip.err.tryAgain",
        };
      case "no-network":
        return {
          titleKey: "modals.recipeClip.err.noNetwork.title",
          bodyKey: "modals.recipeClip.err.noNetwork.body",
          actionKey: "modals.recipeClip.err.tryAgain",
        };
      case "blocked":
        return {
          titleKey: "modals.recipeClip.err.blocked.title",
          bodyKey: "modals.recipeClip.err.blocked.body",
          actionKey: "modals.recipeClip.err.tryDifferent",
        };
      case "no-recipe":
        return {
          titleKey: "modals.recipeClip.err.noRecipe.title",
          bodyKey: "modals.recipeClip.err.noRecipe.body",
          actionKey: "modals.recipeClip.err.tryDifferent",
        };
      default:
        return {
          titleKey: "modals.recipeClip.err.unknown.title",
          bodyKey: "modals.recipeClip.err.unknown.body",
          actionKey: "modals.recipeClip.err.tryAgain",
        };
    }
  }

  let url = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let inputRef = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!open) return;
    url = "";
    error = null;
    busy = false;
    const id = window.setTimeout(() => inputRef?.focus(), 60);
    return () => window.clearTimeout(id);
  });

  async function submit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    busy = true;
    error = null;
    try {
      const note = await api.clipRecipe(trimmed);
      onClipped(note);
      onClose();
    } catch (e) {
      error = String(e).replace(/^Error: /, "");
    } finally {
      busy = false;
    }
  }

  let errorKind = $derived(error ? categorise(error) : null);
  let presentation = $derived(errorKind ? presentationFor(errorKind) : null);
</script>

<Modal
  {open}
  onClose={busy ? () => {} : onClose}
  title={t("modals.recipeClip.title")}
  width="w-[520px]"
>
  {#snippet children()}
    {#if !presentation}
      <p class="text-sm text-t2 mb-4 leading-relaxed">
        {t("modals.recipeClip.body")}
      </p>
    {/if}

    <label for="recipe-url-input" class="block text-2xs uppercase tracking-wider text-t3 mb-1.5">
      {t("modals.recipeClip.urlLabel")}
    </label>
    <input
      id="recipe-url-input"
      bind:this={inputRef}
      type="url"
      inputmode="url"
      bind:value={url}
      oninput={() => {
        if (error) error = null;
      }}
      onkeydown={(e) => {
        if (e.key === "Enter" && !busy) {
          e.preventDefault();
          void submit();
        }
      }}
      placeholder="https://www.kingarthurbaking.com/recipes/…"
      disabled={busy}
      class="w-full px-3 py-2 text-sm bg-bg border border-bd2 rounded-md font-mono text-char focus:outline-hidden focus:border-yel disabled:opacity-60"
    />

    {#if presentation}
      <div
        role="status"
        aria-live="polite"
        class="mt-5 px-5 py-5 bg-yelp/30 border border-yel/30 rounded-lg flex flex-col items-center text-center"
      >
        <span class="block w-[88px] h-[88px] text-yeld mb-3" aria-hidden="true">
          {#if errorKind === "bad-url"}
            <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M24 16 q-2 0 -2 3 L23 84 q0 3 3 3 L73 84 q3 0 3 -3 L74 30 L60 14 Z" />
              <path d="M60 14 L60 28 q0 2 2 2 L74 30" />
              <path d="M40 46 q0 -10 10 -10 q10 0 10 9 q0 6 -6 9 q-3 1 -3 5 L51 62" />
              <circle cx="51" cy="69" r="1.6" fill="currentColor" />
            </svg>
          {:else if errorKind === "no-network"}
            <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 50 q0 -5 6 -5 L34 45 q4 0 4 4 L38 51 q0 4 -4 4 L20 55 q-6 0 -6 -5 Z" />
              <line x1="38" y1="48" x2="42" y2="48" />
              <line x1="38" y1="52" x2="42" y2="52" />
              <path d="M86 50 q0 -5 -6 -5 L66 45 q-4 0 -4 4 L62 51 q0 4 4 4 L80 55 q6 0 6 -5 Z" />
              <line x1="62" y1="48" x2="58" y2="48" />
              <line x1="62" y1="52" x2="58" y2="52" />
              <circle cx="48" cy="50" r="1" fill="currentColor" />
              <circle cx="52" cy="48" r="1" fill="currentColor" />
              <circle cx="50" cy="52" r="1" fill="currentColor" />
              <path d="M14 50 q-6 4 -2 10 q4 6 -2 10" />
              <path d="M86 50 q6 4 2 10 q-4 6 2 10" />
            </svg>
          {:else if errorKind === "blocked"}
            <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M50 14 q-2 0 -3 1 q-10 5 -22 6 q-2 0 -2 2 q0 28 25 60 q1 1 2 1 q1 0 2 -1 q25 -32 25 -60 q0 -2 -2 -2 q-12 -1 -22 -6 q-1 -1 -3 -1 Z" />
              <circle cx="50" cy="44" r="5" />
              <line x1="50" y1="49" x2="50" y2="58" />
            </svg>
          {:else if errorKind === "no-recipe"}
            <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="50" cy="62" rx="32" ry="9" />
              <ellipse cx="50" cy="60" rx="24" ry="6" />
              <line x1="28" y1="76" x2="34" y2="92" />
              <line x1="26" y1="78" x2="32" y2="93" />
              <line x1="30" y1="74" x2="36" y2="91" />
              <path d="M70 75 L74 92" />
              <path d="M68 76 q1 -2 4 -2 q3 0 4 2 L74 92" />
              <path d="M44 32 q0 -8 7 -8 q7 0 7 7 q0 5 -5 7 q-2 1 -2 4" />
              <circle cx="51" cy="48" r="1.4" fill="currentColor" />
            </svg>
          {:else}
            <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M28 52 L70 52 L66 84 q-1 4 -5 4 L33 88 q-4 0 -5 -4 Z" />
              <ellipse cx="49" cy="90" rx="28" ry="2.5" />
              <path d="M70 58 q12 0 12 10 q0 10 -12 10" />
              <path d="M40 42 q4 -6 0 -10 q-4 -6 0 -12" />
              <path d="M50 38 q5 -5 0 -10 q-5 -5 0 -10" />
              <path d="M60 42 q4 -6 0 -10 q-4 -6 0 -12" />
            </svg>
          {/if}
        </span>
        <h3 class="font-serif text-[20px] leading-tight text-char mb-2">
          {t(presentation.titleKey)}
        </h3>
        <p class="text-sm text-t2 leading-relaxed max-w-[400px] mb-4">
          {t(presentation.bodyKey)}
        </p>
        <button
          type="button"
          onclick={() => {
            error = null;
            window.setTimeout(() => inputRef?.focus(), 0);
          }}
          class="text-xs px-3 py-1.5 rounded-md border border-bd2 text-char hover:border-yel hover:bg-yelp transition"
        >
          {t(presentation.actionKey)}
        </button>
      </div>
    {:else}
      <p class="text-2xs text-t3 mt-2 leading-relaxed">
        {t("modals.recipeClip.privacy")}
      </p>
    {/if}

    <div class="flex justify-end gap-2 mt-5 pt-4 border-t border-bd">
      <button
        type="button"
        onclick={onClose}
        disabled={busy}
        class="px-3 py-1.5 text-sm text-t2 hover:text-char disabled:opacity-60"
      >
        {t("modals.recipeClip.cancel")}
      </button>
      <button
        type="button"
        onclick={() => void submit()}
        disabled={busy || !url.trim()}
        class="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-60"
      >
        {busy ? t("modals.recipeClip.clipping") : t("modals.recipeClip.confirm")}
      </button>
    </div>
  {/snippet}
</Modal>
