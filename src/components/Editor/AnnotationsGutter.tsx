import { useEffect, useRef, useState } from "react";
import type { Annotation } from "../../lib/types";
import { relativeTime } from "../../lib/format";

interface Props {
  annotations: Annotation[];
  onChange: (next: Annotation[]) => void;
}

/**
 * Right-side "margin ink" gutter. Each entry is a thinking-about-the-thinking
 * note pinned to a short anchor from the body. Persisted in YAML frontmatter
 * as `annotations: [{ anchor, body, at }]`, so external markdown tools can
 * round-trip the file without mangling them.
 *
 * Editing is inline — click a card to flip it into a textarea; blur or Esc
 * saves. New annotations land via the `yarrow:add-annotation` custom event
 * (fired by the editor's right-click "Annotate selection" item).
 */
export default function AnnotationsGutter({ annotations, onChange }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<string>("");

  // Auto-open the newest empty card for editing. When the user clicks
  // "Annotate" in the radial, the shell adds a blank-body entry and
  // setAnnotations round-trips; the gutter first sees the new item here
  // and should jump straight into a textarea — typing "Annotate" and
  // then hunting for the card to click is busywork.
  const prevLenRef = useRef(annotations.length);
  useEffect(() => {
    const prev = prevLenRef.current;
    prevLenRef.current = annotations.length;
    if (annotations.length > prev) {
      // New entry landed; focus it if it's empty and no one else is
      // mid-edit.
      const newest = annotations[annotations.length - 1];
      if (newest && !newest.body.trim() && editingIdx == null) {
        setEditingIdx(annotations.length - 1);
        setDraft("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations.length]);

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setDraft(annotations[i]?.body ?? "");
  };
  const commitEdit = () => {
    if (editingIdx == null) return;
    const next = annotations.slice();
    const body = draft.trim();
    if (!body) {
      next.splice(editingIdx, 1);
    } else {
      next[editingIdx] = { ...next[editingIdx], body };
    }
    setEditingIdx(null);
    setDraft("");
    onChange(next);
  };
  const cancelEdit = () => {
    setEditingIdx(null);
    setDraft("");
  };
  const remove = (i: number) => {
    const next = annotations.slice();
    next.splice(i, 1);
    onChange(next);
  };

  return (
    <div>
      {annotations.map((a, i) => {
        const editing = editingIdx === i;
        const when = parseAt(a.at);
        return (
          <div key={i} className={`yarrow-annotation${editing ? " is-editing" : ""}`}>
            <div className="meta">
              <span>{when != null ? relativeTime(when) : "note"}</span>
              <button
                onClick={() => remove(i)}
                title="Remove this annotation"
                aria-label="Remove annotation"
              >
                ×
              </button>
            </div>
            {a.anchor ? <div className="anchor">“{a.anchor}”</div> : null}
            {editing ? (
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    commitEdit();
                  }
                }}
                rows={3}
              />
            ) : (
              <div
                onClick={() => startEdit(i)}
                style={{ cursor: "text", whiteSpace: "pre-wrap" }}
              >
                {a.body || <em style={{ color: "var(--t3)" }}>empty — click to write</em>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Parse the ISO timestamp written into `at` at annotation-creation time.
 *  Returns unix seconds for `relativeTime`, which expects that shape, or
 *  null when the stored value is malformed (older files, hand-edits). */
function parseAt(at?: string): number | null {
  if (!at) return null;
  const ms = Date.parse(at);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}
