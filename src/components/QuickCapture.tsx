import { useEffect, useRef, useState } from "react";
import { api } from "../lib/tauri";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function QuickCapture({ open, onClose }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setTimeout(() => ref.current?.focus(), 20);
    }
  }, [open]);

  const save = async () => {
    const entry = text.trim();
    if (!entry) { onClose(); return; }
    setSaving(true);
    try {
      await api.appendScratchpad(entry);
      setSavedFlash(true);
      setText("");
      setTimeout(() => {
        setSavedFlash(false);
        onClose();
      }, 450);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center pt-24 bg-char/30 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl mx-4 bg-bg border border-bd rounded-xl shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2 border-b border-bd bg-s1 flex items-center gap-2">
          <span className="font-serif text-base text-char">Quick capture</span>
          <span className="text-2xs text-t3">appends to scratchpad · nothing is committed</span>
          <span className="ml-auto text-2xs text-t3 font-mono">Ctrl+Enter to save · Esc to cancel</span>
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          placeholder="What just crossed your mind?"
          className="w-full min-h-[140px] max-h-[300px] p-5 bg-bg text-char outline-none resize-none font-sans leading-relaxed"
        />
        <div className="px-4 py-2 border-t border-bd bg-s1 flex items-center">
          {savedFlash && (
            <span className="text-2xs text-yeld">✓ saved to scratchpad</span>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs text-t2 hover:text-char"
            >
              cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !text.trim()}
              className="btn-yel px-3 py-1 text-xs rounded-md disabled:opacity-40"
            >
              capture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
