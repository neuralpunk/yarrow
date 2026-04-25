import { memo, useEffect, useState } from "react";
import { api } from "../../lib/tauri";
import type { NoteSummary } from "../../lib/types";
import { parseEmbeds, resolveEmbed, type Embed } from "../../lib/transclusion";
import { slugify } from "../../lib/format";
import { useT } from "../../lib/i18n";

interface Props {
  body: string;
  notes: NoteSummary[];
  onNavigate: (slug: string) => void;
  refreshToken?: number;
}

interface Resolved {
  embed: Embed;
  targetSlug: string | null;
  targetTitle: string;
  content: string;
}

function TransclusionsInner({ body, notes, onNavigate, refreshToken }: Props) {
  const t = useT();
  const [resolved, setResolved] = useState<Resolved[]>([]);

  useEffect(() => {
    let alive = true;
    const embeds = parseEmbeds(body);
    if (embeds.length === 0) {
      setResolved([]);
      return;
    }
    (async () => {
      const titleIndex = new Map<string, NoteSummary>();
      for (const n of notes) {
        titleIndex.set(n.slug, n);
        titleIndex.set(n.title.toLowerCase(), n);
      }
      const out: Resolved[] = [];
      for (const e of embeds) {
        const direct = titleIndex.get(e.target) || titleIndex.get(e.target.toLowerCase()) || titleIndex.get(slugify(e.target));
        if (!direct) {
          out.push({ embed: e, targetSlug: null, targetTitle: e.target, content: "" });
          continue;
        }
        try {
          const n = await api.readNote(direct.slug);
          out.push({
            embed: e,
            targetSlug: direct.slug,
            targetTitle: direct.title,
            content: resolveEmbed(e, n.body),
          });
        } catch {
          out.push({ embed: e, targetSlug: direct.slug, targetTitle: direct.title, content: "" });
        }
      }
      if (alive) setResolved(out);
    })();
    return () => { alive = false; };
  }, [body, notes, refreshToken]);

  if (resolved.length === 0) return null;

  return (
    <div className="px-3 py-3 border-t border-bd">
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xs uppercase tracking-wider text-t3 font-semibold">
          {t("sidebar.transclusions.title")}
        </div>
        <span className="text-2xs text-t3">{resolved.length}</span>
      </div>
      <ul className="space-y-2">
        {resolved.map((r, i) => (
          <li
            key={i}
            className="bg-bg border-l-2 border-yel/60 pl-3 pr-2 py-1.5 rounded-r"
          >
            <button
              onClick={() => r.targetSlug && onNavigate(r.targetSlug)}
              disabled={!r.targetSlug}
              className="text-xs text-yeld hover:underline disabled:text-danger disabled:no-underline"
              title={r.embed.raw}
            >
              {r.targetTitle}
              {r.embed.heading && <span className="text-t3"> › {r.embed.heading}</span>}
              {r.embed.blockId && <span className="text-t3"> ^{r.embed.blockId}</span>}
              {!r.targetSlug && <span className="text-danger">{t("sidebar.transclusions.notFound")}</span>}
            </button>
            {r.content && (
              <div className="mt-1 text-2xs text-t2 leading-relaxed whitespace-pre-wrap line-clamp-6">
                {r.content.slice(0, 320)}
                {r.content.length > 320 && "…"}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default memo(TransclusionsInner);
