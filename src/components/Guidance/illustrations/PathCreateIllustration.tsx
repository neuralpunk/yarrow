// Two small "workspace" clusters — the original (gold) and the freshly-
// forked copy (purple). Every dot is duplicated, then one dot lights up
// (edited), one dims (wouldn't apply), and a new green dot appears to
// hint that scenario-only notes are expected.

export default function PathCreateIllustration() {
  return (
    <svg
      viewBox="0 0 480 180"
      width="100%"
      height="180"
      aria-hidden="true"
      style={{ maxWidth: 480 }}
    >
      <defs>
        <radialGradient id="gc-main-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--yel)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--yel)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gc-try-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent2)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent2)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* main cluster */}
      <g>
        <circle cx="90" cy="90" r="46" fill="url(#gc-main-hub)" />
        <line x1="90" y1="90" x2="50"  y2="50"  stroke="var(--bd2)" strokeWidth="1" />
        <line x1="90" y1="90" x2="130" y2="50"  stroke="var(--bd2)" strokeWidth="1" />
        <line x1="90" y1="90" x2="40"  y2="130" stroke="var(--bd2)" strokeWidth="1" />
        <line x1="90" y1="90" x2="140" y2="140" stroke="var(--bd2)" strokeWidth="1" />
        <line x1="90" y1="90" x2="150" y2="100" stroke="var(--bd2)" strokeWidth="1" />
        <line x1="130" y1="50" x2="150" y2="100" stroke="var(--bd2)" strokeWidth="1" />

        <circle cx="90"  cy="90"  r="14" fill="var(--bg)" stroke="var(--yel)" strokeWidth="1.6" />
        <circle cx="50"  cy="50"  r="9"  fill="var(--bg)" stroke="var(--yel)" strokeWidth="1.4" />
        <circle cx="130" cy="50"  r="9"  fill="var(--bg)" stroke="var(--yel)" strokeWidth="1.4" />
        <circle cx="40"  cy="130" r="9"  fill="var(--bg)" stroke="var(--yel)" strokeWidth="1.4" />
        <circle cx="140" cy="140" r="9"  fill="var(--bg)" stroke="var(--yel)" strokeWidth="1.4" />
        <circle cx="150" cy="100" r="7"  fill="var(--bg)" stroke="var(--yel)" strokeWidth="1.4" />

        <text
          x="90" y="170"
          textAnchor="middle"
          fontFamily="inherit"
          fontSize="10"
          letterSpacing="2"
          fill="var(--yeld)"
          fontWeight="600"
        >
          MAIN
        </text>
      </g>

      {/* fork arrow */}
      <g>
        <line x1="180" y1="90" x2="300" y2="90" stroke="var(--accent2)" strokeWidth="1.3" strokeDasharray="4 4" />
        <polygon points="298,84 312,90 298,96" fill="var(--accent2)" />
        <text
          x="240" y="78"
          textAnchor="middle"
          fontFamily="inherit"
          fontStyle="italic"
          fontSize="11"
          fill="var(--accent2)"
        >
          forked
        </text>
      </g>

      {/* try cluster — mostly identical, with subtle divergence */}
      <g>
        <circle cx="390" cy="90" r="46" fill="url(#gc-try-hub)" />
        <line x1="390" y1="90" x2="350" y2="50"  stroke="var(--bd2)" strokeWidth="1" />
        <line x1="390" y1="90" x2="430" y2="50"  stroke="var(--bd2)" strokeWidth="1" opacity="0.35" />
        <line x1="390" y1="90" x2="340" y2="130" stroke="var(--bd2)" strokeWidth="1" />
        <line x1="390" y1="90" x2="440" y2="140" stroke="var(--bd2)" strokeWidth="1" />
        <line x1="390" y1="90" x2="450" y2="100" stroke="var(--bd2)" strokeWidth="1" />
        <line x1="430" y1="50"  x2="450" y2="100" stroke="var(--bd2)" strokeWidth="1" opacity="0.35" />
        {/* new-note connector */}
        <line x1="390" y1="90" x2="455" y2="42" stroke="#7CB37A" strokeWidth="1.2" strokeDasharray="2 2" />

        <circle cx="390" cy="90" r="14" fill="var(--bg)" stroke="var(--accent2)" strokeWidth="1.6" />
        {/* edited note — filled */}
        <circle cx="350" cy="50" r="9" fill="var(--accent2)" fillOpacity="0.35" stroke="var(--accent2)" strokeWidth="1.4" />
        {/* unchanged */}
        <circle cx="430" cy="50" r="9" fill="var(--bg)" stroke="var(--accent2)" strokeWidth="1.4" opacity="0.35" />
        <circle cx="340" cy="130" r="9" fill="var(--bg)" stroke="var(--accent2)" strokeWidth="1.4" />
        {/* edited */}
        <circle cx="440" cy="140" r="9" fill="var(--accent2)" fillOpacity="0.35" stroke="var(--accent2)" strokeWidth="1.4" />
        <circle cx="450" cy="100" r="7" fill="var(--bg)" stroke="var(--accent2)" strokeWidth="1.4" />
        {/* brand-new note, green */}
        <circle cx="455" cy="42" r="7" fill="var(--bg)" stroke="#7CB37A" strokeWidth="1.5" strokeDasharray="2 2" />

        <text
          x="390" y="170"
          textAnchor="middle"
          fontFamily="inherit"
          fontSize="10"
          letterSpacing="2"
          fill="var(--accent2)"
          fontWeight="600"
          fontStyle="italic"
        >
          YOUR NEW PATH
        </text>
      </g>
    </svg>
  );
}
