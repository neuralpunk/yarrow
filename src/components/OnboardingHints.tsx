import { useEffect, useMemo, useState } from "react";
import { SK } from "../lib/platform";
import { useT } from "../lib/i18n";

interface Props {
  /** When a workspace is first opened we start the cycle; subsequent
   *  workspace opens on the same machine stay dismissed via localStorage. */
  workspacePath: string;
}

const STORAGE_KEY = "yarrow.onboardingHints.dismissed";

interface Hint {
  id: string;
  title: string;
  body: React.ReactNode;
}

/** Dismissible first-launch tutorial — three short cards, one at a time,
 *  advanced via a "Next tip" button. Dismissed state persists per machine
 *  so power users never see it again. */
export default function OnboardingHints({ workspacePath }: Props) {
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const t = useT();
  const HINTS: Hint[] = useMemo(() => [
    {
      id: "palette",
      title: t("modals.hints.paletteTitle"),
      body: (
        <>
          {t("modals.hints.paletteBodyPre")}<kbd className="px-1.5 py-0.5 rounded bg-s2 text-2xs font-mono text-char border border-bd">{SK.palette}</kbd>{t("modals.hints.paletteBodyPost")}
        </>
      ),
    },
    {
      id: "paths",
      title: t("modals.hints.pathsTitle"),
      body: (
        <>
          {t("modals.hints.pathsBodyPre")}<kbd className="px-1.5 py-0.5 rounded bg-s2 text-2xs font-mono text-char border border-bd">{SK.newDirection}</kbd>{t("modals.hints.pathsBodyMid")}<em>{t("modals.hints.pathsBranchThis")}</em>{t("modals.hints.pathsBodyPost")}<em>{t("modals.hints.pathsBodyPath")}</em>{t("modals.hints.pathsBodyTail")}
        </>
      ),
    },
    {
      id: "decide",
      title: t("modals.hints.decideTitle"),
      body: (
        <>
          {t("modals.hints.decideBodyPre")}<strong>{t("modals.hints.decideBodyPaths")}</strong>{t("modals.hints.decideBodyMid")}<strong>{t("modals.hints.decideBodyMatrix")}</strong>{t("modals.hints.decideBodyTail")}
        </>
      ),
    },
  ], [t]);

  // Don't pop the card immediately on a cold boot — give the app a moment
  // to finish its first render so the hint doesn't collide with layout.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (dismissed) return;
    const tid = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(tid);
  }, [dismissed, workspacePath]);

  if (dismissed || !visible) return null;
  const hint = HINTS[idx];
  const isLast = idx === HINTS.length - 1;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="fixed z-40 bottom-5 right-5 w-[340px] bg-bg border border-bd2 rounded-xl shadow-2xl animate-fadeIn"
      role="dialog"
      aria-label={t("modals.hints.dialogLabel")}
    >
      <div className="px-4 pt-3 pb-2 flex items-baseline gap-2">
        <span className="text-2xs font-mono uppercase tracking-wider text-yeld">
          {t("modals.hints.tipCounter", { n: String(idx + 1), total: String(HINTS.length) })}
        </span>
        <button
          onClick={dismiss}
          className="ml-auto text-t3 hover:text-char text-sm leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-s2"
          aria-label={t("modals.hints.dismissAria")}
          title={t("modals.hints.dismissTitle")}
        >
          ×
        </button>
      </div>
      <div className="px-4 pb-3">
        <div className="font-serif text-base text-char mb-1.5">{hint.title}</div>
        <div className="text-xs text-t2 leading-relaxed">{hint.body}</div>
      </div>
      <div className="px-4 py-2 border-t border-bd flex items-center gap-2">
        <div className="flex gap-1">
          {HINTS.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-yel" : "bg-bd2"}`}
            />
          ))}
        </div>
        <button
          onClick={dismiss}
          className="ml-auto text-xs text-t3 hover:text-char"
        >
          {t("modals.hints.skip")}
        </button>
        {isLast ? (
          <button
            onClick={dismiss}
            className="text-xs px-3 py-1 rounded bg-yel text-on-yel hover:bg-yel2"
          >
            {t("modals.hints.gotIt")}
          </button>
        ) : (
          <button
            onClick={() => setIdx(idx + 1)}
            className="text-xs px-3 py-1 rounded bg-yel text-on-yel hover:bg-yel2"
          >
            {t("modals.hints.nextTip")}
          </button>
        )}
      </div>
    </div>
  );
}
