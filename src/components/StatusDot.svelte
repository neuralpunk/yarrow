<script lang="ts">
  /** Small circular status indicator, coloured via the given CSS color. */
  interface Props {
    color: string;
    size?: number;
    class?: string;
  }
  let { color, size = 8, class: className = "" }: Props = $props();
</script>

<span
  aria-hidden="true"
  class="inline-block rounded-full {className}"
  style:width="{size}px"
  style:height="{size}px"
  style:background={color}
></span>
