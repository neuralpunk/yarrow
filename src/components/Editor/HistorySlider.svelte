<script module lang="ts">
  import type { HistoryEntry } from "../../lib/types";
  import type { StringKey } from "../../lib/i18n/index.svelte";

  type Bucket = { key: StringKey; value?: undefined } | { key: null; value: string };

  function bucketOf(unixSeconds: number): Bucket {
    const now = Date.now() / 1000;
    const diff = now - unixSeconds;
    const d = new Date(unixSeconds * 1000);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (sameDay) return { key: "editor.history.bucket.today" };
    if (d.toDateString() === yesterday.toDateString())
      return { key: "editor.history.bucket.yesterday" };
    if (diff < 86400 * 7) return { key: "editor.history.bucket.earlierThisWeek" };
    if (diff < 86400 * 30) return { key: "editor.history.bucket.thisMonth" };
    return {
      key: null,
      value: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    };
  }

  export type FlatRow =
    | { kind: "header"; key: string; bucket: Bucket; height: number }
    | { kind: "entry"; key: string; entry: HistoryEntry; i: number; height: number };

  export const ROW_HEADER_H = 28;
  export const ROW_ENTRY_H = 76;

  function stripFrontmatter(raw: string | null): string | null {
    if (raw == null) return null;
    if (!raw.startsWith("---")) return raw;
    const end = raw.indexOf("\n---", 3);
    if (end === -1) return raw;
    let after = end + 4;
    if (raw[after] === "\r") after++;
    if (raw[after] === "\n") after++;
    return raw.slice(after);
  }

  export { bucketOf, stripFrontmatter };
</script>

