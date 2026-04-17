import type { Link } from "../../lib/types";
import { LINK_TYPE_COLORS, LINK_TYPE_LABELS } from "../../lib/types";
import { PlusIcon, XIcon } from "../../lib/icons";

interface Props {
  links: Link[];
  titleMap: Record<string, string>;
  snippetMap: Record<string, string>;
  onNavigate: (slug: string) => void;
  onAdd: () => void;
  onRemove: (to: string) => void;
}

export default function LinkedNotesList({
  links,
  titleMap,
  snippetMap,
  onNavigate,
  onAdd,
  onRemove,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xs uppercase tracking-wider text-t3 font-semibold">
          Linked Notes
        </div>
        <button
          onClick={onAdd}
          className="y-tip w-6 h-6 flex items-center justify-center text-t2 hover:text-char hover:bg-s2 rounded transition"
          data-tip="Add connection"
          aria-label="Add connection"
        >
          <PlusIcon />
        </button>
      </div>

      {links.length === 0 && (
        <button
          onClick={onAdd}
          className="w-full rounded-lg border border-dashed border-bd2 bg-bg hover:bg-yelp hover:border-yel text-xs text-t2 hover:text-yeld py-5 px-3 transition text-center"
        >
          <div className="flex items-center justify-center mb-1 text-current">
            <PlusIcon size={18} />
          </div>
          <div>This note isn't connected yet</div>
          <div className="text-2xs text-t3 mt-1">
            Link it — supports · challenges · came from · open question
          </div>
        </button>
      )}

      <ul className="space-y-2">
        {links.map((l) => (
          <li
            key={`${l.target}-${l.type}`}
            className="group bg-bg rounded-lg border border-bd hover:border-bd2 hover:bg-s1 transition p-2.5 cursor-pointer"
            onClick={() => onNavigate(l.target)}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: LINK_TYPE_COLORS[l.type] ?? "var(--t3)" }}
              />
              <span
                className="text-[11px] uppercase tracking-wide text-t3 font-mono"
              >
                {LINK_TYPE_LABELS[l.type]}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(l.target); }}
                className="ml-auto text-t3 hover:text-danger opacity-0 group-hover:opacity-100 transition"
                title="Remove connection"
                aria-label="Remove connection"
              >
                <XIcon />
              </button>
            </div>
            <div className="mt-1 text-sm text-char font-medium truncate">
              {titleMap[l.target] ?? l.target}
            </div>
            {snippetMap[l.target] && (
              <div className="mt-1 text-2xs text-t2 line-clamp-2 leading-snug">
                {snippetMap[l.target]}
              </div>
            )}
          </li>
        ))}
      </ul>

      {links.length > 0 && (
        <button
          onClick={onAdd}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs border border-dashed border-bd2 text-t2 hover:bg-yelp hover:text-yeld hover:border-yel transition"
        >
          <PlusIcon />
          <span>Add another connection</span>
        </button>
      )}
    </div>
  );
}
