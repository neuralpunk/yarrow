import { useMemo, useState } from "react";
import { tokenDiff, type TokenOp } from "../lib/lineDiff";
import { useT } from "../lib/i18n";

/**
 * Friendly diff views for the Compare modal.
 *
 * The old view showed unified line-diff text with +/− markers. This
 * module replaces it with five prose-oriented views that read like
 * finished writing, not like CLI output. All views consume the same
 * paragraph-aligned representation built by `diffProse`, so adding a
 * sixth is cheap.
 */

export type CompareDiffView =
  | "summary"
  | "track"
  | "split"
  | "cards"
  | "marginalia";

export const DEFAULT_COMPARE_VIEW: CompareDiffView = "summary";

// Canonical English labels — kept here for layout/sizing references and
// stable persisted-localStorage names. The actual UI labels rendered in
// PathCompare / InlineDiffPane / this module pull translated strings via
// the `paths.cmpdiff.view*` keys.
export const COMPARE_VIEW_LABELS: Record<CompareDiffView, string> = {
  summary:    "Summary",
  track:      "Track changes",
  split:      "Side by side",
  cards:      "Paragraph cards",
  marginalia: "Marginalia",
};

const VIEW_ORDER: CompareDiffView[] = ["summary", "track", "split", "cards", "marginalia"];

export const COMPARE_VIEW_ORDER = VIEW_ORDER;

// ─── shared prose-diff model ────────────────────────────────────────────

type ParaKind = "same" | "edited" | "added" | "removed";

interface ParaChange {
  kind: ParaKind;
  leftIdx?: number;
  rightIdx?: number;
  /** Paragraph text from the left side — present for same / edited / removed. */
  leftText?: string;
  /** Paragraph text from the right side — present for same / edited / added. */
  rightText?: string;
  /** Word-level ops inside an edited paragraph. Unset for same / pure add/remove. */
  ops?: TokenOp[];
  /** When `true`, the word-level diff was too chaotic to render interleaved —
   *  fall back to "was X / now Y" blocks. */
  shrapnel?: boolean;
}

interface ProseDiff {
  paragraphs: ParaChange[];
  stats: {
    wordsAdded: number;
    wordsCut: number;
    parasChanged: number;
    parasSame: number;
    parasAdded: number;
    parasRemoved: number;
    parasEdited: number;
  };
}

/** Split a note body into paragraphs. Blank runs collapse; whitespace-only
 *  paragraphs are dropped so an extra blank line doesn't show up as a
 *  spurious edit. */
function splitParas(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Paragraph-level LCS. Classic DP, exact-match equality — rewritten
 *  paragraphs surface as adjacent del/add pairs that we coalesce into
 *  "edited" in the next pass. */
function paraLCS(a: string[], b: string[]): Array<{ kind: "eq" | "del" | "add"; ai?: number; bi?: number }> {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: Array<{ kind: "eq" | "del" | "add"; ai?: number; bi?: number }> = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ kind: "eq", ai: i, bi: j }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ kind: "del", ai: i }); i++; }
    else { out.push({ kind: "add", bi: j }); j++; }
  }
  while (i < n) { out.push({ kind: "del", ai: i }); i++; }
  while (j < m) { out.push({ kind: "add", bi: j }); j++; }
  return out;
}

function countWords(s: string): number {
  if (!s) return 0;
  return (s.match(/\S+/g) ?? []).length;
}

