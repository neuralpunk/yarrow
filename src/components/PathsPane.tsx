import { useCallback, useEffect, useMemo, useState } from "react";
import type { NoteSummary, PathCollectionsView } from "../lib/types";
import { isGhostPath } from "../lib/types";
import { api } from "../lib/tauri";
import { NewDirectionIcon, HelpIcon } from "../lib/icons";
import ForkingRoad from "./Paths/ForkingRoad";
import PathDetail from "./Paths/PathDetail";
import ConditionEditor from "./Paths/ConditionEditor";
import PathsEmptyState from "./Paths/PathsEmptyState";

interface Props {
  notes: NoteSummary[];
  onClose: () => void;
  onNavigate: (slug: string) => void;
  /** "Open the map for this path" — parent shows the ConnectionGraph
   *  filtered to this collection's members, optionally focused on a slug. */
  onOpenMap: (collectionName: string, focusSlug?: string) => void;
  /** Fires whenever collections change so other views (minimap, etc.)
   *  refresh their memoized derived state. */
  onCollectionsChanged?: (view: PathCollectionsView) => void;
  /** Fires when a typed link was added/removed as a side effect of a
   *  path-membership change — lets the shell re-read the graph + orphans
   *  so the Map view reflects the new connection on next open. */
  onLinksChanged?: () => void;
  /** Jump the workspace back to the root ("main") — surfaces in the
   *  header's Back-to-main button and in PathDetail's promote flow. */
  onSwitchToRoot?: (rootName: string) => void;
}

