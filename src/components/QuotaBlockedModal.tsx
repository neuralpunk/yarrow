// Sync-paused-by-quota modal. Shown when the stage-1 pre-push check
// aborts a sync locally — the `SyncOutcome.quota_blocked` payload
// drives the body. Copy is deliberately plain-English ("room" /
// "recent changes") rather than git/storage jargon ("quota" /
// "commits"), per CLAUDE.md's terminology rule. Error code
// (`E-QUOTA-001`) stays visible so support can triage quickly when a
// user pastes a screenshot.
//
// The user's two escape hatches live here:
//   1. Undo my recent changes (hard reset local → server tip).
//      Two-step: click shows the preview list of changes that'd be
//      thrown away, second click actually performs the reset.
//   2. "Manage storage on the server" — a pointer to the Settings →
//      Storage tab that stage 3 wires up.

import { useState } from "react";
import Modal from "./Modal";
import { api } from "../lib/tauri";
import { DiscardOutcome, QuotaBlockInfo } from "../lib/types";
import { useT } from "../lib/i18n";

interface Props {
  open: boolean;
  blockInfo: QuotaBlockInfo | null;
  onClose: () => void;
  /** Called after a successful discard so the caller can re-trigger sync. */
  onDiscarded?: (outcome: DiscardOutcome) => void;
  /** Called when the user clicks the "Manage Storage" link. AppShell
   *  handles this by opening the Settings modal on the Storage tab.
   *  Optional — when absent, the link is hidden. */
  onOpenManageStorage?: () => void;
}

type Phase = "info" | "preview" | "running" | "error";

