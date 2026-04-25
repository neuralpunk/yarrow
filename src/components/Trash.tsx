import { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import type { TrashEntry } from "../lib/types";
import { relativeTime } from "../lib/format";
import EmptyState from "./EmptyState";
import { useT } from "../lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful restore so the parent can refresh notes. */
  onChanged: () => void;
}

export default function Trash({ open, onClose, onChanged }: Props) {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    setError(null);
    api.listTrash().then(setEntries).catch((e) => setError(String(e)));
  }, [open]);

  if (!open) return null;

  const reload = async () => {
    try { setEntries(await api.listTrash()); } catch (e) { setError(String(e)); }
  };

  const restore = async (slug: string) => {
    setBusy(slug);
    setError(null);
    try {
      await api.restoreFromTrash(slug);
      onChanged();
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const purge = async (slug: string) => {
    if (!confirm(t("modals.trash.purgeConfirm", { slug }))) return;
    setBusy(slug);
    try {
      await api.purgeFromTrash(slug);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const emptyAll = async () => {
    if (entries.length === 0) return;
    if (!confirm(entries.length === 1 ? t("modals.trash.emptyConfirmOne") : t("modals.trash.emptyConfirmMany", { count: String(entries.length) }))) return;
    try {
      await api.emptyTrash();
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[78vh] bg-bg border border-bd2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-baseline justify-between px-5 py-4 border-b border-bd">
          <div>
            <div className="font-serif text-xl text-char">{t("modals.trash.title")}</div>
            <div className="text-2xs text-t3 mt-0.5">
              {t("modals.trash.subtitle")}
            </div>
          </div>
          <button
            onClick={emptyAll}
            disabled={entries.length === 0}
            className="text-xs text-t3 hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("modals.trash.empty")}
          </button>
        </div>

        {error && (
          <div className="px-5 py-2 text-xs text-danger bg-danger/10 border-b border-bd">
            {error}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {entries.length === 0 ? (
            <EmptyState kind="trash" size="roomy" />
          ) : (
            <ul>
              {entries.map((e) => (
                <li
                  key={e.slug}
                  className="px-5 py-3 border-b border-bd/60 flex items-center gap-3 hover:bg-s1/60"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-char truncate">{e.title}</div>
                    <div className="text-2xs text-t3 font-mono mt-0.5 truncate">
                      {e.slug} · {t("modals.trash.removed", { when: relativeTime(e.deleted_at) })}
                    </div>
                  </div>
                  <button
                    disabled={busy === e.slug}
                    onClick={() => restore(e.slug)}
                    className="text-xs px-2.5 py-1 rounded bg-yelp text-yeld hover:bg-yel hover:text-on-yel disabled:opacity-50"
                  >
                    {t("modals.trash.restore")}
                  </button>
                  <button
                    disabled={busy === e.slug}
                    onClick={() => purge(e.slug)}
                    className="text-xs px-2.5 py-1 rounded text-t3 hover:text-danger hover:bg-danger/10 disabled:opacity-50"
                  >
                    {t("modals.trash.purge")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd flex justify-end">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char"
          >
            {t("modals.trash.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
