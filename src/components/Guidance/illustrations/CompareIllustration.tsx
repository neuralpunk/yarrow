// Two note cards — one "main" (gold), one "try" (purple) — sitting beside
// each other with colored bands marking the lines that differ. A faint
// diff connector in the middle ties the eye across the gap.

export default function CompareIllustration() {
  return (
    <svg viewBox="0 0 480 180" width="100%" height="180" aria-hidden="true" style={{ maxWidth: 480 }}>
      <defs>
        <linearGradient id="cmp-bridge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--yel)" stopOpacity="0.65" />
          <stop offset="100%" stopColor="var(--accent2)" stopOpacity="0.65" />
        </linearGradient>
      </defs>

      {/* main card */}
      <g>
        <rect x="20" y="26" width="190" height="130" rx="8" fill="var(--bg)" stroke="var(--yel)" strokeWidth="1.4" />
        <rect x="20" y="26" width="4" height="130" fill="var(--yel)" />
        <text x="36" y="44" fontSize="10" letterSpacing="1.8" fill="var(--yeld)" fontWeight="600">MAIN</text>
        <text x="36" y="60" fontSize="11" fill="var(--char)" fontWeight="500">Budget 2026</text>
        {/* unchanged line */}
        <line x1="36" y1="76" x2="196" y2="76" stroke="var(--ch2)" strokeWidth="1.2" opacity="0.55" />
        {/* changed line — highlighted */}
        <rect x="34" y="84" width="170" height="12" rx="2" fill="var(--yel)" fillOpacity="0.12" />
        <line x1="36" y1="91" x2="190" y2="91" stroke="var(--yeld)" strokeWidth="1.3" opacity="0.85" />
        {/* unchanged */}
        <line x1="36" y1="108" x2="188" y2="108" stroke="var(--ch2)" strokeWidth="1.2" opacity="0.45" />
        <line x1="36" y1="122" x2="170" y2="122" stroke="var(--ch2)" strokeWidth="1.2" opacity="0.45" />
        {/* removed-on-try line — present on main, absent on try */}
        <rect x="34" y="134" width="150" height="12" rx="2" fill="var(--ch2)" fillOpacity="0.06" />
        <line x1="36" y1="141" x2="174" y2="141" stroke="var(--ch2)" strokeWidth="1.2" opacity="0.55" />
      </g>

      {/* diff connector band */}
      <g>
        <line x1="210" y1="91" x2="270" y2="85" stroke="url(#cmp-bridge)" strokeWidth="1.4" strokeDasharray="3 3" />
        <line x1="210" y1="141" x2="270" y2="150" stroke="var(--yeld)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
        <text x="240" y="70" textAnchor="middle" fontSize="11" fontStyle="italic" fill="var(--ch2)" opacity="0.8">differs</text>
      </g>

      {/* try card */}
      <g>
        <rect x="270" y="26" width="190" height="130" rx="8" fill="var(--bg)" stroke="var(--accent2)" strokeWidth="1.4" />
        <rect x="270" y="26" width="4" height="130" fill="var(--accent2)" />
        <text x="286" y="44" fontSize="10" letterSpacing="1.8" fill="var(--accent2)" fontWeight="600" fontStyle="italic">IF BONUS PAYCHECK</text>
        <text x="286" y="60" fontSize="11" fill="var(--char)" fontWeight="500">Budget 2026</text>
        {/* unchanged */}
        <line x1="286" y1="76" x2="446" y2="76" stroke="var(--ch2)" strokeWidth="1.2" opacity="0.55" />
        {/* changed — the edited-on-try counterpart */}
        <rect x="284" y="84" width="170" height="12" rx="2" fill="var(--accent2)" fillOpacity="0.18" />
        <line x1="286" y1="91" x2="440" y2="91" stroke="var(--accent2)" strokeWidth="1.3" />
        {/* unchanged */}
        <line x1="286" y1="108" x2="438" y2="108" stroke="var(--ch2)" strokeWidth="1.2" opacity="0.45" />
        <line x1="286" y1="122" x2="420" y2="122" stroke="var(--ch2)" strokeWidth="1.2" opacity="0.45" />
        {/* brand-new line — only on try */}
        <rect x="284" y="134" width="170" height="12" rx="2" fill="#7CB37A" fillOpacity="0.14" />
        <line x1="286" y1="141" x2="448" y2="141" stroke="#7CB37A" strokeWidth="1.3" strokeDasharray="2 2" />
      </g>
    </svg>
  );
}
