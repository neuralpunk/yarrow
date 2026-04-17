interface Props {
  size?: number;
  className?: string;
  /**
   * When true, the branch-tip node renders in currentColor like the others.
   * Default: the tip is the brand-yellow accent so the mark reads as Yarrow's.
   */
  mono?: boolean;
}

/**
 * Yarrow mark — a git-style fork: top & bottom nodes on a vertical trunk,
 * a curved branch sweeping up to a third node on the right.
 *
 * Stroke and the top/bottom nodes use `currentColor` so the logo adapts to
 * whatever text color its parent sets. The branch-tip node is filled with
 * the brand yellow by default.
 */
export default function Logo({ size = 22, className, mono = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden
    >
      {/* Trunk: top node down to bottom node */}
      <line
        x1="5.5" y1="7.3"
        x2="5.5" y2="16.7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Branch: fork out from the trunk up to the tip node */}
      <path
        d="M 5.5 15.5 C 5.5 11, 11 9.5, 15.7 9.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Top node */}
      <circle cx="5.5" cy="4.5" r="2.9" fill="currentColor" />
      {/* Bottom node */}
      <circle cx="5.5" cy="19.5" r="2.9" fill="currentColor" />
      {/* Branch tip — brand accent */}
      {mono ? (
        <circle cx="18.5" cy="9.5" r="2.9" fill="currentColor" />
      ) : (
        <circle
          cx="18.5"
          cy="9.5"
          r="2.9"
          fill="var(--yel)"
          stroke="var(--yeld)"
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}
