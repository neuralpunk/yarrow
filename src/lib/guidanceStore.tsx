// Guidance store — a tiny React context holding:
//   • whether guided mode is on (default ON, toggle in Settings)
//   • per-key "seen" counts with localStorage persistence
//   • the currently-active modal (if any)
//
// Components call `useGuidance()` to read/trigger/dismiss. A modal is only
// shown when guided mode is on AND the key hasn't already exhausted its
// `maxShows`. Coach cards ignore the active-modal machinery and instead
// use `enabled` + `hasSeenPermanent` to decide if they should render.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GUIDANCE, type GuidanceDef, type GuidanceKey } from "./guidance";

const STORAGE_KEY = "yarrow.guidance.v1";

interface SeenEntry {
  count: number;
  dismissed: boolean;
  lastAt: number;
}
interface PersistedState {
  enabled: boolean;
  seen: Record<string, SeenEntry>;
}

const DEFAULT_STATE: PersistedState = { enabled: true, seen: {} };

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
      seen: parsed.seen ?? {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(s: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

interface ContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** Currently-showing modal, or null. */
  activeKey: GuidanceKey | null;
  active: GuidanceDef | null;
  /** Ask to show a guidance key as a modal. No-op if already shown enough
   *  or if guided mode is off. Safe to call many times. */
  trigger: (key: GuidanceKey, opts?: { onPrimary?: () => void; onSecondary?: () => void }) => void;
  /** Hide the active modal. Counts as a "seen". */
  dismiss: () => void;
  /** True if this key's modal would NOT be shown again (hit max or dismissed). */
  hasReached: (key: GuidanceKey) => boolean;
  /** Force-mark a key as seen without showing. Useful for "opt out here". */
  markSeen: (key: GuidanceKey) => void;
  /** Reset everything to pristine — user hit "show me again". */
  reset: () => void;
}

const Ctx = createContext<ContextValue | null>(null);

export function GuidanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadState);
  const [activeKey, setActiveKey] = useState<GuidanceKey | null>(null);
  const overrideActions = useRef<{ onPrimary?: () => void; onSecondary?: () => void } | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const setEnabled = useCallback((v: boolean) => {
    setState((s) => ({ ...s, enabled: v }));
    if (!v) setActiveKey(null); // hide any open modal when guidance is disabled
  }, []);

  // By design, guidance re-fires every single time the user triggers it.
  // The only way to silence a specific key is to click "Don't show this
  // again" in that modal (sets `dismissed: true`), or to toggle guided mode
  // off entirely under Settings → Guidance. The `maxShows` field remains
  // on the def for rare cases where a key truly should cap itself; if
  // omitted (the default for every v1 entry), it's treated as Infinity.
  const hasReached = useCallback(
    (key: GuidanceKey) => {
      const def = GUIDANCE[key];
      if (!def) return true;
      const entry = state.seen[key];
      if (!entry) return false;
      if (entry.dismissed) return true;
      if (def.maxShows === undefined) return false;
      return entry.count >= def.maxShows;
    },
    [state.seen],
  );

  const trigger = useCallback(
    (key: GuidanceKey, opts?: { onPrimary?: () => void; onSecondary?: () => void }) => {
      if (!state.enabled) return;
      const def = GUIDANCE[key];
      if (!def || def.surface !== "modal") return;
      if (hasReached(key)) return;
      overrideActions.current = opts ?? null;
      setActiveKey(key);
    },
    [state.enabled, hasReached],
  );

  const bumpSeen = useCallback((key: GuidanceKey) => {
    setState((s) => {
      const prev = s.seen[key];
      return {
        ...s,
        seen: {
          ...s.seen,
          [key]: {
            count: (prev?.count ?? 0) + 1,
            dismissed: false,
            lastAt: Date.now(),
          },
        },
      };
    });
  }, []);

  const dismiss = useCallback(() => {
    if (activeKey) bumpSeen(activeKey);
    overrideActions.current = null;
    setActiveKey(null);
  }, [activeKey, bumpSeen]);

  const markSeen = useCallback(
    (key: GuidanceKey) => {
      setState((s) => ({
        ...s,
        seen: {
          ...s.seen,
          [key]: {
            count: Math.max(s.seen[key]?.count ?? 0, GUIDANCE[key]?.maxShows ?? 1),
            dismissed: true,
            lastAt: Date.now(),
          },
        },
      }));
      if (activeKey === key) setActiveKey(null);
    },
    [activeKey],
  );

  // Preserves the user's enabled/disabled choice. "Reset" means "clear my
  // per-modal opt-outs so every modal fires again" — it should never
  // flip guided mode back on behind the user's back.
  const reset = useCallback(() => {
    setState((s) => ({ enabled: s.enabled, seen: {} }));
    setActiveKey(null);
  }, []);

  const active = useMemo(() => (activeKey ? GUIDANCE[activeKey] ?? null : null), [activeKey]);

  // Expose the override-actions pointer so the host component can wire
  // custom primary/secondary handlers from the call site.
  const value = useMemo<ContextValue & { _overrideActions: typeof overrideActions }>(
    () => ({
      enabled: state.enabled,
      setEnabled,
      activeKey,
      active,
      trigger,
      dismiss,
      hasReached,
      markSeen,
      reset,
      _overrideActions: overrideActions,
    }),
    [state.enabled, setEnabled, activeKey, active, trigger, dismiss, hasReached, markSeen, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGuidance() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGuidance must be used inside <GuidanceProvider>");
  return v;
}

/** Returns the per-call override actions that the site that triggered this
 *  modal passed in, if any. Only meaningful inside the guidance host. */
export function useGuidanceOverrideActions() {
  const v = useContext(Ctx) as (ContextValue & { _overrideActions: React.MutableRefObject<{ onPrimary?: () => void; onSecondary?: () => void } | null> }) | null;
  return v?._overrideActions.current ?? null;
}
