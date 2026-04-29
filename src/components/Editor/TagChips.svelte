<script lang="ts">
  import { tagPillClass } from "../../lib/tagStyles";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    initial: string[];
    onCommit: (tags: string[]) => Promise<void> | void;
    suggestions?: string[];
  }

  let { initial, onCommit, suggestions = [] }: Props = $props();
  let t = $derived(tr());

  // svelte-ignore state_referenced_locally
  let tags = $state<string[]>(initial);
  let draft = $state("");
  let focused = $state(false);
  let inputRef = $state<HTMLInputElement | null>(null);
  let dirty = false;
  let lastInitialKey = "";
  $effect(() => {
    if (lastInitialKey === "") lastInitialKey = initial.join("");
  });

  $effect(() => {
    const key = initial.join("");
    if (key !== lastInitialKey) {
      lastInitialKey = key;
      if (!dirty) {
        tags = initial;
        draft = "";
      }
    }
  });

  $effect(() => {
    void tags;
    if (!dirty) return;
    const id = window.setTimeout(() => {
      void onCommit(tags);
      dirty = false;
    }, 400);
    return () => window.clearTimeout(id);
  });

  $effect(() => {
    return () => {
      if (dirty) {
        try {
          void onCommit(tags);
        } catch {}
        dirty = false;
      }
    };
  });

  function addTag(raw: string) {
    let tg = raw.trim();
    while (tg.startsWith("#")) tg = tg.slice(1);
    if (!tg) return;
    if (tags.includes(tg)) return;
    tags = [...tags, tg];
    dirty = true;
  }

  function removeAt(i: number) {
    tags = tags.filter((_, idx) => idx !== i);
    dirty = true;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!e.isComposing && (e.key === "Enter" || e.key === "," || (e.key === " " && draft.trim()))) {
      e.preventDefault();
      addTag(draft);
      draft = "";
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      e.preventDefault();
      removeAt(tags.length - 1);
    } else if (e.key === "Escape") {
      draft = "";
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  let matches = $derived(
    draft.trim() && focused
      ? suggestions
          .filter((s) => s.toLowerCase().includes(draft.trim().toLowerCase()))
          .filter((s) => !tags.includes(s))
          .slice(0, 6)
      : [],
  );
</script>

<div class="relative flex items-center flex-wrap gap-1.5 -mt-1 mb-3">
  {#if tags.length === 0 && !focused}
    <button
      onclick={() => inputRef?.focus()}
      class="text-2xs italic text-t3 hover:text-yeld font-serif"
      title={t("editor.tagChips.addTagsTitle")}
    >
      {t("editor.tagChips.addTags")}
    </button>
  {/if}
  {#each tags as tag, i (`${tag}:${i}`)}
    <span class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-2xs font-mono group {tagPillClass(tag)}">
      <span>#{tag}</span>
      <button
        onclick={() => removeAt(i)}
        class="w-4 h-4 flex items-center justify-center rounded-full hover:bg-yel hover:text-on-yel text-yeld/60 opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-yel focus-visible:ring-offset-1 focus-visible:ring-offset-bg transition-opacity duration-150"
        title={t("editor.tagChips.removeTitle", { tag })}
        aria-label={t("editor.tagChips.removeAria", { tag })}
      >
        ×
      </button>
    </span>
  {/each}
  <input
    bind:this={inputRef}
    bind:value={draft}
    onkeydown={onKeyDown}
    onfocus={() => (focused = true)}
    onblur={() => {
      setTimeout(() => (focused = false), 100);
      if (draft.trim()) {
        addTag(draft);
        draft = "";
      }
    }}
    placeholder={tags.length === 0 ? "" : t("editor.tagChips.addTagPlaceholder")}
    class="bg-transparent border-0 outline-hidden text-2xs font-mono text-char placeholder:text-t3 w-20 min-w-[64px]"
  />

  {#if matches.length > 0}
    <div class="absolute z-30 left-0 top-full mt-1 bg-bg border border-bd2 rounded-md shadow-lg py-1 w-44">
      {#each matches as m (m)}
        <button
          onmousedown={(e) => {
            e.preventDefault();
            addTag(m);
            draft = "";
            inputRef?.focus();
          }}
          class="w-full text-left px-2.5 py-1 text-xs text-char hover:bg-yelp font-mono"
        >
          #{m}
        </button>
      {/each}
    </div>
  {/if}
</div>
