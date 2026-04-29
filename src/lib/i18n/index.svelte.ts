import { language, type LanguageCode } from "../language.svelte";

// Surface modules. Each module owns its own keys and ships EN / ES /
// SV tables. We re-export them from this index in three merged
// objects so consumers can call `t()` (or read `i18n.t`) against the
// union of all keys without knowing which surface a particular string
// belongs to.
//
// To add a new surface, drop a file into `./strings/<name>.ts` that
// follows the established shape (`<name>EN` / `<name>ES` / `<name>SV`
// triple, EN as `as const`, ES + SV typed against `keyof typeof`),
// then add the import + spread on every table below. TypeScript will
// catch a missing locale at the spread site — the merged-table types
// must agree across all three locales.
import { commonEN, commonES, commonSV } from "./strings/common";
import {
  onboardingEN,
  onboardingES,
  onboardingSV,
} from "./strings/onboarding";
import {
  appearanceEN,
  appearanceES,
  appearanceSV,
} from "./strings/appearance";
import { appshellEN, appshellES, appshellSV } from "./strings/appshell";
import { settingsEN, settingsES, settingsSV } from "./strings/settings";
import { editorEN, editorES, editorSV } from "./strings/editor";
import { sidebarEN, sidebarES, sidebarSV } from "./strings/sidebar";
import { pathsEN, pathsES, pathsSV } from "./strings/paths";
import { modalsEN, modalsES, modalsSV } from "./strings/modals";
import { wizardEN, wizardES, wizardSV } from "./strings/wizard";

const STRINGS_EN = {
  ...commonEN,
  ...onboardingEN,
  ...appearanceEN,
  ...appshellEN,
  ...settingsEN,
  ...editorEN,
  ...sidebarEN,
  ...pathsEN,
  ...modalsEN,
  ...wizardEN,
} as const;

export type StringKey = keyof typeof STRINGS_EN;

const STRINGS_ES: Record<StringKey, string> = {
  ...commonES,
  ...onboardingES,
  ...appearanceES,
  ...appshellES,
  ...settingsES,
  ...editorES,
  ...sidebarES,
  ...pathsES,
  ...modalsES,
  ...wizardES,
};

const STRINGS_SV: Record<StringKey, string> = {
  ...commonSV,
  ...onboardingSV,
  ...appearanceSV,
  ...appshellSV,
  ...settingsSV,
  ...editorSV,
  ...sidebarSV,
  ...pathsSV,
  ...modalsSV,
  ...wizardSV,
};

const TABLES: Record<LanguageCode, Record<StringKey, string>> = {
  en: STRINGS_EN,
  es: STRINGS_ES,
  sv: STRINGS_SV,
};

/** Look up a translated string. Falls back to English when the locale
 *  is missing the key — partial bundles still render usable UI. */
export function t(
  key: StringKey,
  lang: LanguageCode,
  vars?: Record<string, string>,
): string {
  const table = TABLES[lang] ?? STRINGS_EN;
  let v = table[key] ?? STRINGS_EN[key] ?? key;
  if (vars) {
    for (const [k, val] of Object.entries(vars)) {
      v = v.split(`{${k}}`).join(val);
    }
  }
  return v;
}

/** Reactive translator. Reads `language.lang` so consuming Svelte
 *  components rerun when the user switches locale. Use as
 *  `tr()(key, vars)` from a `<script>` block, or `tr()(key)` inline.
 *  The double-call shape mirrors the legacy `useT()` so the call sites
 *  stay terse. */
export function tr() {
  const lang = language.lang;
  return (key: StringKey, vars?: Record<string, string>) =>
    t(key, lang, vars);
}
