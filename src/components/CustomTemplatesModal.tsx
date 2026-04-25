import { useEffect, useMemo, useRef, useState } from "react";
import type { TemplateInfo } from "../lib/types";
import Modal from "./Modal";
import EmptyState from "./EmptyState";
import { useT } from "../lib/i18n";

/**
 * Custom templates picker (2.1). Shows ONLY templates the user has
 * authored themselves — i.e. files in `.yarrow/templates/` whose names
 * are not in the bundled set. Kept separate from the kits picker so
 * Yarrow's curated kits don't drown in user-authored shapes (and vice
 * versa). Same flow as the kits picker: pick a template → name the
 * note → it's created via `cmd_create_from_template`.
 */
interface Props {
  open: boolean;
  templates: TemplateInfo[];
  onClose: () => void;
  onPick: (templateName: string, title: string) => void;
}

export default function CustomTemplatesModal({ open, templates, onClose, onPick }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const t = useT();

  useEffect(() => {
    if (!open) {
      setPending(null);
      setTitle("");
      setSearch("");
    } else {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates
      .filter((tpl) => tpl.is_bundled === false)
      .filter((tpl) => {
        if (!q) return true;
        return (
          tpl.label.toLowerCase().includes(q) ||
          tpl.name.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [templates, search]);

  if (!open) return null;

  if (pending) {
    const tpl = templates.find((tpli) => tpli.name === pending);
    return (
      <Modal open onClose={onClose} title={tpl ? t("modals.customTemplates.startTitle", { label: tpl.label }) : t("modals.customTemplates.startFallbackTitle")}>
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          {t("modals.customTemplates.startBody")}
        </p>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const tt = title.trim();
              if (tt) onPick(pending, tt);
            } else if (e.key === "Escape") {
              setPending(null);
            }
          }}
          placeholder={tpl ? defaultTitleFor(tpl) : ""}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setPending(null)}
          >
            {t("modals.customTemplates.back")}
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            disabled={!title.trim()}
            onClick={() => {
              const tt = title.trim();
              if (tt) onPick(pending, tt);
            }}
          >
            {t("modals.customTemplates.create")}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-char/30 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-[640px] max-w-[94vw] max-h-[80vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden animate-slideUp flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 py-5 border-b border-bd">
          <div className="font-serif text-2xl text-char">{t("modals.customTemplates.title")}</div>
          <div className="font-serif italic text-sm text-t2 mt-1">
            {filtered.length === 1
              ? t("modals.customTemplates.subtitleOne", { count: String(filtered.length) })
              : t("modals.customTemplates.subtitleMany", { count: String(filtered.length) })}
          </div>
          <div className="mt-3">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && search) {
                  e.stopPropagation();
                  setSearch("");
                }
              }}
              placeholder={t("modals.customTemplates.searchPlaceholder")}
              className="w-full px-3.5 py-2 bg-bg border border-bd rounded-full text-sm text-char placeholder:text-t3 focus:outline-none focus:border-bd2 transition"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <EmptyState
              kind="checkpoints"
              title={search ? t("modals.customTemplates.noMatchTitle", { query: search }) : t("modals.customTemplates.noTemplatesTitle")}
              hint={
                search
                  ? t("modals.customTemplates.noMatchHint")
                  : t("modals.customTemplates.noTemplatesHint")
              }
            />
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((tpl) => (
                <li key={tpl.name}>
                  <button
                    onClick={() => {
                      setPending(tpl.name);
                      setTitle(defaultTitleFor(tpl));
                    }}
                    className="w-full text-left bg-bg border border-bd rounded-lg px-4 py-3 hover:border-yel hover:bg-yelp/30 transition"
                  >
                    <div className="font-serif text-[15px] text-char leading-tight">
                      {tpl.label}
                    </div>
                    <div className="text-2xs text-t3 font-mono mt-0.5">
                      {tpl.name}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function defaultTitleFor(t: TemplateInfo): string {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  return `${t.label} — ${iso}`;
}
