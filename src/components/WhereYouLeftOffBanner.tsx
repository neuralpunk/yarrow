import { relativeBanner, type LeftOffState } from "../lib/leftOff";
import { useT } from "../lib/i18n";

interface Props {
  state: LeftOffState;
  onResume: () => void;
  onDismiss: () => void;
  onHideAlways: () => void;
}

/**
 * One-line welcome-back banner shown once per workspace-open when a fresh
 * (<72h) bookmark exists. Three actions: pick up where you left off,
 * dismiss for this session, or never again. See `lib/leftOff.ts` for the
 * persistence shape.
 */
export default function WhereYouLeftOffBanner({
  state,
  onResume,
  onDismiss,
  onHideAlways,
}: Props) {
  const t = useT();
  const path = state.path || "main";
  return (
    <div className="yarrow-wilo-banner" role="status" aria-live="polite">
      <div className="l1">{t("modals.leftOff.welcome", { when: relativeBanner(state.at) })}</div>
      <div className="l2">
        {t("modals.leftOff.pausedIn")} <em>{state.title}</em> {t("modals.leftOff.onPath")} <em>{path}</em> {t("modals.leftOff.pathSuffix")}
      </div>
      {state.snippet ? <div className="l3">“{state.snippet}”</div> : null}
      <div className="actions">
        <button
          onClick={onResume}
          className="px-3 py-1 text-xs rounded-md bg-yel text-on-yel hover:opacity-95"
        >
          {t("modals.leftOff.pickUp")}
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1 text-xs rounded-md bg-bg border border-bd text-t2 hover:text-char hover:border-bd2"
        >
          {t("modals.leftOff.startElsewhere")}
        </button>
        <button
          onClick={onHideAlways}
          className="hide px-2 py-1 text-2xs rounded-md hover:text-t2"
          title={t("modals.leftOff.hideTitle")}
        >
          {t("modals.leftOff.hideNext")}
        </button>
      </div>
    </div>
  );
}
