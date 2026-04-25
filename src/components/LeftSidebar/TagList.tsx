import { memo, useState } from "react";
import type { TagCount } from "../../lib/types";
import { ChevronRightIcon } from "../../lib/icons";
import { useT } from "../../lib/i18n";

interface Props {
  tags: TagCount[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}

function TagListInner({ tags, activeTag, onSelect }: Props) {
  const t = useT();
  const [open, setOpen] = useState(true);
  if (tags.length === 0) return null;

  return (
    <div className="mt-5 pt-5 pb-2 border-t border-bd/20">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full text-left px-4 mb-1 flex items-center gap-1.5 text-2xs uppercase tracking-wider text-t3 font-semibold hover:text-t2 transition"
      >
        <span
          className="inline-flex items-center transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        >
          <ChevronRightIcon />
        </span>
        <span>{t("sidebar.tags.title")}</span>
        <span className="text-t3/60 font-mono normal-case tracking-normal">
          · {tags.length}
        </span>
      </button>
      {open && (
        <ul className="px-2 space-y-0.5">
          {tags.map((t) => {
            const isActive = activeTag === t.tag;
            return (
              <li key={t.tag}>
                <button
                  onClick={() => onSelect(isActive ? null : t.tag)}
                  className={`w-full text-left px-2.5 py-1 rounded text-xs flex items-center gap-2 transition ${
                    isActive
                      ? "bg-yelp text-yeld"
                      : "text-t2 hover:bg-s2 hover:text-char"
                  }`}
                >
                  <span className="font-mono text-t3">#</span>
                  <span className="truncate flex-1">{t.tag}</span>
                  <span className="text-2xs text-t3 font-mono">{t.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default memo(TagListInner);
