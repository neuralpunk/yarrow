// Transport layer. Everything above `src/lib/transport/` talks to the
// backend through the `Transport` interface — never through
// `@tauri-apps/api` directly — so the IPC surface stays mockable and
// the call site can stay decoupled from the runtime.

import type { Transport } from "./types";
import { createTauriTransport } from "./tauri";

export type { Transport } from "./types";

let cached: Transport | null = null;

export function getTransport(): Transport {
  if (!cached) cached = createTauriTransport();
  return cached;
}
