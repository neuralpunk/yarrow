import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Transport } from "./types";

export function createTauriTransport(): Transport {
  return {
    invoke: (command, args) => invoke(command, args) as Promise<never>,
    subscribe(channel, handler) {
      let unlisten: (() => void) | null = null;
      let cancelled = false;
      listen(channel, (event) => handler(event.payload as never)).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
      return () => {
        cancelled = true;
        if (unlisten) unlisten();
      };
    },
  };
}
