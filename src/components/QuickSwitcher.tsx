import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteSummary } from "../lib/types";
import { SearchIcon, Kbd, EnterKeyIcon, NoteIcon } from "../lib/icons";
import { SK } from "../lib/platform";
import { useT } from "../lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  notes: NoteSummary[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

/**
 * Obsidian-style quick note switcher. Fuzzy-matches titles; Enter to jump.
 * Keyboard: ↑↓ move, ↵ open, esc close.
 */
export default function QuickSwitcher({
  open,
  onClose,
  notes,
  activeSlug,
  onSelect,
}: Props) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    setQ("");
    setCursor(0);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const matches = useMemo(() => {
    const trimmed = q.trim();
    // With no query, show recent-ish (respecting existing order) but put active last
    if (!trimmed) {
      return notes
        .filter((n) => n.slug !== activeSlug)
        .slice(0, 50)
        .map((n) => ({ note: n, score: 0 }));
    }
    const scored = notes
      .map((n) => ({ note: n, score: fuzzyScore(trimmed, n.title || n.slug) }))
      .filter((x) => x.score >= 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20);
  }, [q, notes, activeSlug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(matches.length - 1, c + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = matches[cursor];
        if (pick) {
          onSelect(pick.note.slug);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, matches, cursor, onSelect, onClose]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current
      .querySelector<HTMLDivElement>(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-char/20 pt-28 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-[520px] max-w-[92vw] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-bd">
          <span className="text-t3 mr-2"><SearchIcon size={16} /></span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            placeholder={t("modals.quickSwitcher.placeholder")}
            className="flex-1 bg-transparent outline-none text-char placeholder:text-t3 text-base"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-1">
          {matches.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-t3">
              {t("modals.quickSwitcher.noMatch", { query: q })}
            </div>
          )}
          {matches.map(({ note }, i) => (
            <div
              key={note.slug}
              data-idx={i}
              onMouseEnter={() => setCursor(i)}
              onClick={() => { onSelect(note.slug); onClose(); }}
              className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                i === cursor ? "bg-yelp" : ""
              }`}
            >
              <span className={`shrink-0 ${i === cursor ? "text-yeld" : "text-t3"}`}>
                <NoteIcon size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-char truncate">
                  {renderHighlighted(note.title || note.slug, q)}
                </div>
                {note.excerpt && (
                  <div className="text-2xs text-t3 truncate">
                    {note.excerpt}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-bd bg-s1 text-2xs text-t3 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5"><Kbd>↑↓</Kbd> {t("modals.quickSwitcher.move")}</span>
          <span className="inline-flex items-center gap-1.5"><Kbd><EnterKeyIcon /></Kbd> {t("modals.quickSwitcher.openLabel")}</span>
          <span className="ml-auto inline-flex items-center gap-1.5"><Kbd>{SK.quickSwitch}</Kbd> {t("modals.quickSwitcher.toggle")}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Returns a score >= 0 if `query` fuzzy-matches `target`, else -1.
 * Rewards: contiguous substring, start-of-target, consecutive char streaks.
 */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx !== -1) return 10000 - idx + (idx === 0 ? 500 : 0);
  // subsequence scan
  let ti = 0;
  let streak = 0;
  let bestStreak = 0;
  let lastMatch = -1;
  for (let qi = 0; qi < q.length; qi++) {
    let found = false;
    while (ti < t.length) {
      if (t[ti] === q[qi]) {
        if (lastMatch === ti - 1) streak++;
        else streak = 1;
        bestStreak = Math.max(bestStreak, streak);
        lastMatch = ti;
        ti++;
        found = true;
        break;
      }
      ti++;
    }
    if (!found) return -1;
  }
  return 500 + bestStreak * 80 - lastMatch;
}

function renderHighlighted(target: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return target;
  const idx = target.toLowerCase().indexOf(q);
  if (idx === -1) return target;
  return (
    <>
      {target.slice(0, idx)}
      <span className="text-yeld font-medium">{target.slice(idx, idx + q.length)}</span>
      {target.slice(idx + q.length)}
    </>
  );
}
