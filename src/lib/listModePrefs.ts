// Note-list view mode: list (the default sidebar style) vs cards (a
// gridded index-card style introduced in 2.1). localStorage-backed and
// reactive via a custom event so the toggle anywhere in the app keeps
// every open NoteList in sync.

import { useCallback, useEffect, useState } from "react";

export type ListModeId = "list" | "cards";

const KEY = "yarrow.listMode";
const EVT = "yarrow:listMode-changed";
const DEFAULT: ListModeId = "list";

function read(): ListModeId {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "cards" || raw === "list") return raw;
  } catch {}
  return DEFAULT;
}

export function useListMode(): [ListModeId, (id: ListModeId) => void] {
  const [id, setId] = useState<ListModeId>(read);
  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<ListModeId>).detail;
      if (next === "list" || next === "cards") setId(next);
      else setId(read());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setId(read());
    };
    window.addEventListener(EVT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const set = useCallback((next: ListModeId) => {
    try { localStorage.setItem(KEY, next); } catch {}
    setId(next);
    window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
  }, []);
  return [id, set];
}
