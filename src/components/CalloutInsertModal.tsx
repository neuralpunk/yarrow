import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { api } from "../lib/tauri";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with a ready-to-insert markdown callout block. */
  onInsert: (markdown: string) => void;
}

/** The same eight types the editor plugin and reading-mode renderer
 *  already know about. Kept in this file for quick edits — no external
 *  source of truth to drift from. */
const TYPES = [
  { key: "note",     label: "Note",     desc: "General observation or reminder" },
  { key: "info",     label: "Info",     desc: "Context the reader should know" },
  { key: "tip",      label: "Tip",      desc: "A helpful nudge or shortcut" },
  { key: "question", label: "Question", desc: "Something you're still figuring out" },
  { key: "decision", label: "Decision", desc: "A choice you're committing to" },
  { key: "warning",  label: "Warning",  desc: "A soft caution worth flagging" },
  { key: "danger",   label: "Danger",   desc: "A hard stop — read before acting" },
  { key: "quote",    label: "Quote",    desc: "Something worth quoting verbatim" },
] as const;

type CalloutKey = typeof TYPES[number]["key"];

export default function CalloutInsertModal({ open, onClose, onInsert }: Props) {
  const [type, setType] = useState<CalloutKey>("note");
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setType("note");
    setTitle("");
    setBody("");
    setPreviewHtml("");
    // Autofocus the title input on open.
    const t = window.setTimeout(() => {
      const el = document.getElementById("yarrow-callout-title-input") as HTMLInputElement | null;
      el?.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, [open]);

  // Build the raw markdown for this callout from the current inputs.
  const markdown = useMemo(() => buildCallout(type, title, body), [type, title, body]);

  // Render the live HTML preview via the same backend pipeline reading
  // mode uses, so what you see is exactly what the finished note will
  // show. Debounced 160 ms to avoid IPC spam while typing.
  useEffect(() => {
    if (!open) return;
    const h = window.setTimeout(() => {
      api.renderMarkdownHtml(markdown)
        .then(setPreviewHtml)
        .catch(() => setPreviewHtml("<p style='color:var(--danger)'>preview failed</p>"));
    }, 160);
    return () => window.clearTimeout(h);
  }, [markdown, open]);

  const commit = () => {
    onInsert(markdown);
    onClose();
  };

  const onAnyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };

  return (
    <Modal open={open} onClose={onClose} width="w-[780px]">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-xl text-char">Insert callout</h2>
        <span className="font-serif italic text-2xs text-t3">
          ⌘↵ to insert · esc to cancel
        </span>
      </div>

      <div onKeyDown={onAnyKeyDown}>
        {/* type picker */}
        <div className="mb-4">
          <div className="font-serif italic text-2xs text-t3 mb-2">Type</div>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => {
              const active = t.key === type;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setType(t.key); bodyRef.current?.focus(); }}
                  title={t.desc}
                  className={`px-3 py-2 rounded-md border text-left transition flex items-center gap-2 ${
                    active
                      ? "bg-yelp border-yel text-char"
                      : "bg-s1 border-bd text-t2 hover:border-bd2 hover:text-char"
                  }`}
                >
                  <span
                    className="yarrow-callout-icon-chip"
                    data-kind={t.key}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="font-serif italic text-sm block">{t.label}</span>
                    <span className="font-mono text-2xs text-t3 block truncate">{t.key}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* title + body inputs */}
        <div className="mb-4 space-y-3">
          <div>
            <label className="font-serif italic text-2xs text-t3 block mb-1">Title (optional)</label>
            <input
              id="yarrow-callout-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitleFor(type)}
              className="w-full px-3 py-2 bg-s1 border border-bd rounded text-char text-sm placeholder:text-t3 focus:outline-none focus:border-yel"
            />
          </div>
          <div>
            <label className="font-serif italic text-2xs text-t3 block mb-1">Body</label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What do you want to say? Markdown is fine — **bold**, [[wikilinks]], and lists all work."
              rows={4}
              className="w-full px-3 py-2 bg-s1 border border-bd rounded text-char text-sm placeholder:text-t3 focus:outline-none focus:border-yel resize-y"
            />
          </div>
        </div>

        {/* live preview */}
        <div className="mb-4">
          <div className="font-serif italic text-2xs text-t3 mb-2">Preview</div>
          <div className="bg-bg border border-bd rounded-md p-4 max-h-[220px] overflow-y-auto">
            <div
              className="yarrow-reading"
              dangerouslySetInnerHTML={{ __html: previewHtml || fallbackPreview() }}
            />
          </div>
        </div>

        {/* raw markdown peek */}
        <details className="mb-4">
          <summary className="font-serif italic text-2xs text-t3 cursor-pointer hover:text-t2 select-none">
            Show raw markdown
          </summary>
          <pre className="mt-2 font-mono text-[11px] text-t2 bg-s1 border border-bd rounded-md p-3 overflow-x-auto whitespace-pre">
            {markdown.trim()}
          </pre>
        </details>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-t2 hover:text-char transition"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            className="px-3 py-1.5 text-xs rounded-md bg-char text-bg hover:bg-yeld transition"
          >
            Insert
          </button>
        </div>
      </div>
    </Modal>
  );
}

function buildCallout(type: CalloutKey, title: string, body: string): string {
  const t = title.trim();
  const firstLine = t ? `> [!${type}] ${t}` : `> [!${type}]`;
  // Each body line gets a `> ` prefix. Empty lines become `> ` so the
  // blockquote visually breaks a paragraph inside the callout instead
  // of ending it. A trailing newline pair separates the callout from
  // whatever prose follows.
  const bodyLines = body.split(/\r?\n/).map((l) => `> ${l}`).join("\n");
  const bodyBlock = body.length > 0 ? `\n${bodyLines}` : "";
  return `\n${firstLine}${bodyBlock}\n`;
}

function defaultTitleFor(type: CalloutKey): string {
  // Shown as placeholder only — the backend already falls back to the
  // pretty type name when the title is empty, so we mirror that here
  // so the empty state reads as "what you'll see if you leave it blank."
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function fallbackPreview(): string {
  return '<p style="color: var(--t3); font-style: italic;">Start typing to see the preview.</p>';
}
