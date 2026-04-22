// Two small "note" cards, connected by a glowing double-ended thread that
// visualizes reciprocal links.

export default function WikilinkIllustration() {
  return (
    <svg viewBox="0 0 480 180" width="100%" height="170" aria-hidden="true" style={{ maxWidth: 480 }}>
      <defs>
        <linearGradient id="wl-thread" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--yel)" stopOpacity="0.9" />
          <stop offset="50%" stopColor="var(--yel)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--yel)" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* left card */}
      <g>
        <rect x="30" y="30" width="150" height="120" rx="6" fill="var(--bg)" stroke="var(--bd)" strokeWidth="1.2" />
        <rect x="30" y="30" width="150" height="22" rx="6" fill="var(--yel)" fillOpacity="0.08" />
        <text x="42" y="46" fontFamily="inherit" fontSize="11" fill="var(--yeld)" fontWeight="600">Journal · Mar 4</text>
        <line x1="42" y1="70" x2="168" y2="70" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.55" />
        <line x1="42" y1="86" x2="154" y2="86" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.4" />
        {/* The wikilink, highlighted. */}
        <rect x="40" y="98" width="74" height="14" rx="3" fill="var(--yel)" fillOpacity="0.18" />
        <text x="44" y="109" fontFamily="inherit" fontSize="10" fill="var(--yeld)" fontStyle="italic">[[Shannon]]</text>
        <line x1="120" y1="106" x2="168" y2="106" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.4" />
        <line x1="42" y1="120" x2="160" y2="120" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.35" />
        <line x1="42" y1="134" x2="140" y2="134" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.35" />
      </g>

      {/* thread */}
      <g>
        <path d="M 180 98 Q 240 40, 300 70" stroke="url(#wl-thread)" strokeWidth="1.6" fill="none" />
        <circle cx="180" cy="98" r="4" fill="var(--yel)" />
        <circle cx="300" cy="70" r="4" fill="var(--yel)" />
        <text x="240" y="38" textAnchor="middle" fontStyle="italic" fontSize="11" fill="var(--yeld)">reciprocal link</text>
      </g>

      {/* right card */}
      <g>
        <rect x="300" y="50" width="150" height="120" rx="6" fill="var(--bg)" stroke="var(--bd)" strokeWidth="1.2" />
        <rect x="300" y="50" width="150" height="22" rx="6" fill="var(--yel)" fillOpacity="0.08" />
        <text x="312" y="66" fontFamily="inherit" fontSize="11" fill="var(--yeld)" fontWeight="600">Shannon</text>
        <line x1="312" y1="90" x2="438" y2="90" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.5" />
        <line x1="312" y1="106" x2="422" y2="106" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.4" />
        <line x1="312" y1="122" x2="410" y2="122" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.4" />
        {/* Backlink hint */}
        <rect x="312" y="138" width="108" height="18" rx="3" fill="var(--accent2)" fillOpacity="0.12" />
        <text x="318" y="151" fontFamily="inherit" fontSize="10" fill="var(--accent2)">↩ linked from Journal · Mar 4</text>
      </g>
    </svg>
  );
}
