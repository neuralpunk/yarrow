import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/tauri";
import type { RecentWorkspace } from "../lib/types";
import { relativeTime } from "../lib/format";
import { YarrowMark } from "./YarrowMark";
import { XIcon } from "../lib/icons";
import { SK } from "../lib/platform";
import { APP_VERSION } from "../lib/version";
import { useLanguage, LANGUAGE_ORDER, type LanguageCode } from "../lib/language";
import { useT } from "../lib/i18n";
import NewWorkspaceWizard from "./NewWorkspaceWizard";

interface Props {
  onReady: (path: string) => void;
}

export default function Onboarding({ onReady }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [openGuideOpen, setOpenGuideOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    api.listRecentWorkspaces().then(setRecent).catch(() => setRecent([]));
  }, []);

  const pickOpen = async () => {
    setError(null);
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (!selected || Array.isArray(selected)) return;
      setBusy(true);
      await api.openWorkspace(selected);
      onReady(selected);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const openRecent = async (path: string) => {
    setError(null);
    setBusy(true);
    try {
      await api.openWorkspace(path);
      onReady(path);
    } catch (e) {
      setError(String(e));
      await api.forgetRecentWorkspace(path).catch(() => {});
      setRecent(await api.listRecentWorkspaces());
    } finally {
      setBusy(false);
    }
  };

  const forget = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await api.forgetRecentWorkspace(path);
    setRecent(await api.listRecentWorkspaces());
  };

  // Seed a starter vault with ~8 connected notes + a second path so the
  // user sees what a populated Map / Paths view looks like on day one.
  // We ask them to pick a parent folder and name the workspace — same
  // flow as a blank workspace but the backend pre-populates notes.
  const tryASample = async () => {
    setError(null);
    try {
      const parent = await openDialog({ directory: true, multiple: false });
      if (!parent || Array.isArray(parent)) return;
      setBusy(true);
      // The backend names the subdir from the provided workspace name, so
      // we pick a sensible default here and let the backend slot it in.
      const rootName = "yarrow-sample";
      const root = await api.createWorkspaceDir(parent, rootName);
      await api.initSampleWorkspace(root, "Sample vault");
      onReady(root);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  // `items-center` on a flex parent that overflows pushes the child's top
  // off the scrollable region (you can't scroll up to reach it). Wrap with
  // an outer scroll container and an inner `min-h-full` flex so the content
  // stays vertically centered when short and scrolls naturally when long.
  return (
    // Light-mode background is pinned to #f4efe2 — the exact off-white
    // of the welcome illustration's paper. Avoids the faint edge line
    // where the image's cream rectangle would otherwise sit against
    // the app's default --bg (#F6F1E6). Dark mode keeps the token
    // so the Plum-and-Graphite palette still drives the surface.
    <div className="h-full overflow-auto bg-bg relative">
      {/* Floating language picker. Lives outside the centred column so
          it sits in the corner regardless of how tall the welcome
          content gets, and so non-English speakers see it before
          reading any English copy. The outer container is `relative`
          so the switcher's `absolute` placement anchors here, not on
          the App-level wrapper that also holds the title bar. */}
      <OnboardingLanguageSwitcher />
      <div className="min-h-full flex items-center justify-center py-10">
      <div className="max-w-xl w-full px-8">
        {/* Hero wordmark — Fraunces large, the same display face we use for
            note titles. Replaces the previous illustration; the user wants
            to revisit that art separately. The mark sprig sits beside the
            wordmark at a size that lets both read at a glance. */}
        <div className="flex flex-col items-center mb-6 select-none">
          <div className="flex items-baseline gap-3 text-char">
            <YarrowMark size={44} className="self-center text-yel shrink-0" />
            <span
              className="font-display text-[88px] leading-none tracking-tight"
              style={{
                fontFamily: "'Fraunces', 'Source Serif 4', 'Newsreader', ui-serif, Georgia, serif",
                fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                fontWeight: 380,
              }}
            >
              Yarrow
            </span>
          </div>
          <span className="mt-1 text-2xs text-t3 font-mono tracking-widest uppercase">
            v{APP_VERSION}
          </span>
        </div>
        <p className="text-t2 text-base mb-8 leading-relaxed text-center">
          {t("onboarding.tagline")}
        </p>

        {recent.length > 0 && (
          <div className="mb-6">
            <div className="text-2xs uppercase tracking-wider text-t3 font-semibold mb-2">
              {t("onboarding.recent")}
            </div>
            <ul className="space-y-1.5">
              {recent.map((r) => (
                <li
                  key={r.path}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-s1 hover:bg-yelp border border-bd hover:border-yel transition ${
                    busy ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  <button
                    onClick={() => openRecent(r.path)}
                    disabled={busy}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                    aria-label={t("onboarding.openLabel", { name: r.name })}
                  >
                    <YarrowMark size={22} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-char font-medium truncate">
                        {r.name}
                      </div>
                      <div className="text-2xs text-t3 font-mono truncate">
                        {r.path}
                      </div>
                    </div>
                    <span className="text-2xs text-t3 font-mono shrink-0">
                      {relativeTime(r.last_opened)}
                    </span>
                  </button>
                  <button
                    onClick={(e) => forget(e, r.path)}
                    className="opacity-0 group-hover:opacity-100 text-t3 hover:text-danger transition shrink-0"
                    title={t("onboarding.removeRecent")}
                    aria-label={t("onboarding.removeRecent")}
                  >
                    <XIcon />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <button
            disabled={busy}
            onClick={() => { setError(null); setWizardOpen(true); }}
            className="w-full px-5 py-3 rounded-lg bg-yel text-on-yel font-medium hover:bg-yel2 transition disabled:opacity-50 text-left group"
          >
            <div className="text-sm font-serif">{t("onboarding.create")}</div>
            <div className="text-xs opacity-80 mt-0.5">
              {t("onboarding.createSub")}
            </div>
          </button>

          <button
            disabled={busy}
            onClick={() => { setError(null); setOpenGuideOpen(true); }}
            className="w-full px-5 py-3 rounded-lg bg-s2 text-char font-medium hover:bg-s3 transition disabled:opacity-50 text-left"
          >
            <div className="text-sm font-serif">{t("onboarding.openOther")}</div>
            <div className="text-xs text-t2 mt-0.5">
              {t("onboarding.openOtherSub")}
            </div>
          </button>

          {recent.length === 0 && (
            <button
              disabled={busy}
              onClick={tryASample}
              className="w-full px-5 py-3 rounded-lg bg-bg border border-bd text-t2 hover:text-char hover:bg-s1 transition disabled:opacity-50 text-left"
            >
              <div className="text-sm font-serif italic">{t("onboarding.sample")}</div>
              <div className="text-xs text-t3 mt-0.5">
                {t("onboarding.sampleSub")}
              </div>
            </button>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        {recent.length === 0 && (
          <div className="mt-10 border-t border-bd pt-6 space-y-3 text-xs text-t2 leading-relaxed">
            <div>
              <span className="text-char font-medium">{t("onboarding.notesAreFiles")}</span>
              {" "}{t("onboarding.notesAreFilesBody")}
            </div>
            <div>
              <span className="text-char font-medium">{t("onboarding.everyChange")}</span>
              {" "}{t("onboarding.everyChangeBody")}
            </div>
            <div>
              <span className="text-char font-medium">{t("onboarding.exploreParallel")}</span>
              {" "}{t("onboarding.exploreParallelBody")}
            </div>
          </div>
        )}

        <p className="mt-8 text-2xs text-t3 font-mono">
          {t("onboarding.tip", { palette: SK.palette, quickSwitch: SK.quickSwitch })}
        </p>
      </div>

      <NewWorkspaceWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onReady={(p) => { setWizardOpen(false); onReady(p); }}
      />
      <OpenFolderGuide
        open={openGuideOpen}
        busy={busy}
        onClose={() => setOpenGuideOpen(false)}
        onBrowse={async () => {
          setOpenGuideOpen(false);
          await pickOpen();
        }}
      />
      </div>
    </div>
  );
}

/**
 * Guided "open an existing workspace" modal. Explains what a Yarrow
 * workspace *is* on disk (a folder with `.yarrow/` config + `notes/`)
 * before popping the OS picker, so first-timers don't get yanked into a
 * raw filesystem dialog with no context.
 */
function OpenFolderGuide({
  open,
  busy,
  onClose,
  onBrowse,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onBrowse: () => void | Promise<void>;
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  // The body string has three inline placeholders we render as styled
  // spans, so we split the translated template on its `{outer}` /
  // `{dotyarrow}` / `{notes}` markers and stitch React nodes back in.
  const outerWord = t("openGuide.outerWord");
  const outerBodyParts = splitWithMarkers(t("openGuide.outerFolderBody"), [
    "{outer}",
    "{dotyarrow}",
    "{notes}",
  ]);
  const hiddenHintParts = splitWithMarkers(t("openGuide.hiddenHint"), [
    "{dotyarrow}",
  ]);
  return (
    <div
      className="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-bd">
          <div className="font-serif text-xl text-char">{t("openGuide.title")}</div>
          <div className="text-2xs text-t3 mt-0.5 leading-relaxed">
            {t("openGuide.subtitle")}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="font-serif italic text-xs text-t3 mb-2">
              {t("openGuide.lookingFor")}
            </div>
            <div className="bg-s1 border border-bd rounded-md px-3 py-3 font-mono text-[11px] text-t2 leading-relaxed">
              <div className="text-char">some-folder-name/</div>
              <div className="pl-4">.yarrow/<span className="text-t3 italic"> ← {t("openGuide.configHint")}</span></div>
              <div className="pl-4">notes/<span className="text-t3 italic"> ← {t("openGuide.notesHint")}</span></div>
              <div className="pl-4">.gitignore</div>
              <div className="pl-4 text-t3 italic">{t("openGuide.gitBookkeeping")}</div>
            </div>
          </div>

          <div className="text-xs text-t2 leading-relaxed space-y-2">
            <div>
              {outerBodyParts.map((part, i) => {
                if (part === "{outer}") {
                  return (
                    <span key={i} className="text-char font-medium">
                      {outerWord}
                    </span>
                  );
                }
                if (part === "{dotyarrow}") {
                  return (
                    <code key={i} className="font-mono text-[11px] bg-s2 px-1 rounded">
                      .yarrow/
                    </code>
                  );
                }
                if (part === "{notes}") {
                  return (
                    <code key={i} className="font-mono text-[11px] bg-s2 px-1 rounded">
                      notes/
                    </code>
                  );
                }
                return <span key={i}>{part}</span>;
              })}
            </div>
            <div className="text-t3 italic">
              {hiddenHintParts.map((part, i) =>
                part === "{dotyarrow}" ? (
                  <code key={i} className="font-mono text-[10px]">
                    .yarrow
                  </code>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-bd flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded bg-s2 text-t2 hover:bg-s3 hover:text-char disabled:opacity-50"
          >
            {t("openGuide.cancel")}
          </button>
          <button
            onClick={onBrowse}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded bg-yel text-on-yel hover:bg-yel2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("openGuide.browse")}
          </button>
        </div>
      </div>
    </div>
  );
}

/// Floating language switcher rendered in the top-right of the
/// onboarding screen. We keep it as a small button + native select so
/// the picker is keyboard-accessible and the OS handles long lists
/// gracefully — this is the same primitive used in form pickers
/// across Yarrow. It lives outside the centred column so the position
/// is independent of the welcome content's height.
function OnboardingLanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const t = useT();
  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
      <label
        htmlFor="onboarding-lang"
        className="text-2xs uppercase tracking-wider text-t3 font-mono"
      >
        {t("onboarding.languagePicker")}
      </label>
      <select
        id="onboarding-lang"
        value={lang}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
        className="text-xs bg-s1 border border-bd hover:border-bd2 rounded-md px-2 py-1 text-char focus:outline-none focus:border-yel"
      >
        {LANGUAGE_ORDER.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
            {l.note ? ` — ${l.note}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

/// Split a template string on a list of literal markers, preserving
/// the markers themselves in the output so callers can render each
/// piece (text vs marker) however they like. Used to mix `<span>` /
/// `<code>` styling into translated body copy without forcing the
/// translator to ship raw HTML in their string.
function splitWithMarkers(s: string, markers: string[]): string[] {
  let parts: string[] = [s];
  for (const m of markers) {
    const next: string[] = [];
    for (const p of parts) {
      const segs = p.split(m);
      for (let i = 0; i < segs.length; i++) {
        if (i > 0) next.push(m);
        next.push(segs[i]);
      }
    }
    parts = next;
  }
  return parts.filter((p) => p !== "");
}

