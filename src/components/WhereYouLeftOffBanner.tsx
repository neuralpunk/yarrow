import { relativeBanner, type LeftOffState } from "../lib/leftOff";

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
  const path = state.path || "main";
  return (
    <div className="yarrow-wilo-banner" role="status" aria-live="polite">
      <div className="l1">welcome back · {relativeBanner(state.at)}</div>
      <div className="l2">
        You paused in <em>{state.title}</em> on the <em>{path}</em> path
      </div>
      {state.snippet ? <div className="l3">“{state.snippet}”</div> : null}
      <div className="actions">
        <button
          onClick={onResume}
          className="px-3 py-1 text-xs rounded-md bg-yel text-on-yel hover:opacity-95"
        >
          pick up here →
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1 text-xs rounded-md bg-bg border border-bd text-t2 hover:text-char hover:border-bd2"
        >
          start somewhere else
        </button>
        <button
          onClick={onHideAlways}
          className="hide px-2 py-1 text-2xs rounded-md hover:text-t2"
          title="Never show this banner again for this workspace"
        >
          hide next time
        </button>
      </div>
    </div>
  );
}
