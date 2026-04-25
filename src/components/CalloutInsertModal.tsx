import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { api } from "../lib/tauri";
import { useT, type StringKey } from "../lib/i18n";

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
  { key: "note",     labelKey: "modals.callout.typeNote",     descKey: "modals.callout.typeNoteDesc" },
  { key: "info",     labelKey: "modals.callout.typeInfo",     descKey: "modals.callout.typeInfoDesc" },
  { key: "tip",      labelKey: "modals.callout.typeTip",      descKey: "modals.callout.typeTipDesc" },
  { key: "question", labelKey: "modals.callout.typeQuestion", descKey: "modals.callout.typeQuestionDesc" },
  { key: "decision", labelKey: "modals.callout.typeDecision", descKey: "modals.callout.typeDecisionDesc" },
  { key: "warning",  labelKey: "modals.callout.typeWarning",  descKey: "modals.callout.typeWarningDesc" },
  { key: "danger",   labelKey: "modals.callout.typeDanger",   descKey: "modals.callout.typeDangerDesc" },
  { key: "quote",    labelKey: "modals.callout.typeQuote",    descKey: "modals.callout.typeQuoteDesc" },
] as const satisfies ReadonlyArray<{ key: string; labelKey: StringKey; descKey: StringKey }>;

type CalloutKey = typeof TYPES[number]["key"];

export default function CalloutInsertModal({ open, onClose, onInsert }: Props) {
  const [type, setType] = useState<CalloutKey>("note");
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const t = useT();

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
        .catch(() => setPreviewHtml(`<p style='color:var(--danger)'>${t("modals.callout.previewFailed")}</p>`));
    }, 160);
    return () => window.clearTimeout(h);
  }, [markdown, open, t]);

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
        <h2 className="font-serif text-xl text-char">{t("modals.callout.title")}</h2>
        <span className="font-serif italic text-2xs text-t3">
          {t("modals.callout.shortcutHint")}
        </span>
      </div>

      <div onKeyDown={onAnyKeyDown}>
        {/* type picker */}
        <div className="mb-4">
          <div className="font-serif italic text-2xs text-t3 mb-2">{t("modals.callout.typeLabel")}</div>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((ty) => {
              const active = ty.key === type;
              return (
                <button
                  key={ty.key}
                  type="button"
                  onClick={() => { setType(ty.key); bodyRef.current?.focus(); }}
                  title={t(ty.descKey)}
                  className={`px-3 py-2 rounded-md border text-left transition flex items-center gap-2 ${
                    active
                      ? "bg-yelp border-yel text-char"
                      : "bg-s1 border-bd text-t2 hover:border-bd2 hover:text-char"
                  }`}
                >
                  <span
                    className="yarrow-callout-icon-chip"
                    data-kind={ty.key}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="font-serif italic text-sm block">{t(ty.labelKey)}</span>
                    <span className="font-mono text-2xs text-t3 block truncate">{ty.key}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* title + body inputs */}
        <div className="mb-4 space-y-3">
          <div>
            <label className="font-serif italic text-2xs text-t3 block mb-1">{t("modals.callout.titleField")}</label>
            <input
              id="yarrow-callout-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitleFor(type)}
              className="w-full px-3 py-2 bg-s1 border border-bd rounded text-char text-sm placeholder:text-t3 focus:outline-none focus:border-yel"
            />
          </div>
          <div>
            <label className="font-serif italic text-2xs text-t3 block mb-1">{t("modals.callout.bodyField")}</label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("modals.callout.bodyPlaceholder")}
              rows={4}
              className="w-full px-3 py-2 bg-s1 border border-bd rounded text-char text-sm placeholder:text-t3 focus:outline-none focus:border-yel resize-y"
            />
          </div>
        </div>

        {/* live preview */}
        <div className="mb-4">
          <div className="font-serif italic text-2xs text-t3 mb-2">{t("modals.callout.previewLabel")}</div>
          <div className="bg-bg border border-bd rounded-md p-4 max-h-[220px] overflow-y-auto">
            <div
              className="yarrow-reading"
              dangerouslySetInnerHTML={{ __html: previewHtml || `<p style="color: var(--t3); font-style: italic;">${t("modals.callout.startTyping")}</p>` }}
            />
          </div>
        </div>

        {/* raw markdown peek */}
        <details className="mb-4">
          <summary className="font-serif italic text-2xs text-t3 cursor-pointer hover:text-t2 select-none">
            {t("modals.callout.showRaw")}
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
            {t("modals.callout.cancel")}
          </button>
          <button
            onClick={commit}
            className="px-3 py-1.5 text-xs rounded-md bg-char text-bg hover:bg-yeld transition"
          >
            {t("modals.callout.insert")}
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

