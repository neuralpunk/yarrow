import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClusterSuggestion, NoteSummary, PathCollectionsView } from "../lib/types";
import { isGhostPath } from "../lib/types";
import { api } from "../lib/tauri";
import { NewDirectionIcon, HelpIcon } from "../lib/icons";
import ForkingRoad from "./Paths/ForkingRoad";
import PathDetail from "./Paths/PathDetail";
import ConditionEditor from "./Paths/ConditionEditor";
import PathsEmptyState from "./Paths/PathsEmptyState";
import { useT } from "../lib/i18n";

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
  /** The path the user is actively editing in. Forwarded to ForkingRoad and
   *  PathDetail so they can show diff-from-current insights ("if you take
   *  this path you'd lose Rome"). */
  currentPathName?: string;
  /** Open the decision-matrix modal — surfaced as a prominent button in the
   *  PathsPane header so users discover it without learning the palette
   *  command first. */
  onOpenDecisionMatrix?: () => void;
}

export default function PathsPane({
  notes,
  onClose,
  onNavigate,
  onOpenMap,
  onCollectionsChanged,
  onLinksChanged,
  onSwitchToRoot,
  currentPathName,
  onOpenDecisionMatrix,
}: Props) {
  const t = useT();
  const [view, setView] = useState<PathCollectionsView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | { name: string; initial: string }>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newFork, setNewFork] = useState<null | { parent: string; seedSlug?: string }>(null);
  const [promoteTarget, setPromoteTarget] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ClusterSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Parent components often pass inline arrow callbacks, which would give
  // `onCollectionsChanged` a new identity on every parent render. Pinning
  // it to a ref keeps `refresh` stable and prevents a refresh↔setState
  // feedback loop that pegged the WebKit process when Paths was open.
  const onCollectionsChangedRef = useRef(onCollectionsChanged);
  useEffect(() => { onCollectionsChangedRef.current = onCollectionsChanged; }, [onCollectionsChanged]);

  const refresh = useCallback(async () => {
    try {
      const v = await api.listPathCollections();
      setView(v);
      setErr(null);
      onCollectionsChangedRef.current?.(v);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Load suggestions lazily — one IPC per PathsPane mount. Cheap on
  // small vaults, and we cap at 6 candidates so even dense graphs don't
  // produce a wall of suggestions.
  useEffect(() => {
    let alive = true;
    api.suggestPathClusters().then((s) => {
      if (alive) setSuggestions(s);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const acceptSuggestion = async (s: ClusterSuggestion) => {
    try {
      // Seed the new collection with its best-connected member; the
      // backend dedupes the slug and avoids collisions. After creation,
      // add the remaining members explicitly.
      await api.createPathCollection(s.name, s.seed_title, rootName, s.seed_slug);
      for (const slug of s.members) {
        if (slug === s.seed_slug) continue;
        await api.addNoteToPathCollection(s.name, slug);
      }
      await refresh();
      setSuggestions((prev) => prev.filter((x) => x.seed_slug !== s.seed_slug));
      setSelected(s.name);
    } catch (e) {
      setErr(String(e));
    }
  };
  const dismissSuggestion = (s: ClusterSuggestion) => {
    setSuggestions((prev) => prev.filter((x) => x.seed_slug !== s.seed_slug));
  };

  const collections = view?.collections ?? [];
  // Members of the user's currently-active path — passed to PathDetail so it
  // can compute "what you'd gain / leave behind" without re-fetching.
  const currentPathMembers = useMemo(() => {
    if (!currentPathName) return undefined;
    return collections.find((c) => c.name === currentPathName)?.members;
  }, [collections, currentPathName]);
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
    const next = window.prompt(t("paths.pane.renamePrompt", { name }), name);
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
    const ok = window.confirm(t("paths.pane.deleteConfirm", { name }));
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
  const handleSetColor = async (name: string, color: string | null) => {
    try {
      await api.setPathCollectionColor(name, color);
      await refresh();
    } catch (e) { setErr(String(e)); }
  };
  const handleSetAutoTag = async (name: string, tag: string | null) => {
    try {
      await api.setPathCollectionAutoTag(name, tag);
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
        isGhost={isGhostPath(selectedCol, rootName, collections)}
        parentName={parentOf(selected) || rootName}
        currentPathName={currentPathName}
        currentPathMembers={currentPathMembers}
        onClose={() => setSelected(null)}
        onOpenNote={(slug) => { onNavigate(slug); }}
        onOpenMap={(focusSlug) => {
          onOpenMap(selectedCol.name, focusSlug);
        }}
        onEditCondition={() => startEditCondition(selectedCol.name, selectedCol.condition)}
        onRename={() => handleRename(selectedCol.name)}
        onDelete={() => handleDelete(selectedCol.name)}
        onSetMainNote={(slug) => handleSetMainNote(selectedCol.name, slug)}
        onSetColor={(color) => handleSetColor(selectedCol.name, color)}
        onSetAutoTag={(tag) => handleSetAutoTag(selectedCol.name, tag)}
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
      aria-label={t("paths.pane.title")}
    >
      <header className="px-6 py-4 border-b border-bd bg-bg flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <NewDirectionIcon />
          <div>
            <div className="font-serif text-[22px] text-char leading-none">{t("paths.pane.title")}</div>
            <div className="text-2xs text-t3 italic mt-1">
              {(() => {
                const tpl = t("paths.pane.subtitle");
                const parts = tpl.split("{root}");
                return (
                  <>
                    {parts[0]}
                    <span className="text-t2 not-italic">{rootName}</span>
                    {parts[1] ?? ""}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!onlyRoot && onSwitchToRoot && (
            <button
              onClick={() => { onSwitchToRoot(rootName); setSelected(rootName); }}
              className="text-xs px-3 py-1.5 rounded-md border border-yel/70 text-yeld hover:bg-yelp inline-flex items-center gap-1.5"
              title={t("paths.pane.backToRootTitle", { root: rootName })}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: "var(--yel)" }}
              />
              <span>{t("paths.pane.backToRoot", { root: rootName })}</span>
            </button>
          )}
          {!onlyRoot && (
            <button
              onClick={() => startFork(rootName)}
              className="text-xs px-3 py-1.5 rounded-md bg-yel text-on-yel hover:bg-yel2 inline-flex items-center gap-1.5"
              title={t("paths.pane.newPathFromRootTitle", { root: rootName })}
            >
              <NewDirectionIcon />
              <span>{t("paths.pane.newPathFromRoot", { root: rootName })}</span>
            </button>
          )}
          {suggestions.length > 0 && !onlyRoot && (
            <button
              onClick={() => setShowSuggestions((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition ${
                showSuggestions
                  ? "bg-yelp text-yeld border border-yel"
                  : "border border-bd text-t2 hover:bg-s2 hover:text-char"
              }`}
              title={t("paths.pane.suggestedTitle")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="4" cy="4" r="1.4" />
                <circle cx="10" cy="4" r="1.4" />
                <circle cx="7" cy="10" r="1.4" />
                <path d="M4.5 4.5L6.5 9.5M9.5 4.5L7.5 9.5M5 4h4" />
              </svg>
              <span>{t("paths.pane.suggestedCount", { count: String(suggestions.length) })}</span>
            </button>
          )}
          {onOpenDecisionMatrix && !onlyRoot && (
            <button
              onClick={onOpenDecisionMatrix}
              className="text-xs px-3 py-1.5 rounded-md border border-bd text-t2 hover:bg-s2 hover:text-char inline-flex items-center gap-1.5"
              title={t("paths.pane.decisionMatrixTitle")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.5" y="1.5" width="11" height="11" rx="1.5"/>
                <path d="M1.5 5h11M1.5 9h11M5 1.5v11M9 1.5v11"/>
              </svg>
              <span>{t("paths.pane.decisionMatrix")}</span>
            </button>
          )}
          <button
            onClick={() => setHelpOpen((o) => !o)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition ${
              helpOpen ? "bg-yelp text-yeld" : "text-t3 hover:bg-s2 hover:text-char"
            }`}
            title={t("paths.pane.helpTitle")}
          >
            <HelpIcon />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-t3 hover:bg-s2 hover:text-char"
            title={t("paths.pane.closeTitle")}
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

      {showSuggestions && suggestions.length > 0 && (
        <div className="px-6 py-3 border-b border-bd bg-s1/60">
          <div className="flex items-baseline justify-between mb-2">
            <div className="font-serif text-sm text-char">{t("paths.pane.suggestedHeading")}</div>
            <div className="font-serif italic text-2xs text-t3">
              {t("paths.pane.suggestedHelp")}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suggestions.map((s) => (
              <div
                key={s.seed_slug}
                className="shrink-0 w-[280px] bg-bg border border-bd rounded-md p-3"
              >
                <div className="text-xs text-char font-serif mb-1 truncate" title={s.seed_title}>
                  {s.seed_title}
                </div>
                <div className="text-2xs text-t3 font-mono mb-2">
                  {t("paths.pane.suggestionEdges", {
                    count: String(s.members.length),
                    edges: String(s.internal_edges),
                  })}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {s.member_titles.slice(0, 5).map((title, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 bg-s2 rounded text-[10px] text-t2 truncate max-w-[120px]"
                    >
                      {title}
                    </span>
                  ))}
                  {s.member_titles.length > 5 && (
                    <span className="px-1.5 py-0.5 text-[10px] text-t3 italic">
                      {t("paths.pane.suggestionMore", { count: String(s.member_titles.length - 5) })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => acceptSuggestion(s)}
                    className="px-2 py-1 bg-char text-bg rounded text-2xs hover:bg-yeld transition"
                  >
                    {t("paths.pane.createPath")}
                  </button>
                  <button
                    onClick={() => dismissSuggestion(s)}
                    className="px-2 py-1 text-2xs text-t3 hover:text-char transition"
                  >
                    {t("paths.pane.dismiss")}
                  </button>
                </div>
              </div>
            ))}
          </div>
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
              currentPathName={currentPathName}
              onDropNoteOnPath={async (pathName, slug) => {
                try {
                  await api.addNoteToPathCollection(pathName, slug);
                  await refresh();
                  onLinksChanged?.();
                } catch (e) { setErr(String(e)); }
              }}
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
          <span className="italic">{t("paths.pane.footerDrag")}</span>
          <span>·</span>
          <span className="italic">{t("paths.pane.footerClick")}</span>
          <span>·</span>
          <span className="italic">{t("paths.pane.footerBranch")}</span>
        </footer>
      )}

      {helpOpen && (
        <div
          className="fixed inset-0 z-50 bg-bg/70 flex items-center justify-center animate-fadeIn"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-[min(600px,92vw)] bg-bg border border-bd2 rounded-xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-serif text-[22px] text-char mb-1">
              {t("paths.pane.helpTitleHeading")}
            </div>
            <div className="text-xs text-t3 italic mb-4">
              {t("paths.pane.helpIntro")}
            </div>
            <ul className="space-y-3 text-sm text-t2 leading-relaxed">
              <li>
                <strong className="font-serif text-char">{t("paths.pane.helpRootStrong")}</strong>{" "}
                {(() => {
                  const tpl = t("paths.pane.helpRootBody");
                  const parts = tpl.split("{root}");
                  return (
                    <>
                      {parts[0]}
                      <code className="text-yeld not-italic">{rootName}</code>
                      {parts[1] ?? ""}
                    </>
                  );
                })()}
              </li>
              <li>
                <strong className="font-serif text-char">{t("paths.pane.helpSelectStrong")}</strong>{" "}
                {t("paths.pane.helpSelectBody")}
              </li>
              <li>
                <strong className="font-serif text-char">{t("paths.pane.helpDetailStrong")}</strong>:
                {" "}{t("paths.pane.helpDetailBody")}
              </li>
              <li>
                <strong className="font-serif text-char">{t("paths.pane.helpMapStrong")}</strong>{" "}
                {t("paths.pane.helpMapBody")}
              </li>
              <li>
                <strong className="font-serif text-char">{t("paths.pane.helpPlusStrong")}</strong>{" "}
                {t("paths.pane.helpPlusBody")}
              </li>
            </ul>
            <div className="mt-5 text-right">
              <button
                onClick={() => setHelpOpen(false)}
                className="btn-yel px-3 py-1.5 text-sm rounded-md"
              >
                {t("paths.pane.helpDone")}
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
            return c ? isGhostPath(c, rootName, collections) : false;
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
  const t = useT();
  const [phrase, setPhrase] = useState("");
  // The "type X to confirm" phrase stays in English on every locale to
  // keep the mechanical guard predictable: a translator can't subtly break
  // the safety check by changing word order, and the visible localized
  // copy explains *what* to type either way.
  const required = `make ${target} main`;
  const matches = phrase.trim().toLowerCase() === required.toLowerCase();
  return (
    <div
      className="fixed inset-0 z-50 bg-char/40 flex items-center justify-center animate-fadeIn"
      onMouseDown={onCancel}
    >
      <div
        className="w-[min(540px,92vw)] bg-bg border border-bd2 rounded-xl shadow-2xl p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="font-serif text-[22px] text-char mb-1">
          {targetIsGhost ? t("paths.promote.bringBack") : t("paths.promote.promote")}{" "}
          <span className="text-yeld italic">{target}</span>
          {" "}{targetIsGhost ? t("paths.promote.bringBackSuffix") : t("paths.promote.promoteSuffix")}
        </div>
        <p className="text-xs text-t2 italic mt-1 mb-4 leading-relaxed">
          {t("paths.promote.lead")}
        </p>
        <ul className="space-y-2 text-xs text-t2 leading-relaxed mb-4">
          {targetIsGhost ? (
            <>
              <li>
                <strong className="text-char">
                  {t("paths.promote.bringBackTrunkStrong", { name: target })}
                </strong>
                {" "}{t("paths.promote.bringBackTrunkBody")}
              </li>
              <li>
                <strong className="text-char">
                  {t("paths.promote.bringBackOldStrong", { root: currentRoot })}
                </strong>
                {" "}{t("paths.promote.bringBackOldBody")}
              </li>
            </>
          ) : (
            <>
              <li>
                <strong className="text-char">
                  {t("paths.promote.promoteTrunkStrong", { name: target })}
                </strong>
                {" "}{t("paths.promote.promoteTrunkBody", { root: currentRoot })}
              </li>
              <li>
                <strong className="text-char">{t("paths.promote.promoteRelStrong")}</strong>
                {" "}{t("paths.promote.promoteRelBody")}
              </li>
            </>
          )}
          <li>
            <strong className="text-char">{t("paths.promote.notesStayStrong")}</strong>
            {" "}{t("paths.promote.notesStayBody")}
          </li>
          <li>
            <strong className="text-char">{t("paths.promote.reversibleStrong")}</strong>
            {" "}{t("paths.promote.reversibleBody")}
          </li>
        </ul>
        <div className="text-2xs font-mono text-t3 mb-1.5 uppercase tracking-wider">
          {(() => {
            const tpl = t("paths.promote.typeToConfirm");
            const parts = tpl.split("{phrase}");
            return (
              <>
                {parts[0]}
                <span className="text-yeld">{required}</span>
                {parts[1] ?? ""}
              </>
            );
          })()}
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
            {t("paths.promote.cancel")}
          </button>
          <button
            disabled={!matches}
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded-md bg-yel text-on-yel font-medium hover:bg-yel2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("paths.promote.confirm")}
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