<script lang="ts">
  import type { HistoryEntry as HE, Keepsake } from "../../lib/types";
  import { friendlyDate, relativeTime } from "../../lib/format";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    history: HE[];
    preview: string | null;
    currentBody: string;
    noteTitle: string;
    keepsakes?: Keepsake[];
    onHover: (oid: string) => void;
    onRestore: (oid: string) => void;
    onPin?: (oid: string, label: string, note?: string) => void;
    onUnpin?: (keepsakeId: string) => void;
    onClose: () => void;
  }

  let {
    history,
    preview,
    currentBody,
    noteTitle,
    keepsakes,
    onHover,
    onRestore,
    onPin,
    onUnpin,
    onClose,
  }: Props = $props();

  let t = $derived(tr());

  // svelte-ignore state_referenced_locally
  let idx = $state(history.length > 0 ? 0 : -1);
  let confirming = $state(false);
  let showDiffOnly = $state(false);
  let pinPrompt = $state<{ oid: string } | null>(null);
  let pinLabel = $state("");
  let pinNote = $state("");

  let keepsakeByOid = $derived.by(() => {
    const m = new Map<string, Keepsake>();
    for (const k of keepsakes ?? []) {
      if (!m.has(k.oid)) m.set(k.oid, k);
    }
    return m;
  });

  $effect(() => {
    if (idx < 0 || !history[idx]) return;
    const oid = history[idx].oid;
    const id = window.setTimeout(() => onHover(oid), 70);
    return () => window.clearTimeout(id);
  });

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
      if (e.key === "Escape") {
        if (pinPrompt) { pinPrompt = null; return; }
        if (confirming) { confirming = false; return; }
        onClose();
        return;
      }
      if (inInput || pinPrompt) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        idx = Math.min(history.length - 1, idx + 1);
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        idx = Math.max(0, idx - 1);
      }
      if (e.key === "Enter" && idx >= 0 && !confirming) {
        e.preventDefault();
        confirming = true;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let selected = $derived(idx >= 0 ? history[idx] : null);
  let isLatest = $derived(idx === 0);

  let previewBody = $derived(stripFrontmatter(preview));

  let diff = $derived.by(() => {
    if (previewBody == null) return { added: 0, removed: 0 };
    const a = new Set(currentBody.split("\n").map((l) => l.trim()).filter(Boolean));
    const b = new Set(previewBody.split("\n").map((l) => l.trim()).filter(Boolean));
    let added = 0, removed = 0;
    for (const l of a) if (!b.has(l)) added++;
    for (const l of b) if (!a.has(l)) removed++;
    return { added, removed };
  });

  let diffLines = $derived.by(() => {
    if (previewBody == null) return [] as Array<{ text: string; kind: "same" | "gone" | "new" }>;
    const aLines = currentBody.split("\n");
    const bLines = previewBody.split("\n");
    const aSet = new Set(aLines.map((l) => l.trim()));
    const bSet = new Set(bLines.map((l) => l.trim()));
    const out: Array<{ text: string; kind: "same" | "gone" | "new" }> = [];
    for (const l of bLines) {
      if (aSet.has(l.trim())) out.push({ text: l, kind: "same" });
      else out.push({ text: l, kind: "gone" });
    }
    for (const l of aLines) {
      if (!bSet.has(l.trim())) out.push({ text: l, kind: "new" });
    }
    return out;
  });

  let flatRows = $derived.by<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    let lastGroupKey: string | null = null;
    history.forEach((e, i) => {
      const bucket = bucketOf(e.timestamp);
      const groupKey = bucket.key ?? bucket.value ?? "";
      if (lastGroupKey !== groupKey) {
        rows.push({ kind: "header", key: `h:${groupKey}:${i}`, bucket, height: ROW_HEADER_H });
        lastGroupKey = groupKey;
      }
      rows.push({ kind: "entry", key: e.oid, entry: e, i, height: ROW_ENTRY_H });
    });
    return rows;
  });

  let rowOffsets = $derived.by(() => {
    const offsets = new Array<number>(flatRows.length);
    let acc = 0;
    for (let i = 0; i < flatRows.length; i++) {
      offsets[i] = acc;
      acc += flatRows[i].height;
    }
    return { offsets, total: acc };
  });

  let scrollerRef = $state<HTMLElement | null>(null);
  let scrollTop = $state(0);
  let viewportH = $state(0);

  $effect(() => {
    const el = scrollerRef;
    if (!el) return;
    const sync = () => {
      scrollTop = el.scrollTop;
      viewportH = el.clientHeight;
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  });

  const overscan = 6;
  let sliceStart = $derived.by(() => {
    if (rowOffsets.offsets.length === 0) return 0;
    let lo = 0, hi = rowOffsets.offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const end = rowOffsets.offsets[mid] + flatRows[mid].height;
      if (end <= scrollTop) lo = mid + 1;
      else hi = mid;
    }
    return Math.max(0, lo - overscan);
  });
  let sliceEnd = $derived.by(() => {
    if (rowOffsets.offsets.length === 0) return 0;
    const bottom = scrollTop + viewportH;
    let lo = sliceStart, hi = rowOffsets.offsets.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rowOffsets.offsets[mid] < bottom) lo = mid + 1;
      else hi = mid;
    }
    return Math.min(rowOffsets.offsets.length, lo + overscan);
  });
  let visibleRows = $derived(flatRows.slice(sliceStart, sliceEnd));

  $effect(() => {
    if (idx < 0) return;
    const el = scrollerRef;
    if (!el) return;
    const rowIdx = flatRows.findIndex((r) => r.kind === "entry" && r.i === idx);
    if (rowIdx < 0) return;
    const top = rowOffsets.offsets[rowIdx];
    const bottom = top + flatRows[rowIdx].height;
    if (top < el.scrollTop) {
      el.scrollTop = top - ROW_HEADER_H;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight + 4;
    }
  });
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-char/30 animate-fadeIn"
  onmousedown={onClose}
  role="presentation"
