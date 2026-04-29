<script lang="ts">
  // Mount point for guidance modals. Reads active guidance from the store
  // and renders the matching surface. Coach cards are rendered by their
  // owning component (see PathRibbon), not here.

  import { guidance } from "../../lib/guidanceStore.svelte";
  import TeachingModal from "./TeachingModal.svelte";
</script>

{#if guidance.active && guidance.active.surface === "modal"}
  <TeachingModal def={guidance.active} />
{/if}
