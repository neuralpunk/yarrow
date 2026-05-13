// 3.1 — anime.js v4 wrapper. Single source of truth for motion in
// Yarrow. Every component that animates pulls from here so the
// vocabulary (durations, easings, "soft and considered") stays
// consistent.
//
// Two layers:
//   1. Typed helpers — pulseRing, popIn, toastSlideIn, drawPath, …
//   2. Svelte actions — usePopIn, useStaggerChildren, useSpringIn, …
//
// Both respect `prefers-reduced-motion: reduce` and bail out cleanly
// (the element lands in its final state without the animation). The
// helpers also re-export the underlying anime.js primitives for the
// rare component that needs to compose its own timeline directly.

import {
  animate,
  stagger,
  createTimeline,
  utils,
  createSpring,
} from "animejs";
import { cubicInOut, cubicOut } from "svelte/easing";

export { animate, stagger, createTimeline, utils, createSpring };

// ────────────────────── Svelte built-in transitions ──────────────────────
// These piggyback on Svelte's transition engine (CSS-driven) — anime.js
// is overkill for the simple width-slide and reveal cases. Kept here so
// every motion primitive ships from one file.

/** Horizontal collapse: slides the element's width to zero while fading
 *  it out, then back when re-entering. Good for focus-mode sidebars
 *  and other "panel disappears" moments where you want the layout to
 *  retract smoothly rather than snap. */
export function widthSlide(node: Element, opts?: { duration?: number; easing?: (t: number) => number }) {
  const el = node as HTMLElement;
  const w = el.getBoundingClientRect().width || el.offsetWidth || 0;
  return {
    duration: opts?.duration ?? 360,
    easing: opts?.easing ?? cubicInOut,
    css: (t: number) => `
      width: ${t * w}px;
      min-width: 0;
      opacity: ${t};
      overflow: hidden;
    `,
  };
}

/** Vertical fade-rise — used for inline panels (e.g. selection toolbar,
 *  inline wikilink picker) that should arrive from a few pixels below
 *  and settle. Lighter than `popIn` because it's CSS-only and works
 *  with Svelte's enter/exit lifecycle. The `_node` param is required
 *  by Svelte's transition contract even though we don't read from it
 *  here — the CSS-driven path doesn't need to measure the element. */
export function fadeRise(_node: Element, opts?: { duration?: number; y?: number }) {
  return {
    duration: opts?.duration ?? 220,
    easing: cubicOut,
    css: (t: number, u: number) => `
      transform: translateY(${u * (opts?.y ?? 8)}px);
      opacity: ${t};
    `,
  };
}

// ────────────────────── reduced motion ──────────────────────
export function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ────────────────────── primitives ──────────────────────

/** A concentric ring that bursts outward from `host` and fades.
 *  Used for the auto-checkpoint pulse and other "something happened"
 *  acknowledgements. `host` must be positioned (relative/absolute) so
 *  the absolute ring lays over it correctly. */
export function pulseRing(
  host: HTMLElement,
  opts?: { color?: string; scale?: number; duration?: number },
): void {
  if (reducedMotion()) return;
  const color = opts?.color ?? "var(--yel)";
  const scale = opts?.scale ?? 3.2;
  const duration = opts?.duration ?? 1300;
  const ring = document.createElement("span");
  ring.setAttribute("aria-hidden", "true");
  Object.assign(ring.style, {
    position: "absolute",
    left: "0",
    top: "0",
    right: "0",
    bottom: "0",
    margin: "auto",
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    border: `1.5px solid ${color}`,
    opacity: "0",
    pointerEvents: "none",
    boxSizing: "border-box",
  });
  host.appendChild(ring);
  animate(ring, {
    scale: [0.85, scale],
    opacity: [0.55, 0],
    duration,
    ease: "outExpo",
    onComplete: () => ring.remove(),
  });
}

/** Spring-pop scale-in. For tag chips, badges, single elements that
 *  should feel "snapped into place". */
export function springIn(
  el: Element | Element[] | NodeListOf<Element>,
  opts?: { duration?: number; overshoot?: number },
) {
  if (reducedMotion()) return;
  return animate(el as any, {
    scale: [0, 1],
    opacity: [0, 1],
    duration: opts?.duration ?? 640,
    ease: `outBack(${opts?.overshoot ?? 1.8})`,
  });
}