export default function QuotaBlockedModal({
  open,
  blockInfo,
  onClose,
  onDiscarded,
  onOpenManageStorage,
}: Props) {
  const [phase, setPhase] = useState<Phase>("info");
  const [preview, setPreview] = useState<DiscardOutcome | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const t = useT();

  if (!open || !blockInfo) return null;

  const remaining = humanBytes(blockInfo.remaining_bytes);
  const estimated = humanBytes(blockInfo.estimated_bytes);
  const overBy = humanBytes(
    Math.max(0, blockInfo.estimated_bytes - blockInfo.remaining_bytes),
  );

  const resetState = () => {
    setPhase("info");
    setPreview(null);
    setErrMsg(null);
  };

  const handleRequestDiscard = async () => {
    setErrMsg(null);
    try {
      const p = await api.discardUnsyncedChanges(false);
      setPreview(p);
      setPhase("preview");
    } catch (e) {
      setErrMsg(humanizeError(e));
      setPhase("error");
    }
  };

  const handleConfirmDiscard = async () => {
    setPhase("running");
    setErrMsg(null);
    try {
      const out = await api.discardUnsyncedChanges(true);
      onDiscarded?.(out);
      resetState();
      onClose();
    } catch (e) {
      setErrMsg(humanizeError(e));
      setPhase("error");
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        phase === "preview"
          ? t("modals.quota.previewTitle")
          : t("modals.quota.infoTitle")
      }
      width="w-[520px]"
    >
      {phase === "info" && (
        <div className="space-y-4">
          {blockInfo.estimated_bytes > 0 ? (
            <p className="text-t1 leading-relaxed">
              {t("modals.quota.infoBody", { estimated, remaining, over: overBy })}
            </p>
          ) : (
            // Backstop path: we detected the server's 413 after the fact
            // but couldn't re-compute the delta cleanly. Still open the
            // modal — it beats the raw libgit2 error — just with simpler
            // copy that doesn't put meaningless zeros in front of the user.
            <p className="text-t1 leading-relaxed">
              {t("modals.quota.infoBodyFallback")}
            </p>
          )}

          {blockInfo.culprits.length > 0 && (
            <div className="border border-bd rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-bg-soft border-b border-bd text-xs uppercase tracking-wide text-t3">
                {t("modals.quota.biggestFiles")}
              </div>
              <div className="divide-y divide-bd/70">
                {blockInfo.culprits.slice(0, 5).map((c) => (
                  <div
                    key={c.oid}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="truncate font-mono text-char" title={c.path}>
                      {c.path}
                    </span>
                    <span className="text-t2 tabular-nums whitespace-nowrap pl-3">
                      {humanBytes(c.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-t2 leading-relaxed">
            {t("modals.quota.optionsBody")}
          </p>

          {errMsg && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
              {errMsg}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            {onOpenManageStorage ? (
              <button
                type="button"
                onClick={onOpenManageStorage}
                className="text-sm text-yeld hover:underline"
              >
                {t("modals.quota.manageStorage")}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-md border border-bd2 bg-bg hover:bg-bg-soft text-char text-sm"
              >
                {t("modals.quota.close")}
              </button>
              <button
                type="button"
                onClick={handleRequestDiscard}
                className="px-4 py-2 rounded-md bg-yel text-on-yel hover:bg-yel2 text-sm font-medium"
              >
                {t("modals.quota.undoAction")}
              </button>
            </div>
          </div>

          <ErrorRef code="E-QUOTA-001" />
        </div>
      )}

      {phase === "preview" && preview && (
        <div className="space-y-4">
          <p className="text-t1 leading-relaxed">
            {preview.commits_ahead === 0
              ? t("modals.quota.previewNothing")
              : preview.commits_ahead === 1
                ? t("modals.quota.previewOne", { count: String(preview.commits_ahead) })
                : t("modals.quota.previewMany", { count: String(preview.commits_ahead) })}
          </p>

          {preview.commits.length > 0 && (
            <div className="border border-bd rounded-lg overflow-hidden max-h-[220px] overflow-y-auto">
              <div className="px-3 py-2 bg-bg-soft border-b border-bd text-xs uppercase tracking-wide text-t3 sticky top-0">
                {t("modals.quota.willBeUndone")}
              </div>
              <div className="divide-y divide-bd/70">
                {preview.commits.map((c) => (
                  <div
                    key={c.oid}
                    className="px-3 py-2 text-sm"
                  >
                    <div className="truncate text-char" title={c.summary}>
                      {c.summary}
                    </div>
                    <div className="text-[11px] text-t3 font-mono tabular-nums">
                      {c.oid.slice(0, 7)} · {formatRelative(c.time, t)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.reset_to_summary && (
            <p className="text-sm text-t2 border-l-2 border-sage pl-3">
              {t("modals.quota.goingBackTo")}{" "}
              <span className="text-char">{preview.reset_to_summary}</span>
            </p>
          )}

          {errMsg && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
              {errMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPhase("info")}
              className="px-4 py-2 rounded-md border border-bd2 bg-bg hover:bg-bg-soft text-char text-sm"
            >
              {t("modals.quota.previewBack")}
            </button>
            <button
              type="button"
              onClick={handleConfirmDiscard}
              disabled={preview.commits_ahead === 0}
              className="px-4 py-2 rounded-md bg-danger text-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              {t("modals.quota.confirmDiscard")}
            </button>
          </div>

          <ErrorRef code="E-QUOTA-001" />
        </div>
      )}

      {phase === "running" && (
        <div className="py-6 text-center text-t1">
          <div className="text-sm italic">{t("modals.quota.running")}</div>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          <p className="text-t1 leading-relaxed">
            {t("modals.quota.errorBody")}
          </p>
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
            {errMsg ?? t("modals.quota.errorUnknown")}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-md border border-bd2 bg-bg hover:bg-bg-soft text-char text-sm"
            >
              {t("modals.quota.close")}
            </button>
            <button
              type="button"
              onClick={() => setPhase("info")}
              className="px-4 py-2 rounded-md bg-yel text-on-yel hover:bg-yel2 text-sm font-medium"
            >
              {t("modals.quota.tryAgain")}
            </button>
          </div>

          <ErrorRef code="E-QUOTA-002" />
        </div>
      )}
    </Modal>
  );
}

/**
 * Small muted footer showing the reference code. Users can quote this
 * verbatim when opening a support ticket so the team knows the exact
 * path without needing a full repro. The code is click-to-copy.
 */
function ErrorRef({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be disabled; user can still read the code */
    }
  };
  return (
    <div className="pt-3 mt-2 border-t border-bd/60 text-[11px] text-t3 flex items-center justify-between">
      <span>
        {t("modals.quota.reference")}{" "}
        <button
          type="button"
          onClick={copy}
          className="font-mono text-t2 hover:text-char underline-offset-2 hover:underline"
          title={t("modals.quota.copyTitle")}
        >
          {code}
        </button>
        {copied && <span className="ml-2 text-sage">{t("modals.quota.copied")}</span>}
      </span>
      <span className="italic">{t("modals.quota.referenceFooter")}</span>
    </div>
  );
}

function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "?";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  for (const u of units) {
    if (v < 1024) return `${v.toFixed(v < 10 ? 1 : 0)} ${u}`;
    v /= 1024;
  }
  return `${v.toFixed(1)} PB`;
}

function formatRelative(unixSeconds: number, t: ReturnType<typeof useT>): string {
  const now = Date.now() / 1000;
  const delta = Math.max(0, now - unixSeconds);
  if (delta < 60) return t("modals.quota.relativeJustNow");
  if (delta < 3600) return t("modals.quota.relativeMinutes", { n: String(Math.floor(delta / 60)) });
  if (delta < 86400) return t("modals.quota.relativeHours", { n: String(Math.floor(delta / 3600)) });
  return t("modals.quota.relativeDays", { n: String(Math.floor(delta / 86400)) });
}

function humanizeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
