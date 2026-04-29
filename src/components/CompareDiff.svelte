<script module lang="ts">
  import { tokenDiff, type TokenOp } from "../lib/lineDiff";

  export type CompareDiffView =
    | "summary"
    | "track"
    | "split"
    | "cards"
    | "marginalia";

  export const DEFAULT_COMPARE_VIEW: CompareDiffView = "marginalia";

  export const COMPARE_VIEW_LABELS: Record<CompareDiffView, string> = {
    summary: "Summary",
    track: "Track changes",
    split: "Side by side",
    cards: "Paragraph cards",
    marginalia: "Marginalia",
  };

  const VIEW_ORDER: CompareDiffView[] = [
    "summary",
    "track",
    "split",
    "cards",
    "marginalia",
  ];

  export const COMPARE_VIEW_ORDER = VIEW_ORDER;

  type ParaKind = "same" | "edited" | "added" | "removed";

  export interface ParaChange {
    kind: ParaKind;
    leftIdx?: number;
    rightIdx?: number;
    leftText?: string;
    rightText?: string;
    ops?: TokenOp[];
    shrapnel?: boolean;
  }

  export interface ProseDiff {
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

  function splitParas(text: string): string[] {
    return text
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  function paraLCS(
    a: string[],
    b: string[],
  ): Array<{ kind: "eq" | "del" | "add"; ai?: number; bi?: number }> {
    const n = a.length,
      m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () =>
      new Array(m + 1).fill(0),
    );
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out: Array<{ kind: "eq" | "del" | "add"; ai?: number; bi?: number }> = [];
    let i = 0,
      j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        out.push({ kind: "eq", ai: i, bi: j });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        out.push({ kind: "del", ai: i });
        i++;
      } else {
        out.push({ kind: "add", bi: j });
        j++;
      }
    }
    while (i < n) {
      out.push({ kind: "del", ai: i });
      i++;
    }
    while (j < m) {
      out.push({ kind: "add", bi: j });
      j++;
    }
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
          leftIdx: op.ai,
          rightIdx: op.bi,
          leftText: leftParas[op.ai!],
          rightText: rightParas[op.bi!],
        });
        continue;
      }
      if (op.kind === "del") {
        const next = ops[k + 1];
        if (next && next.kind === "add") {
          const a = leftParas[op.ai!];
          const b = rightParas[next.bi!];
          const td = tokenDiff(a, b);
          paragraphs.push({
            kind: "edited",
            leftIdx: op.ai,
            rightIdx: next.bi,
            leftText: a,
            rightText: b,
            ops: td.ops,
            shrapnel: td.shrapnel,
          });
          k++;
          continue;
        }
        paragraphs.push({
          kind: "removed",
          leftIdx: op.ai,
          leftText: leftParas[op.ai!],
        });
        continue;
      }
      paragraphs.push({
        kind: "added",
        rightIdx: op.bi,
        rightText: rightParas[op.bi!],
      });
    }

    let wordsAdded = 0,
      wordsCut = 0;
    let parasSame = 0,
      parasAdded = 0,
      parasRemoved = 0,
      parasEdited = 0;
    for (const p of paragraphs) {
      switch (p.kind) {
        case "same":
          parasSame++;
          break;
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
        wordsAdded,
        wordsCut,
        parasChanged: parasAdded + parasRemoved + parasEdited,
        parasSame,
        parasAdded,
        parasRemoved,
        parasEdited,
      },
    };
  }

  type WholeKind = "added" | "removed" | "modified";
  function classifyWhole(leftText: string, rightText: string): WholeKind {
    const lEmpty = !leftText.trim();
    const rEmpty = !rightText.trim();
    if (lEmpty && !rEmpty) return "added";
    if (!lEmpty && rEmpty) return "removed";
    return "modified";
  }

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

  function shorten(s: string, n = 60): string {
    if (s.length <= n) return s;
    return s.slice(0, n - 1).trimEnd() + "…";
  }
</script>

