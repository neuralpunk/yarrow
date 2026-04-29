<script lang="ts">
  import Modal from "./Modal.svelte";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    /** Called with the ready-to-insert markdown table body. */
    onInsert: (markdown: string) => void;
  }

  type Alignment = "left" | "center" | "right";

  let { open, onClose, onInsert }: Props = $props();
  let t = $derived(tr());

  let cols = $state(3);
  let rows = $state(3);
  let headers = $state<string[]>(defaultHeaders(3));
  let body = $state<string[][]>(emptyBody(3, 3));
  let align = $state<Alignment[]>(["left", "left", "left"]);

  let inputs: (HTMLInputElement | null)[] = [];

  $effect(() => {
    if (!open) return;
    cols = 3;
    rows = 3;
    headers = defaultHeaders(3);
    body = emptyBody(3, 3);
    align = ["left", "left", "left"];
  });

  // Resize headers/body/align to cols/rows without losing data.
  $effect(() => {
    const c = cols;
    const r = rows;
    if (headers.length !== c) {
      const next = headers.slice(0, c);
      while (next.length < c) next.push(`Column ${next.length + 1}`);
      headers = next;
    }
    if (align.length !== c) {
      const next = align.slice(0, c);
      while (next.length < c) next.push("left");
      align = next;
    }
    const nextBody = body.slice(0, r).map((row) => {
      const r2 = row.slice(0, c);
      while (r2.length < c) r2.push("");
      return r2;
    });
    while (nextBody.length < r) {
      nextBody.push(Array(c).fill(""));
    }
    if (nextBody.length !== body.length || nextBody[0]?.length !== body[0]?.length) {
      body = nextBody;
    }
  });

  let preview = $derived(
    buildTable(
      headers.slice(0, cols),
      body.slice(0, rows).map((r) => r.slice(0, cols)),
      align.slice(0, cols),
    ),
  );

  function commit() {
    onInsert(preview);
    onClose();
  }

  function focusCell(row: number, col: number) {
    if (col < 0 || col >= cols) return;
    const idx = row === -1 ? col : (row + 1) * cols + col;
    const el = inputs[idx];
    if (el) {
      el.focus();
      el.select();
    }
  }

  function onCellKeyDown(row: number, col: number, e: KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (row === -1) focusCell(0, col);
      else if (row < rows - 1) focusCell(row + 1, col);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      let r = row,
        c = col + dir;
      if (c >= cols) {
        c = 0;
        r = row + 1;
      }
      if (c < 0) {
        c = cols - 1;
        r = row - 1;
      }
      if (r < -1) r = -1;
      if (r > rows - 1) r = rows - 1;
      focusCell(r, c);
      return;
    }
  }

  function setHeader(c: number, v: string) {
    headers = headers.map((x, i) => (i === c ? v : x));
  }
  function setCell(r: number, c: number, v: string) {
    body = body.map((row, i) =>
      i === r ? row.map((x, j) => (j === c ? v : x)) : row,
    );
  }
  function rotateAlign(c: number) {
    align = align.map((a, i) => (i === c ? nextAlign(a) : a));
  }

  function nextAlign(a: Alignment): Alignment {
    return a === "left" ? "center" : a === "center" ? "right" : "left";
  }
  function alignGlyph(a: Alignment): string {
    return a === "left" ? "⟵" : a === "center" ? "↔" : "⟶";
  }
  function defaultHeaders(n: number): string[] {
    return Array.from({ length: n }, (_, i) => `Column ${i + 1}`);
  }
  function emptyBody(rs: number, cs: number): string[][] {
    return Array.from({ length: rs }, () =>
      Array.from({ length: cs }, () => ""),
    );
  }

  function buildTable(
    hdrs: string[],
    bd: string[][],
    al: Alignment[],
  ): string {
    const cs = hdrs.length;
    const clean = (s: string) =>
      s.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").trim();
    const headerCells = hdrs.map(clean);
    const bodyCells = bd.map((row) => {
      const r = row.slice(0, cs).map(clean);
      while (r.length < cs) r.push("");
      return r;
    });
    const widths = headerCells.map((h, i) => {
      let w = Math.max(h.length, 3);
      for (const r of bodyCells) {
        w = Math.max(w, r[i].length);
      }
      return w;
    });
    const pad = (s: string, w: number, a: Alignment) => {
      if (s.length >= w) return s;
      const diff = w - s.length;
      if (a === "right") return " ".repeat(diff) + s;
      if (a === "center") {
        const left = Math.floor(diff / 2);
        const right = diff - left;
        return " ".repeat(left) + s + " ".repeat(right);
      }
      return s + " ".repeat(diff);
    };
    const header =
      "| " +
      headerCells.map((h, i) => pad(h, widths[i], al[i])).join(" | ") +
      " |";
    const sep =
      "| " + widths.map((w, i) => alignmentBar(w, al[i])).join(" | ") + " |";
    const bodyLines = bodyCells.map(
      (row) =>
        "| " +
        row.map((c, i) => pad(c, widths[i], al[i])).join(" | ") +
        " |",
    );
    return `\n${header}\n${sep}\n${bodyLines.join("\n")}\n`;
  }

  function alignmentBar(w: number, a: Alignment): string {
    const inner = Math.max(3, w);
    if (a === "center") {
      return ":" + "-".repeat(Math.max(1, inner - 2)) + ":";
    }
    if (a === "right") {
      return "-".repeat(Math.max(2, inner - 1)) + ":";
    }
    return "-".repeat(inner);
  }
