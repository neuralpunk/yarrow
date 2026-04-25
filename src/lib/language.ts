import { useEffect, useState } from "react";

// UI language. The selector in Settings → Appearance and the language
// picker on the Onboarding screen both write through `useLanguage()`.
// Add a new entry here AND ship a translation table for it in `i18n.ts`
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

// Tiny pub/sub so every `useLanguage()` caller stays in sync. Without
// this, calling `setLang` from the Onboarding picker would only update
// the picker's own state — Settings, the status bar, and any other
// translated surface would still read the previous value until React
// re-mounted them. localStorage persists across windows but doesn't
// broadcast within the current one, so we layer a custom event on top.
type Subscriber = (next: LanguageCode) => void;
const subscribers = new Set<Subscriber>();

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

/** Read the current language without subscribing. Useful for
 *  non-component contexts (event handlers, side modules) that want to
 *  format a string once. */
export function currentLanguage(): LanguageCode {
  return readStored();
}

export function useLanguage() {
  const [lang, setLangLocal] = useState<LanguageCode>(readStored);

  useEffect(() => {
    const sub: Subscriber = (next) => setLangLocal(next);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const setLang = (next: LanguageCode) => {
    if (!isLanguageCode(next)) return;
    writeStored(next);
    // Notify every subscriber (including this hook's own — React will
    // bail on the redundant setState since the value matches).
    for (const s of subscribers) s(next);
  };

  return { lang, setLang };
}
