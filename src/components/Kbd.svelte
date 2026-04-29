<script lang="ts">
  import type { Snippet } from "svelte";

  /** Small keycap badge: <Kbd>⌘K</Kbd>. Uses font-mono for alignment. */
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();
</script>

<kbd
  class="font-mono text-[11px] text-t3 bg-s2 border border-bd rounded-sm px-1.5 py-px"
  style="font-feature-settings: 'cv02';"
>
  {@render children()}
</kbd>
