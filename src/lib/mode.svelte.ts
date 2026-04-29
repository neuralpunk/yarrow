// Mode/Persona store (Svelte 5 port of useMode).
//
// Stored in localStorage under `yarrow.mode` (or `yarrow.mode:<ws>`
// when a workspace is active — see workspaceScope.svelte.ts for why).
// A `yarrow:mode-changed` window event broadcasts updates so any
// subscriber in the tree resyncs without prop-drilling. Cross-tab
// updates ride the native `storage` event.

import {
  DEFAULT_MODE,
  MODES,
  isModeId,
  type ModeConfig,
  type ModeId,
} from "./modes";
import {
  workspaceScope,
  readScoped,
  wsKey,
  writeScoped,
} from "./workspaceScope.svelte";

const KEY = "yarrow.mode";
const EVT = "yarrow:mode-changed";

function readStored(): ModeId {
  const v = readScoped(KEY);
  return isModeId(v) ? v : DEFAULT_MODE;
}

class ModeStore {
  id = $state<ModeId>(readStored());

  constructor() {
    $effect.root(() => {
      // Re-read on workspace switch — every notebook keeps its own
      // mode bias.
      $effect(() => {
        void workspaceScope.scope;
        const next = readStored();
        if (next !== this.id) this.id = next;
      });

      const onChange = (e: Event) => {
        const next = (e as CustomEvent<ModeId>).detail;
        if (isModeId(next) && next !== this.id) this.id = next;
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY || e.key === wsKey(KEY)) {
          const next = readStored();
          if (next !== this.id) this.id = next;
        }
      };
      window.addEventListener(EVT, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(EVT, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  get config(): ModeConfig {
    return MODES[this.id];
  }

  set(next: ModeId) {
    if (this.id === next) return;
    writeScoped(KEY, next);
    // Mirror the latest choice to the global key so a fresh workspace
    // (no scoped value yet) inherits the user's most recent persona
    // preference instead of always landing on Path-Based.
    try { localStorage.setItem(KEY, next); } catch { /* quota */ }
    this.id = next;
    window.dispatchEvent(new CustomEvent<ModeId>(EVT, { detail: next }));
  }
}

export const mode = new ModeStore();
