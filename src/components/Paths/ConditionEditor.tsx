import { useEffect, useRef, useState } from "react";

interface Props {
  branch: string;
  initial: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}

/**
 * A small centered modal for setting or editing a path's condition. Kept
 * simple on purpose — one field, one save. The prompt itself does the work
 * of teaching the user the shape of the data ("If …, then this path").
 */
export default function ConditionEditor({ branch, initial, onSave, onCancel }: Props) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 30);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const commit = () => onSave(value.trim());

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/60 backdrop-blur-sm animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="w-[min(520px,92vw)] bg-bg border border-bd2 rounded-xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-2xs uppercase tracking-[0.2em] font-mono text-t3 mb-1">
          name this path
        </div>
        <div className="font-serif text-[22px] text-char leading-tight mb-2">
          What question is{" "}
          <span className="italic text-yeld">{branch}</span> asking?
        </div>
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          Start with <span className="italic">If…</span> or <span className="italic">What if…</span> — the condition that
          made you step off the main road. This is how future-you will recognize it.
        </p>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || e.key === "Enter") {
              if (!e.shiftKey) {
                e.preventDefault();
                commit();
              }
            }
          }}
          rows={2}
          placeholder="If the Seattle job comes through…"
          className="w-full px-3 py-2 bg-bg-soft border border-bd rounded-md text-char text-sm resize-none font-serif italic placeholder:not-italic placeholder:text-t3/70"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {[
            "If it rains on the day",
            "If I get the job",
            "If the project is denied",
            "If we stay put",
            "If I quit",
          ].map((s) => (
            <button
              key={s}
              onClick={() => setValue(s)}
              className="text-2xs px-2 py-0.5 bg-s2 text-t2 rounded-full hover:bg-s3 hover:text-char transition"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
          >
            cancel
          </button>
          {initial && (
            <button
              onClick={() => onSave("")}
              className="px-3 py-1.5 text-sm text-t3 hover:text-danger"
              title="Remove this condition"
            >
              clear
            </button>
          )}
          <button
            onClick={commit}
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
          >
            save question
          </button>
        </div>
      </div>
    </div>
  );
}
