import { useEffect, useMemo, useState } from "react";
import type { HistoryEntry, Keepsake } from "../../lib/types";
import { friendlyDate, relativeTime } from "../../lib/format";
import { useT, type StringKey } from "../../lib/i18n";

interface Props {
  history: HistoryEntry[];
  preview: string | null;
  currentBody: string;
  noteTitle: string;
  /** Pinned checkpoints for this note — shown as ★ badges next to their
   *  entry in the timeline. Parent loads/filters server-side. */
  keepsakes?: Keepsake[];
  onHover: (oid: string) => void;
  onRestore: (oid: string) => void;
  /** Pin the selected checkpoint with a user-provided label. */
  onPin?: (oid: string, label: string, note?: string) => void;
  /** Remove a pin by keepsake id. */
  onUnpin?: (keepsakeId: string) => void;
  onClose: () => void;
}

/**
 * Groups checkpoints into human-friendly buckets so the list reads like a
 * journal ("today", "yesterday", "earlier this week") instead of a wall of
 * timestamps.
 *
 * Returns either a translation-key/value pair (for the bounded bins) or a
 * pre-formatted month/year label (for the long-tail bucket). Renderers
 * resolve a key through `t()`; the `value` is the literal label when no
 * key is appropriate.
 */
type Bucket = { key: StringKey; value?: undefined } | { key: null; value: string };

function bucketOf(unixSeconds: number): Bucket {
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  const d = new Date(unixSeconds * 1000);
  const today = new Date();
  const sameDay =
    d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay) return { key: "editor.history.bucket.today" };
  if (d.toDateString() === yesterday.toDateString())
    return { key: "editor.history.bucket.yesterday" };
  if (diff < 86400 * 7) return { key: "editor.history.bucket.earlierThisWeek" };
  if (diff < 86400 * 30) return { key: "editor.history.bucket.thisMonth" };
  return {
    key: null,
    value: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  };
}

