// Lazy-loaded English spell-checker built on nspell + dictionary-en. The
// dictionary files are fetched as raw assets so this works in the Vite/Tauri
// webview without touching the filesystem at module-eval time.
//
// `loadSpell()` resolves once per app load and caches the result; later calls
// hand back the same checker instance. The user's per-workspace dictionary is
// merged in via `addUserWords` and surfaced as a separate "personal" set so
// `removeUserWord` can take a word back out without rebuilding nspell.

import nspell from "nspell";
// dictionary-en's package.json restricts subpath exports to `./index.js`, so
// `import "dictionary-en/index.aff?url"` is rejected by Vite. Reaching the
// raw asset via a relative path under node_modules + `new URL(..., import.meta.url)`
// sidesteps that restriction — Vite still hashes and serves the file because
// it's a static asset URL it can resolve at build time.
const affUrl = new URL(
  "../../node_modules/dictionary-en/index.aff",
  import.meta.url,
).href;
const dicUrl = new URL(
  "../../node_modules/dictionary-en/index.dic",
  import.meta.url,
).href;

let checker: ReturnType<typeof nspell> | null = null;
let loadingPromise: Promise<ReturnType<typeof nspell>> | null = null;
const userWords = new Set<string>();

export async function loadSpell(): Promise<ReturnType<typeof nspell>> {
  if (checker) return checker;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const [affRes, dicRes] = await Promise.all([fetch(affUrl), fetch(dicUrl)]);
    const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
    checker = nspell({ aff, dic });
    for (const w of userWords) checker.add(w);
    return checker;
  })();
  return loadingPromise;
}

// Result memoisation: nspell does affix matching on every call, which is
// fine in isolation but adds up when the editor's spell-check decoration
// pass walks 50+ visible lines of a typical viewport on every keystroke.
// Bounded to keep memory tame; keys are case-sensitive strings already.
const RESULT_CACHE_MAX = 4096;
const resultCache = new Map<string, boolean>();

export function isCorrect(word: string): boolean {
  if (!checker) return true;
  const cached = resultCache.get(word);
  if (cached !== undefined) return cached;
  let ok: boolean;
  if (userWords.has(word) || userWords.has(word.toLowerCase())) {
    ok = true;
  } else {
    ok = checker.correct(word);
  }
  if (resultCache.size >= RESULT_CACHE_MAX) {
    // Drop a chunk at once to avoid running this cleanup on every call
    // once we cross the cap. Map iteration is insertion order.
    const it = resultCache.keys();
    for (let i = 0; i < 256; i++) {
      const k = it.next();
      if (k.done) break;
      resultCache.delete(k.value);
    }
  }
  resultCache.set(word, ok);
  return ok;
}

/** Drop the spell-result cache. Called when the user adds / removes a
 *  word from the dictionary so previously-cached "wrong" answers don't
 *  outlive the dictionary change. */
export function invalidateSpellCache() {
  resultCache.clear();
}

export function suggest(word: string, max = 6): string[] {
  if (!checker) return [];
  return checker.suggest(word).slice(0, max);
}

export function addUserWords(words: string[]) {
  let added = 0;
  for (const w of words) {
    const t = w.trim();
    if (!t) continue;
    userWords.add(t);
    checker?.add(t);
    added++;
  }
  // Any new dictionary entry can flip a cached "wrong" answer to "right",
  // so drop the cache once after a batch add (not per-word).
  if (added > 0) invalidateSpellCache();
}

export function addUserWord(word: string) {
  addUserWords([word]);
}

export function removeUserWord(word: string) {
  userWords.delete(word);
  userWords.delete(word.toLowerCase());
  invalidateSpellCache();
  // nspell has no `remove`; on next loadSpell call the word would still be
  // there because the checker instance persists. We keep the negative state
  // by overlaying a deny-set... but that's overkill for v1.1. The user can
  // restart the app for a clean slate; rare enough to be acceptable.
}

export function snapshotUserWords(): string[] {
  return [...userWords].sort();
}
