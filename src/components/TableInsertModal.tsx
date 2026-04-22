import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the ready-to-insert markdown table body. */
  onInsert: (markdown: string) => void;
}

/**
 * Table insert — composed right in the modal before it lands in the note.
 * A spreadsheet-ish grid of inputs (headers row + body rows), sized by
 * two steppers. Tab / Shift-Tab flow between inputs, Enter moves down.
 *
 * The live markdown preview below shows exactly what will get pasted,
 * with column widths padded to the widest cell so the raw source is
 * still legible in the editor.
 */
export default function TableInsertModal({ open, onClose, onInsert }: Props) {
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  /** headers[col] and body[row][col]. Sized lazily to fit cols/rows —
   *  resizing never truncates existing cells, it just hides extras. */
  const [headers, setHeaders] = useState<string[]>(() => defaultHeaders(3));
  const [body, setBody] = useState<string[][]>(() => emptyBody(3, 3));
  /** Column alignment: left, center, right. Same length as `cols`. */
  const [align, setAlign] = useState<Alignment[]>(() => Array(3).fill("left"));

  useEffect(() => {
    if (!open) return;
    setCols(3);
    setRows(3);
    setHeaders(defaultHeaders(3));
    setBody(emptyBody(3, 3));
    setAlign(Array(3).fill("left") as Alignment[]);
  }, [open]);

  // Keep headers/body/align sized to cols/rows without losing data.
  useEffect(() => {
    setHeaders((prev) => {
      if (prev.length === cols) return prev;
      const next = prev.slice(0, cols);
      while (next.length < cols) next.push(`Column ${next.length + 1}`);
      return next;
    });
    setAlign((prev) => {
      if (prev.length === cols) return prev;
      const next = prev.slice(0, cols) as Alignment[];
      while (next.length < cols) next.push("left");
      return next;
    });
    setBody((prev) => {
      const next = prev.slice(0, rows).map((r) => {
        const row = r.slice(0, cols);
        while (row.length < cols) row.push("");
        return row;
      });
      while (next.length < rows) {
        next.push(Array(cols).fill(""));
      }
      return next;
    });
  }, [cols, rows]);

  const preview = useMemo(
    () => buildTable(headers.slice(0, cols), body.slice(0, rows).map((r) => r.slice(0, cols)), align.slice(0, cols)),
    [cols, rows, headers, body, align],
  );

  const commit = () => {
    onInsert(preview);
    onClose();
  };

  // ── focus management: Tab/Shift-Tab + Enter move through cells ──
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  // index = row * cols + col, with row = -1 for header row (stored as 0..cols-1)
  const focusCell = (row: number, col: number) => {
    if (col < 0 || col >= cols) return;
    // row: -1 = headers, 0..rows-1 = body
    const idx = row === -1 ? col : (row + 1) * cols + col;
    const el = inputsRef.current[idx];
    if (el) { el.focus(); el.select(); }
  };
  const onCellKeyDown = (row: number, col: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      commit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // down one row, or wrap to first column of next row
      if (row === -1) focusCell(0, col);
      else if (row < rows - 1) focusCell(row + 1, col);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      // step column; wrap to next/prev row at edges
      let r = row, c = col + dir;
      if (c >= cols) { c = 0; r = row + 1; }
      if (c < 0)     { c = cols - 1; r = row - 1; }
      if (r < -1) r = -1;
      if (r > rows - 1) r = rows - 1;
      focusCell(r, c);
      return;
    }
  };

  const setHeader = (c: number, v: string) => {
    setHeaders((prev) => prev.map((x, i) => (i === c ? v : x)));
  };
  const setCell = (r: number, c: number, v: string) => {
    setBody((prev) => prev.map((row, i) =>
      i === r ? row.map((x, j) => (j === c ? v : x)) : row,
    ));
  };
  const rotateAlign = (c: number) => {
    setAlign((prev) => prev.map((a, i) => (i === c ? nextAlign(a) : a)));
  };

  return (
    <Modal open={open} onClose={onClose} width="w-[780px]">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-xl text-char">Insert table</h2>
        <span className="font-serif italic text-2xs text-t3">
          Tab moves between cells · ⌘↵ inserts
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stepper label="Columns" value={cols} min={1} max={8} onChange={setCols} />
        <Stepper label="Rows"    value={rows} min={1} max={20} onChange={setRows} />
      </div>

      <div className="mb-4">
        <div className="font-serif italic text-2xs text-t3 mb-2">Fill it in</div>
        <div className="border border-bd rounded-md bg-s1 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {headers.slice(0, cols).map((h, c) => (
                  <th key={c} className="p-1 border-b border-bd bg-s2/60">
                    <div className="flex items-stretch gap-1">
                      <input
                        ref={(el) => { inputsRef.current[c] = el; }}
                        value={h}
                        onChange={(e) => setHeader(c, e.target.value)}
                        onKeyDown={onCellKeyDown(-1, c)}
                        placeholder={`Column ${c + 1}`}
                        className="flex-1 min-w-0 px-2 py-1 bg-transparent border-0 outline-0 font-serif italic text-sm text-char placeholder:text-t3/70 focus:bg-bg/60 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => rotateAlign(c)}
                        title={`Column alignment: ${align[c]}. Click to cycle.`}
                        className="w-7 rounded text-t2 hover:text-char hover:bg-s2 flex items-center justify-center font-mono text-2xs"
                      >
                        {alignGlyph(align[c])}
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.slice(0, rows).map((row, r) => (
                <tr key={r}>
                  {row.slice(0, cols).map((cell, c) => (
                    <td key={c} className="p-1 border-t border-bd">
                      <input
                        ref={(el) => { inputsRef.current[(r + 1) * cols + c] = el; }}
                        value={cell}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        onKeyDown={onCellKeyDown(r, c)}
                        className="w-full px-2 py-1 bg-transparent border-0 outline-0 font-serif text-sm text-char placeholder:text-t3 focus:bg-bg/60 rounded"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-4">
        <div className="font-serif italic text-2xs text-t3 mb-1">Markdown preview</div>
        <pre className="font-mono text-[11px] text-t2 bg-s1 border border-bd rounded-md p-3 overflow-x-auto whitespace-pre max-h-[180px]">
          {preview.trim()}
        </pre>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-t2 hover:text-char transition"
        >
          Cancel
        </button>
        <button
          onClick={commit}
          className="px-3 py-1.5 text-xs rounded-md bg-char text-bg hover:bg-yeld transition"
        >
          Insert
        </button>
      </div>
    </Modal>
  );
}

type Alignment = "left" | "center" | "right";

function nextAlign(a: Alignment): Alignment {
  return a === "left" ? "center" : a === "center" ? "right" : "left";
}

function alignGlyph(a: Alignment): string {
  return a === "left" ? "⟵" : a === "center" ? "↔" : "⟶";
}

function defaultHeaders(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Column ${i + 1}`);
}

function emptyBody(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

/** Build a GFM table whose cells are column-aligned in the raw source
 *  (so the user's markdown stays readable if they ever open the file in
 *  another editor). Alignment markers (`:---`, `:---:`, `---:`) encode
 *  the caller's picked alignment per column. */
function buildTable(headers: string[], body: string[][], align: Alignment[]): string {
  const cols = headers.length;
  // Pipe/newline characters in cell content would wreck a GFM table.
  // Escape pipes and collapse newlines inside a cell to a space — if
  // someone wants a multi-line cell they can use `<br>` explicitly
  // after insertion.
  const clean = (s: string) => s.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").trim();
  const headerCells = headers.map(clean);
  const bodyCells = body.map((row) => {
    const r = row.slice(0, cols).map(clean);
    while (r.length < cols) r.push("");
    return r;
  });
  const widths = headerCells.map((h, i) => {
    let w = Math.max(h.length, 3);
    for (const r of bodyCells) {
      w = Math.max(w, r[i].length);
    }
    return w;
  });
  const pad = (s: string, w: number, a: Alignment) => {
    if (s.length >= w) return s;
    const diff = w - s.length;
    if (a === "right") return " ".repeat(diff) + s;
    if (a === "center") {
      const left = Math.floor(diff / 2);
      const right = diff - left;
      return " ".repeat(left) + s + " ".repeat(right);
    }
    return s + " ".repeat(diff);
  };
  const header = "| " + headerCells.map((h, i) => pad(h, widths[i], align[i])).join(" | ") + " |";
  const sep = "| " + widths.map((w, i) => alignmentBar(w, align[i])).join(" | ") + " |";
  const body_lines = bodyCells.map((row) =>
    "| " + row.map((c, i) => pad(c, widths[i], align[i])).join(" | ") + " |",
  );
  // Leading + trailing blank line so the table isn't glued to surrounding
  // prose — GFM requires the blank-line separator to render correctly.
  return `\n${header}\n${sep}\n${body_lines.join("\n")}\n`;
}

function alignmentBar(w: number, a: Alignment): string {
  // Minimum width of an alignment marker is 3 (`:-:`, `---`, etc.)
  const inner = Math.max(3, w);
  if (a === "center") {
    return ":" + "-".repeat(Math.max(1, inner - 2)) + ":";
  }
  if (a === "right") {
    return "-".repeat(Math.max(2, inner - 1)) + ":";
  }
  // left: the default unstyled dashes are fine, but GFM also accepts
  // an explicit leading colon. We omit it for cleaner defaults.
  return "-".repeat(inner);
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="bg-s1 border border-bd rounded-md px-3 py-2">
      <div className="font-serif italic text-2xs text-t3 mb-1">{label}</div>
      <div className="flex items-center gap-3">
        <button
          onClick={dec}
          disabled={value <= min}
          className="w-6 h-6 rounded border border-bd text-t2 hover:bg-s2 hover:text-char disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          −
        </button>
        <div className="font-serif text-2xl text-char w-10 text-center tabular-nums">
          {value}
        </div>
        <button
          onClick={inc}
          disabled={value >= max}
          className="w-6 h-6 rounded border border-bd text-t2 hover:bg-s2 hover:text-char disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          +
        </button>
      </div>
    </div>
  );
}