export default function HistorySlider({
  history,
  preview,
  currentBody,
  noteTitle,
  keepsakes,
  onHover,
  onRestore,
  onPin,
  onUnpin,
  onClose,
}: Props) {
  const t = useT();
  const [idx, setIdx] = useState<number>(history.length > 0 ? 0 : -1);
  const [confirming, setConfirming] = useState(false);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [pinPrompt, setPinPrompt] = useState<{ oid: string } | null>(null);
  const [pinLabel, setPinLabel] = useState("");
  const [pinNote, setPinNote] = useState("");

  // oid → keepsake (first match, newest first). Lets us show a pin
  // next to any timeline entry whose oid has been pinned.
  const keepsakeByOid = useMemo(() => {
    const m = new Map<string, Keepsake>();
    for (const k of keepsakes ?? []) {
      if (!m.has(k.oid)) m.set(k.oid, k);
    }
    return m;
  }, [keepsakes]);

  useEffect(() => {
    if (idx >= 0 && history[idx]) onHover(history[idx].oid);
  }, [idx, history, onHover]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Bail out when focus is in a real input — otherwise the j/k/Enter
      // navigation shortcuts would eat letters the user is trying to
      // type into the pin prompt's label/note fields. Escape still
      // closes whatever's open (modal guards handle it below).
      const t = e.target as HTMLElement | null;
      const inInput = !!t && (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
      );
      if (e.key === "Escape") {
        if (pinPrompt) { setPinPrompt(null); return; }
        if (confirming) { setConfirming(false); return; }
        onClose();
        return;
      }
      // Any other key: if we're typing into an input, or a sub-modal
      // is open, don't steal it. The pin prompt has its own onKeyDown
      // on its input to handle Enter/Escape locally.
      if (inInput || pinPrompt) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setIdx((i) => Math.min(history.length - 1, i + 1));
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter" && idx >= 0 && !confirming) {
        e.preventDefault();
        setConfirming(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history.length, onClose, idx, confirming, pinPrompt]);

  const selected = idx >= 0 ? history[idx] : null;
  const isLatest = idx === 0;

  const previewBody = useMemo(() => stripFrontmatter(preview), [preview]);

  const diff = useMemo(() => {
    if (previewBody == null) return { added: 0, removed: 0 };
    const a = new Set(
      currentBody.split("\n").map((l) => l.trim()).filter(Boolean),
    );
    const b = new Set(
      previewBody.split("\n").map((l) => l.trim()).filter(Boolean),
    );
    let added = 0;
    let removed = 0;
    for (const l of a) if (!b.has(l)) added++;
    for (const l of b) if (!a.has(l)) removed++;
    return { added, removed };
  }, [previewBody, currentBody]);

  const diffLines = useMemo(() => {
    if (previewBody == null) return [] as Array<{ text: string; kind: "same" | "gone" | "new" }>;
    const aLines = currentBody.split("\n");
    const bLines = previewBody.split("\n");
    const aSet = new Set(aLines.map((l) => l.trim()));
    const bSet = new Set(bLines.map((l) => l.trim()));
    const out: Array<{ text: string; kind: "same" | "gone" | "new" }> = [];
    for (const l of bLines) {
      if (aSet.has(l.trim())) out.push({ text: l, kind: "same" });
      else out.push({ text: l, kind: "gone" });
    }
    for (const l of aLines) {
      if (!bSet.has(l.trim())) out.push({ text: l, kind: "new" });
    }
    return out;
  }, [previewBody, currentBody]);

  // Buckets for the left timeline column. We collect both the bucket
  // (for live translation) and a stable groupKey (for grouping +
  // React's `key` prop). The groupKey is just the i18n key when the
  // bucket is bounded, or the literal locale-formatted month label
  // for the long-tail bucket.
  const bucketed = useMemo(() => {
    type Group = {
      groupKey: string;
      bucket: Bucket;
      entries: Array<{ e: HistoryEntry; i: number }>;
    };
    const groups: Group[] = [];
    let current: Group | null = null;
    history.forEach((e, i) => {
      const bucket = bucketOf(e.timestamp);
      const groupKey = bucket.key ?? bucket.value ?? "";
      if (!current || current.groupKey !== groupKey) {
        current = { groupKey, bucket, entries: [] };
        groups.push(current);
      }
      current.entries.push({ e, i });
    });
    return groups;
  }, [history]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-char/30 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-[820px] max-w-[94vw] h-[560px] max-h-[90vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-bd bg-s1 flex items-center gap-3">
          <div className="min-w-0">
            <div className="font-serif text-lg text-char truncate">{noteTitle}</div>
            <div className="text-2xs text-t3">
              {history.length === 1
                ? t("editor.history.checkpointsOne", { count: String(history.length) })
                : t("editor.history.checkpointsOther", { count: String(history.length) })}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-2xs text-t2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDiffOnly}
                onChange={(e) => setShowDiffOnly(e.target.checked)}
                className="accent-yel"
              />
              {t("editor.history.showDiffOnly")}
            </label>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-s2 text-t2 hover:text-char"
              aria-label={t("editor.history.close")}
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Timeline list */}
          <aside className="w-[260px] shrink-0 border-r border-bd bg-s1/40 overflow-y-auto">
            {bucketed.map((group) => (
              <div key={group.groupKey} className="py-2">
                <div className="px-4 py-1 text-2xs uppercase tracking-wider text-t3 font-semibold">
                  {group.bucket.key ? t(group.bucket.key) : group.bucket.value}
                </div>
                <ul>
                  {group.entries.map(({ e, i }) => {
                    const isSel = i === idx;
                    return (
                      <li key={e.oid}>
                        <button
                          onClick={() => setIdx(i)}
                          onMouseEnter={() => setIdx(i)}
                          className={`w-full text-left px-4 py-2 flex items-start gap-2.5 text-xs transition border-l-2 ${
                            isSel
                              ? "bg-s2 text-char border-yel"
                              : "text-t2 border-transparent hover:bg-s2 hover:text-char"
                          }`}
                        >
                          <span
                            className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                              isSel ? "bg-yel" : i === 0 ? "bg-accent2" : "bg-bd2"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">
                                {i === 0 ? t("editor.history.now") : relativeTime(e.timestamp)}
                              </span>
                              {i === 0 && (
                                <span className="text-2xs px-1 py-px bg-yelp text-yeld rounded">
                                  {t("editor.history.latest")}
                                </span>
                              )}
                              {keepsakeByOid.has(e.oid) && (
                                <span
                                  className="yarrow-keepsake-pin"
                                  title={t("editor.history.pinnedAs", { label: keepsakeByOid.get(e.oid)?.label ?? "" })}
                                >
                                  {t("editor.history.kept")}
                                </span>
                              )}
                            </div>
                            <div className="text-2xs text-t3 font-mono mt-0.5">
                              {friendlyDate(e.timestamp)}
                            </div>
                            {e.thinking_note && (
                              <div className="text-2xs text-yeld italic mt-1 line-clamp-2">
                                “{e.thinking_note}”
                              </div>
                            )}
                            {keepsakeByOid.has(e.oid) && (
                              <div className="text-2xs italic text-yeld/80 mt-1 line-clamp-2">
                                {keepsakeByOid.get(e.oid)?.note || keepsakeByOid.get(e.oid)?.label}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </aside>

          {/* Preview + diff badge */}
          <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="px-5 py-2 border-b border-bd bg-s1/60 flex items-center gap-3">
              {selected ? (
                <>
                  <span className="text-2xs uppercase tracking-wider text-t3 font-semibold">
                    {t("editor.history.previewing")}
                  </span>
                  <span className="text-xs text-char">
                    {friendlyDate(selected.timestamp)}
                  </span>
                  <span className="text-2xs text-t3">
                    ({relativeTime(selected.timestamp)})
                  </span>
                  <span className="ml-auto flex items-center gap-2 text-2xs font-mono">
                    {diff.added > 0 && (
                      <span className="text-yeld" title={t("editor.history.addedSinceTitle")}>
                        {t("editor.history.addedSince", { count: String(diff.added) })}
                      </span>
                    )}
                    {diff.removed > 0 && (
                      <span className="text-danger" title={t("editor.history.removedGoneTitle")}>
                        {t("editor.history.removedGone", { count: String(diff.removed) })}
                      </span>
                    )}
                    {diff.added === 0 && diff.removed === 0 && (
                      <span className="text-t3">{t("editor.history.identical")}</span>
                    )}
                  </span>
                </>
              ) : (
                <span className="text-xs text-t3 italic">
                  {t("editor.history.pickFromTimeline")}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-bg">
              {previewBody != null ? (
                showDiffOnly ? (
                  <div className="font-sans text-sm leading-relaxed space-y-0.5">
                    {diffLines.filter((l) => l.kind !== "same").length === 0 && (
                      <div className="text-t3 italic text-sm">
                        {t("editor.history.noDifferences")}
                      </div>
                    )}
                    {diffLines
                      .filter((l) => l.kind !== "same")
                      .map((l, i) => (
                        <div
                          key={i}
                          className={
                            l.kind === "gone"
                              ? "pl-2 border-l-2 border-danger text-t2 line-through decoration-danger/60"
                              : "pl-2 border-l-2 border-yel text-char"
                          }
                        >
                          <span className="text-2xs text-t3 font-mono mr-1.5">
                            {l.kind === "gone" ? "−" : "+"}
                          </span>
                          {l.text || <span className="text-t3">·</span>}
                        </div>
                      ))}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-char leading-relaxed">
                    {previewBody || <span className="text-t3 italic">{t("editor.history.empty")}</span>}
                  </pre>
                )
              ) : (
                <div className="text-t3 italic text-sm">—</div>
              )}
            </div>
            {selected?.thinking_note && (
              <div className="px-5 py-2.5 border-t border-bd bg-yelp/40 text-xs text-yeld italic">
                {t("editor.history.thinkingPrefix", { thinking: selected.thinking_note })}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-bd bg-s1 px-5 py-3 flex items-center gap-3">
          <div className="text-2xs text-t3 font-mono">
            {selected
              ? isLatest
                ? t("editor.history.currentVersion")
                : t("editor.history.goingBack", { when: relativeTime(selected.timestamp) })
              : t("editor.history.noSelection")}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {selected && onPin && onUnpin && (
              (() => {
                const existing = keepsakeByOid.get(selected.oid);
                return existing ? (
                  <button
                    onClick={() => onUnpin(existing.id)}
                    className="px-3 py-1.5 text-xs rounded-md text-yeld hover:bg-yelp/60"
                    title={t("editor.history.unpinTitle", { label: existing.label })}
                  >
                    {t("editor.history.unpin")}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setPinLabel("");
                      setPinNote("");
                      setPinPrompt({ oid: selected.oid });
                    }}
                    className="px-3 py-1.5 text-xs rounded-md text-t2 hover:text-yeld hover:bg-yelp/40"
                    title={t("editor.history.pinThisTitle")}
                  >
                    {t("editor.history.pinThis")}
                  </button>
                );
              })()
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-t2 hover:text-char"
            >
              {t("editor.history.cancel")}
            </button>
            <button
              disabled={!selected || isLatest}
              onClick={() => setConfirming(true)}
              className="btn-yel px-4 py-1.5 text-sm rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
              title={isLatest ? t("editor.history.alreadyCurrentTitle") : t("editor.history.restoreTitle")}
            >
              {t("editor.history.restore")}
            </button>
          </div>
        </div>

        {pinPrompt && onPin && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-bg/85"
            onClick={() => setPinPrompt(null)}
          >
            <div
              className="max-w-sm w-full mx-4 bg-bg border border-bd2 rounded-xl shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-serif text-xl text-char mb-2">
                {t("editor.history.pinDialog.title")}
              </div>
              <p className="text-sm text-t2 mb-3 leading-relaxed">
                {t("editor.history.pinDialog.body")}
              </p>
              <input
                value={pinLabel}
                onChange={(e) => setPinLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pinLabel.trim()) {
                    e.preventDefault();
                    onPin(pinPrompt.oid, pinLabel.trim(), pinNote.trim() || undefined);
                    setPinPrompt(null);
                  }
                  if (e.key === "Escape") setPinPrompt(null);
                }}
                autoFocus
                placeholder={t("editor.history.pinDialog.labelPlaceholder")}
                className="w-full px-3 py-2 bg-s1 border border-bd rounded text-char text-sm placeholder:text-t3 mb-3 focus:outline-none focus:border-yel"
              />
              <textarea
                value={pinNote}
                onChange={(e) => setPinNote(e.target.value)}
                placeholder={t("editor.history.pinDialog.notePlaceholder")}
                rows={3}
                className="w-full px-3 py-2 bg-s1 border border-bd rounded text-char text-xs placeholder:text-t3 mb-4 focus:outline-none focus:border-yel"
              />
              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-1.5 text-sm text-t2 hover:text-char"
                  onClick={() => setPinPrompt(null)}
                >
                  {t("editor.history.cancel")}
                </button>
                <button
                  className="btn-yel px-4 py-1.5 text-sm rounded-md disabled:opacity-40"
                  disabled={!pinLabel.trim()}
                  onClick={() => {
                    onPin(pinPrompt.oid, pinLabel.trim(), pinNote.trim() || undefined);
                    setPinPrompt(null);
                  }}
                >
                  {t("editor.history.pinDialog.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirming && selected && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-bg/85"
            onClick={() => setConfirming(false)}
          >
            <div
              className="max-w-sm w-full mx-4 bg-bg border border-bd2 rounded-xl shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-serif text-xl text-char mb-2">
                {t("editor.history.confirm.title")}
              </div>
              <p className="text-sm text-t2 mb-1 leading-relaxed">
                {t("editor.history.confirm.bodyLead")}{" "}
                <span className="text-char font-medium">
                  {friendlyDate(selected.timestamp)}
                </span>
                .
              </p>
              <p className="text-xs text-t3 mb-4 leading-relaxed">
                {t("editor.history.confirm.bodyTail")}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-1.5 text-sm text-t2 hover:text-char"
                  onClick={() => setConfirming(false)}
                >
                  {t("editor.history.cancel")}
                </button>
                <button
                  className="btn-yel px-4 py-1.5 text-sm rounded-md"
                  onClick={() => {
                    setConfirming(false);
                    onRestore(selected.oid);
                  }}
                  autoFocus
                >
                  {t("editor.history.confirm.yesRestore")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function stripFrontmatter(raw: string | null): string | null {
  if (raw == null) return null;
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  let after = end + 4;
  if (raw[after] === "\r") after++;
  if (raw[after] === "\n") after++;
  return raw.slice(after);
}