>
  <div
    class="w-[820px] max-w-[94vw] h-[560px] max-h-[90vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-slideUp"
    onmousedown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-label={noteTitle}
    tabindex="-1"
  >
    <div class="px-5 py-3 border-b border-bd bg-s1 flex items-center gap-3">
      <div class="min-w-0">
        <div class="font-serif text-lg text-char truncate">{noteTitle}</div>
        <div class="text-2xs text-t3">
          {history.length === 1
            ? t("editor.history.checkpointsOne", { count: String(history.length) })
            : t("editor.history.checkpointsOther", { count: String(history.length) })}
        </div>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-2xs text-t2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDiffOnly}
            onchange={(e) => (showDiffOnly = (e.currentTarget as HTMLInputElement).checked)}
            class="accent-yel"
          />
          {t("editor.history.showDiffOnly")}
        </label>
        <button
          type="button"
          onclick={onClose}
          class="w-7 h-7 flex items-center justify-center rounded-sm hover:bg-s2 text-t2 hover:text-char"
          aria-label={t("editor.history.close")}
        >
          ×
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex overflow-hidden">
      <aside
        bind:this={scrollerRef}
        class="w-[260px] shrink-0 border-r border-bd bg-s1/40 overflow-y-auto relative"
      >
        <div style:height="{rowOffsets.total}px" style:position="relative">
          {#each visibleRows as row, sliceI (row.key)}
            {@const rowIdx = sliceStart + sliceI}
            {@const top = rowOffsets.offsets[rowIdx]}
            {#if row.kind === "header"}
              <div
                class="px-4 pt-2 pb-1 text-2xs uppercase tracking-wider text-t3 font-semibold"
                style:position="absolute"
                style:top="{top}px"
                style:left="0"
                style:right="0"
                style:height="{row.height}px"
              >
                {row.bucket.key ? t(row.bucket.key) : row.bucket.value}
              </div>
            {:else}
              {@const e = row.entry}
              {@const i = row.i}
              {@const isSel = i === idx}
              <div
                style:position="absolute"
                style:top="{top}px"
                style:left="0"
                style:right="0"
                style:height="{row.height}px"
              >
                <button
                  type="button"
                  onclick={() => (idx = i)}
                  onmouseenter={() => (idx = i)}
                  class="w-full h-full text-left px-4 py-2 flex items-start gap-2.5 text-xs transition border-l-2 {isSel ? 'bg-s2 text-char border-yel' : 'text-t2 border-transparent hover:bg-s2 hover:text-char'}"
                >
                  <span class="mt-1 w-2 h-2 rounded-full shrink-0 {isSel ? 'bg-yel' : i === 0 ? 'bg-accent2' : 'bg-bd2'}"></span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="font-medium">
                        {i === 0 ? t("editor.history.now") : relativeTime(e.timestamp)}
                      </span>
                      {#if i === 0}
                        <span class="text-2xs px-1 py-px bg-yelp text-yeld rounded-sm">{t("editor.history.latest")}</span>
                      {/if}
                      {#if keepsakeByOid.has(e.oid)}
                        <span
                          class="yarrow-keepsake-pin"
                          title={t("editor.history.pinnedAs", { label: keepsakeByOid.get(e.oid)?.label ?? "" })}
                        >
                          {t("editor.history.kept")}
                        </span>
                      {/if}
                    </div>
                    <div class="text-2xs text-t3 font-mono mt-0.5">{friendlyDate(e.timestamp)}</div>
                    {#if e.thinking_note}
                      <div class="text-2xs text-yeld italic mt-1 line-clamp-2">"{e.thinking_note}"</div>
                    {/if}
                    {#if keepsakeByOid.has(e.oid)}
                      <div class="text-2xs italic text-yeld/80 mt-1 line-clamp-2">
                        {keepsakeByOid.get(e.oid)?.note || keepsakeByOid.get(e.oid)?.label}
                      </div>
                    {/if}
                  </div>
                </button>
              </div>
            {/if}
          {/each}
        </div>
      </aside>

      <section class="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div class="px-5 py-2 border-b border-bd bg-s1/60 flex items-center gap-3">
          {#if selected}
            <span class="text-2xs uppercase tracking-wider text-t3 font-semibold">{t("editor.history.previewing")}</span>
            <span class="text-xs text-char">{friendlyDate(selected.timestamp)}</span>
            <span class="text-2xs text-t3">({relativeTime(selected.timestamp)})</span>
            <span class="ml-auto flex items-center gap-2 text-2xs font-mono">
              {#if diff.added > 0}
                <span class="text-yeld" title={t("editor.history.addedSinceTitle")}>
                  {t("editor.history.addedSince", { count: String(diff.added) })}
                </span>
              {/if}
              {#if diff.removed > 0}
                <span class="text-danger" title={t("editor.history.removedGoneTitle")}>
                  {t("editor.history.removedGone", { count: String(diff.removed) })}
                </span>
              {/if}
              {#if diff.added === 0 && diff.removed === 0}
                <span class="text-t3">{t("editor.history.identical")}</span>
              {/if}
            </span>
          {:else}
            <span class="text-xs text-t3 italic">{t("editor.history.pickFromTimeline")}</span>
          {/if}
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-4 bg-bg">
          {#if previewBody != null}
            {#if showDiffOnly}
              <div class="font-sans text-sm leading-relaxed space-y-0.5">
                {#if diffLines.filter((l) => l.kind !== "same").length === 0}
                  <div class="text-t3 italic text-sm">{t("editor.history.noDifferences")}</div>
                {/if}
                {#each diffLines.filter((l) => l.kind !== "same") as l, i (i)}
                  <div class={l.kind === "gone"
                    ? "pl-2 border-l-2 border-danger text-t2 line-through decoration-danger/60"
                    : "pl-2 border-l-2 border-yel text-char"}>
                    <span class="text-2xs text-t3 font-mono mr-1.5">{l.kind === "gone" ? "−" : "+"}</span>
                    {#if l.text}{l.text}{:else}<span class="text-t3">·</span>{/if}
                  </div>
                {/each}
              </div>
            {:else}
              <pre class="whitespace-pre-wrap font-sans text-sm text-char leading-relaxed">{#if previewBody}{previewBody}{:else}<span class="text-t3 italic">{t("editor.history.empty")}</span>{/if}</pre>
            {/if}
          {:else}
            <div class="text-t3 italic text-sm">—</div>
          {/if}
        </div>
        {#if selected?.thinking_note}
          <div class="px-5 py-2.5 border-t border-bd bg-yelp/40 text-xs text-yeld italic">
            {t("editor.history.thinkingPrefix", { thinking: selected.thinking_note })}
          </div>
        {/if}
      </section>
    </div>

    <div class="border-t border-bd bg-s1 px-5 py-3 flex items-center gap-3">
      <div class="text-2xs text-t3 font-mono">
        {selected
          ? isLatest
            ? t("editor.history.currentVersion")
            : t("editor.history.goingBack", { when: relativeTime(selected.timestamp) })
          : t("editor.history.noSelection")}
      </div>
      <div class="ml-auto flex items-center gap-2">
        {#if selected && onPin && onUnpin}
          {@const existing = keepsakeByOid.get(selected.oid)}
          {#if existing}
            <button
              type="button"
              onclick={() => onUnpin?.(existing.id)}
              class="px-3 py-1.5 text-xs rounded-md text-yeld hover:bg-yelp/60"
              title={t("editor.history.unpinTitle", { label: existing.label })}
            >
              {t("editor.history.unpin")}
            </button>
          {:else}
            <button
              type="button"
              onclick={() => {
                pinLabel = "";
                pinNote = "";
                pinPrompt = { oid: selected.oid };
              }}
              class="px-3 py-1.5 text-xs rounded-md text-t2 hover:text-yeld hover:bg-yelp/40"
              title={t("editor.history.pinThisTitle")}
            >
              {t("editor.history.pinThis")}
            </button>
          {/if}
        {/if}
        <button
          type="button"
          onclick={onClose}
          class="px-3 py-1.5 text-xs text-t2 hover:text-char"
        >
          {t("editor.history.cancel")}
        </button>
        <button
          type="button"
          disabled={!selected || isLatest}
          onclick={() => (confirming = true)}
          class="btn-yel px-4 py-1.5 text-sm rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
          title={isLatest ? t("editor.history.alreadyCurrentTitle") : t("editor.history.restoreTitle")}
        >
          {t("editor.history.restore")}
        </button>
      </div>
    </div>

    {#if pinPrompt && onPin}
      <div
        class="absolute inset-0 flex items-center justify-center bg-bg/85"
        onclick={() => (pinPrompt = null)}
        role="presentation"
      >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="max-w-sm w-full mx-4 bg-bg border border-bd2 rounded-xl shadow-2xl p-5"
          onclick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t("editor.history.pinDialog.title")}
          tabindex="-1"
        >
          <div class="font-serif text-xl text-char mb-2">{t("editor.history.pinDialog.title")}</div>
          <p class="text-sm text-t2 mb-3 leading-relaxed">{t("editor.history.pinDialog.body")}</p>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            bind:value={pinLabel}
            onkeydown={(e) => {
              if (e.key === "Enter" && pinLabel.trim()) {
                e.preventDefault();
                onPin?.(pinPrompt!.oid, pinLabel.trim(), pinNote.trim() || undefined);
                pinPrompt = null;
              }
              if (e.key === "Escape") pinPrompt = null;
            }}
            autofocus
            placeholder={t("editor.history.pinDialog.labelPlaceholder")}
            class="w-full px-3 py-2 bg-s1 border border-bd rounded-sm text-char text-sm placeholder:text-t3 mb-3 focus:outline-hidden focus:border-yel"
          />
          <textarea
            bind:value={pinNote}
            placeholder={t("editor.history.pinDialog.notePlaceholder")}
            rows="3"
            class="w-full px-3 py-2 bg-s1 border border-bd rounded-sm text-char text-xs placeholder:text-t3 mb-4 focus:outline-hidden focus:border-yel"
          ></textarea>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="px-3 py-1.5 text-sm text-t2 hover:text-char"
              onclick={() => (pinPrompt = null)}
            >
              {t("editor.history.cancel")}
            </button>
            <button
              type="button"
              class="btn-yel px-4 py-1.5 text-sm rounded-md disabled:opacity-40"
              disabled={!pinLabel.trim()}
              onclick={() => {
                onPin?.(pinPrompt!.oid, pinLabel.trim(), pinNote.trim() || undefined);
                pinPrompt = null;
              }}
            >
              {t("editor.history.pinDialog.confirm")}
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if confirming && selected}
      <div
        class="absolute inset-0 flex items-center justify-center bg-bg/85"
        onclick={() => (confirming = false)}
        role="presentation"
      >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="max-w-sm w-full mx-4 bg-bg border border-bd2 rounded-xl shadow-2xl p-5"
          onclick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t("editor.history.confirm.title")}
          tabindex="-1"
        >
          <div class="font-serif text-xl text-char mb-2">{t("editor.history.confirm.title")}</div>
          <p class="text-sm text-t2 mb-1 leading-relaxed">
            {t("editor.history.confirm.bodyLead")}{" "}
            <span class="text-char font-medium">{friendlyDate(selected.timestamp)}</span>.
          </p>
          <p class="text-xs text-t3 mb-4 leading-relaxed">{t("editor.history.confirm.bodyTail")}</p>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="px-3 py-1.5 text-sm text-t2 hover:text-char"
              onclick={() => (confirming = false)}
            >
              {t("editor.history.cancel")}
            </button>
            <!-- svelte-ignore a11y_autofocus -->
            <button
              type="button"
              class="btn-yel px-4 py-1.5 text-sm rounded-md"
              onclick={() => {
                confirming = false;
                onRestore(selected!.oid);
              }}
              autofocus
            >
              {t("editor.history.confirm.yesRestore")}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
