<script lang="ts">
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    currentPath: string;
    onCreate: (condition: string) => void;
  }

  let { currentPath, onCreate }: Props = $props();

  let t = $derived(tr());
  let value = $state("");
  let inputRef = $state<HTMLTextAreaElement | null>(null);

  $effect(() => {
    const tid = window.setTimeout(() => inputRef?.focus(), 120);
    return () => window.clearTimeout(tid);
  });

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    value = "";
  }

  let safeTemplate = $derived(t("paths.empty.safe"));
  let safeParts = $derived(safeTemplate.split("{name}"));
  let safeBefore = $derived(safeParts[0]);
  let safeAfter = $derived(safeParts[1] ?? "");

  let presets = $derived([
    t("paths.empty.preset1"),
    t("paths.empty.preset2"),
    t("paths.empty.preset3"),
    t("paths.empty.preset4"),
  ]);
</script>

<div class="h-full w-full overflow-y-auto flex items-center justify-center p-10">
  <div class="max-w-[560px] w-full text-center">
    <svg
      width="420"
      height="70"
      viewBox="0 0 420 70"
      class="mx-auto mb-6 opacity-90"
    >
      <line
        x1="10"
        y1="35"
        x2="380"
        y2="35"
        stroke="var(--yel)"
        stroke-width="5"
        stroke-linecap="round"
      />
      <circle cx="10" cy="35" r="8" fill="var(--yel)" />
      <circle cx="380" cy="35" r="10" fill="var(--bg)" stroke="var(--yel)" stroke-width="2.5" />
      <text
        x="10"
        y="18"
        text-anchor="start"
        class="mono"
        style:font-size="9px"
        style:fill="var(--t3)"
        style:letter-spacing="0.2em"
      >
        {t("paths.empty.started")}
      </text>
      <text
        x="380"
        y="18"
        text-anchor="middle"
        class="serif"
        font-style="italic"
        style:font-size="12px"
        style:fill="var(--yeld)"
      >
        {currentPath}
      </text>
      <text
        x="380"
        y="60"
        text-anchor="middle"
        class="mono"
        style:font-size="9px"
        style:fill="var(--t3)"
        style:letter-spacing="0.2em"
      >
        {t("paths.empty.today")}
      </text>
    </svg>

    <div class="font-serif text-[30px] text-char leading-tight mb-2">
      {t("paths.empty.heading")}
    </div>
    <p class="text-sm text-t2 leading-relaxed mb-6">
      {t("paths.empty.body")}
    </p>

    <textarea
      bind:this={inputRef}
      bind:value
      onkeydown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          submit();
        }
      }}
      rows={2}
      placeholder={t("paths.condition.placeholder")}
      class="w-full px-4 py-3 bg-bg-soft border border-bd rounded-md text-char text-base font-serif italic placeholder:not-italic placeholder:text-t3/70 resize-none text-center"
    ></textarea>
    <div class="mt-2 flex flex-wrap gap-1.5 justify-center">
      {#each presets as s (s)}
        <button
          onclick={() => {
            value = s;
            inputRef?.focus();
          }}
          class="text-2xs px-2 py-0.5 bg-s2 text-t2 rounded-full hover:bg-s3 hover:text-char transition"
        >
          {s}
        </button>
      {/each}
    </div>

    <div class="mt-5">
      <button
        onclick={submit}
        disabled={!value.trim()}
        class="btn-yel px-4 py-2 text-sm rounded-md disabled:opacity-40"
      >
        {t("paths.empty.start")}
      </button>
    </div>
    <div class="mt-3 text-2xs text-t3">
      {safeBefore}<span class="text-t2">{currentPath}</span>{safeAfter}
    </div>
  </div>
</div>
