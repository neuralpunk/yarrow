// YarrowMark.tsx
// The yarrow sprig — v2 thick. The canonical, shared implementation.
//
// Single source of truth: the geometry lives in YARROW_GEOMETRY and every
// rendering context (favicon, dock icon, logotype, chrome) should pull
// from this component rather than re-drawing the path.
//
// Visual rules baked in:
//   • Stroke weight scales with size (size / 44), floored at 1.5px so
//     it holds up at 16px without becoming spindly.
//   • Node radii are fixed in SVG user units (64-unit grid), so they
//     scale proportionally with the icon.
//   • Default color is `currentColor` — set `color` on the parent or
//     pass the `color` prop to override.
//
// Usage:
//   <YarrowMark size={32} />                           // inherits currentColor
//   <YarrowMark size={128} color="#c48fb0" />          // explicit plum
//   <YarrowMark size={96} color="#1a1816" filled />    // knocked-out for app icon
//   <YarrowMark size={64} filled={false} />            // hollow nodes

import * as React from 'react';

export const YARROW_GEOMETRY = {
  viewBox: 64,
  stem: { x: 32, y1: 56, y2: 12 },
  branches: [
    // [fromX, fromY, controlX, controlY, toX, toY]
    [32, 46, 32, 43, 42, 40],
    [32, 36, 32, 33, 20, 30],
    [32, 28, 32, 25, 44, 22],
    [32, 20, 32, 17, 22, 14],
    [32, 20, 32, 17, 42, 14],
  ] as const,
  nodes: [
    { x: 32, y: 56, r: 3.2 }, // base
    { x: 42, y: 40, r: 3.2 }, // tip
    { x: 20, y: 30, r: 3.2 }, // tip
    { x: 44, y: 22, r: 3.2 }, // tip
    { x: 22, y: 14, r: 3.0 }, // crown L
    { x: 42, y: 14, r: 3.0 }, // crown R
    { x: 32, y: 12, r: 3.6 }, // terminal flower
  ],
} as const;

export interface YarrowMarkProps {
  /** Rendered width/height in pixels. Default 24. */
  size?: number;
  /** Mark color. Default 'currentColor'. */
  color?: string;
  /** If true, nodes render as solid circles. If false, hollow (stroked) circles. Default true. */
  filled?: boolean;
  /** Multiplier on the default stroke weight. Default 1. */
  strokeWidthScale?: number;
  /** Accessible label. If omitted, the icon is marked aria-hidden. */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function YarrowMark({
  size = 24,
  color = 'currentColor',
  filled = true,
  strokeWidthScale = 1,
  title,
  className,
  style,
}: YarrowMarkProps) {
  const g = YARROW_GEOMETRY;
  const sw = Math.max(1.5, (size / 44) * strokeWidthScale);
  const nodeStroke = Math.max(0.8, sw * 0.7);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${g.viewBox} ${g.viewBox}`}
      fill="none"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}

      {/* stem */}
      <line
        x1={g.stem.x} y1={g.stem.y1}
        x2={g.stem.x} y2={g.stem.y2}
        stroke={color} strokeWidth={sw} strokeLinecap="round"
      />

      {/* branches (quadratic curves) */}
      {g.branches.map(([fx, fy, cx, cy, tx, ty], i) => (
        <path
          key={i}
          d={`M ${fx} ${fy} Q ${cx} ${cy}, ${tx} ${ty}`}
          stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none"
        />
      ))}

      {/* nodes */}
      {g.nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x} cy={n.y} r={n.r}
          fill={filled ? color : 'none'}
          stroke={filled ? 'none' : color}
          strokeWidth={filled ? 0 : nodeStroke}
        />
      ))}
    </svg>
  );
}

export default YarrowMark;
