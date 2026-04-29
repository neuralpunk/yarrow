<script lang="ts" module>
  export const YARROW_GEOMETRY = {
    viewBox: 64,
    stem: { x: 32, y1: 56, y2: 12 },
    branches: [
      [32, 46, 32, 43, 42, 40],
      [32, 36, 32, 33, 20, 30],
      [32, 28, 32, 25, 44, 22],
      [32, 20, 32, 17, 22, 14],
      [32, 20, 32, 17, 42, 14],
    ] as const,
    nodes: [
      { x: 32, y: 56, r: 3.2 },
      { x: 42, y: 40, r: 3.2 },
      { x: 20, y: 30, r: 3.2 },
      { x: 44, y: 22, r: 3.2 },
      { x: 22, y: 14, r: 3.0 },
      { x: 42, y: 14, r: 3.0 },
      { x: 32, y: 12, r: 3.6 },
    ],
  } as const;
</script>

<script lang="ts">
  interface Props {
    size?: number;
    color?: string;
    filled?: boolean;
    strokeWidthScale?: number;
    title?: string;
    class?: string;
    style?: string;
  }

  let {
    size = 24,
    color = "currentColor",
    filled = true,
    strokeWidthScale = 1,
    title,
    class: className = "",
    style = "",
  }: Props = $props();

  let g = YARROW_GEOMETRY;
  let sw = $derived(Math.max(1.5, (size / 44) * strokeWidthScale));
  let nodeStroke = $derived(Math.max(0.8, sw * 0.7));
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 {g.viewBox} {g.viewBox}"
  fill="none"
  class={className}
  {style}
  role={title ? "img" : undefined}
  aria-hidden={title ? undefined : true}
  aria-label={title}
>
  {#if title}<title>{title}</title>{/if}

  <line
    x1={g.stem.x}
    y1={g.stem.y1}
    x2={g.stem.x}
    y2={g.stem.y2}
    stroke={color}
    stroke-width={sw}
    stroke-linecap="round"
  />

  {#each g.branches as [fx, fy, cx, cy, tx, ty], i (i)}
    <path
      d="M {fx} {fy} Q {cx} {cy}, {tx} {ty}"
      stroke={color}
      stroke-width={sw}
      stroke-linecap="round"
      fill="none"
    />
  {/each}

  {#each g.nodes as n, i (i)}
    <circle
      cx={n.x}
      cy={n.y}
      r={n.r}
      fill={filled ? color : "none"}
      stroke={filled ? "none" : color}
      stroke-width={filled ? 0 : nodeStroke}
    />
  {/each}
</svg>
