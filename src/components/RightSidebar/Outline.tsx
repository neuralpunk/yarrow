import { useEffect, useMemo, useState } from "react";
import { useT } from "../../lib/i18n";

// Tree-of-thought view of the active note. Parses headings and top-level
// bullets out of the live body, renders them as a collapsible outline,
// and emits a `jump` event when the user clicks an entry. Source-of-truth
// stays the Markdown — this is purely a lens.
//
// Why parse here instead of consuming the CodeMirror tree: the editor is
// lazily mounted (slug switches, focus mode, reading mode) and the tree
// API differs across markdown-extension upgrades. A small hand-rolled
// regex pass over the body is portable, fast on hand-scale notes, and
// keeps Outline a pure component that can be reused on a future "outline
// for a whole path" surface without touching CodeMirror.

interface Node {
  /** 1 = top heading, 2-6 = nested headings, 7+ = bullet list rows so the
   *  bullet hierarchy nests visually below the headings without clashing. */
  depth: number;
  text: string;
  /** 1-indexed line number in the source — matches what the editor's
   *  `jumpToLine` ref expects. */
  line: number;
  kind: "heading" | "bullet";
}

interface Props {
  body: string;
  onJump: (line: number) => void;
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
// Top-level bullets only — nested bullets read as noise in an outline.
// `^(\s{0,2})` keeps single-indent (4-space) and tab indented entries
// out of the panel; if a user wants them in, they can promote to a
// heading. The bullet marker must be `-`, `*`, or `+` followed by a
// space; checkbox markers (`- [ ]`) are excluded — those belong in the
// Tasks panel.
const BULLET_RE = /^(\s{0,2})([-*+])\s+(?!\[[ xX]\])(.*)$/;

function parse(body: string): Node[] {
  const out: Node[] = [];
  const lines = body.split("\n");
  // Local to each parse — never carries between calls. Toggles on every
  // line that starts with ``` (with optional leading whitespace) and a
  // language tag. Bounded by line iteration; no greedy multiline match.
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (/^\s*```/.test(text)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const h = HEADING_RE.exec(text);
    if (h) {
      out.push({
        depth: h[1].length,
        text: h[2].trim(),
        line: i + 1,
        kind: "heading",
      });
      continue;
    }
    const b = BULLET_RE.exec(text);
    if (b) {
      const indent = b[1].length;
      // Map indent (0 / 1-2 spaces) to depth 7 / 8 — always nested under
      // the most recent heading. Visually distinct from headings without
      // inventing a new depth scale.
      out.push({
        depth: 7 + Math.min(indent, 1),
        text: b[3].trim(),
        line: i + 1,
        kind: "bullet",
      });
    }
  }
  return out;
}

export default function Outline({ body, onJump }: Props) {
  const t = useT();
  // 2.2.0 perf — debounce body so the line-by-line regex parse doesn't
  // run on every keystroke. The outline panel doesn't need to be live
  // to the millisecond; 220 ms feels instant to humans but lets fast
  // typing run the regex pass at most ~4 times/second instead of 20+.
  const [debouncedBody, setDebouncedBody] = useState(body);
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedBody(body), 220);
    return () => window.clearTimeout(id);
  }, [body]);
  const nodes = useMemo(() => parse(debouncedBody), [debouncedBody]);

  if (nodes.length === 0) {
    return (
      <div className="text-sm text-t3 italic px-1 py-2">
        {t("rightsidebar.outline.empty")}
      </div>
    );
  }

  return (
    <ul className="text-sm space-y-0.5" role="tree">
      {nodes.map((n, i) => {
        // Indent in 12 px steps. Headings 1-6 indent flat-stepped;
        // bullet rows pick up the indent of depth 7-8 so they sit a
        // full step below the most recent H6.
        const padLeft = (n.depth - 1) * 12;
        const isHeading = n.kind === "heading";
        return (
          <li key={`${i}-${n.line}`} role="treeitem">
            <button
              type="button"
              onClick={() => onJump(n.line)}
              className={
                isHeading
                  ? "w-full text-left rounded px-2 py-1 hover:bg-s2 transition truncate text-char"
                  : "w-full text-left rounded px-2 py-0.5 hover:bg-s2 transition truncate text-t2 hover:text-char"
              }
              style={{ paddingLeft: `${8 + padLeft}px` }}
              title={n.text}
            >
              {isHeading && n.depth === 1 ? (
                <span className="font-serif text-[15px] leading-tight">
                  {n.text || t("rightsidebar.outline.untitled")}
                </span>
              ) : isHeading ? (
                <span className="font-serif">
                  {n.text || t("rightsidebar.outline.untitled")}
                </span>
              ) : (
                <span className="text-2xs text-t3 mr-1.5">·</span>
              )}
              {!isHeading && (
                <span className="font-sans text-xs">
                  {n.text || t("rightsidebar.outline.untitled")}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