export function diffProse(leftText: string, rightText: string): ProseDiff {
  const leftParas = splitParas(leftText);
  const rightParas = splitParas(rightText);
  const ops = paraLCS(leftParas, rightParas);

  const paragraphs: ParaChange[] = [];
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (op.kind === "eq") {
      paragraphs.push({
        kind: "same",
        leftIdx: op.ai, rightIdx: op.bi,
        leftText: leftParas[op.ai!], rightText: rightParas[op.bi!],
      });
      continue;
    }
    if (op.kind === "del") {
      // Pair a trailing del with the next add as an "edited" paragraph —
      // that reads far better than "removed then added" for rewrites.
      const next = ops[k + 1];
      if (next && next.kind === "add") {
        const a = leftParas[op.ai!];
        const b = rightParas[next.bi!];
        const td = tokenDiff(a, b);
        paragraphs.push({
          kind: "edited",
          leftIdx: op.ai, rightIdx: next.bi,
          leftText: a, rightText: b,
          ops: td.ops, shrapnel: td.shrapnel,
        });
        k++; // consume the add
        continue;
      }
      paragraphs.push({
        kind: "removed",
        leftIdx: op.ai,
        leftText: leftParas[op.ai!],
      });
      continue;
    }
    // pure add
    paragraphs.push({
      kind: "added",
      rightIdx: op.bi,
      rightText: rightParas[op.bi!],
    });
  }

  let wordsAdded = 0, wordsCut = 0;
  let parasSame = 0, parasAdded = 0, parasRemoved = 0, parasEdited = 0;
  for (const p of paragraphs) {
    switch (p.kind) {
      case "same": parasSame++; break;
      case "added":
        parasAdded++;
        wordsAdded += countWords(p.rightText!);
        break;
      case "removed":
        parasRemoved++;
        wordsCut += countWords(p.leftText!);
        break;
      case "edited":
        parasEdited++;
        for (const o of p.ops!) {
          if (o.kind === "add") wordsAdded += countWords(o.text);
          if (o.kind === "del") wordsCut += countWords(o.text);
        }
        break;
    }
  }

  return {
    paragraphs,
    stats: {
      wordsAdded, wordsCut,
      parasChanged: parasAdded + parasRemoved + parasEdited,
      parasSame, parasAdded, parasRemoved, parasEdited,
    },
  };
}

// ─── dispatcher ─────────────────────────────────────────────────────────

interface Props {
  leftText: string;
  rightText: string;
  leftName: string;
  rightName: string;
  view: CompareDiffView;
}

/** Classify the input so views can specialise their rendering for notes
 *  that live on only one side. "modified" = both sides have content (the
 *  interesting case). "added" / "removed" = whole-note adds/cuts. */
type WholeKind = "added" | "removed" | "modified";
function classifyWhole(leftText: string, rightText: string): WholeKind {
  const lEmpty = !leftText.trim();
  const rEmpty = !rightText.trim();
  if (lEmpty && !rEmpty) return "added";
  if (!lEmpty && rEmpty) return "removed";
  return "modified";
}

export default function CompareDiff({ leftText, rightText, leftName, rightName, view }: Props) {
  const diff = useMemo(() => diffProse(leftText, rightText), [leftText, rightText]);
  const whole = classifyWhole(leftText, rightText);

  // All views share the same readerly frame: gentle border, warm paper
  // background. Each view paints inside it.
  const frameCls = "border-t border-bd bg-bg";

  // Whole-note banner: when a note lives on only one side, set the
  // expectation up front so the "all green" or "all struck-through"
  // rendering inside the view reads as intentional, not as a bug. The
  // translator keeps `<strong>` in their string by way of literal markers
  // we re-stitch into React nodes.
  const banner = whole === "modified" ? null : (
    <div className={`px-5 py-2.5 border-b border-bd text-xs font-sans ${
      whole === "added"
        ? "bg-green-500/8 text-green-700 dark:text-green-400 border-b-green-500/30"
        : "bg-danger/8 text-danger border-b-danger/30"
    }`}>
      <CompareBanner
        whole={whole}
        leftName={leftName}
        rightName={rightName}
      />
    </div>
  );

  return (
    <div className={frameCls}>
      {banner}
      {view === "summary"    && <SummaryView    diff={diff} leftName={leftName} rightName={rightName} />}
      {view === "track"      && <TrackView      diff={diff} leftName={leftName} rightName={rightName} />}
      {view === "split"      && <SplitView      diff={diff} leftName={leftName} rightName={rightName} whole={whole} />}
      {view === "cards"      && <CardsView      diff={diff} leftName={leftName} rightName={rightName} />}
      {view === "marginalia" && <MarginaliaView diff={diff} leftName={leftName} rightName={rightName} whole={whole} />}
    </div>
  );
}

