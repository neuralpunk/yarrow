// Teaching coach strip above the editor. Shown only when the user is ON a
// non-root path and guided mode is enabled — names the path, explains
// what being on one means, and surfaces the verbs that matter (inline
// diff, compare, promote, back to main, throw away). Hidden on the root,
// hidden when guidance is off.

import { useMemo } from "react";
import { useGuidance } from "../../lib/guidanceStore";
import { GUIDANCE } from "../../lib/guidance";
import { colorForPath } from "../../lib/pathAwareness";
import { useT } from "../../lib/i18n";

interface Props {
  pathName: string;
  condition?: string | null;
  rootName: string;
  onSwitchPath: (name: string) => void;
  /** User-assigned accent hex per path (from `PathCollection.color`).
   *  When present for `pathName`, the ribbon uses that. Otherwise it
   *  falls back to the same name-derived hue the rest of the UI uses. */
  pathColorOverrides?: Record<string, string>;
  /** Toggles the inline diff pane for the current note. */
  onToggleInlineDiff?: () => void;
  inlineDiffActive?: boolean;
  /** Opens the full compare modal. */
  onOpenCompare?: () => void;
  /** Promote this path to main (if on a non-root path). */
  onPromote?: () => void;
  /** Throw the current path away (if on a non-root path). */
  onThrowAway?: () => void;
}

export default function PathRibbon({
  pathName,
  condition,
  rootName,
  onSwitchPath,
  pathColorOverrides,
  onToggleInlineDiff,
  inlineDiffActive,
  onOpenCompare,
  onPromote,
  onThrowAway,
}: Props) {
  const { enabled } = useGuidance();
  const def = GUIDANCE["path.stepInto.coach"];
  const t = useT();

  const onPath = !!pathName && pathName !== rootName && pathName !== "main" && pathName !== "master";

  // Use the same colour source as the path pill / caret tint / elsewhere,
  // so every surface that paints this path paints it the same. When the
  // user has assigned a colour in PathsPane, overrides win; otherwise we
  // fall back to the hash-derived plum hue.
  const accent = useMemo(
    () => colorForPath(pathName, { overrides: pathColorOverrides }),
    [pathName, pathColorOverrides],
  );
  const accentSoft = useMemo(
    () => `color-mix(in srgb, ${accent} 12%, transparent)`,
    [accent],
  );

  // Hide the ribbon entirely on the root (no path context to coach) or
  // when guided mode is off.
  if (!onPath || !enabled) return null;

  return (
    <div
      className="flex items-start gap-3 px-4 py-2.5 border-b border-bd animate-fadeIn"
      style={{
        background: `linear-gradient(to right, ${accentSoft}, transparent 55%)`,
        borderLeft: `3px solid ${accent}`,
      }}
      role="status"
      aria-label={t("modals.pathRibbon.aria")}
    >
      <div className="flex-1 min-w-0">
        <div
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-semibold font-sans"
          style={{ color: accent }}
        >
          <span>{def?.eyebrow ?? t("modals.pathRibbon.eyebrowFallback")}</span>
          <span className="text-t3 normal-case tracking-normal font-normal font-serif italic truncate">
            — {pathName}
            {condition ? (
              <>
                {" "}· <span className="not-italic">{condition}</span>
              </>
            ) : null}
          </span>
        </div>
        <div className="text-[12px] font-sans text-ch2 mt-0.5 leading-snug">
          {def?.body ?? t("modals.pathRibbon.bodyFallback")}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
        {onToggleInlineDiff && (
          <button
            onClick={onToggleInlineDiff}
            className={`px-2.5 py-1 rounded text-[11px] font-sans font-medium border transition ${
              inlineDiffActive
                ? "bg-yel/90 text-on-yel border-yel"
                : "border-bd2 bg-bg hover:bg-s2 text-ch2"
            }`}
            title={t("modals.pathRibbon.diffTitle")}
          >
            {inlineDiffActive ? t("modals.pathRibbon.stopDiffing") : t("modals.pathRibbon.diffVsMain")}
          </button>
        )}
        {onOpenCompare && (
          <button
            onClick={onOpenCompare}
            className="px-2.5 py-1 rounded text-[11px] font-sans font-medium border border-bd2 bg-bg hover:bg-s2 text-ch2 transition"
            title={t("modals.pathRibbon.compareAllTitle")}
          >
            {t("modals.pathRibbon.compareAll")}
          </button>
        )}
        {onPromote && (
          <button
            onClick={onPromote}
            className="px-2.5 py-1 rounded text-[11px] font-sans font-medium bg-yel text-on-yel hover:opacity-90 transition"
            title={t("modals.pathRibbon.promoteTitle")}
            style={{ background: accent, color: "white" }}
          >
            {t("modals.pathRibbon.promote")}
          </button>
        )}
        <button
          onClick={() => onSwitchPath(rootName)}
          className="px-2.5 py-1 rounded text-[11px] font-sans font-medium border border-bd2 bg-bg hover:bg-s2 text-ch2 transition"
          title={t("modals.pathRibbon.backToMainTitle")}
        >
          {t("modals.pathRibbon.backToMain")}
        </button>
        {onThrowAway && (
          <button
            onClick={onThrowAway}
            className="px-2.5 py-1 rounded text-[11px] font-sans font-medium border border-bd2 bg-bg text-danger hover:bg-danger/10 transition"
            title={t("modals.pathRibbon.throwAwayTitle")}
          >
            {t("modals.pathRibbon.throwAway")}
          </button>
        )}
      </div>
    </div>
  );
}

