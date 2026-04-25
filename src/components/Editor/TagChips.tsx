import { useEffect, useRef, useState } from "react";
import { tagPillClass } from "../../lib/tagStyles";
import { useT } from "../../lib/i18n";

interface Props {
  /** Initial tag list — refreshed when the parent note changes. */
  initial: string[];
  /** Persist the new list. The parent's handler hits the backend
   *  (`cmd_set_tags`) and refreshes the workspace tag panel. */
  onCommit: (tags: string[]) => Promise<void> | void;
  /** All tags in the workspace (for autocomplete suggestions). */
  suggestions?: string[];
}

/** Inline chip-input under the note title for adding / removing tags
 *  without touching frontmatter. Each tag is a small pill with an `×`;
 *  typing in the trailing input + Enter (or comma / space) commits the
 *  new tag; Backspace on an empty input removes the last tag. */
export default function TagChips({ initial, onCommit, suggestions = [] }: Props) {
  const t = useT();
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Skip the initial mount-commit; only persist when the user has actually
  // changed the list. Without this we'd write a tags-equal-themselves
  // checkpoint every time the editor remounts on note switch.
  const dirtyRef = useRef(false);
  // Refs that track the latest tags + onCommit so the unmount cleanup can
  // flush a pending edit even if React's render-time onCommit closure has
  // been replaced. Without these, switching notes quickly after editing a
  // tag silently drops the edit (the debounce timer was cleared but never
  // fired).
  const tagsRef = useRef<string[]>(initial);
  const onCommitRef = useRef(onCommit);
  tagsRef.current = tags;
  onCommitRef.current = onCommit;

  useEffect(() => {
    // Don't clobber an in-progress edit. If the user just typed a tag and
    // a save round-trip lands a fresh `initial` from the parent before the
    // commit debounce fires (or while a second tag is being added), we'd
    // otherwise discard their unsaved edit. The unmount flush handles the
    // note-switch case; this guard handles the reload-during-edit case.
    if (dirtyRef.current) return;
    setTags(initial);
    setDraft("");
  }, [initial.join("\u0001")]);

  // Debounced commit so rapid typing of two tags doesn't fire two writes.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = window.setTimeout(() => {
      void onCommitRef.current(tagsRef.current);
      dirtyRef.current = false;
    }, 400);
    return () => window.clearTimeout(t);
  }, [tags]);

  // Unmount-only flush. Catches the "user switched notes during the 400 ms
  // debounce" case — without this, the pending tag edit would be silently
  // dropped because the [tags] effect's cleanup clears the timer but
  // doesn't fire it. Mirrors the editor's body-save flush on unmount.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        try { void onCommitRef.current(tagsRef.current); } catch {}
        dirtyRef.current = false;
      }
    };
  }, []);

  const addTag = (raw: string) => {
    let t = raw.trim();
    while (t.startsWith("#")) t = t.slice(1);
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    dirtyRef.current = true;
  };

  const removeAt = (i: number) => {
    setTags(tags.filter((_, idx) => idx !== i));
    dirtyRef.current = true;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || (e.key === " " && draft.trim())) {
      e.preventDefault();
      addTag(draft);
      setDraft("");
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      e.preventDefault();
      removeAt(tags.length - 1);
    } else if (e.key === "Escape") {
      setDraft("");
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  const matches = draft.trim() && focused
    ? suggestions
        .filter((s) => s.toLowerCase().includes(draft.trim().toLowerCase()))
        .filter((s) => !tags.includes(s))
        .slice(0, 6)
    : [];

  return (
    <div className="relative flex items-center flex-wrap gap-1.5 -mt-1 mb-3">
      {tags.length === 0 && !focused && (
        <button
          onClick={() => inputRef.current?.focus()}
          className="text-2xs italic text-t3 hover:text-yeld font-serif"
          title={t("editor.tagChips.addTagsTitle")}
        >
          {t("editor.tagChips.addTags")}
        </button>
      )}
      {tags.map((tag, i) => (
        <span
          key={`${tag}:${i}`}
          className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-2xs font-mono group ${tagPillClass(tag)}`}
        >
          <span>#{tag}</span>
          <button
            onClick={() => removeAt(i)}
            className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-yel hover:text-on-yel text-yeld/60"
            title={t("editor.tagChips.removeTitle", { tag })}
            aria-label={t("editor.tagChips.removeAria", { tag })}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Defer so a click on a suggestion can register before blur tears
          // the popover down.
          setTimeout(() => setFocused(false), 100);
          if (draft.trim()) {
            addTag(draft);
            setDraft("");
          }
        }}
        placeholder={tags.length === 0 ? "" : t("editor.tagChips.addTagPlaceholder")}
        className="bg-transparent border-0 outline-none text-2xs font-mono text-char placeholder:text-t3 w-20 min-w-[64px]"
      />

      {matches.length > 0 && (
        <div className="absolute z-30 left-0 top-full mt-1 bg-bg border border-bd2 rounded-md shadow-lg py-1 w-44">
          {matches.map((m) => (
            <button
              key={m}
              onMouseDown={(e) => {
                // mousedown fires before blur — without this the click is
                // swallowed by the input losing focus.
                e.preventDefault();
                addTag(m);
                setDraft("");
                inputRef.current?.focus();
              }}
              className="w-full text-left px-2.5 py-1 text-xs text-char hover:bg-yelp font-mono"
            >
              #{m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

