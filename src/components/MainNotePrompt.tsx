import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/tauri";
import type { NoteSummary, WorkspaceConfig } from "../lib/types";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfigChange: (cfg: WorkspaceConfig) => void;
  onAfterSet?: (slug: string) => void;
}

export default function MainNotePrompt({
  open,
  onClose,
  onConfigChange,
  onAfterSet,
}: Props) {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [filter, setFilter] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setFilter("");
    setNewTitle("");
    api.listNotes().then(setNotes).catch(() => setNotes([]));
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) || n.slug.toLowerCase().includes(q),
    );
  }, [notes, filter]);

  const pickExisting = async (slug: string) => {
    setBusy(true);
    setErr(null);
    try {
      const cfg = await api.setMainNote(slug);
      onConfigChange(cfg);
      onAfterSet?.(slug);
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const createAndPick = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    setErr(null);
    try {
      const note = await api.createNote(title);
      const cfg = await api.setMainNote(note.slug);
      onConfigChange(cfg);
      onAfterSet?.(note.slug);
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const switchToBasic = async () => {
    setBusy(true);
    setErr(null);
    try {
      const cfg = await api.setWorkspaceMode("basic");
      onConfigChange(cfg);
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width="w-[min(92vw,560px)]">
      <div className="mb-4">
        <div className="font-serif text-2xl text-char leading-tight mb-1">
          Pick your starting note
        </div>
        <p className="text-xs text-t2 leading-relaxed">
          Every map has a beginning — the anchor for decisions going forward.
          Choose a note that already exists, or create a new one. You can change
          it later in Settings.
        </p>
      </div>

      <div className="mb-3">
        <div className="text-2xs font-mono uppercase tracking-wider text-t3 mb-1.5">
          Use an existing note
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="w-full px-3 py-1.5 bg-s1 border border-bd rounded-md text-char text-sm placeholder:text-t3 focus:outline-none focus:border-yel"
        />
        <ul className="mt-2 max-h-[180px] overflow-y-auto border border-bd rounded-md bg-s1">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-xs text-t3">No notes yet.</li>
          )}
          {filtered.map((n) => (
            <li key={n.slug}>
              <button
                disabled={busy}
                onClick={() => pickExisting(n.slug)}
                className="w-full text-left px-3 py-2 text-sm text-char hover:bg-yelp border-b border-bd last:border-b-0 disabled:opacity-50"
              >
                <div className="font-medium truncate">{n.title}</div>
                <div className="text-2xs text-t3 font-mono truncate">{n.slug}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-3 pt-3 border-t border-bd">
        <div className="text-2xs font-mono uppercase tracking-wider text-t3 mb-1.5">
          Or create a new starting note
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) createAndPick();
            }}
            placeholder="e.g. Garden plan"
            className="flex-1 px-3 py-1.5 bg-s1 border border-bd rounded-md text-char text-sm placeholder:text-t3 focus:outline-none focus:border-yel"
          />
          <button
            disabled={busy || !newTitle.trim()}
            onClick={createAndPick}
            className="px-3 py-1.5 rounded-md bg-yel text-on-yel text-sm font-medium hover:bg-yel2 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      <div className="pt-3 border-t border-bd flex items-center justify-between">
        <button
          disabled={busy}
          onClick={switchToBasic}
          className="text-xs text-t3 hover:text-char underline-offset-2 hover:underline"
        >
          I just want basic notes (no map or paths)
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="text-xs text-t3 hover:text-char"
        >
          Not now
        </button>
      </div>

      {err && <p className="mt-3 text-xs text-danger">{err}</p>}
    </Modal>
  );
}
