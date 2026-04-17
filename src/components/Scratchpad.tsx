import { useEffect, useRef, useState } from "react";
import { api } from "../lib/tauri";
import Modal from "./Modal";

interface Props {
  onClose: () => void;
  onPromoted: () => void;
}

export default function Scratchpad({ onClose, onPromoted }: Props) {
  const [content, setContent] = useState("");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteTitle, setPromoteTitle] = useState("");
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    api.readScratchpad().then(setContent).catch(() => setContent(""));
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const onChange = (v: string) => {
    setContent(v);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api.saveScratchpad(v).catch(() => {});
    }, 500);
  };

  const keepThis = () => {
    setPromoteTitle("");
    setPromoteOpen(true);
  };

  const confirmPromote = async () => {
    const title = promoteTitle.trim();
    if (!title) return;
    setPromoteOpen(false);
    setPromoteTitle("");
    await api.promoteScratchpad(title);
    onPromoted();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-char/20"
      onMouseDown={onClose}
    >
      <div
        className="w-full h-[70%] bg-bg border-t border-bd shadow-2xl flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-2 border-b border-bd bg-s1">
          <div className="font-serif text-lg">Scratchpad</div>
          <div className="ml-3 text-xs text-t3 italic">
            Nothing here is saved permanently.
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={keepThis}
              disabled={!content.trim()}
              className="px-3 py-1 text-sm bg-yel text-on-yel rounded hover:bg-yel2 disabled:opacity-40"
            >
              Keep this
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm text-t2 hover:text-char"
            >
              close
            </button>
          </div>
        </div>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Think out loud here…"
          className="flex-1 w-full p-8 bg-bg text-char outline-none resize-none font-sans leading-relaxed"
        />
      </div>

      <Modal
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        title="Keep this as a note"
      >
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          What should it be called? The scratchpad is cleared after the note
          is created.
        </p>
        <input
          autoFocus
          value={promoteTitle}
          onChange={(e) => setPromoteTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmPromote(); }}
          placeholder="e.g. half-formed idea about X"
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setPromoteOpen(false)}
          >
            cancel
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            onClick={confirmPromote}
            disabled={!promoteTitle.trim()}
          >
            keep it
          </button>
        </div>
      </Modal>
    </div>
  );
}
