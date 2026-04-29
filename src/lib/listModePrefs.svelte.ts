// Note-list view mode (Svelte 5 port): list (sidebar default) vs cards
// (gridded index-card style introduced in 2.1). localStorage-backed
// and reactive via a custom event so the toggle anywhere in the app
// keeps every open NoteList in sync.

import {
  workspaceScope,
  readScoped,
  wsKey,
  writeScoped,
} from "./workspaceScope.svelte";

export type ListModeId = "list" | "cards";

const KEY = "yarrow.listMode";
const EVT = "yarrow:listMode-changed";
const DEFAULT: ListModeId = "list";

function read(): ListModeId {
  const raw = readScoped(KEY);
  if (raw === "cards" || raw === "list") return raw;
  return DEFAULT;
}

class ListModeStore {
  id = $state<ListModeId>(read());

  constructor() {
    $effect.root(() => {
      $effect(() => {
        void workspaceScope.scope;
        const next = read();
        if (next !== this.id) this.id = next;
      });
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<ListModeId>).detail;
        if (next === "list" || next === "cards") {
          if (this.id !== next) this.id = next;
        } else {
          const fresh = read();
          if (fresh !== this.id) this.id = fresh;
        }
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY || e.key === wsKey(KEY)) {
          const fresh = read();
          if (fresh !== this.id) this.id = fresh;
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

  set(next: ListModeId) {
    if (this.id === next) return;
    writeScoped(KEY, next);
    try { localStorage.setItem(KEY, next); } catch { /* quota */ }
    this.id = next;
    window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
  }
}

export const listMode = new ListModeStore();
