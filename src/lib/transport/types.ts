// The contract every transport must satisfy.
//
// `invoke` runs a named backend operation and returns its result.
// `subscribe` registers a handler for a pushed event channel and
// returns an unsubscribe function. On the Tauri transport this is
// `@tauri-apps/api/event` `listen`; on a future HTTP transport it's a
// WebSocket subscription to `/ws`.

export interface Transport {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  subscribe<T>(channel: string, handler: (event: T) => void): () => void;
}