/** A staggered fade-up. For lists, result rows, anything that should
 *  cascade in. */
export function staggerFadeUp(
  els: Element | Element[] | NodeListOf<Element>,
  opts?: { staggerMs?: number; duration?: number; fromY?: number; delay?: number },
) {
  if (reducedMotion()) return;
  return animate(els as any, {
    opacity: [0, 1],
    y: [opts?.fromY ?? 8, 0],
    duration: opts?.duration ?? 360,
    delay: stagger(opts?.staggerMs ?? 45, { start: opts?.delay ?? 0 }),
    ease: "outCubic",
  });
}

/** A modal/palette entrance: subtle scale + fade + rise, with a soft
 *  overshoot. Pair with `backdropFade` for the dim. */
export function popIn(
  el: Element,
  opts?: {
    duration?: number;
    fromY?: number;
    fromScale?: number;
    overshoot?: number;
  },
) {
  if (reducedMotion()) return;
  return animate(el as any, {
    opacity: [0, 1],
    y: [opts?.fromY ?? 12, 0],
    scale: [opts?.fromScale ?? 0.96, 1],
    duration: opts?.duration ?? 380,
    ease: `outBack(${opts?.overshoot ?? 1.2})`,
  });
}

/** Plain fade in for backdrops, dim layers. */
export function fadeIn(el: Element, opts?: { duration?: number; delay?: number }) {
  if (reducedMotion()) return;
  return animate(el as any, {
    opacity: [0, 1],
    duration: opts?.duration ?? 240,
    delay: opts?.delay ?? 0,
    ease: "outQuad",
  });
}

/** Plain fade out, useful for backdrops on close. */
export function fadeOut(el: Element, opts?: { duration?: number }) {
  if (reducedMotion()) return;
  return animate(el as any, {
    opacity: [1, 0],
    duration: opts?.duration ?? 200,
    ease: "inQuad",
  });
}

/** Toast slide-in from below with soft overshoot. */
export function toastSlideIn(el: Element, opts?: { duration?: number; fromY?: number }) {
  if (reducedMotion()) return;
  return animate(el as any, {
    y: [opts?.fromY ?? 48, 0],
    opacity: [0, 1],
    duration: opts?.duration ?? 560,
    ease: "outBack(1.3)",
  });
}

/** Toast slide-out down, for dismissal. */
export function toastSlideOut(el: Element, opts?: { duration?: number; toY?: number }) {
  if (reducedMotion()) return;
  return animate(el as any, {
    y: [0, opts?.toY ?? 48],
    opacity: [1, 0],
    duration: opts?.duration ?? 320,
    ease: "inQuad",
  });
}

/** Animated SVG stroke draw. Pass a path/line/polyline; returns a
 *  promise-like via anime.js. `direction: "out"` reverses (un-draws). */
export function drawPath(
  path: SVGPathElement | SVGLineElement | SVGPolylineElement | SVGCircleElement,
  opts?: {
    duration?: number;
    delay?: number;
    ease?: string;
    direction?: "in" | "out";
  },
) {
  if (reducedMotion()) {
    path.style.strokeDashoffset = "0";
    return;
  }
  const len = typeof (path as SVGPathElement).getTotalLength === "function"
    ? (path as SVGPathElement).getTotalLength()
    : 200;
  const duration = opts?.duration ?? 700;
  const ease = opts?.ease ?? "outQuart";
  const direction = opts?.direction ?? "in";
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = String(direction === "in" ? len : 0);
  return animate(path as any, {
    strokeDashoffset: direction === "in" ? 0 : len,
    duration,
    delay: opts?.delay ?? 0,
    ease,
  });
}

/** **Removed in 3.1 fix-pass.** A previous version animated `clip-path`
 *  polygon strings through anime.js — that turns out to be unreliable
 *  (the engine can't always interpolate between two polygon shapes).
 *  The theme sweep now uses a CSS keyframe driving `clip-path: inset(…)`
 *  directly; see `theme.svelte.ts` + `.yarrow-theme-sweep` in
 *  `index.css`. Kept the export as a deprecation stub so any other
 *  import sites fail loudly rather than silently no-op. */