<script lang="ts">
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    leftText: string;
    rightText: string;
    leftName: string;
    rightName: string;
    view: CompareDiffView;
  }

  let { leftText, rightText, leftName, rightName, view }: Props = $props();
  let t = $derived(tr());

  let diff = $derived(diffProse(leftText, rightText));
  let whole = $derived(classifyWhole(leftText, rightText));

  let bannerParts = $derived.by(() => {
    if (whole === "modified") return null;
    if (whole === "added") {
      const tpl = t("paths.cmpdiff.bannerAdded");
      return splitMarkers(tpl, ["{name}"]);
    }
    const tpl = t("paths.cmpdiff.bannerRemoved");
    return splitMarkers(tpl, ["{leftName}", "{rightName}"]);
  });

  // SummaryView state
  let summaryOpenIdx = $state<number | null>(null);

  function buildHeadline(stats: ProseDiff["stats"]): string {
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
    let sentence: string;
    const conjunction = t("paths.cmpdiff.headlineAnd");
    if (bits.length === 1) sentence = bits[0];
    else if (bits.length === 2) sentence = `${bits[0]} ${conjunction} ${bits[1]}`;
    else sentence = `${bits.slice(0, -1).join(", ")}, ${conjunction} ${bits[bits.length - 1]}`;
    return `${rightName} ${sentence}.`;
  }

  function describeChange(p: ParaChange): {
    markerCls: string;
    markerGlyph: string;
    headline: string;
  } {
    const where =
      p.rightIdx != null
        ? t("paths.cmpdiff.where", { n: String(p.rightIdx + 1) })
        : p.leftIdx != null
          ? t("paths.cmpdiff.where", { n: String(p.leftIdx + 1) })
          : "";
    if (p.kind === "added") {
      return {
        markerCls: "text-green-600 dark:text-green-400 border-green-500/50 bg-green-500/15",
        markerGlyph: "+",
        headline: t("paths.cmpdiff.changeAdded", {
          where,
          name: rightName,
          text: shorten(p.rightText!),
        }),
      };
    }
    if (p.kind === "removed") {
      return {
        markerCls: "text-danger border-danger/50 bg-danger/15",
        markerGlyph: "−",
        headline: t("paths.cmpdiff.changeRemoved", {
          where,
          name: leftName,
          text: shorten(p.leftText!),
        }),
      };
    }
    return {
      markerCls: "text-yeld border-yel/50 bg-yel/15",
      markerGlyph: "~",
      headline: t("paths.cmpdiff.changeEdited", {
        where,
        from: shorten(p.leftText!),
        to: shorten(p.rightText!),
      }),
    };
  }

  // Track view state
  let trackHideDeletes = $state(false);

  // Split view state
  let splitCollapseSame = $state(true);

  // Marginalia view state
  let marginaliaActiveIdx = $state<number | null>(null);

  let summaryBullets = $derived(
    diff.paragraphs.map((p, i) => ({ p, i })).filter(({ p }) => p.kind !== "same"),
  );

  let summaryIdenticalParts = $derived.by(() => {
    if (summaryBullets.length !== 0) return null;
    const tpl = t("paths.cmpdiff.summaryIdentical");
    return splitMarkers(tpl, ["{leftName}", "{rightName}"]);
  });

  let trackHeaderParts = $derived.by(() => {
    const tpl = t("paths.cmpdiff.trackHeader");
    return splitMarkers(tpl, ["{leftName}", "{rightName}"]);
  });

  // Split view: build columns
  interface GapItem {
    gap: number;
  }
  let splitCols = $derived.by(() => {
    if (whole !== "modified") return null;
    const leftCol: Array<ParaChange | GapItem> = [];
    const rightCol: Array<ParaChange | GapItem> = [];
    let gap = 0;
    for (const p of diff.paragraphs) {
      if (p.kind === "same" && splitCollapseSame) {
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
    return { leftCol, rightCol };
  });

  let splitOneSidedText = $derived.by(() => {
    if (whole === "modified") return null;
    const text =
      whole === "added"
        ? diff.paragraphs.map((p) => p.rightText ?? "").filter(Boolean).join("\n\n")
        : diff.paragraphs.map((p) => p.leftText ?? "").filter(Boolean).join("\n\n");
    return text.split(/\n\s*\n+/).filter((p) => p.trim().length > 0);
  });

  // Cards view: build flat list
  let cardsList = $derived.by(() => {
    const out: Array<ParaChange | GapItem> = [];
    let gap = 0;
    for (const p of diff.paragraphs) {
      if (p.kind === "same") {
        gap++;
        continue;
      }
      if (gap > 0) {
        out.push({ gap });
        gap = 0;
      }
      out.push(p);
    }
    if (gap > 0) out.push({ gap });
    return out;
  });

  // Marginalia annotations
  interface Annotation {
    paraIndex: number;
    kind: "added" | "edited" | "removed";
    anchor?: string;
    headline: string;
    body: string;
  }

  let marginaliaAnnotations = $derived.by(() => {
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
        const firstAdd = p.ops?.find(
          (o) => o.kind === "add" && o.text.trim().length > 0,
        );
        annotations.push({
          paraIndex: i,
          kind: "edited",
          anchor: firstAdd?.text.trim() || undefined,
          headline: t("paths.cmpdiff.marginEdited"),
          body: t("paths.cmpdiff.marginEditedBody", { text: shorten(p.leftText!, 80) }),
        });
      }
    });
    return annotations;
  });

  let showRemovedInline = $derived(whole === "removed");
