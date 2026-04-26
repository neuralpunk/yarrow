import { useEffect, useRef, useState } from "react";
import { api } from "../lib/tauri";
import type { Note } from "../lib/types";
import Modal from "./Modal";
import { useT } from "../lib/i18n";
import type { StringKey } from "../lib/i18n";

// 2.2.0 — Recipe URL clipper modal.
//
// User flow:
//   1. Paste a recipe URL.
//   2. Click "Clip recipe."
//   3. Backend fetches the page, extracts schema.org Recipe JSON-LD
//      (or microdata as a fallback), and creates a populated note.
//   4. Modal closes; AppShell navigates to the new note.
//
// Errors are friendly. Instead of dumping the raw backend message —
// which has stack-trace flavour — we sort the error into one of five
// categories and show a hand-drawn illustration with plain-English
// copy. The original message stays in the dev console for debugging
// (via the toast / stderr fallback) but never surfaces here.

interface Props {
  open: boolean;
  onClose: () => void;
  onClipped: (note: Note) => void;
}

// ── Error classification ───────────────────────────────────────
//
// Categorise by string-matching the backend's message. Order
// matters — Cloudflare comes before "couldn't reach" because the
// Cloudflare branch is more specific. Anything we don't recognise
// falls through to "unknown".
type ErrorKind = "bad-url" | "no-network" | "blocked" | "no-recipe" | "unknown";

function categorise(msg: string): ErrorKind {
  const m = msg.toLowerCase();
  if (m.includes("cloudflare") || m.includes("bot protection")) return "blocked";
  if (
    m.includes("not a valid url")
    || m.includes("only http(s)")
    || m.includes("redirect to non-http")
    || m.includes("malformed redirect")
    || m.includes("private / loopback")
    || m.includes("private host")
  ) return "bad-url";
  if (m.includes("no recipe metadata")) return "no-recipe";
  if (
    m.includes("fetch failed")
    || m.includes("couldn't decode")
    || m.includes("too many redirects")
    || m.includes("redirect with no location")
    || m.includes("server returned http")
    || m.includes("client init failed")
  ) return "no-network";
  return "unknown";
}

interface ErrorPresentation {
  illustration: React.ReactNode;
  titleKey: StringKey;
  bodyKey: StringKey;
  /** When set, the action button under the body says this; clicking
   *  it clears the error so the user can edit the URL and try again. */
  actionKey: StringKey;
}

function presentationFor(kind: ErrorKind): ErrorPresentation {
  switch (kind) {
    case "bad-url":
      return {
        illustration: <BadUrlIllustration />,
        titleKey: "modals.recipeClip.err.badUrl.title",
        bodyKey: "modals.recipeClip.err.badUrl.body",
        actionKey: "modals.recipeClip.err.tryAgain",
      };
    case "no-network":
      return {
        illustration: <NoNetworkIllustration />,
        titleKey: "modals.recipeClip.err.noNetwork.title",
        bodyKey: "modals.recipeClip.err.noNetwork.body",
        actionKey: "modals.recipeClip.err.tryAgain",
      };
    case "blocked":
      return {
        illustration: <BlockedIllustration />,
        titleKey: "modals.recipeClip.err.blocked.title",
        bodyKey: "modals.recipeClip.err.blocked.body",
        actionKey: "modals.recipeClip.err.tryDifferent",
      };
    case "no-recipe":
      return {
        illustration: <NoRecipeIllustration />,
        titleKey: "modals.recipeClip.err.noRecipe.title",
        bodyKey: "modals.recipeClip.err.noRecipe.body",
        actionKey: "modals.recipeClip.err.tryDifferent",
      };
    case "unknown":
    default:
      return {
        illustration: <UnknownIllustration />,
        titleKey: "modals.recipeClip.err.unknown.title",
        bodyKey: "modals.recipeClip.err.unknown.body",
        actionKey: "modals.recipeClip.err.tryAgain",
      };
  }
}

export default function RecipeClipperModal({ open, onClose, onClipped }: Props) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setError(null);
    setBusy(false);
    // Focus the input on open so the user can paste immediately.
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const note = await api.clipRecipe(trimmed);
      onClipped(note);
      onClose();
    } catch (e) {
      setError(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  const errorKind = error ? categorise(error) : null;
  const presentation = errorKind ? presentationFor(errorKind) : null;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={t("modals.recipeClip.title")}
      width="w-[520px]"
    >
      {!presentation && (
        <p className="text-sm text-t2 mb-4 leading-relaxed">
          {t("modals.recipeClip.body")}
        </p>
      )}

      <label className="block text-2xs uppercase tracking-wider text-t3 mb-1.5">
        {t("modals.recipeClip.urlLabel")}
      </label>
      <input
        ref={inputRef}
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          // Clear the error when the user starts editing — keeps the
          // illustration around long enough to read but doesn't argue
          // with their next attempt.
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="https://www.kingarthurbaking.com/recipes/…"
        disabled={busy}
        className="w-full px-3 py-2 text-sm bg-bg border border-bd2 rounded-md font-mono text-char focus:outline-none focus:border-yel disabled:opacity-60"
      />

      {presentation ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 px-5 py-5 bg-yelp/30 border border-yel/30 rounded-lg flex flex-col items-center text-center"
        >
          <span className="block w-[88px] h-[88px] text-yeld mb-3" aria-hidden="true">
            {presentation.illustration}
          </span>
          <h3 className="font-serif text-[20px] leading-tight text-char mb-2">
            {t(presentation.titleKey)}
          </h3>
          <p className="text-sm text-t2 leading-relaxed max-w-[400px] mb-4">
            {t(presentation.bodyKey)}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-bd2 text-char hover:border-yel hover:bg-yelp transition"
          >
            {t(presentation.actionKey)}
          </button>
        </div>
      ) : (
        <p className="text-2xs text-t3 mt-2 leading-relaxed">
          {t("modals.recipeClip.privacy")}
        </p>
      )}

      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-bd">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="px-3 py-1.5 text-sm text-t2 hover:text-char disabled:opacity-60"
        >
          {t("modals.recipeClip.cancel")}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !url.trim()}
          className="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-60"
        >
          {busy ? t("modals.recipeClip.clipping") : t("modals.recipeClip.confirm")}
        </button>
      </div>
    </Modal>
  );
}

