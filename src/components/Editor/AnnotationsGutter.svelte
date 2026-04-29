<script lang="ts">
  import type { Annotation } from "../../lib/types";
  import { relativeTime } from "../../lib/format";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    annotations: Annotation[];
    onChange: (next: Annotation[]) => void;
  }

  let { annotations, onChange }: Props = $props();
  let t = $derived(tr());

  let editingIdx = $state<number | null>(null);
  let draft = $state("");
  // svelte-ignore state_referenced_locally
  let prevLen = annotations.length;

  $effect(() => {
    const prev = prevLen;
    prevLen = annotations.length;
    if (annotations.length > prev) {
      const newest = annotations[annotations.length - 1];
      if (newest && !newest.body.trim() && editingIdx == null) {
        editingIdx = annotations.length - 1;
        draft = "";
      }
    }
  });

  function startEdit(i: number) {
    editingIdx = i;
    draft = annotations[i]?.body ?? "";
  }

  function commitEdit() {
    if (editingIdx == null) return;
    const next = annotations.slice();
    const body = draft.trim();
    if (!body) {
      next.splice(editingIdx, 1);
    } else {
      next[editingIdx] = { ...next[editingIdx], body };
    }
    editingIdx = null;
    draft = "";
    onChange(next);
  }

  function cancelEdit() {
    editingIdx = null;
    draft = "";
  }

  function remove(i: number) {
    const next = annotations.slice();
    next.splice(i, 1);
    onChange(next);
  }

  function parseAt(at?: string): number | null {
    if (!at) return null;
    const ms = Date.parse(at);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
</script>

<div>
  {#each annotations as a, i (i)}
    {@const editing = editingIdx === i}
    {@const when = parseAt(a.at)}
    <div class="yarrow-annotation{editing ? ' is-editing' : ''}">
      <div class="meta">
        <span>{when != null ? relativeTime(when) : t("editor.annotations.note")}</span>
        <button
          onclick={() => remove(i)}
          title={t("editor.annotations.removeTitle")}
          aria-label={t("editor.annotations.removeAria")}
        >
          ×
        </button>
      </div>
      {#if a.anchor}<div class="anchor">“{a.anchor}”</div>{/if}
      {#if editing}
        <!-- svelte-ignore a11y_autofocus -->
        <textarea
          autofocus
          bind:value={draft}
          onblur={commitEdit}
          onkeydown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commitEdit();
            }
          }}
          rows={3}
        ></textarea>
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={() => startEdit(i)}
          style:cursor="text"
          style:white-space="pre-wrap"
        >
          {#if a.body}
            {a.body}
          {:else}
            <em style:color="var(--t3)">{t("editor.annotations.empty")}</em>
          {/if}
        </div>
      {/if}
    </div>
  {/each}
</div>
