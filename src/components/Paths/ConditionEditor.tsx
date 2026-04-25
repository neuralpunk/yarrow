import { useEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n";

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
  const t = useT();

  useEffect(() => {
    const tid = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 30);
    return () => window.clearTimeout(tid);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const commit = () => onSave(value.trim());

  // Split the heading template so the path-name segment can be rendered
  // as a styled <span> in the right colour. Translators keep the literal
  // {name} marker in their string so we can stitch the React node back in
  // without forcing them to ship raw HTML.
  const [headingBefore, headingAfter] = t("paths.condition.heading").split("{name}");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/60 animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="w-[min(520px,92vw)] bg-bg border border-bd2 rounded-xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-2xs uppercase tracking-[0.2em] font-mono text-t3 mb-1">
          {t("paths.condition.kicker")}
        </div>
        <div className="font-serif text-[22px] text-char leading-tight mb-2">
          {headingBefore}
          <span className="italic text-yeld">{branch}</span>
          {headingAfter ?? ""}
        </div>
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          {t("paths.condition.lead")}
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
          placeholder={t("paths.condition.placeholder")}
          className="w-full px-3 py-2 bg-bg-soft border border-bd rounded-md text-char text-sm resize-none font-serif italic placeholder:not-italic placeholder:text-t3/70"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {[
            t("paths.condition.preset1"),
            t("paths.condition.preset2"),
            t("paths.condition.preset3"),
            t("paths.condition.preset4"),
            t("paths.condition.preset5"),
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
            {t("paths.condition.cancel")}
          </button>
          {initial && (
            <button
              onClick={() => onSave("")}
              className="px-3 py-1.5 text-sm text-t3 hover:text-danger"
              title={t("paths.condition.clearTitle")}
            >
              {t("paths.condition.clear")}
            </button>
          )}
          <button
            onClick={commit}
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
          >
            {t("paths.condition.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
