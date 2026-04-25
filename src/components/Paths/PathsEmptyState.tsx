import { useEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n";

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
  const t = useT();

  useEffect(() => {
    const tid = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(tid);
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setValue("");
  };

  // Render the {name} placeholder as a styled span without forcing
  // translators to ship raw HTML — split the localized template on the
  // literal marker and stitch the path-name span back in between.
  const safeTemplate = t("paths.empty.safe");
  const [safeBefore, safeAfter] = safeTemplate.split("{name}");

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
            {t("paths.empty.started")}
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
            {t("paths.empty.today")}
          </text>
        </svg>

        <div className="font-serif text-[30px] text-char leading-tight mb-2">
          {t("paths.empty.heading")}
        </div>
        <p className="text-sm text-t2 leading-relaxed mb-6">
          {t("paths.empty.body")}
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
          placeholder={t("paths.condition.placeholder")}
          className="w-full px-4 py-3 bg-bg-soft border border-bd rounded-md text-char text-base font-serif italic placeholder:not-italic placeholder:text-t3/70 resize-none text-center"
        />
        <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
          {[
            t("paths.empty.preset1"),
            t("paths.empty.preset2"),
            t("paths.empty.preset3"),
            t("paths.empty.preset4"),
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
            {t("paths.empty.start")}
          </button>
        </div>
        <div className="mt-3 text-2xs text-t3">
          {safeBefore}
          <span className="text-t2">{currentPath}</span>
          {safeAfter ?? ""}
        </div>
      </div>
    </div>
  );
}
