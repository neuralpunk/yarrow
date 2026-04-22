import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import type { NoteSummary } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  notes: NoteSummary[];
  /** Slug of the note being edited — excluded from the list so a note
   *  can't link to itself. */
  currentSlug?: string;
  /** Called with the exact text to insert (e.g. `[[Note]]` or `![[Note]]`). */
  onInsert: (text: string) => void;
}

export default function WikilinkPicker({ open, onClose, notes, currentSlug, onInsert }: Props) {
  const [query, setQuery] = useState("");
  const [embed, setEmbed] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setEmbed(false);
    setCursor(0);
    // Focus happens after the modal paints so the input is mountable.
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = notes.filter((n) => n.slug !== currentSlug);
    if (!q) return pool.slice(0, 50);
    return pool
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) || n.slug.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [notes, currentSlug, query]);

  // Keep the cursor in bounds as filtering narrows the list.
  useEffect(() => {
    if (cursor >= filtered.length) setCursor(Math.max(0, filtered.length - 1));
  }, [filtered.length, cursor]);

  // Scroll the highlighted row into view as the cursor moves.
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const commit = (note?: NoteSummary) => {
    const target = note ?? filtered[cursor];
    if (!target) return;
    const label = target.title || target.slug;
    const text = embed ? `![[${label}]]` : `[[${label}]]`;
    onInsert(text);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  };

  return (
    <Modal open={open} onClose={onClose} width="w-[480px]">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-serif text-xl text-char">Insert wikilink</h2>
        <span className="font-mono text-2xs text-t3">
          {filtered.length} {filtered.length === 1 ? "match" : "matches"}
        </span>
      </div>

      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
        onKeyDown={onKeyDown}
        placeholder="Search notes by title or slug…"
        className="w-full px-3 py-2 bg-s1 border border-bd rounded-md text-sm text-char placeholder:text-t3 outline-none focus:border-yeld"
      />

      <div
        ref={listRef}
        className="mt-3 max-h-[320px] overflow-y-auto rounded-md border border-bd divide-y divide-bd"
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-t3 font-serif italic">
            {notes.length <= 1
              ? "No other notes in this workspace yet."
              : "No notes match that search."}
          </div>
        ) : (
          filtered.map((n, i) => (
            <button
              key={n.slug}
              data-idx={i}
              onMouseEnter={() => setCursor(i)}
              onClick={() => commit(n)}
              className={`w-full text-left px-3 py-2 flex items-baseline gap-3 transition ${
                i === cursor ? "bg-yelp" : "hover:bg-s2"
              }`}
            >
              <span className="flex-1 truncate text-char text-sm">
                {n.title || n.slug}
              </span>
              <span className="font-mono text-2xs text-t3 truncate max-w-[180px]">
                {n.slug}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-t2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={embed}
            onChange={(e) => setEmbed(e.target.checked)}
            className="accent-yeld"
          />
          <span>
            Embed inline (<code className="font-mono text-2xs">![[…]]</code>)
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-t2 hover:text-char transition"
          >
            Cancel
          </button>
          <button
            onClick={() => commit()}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 text-xs rounded-md bg-char text-bg hover:bg-yeld transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Insert
          </button>
        </div>
      </div>

      <div className="mt-3 font-serif italic text-2xs text-t3">
        ↑↓ to move · Enter to insert · Esc to cancel
      </div>
    </Modal>
  );
}
