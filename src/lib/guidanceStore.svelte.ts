// Guidance store (Svelte 5 port). A reactive singleton holding:
//   • whether guided mode is on (default ON, toggle in Settings)
//   • per-key "seen" counts with localStorage persistence
//   • the currently-active modal (if any)
//
// Components import `guidance` and read/trigger/dismiss directly. A modal
// is only shown when guided mode is on AND the key hasn't already exhausted
// its `maxShows`. Coach cards ignore the active-modal machinery and instead
// use `enabled` + `hasReached` to decide if they should render.

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
  } catch { /* quota */ }
}

class GuidanceStore {
  state = $state<PersistedState>(loadState());
  activeKey = $state<GuidanceKey | null>(null);
  overrideActions: { onPrimary?: () => void; onSecondary?: () => void } | null = null;

  constructor() {
    $effect.root(() => {
      $effect(() => {
        saveState(this.state);
      });
    });
  }

  get enabled() {
    return this.state.enabled;
  }

  setEnabled(v: boolean) {
    this.state = { ...this.state, enabled: v };
    if (!v) this.activeKey = null;
  }

  get active(): GuidanceDef | null {
    return this.activeKey ? GUIDANCE[this.activeKey] ?? null : null;
  }

  hasReached(key: GuidanceKey): boolean {
    const def = GUIDANCE[key];
    if (!def) return true;
    const entry = this.state.seen[key];
    if (!entry) return false;
    if (entry.dismissed) return true;
    if (def.maxShows === undefined) return false;
    return entry.count >= def.maxShows;
  }

  trigger(
    key: GuidanceKey,
    opts?: { onPrimary?: () => void; onSecondary?: () => void },
  ) {
    if (!this.state.enabled) return;
    const def = GUIDANCE[key];
    if (!def || def.surface !== "modal") return;
    if (this.hasReached(key)) return;
    this.overrideActions = opts ?? null;
    this.activeKey = key;
  }

  #bumpSeen(key: GuidanceKey) {
    const prev = this.state.seen[key];
    this.state = {
      ...this.state,
      seen: {
        ...this.state.seen,
        [key]: {
          count: (prev?.count ?? 0) + 1,
          dismissed: false,
          lastAt: Date.now(),
        },
      },
    };
  }

  dismiss() {
    if (this.activeKey) this.#bumpSeen(this.activeKey);
    this.overrideActions = null;
    this.activeKey = null;
  }

  markSeen(key: GuidanceKey) {
    this.state = {
      ...this.state,
      seen: {
        ...this.state.seen,
        [key]: {
          count: Math.max(this.state.seen[key]?.count ?? 0, GUIDANCE[key]?.maxShows ?? 1),
          dismissed: true,
          lastAt: Date.now(),
        },
      },
    };
    if (this.activeKey === key) this.activeKey = null;
  }

  reset() {
    this.state = { enabled: this.state.enabled, seen: {} };
    this.activeKey = null;
  }
}

export const guidance = new GuidanceStore();