/// Banner shown above each diff view when a note exists on only one
/// side. Translators keep `{name}` / `{leftName}` / `{rightName}` in the
/// string; we split on the literal markers and stitch the bold path-name
/// span back in so they don't have to ship raw HTML.
function CompareBanner({
  whole, leftName, rightName,
}: { whole: WholeKind; leftName: string; rightName: string }) {
  const t = useT();
  if (whole === "added") {
    const tpl = t("paths.cmpdiff.bannerAdded");
    const parts = splitMarkers(tpl, ["{name}"]);
    return (
      <>
        {parts.map((p, i) =>
          p === "{name}"
            ? <strong key={i}>{rightName}</strong>
            : <span key={i}>{p}</span>,
        )}
      </>
    );
  }
  const tpl = t("paths.cmpdiff.bannerRemoved");
  const parts = splitMarkers(tpl, ["{leftName}", "{rightName}"]);
  return (
    <>
      {parts.map((p, i) => {
        if (p === "{leftName}") return <strong key={i}>{leftName}</strong>;
        if (p === "{rightName}") return <span key={i}>{rightName}</span>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/// Generic marker-preserving split — stand-alone so view helpers can
/// reach for it without importing from another module.
function splitMarkers(s: string, markers: string[]): string[] {
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

// ─── shared primitives ──────────────────────────────────────────────────

/** A word-level add/del/eq renderer. Used by TrackView (and the
 *  expanded body of SummaryView's bullets). */
function WordOps({ ops, hideDeletes = false }: { ops: TokenOp[]; hideDeletes?: boolean }) {
  return (
    <>
      {ops.map((op, i) => {
        if (op.kind === "eq") return <span key={i}>{op.text}</span>;
        if (op.kind === "del") {
          if (hideDeletes) return null;
          return (
            <span
              key={i}
              className="rounded-sm px-0.5 text-danger/95 bg-danger/15 line-through decoration-danger/60"
            >{op.text}</span>
          );
        }
        return (
          <span
            key={i}
            className="rounded-sm px-0.5 text-green-600 dark:text-green-400 bg-green-500/15 border-b border-green-500/50"
          >{op.text}</span>
        );
      })}
    </>
  );
}

function Stat({
  tone, num, label,
}: { tone: "add" | "cut" | "edit" | "same"; num: string | number; label: string }) {
  const numCls =
    tone === "add" ? "text-green-600 dark:text-green-400"
    : tone === "cut" ? "text-danger"
    : tone === "edit" ? "text-yeld"
    : "text-char";
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg border border-bd rounded-lg">
      <span className={`font-serif text-xl leading-none ${numCls}`}>{num}</span>
      <span className="text-2xs text-t2 leading-tight">{label}</span>
    </div>
  );
}

// ─── 01 · Summary (default) ─────────────────────────────────────────────

function SummaryView({ diff, leftName, rightName }: {
  diff: ProseDiff; leftName: string; rightName: string;
}) {
  const t = useT();
  const { stats, paragraphs } = diff;
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Headline built from stats — no LLM involved. If nothing actually
  // changed we degrade to a soft "same text on both paths" line.
  const headline = buildHeadline(t, stats, leftName, rightName);

  // Build bullets from the paragraph list: every change gets one entry
  // so the user sees a linear log of what happened.
  const bullets = paragraphs
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.kind !== "same");

  if (bullets.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="font-serif text-lg text-char mb-1">{t("paths.cmpdiff.summaryNoProse")}</div>
        <div className="text-sm text-t2">
          {(() => {
            const tpl = t("paths.cmpdiff.summaryIdentical");
            const parts = splitMarkers(tpl, ["{leftName}", "{rightName}"]);
            return parts.map((p, i) => {
              if (p === "{leftName}") return <span key={i} className="text-char">{leftName}</span>;
              if (p === "{rightName}") return <span key={i} className="text-char">{rightName}</span>;
              return <span key={i}>{p}</span>;
            });
          })()}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-6 py-5 bg-s1/40 border-b border-bd">
        <div className="font-serif text-lg text-char italic leading-snug mb-4">
          {headline}
        </div>
        <div className="flex flex-wrap gap-2">
          <Stat tone="add"  num={`+${stats.wordsAdded}`} label={t("paths.cmpdiff.statWordsAdded")} />
          <Stat tone="cut"  num={`−${stats.wordsCut}`}   label={t("paths.cmpdiff.statWordsCut")} />
          <Stat tone="edit" num={stats.parasEdited}      label={t("paths.cmpdiff.statParasEdited")} />
          {stats.parasAdded > 0 && (
            <Stat tone="add" num={stats.parasAdded} label={t("paths.cmpdiff.statParasAdded")} />
          )}
          {stats.parasRemoved > 0 && (
            <Stat tone="cut" num={stats.parasRemoved} label={t("paths.cmpdiff.statParasCut")} />
          )}
          <Stat tone="same" num={stats.parasSame} label={t("paths.cmpdiff.statIdentical")} />
        </div>
      </div>

      <div className="px-3 py-3">
        <div className="text-2xs uppercase tracking-wider font-sans font-semibold text-t3 px-3 mb-1">
          {t("paths.cmpdiff.changeLog")}
        </div>
        <ul className="flex flex-col">
          {bullets.map(({ p, i }) => {
            const isOpen = openIdx === i;
            const { markerCls, markerGlyph, headline: line } = describeChange(t, p, leftName, rightName);
            return (
              <li key={i} className="flex flex-col">
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className={`flex items-start gap-3 px-3 py-2 rounded-md text-left transition ${
                    isOpen ? "bg-yelp/40" : "hover:bg-s2"
                  }`}
                >
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-semibold border ${markerCls}`}
                  >{markerGlyph}</span>
                  <span className="flex-1 font-serif text-[15px] text-ch2 leading-snug">{line}</span>
                  <span className="text-2xs text-t3 font-mono mt-0.5">
                    {isOpen ? "▾" : "▸"}
                  </span>
                </button>
                {isOpen && (
                  <div className="ml-10 my-1 pl-4 border-l-2 border-yel/60 bg-s1/30 py-3 pr-4 rounded-r-md text-[14.5px] leading-relaxed font-serif">
                    {p.kind === "edited" && (
                      <>
                        <div className="text-[10px] font-sans font-bold tracking-wider uppercase text-danger mb-1">
                          {t("paths.cmpdiff.was", { name: leftName })}
                        </div>
                        <div className="text-ch2 mb-3">{p.leftText}</div>
                        <div className="text-[10px] font-sans font-bold tracking-wider uppercase text-green-600 dark:text-green-400 mb-1">
                          {t("paths.cmpdiff.now", { name: rightName })}
                        </div>
                        <div className="text-ch2">{p.rightText}</div>
                      </>
                    )}
                    {p.kind === "added" && (
                      <>
                        <div className="text-[10px] font-sans font-bold tracking-wider uppercase text-green-600 dark:text-green-400 mb-1">
                          {t("paths.cmpdiff.newOn", { name: rightName })}
                        </div>
                        <div className="text-ch2">{p.rightText}</div>
                      </>
                    )}
                    {p.kind === "removed" && (
                      <>
                        <div className="text-[10px] font-sans font-bold tracking-wider uppercase text-danger mb-1">
                          {t("paths.cmpdiff.cutWasOn", { name: leftName })}
                        </div>
                        <div className="text-ch2">{p.leftText}</div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/// Compose the localized SummaryView headline. We build the sentence
/// from per-stat fragments so each language can place its own
/// connectors ("and", "y", "och") naturally without forcing translators
/// to hand-craft every permutation.
function buildHeadline(
  t: ReturnType<typeof useT>,
  stats: ProseDiff["stats"],
  leftName: string,
  rightName: string,
): string {
  const bits: string[] = [];
  if (stats.parasEdited > 0) {
    bits.push(
      stats.parasEdited === 1
        ? t("paths.cmpdiff.headlineEditsOne", { count: String(stats.parasEdited) })
        : t("paths.cmpdiff.headlineEditsMany", { count: String(stats.parasEdited) }),
    );
  }
  if (stats.parasAdded > 0) {
    bits.push(
      stats.parasAdded === 1
        ? t("paths.cmpdiff.headlineAddsOne", { count: String(stats.parasAdded) })
        : t("paths.cmpdiff.headlineAddsMany", { count: String(stats.parasAdded) }),
    );
  }
  if (stats.parasRemoved > 0) {
    bits.push(t("paths.cmpdiff.headlineCuts", { count: String(stats.parasRemoved) }));
  }
  if (bits.length === 0) {
    return t("paths.cmpdiff.headlineMatch", { leftName, rightName });
  }
  // Rough sentence joining — works for English / Spanish / Swedish where
  // a comma-then-conjunction structure reads naturally.
  let sentence: string;
  const conjunction = t("paths.cmpdiff.headlineAnd");
  if (bits.length === 1) sentence = bits[0];
  else if (bits.length === 2) sentence = `${bits[0]} ${conjunction} ${bits[1]}`;
  else sentence = `${bits.slice(0, -1).join(", ")}, ${conjunction} ${bits[bits.length - 1]}`;
  return `${rightName} ${sentence}.`;
}

function describeChange(
  t: ReturnType<typeof useT>,
  p: ParaChange,
  leftName: string,
  rightName: string,
): { markerCls: string; markerGlyph: string; headline: string } {
  const where = p.rightIdx != null
    ? t("paths.cmpdiff.where", { n: String(p.rightIdx + 1) })
    : p.leftIdx != null
      ? t("paths.cmpdiff.where", { n: String(p.leftIdx + 1) })
      : "";
  if (p.kind === "added") {
    return {
      markerCls: "text-green-600 dark:text-green-400 border-green-500/50 bg-green-500/15",
      markerGlyph: "+",
      headline: t("paths.cmpdiff.changeAdded", {
        where, name: rightName, text: shorten(p.rightText!),
      }),
    };
  }
  if (p.kind === "removed") {
    return {
      markerCls: "text-danger border-danger/50 bg-danger/15",
      markerGlyph: "−",
      headline: t("paths.cmpdiff.changeRemoved", {
        where, name: leftName, text: shorten(p.leftText!),
      }),
    };
  }
  return {
    markerCls: "text-yeld border-yel/50 bg-yel/15",
    markerGlyph: "~",
    headline: t("paths.cmpdiff.changeEdited", {
      where, from: shorten(p.leftText!), to: shorten(p.rightText!),
    }),
  };
}

function shorten(s: string, n = 60): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

// ─── 02 · Track-changes ─────────────────────────────────────────────────

function TrackView({ diff, leftName, rightName }: {
  diff: ProseDiff; leftName: string; rightName: string;
}) {
  const t = useT();
  const [hideDeletes, setHideDeletes] = useState(false);

  return (
    <div>
      <div className="px-5 py-2 border-b border-bd bg-paper-dim flex items-center gap-3 text-2xs text-t2">
        <span>
          {(() => {
            const tpl = t("paths.cmpdiff.trackHeader");
            const parts = splitMarkers(tpl, ["{leftName}", "{rightName}"]);
            return parts.map((p, i) => {
              if (p === "{leftName}") return <span key={i} className="text-ch2">{leftName}</span>;
              if (p === "{rightName}") return <span key={i} className="text-yeld">{rightName}</span>;
              return <span key={i}>{p}</span>;
            });
          })()}
        </span>
        <label className="ml-auto inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={hideDeletes}
            onChange={(e) => setHideDeletes(e.target.checked)}
            className="accent-yel"
          />
          <span>{t("paths.cmpdiff.hideDeletions")}</span>
        </label>
      </div>
      <div className="px-6 py-5 font-serif text-[15.5px] leading-[1.75] text-ch2">
        {diff.paragraphs.map((p, i) => (
          <p key={i} className="mb-4 last:mb-0">
            {renderTrackPara(p, hideDeletes)}
          </p>
        ))}
      </div>
    </div>
  );
}

function renderTrackPara(p: ParaChange, hideDeletes: boolean) {
  if (p.kind === "same") return <>{p.rightText}</>;
  if (p.kind === "added") {
    return (
      <span className="rounded-sm px-1 text-green-600 dark:text-green-400 bg-green-500/15 border-b border-green-500/50">
        {p.rightText}
      </span>
    );
  }
  if (p.kind === "removed") {
    if (hideDeletes) return null;
    return (
      <span className="rounded-sm px-1 text-danger/95 bg-danger/15 line-through decoration-danger/60">
        {p.leftText}
      </span>
    );
  }
  // edited
  if (p.shrapnel) {
    // Rewrite so chaotic that word-level would be noise. Show was/now stacked.
    return (
      <>
        {!hideDeletes && (
          <>
            <span className="rounded-sm px-1 text-danger/95 bg-danger/15 line-through decoration-danger/60">
              {p.leftText}
            </span>
            {" "}
          </>
        )}
        <span className="rounded-sm px-1 text-green-600 dark:text-green-400 bg-green-500/15 border-b border-green-500/50">
          {p.rightText}
        </span>
      </>
    );
  }
  return <WordOps ops={p.ops!} hideDeletes={hideDeletes} />;
}

// ─── 03 · Side by side prose ────────────────────────────────────────────

function SplitView({ diff, leftName, rightName, whole }: {
  diff: ProseDiff; leftName: string; rightName: string; whole: WholeKind;
}) {
  const t = useT();
  const [collapseSame, setCollapseSame] = useState(true);

  // One-sided notes: show the side that has content full-width with a
  // coloured rail on the left indicating add/remove. The empty side's
  // placeholder-column layout is useless here and reads as broken.
  if (whole !== "modified") {
    const side = whole === "added" ? "right" : "left";
    const pathName = whole === "added" ? rightName : leftName;
    const text = whole === "added" ? diff.paragraphs.map((p) => p.rightText ?? "").filter(Boolean).join("\n\n")
                                   : diff.paragraphs.map((p) => p.leftText ?? "").filter(Boolean).join("\n\n");
    const rail = whole === "added" ? "border-l-4 border-green-500/50" : "border-l-4 border-danger/50";
    const headTone = whole === "added"
      ? "text-green-600 dark:text-green-400"
      : "text-danger";
    return (
      <div className={`px-6 py-5 ${rail} font-serif text-[16px] leading-[1.75] text-ch2`}>
        <div className="pb-2 mb-3 border-b border-bd flex items-baseline justify-between">
          <span className={`font-serif italic text-lg ${headTone}`}>{pathName}</span>
          <span className="text-2xs font-sans uppercase tracking-wider text-t3">
            {whole === "added" ? t("paths.cmpdiff.splitAddedTag") : t("paths.cmpdiff.splitCutTag")} · {side}
          </span>
        </div>
        {text.split(/\n\s*\n+/).filter((p) => p.trim().length > 0).map((para, i) => (
          <p key={i} className="mb-4">{para}</p>
        ))}
      </div>
    );
  }

  // Build two synchronized lists of paragraph slots, one per side.
  // Unchanged paragraphs can collapse into a shared "— N unchanged —" bar.
  const leftCol: Array<ParaChange | { gap: number }> = [];
  const rightCol: Array<ParaChange | { gap: number }> = [];
  let gap = 0;
  for (const p of diff.paragraphs) {
    if (p.kind === "same" && collapseSame) {
      gap++;
      continue;
    }
    if (gap > 0) {
      leftCol.push({ gap });
      rightCol.push({ gap });
      gap = 0;
    }
    leftCol.push(p);
    rightCol.push(p);
  }
  if (gap > 0) {
    leftCol.push({ gap });
    rightCol.push({ gap });
  }

  return (
    <div>
      <div className="px-5 py-2 border-b border-bd bg-paper-dim flex items-center gap-3 text-2xs text-t2">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={collapseSame}
            onChange={(e) => setCollapseSame(e.target.checked)}
            className="accent-yel"
          />
          <span>{t("paths.cmpdiff.collapseSame")}</span>
        </label>
        <span className="ml-auto font-mono text-t3 text-[10px]">
          {t("paths.cmpdiff.parasDifferOf", {
            changed: String(diff.stats.parasChanged),
            total: String(diff.paragraphs.length),
          })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-0">
        <SplitColumn side="left"  col={leftCol}  pathName={leftName}  paraKey="leftText" />
        <SplitColumn side="right" col={rightCol} pathName={rightName} paraKey="rightText" />
      </div>
    </div>
  );
}

function SplitColumn({
  side, col, pathName, paraKey,
}: {
  side: "left" | "right";
  col: Array<ParaChange | { gap: number }>;
  pathName: string;
  paraKey: "leftText" | "rightText";
}) {
  const t = useT();
  const headCls = side === "left"
    ? "text-yeld"
    : "text-accent2";
  const borderSide = side === "left" ? "border-r border-bd" : "";
  return (
    <div className={`px-6 py-5 ${borderSide}`}>
      <div className="pb-2 mb-3 border-b border-bd flex items-baseline justify-between">
        <span className={`font-serif italic text-lg ${headCls}`}>{pathName}</span>
        <span className="text-2xs font-sans uppercase tracking-wider text-t3">
          {side === "left" ? t("paths.cmpdiff.splitWas") : t("paths.cmpdiff.splitNow")}
        </span>
      </div>
      <div className="font-serif text-[15.5px] leading-[1.75] text-ch2">
        {col.map((item, i) => {
          if ("gap" in item) {
            return (
              <div key={i} className="text-center text-t3 italic text-xs py-3 my-3 border-y border-dashed border-bd/60 font-serif">
                {item.gap === 1
                  ? t("paths.cmpdiff.unchangedRunOne", { count: String(item.gap) })
                  : t("paths.cmpdiff.unchangedRunMany", { count: String(item.gap) })}
              </div>
            );
          }
          const text = (item as ParaChange)[paraKey];
          // Paragraphs that don't exist on this side (pure add/remove) become an
          // italic placeholder so the two columns stay vertically in register.
          if (!text) {
            return (
              <p key={i} className="mb-4 text-t3 italic text-sm opacity-60">
                {t("paths.cmpdiff.splitNoPara")}
              </p>
            );
          }
          const changed = item.kind !== "same";
          const tone =
            item.kind === "added" ? "border-green-500/50"
            : item.kind === "removed" ? "border-danger/50"
            : item.kind === "edited" ? "border-yel/60"
            : "border-transparent";
          return (
            <p
              key={i}
              className={`mb-4 pl-3 -ml-3 ${changed ? `border-l-2 ${tone}` : ""}`}
            >
              {text}
            </p>
          );
        })}
      </div>
    </div>
  );
}

// ─── 04 · Paragraph cards ───────────────────────────────────────────────

function CardsView({ diff, leftName, rightName }: {
  diff: ProseDiff; leftName: string; rightName: string;
}) {
  const t = useT();
  // Build a flat list that alternates between change-cards and
  // "N unchanged" gap markers, preserving reading order.
  const out: Array<ParaChange | { gap: number }> = [];
  let gap = 0;
  for (const p of diff.paragraphs) {
    if (p.kind === "same") { gap++; continue; }
    if (gap > 0) { out.push({ gap }); gap = 0; }
    out.push(p);
  }
  if (gap > 0) out.push({ gap });

  return (
    <div className="px-5 py-5 bg-paper-dim flex flex-col gap-3">
      {out.map((item, i) => {
        if ("gap" in item) {
          return (
            <div key={i} className="text-center text-t3 italic text-xs py-1 font-serif">
              {item.gap === 1
                ? t("paths.cmpdiff.unchangedDotOne", { count: String(item.gap) })
                : t("paths.cmpdiff.unchangedDotMany", { count: String(item.gap) })}
            </div>
          );
        }
        const kindLabel =
          item.kind === "added"   ? t("paths.cmpdiff.kindAddedOn", { name: rightName })
          : item.kind === "removed" ? t("paths.cmpdiff.kindCutOn", { name: rightName })
                                    : t("paths.cmpdiff.kindEdited");
        const kindCls =
          item.kind === "added"   ? "text-green-600 dark:text-green-400 bg-green-500/15"
          : item.kind === "removed" ? "text-danger bg-danger/15"
                                    : "text-yeld bg-yel/15";
        const where =
          item.rightIdx != null ? t("paths.cmpdiff.cardWhere", { n: String(item.rightIdx + 1) })
          : item.leftIdx != null ? t("paths.cmpdiff.cardWhere", { n: String(item.leftIdx + 1) })
          : "";
        const single = item.kind !== "edited";
        return (
          <div key={i} className="bg-bg border border-bd rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-bd bg-white/[0.01]">
              <span className={`text-[10px] font-sans font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${kindCls}`}>
                {kindLabel}
              </span>
              <span className="ml-auto font-mono text-[10px] text-t3">{where}</span>
            </div>
            <div className={`grid ${single ? "grid-cols-1" : "grid-cols-2"} gap-0 font-serif text-[15px] leading-[1.7] text-ch2`}>
              {item.kind !== "added" && (
                <div className="px-5 py-4 bg-danger/[0.03] border-r border-bd">
                  <div className="text-[9.5px] font-sans font-bold tracking-[0.2em] uppercase text-danger mb-2">
                    {t("paths.cmpdiff.was", { name: leftName })}
                  </div>
                  {item.leftText}
                </div>
              )}
              {item.kind !== "removed" && (
                <div className="px-5 py-4 bg-green-500/[0.03]">
                  <div className="text-[9.5px] font-sans font-bold tracking-[0.2em] uppercase text-green-600 dark:text-green-400 mb-2">
                    {t("paths.cmpdiff.now", { name: rightName })}
                  </div>
                  {item.rightText}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 05 · Marginalia ────────────────────────────────────────────────────

interface Annotation {
  paraIndex: number;
  kind: "added" | "edited" | "removed";
  anchor?: string;
  headline: string;
  body: string;
}

function MarginaliaView({ diff, leftName, rightName, whole }: {
  diff: ProseDiff; leftName: string; rightName: string; whole: WholeKind;
}) {
  const t = useT();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  // Pure-remove note: no "new version" to read; show the *old* prose
  // instead, struck through, so the user still gets to read what would
  // vanish if they switched paths. Gutter summarises.
  const showRemovedInline = whole === "removed";

  // Build annotations from the paragraph diff. For edited paragraphs
  // whose tokenDiff wasn't shrapnel, anchor on the first 'add' run so
  // hover/click can light up the inline mark.
  const annotations: Annotation[] = [];
  diff.paragraphs.forEach((p, i) => {
    if (p.kind === "added") {
      annotations.push({
        paraIndex: i,
        kind: "added",
        headline: t("paths.cmpdiff.marginAdded"),
        body: t("paths.cmpdiff.marginAddedBody", { leftName, rightName }),
      });
      return;
    }
    if (p.kind === "removed") {
      annotations.push({
        paraIndex: i,
        kind: "removed",
        headline: t("paths.cmpdiff.marginCut"),
        body: t("paths.cmpdiff.marginCutBody", {
          leftName,
          text: shorten(p.leftText!, 80),
        }),
      });
      return;
    }
    if (p.kind === "edited") {
      const firstAdd = p.ops?.find((o) => o.kind === "add" && o.text.trim().length > 0);
      annotations.push({
        paraIndex: i,
        kind: "edited",
        anchor: firstAdd?.text.trim() || undefined,
        headline: t("paths.cmpdiff.marginEdited"),
        body: t("paths.cmpdiff.marginEditedBody", { text: shorten(p.leftText!, 80) }),
      });
    }
  });

  return (
    <div className="grid grid-cols-[1fr_260px] gap-0 bg-bg">
      <div className="px-6 py-5 border-r border-bd font-serif text-[16px] leading-[1.8] text-ch2">
        {diff.paragraphs.map((p, i) => {
          if (p.kind === "same") {
            return <p key={i} className="mb-4">{p.rightText}</p>;
          }
          if (p.kind === "removed") {
            // For whole-remove notes we render the struck-through prose so
            // the user can still read what would vanish. For mixed diffs,
            // a standalone removed paragraph becomes a faded italic ghost
            // with the strike — keeps reading flow but signals absence.
            return (
              <p
                key={i}
                className={`mb-4 rounded-sm px-1 text-danger/90 bg-danger/10 border-l-2 border-danger/50 -ml-1 pl-2 line-through decoration-danger/60 ${
                  showRemovedInline ? "" : "italic opacity-80"
                }`}
              >
                {p.leftText}
              </p>
            );
          }
          const annoIdx = annotations.findIndex((a) => a.paraIndex === i);
          const active = activeIdx === annoIdx;
          if (p.kind === "added") {
            return (
              <p
                key={i}
                className={`mb-4 rounded-sm px-1 text-green-600 dark:text-green-400 bg-green-500/15 border-l-2 border-green-500/60 -ml-1 pl-2 cursor-pointer ${active ? "ring-1 ring-green-500/40" : ""}`}
                onMouseEnter={() => setActiveIdx(annoIdx)}
                onMouseLeave={() => setActiveIdx(null)}
              >
                {p.rightText}
              </p>
            );
          }
          // edited
          return (
            <p
              key={i}
              className={`mb-4 cursor-pointer ${active ? "ring-1 ring-yel/40 rounded-sm px-1" : ""}`}
              onMouseEnter={() => setActiveIdx(annoIdx)}
              onMouseLeave={() => setActiveIdx(null)}
            >
              {p.shrapnel ? (
                <span className="rounded-sm px-1 text-yeld bg-yel/15 border-b border-yel/50">{p.rightText}</span>
              ) : (
                <WordOps ops={p.ops!} hideDeletes={true} />
              )}
            </p>
          );
        })}
      </div>
      <div className="px-5 py-5 bg-paper-dim">
        <div className="text-[10px] font-sans font-bold tracking-[0.2em] uppercase text-t3 pb-2 mb-3 border-b border-bd">
          {t("paths.cmpdiff.marginHeading", { name: rightName })}
        </div>
        {annotations.length === 0 && (
          <div className="text-xs italic text-t3 font-serif">{t("paths.cmpdiff.marginEmpty")}</div>
        )}
        <div className="flex flex-col gap-2">
          {annotations.map((a, idx) => {
            const active = activeIdx === idx;
            const kindCls =
              a.kind === "added"   ? "text-green-600 dark:text-green-400"
              : a.kind === "removed" ? "text-danger"
                                      : "text-yeld";
            return (
              <button
                key={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                className={`text-left px-3 py-2 rounded-md border transition ${
                  active ? "border-yel bg-yel/10" : "border-bd bg-bg hover:border-bd2"
                }`}
              >
                <div className={`text-[9px] font-sans font-bold tracking-[0.18em] uppercase ${kindCls} mb-0.5`}>
                  {a.headline}
                </div>
                <div className="font-serif italic text-[12.5px] text-t2 leading-tight">
                  {a.body}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
