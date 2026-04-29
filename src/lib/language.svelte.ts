// UI language store (Svelte 5 port).
// The selector in Settings → Appearance and the language picker on the
// Onboarding screen both write through `language.set(...)`. Add a new
// entry here AND ship a translation table for it in `i18n/strings/`
// before listing it — the lookup falls back to English for any key the
// table happens to miss, but the language tile would otherwise pretend
// to switch the UI without ever changing it.

export type LanguageCode = "en" | "es" | "sv";

export interface LanguageOption {
  id: LanguageCode;
  /** Displayed in the selector. Use the endonym so a speaker can
   *  recognise their own language without already reading English. */
  label: string;
  /** Short note rendered in the Settings picker — gives the variant
   *  (e.g. "Latin American Spanish") so a user from Spain or Brazil
   *  understands what they're picking. */
  note?: string;
}

export const LANGUAGE_ORDER: LanguageOption[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español", note: "Latinoamericano" },
  { id: "sv", label: "Svenska" },
];

const KEY = "yarrow.language";
const DEFAULT_LANG: LanguageCode = "en";

function isLanguageCode(v: unknown): v is LanguageCode {
  return LANGUAGE_ORDER.some((l) => l.id === v);
}

function readStored(): LanguageCode {
  try {
    const raw = localStorage.getItem(KEY);
    return isLanguageCode(raw) ? (raw as LanguageCode) : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function writeStored(lang: LanguageCode) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private browsing / storage disabled — preference lives in
       memory only for this session, which is a fine fallback. */
  }
}

class LanguageStore {
  lang = $state<LanguageCode>(readStored());

  set(next: LanguageCode) {
    if (!isLanguageCode(next)) return;
    if (this.lang === next) return;
    writeStored(next);
    this.lang = next;
  }
}

export const language = new LanguageStore();

/** Read the current language without subscribing. Useful for
 *  non-component contexts (event handlers, side modules) that want to
 *  format a string once. */
export function currentLanguage(): LanguageCode {
  return language.lang;
}
