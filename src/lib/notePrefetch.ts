import { api } from "./tauri";
import type { Note } from "./types";

// Bounded in-memory LRU cache keyed by slug. Hovering a note in the sidebar
// kicks off a `readNote` early, so when the user clicks the editor swap is
// "free" (no IPC round-trip on the critical path).
//
// A slug invalidates on save/rename/delete/encrypt to keep stale bodies out.
const MAX = 24;
const cache = new Map<string, Promise<Note>>();

function touch(slug: string) {
  const hit = cache.get(slug);
  if (hit === undefined) return;
  // Refresh recency: delete + re-insert.
  cache.delete(slug);
  cache.set(slug, hit);
}

function enforceSize() {
  while (cache.size > MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Fire-and-forget: warm the cache for this slug. Safe to call repeatedly. */
export function prefetchNote(slug: string) {
  if (cache.has(slug)) { touch(slug); return; }
  const p = api.readNote(slug).catch((e) => {
    // Drop failed reads from the cache so a real click retries.
    if (cache.get(slug) === p) cache.delete(slug);
    throw e;
  });
  cache.set(slug, p);
  enforceSize();
}

/** Read a note, using the prefetch cache if available. */
export async function getCachedOrReadNote(slug: string): Promise<Note> {
  const hit = cache.get(slug);
  if (hit) {
    touch(slug);
    return hit;
  }
  const p = api.readNote(slug);
  cache.set(slug, p);
  enforceSize();
  try {
    return await p;
  } catch (e) {
    if (cache.get(slug) === p) cache.delete(slug);
    throw e;
  }
}

/** Drop a slug (call after save/rename/delete/encrypt/decrypt). */
export function invalidateNote(slug: string) {
  cache.delete(slug);
}

export function invalidateAllNotes() {
  cache.clear();
}