export default function PathsPane({
  notes,
  onClose,
  onNavigate,
  onOpenMap,
  onCollectionsChanged,
  onLinksChanged,
  onSwitchToRoot,
}: Props) {
  const [view, setView] = useState<PathCollectionsView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | { name: string; initial: string }>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newFork, setNewFork] = useState<null | { parent: string; seedSlug?: string }>(null);
  const [promoteTarget, setPromoteTarget] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const v = await api.listPathCollections();
      setView(v);
      setErr(null);
      onCollectionsChanged?.(v);
    } catch (e) {
      setErr(String(e));
    }
  }, [onCollectionsChanged]);

  useEffect(() => { refresh(); }, [refresh]);

  const collections = view?.collections ?? [];
  const rootName = view?.root ?? "main";
  const selectedCol = useMemo(
    () => (selected ? collections.find((c) => c.name === selected) : null),
    [selected, collections],
  );

  const parentOf = (name: string) =>
    collections.find((c) => c.name === name)?.parent ?? "";

  // ────────── actions ──────────
  const startEditCondition = (name: string, initial: string) =>
    setEditing({ name, initial });

  const saveCondition = async (next: string) => {
    if (!editing) return;
    const { name } = editing;
    setEditing(null);
    try {
      await api.setPathCollectionCondition(name, next);
      await refresh();
    } catch (e) {
      setErr(String(e));
    }
  };

  const commitFork = async (condition: string) => {
    if (!newFork) return;
    const trimmed = condition.trim();
    const { parent, seedSlug } = newFork;
    setNewFork(null);
    if (!trimmed) return;
    const name =
      trimmed
        .toLowerCase()
        .replace(/^(if\s+|what\s+if\s+)/i, "")
        .split(/\s+/)
        .slice(0, 5)
        .join("-")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "new-path";
    try {
      await api.createPathCollection(name, trimmed, parent, seedSlug);
      await refresh();
      setSelected(name);
    } catch (e) {
      setErr(String(e));
    }
  };

  const startFork = (parent: string, seedSlug?: string) => {
    setSelected(null);
    setNewFork({ parent, seedSlug });
  };

  const handleRename = async (name: string) => {
    const next = window.prompt(`Rename path "${name}" to:`, name);
    if (!next || next.trim() === name) return;
    try {
      await api.renamePathCollection(name, next.trim());
      await refresh();
      setSelected(next.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"));
    } catch (e) {
      setErr(String(e));
    }
  };

  const handleDelete = async (name: string) => {
    if (name === rootName) return;
    const ok = window.confirm(
      `Delete path "${name}"? Its notes stay — only the collection is removed. Children will reattach to its parent.`,
    );
    if (!ok) return;
    try {
      await api.deletePathCollection(name);
      await refresh();
      setSelected(null);
    } catch (e) {
      setErr(String(e));
    }
  };

  const handlePromote = async (name: string) => {
    try {
      await api.setPathCollectionRoot(name);
      await refresh();
      onSwitchToRoot?.(name);
      setSelected(name);
    } catch (e) {
      setErr(String(e));
    }
  };

  const handleSetMainNote = async (name: string, slug: string | null) => {
    try {
      await api.setPathCollectionMainNote(name, slug);
      await refresh();
    } catch (e) { setErr(String(e)); }
  };
  const handleAddNote = async (name: string, slug: string) => {
    try {
      await api.addNoteToPathCollection(name, slug);
      // Also create a typed backlink from the path's main note so the added
      // note isn't a floating island in Map view — the user's intent on
      // "+ add note" is that this note belongs to this path, and the Map
      // should show that relationship too. Default link type is "supports"
      // (neutral "part of"); the existing Connect flow stays available for
      // explicit challenges / came-from / open-question relations.
      let linked = false;
      const col = collections.find((c) => c.name === name);
      const mainSlug = col?.main_note;
      if (mainSlug && mainSlug !== slug) {
        try {
          await api.addLink(mainSlug, slug, "supports");
          linked = true;
        } catch (e) {
          // A duplicate link is already present or the note is locked —
          // non-fatal for the add itself.
          console.warn("auto-link on add-to-path failed", e);
        }
      }
      await refresh();
      if (linked) onLinksChanged?.();
    } catch (e) { setErr(String(e)); }
  };
  const handleRemoveNote = async (name: string, slug: string) => {
    try {
      await api.removeNoteFromPathCollection(name, slug);
      await refresh();
    } catch (e) { setErr(String(e)); }
  };

  const onlyRoot = collections.length <= 1;

  const detailPanel =
    selected && selectedCol ? (
      <PathDetail
        collection={selectedCol}
        allNotes={notes}
        isRoot={selected === rootName}
        isGhost={isGhostPath(selectedCol, rootName)}
        parentName={parentOf(selected) || rootName}
        onClose={() => setSelected(null)}
        onOpenNote={(slug) => { onNavigate(slug); }}
        onOpenMap={(focusSlug) => {
          onOpenMap(selectedCol.name, focusSlug);
        }}
        onEditCondition={() => startEditCondition(selectedCol.name, selectedCol.condition)}
        onRename={() => handleRename(selectedCol.name)}
        onDelete={() => handleDelete(selectedCol.name)}
        onSetMainNote={(slug) => handleSetMainNote(selectedCol.name, slug)}
        onAddNote={(slug) => handleAddNote(selectedCol.name, slug)}
        onRemoveNote={(slug) => handleRemoveNote(selectedCol.name, slug)}
        onBranchFromNote={(slug) => startFork(selectedCol.name, slug)}
        onRequestPromote={() => setPromoteTarget(selectedCol.name)}
      />
    ) : null;

  return (
    <div
      className="fixed inset-0 z-40 bg-bg flex flex-col animate-fadeIn"
      role="dialog"
      aria-label="Paths"
    >
      <header className="px-6 py-4 border-b border-bd bg-bg flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <NewDirectionIcon />
          <div>
            <div className="font-serif text-[22px] text-char leading-none">Paths</div>
            <div className="text-2xs text-t3 italic mt-1">
              Collections of notes, branching off <span className="text-t2 not-italic">{rootName}</span>.
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!onlyRoot && onSwitchToRoot && (
            <button
              onClick={() => { onSwitchToRoot(rootName); setSelected(rootName); }}
              className="text-xs px-3 py-1.5 rounded-md border border-yel/70 text-yeld hover:bg-yelp inline-flex items-center gap-1.5"
              title={`Go back to ${rootName} — the trunk of your thinking`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: "var(--yel)" }}
              />
              <span>← Back to {rootName}</span>
            </button>
          )}
          {!onlyRoot && (
            <button
              onClick={() => startFork(rootName)}
              className="text-xs px-3 py-1.5 rounded-md bg-yel text-on-yel hover:bg-yel2 inline-flex items-center gap-1.5"
              title={`Branch a new 'if…' off ${rootName}`}
            >
              <NewDirectionIcon />
              <span>New path from {rootName}</span>
            </button>
          )}
          <button
            onClick={() => setHelpOpen((o) => !o)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition ${
              helpOpen ? "bg-yelp text-yeld" : "text-t3 hover:bg-s2 hover:text-char"
            }`}
            title="How to read this"
          >
            <HelpIcon />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-t3 hover:bg-s2 hover:text-char"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      {err && (
        <div className="px-6 py-2.5 border-b border-bd bg-danger/10 text-xs text-danger">
          {err}
        </div>
      )}

      <div
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: selected ? "minmax(0,1fr) 420px" : "minmax(0,1fr)" }}
      >
        <div className="relative min-h-0 overflow-hidden">
          {onlyRoot ? (
            <PathsEmptyState
              currentPath={rootName}
              onCreate={async (condition) => {
                const trimmed = condition.trim();
                if (!trimmed) return;
                const name =
                  trimmed
                    .toLowerCase()
                    .replace(/^(if\s+|what\s+if\s+)/i, "")
                    .split(/\s+/)
                    .slice(0, 5)
                    .join("-")
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-|-$/g, "") || "new-path";
                try {
                  await api.createPathCollection(name, trimmed, rootName);
                  await refresh();
                  setSelected(name);
                } catch (e) { setErr(String(e)); }
              }}
            />
          ) : (
            <ForkingRoad
              collections={collections}
              rootName={rootName}
              notes={notes}
              selectedPath={selected}
              onSelect={setSelected}
              onEditCondition={startEditCondition}
              onAddFork={startFork}
              pendingForkParent={newFork?.parent ?? null}
              onCommitPendingFork={commitFork}
              onCancelPendingFork={() => setNewFork(null)}
            />
          )}
        </div>

        {detailPanel && (
          <div className="h-full min-h-0 overflow-hidden border-l border-bd">
            {detailPanel}
          </div>
        )}
      </div>

      {!onlyRoot && (
        <footer className="px-6 py-2 border-t border-bd bg-s1 flex items-center gap-4 text-2xs text-t3">
          <span className="italic">drag to move · scroll to zoom</span>
          <span>·</span>
          <span className="italic">click a path to see what's in it</span>
          <span>·</span>
          <span className="italic">+ to branch · ★ marks each path's main note</span>
        </footer>
      )}

      {helpOpen && (
        <div
          className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm flex items-center justify-center animate-fadeIn"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-[min(600px,92vw)] bg-bg border border-bd2 rounded-xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-serif text-[22px] text-char mb-1">
              How paths work now
            </div>
            <div className="text-xs text-t3 italic mb-4">
              Paths are named <em>collections of notes</em> that branch off a
              designated <em>root</em>. Notes are shared — one note can live
              in many paths. Selecting a path here doesn't change what you can
              read elsewhere.
            </div>
            <ul className="space-y-3 text-sm text-t2 leading-relaxed">
              <li>
                <strong className="font-serif text-char">The root</strong> is
                the trunk — labeled{" "}
                <code className="text-yeld not-italic">{rootName}</code>. Every
                other path descends from it.
              </li>
              <li>
                <strong className="font-serif text-char">Selecting a node</strong>{" "}
                highlights its ancestry and everything that branches off it,
                and opens the detail panel on the right.
              </li>
              <li>
                <strong className="font-serif text-char">In the detail panel</strong>:
                toggle which notes are in this path, mark one as the path's
                main note (★), and spin any member note off into its own
                child path.
              </li>
              <li>
                <strong className="font-serif text-char">The map</strong> button
                opens the connection graph filtered to this path's notes —
                perfect for "what does this path actually hold together?"
              </li>
              <li>
                <strong className="font-serif text-char">The + button</strong>{" "}
                on any node starts a child path. Type the <em>if…</em>, press
                Enter.
              </li>
            </ul>
            <div className="mt-5 text-right">
              <button
                onClick={() => setHelpOpen(false)}
                className="btn-yel px-3 py-1.5 text-sm rounded-md"
              >
                got it
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <ConditionEditor
          branch={editing.name}
          initial={editing.initial}
          onSave={saveCondition}
          onCancel={() => setEditing(null)}
        />
      )}

      {promoteTarget && (
        <PromoteConfirm
          target={promoteTarget}
          currentRoot={rootName}
          targetIsGhost={(() => {
            const c = collections.find((c) => c.name === promoteTarget);
            return c ? isGhostPath(c, rootName) : false;
          })()}
          onCancel={() => setPromoteTarget(null)}
          onConfirm={async () => {
            const name = promoteTarget;
            setPromoteTarget(null);
            if (name) await handlePromote(name);
          }}
        />
      )}
    </div>
  );
}

function PromoteConfirm({
  target,
  currentRoot,
  targetIsGhost,
  onCancel,
  onConfirm,
}: {
  target: string;
  currentRoot: string;
  targetIsGhost: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  const required = `make ${target} main`;
  const matches = phrase.trim().toLowerCase() === required.toLowerCase();
  return (
    <div
      className="fixed inset-0 z-50 bg-char/40 backdrop-blur-sm flex items-center justify-center animate-fadeIn"
      onMouseDown={onCancel}
    >
      <div
        className="w-[min(540px,92vw)] bg-bg border border-bd2 rounded-xl shadow-2xl p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="font-serif text-[22px] text-char mb-1">
          {targetIsGhost ? "Bring" : "Promote"}{" "}
          <span className="text-yeld italic">{target}</span>
          {targetIsGhost ? " back as main?" : " to main?"}
        </div>
        <p className="text-xs text-t2 italic mt-1 mb-4 leading-relaxed">
          This is a structural change. Read before you type.
        </p>
        <ul className="space-y-2 text-xs text-t2 leading-relaxed mb-4">
          {targetIsGhost ? (
            <>
              <li>
                <strong className="text-char">{target} returns as the trunk.</strong>
                {" "}Its era's peers — the paths ghosted alongside it — come
                back live as its siblings, preserving the shape they had
                before.
              </li>
              <li>
                <strong className="text-char">
                  The current main, <em>{currentRoot}</em>, moves to the ghost
                  zone.
                </strong>
                {" "}Any siblings of the current main go with it, so you can
                bring them back the same way later.
              </li>
            </>
          ) : (
            <>
              <li>
                <strong className="text-char">{target} becomes the trunk.</strong>
                {" "}The current main <em>{currentRoot}</em> and its sibling
                paths move to the ghost zone — preserved as history, rendered
                faded to the left of the new main.
              </li>
              <li>
                <strong className="text-char">The relationships stay intact.</strong>
                {" "}Ghost peers keep the shape of their era. Promoting any
                ghost back to main revives that whole era.
              </li>
            </>
          )}
          <li>
            <strong className="text-char">Your notes don't move.</strong>
            {" "}Nothing is deleted, nothing is renamed on disk — only the
            path tree's anchor shifts.
          </li>
          <li>
            <strong className="text-char">Reversible.</strong>
            {" "}Any ghost path can be promoted back later.
          </li>
        </ul>
        <div className="text-2xs font-mono text-t3 mb-1.5 uppercase tracking-wider">
          Type <span className="text-yeld">{required}</span> to confirm
        </div>
        <input
          autoFocus
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && matches) onConfirm(); }}
          className="w-full px-3 py-2 bg-s1 border border-bd rounded-md text-char text-sm placeholder:text-t3 focus:outline-none focus:border-yel"
          placeholder={required}
        />
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
          >
            cancel
          </button>
          <button
            disabled={!matches}
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded-md bg-yel text-on-yel font-medium hover:bg-yel2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Promote to main
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}
