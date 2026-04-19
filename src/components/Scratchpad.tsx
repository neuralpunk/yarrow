import { useEffect, useRef, useState } from "react";
import { api } from "../lib/tauri";
import { ScratchpadIcon } from "../lib/icons";
import type { Note } from "../lib/types";
import { SK } from "../lib/platform";

interface Props {
  /** The note currently being edited, if any. Drives the "with: …" chip. */
  activeNote: Note | null;
  /** Docked width in px. Parent owns persistence. */
  width: number;
  onWidthChange: (w: number) => void;
  /** Bumped externally when the scratchpad file was appended to outside
   *  this component (e.g. "Send to scratchpad" from the editor). Pulls
   *  fresh content in so the textarea doesn't sit on stale state. */
  reloadNonce?: number;
  onClose: () => void;
  /** Fired after "Keep as note." The new slug lets the shell jump to it. */
  onPromoted: (newSlug: string) => void;
}

// Keep pane width sane — narrow enough to see the editor next to it, wide
// enough to actually jot in. The resize handle clamps inside these bounds.
const MIN_W = 280;
const MAX_W = 640;

export default function Scratchpad({
  activeNote,
  width,
  onWidthChange,
  reloadNonce,
  onClose,
  onPromoted,
}: Props) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [linkFromActive, setLinkFromActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [flash, setFlash] = useState<null | "sent">(null);
  const saveTimer = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.readScratchpad().then(setContent).catch(() => setContent(""));
    // Land the caret directly in the textarea so the pane is usable the
    // moment it's on screen — no second click required.
    const t = window.setTimeout(() => textareaRef.current?.focus(), 60);
    return () => {
      window.clearTimeout(t);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  // Refetch when the reload nonce changes — e.g. an editor selection was
  // appended via the right-click menu while this pane was already open.
  useEffect(() => {
    if (reloadNonce === undefined || reloadNonce === 0) return;
    api.readScratchpad().then((fresh) => {
      setContent(fresh);
      // Scroll to the end so the user can immediately see what was just
      // appended instead of hunting through their old notes.
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.scrollTop = ta.scrollHeight;
        ta.setSelectionRange(fresh.length, fresh.length);
      });
    }).catch(() => {});
  }, [reloadNonce]);

  const onChange = (v: string) => {
    setContent(v);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api.saveScratchpad(v).catch(() => {});
    }, 400);
  };

  // The title placeholder and fallback both come from the first non-empty
  // line. That way a user can just hit "Keep" without typing a title.
  const suggestedTitle = () => {
    const first = content
      .split("\n")
      .map((s) => s.replace(/^#+\s*/, "").trim())
      .find(Boolean);
    return (first || "Scratchpad note").slice(0, 80);
  };

  const trimmed = content.trim();

  const keepAsNote = async () => {
    const t = (title.trim() || suggestedTitle()).trim();
    if (!t || !trimmed || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const newNote = await api.promoteScratchpad(t);
      if (linkFromActive && activeNote && newNote.slug !== activeNote.slug) {
        try {
          await api.addLink(activeNote.slug, newNote.slug, "came-from");
        } catch {
          // Link is a nice-to-have; if it fails we don't want to block the
          // note creation itself.
        }
      }
      setContent("");
      setTitle("");
      onPromoted(newNote.slug);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendToNote = () => {
    if (!activeNote || !trimmed) return;
    window.dispatchEvent(
      new CustomEvent("yarrow:editor-insert", {
        detail: { text: trimmed },
      }),
    );
    setFlash("sent");
    window.setTimeout(() => setFlash(null), 1400);
  };

  const clearScratchpad = () => {
    if (!content) return;
    onChange("");
    textareaRef.current?.focus();
  };

  // ─── resize handle on the left edge ───
  const resizing = useRef<{ startX: number; startW: number } | null>(null);
  const onResizeStart = (e: React.MouseEvent) => {
    resizing.current = { startX: e.clientX, startW: width };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      // Dragging leftward should widen the pane (it's anchored to the right).
      const dx = resizing.current.startX - ev.clientX;
      const next = Math.max(MIN_W, Math.min(MAX_W, resizing.current.startW + dx));
      onWidthChange(next);
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const activeTitle = activeNote?.frontmatter.title || activeNote?.slug || "";

  return (
    <aside
      className="relative shrink-0 bg-s1 border-l border-bd flex flex-col animate-slideInRight"
      style={{ width: `${width}px` }}
    >
      <div
        onMouseDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-yel/40 transition z-10"
        title="Drag to resize"
      />

      <header className="px-3.5 pt-3 pb-2 border-b border-bd">
        <div className="flex items-center gap-2">
          <ScratchpadIcon size={14} />
          <div className="font-serif text-base text-char leading-none">Scratchpad</div>
          <button
            onClick={clearScratchpad}
            disabled={!content}
            className="ml-auto text-2xs text-t3 hover:text-char disabled:opacity-30"
            title="Clear"
          >
            clear
          </button>
          <button
            onClick={onClose}
            className="text-t3 hover:text-char w-5 h-5 flex items-center justify-center rounded hover:bg-s2"
            aria-label="Close scratchpad"
            title={`Close (${SK.scratchpad})`}
          >
            ×
          </button>
        </div>
        <div className="text-2xs text-t3 italic mt-1">
          Nothing here is saved permanently.
        </div>
      </header>

      {activeNote && (
        <div className="px-3.5 py-2 border-b border-bd/60 bg-bg/40">
          <div className="flex items-center gap-1.5 text-2xs">
            <span className="text-t3 shrink-0">with</span>
            <span className="text-char truncate" title={activeTitle}>
              {activeTitle}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onClick={sendToNote}
              disabled={!trimmed}
              className="px-2 py-1 text-2xs bg-s2 text-ch2 rounded hover:bg-s3 disabled:opacity-40 flex items-center gap-1"
              title="Insert scratchpad at the note's cursor"
            >
              <ArrowRightIcon />
              <span>send to note</span>
            </button>
            {flash === "sent" && (
              <span className="text-2xs text-yeld italic">inserted</span>
            )}
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          activeNote
            ? `Jot anything. Arrows above move it into "${activeTitle}".`
            : "Think out loud here…"
        }
        className="flex-1 w-full px-4 py-3 bg-bg text-char outline-none resize-none font-sans text-sm leading-relaxed"
        spellCheck
      />

      <footer className="border-t border-bd p-2.5 bg-s1 flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                keepAsNote();
              }
            }}
            placeholder={trimmed ? suggestedTitle() : "title…"}
            disabled={busy}
            className="flex-1 min-w-0 px-2 py-1.5 bg-bg border border-bd rounded-md text-char text-xs placeholder:text-t3"
          />
          <button
            onClick={keepAsNote}
            disabled={busy || !trimmed}
            className="btn-yel px-2.5 py-1.5 text-xs rounded-md disabled:opacity-40 shrink-0"
            title="Turn this into a saved note"
          >
            {busy ? "saving…" : "Keep as note"}
          </button>
        </div>
        {activeNote && (
          <label className="flex items-center gap-1.5 text-2xs text-t2 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={linkFromActive}
              onChange={(e) => setLinkFromActive(e.target.checked)}
              className="accent-yel"
            />
            <span>
              link from{" "}
              <span className="text-char">{activeTitle}</span>
            </span>
          </label>
        )}
        {msg && <div className="text-2xs text-danger leading-snug">{msg}</div>}
      </footer>
    </aside>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 5h6M6 2l2.5 3L6 8" />
    </svg>
  );
}
