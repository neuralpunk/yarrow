import { useEffect, useRef } from "react";
import { useT } from "../lib/i18n";

export interface SpellMenuProps {
  word: string;
  suggestions: string[];
  /** Range in the editor doc to replace when a suggestion is picked. */
  from: number;
  to: number;
  /** Anchor coordinates (window-relative). */
  x: number;
  y: number;
  onClose: () => void;
  /** Persist the word into the workspace dictionary. */
  onAddToDictionary: (word: string) => void;
}

/** Lightweight popover surfaced when the user right-clicks a misspelled word.
 *  Picking a suggestion fires a `yarrow:editor-replace-range` event so the
 *  active editor instance applies the swap; "Add to dictionary" persists the
 *  word into `.yarrow/dictionary.txt`. */
export default function SpellMenu({
  word, suggestions, from, to, x, y, onClose, onAddToDictionary,
}: SpellMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const replace = (text: string) => {
    window.dispatchEvent(new CustomEvent("yarrow:editor-replace-range", {
      detail: { from, to, text },
    }));
    onClose();
  };

  // Clamp to viewport so the popover never spills off the right/bottom edges.
  const W = 220;
  const H = 240;
  const left = Math.min(x, window.innerWidth - W - 8);
  const top = Math.min(y, window.innerHeight - H - 8);

  return (
    <div
      ref={ref}
      style={{ left, top, width: W }}
      className="fixed z-[60] bg-bg border border-bd2 rounded-lg shadow-2xl py-1.5 text-xs animate-fadeIn"
    >
      <div className="px-3 pb-1.5 border-b border-bd text-2xs text-t3 font-mono uppercase tracking-wider">
        “{word}”
      </div>
      {suggestions.length === 0 ? (
        <div className="px-3 py-2 italic text-t3 font-serif">{t("modals.spell.noSuggestions")}</div>
      ) : (
        <ul className="max-h-44 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                onClick={() => replace(s)}
                className="w-full text-left px-3 py-1.5 text-char hover:bg-yelp"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-bd mt-1 pt-1">
        <button
          onClick={() => { onAddToDictionary(word); onClose(); }}
          className="w-full text-left px-3 py-1.5 text-t2 hover:bg-s2 hover:text-char"
        >
          {t("modals.spell.addToDictionary", { word })}
        </button>
      </div>
    </div>
  );
}
