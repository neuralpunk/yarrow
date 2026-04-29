// Lazy-loaded English spell-checker built on hunspell-asm + dictionary-en.
// 2.1 (3.0.2): nspell → Hunspell-WASM. The Emscripten-compiled C++ Hunspell
// runtime is more accurate on irregular morphology and ships with a working
// `removeWord` (which nspell did not), so the previously-acknowledged gap
// where removed user words still spell-checked as correct is now closed.
//
// `loadSpell()` resolves once per app load and caches the result; later calls
// hand back the same checker instance. The user's per-workspace dictionary is
// merged in via `addUserWords` and surfaced as a separate "personal" set so
// `removeUserWord` can take a word back out from the live runtime as well.

import { loadModule, type Hunspell } from "hunspell-asm";

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

let checker: Hunspell | null = null;
let loadingPromise: Promise<Hunspell> | null = null;
const userWords = new Set<string>();

export async function loadSpell(): Promise<Hunspell> {
  if (checker) return checker;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const [factory, affRes, dicRes] = await Promise.all([
      loadModule(),
      fetch(affUrl),
      fetch(dicUrl),
    ]);
    const [affBuf, dicBuf] = await Promise.all([
      affRes.arrayBuffer(),
      dicRes.arrayBuffer(),
    ]);
    const affPath = factory.mountBuffer(new Uint8Array(affBuf), "en.aff");
    const dicPath = factory.mountBuffer(new Uint8Array(dicBuf), "en.dic");
    const h = factory.create(affPath, dicPath);
    for (const w of userWords) h.addWord(w);
    checker = h;
    return h;
  })();
  return loadingPromise;
}

// Result memoisation: hunspell does affix matching on every call, which is
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
    ok = checker.spell(word);
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
    checker?.addWord(t);
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
  // Hunspell-WASM supports runtime removal — unlike nspell — so the live
  // checker forgets the word immediately, not just on next app load.
  checker?.removeWord(word);
  checker?.removeWord(word.toLowerCase());
  invalidateSpellCache();
}

export function snapshotUserWords(): string[] {
  return [...userWords].sort();
}