</script>

<Modal {open} {onClose} width="w-[780px]">
  {#snippet children()}
    <div class="flex items-baseline justify-between mb-4">
      <h2 class="font-serif text-xl text-char">{t("modals.table.title")}</h2>
      <span class="font-serif italic text-2xs text-t3">
        {t("modals.table.shortcutHint")}
      </span>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-s1 border border-bd rounded-md px-3 py-2">
        <div class="font-serif italic text-2xs text-t3 mb-1">
          {t("modals.table.columns")}
        </div>
        <div class="flex items-center gap-3">
          <button
            onclick={() => { cols = Math.max(1, cols - 1); }}
            disabled={cols <= 1}
            class="w-6 h-6 rounded-sm border border-bd text-t2 hover:bg-s2 hover:text-char disabled:opacity-40 disabled:cursor-not-allowed transition"
          >−</button>
          <div class="font-serif text-2xl text-char w-10 text-center tabular-nums">{cols}</div>
          <button
            onclick={() => { cols = Math.min(8, cols + 1); }}
            disabled={cols >= 8}
            class="w-6 h-6 rounded-sm border border-bd text-t2 hover:bg-s2 hover:text-char disabled:opacity-40 disabled:cursor-not-allowed transition"
          >+</button>
        </div>
      </div>
      <div class="bg-s1 border border-bd rounded-md px-3 py-2">
        <div class="font-serif italic text-2xs text-t3 mb-1">
          {t("modals.table.rows")}
        </div>
        <div class="flex items-center gap-3">
          <button
            onclick={() => { rows = Math.max(1, rows - 1); }}
            disabled={rows <= 1}
            class="w-6 h-6 rounded-sm border border-bd text-t2 hover:bg-s2 hover:text-char disabled:opacity-40 disabled:cursor-not-allowed transition"
          >−</button>
          <div class="font-serif text-2xl text-char w-10 text-center tabular-nums">{rows}</div>
          <button
            onclick={() => { rows = Math.min(20, rows + 1); }}
            disabled={rows >= 20}
            class="w-6 h-6 rounded-sm border border-bd text-t2 hover:bg-s2 hover:text-char disabled:opacity-40 disabled:cursor-not-allowed transition"
          >+</button>
        </div>
      </div>
    </div>

    <div class="mb-4">
      <div class="font-serif italic text-2xs text-t3 mb-2">
        {t("modals.table.fillInLabel")}
      </div>
      <div class="border border-bd rounded-md bg-s1 overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              {#each headers.slice(0, cols) as h, c (c)}
                <th class="p-1 border-b border-bd bg-s2/60">
                  <div class="flex items-stretch gap-1">
                    <input
                      bind:this={inputs[c]}
                      value={h}
                      oninput={(e) =>
                        setHeader(c, (e.currentTarget as HTMLInputElement).value)}
                      onkeydown={(e) => onCellKeyDown(-1, c, e)}
                      placeholder={t("modals.table.columnPlaceholder", {
                        n: String(c + 1),
                      })}
                      class="flex-1 min-w-0 px-2 py-1 bg-transparent border-0 outline-0 font-serif italic text-sm text-char placeholder:text-t3/70 focus:bg-bg/60 rounded-sm"
                    />
                    <button
                      type="button"
                      onclick={() => rotateAlign(c)}
                      title={t("modals.table.alignmentTitle", { align: align[c] })}
                      class="w-7 rounded-sm text-t2 hover:text-char hover:bg-s2 flex items-center justify-center font-mono text-2xs"
                    >{alignGlyph(align[c])}</button>
                  </div>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each body.slice(0, rows) as row, r (r)}
              <tr>
                {#each row.slice(0, cols) as cell, c (c)}
                  <td class="p-1 border-t border-bd">
                    <input
                      bind:this={inputs[(r + 1) * cols + c]}
                      value={cell}
                      oninput={(e) =>
                        setCell(r, c, (e.currentTarget as HTMLInputElement).value)}
                      onkeydown={(e) => onCellKeyDown(r, c, e)}
                      class="w-full px-2 py-1 bg-transparent border-0 outline-0 font-serif text-sm text-char placeholder:text-t3 focus:bg-bg/60 rounded-sm"
                    />
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="mb-4">
      <div class="font-serif italic text-2xs text-t3 mb-1">
        {t("modals.table.markdownPreview")}
      </div>
      <pre class="font-mono text-[11px] text-t2 bg-s1 border border-bd rounded-md p-3 overflow-x-auto whitespace-pre max-h-[180px]">{preview.trim()}</pre>
    </div>

    <div class="flex items-center justify-end gap-2">
      <button onclick={onClose} class="px-3 py-1.5 text-xs text-t2 hover:text-char transition">
        {t("modals.table.cancel")}
      </button>
      <button onclick={commit} class="px-3 py-1.5 text-xs rounded-md bg-char text-bg hover:bg-yeld transition">
        {t("modals.table.insert")}
      </button>
    </div>
  {/snippet}
</Modal>
