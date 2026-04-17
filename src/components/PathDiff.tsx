import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/tauri";

interface Props {
  currentPath: string;
  otherPath: string;
  onClose: () => void;
}

interface Snap {
  slug: string;
  body: string;
}

interface NoteChange {
  slug: string;
  kind: "added" | "removed" | "changed" | "same";
  linesAdded: number;
  linesRemoved: number;
  a: string;
  b: string;
}

function stripFrontmatter(raw: string): string {
  if (raw.startsWith("---\n")) {
    const end = raw.indexOf("\n---\n", 4);
    if (end !== -1) return raw.slice(end + 5);
  }
  return raw;
}

function diffLines(a: string, b: string): { added: number; removed: number } {
  const aSet = new Set(a.split("\n").map((l) => l.trim()).filter(Boolean));
  const bSet = new Set(b.split("\n").map((l) => l.trim()).filter(Boolean));
  let added = 0;
  let removed = 0;
  for (const l of bSet) if (!aSet.has(l)) added++;
  for (const l of aSet) if (!bSet.has(l)) removed++;
  return { added, removed };
}

export default function PathDiff({ currentPath, otherPath, onClose }: Props) {
  const [current, setCurrent] = useState<Snap[] | null>(null);
  const [other, setOther] = useState<Snap[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, b] = await Promise.all([
          api.notesOnPath(currentPath),
          api.notesOnPath(otherPath),
        ]);
        setCurrent(a);
        setOther(b);
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, [currentPath, otherPath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changes = useMemo<NoteChange[]>(() => {
    if (!current || !other) return [];
    const aMap = new Map(current.map((n) => [n.slug, stripFrontmatter(n.body)]));
    const bMap = new Map(other.map((n) => [n.slug, stripFrontmatter(n.body)]));
    const slugs = new Set([...aMap.keys(), ...bMap.keys()]);
    const out: NoteChange[] = [];
    for (const s of slugs) {
      const a = aMap.get(s) ?? "";
      const b = bMap.get(s) ?? "";
      if (!aMap.has(s)) {
        out.push({ slug: s, kind: "added", linesAdded: b.split("\n").length, linesRemoved: 0, a, b });
      } else if (!bMap.has(s)) {
        out.push({ slug: s, kind: "removed", linesAdded: 0, linesRemoved: a.split("\n").length, a, b });
      } else if (a !== b) {
        const { added, removed } = diffLines(a, b);
        out.push({ slug: s, kind: "changed", linesAdded: added, linesRemoved: removed, a, b });
      } else {
        out.push({ slug: s, kind: "same", linesAdded: 0, linesRemoved: 0, a, b });
      }
    }
    out.sort((x, y) => {
      const order = { added: 0, changed: 1, removed: 2, same: 3 } as const;
      return order[x.kind] - order[y.kind] || x.slug.localeCompare(y.slug);
    });
    return out;
  }, [current, other]);

  const differing = changes.filter((c) => c.kind !== "same");
  const selectedChange = selected ? changes.find((c) => c.slug === selected) : differing[0];

  return (
    <div className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-sm flex flex-col animate-fadeIn">
      <div className="flex items-center px-5 py-3 border-b border-bd bg-s1">
        <div className="font-serif text-lg text-char">
          Compare paths
        </div>
        <div className="ml-3 text-xs text-t2">
          <span className="text-char font-medium">{currentPath}</span>
          <span className="text-t3 mx-2">↔</span>
          <span className="text-char font-medium">{otherPath}</span>
        </div>
        <button
          onClick={onClose}
          className="ml-auto px-3 py-1 text-xs text-t2 hover:text-char"
        >
          close
        </button>
      </div>

      {err && <div className="p-4 text-sm text-danger">Could not load: {err}</div>}

      {!err && (
        <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr_1fr] overflow-hidden">
          <aside className="border-r border-bd bg-s1/60 overflow-y-auto">
            <div className="px-4 py-3 border-b border-bd">
              <div className="text-2xs text-t3 font-mono">
                {differing.length} differ · {changes.length - differing.length} identical
              </div>
            </div>
            <ul className="p-2 space-y-0.5">
              {differing.map((c) => (
                <li key={c.slug}>
                  <button
                    onClick={() => setSelected(c.slug)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center gap-2 ${
                      (selectedChange?.slug ?? "") === c.slug
                        ? "bg-yelp text-yeld"
                        : "text-t2 hover:bg-s2 hover:text-char"
                    }`}
                  >
                    <Badge kind={c.kind} />
                    <span className="truncate flex-1">{c.slug}</span>
                    {c.kind === "changed" && (
                      <span className="text-2xs font-mono text-t3">
                        {c.linesAdded > 0 && <span className="text-yeld">+{c.linesAdded}</span>}
                        {c.linesAdded > 0 && c.linesRemoved > 0 && " / "}
                        {c.linesRemoved > 0 && <span className="text-danger">−{c.linesRemoved}</span>}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {differing.length === 0 && (
                <li className="px-3 py-4 text-xs text-t3 italic">
                  These paths have identical notes.
                </li>
              )}
            </ul>
          </aside>

          <Pane
            title={currentPath}
            label="current"
            body={selectedChange?.a ?? ""}
            empty={selectedChange?.kind === "added" ? "Not on this path." : undefined}
          />
          <Pane
            title={otherPath}
            label="other"
            body={selectedChange?.b ?? ""}
            empty={selectedChange?.kind === "removed" ? "Not on this path." : undefined}
          />
        </div>
      )}
    </div>
  );
}

function Pane({
  title,
  label,
  body,
  empty,
}: {
  title: string;
  label: string;
  body: string;
  empty?: string;
}) {
  return (
    <div className="flex flex-col overflow-hidden border-r border-bd last:border-r-0">
      <div className="px-5 py-2 border-b border-bd bg-s1/60 flex items-baseline gap-2">
        <span className="text-2xs uppercase tracking-wider text-t3 font-semibold">
          {label}
        </span>
        <span className="text-xs text-char truncate">{title}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {empty ? (
          <div className="text-t3 italic text-sm">{empty}</div>
        ) : body ? (
          <pre className="whitespace-pre-wrap font-sans text-sm text-char leading-relaxed">
            {body}
          </pre>
        ) : (
          <div className="text-t3 italic text-sm">—</div>
        )}
      </div>
    </div>
  );
}

function Badge({ kind }: { kind: NoteChange["kind"] }) {
  if (kind === "added") return <span className="text-2xs font-mono text-yeld">+</span>;
  if (kind === "removed") return <span className="text-2xs font-mono text-danger">−</span>;
  if (kind === "changed") return <span className="text-2xs font-mono text-accent2">~</span>;
  return <span className="text-2xs font-mono text-t3">·</span>;
}
