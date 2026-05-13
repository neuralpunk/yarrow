<script lang="ts">
  // Generic saved-view modal. One modal replaces the five persona-
  // specific ones (DecisionLog, Sources, Sensitive, FollowUps,
  // Recipes). The rail / status-bar / command-palette opens this
  // with a tag name; the modal queries notes carrying that tag and
  // renders a list. Clicking a row selects the note and closes.
  //
  // The modal is deliberately spare — it's a filtered list, not a
  // bespoke surface. Anything beyond "show me the notes with this
  // tag" belongs in a tag-specific feature.

  import Modal from "./Modal.svelte";
  import type { NoteSummary } from "../lib/types";
  import { tags as tagsStore, defaultLabel, type TagDef } from "../lib/tags.svelte";
  import { relativeTime } from "../lib/format";

  interface Props {
    /** When `null` the modal renders nothing — `open` is the visibility
     *  switch but the body needs a tag to render. */
    tagName: string | null;
    open: boolean;
    notes: NoteSummary[];
    onClose: () => void;
    onSelect: (slug: string) => void;
    /** Optional: scaffold a new note from the tag's template. When
     *  absent or the tag has no template, the "+ New" button is hidden. */
    onCreate?: (tagName: string, template: string) => void;
  }

  let {
    tagName,
    open,
    notes,
    onClose,
    onSelect,
    onCreate,
  }: Props = $props();

  let def = $derived<TagDef | null>(
    tagName ? (tagsStore.get(tagName) ?? null) : null,
  );

  let title = $derived(def ? defaultLabel(def) : "");

  let matched = $derived.by(() => {
    if (!tagName) return [] as NoteSummary[];
    const wanted = tagName.toLowerCase();
    return notes.filter((n) =>
      (n.tags ?? []).some((t) => t.toLowerCase() === wanted),
    );
  });

  function pick(slug: string) {
    onSelect(slug);
    onClose();
  }

  function create() {
    if (def && def.template && onCreate) {
      onCreate(def.name, def.template);
      onClose();
    }
  }
</script>

<Modal {open} {onClose}>
  <div class="saved-view">
    <header>
      <div class="title-row">
        {#if def}
          <span class="dot {def.color}"></span>
        {/if}
        <h2>{title}</h2>
        <span class="count">{matched.length}</span>
      </div>
      {#if def && def.template && onCreate}
        <button type="button" class="new-btn" onclick={create}>
          + New
        </button>
      {/if}
    </header>

    {#if matched.length === 0}
      <p class="empty">No notes tagged <code>#{tagName}</code> yet.</p>
    {:else}
      <ul class="notes">
        {#each matched as note (note.slug)}
          <li>
            <button type="button" onclick={() => pick(note.slug)}>
              <span class="n-title">{note.title || note.slug}</span>
              <span class="n-meta">{relativeTime(note.modified)}</span>
              {#if note.excerpt}
                <span class="n-excerpt">{note.excerpt}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</Modal>

<style>
  .saved-view {
    min-width: 480px;
    max-width: 640px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--bd, #d9cfba);
    margin-bottom: 12px;
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  h2 {
    font-family: var(--font-display, serif);
    font-size: 22px;
    font-weight: 400;
    margin: 0;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
  .count {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: var(--char-2, #4a4238);
    background: var(--bg-2, #efe7d7);
    padding: 2px 8px;
    border-radius: 3px;
  }
  .new-btn {
    font-family: var(--font-sans, sans-serif);
    font-size: 13px;
    background: transparent;
    border: 1px solid var(--bd, #d9cfba);
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
  }
  .new-btn:hover { background: var(--bg-2, #efe7d7); }
  .empty {
    text-align: center;
    padding: 32px 16px;
    color: var(--muted, #8a8174);
    font-style: italic;
  }
  .empty code {
    font-family: var(--font-mono, monospace);
    background: var(--bg-2, #efe7d7);
    padding: 1px 6px;
    border-radius: 3px;
    font-style: normal;
  }
  ul.notes {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
  }
  ul.notes li { margin: 0; }
  ul.notes button {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--bd-soft, #e6dec9);
    padding: 12px 4px;
    cursor: pointer;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    font-family: var(--font-serif, serif);
  }
  ul.notes button:hover { background: var(--bg-2, #efe7d7); }
  .n-title {
    font-weight: 500;
    color: var(--char, #1f1a14);
    grid-column: 1;
  }
  .n-meta {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--muted, #8a8174);
    grid-column: 2;
    align-self: center;
  }
  .n-excerpt {
    grid-column: 1 / -1;
    font-size: 14px;
    color: var(--char-2, #4a4238);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
</style>
