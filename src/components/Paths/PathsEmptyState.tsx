import { useEffect, useRef, useState } from "react";

interface Props {
  currentPath: string;
  onCreate: (condition: string) => void;
}

/**
 * Shown when the workspace has only a single path. Instead of an empty graph,
 * we present the invitation directly: what's the first "if…" you want to try
 * on? Creating a fork from here is the single primary action on the screen.
 */
export default function PathsEmptyState({ currentPath, onCreate }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, []);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onCreate(t);
    setValue("");
  };

  return (
    <div className="h-full w-full overflow-y-auto flex items-center justify-center p-10">
      <div className="max-w-[560px] w-full text-center">
        {/* Visual: a single road ending in a dot */}
        <svg
          width="420"
          height="70"
          viewBox="0 0 420 70"
          className="mx-auto mb-6 opacity-90"
        >
          <line
            x1="10"
            y1="35"
            x2="380"
            y2="35"
            stroke="var(--yel)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="35" r="8" fill="var(--yel)" />
          <circle cx="380" cy="35" r="10" fill="var(--bg)" stroke="var(--yel)" strokeWidth="2.5" />
          <text
            x="10"
            y="18"
            textAnchor="start"
            className="mono"
            style={{ fontSize: 9, fill: "var(--t3)", letterSpacing: "0.2em" }}
          >
            STARTED
          </text>
          <text
            x="380"
            y="18"
            textAnchor="middle"
            className="serif"
            fontStyle="italic"
            style={{ fontSize: 12, fill: "var(--yeld)" }}
          >
            {currentPath}
          </text>
          <text
            x="380"
            y="60"
            textAnchor="middle"
            className="mono"
            style={{ fontSize: 9, fill: "var(--t3)", letterSpacing: "0.2em" }}
          >
            TODAY
          </text>
        </svg>

        <div className="font-serif text-[30px] text-char leading-tight mb-2">
          Your map is a single road right now.
        </div>
        <p className="text-sm text-t2 leading-relaxed mb-6">
          A path is a parallel version of your thinking — what you'd write
          <em> if </em>something were different. What's the first one you want
          to try on?
        </p>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="If the Seattle job comes through…"
          className="w-full px-4 py-3 bg-bg-soft border border-bd rounded-md text-char text-base font-serif italic placeholder:not-italic placeholder:text-t3/70 resize-none text-center"
        />
        <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
          {[
            "If it rains on the day",
            "If the project is denied",
            "If I quit to write",
            "If we stay put",
          ].map((s) => (
            <button
              key={s}
              onClick={() => {
                setValue(s);
                inputRef.current?.focus();
              }}
              className="text-2xs px-2 py-0.5 bg-s2 text-t2 rounded-full hover:bg-s3 hover:text-char transition"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="btn-yel px-4 py-2 text-sm rounded-md disabled:opacity-40"
          >
            Start this path
          </button>
        </div>
        <div className="mt-3 text-2xs text-t3">
          The version you have now stays safely on{" "}
          <span className="text-t2">{currentPath}</span>.
        </div>
      </div>
    </div>
  );
}