// ────────────── Illustrations ──────────────
//
// Hand-drawn-feel SVGs. Stroke-only, slightly imperfect curves,
// rounded caps. They use `currentColor` so they pick up the parent's
// `text-yeld` and adapt to every theme. Sized at 88×88 with viewBox
// 100×100, so they sit comfortably above the headline.

const drawProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function BadUrlIllustration() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" {...drawProps}>
      {/* a piece of paper, slightly tilted, with a folded corner */}
      <path d="M24 16 q-2 0 -2 3 L23 84 q0 3 3 3 L73 84 q3 0 3 -3 L74 30 L60 14 Z" />
      <path d="M60 14 L60 28 q0 2 2 2 L74 30" />
      {/* a hand-drawn question mark on the page */}
      <path d="M40 46 q0 -10 10 -10 q10 0 10 9 q0 6 -6 9 q-3 1 -3 5 L51 62" />
      <circle cx="51" cy="69" r="1.6" fill="currentColor" />
    </svg>
  );
}

function NoNetworkIllustration() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" {...drawProps}>
      {/* two unplugged ends of a cord, with little spark dots between */}
      {/* left plug */}
      <path d="M14 50 q0 -5 6 -5 L34 45 q4 0 4 4 L38 51 q0 4 -4 4 L20 55 q-6 0 -6 -5 Z" />
      <line x1="38" y1="48" x2="42" y2="48" />
      <line x1="38" y1="52" x2="42" y2="52" />
      {/* right plug */}
      <path d="M86 50 q0 -5 -6 -5 L66 45 q-4 0 -4 4 L62 51 q0 4 4 4 L80 55 q6 0 6 -5 Z" />
      <line x1="62" y1="48" x2="58" y2="48" />
      <line x1="62" y1="52" x2="58" y2="52" />
      {/* spark dots in the gap */}
      <circle cx="48" cy="50" r="1" fill="currentColor" />
      <circle cx="52" cy="48" r="1" fill="currentColor" />
      <circle cx="50" cy="52" r="1" fill="currentColor" />
      {/* curly-cord whisp on each side, like the cord is dangling */}
      <path d="M14 50 q-6 4 -2 10 q4 6 -2 10" />
      <path d="M86 50 q6 4 2 10 q-4 6 2 10" />
    </svg>
  );
}

function BlockedIllustration() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" {...drawProps}>
      {/* a soft shield silhouette */}
      <path d="M50 14 q-2 0 -3 1 q-10 5 -22 6 q-2 0 -2 2 q0 28 25 60 q1 1 2 1 q1 0 2 -1 q25 -32 25 -60 q0 -2 -2 -2 q-12 -1 -22 -6 q-1 -1 -3 -1 Z" />
      {/* a friendly little keyhole inside, not aggressive */}
      <circle cx="50" cy="44" r="5" />
      <line x1="50" y1="49" x2="50" y2="58" />
    </svg>
  );
}

function NoRecipeIllustration() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" {...drawProps}>
      {/* an empty plate seen at an angle (two ellipses stacked), with a fork
          and knife in front and a tiny question mark hovering above */}
      <ellipse cx="50" cy="62" rx="32" ry="9" />
      <ellipse cx="50" cy="60" rx="24" ry="6" />
      {/* fork on the left */}
      <line x1="28" y1="76" x2="34" y2="92" />
      <line x1="26" y1="78" x2="32" y2="93" />
      <line x1="30" y1="74" x2="36" y2="91" />
      {/* knife on the right */}
      <path d="M70 75 L74 92" />
      <path d="M68 76 q1 -2 4 -2 q3 0 4 2 L74 92" />
      {/* a hand-drawn question mark above the plate */}
      <path d="M44 32 q0 -8 7 -8 q7 0 7 7 q0 5 -5 7 q-2 1 -2 4" />
      <circle cx="51" cy="48" r="1.4" fill="currentColor" />
    </svg>
  );
}

function UnknownIllustration() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" {...drawProps}>
      {/* a teacup with the steam curling into question-mark shapes —
          warm rather than alarming */}
      {/* cup body */}
      <path d="M28 52 L70 52 L66 84 q-1 4 -5 4 L33 88 q-4 0 -5 -4 Z" />
      {/* saucer */}
      <ellipse cx="49" cy="90" rx="28" ry="2.5" />
      {/* handle */}
      <path d="M70 58 q12 0 12 10 q0 10 -12 10" />
      {/* steam curls — soft S-shapes leaning right */}
      <path d="M40 42 q4 -6 0 -10 q-4 -6 0 -12" />
      <path d="M50 38 q5 -5 0 -10 q-5 -5 0 -10" />
      <path d="M60 42 q4 -6 0 -10 q-4 -6 0 -12" />
    </svg>
  );
}
