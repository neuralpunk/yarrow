import { useState } from "react";
import type { HistoryEntry } from "../../lib/types";
import { friendlyDate, relativeTime } from "../../lib/format";

interface Props {
  history: HistoryEntry[];
  preview: string | null;
  onHover: (oid: string) => void;
  onRestore: (oid: string) => void;
  onClose: () => void;
}

export default function HistorySlider({
  history,
  preview,
  onHover,
  onRestore,
  onClose,
}: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  return (
    <div className="border-t border-bd bg-s1">
      <div className="px-4 py-2 flex items-center gap-3 border-b border-bd">
        <span className="text-xs text-t2">
          {history.length} checkpoint{history.length === 1 ? "" : "s"} on this path
        </span>
        {selectedIdx >= 0 && selectedIdx < history.length && (
          <>
            <span className="text-xs text-t3">
              viewing {friendlyDate(history[selectedIdx].timestamp)}
            </span>
            <button
              className="ml-auto px-2 py-1 text-xs bg-yel text-char rounded hover:bg-yel2"
              onClick={() => onRestore(history[selectedIdx].oid)}
            >
              Restore this version
            </button>
          </>
        )}
        <button
          className="ml-auto px-2 py-1 text-xs text-t2 hover:text-char"
          onClick={onClose}
        >
          close
        </button>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {history.map((h, i) => {
            const active = i === selectedIdx;
            return (
              <button
                key={h.oid}
                title={`${friendlyDate(h.timestamp)}${h.thinking_note ? "\n" + h.thinking_note : ""}`}
                onMouseEnter={() => { setSelectedIdx(i); onHover(h.oid); }}
                onClick={() => { setSelectedIdx(i); onHover(h.oid); }}
                className={`w-3 h-3 rounded-full shrink-0 ${
                  active ? "bg-yel scale-125" : "bg-bd2 hover:bg-yel2"
                } transition`}
              />
            );
          })}
        </div>
        {selectedIdx >= 0 && history[selectedIdx]?.thinking_note && (
          <div className="mt-3 p-3 bg-yelp rounded text-xs text-yeld italic">
            “{history[selectedIdx].thinking_note}”
          </div>
        )}
        {preview != null && (
          <div className="mt-3 max-h-40 overflow-y-auto p-3 bg-bg border border-bd rounded text-xs font-mono whitespace-pre-wrap">
            {preview.slice(0, 4000)}
            {preview.length > 4000 && <span className="text-t3"> … (truncated)</span>}
          </div>
        )}
        {selectedIdx >= 0 && (
          <div className="mt-2 text-[11px] text-t3">
            {relativeTime(history[selectedIdx].timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}
