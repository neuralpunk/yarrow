// A doorway into the try path — an editor-shaped rectangle with a colored
// left stripe and a dashed "you are here" arrow stepping into it.

export default function PathStepIntoIllustration() {
  return (
    <svg viewBox="0 0 360 160" width="100%" height="150" aria-hidden="true" style={{ maxWidth: 360 }}>
      {/* editor frame */}
      <rect x="80" y="30" width="260" height="100" rx="8" fill="var(--bg)" stroke="var(--bd)" strokeWidth="1.2" />
      {/* accent stripe — the thing users actually see in the app */}
      <rect x="80" y="30" width="4" height="100" fill="var(--accent2)" />
      {/* pretend content lines */}
      <line x1="100" y1="52" x2="260" y2="52" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.6" />
      <line x1="100" y1="68" x2="290" y2="68" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.4" />
      <line x1="100" y1="84" x2="240" y2="84" stroke="var(--accent2)" strokeWidth="1.4" opacity="0.7" />
      <line x1="100" y1="100" x2="280" y2="100" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.4" />
      <line x1="100" y1="116" x2="200" y2="116" stroke="var(--ch2)" strokeWidth="1.4" opacity="0.4" />

      {/* footprint trail into the editor */}
      <g stroke="var(--accent2)" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d="M 10 140 Q 28 110, 46 120" strokeDasharray="3 3" />
        <path d="M 42 120 Q 58 96, 76 104" strokeDasharray="3 3" />
        <polygon points="72,100 88,108 72,112" fill="var(--accent2)" stroke="none" />
      </g>

      <text x="210" y="21" textAnchor="middle" fontSize="10" letterSpacing="2" fill="var(--accent2)" fontWeight="600">
        YOU ARE HERE
      </text>
    </svg>
  );
}
