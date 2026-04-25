import { memo, useEffect, useRef, useState } from "react";
import { api } from "../../lib/tauri";
import { useT } from "../../lib/i18n";

interface Props {
  slug: string;
  title: string;
  body: string;
  /** The tags already on the note. We never suggest these. */
  existingTags: string[];
  /** User clicked a suggestion chip. Parent should append to tag list. */
  onAdopt: (tag: string) => void;
  /** True while the note is locked (encrypted) — we skip entirely. */
  locked?: boolean;
}

/**
 * Tag Bouquet (2.1): a quiet row of up-to-five suggested tags rendered
 * under the TagChips input. Fully local — powered by
 * `cmd_suggest_tags`. Auto-refreshes when the user stops typing for
 * ~900 ms; collapses itself when it has nothing to offer. Dismissing
 * the bouquet hides it for the current note.
 */
function TagBouquetInner({ slug, title, body, existingTags, onAdopt, locked }: Props) {
  const t = useT();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  // Fresh slug == fresh dismissal state. The user's "not now" applies to
  // the note they were looking at, not every future one.
  const slugRef = useRef(slug);
  if (slugRef.current !== slug) {
    slugRef.current = slug;
    // State reset — do it in a render-local way so we don't need another
    // useEffect just to clear.
    if (dismissed) setDismissed(false);
    if (suggestions.length) setSuggestions([]);
  }

  useEffect(() => {
    if (locked) { setSuggestions([]); return; }
    if (dismissed) return;
    // Need at least ~20 chars of body before we bother suggesting.
    if (body.trim().length < 20) { setSuggestions([]); return; }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const next = await api.suggestTags(body, title, existingTags, 5);
        if (!cancelled) setSuggestions(next);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [slug, body, title, existingTags.join(""), dismissed, locked]);

  if (locked || dismissed || suggestions.length === 0) return null;

  return (
    <div className="-mt-1 mb-3 px-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xs uppercase tracking-[0.14em] text-t3 font-sans">
          {t("editor.tagBouquet.suggested")}
        </span>
        {suggestions.map((tag) => (
          <button
            key={tag}
            onClick={() => {
              // Drop the suggestion immediately — stale suggestions feel
              // weird when they linger after you've adopted them.
              setSuggestions((xs) => xs.filter((x) => x !== tag));
              onAdopt(tag);
            }}
            className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-bg border border-dashed border-bd2 text-t2 hover:bg-yelp hover:border-yel hover:text-yeld font-mono transition"
            title={t("editor.tagBouquet.addTitle", { tag })}
          >
            <span className="text-yel">+</span>
            <span>#{tag}</span>
          </button>
        ))}
        <button
          onClick={() => setDismissed(true)}
          className="ml-1 text-2xs text-t3 hover:text-ch2"
          title={t("editor.tagBouquet.dismissTitle")}
        >
          {t("editor.tagBouquet.dismiss")}
        </button>
      </div>
    </div>
  );
}

export default memo(TagBouquetInner);