</script>

{#snippet wordOps(ops: TokenOp[], hideDeletes = false)}
  {#each ops as op, i (i)}
    {#if op.kind === "eq"}
      <span>{op.text}</span>
    {:else if op.kind === "del"}
      {#if !hideDeletes}
        <span
          class="rounded-xs px-0.5 text-danger/95 bg-danger/15 line-through decoration-danger/60"
        >{op.text}</span>
      {/if}
    {:else}
      <span
        class="rounded-xs px-0.5 text-green-600 dark:text-green-400 bg-green-500/15 border-b border-green-500/50"
      >{op.text}</span>
    {/if}
  {/each}
{/snippet}

{#snippet stat(tone: "add" | "cut" | "edit" | "same", num: string | number, label: string)}
  {@const numCls = tone === "add"
    ? "text-green-600 dark:text-green-400"
    : tone === "cut"
      ? "text-danger"
      : tone === "edit"
        ? "text-yeld"
        : "text-char"}
  <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-bg border border-bd rounded-lg">
    <span class="font-serif text-xl leading-none {numCls}">{num}</span>
    <span class="text-2xs text-t2 leading-tight">{label}</span>
  </div>
{/snippet}

<div class="border-t border-bd bg-bg">
  {#if bannerParts}
    <div class="px-5 py-2.5 border-b border-bd text-xs font-sans {whole === 'added'
      ? 'bg-green-500/8 text-green-700 dark:text-green-400 border-b-green-500/30'
      : 'bg-danger/8 text-danger border-b-danger/30'}">
      {#each bannerParts as p, i (i)}
        {#if p === "{name}"}<strong>{rightName}</strong>
        {:else if p === "{leftName}"}<strong>{leftName}</strong>
        {:else if p === "{rightName}"}<span>{rightName}</span>
        {:else}<span>{p}</span>{/if}
      {/each}
    </div>
  {/if}

  {#if view === "summary"}
    {#if summaryBullets.length === 0}
      <div class="p-6 text-center">
        <div class="font-serif text-lg text-char mb-1">{t("paths.cmpdiff.summaryNoProse")}</div>
        <div class="text-sm text-t2">
          {#if summaryIdenticalParts}
            {#each summaryIdenticalParts as p, i (i)}
              {#if p === "{leftName}"}<span class="text-char">{leftName}</span>
              {:else if p === "{rightName}"}<span class="text-char">{rightName}</span>
              {:else}<span>{p}</span>{/if}
            {/each}
          {/if}
        </div>
      </div>
    {:else}
      <div>
        <div class="px-6 py-5 bg-s1/40 border-b border-bd">
          <div class="font-serif text-lg text-char italic leading-snug mb-4">
            {buildHeadline(diff.stats)}
          </div>
          <div class="flex flex-wrap gap-2">
            {@render stat("add", `+${diff.stats.wordsAdded}`, t("paths.cmpdiff.statWordsAdded"))}
            {@render stat("cut", `−${diff.stats.wordsCut}`, t("paths.cmpdiff.statWordsCut"))}
            {@render stat("edit", diff.stats.parasEdited, t("paths.cmpdiff.statParasEdited"))}
            {#if diff.stats.parasAdded > 0}
              {@render stat("add", diff.stats.parasAdded, t("paths.cmpdiff.statParasAdded"))}
            {/if}
            {#if diff.stats.parasRemoved > 0}
              {@render stat("cut", diff.stats.parasRemoved, t("paths.cmpdiff.statParasCut"))}
            {/if}
            {@render stat("same", diff.stats.parasSame, t("paths.cmpdiff.statIdentical"))}
          </div>
        </div>

        <div class="px-3 py-3">
          <div class="text-2xs uppercase tracking-wider font-sans font-semibold text-t3 px-3 mb-1">
            {t("paths.cmpdiff.changeLog")}
          </div>
          <ul class="flex flex-col">
            {#each summaryBullets as { p, i } (i)}
              {@const isOpen = summaryOpenIdx === i}
              {@const dc = describeChange(p)}
              <li class="flex flex-col">
                <button
                  onclick={() => (summaryOpenIdx = isOpen ? null : i)}
                  class="flex items-start gap-3 px-3 py-2 rounded-md text-left transition {isOpen
                    ? 'bg-yelp/40'
                    : 'hover:bg-s2'}"
                >
                  <span
                    class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-semibold border {dc.markerCls}"
                  >{dc.markerGlyph}</span>
                  <span class="flex-1 font-serif text-[15px] text-ch2 leading-snug">{dc.headline}</span>
                  <span class="text-2xs text-t3 font-mono mt-0.5">
                    {isOpen ? "▾" : "▸"}
                  </span>
                </button>
                {#if isOpen}
                  <div class="ml-10 my-1 pl-4 border-l-2 border-yel/60 bg-s1/30 py-3 pr-4 rounded-r-md text-[14.5px] leading-relaxed font-serif">
                    {#if p.kind === "edited"}
                      <div class="text-[10px] font-sans font-bold tracking-wider uppercase text-danger mb-1">
                        {t("paths.cmpdiff.was", { name: leftName })}
                      </div>
                      <div class="text-ch2 mb-3">{p.leftText}</div>
                      <div class="text-[10px] font-sans font-bold tracking-wider uppercase text-green-600 dark:text-green-400 mb-1">
                        {t("paths.cmpdiff.now", { name: rightName })}
                      </div>
                      <div class="text-ch2">{p.rightText}</div>
                    {:else if p.kind === "added"}
                      <div class="text-[10px] font-sans font-bold tracking-wider uppercase text-green-600 dark:text-green-400 mb-1">
                        {t("paths.cmpdiff.newOn", { name: rightName })}
                      </div>
                      <div class="text-ch2">{p.rightText}</div>
                    {:else if p.kind === "removed"}
                      <div class="text-[10px] font-sans font-bold tracking-wider uppercase text-danger mb-1">
                        {t("paths.cmpdiff.cutWasOn", { name: leftName })}
                      </div>
                      <div class="text-ch2">{p.leftText}</div>
                    {/if}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  {:else if view === "track"}
    <div>
      <div class="px-5 py-2 border-b border-bd bg-paper-dim flex items-center gap-3 text-2xs text-t2">
        <span>
          {#each trackHeaderParts as p, i (i)}
            {#if p === "{leftName}"}<span class="text-ch2">{leftName}</span>
            {:else if p === "{rightName}"}<span class="text-yeld">{rightName}</span>
            {:else}<span>{p}</span>{/if}
          {/each}
        </span>
        <label class="ml-auto inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={trackHideDeletes}
            class="accent-yel"
          />
          <span>{t("paths.cmpdiff.hideDeletions")}</span>
        </label>
      </div>
      <div class="px-6 py-5 font-serif text-[15.5px] leading-[1.75] text-ch2">
        {#each diff.paragraphs as p, i (i)}
          <p class="mb-4 last:mb-0">
            {#if p.kind === "same"}
              {p.rightText}
            {:else if p.kind === "added"}
              <span class="rounded-xs px-1 text-green-600 dark:text-green-400 bg-green-500/15 border-b border-green-500/50">
                {p.rightText}
              </span>
            {:else if p.kind === "removed"}
              {#if !trackHideDeletes}
                <span class="rounded-xs px-1 text-danger/95 bg-danger/15 line-through decoration-danger/60">
                  {p.leftText}
                </span>
              {/if}
            {:else if p.shrapnel}
              {#if !trackHideDeletes}
                <span class="rounded-xs px-1 text-danger/95 bg-danger/15 line-through decoration-danger/60">
                  {p.leftText}
                </span>
                {" "}
              {/if}
              <span class="rounded-xs px-1 text-green-600 dark:text-green-400 bg-green-500/15 border-b border-green-500/50">
                {p.rightText}
              </span>
            {:else if p.ops}
              {@render wordOps(p.ops, trackHideDeletes)}
            {/if}
          </p>
        {/each}
      </div>
    </div>
  {:else if view === "split"}
    {#if whole !== "modified" && splitOneSidedText}
      {@const pathName = whole === "added" ? rightName : leftName}
      {@const rail = whole === "added" ? "border-l-4 border-green-500/50" : "border-l-4 border-danger/50"}
      {@const headTone = whole === "added" ? "text-green-600 dark:text-green-400" : "text-danger"}
      <div class="px-6 py-5 {rail} font-serif text-[16px] leading-[1.75] text-ch2">
        <div class="pb-2 mb-3 border-b border-bd flex items-baseline justify-between">
          <span class="font-serif italic text-lg {headTone}">{pathName}</span>
          <span class="text-2xs font-sans uppercase tracking-wider text-t3">
            {whole === "added" ? t("paths.cmpdiff.splitAddedTag") : t("paths.cmpdiff.splitCutTag")} · {whole === "added" ? "right" : "left"}
          </span>
        </div>
        {#each splitOneSidedText as para, i (i)}
          <p class="mb-4">{para}</p>
        {/each}
      </div>
    {:else if splitCols}
      <div>
        <div class="px-5 py-2 border-b border-bd bg-paper-dim flex items-center gap-3 text-2xs text-t2">
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={splitCollapseSame}
              class="accent-yel"
            />
            <span>{t("paths.cmpdiff.collapseSame")}</span>
          </label>
          <span class="ml-auto font-mono text-t3 text-[10px]">
            {t("paths.cmpdiff.parasDifferOf", {
              changed: String(diff.stats.parasChanged),
              total: String(diff.paragraphs.length),
            })}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-0">
          <div class="px-6 py-5 border-r border-bd">
            <div class="pb-2 mb-3 border-b border-bd flex items-baseline justify-between">
              <span class="font-serif italic text-lg text-yeld">{leftName}</span>
              <span class="text-2xs font-sans uppercase tracking-wider text-t3">{t("paths.cmpdiff.splitWas")}</span>
            </div>
            <div class="font-serif text-[15.5px] leading-[1.75] text-ch2">
              {#each splitCols.leftCol as item, i (i)}
                {#if "gap" in item}
                  <div class="text-center text-t3 italic text-xs py-3 my-3 border-y border-dashed border-bd/60 font-serif">
                    {item.gap === 1
                      ? t("paths.cmpdiff.unchangedRunOne", { count: String(item.gap) })
                      : t("paths.cmpdiff.unchangedRunMany", { count: String(item.gap) })}
                  </div>
                {:else}
                  {@const text = item.leftText}
                  {#if !text}
                    <p class="mb-4 text-t3 italic text-sm opacity-60">{t("paths.cmpdiff.splitNoPara")}</p>
                  {:else}
                    {@const changed = item.kind !== "same"}
                    {@const tone = item.kind === "added"
                      ? "border-green-500/50"
                      : item.kind === "removed"
                        ? "border-danger/50"
                        : item.kind === "edited"
                          ? "border-yel/60"
                          : "border-transparent"}
                    <p class="mb-4 pl-3 -ml-3 {changed ? `border-l-2 ${tone}` : ''}">{text}</p>
                  {/if}
                {/if}
              {/each}
            </div>
          </div>
          <div class="px-6 py-5">
            <div class="pb-2 mb-3 border-b border-bd flex items-baseline justify-between">
              <span class="font-serif italic text-lg text-accent2">{rightName}</span>
              <span class="text-2xs font-sans uppercase tracking-wider text-t3">{t("paths.cmpdiff.splitNow")}</span>
            </div>
            <div class="font-serif text-[15.5px] leading-[1.75] text-ch2">
              {#each splitCols.rightCol as item, i (i)}
                {#if "gap" in item}
                  <div class="text-center text-t3 italic text-xs py-3 my-3 border-y border-dashed border-bd/60 font-serif">
                    {item.gap === 1
                      ? t("paths.cmpdiff.unchangedRunOne", { count: String(item.gap) })
                      : t("paths.cmpdiff.unchangedRunMany", { count: String(item.gap) })}
                  </div>
                {:else}
                  {@const text = item.rightText}
                  {#if !text}
                    <p class="mb-4 text-t3 italic text-sm opacity-60">{t("paths.cmpdiff.splitNoPara")}</p>
                  {:else}
                    {@const changed = item.kind !== "same"}
                    {@const tone = item.kind === "added"
                      ? "border-green-500/50"
                      : item.kind === "removed"
                        ? "border-danger/50"
                        : item.kind === "edited"
                          ? "border-yel/60"
                          : "border-transparent"}
                    <p class="mb-4 pl-3 -ml-3 {changed ? `border-l-2 ${tone}` : ''}">{text}</p>
                  {/if}
                {/if}
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}
  {:else if view === "cards"}
    <div class="px-5 py-5 bg-paper-dim flex flex-col gap-3">
      {#each cardsList as item, i (i)}
        {#if "gap" in item}
          <div class="text-center text-t3 italic text-xs py-1 font-serif">
            {item.gap === 1
              ? t("paths.cmpdiff.unchangedDotOne", { count: String(item.gap) })
              : t("paths.cmpdiff.unchangedDotMany", { count: String(item.gap) })}
          </div>
        {:else}
          {@const kindLabel = item.kind === "added"
            ? t("paths.cmpdiff.kindAddedOn", { name: rightName })
            : item.kind === "removed"
              ? t("paths.cmpdiff.kindCutOn", { name: rightName })
              : t("paths.cmpdiff.kindEdited")}
          {@const kindCls = item.kind === "added"
            ? "text-green-600 dark:text-green-400 bg-green-500/15"
            : item.kind === "removed"
              ? "text-danger bg-danger/15"
              : "text-yeld bg-yel/15"}
          {@const where = item.rightIdx != null
            ? t("paths.cmpdiff.cardWhere", { n: String(item.rightIdx + 1) })
            : item.leftIdx != null
              ? t("paths.cmpdiff.cardWhere", { n: String(item.leftIdx + 1) })
              : ""}
          {@const single = item.kind !== "edited"}
          <div class="bg-bg border border-bd rounded-lg overflow-hidden">
            <div class="flex items-center gap-2 px-4 py-2 border-b border-bd bg-white/1">
              <span class="text-[10px] font-sans font-bold tracking-wider uppercase px-2 py-0.5 rounded-full {kindCls}">
                {kindLabel}
              </span>
              <span class="ml-auto font-mono text-[10px] text-t3">{where}</span>
            </div>
            <div class="grid {single ? 'grid-cols-1' : 'grid-cols-2'} gap-0 font-serif text-[15px] leading-[1.7] text-ch2">
              {#if item.kind !== "added"}
                <div class="px-5 py-4 bg-danger/3 border-r border-bd">
                  <div class="text-[9.5px] font-sans font-bold tracking-[0.2em] uppercase text-danger mb-2">
                    {t("paths.cmpdiff.was", { name: leftName })}
                  </div>
                  {item.leftText}
                </div>
              {/if}
              {#if item.kind !== "removed"}
                <div class="px-5 py-4 bg-green-500/3">
                  <div class="text-[9.5px] font-sans font-bold tracking-[0.2em] uppercase text-green-600 dark:text-green-400 mb-2">
                    {t("paths.cmpdiff.now", { name: rightName })}
                  </div>
                  {item.rightText}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {:else if view === "marginalia"}
    <div class="grid grid-cols-[1fr_260px] gap-0 bg-bg">
      <div class="px-6 py-5 border-r border-bd font-serif text-[16px] leading-[1.8] text-ch2">
        {#each diff.paragraphs as p, i (i)}
          {#if p.kind === "same"}
            <p class="mb-4">{p.rightText}</p>
          {:else if p.kind === "removed"}
            <p
              class="mb-4 rounded-xs px-1 text-danger/90 bg-danger/10 border-l-2 border-danger/50 -ml-1 pl-2 line-through decoration-danger/60 {showRemovedInline ? '' : 'italic opacity-80'}"
            >
              {p.leftText}
            </p>
          {:else}
            {@const annoIdx = marginaliaAnnotations.findIndex((a) => a.paraIndex === i)}
            {@const active = marginaliaActiveIdx === annoIdx}
            {#if p.kind === "added"}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <p
                class="mb-4 rounded-xs px-1 text-green-600 dark:text-green-400 bg-green-500/15 border-l-2 border-green-500/60 -ml-1 pl-2 cursor-pointer {active ? 'ring-1 ring-green-500/40' : ''}"
                onmouseenter={() => (marginaliaActiveIdx = annoIdx)}
                onmouseleave={() => (marginaliaActiveIdx = null)}
              >
                {p.rightText}
              </p>
            {:else}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <p
                class="mb-4 cursor-pointer {active ? 'ring-1 ring-yel/40 rounded-xs px-1' : ''}"
                onmouseenter={() => (marginaliaActiveIdx = annoIdx)}
                onmouseleave={() => (marginaliaActiveIdx = null)}
              >
                {#if p.shrapnel}
                  <span class="rounded-xs px-1 text-yeld bg-yel/15 border-b border-yel/50">{p.rightText}</span>
                {:else if p.ops}
                  {@render wordOps(p.ops, true)}
                {/if}
              </p>
            {/if}
          {/if}
        {/each}
      </div>
      <div class="px-5 py-5 bg-paper-dim">
        <div class="text-[10px] font-sans font-bold tracking-[0.2em] uppercase text-t3 pb-2 mb-3 border-b border-bd">
          {t("paths.cmpdiff.marginHeading", { name: rightName })}
        </div>
        {#if marginaliaAnnotations.length === 0}
          <div class="text-xs italic text-t3 font-serif">{t("paths.cmpdiff.marginEmpty")}</div>
        {/if}
        <div class="flex flex-col gap-2">
          {#each marginaliaAnnotations as a, idx (idx)}
            {@const active = marginaliaActiveIdx === idx}
            {@const kindCls = a.kind === "added"
              ? "text-green-600 dark:text-green-400"
              : a.kind === "removed"
                ? "text-danger"
                : "text-yeld"}
            <button
              onmouseenter={() => (marginaliaActiveIdx = idx)}
              onmouseleave={() => (marginaliaActiveIdx = null)}
              class="text-left px-3 py-2 rounded-md border transition {active
                ? 'border-yel bg-yel/10'
                : 'border-bd bg-bg hover:border-bd2'}"
            >
              <div class="text-[9px] font-sans font-bold tracking-[0.18em] uppercase {kindCls} mb-0.5">
                {a.headline}
              </div>
              <div class="font-serif italic text-[12.5px] text-t2 leading-tight">
                {a.body}
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