export function sweepClip(_el: Element, _opts?: unknown): void {
  if (import.meta.env?.DEV) {
    console.warn(
      "[yarrow] sweepClip() was removed — use the CSS-based " +
        ".yarrow-theme-sweep keyframe instead.",
    );
  }
}

/** Animated width transition. For sidebar collapse / focus mode. */
export function widthTo(
  el: Element,
  toPx: number,
  opts?: { duration?: number; ease?: string },
) {
  if (reducedMotion()) {
    (el as HTMLElement).style.width = `${toPx}px`;
    return;
  }
  return animate(el as any, {
    width: toPx,
    duration: opts?.duration ?? 520,
    ease: opts?.ease ?? "inOutQuart",
  });
}

/** Radial spawn — used for "burst from a point" entrances on HTML
 *  elements (cards, chips). **Not safe for SVG `<g>` nodes that are
 *  positioned by an external simulation** (e.g. D3 force-graph): the
 *  CSS `scale` we set here would shadow the SVG `transform="translate
 *  (…)"` attribute the simulation writes on each tick, pinning the
 *  nodes at the SVG origin. For SVG cases, animate opacity here and
 *  bounce the inner shape's geometry (e.g. circle `r`) instead — see
 *  `ConnectionGraph.svelte` for the working pattern. */
export function radialSpawn(
  nodes: HTMLElement[] | SVGElement[],
  opts?: {
    duration?: number;
    staggerMs?: number;
    delay?: number;
  },
) {
  if (reducedMotion()) return;
  return animate(nodes as any, {
    scale: [0, 1],
    opacity: [0, 1],
    duration: opts?.duration ?? 600,
    delay: stagger(opts?.staggerMs ?? 50, { start: opts?.delay ?? 0 }),
    ease: "outBack(1.6)",
  });
}

// ────────────────────── Svelte actions ──────────────────────
// Use these directly in templates:
//   <div use:usePopIn>…</div>
//   <ul use:useStaggerChildren>…</ul>
//   <div use:useToastIn>…</div>

type SvelteAction<T extends Element, P = void> = (
  node: T,
  param?: P,
) => { destroy?: () => void; update?: (param: P) => void } | void;

/** Pop-in on mount: scale + fade + rise. */
export const usePopIn: SvelteAction<HTMLElement, { duration?: number } | undefined> = (
  node,
  param,
) => {
  popIn(node, param);
};

/** Fade-in on mount. */
export const useFadeIn: SvelteAction<HTMLElement, { duration?: number } | undefined> = (
  node,
  param,
) => {
  fadeIn(node, param);
};

/** Toast entrance — slide up from below with overshoot. */
export const useToastIn: SvelteAction<HTMLElement> = (node) => {
  toastSlideIn(node);
};

/** Spring-pop on mount. */
export const useSpringIn: SvelteAction<HTMLElement, { overshoot?: number } | undefined> = (
  node,
  param,
) => {
  springIn(node, param);
};

/** Stagger children on mount. */
export const useStaggerChildren: SvelteAction<
  HTMLElement,
  { staggerMs?: number; duration?: number; selector?: string } | undefined
> = (node, param) => {
  const selector = param?.selector;
  const kids = selector
    ? Array.from(node.querySelectorAll(selector)) as HTMLElement[]
    : (Array.from(node.children) as HTMLElement[]);
  if (kids.length === 0) return;
  staggerFadeUp(kids, {
    staggerMs: param?.staggerMs,
    duration: param?.duration,
  });
};

// ────────────────────── Reactive helpers ──────────────────────

/** Mount an animation re-run when a reactive trigger changes.
 *  Usage inside a Svelte 5 $effect:
 *
 *    $effect(() => {
 *      void filter;            // dependency
 *      if (!listEl) return;
 *      runStaggerIn(listEl);
 *    });
 *
 *  Just a thin convenience around staggerFadeUp that picks up direct
 *  children. Keep `staggerMs` low (≤60ms) when lists are long so the
 *  tail of the cascade doesn't drag. */
export function runStaggerIn(
  container: HTMLElement,
  opts?: { staggerMs?: number; duration?: number; selector?: string },
) {
  const kids = opts?.selector
    ? Array.from(container.querySelectorAll(opts.selector)) as HTMLElement[]
    : (Array.from(container.children) as HTMLElement[]);
  if (kids.length === 0) return;
  staggerFadeUp(kids, opts);
}
