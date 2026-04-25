import { useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { RecentWorkspace } from "../lib/types";
import { PlusIcon, XIcon } from "../lib/icons";
import { workspaceAccent } from "../lib/workspaceAccent";
import { useT } from "../lib/i18n";

interface Props {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  currentPath: string;
  onClose: () => void;
  onSwitch: (path: string) => void;
}

// Popover anchored under the sidebar header's workspace chip. Keeps the
// switch fast: one click to open, one click to jump. Creating and
// browse-to-open live at the bottom so they don't crowd the list.
export default function WorkspaceSwitcher({
  open,
  anchorRef,
  currentPath,
  onClose,
  onSwitch,
}: Props) {
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const popRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setCursor(0);
    api.listRecentWorkspaces().then(setRecent).catch(() => setRecent([]));
  }, [open]);

  // Close on click outside. Exclude clicks on the anchor — the chip toggles
  // the popover itself, so swallowing its click here would fight the toggle.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, onClose, anchorRef]);

  // Keyboard navigation: Esc closes, Up/Down moves cursor across switchable
  // rows, Enter activates. "current" isn't selectable.
  const selectable = recent.filter((r) => r.path !== currentPath);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, Math.max(0, selectable.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        return;
      }
      if (e.key === "Enter" && selectable[cursor]) {
        e.preventDefault();
        handleSwitch(selectable[cursor].path);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cursor, selectable, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitch = async (path: string) => {
    if (path === currentPath) {
      onClose();
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await api.openWorkspace(path);
      onSwitch(path);
      onClose();
    } catch (e) {
      setErr(String(e));
      // Dead folder — drop from the list so the user doesn't keep trying.
      await api.forgetRecentWorkspace(path).catch(() => {});
      setRecent(await api.listRecentWorkspaces());
    } finally {
      setBusy(false);
    }
  };

  const handleBrowseOpen = async () => {
    setErr(null);
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: t("modals.workspaceSwitcher.openTitle") });
      if (!selected || Array.isArray(selected)) return;
      if (selected === currentPath) {
        onClose();
        return;
      }
      setBusy(true);
      await api.openWorkspace(selected);
      onSwitch(selected);
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNew = async () => {
    setErr(null);
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: t("modals.workspaceSwitcher.pickFolderTitle") });
      if (!selected || Array.isArray(selected)) return;
      setBusy(true);
      await api.initWorkspace(selected);
      onSwitch(selected);
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleForget = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await api.forgetRecentWorkspace(path).catch(() => {});
    setRecent(await api.listRecentWorkspaces());
  };

  if (!open) return null;

  return (
    <div
      ref={popRef}
      className="absolute left-3 right-3 top-[calc(100%+6px)] z-40 bg-bg border border-bd2 rounded-lg shadow-xl overflow-hidden animate-slideUp"
      role="dialog"
      aria-label={t("modals.workspaceSwitcher.dialogLabel")}
    >
      {/* The sidebar chip directly above this popover already shows the
          active workspace — repeating it here invited mis-clicks (the row
          looked tappable but did nothing). Keep the dropdown focused on
          places the user can actually go. */}

      {/* Recent list */}
      {selectable.length > 0 && (
        <div className="py-1 max-h-[240px] overflow-y-auto">
          <div className="px-3 pt-1.5 pb-1 text-2xs uppercase tracking-wider text-t3 font-semibold">
            {t("modals.workspaceSwitcher.jumpTo")}
          </div>
          <ul>
            {selectable.map((r, i) => {
              const active = i === cursor;
              return (
                <li key={r.path} className="group">
                  <button
                    onClick={() => handleSwitch(r.path)}
                    disabled={busy}
                    onMouseEnter={() => setCursor(i)}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2 transition ${
                      active ? "bg-s2 text-char" : "hover:bg-s2/60 text-t2 hover:text-char"
                    } ${busy ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-serif text-[12.5px]"
                      style={workspaceAccent(r.path, false)}
                    >
                      {(r.name || "W").charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{r.name}</div>
                      <div className="text-2xs text-t3 font-mono truncate">{r.path}</div>
                    </div>
                    <button
                      onClick={(e) => handleForget(e, r.path)}
                      className="opacity-0 group-hover:opacity-100 text-t3 hover:text-danger transition shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-s3"
                      title={t("modals.workspaceSwitcher.removeFromRecents")}
                      aria-label={t("modals.workspaceSwitcher.removeFromRecents")}
                    >
                      <XIcon size={11} />
                    </button>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectable.length === 0 && (
        <div className="px-3 py-4 text-xs text-t3 italic text-center">
          {t("modals.workspaceSwitcher.empty")}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-bd px-2 py-2 flex flex-col gap-1 bg-s1">
        <button
          onClick={handleCreateNew}
          disabled={busy}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-char rounded hover:bg-yelp transition text-left"
        >
          <span className="w-5 h-5 rounded-full bg-yel/20 text-yeld flex items-center justify-center shrink-0">
            <PlusIcon size={12} strokeWidth={2.2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="leading-tight">{t("modals.workspaceSwitcher.newWorkspace")}</div>
            <div className="text-2xs text-t3 leading-tight">{t("modals.workspaceSwitcher.newWorkspaceSub")}</div>
          </div>
        </button>
        <button
          onClick={handleBrowseOpen}
          disabled={busy}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-char rounded hover:bg-s2 transition text-left"
        >
          <span className="w-5 h-5 rounded-full bg-s2 text-t2 flex items-center justify-center shrink-0">
            <FolderIcon />
          </span>
          <div className="flex-1 min-w-0">
            <div className="leading-tight">{t("modals.workspaceSwitcher.openAnother")}</div>
            <div className="text-2xs text-t3 leading-tight">{t("modals.workspaceSwitcher.openAnotherSub")}</div>
          </div>
        </button>
      </div>

      {err && (
        <div className="border-t border-bd px-3 py-2 text-2xs text-danger bg-danger/5 leading-snug">
          {err}
        </div>
      )}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h2.2l1 1.2H9.5a1 1 0 0 1 1 1v4.3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3.5Z" />
    </svg>
  );
}
