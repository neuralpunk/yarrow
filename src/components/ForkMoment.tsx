import { useEffect, useRef, useState } from "react";

interface Props {
  pathName: string | null;
  onDone: () => void;
}

export default function ForkMoment({ pathName, onDone }: Props) {
  const [visible, setVisible] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!pathName) return;
    setVisible(true);
    const t1 = window.setTimeout(() => setVisible(false), 1200);
    const t2 = window.setTimeout(() => onDoneRef.current(), 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathName]);

  if (!pathName) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] pointer-events-none flex items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex flex-col items-center">
        <svg width="160" height="180" viewBox="0 0 160 180">
          {/* Parent line */}
          <line
            x1="80"
            y1="0"
            x2="80"
            y2="90"
            stroke="var(--bd2)"
            strokeWidth="2"
          />
          {/* Split */}
          <path
            d="M 80 90 Q 80 110 55 120 L 40 160"
            stroke="var(--bd2)"
            strokeWidth="2"
            fill="none"
            style={{
              strokeDasharray: 140,
              strokeDashoffset: 140,
              animation: "draw 700ms ease-out 120ms forwards",
            }}
          />
          <path
            d="M 80 90 Q 80 110 105 120 L 120 160"
            stroke="var(--yel)"
            strokeWidth="2.5"
            fill="none"
            style={{
              strokeDasharray: 140,
              strokeDashoffset: 140,
              animation: "draw 700ms ease-out 240ms forwards",
            }}
          />
          <circle cx="120" cy="160" r="6" fill="var(--yel)" />
        </svg>

        <div className="mt-2 text-center animate-slideUp">
          <div className="text-2xs uppercase tracking-wider text-t3">
            exploring
          </div>
          <div className="font-serif text-xl text-char mt-0.5">
            {pathName}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
