<script lang="ts">
  import { api } from "../lib/tauri";
  import { tr } from "../lib/i18n/index.svelte";

  interface Props {
    currentPath: string;
    otherPath: string;
    onClose: () => void;
  }

  let { currentPath, otherPath, onClose }: Props = $props();
  let t = $derived(tr());

  interface Snap {
    slug: string;
    body: string;
  }

  interface NoteChange {
    slug: string;
    kind: "added" | "removed" | "changed" | "same";
    linesAdded: number;
    linesRemoved: number;
    a: string;
    b: string;
  }

  function stripFrontmatter(raw: string): string {
    if (raw.startsWith("---\n")) {
      const end = raw.indexOf("\n---\n", 4);
      if (end !== -1) return raw.slice(end + 5);
    }
    return raw;
  }

  function diffLines(a: string, b: string): { added: number; removed: number } {
    const aSet = new Set(a.split("\n").map((l) => l.trim()).filter(Boolean));
    const bSet = new Set(b.split("\n").map((l) => l.trim()).filter(Boolean));
    let added = 0;
    let removed = 0;
    for (const l of bSet) if (!aSet.has(l)) added++;
    for (const l of aSet) if (!bSet.has(l)) removed++;
    return { added, removed };
  }

  let current = $state<Snap[] | null>(null);
  let other = $state<Snap[] | null>(null);
  let selected = $state<string | null>(null);
  let err = $state<string | null>(null);

  $effect(() => {
    const cp = currentPath;
    const op = otherPath;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          api.notesOnPath(cp),
          api.notesOnPath(op),
        ]);
        current = a;
        other = b;
      } catch (e) {
        err = String(e);
      }
    })();
  });

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  let changes = $derived.by<NoteChange[]>(() => {
    if (!current || !other) return [];
    const aMap = new Map(current.map((n) => [n.slug, stripFrontmatter(n.body)]));
    const bMap = new Map(other.map((n) => [n.slug, stripFrontmatter(n.body)]));
    const slugs = new Set([...aMap.keys(), ...bMap.keys()]);
    const out: NoteChange[] = [];
    for (const s of slugs) {
      const a = aMap.get(s) ?? "";
      const b = bMap.get(s) ?? "";
      if (!aMap.has(s)) {
        out.push({ slug: s, kind: "added", linesAdded: b.split("\n").length, linesRemoved: 0, a, b });
      } else if (!bMap.has(s)) {
        out.push({ slug: s, kind: "removed", linesAdded: 0, linesRemoved: a.split("\n").length, a, b });
      } else if (a !== b) {
        const { added, removed } = diffLines(a, b);
        out.push({ slug: s, kind: "changed", linesAdded: added, linesRemoved: removed, a, b });
      } else {
        out.push({ slug: s, kind: "same", linesAdded: 0, linesRemoved: 0, a, b });
      }
    }
    out.sort((x, y) => {
      const order = { added: 0, changed: 1, removed: 2, same: 3 } as const;
      return order[x.kind] - order[y.kind] || x.slug.localeCompare(y.slug);
    });
    return out;
  });

  let differing = $derived(changes.filter((c) => c.kind !== "same"));
  let selectedChange = $derived(
    selected ? changes.find((c) => c.slug === selected) : differing[0],
  );
</script>

<div class="fixed inset-0 z-50 bg-bg/95 flex flex-col animate-fadeIn">
  <div class="flex items-center px-5 py-3 border-b border-bd bg-s1">
    <div class="font-serif text-lg text-char">
      {t("paths.diff.title")}
    </div>
    <div class="ml-3 text-xs text-t2">
      <span class="text-char font-medium">{currentPath}</span>
      <span class="text-t3 mx-2">↔</span>
      <span class="text-char font-medium">{otherPath}</span>
    </div>
    <button
      onclick={onClose}
      class="ml-auto px-3 py-1 text-xs text-t2 hover:text-char"
    >
      {t("paths.diff.close")}
    </button>
  </div>

  {#if err}
    <div class="p-4 text-sm text-danger">{t("paths.diff.loadError", { message: err })}</div>
  {:else}
    <div class="flex-1 min-h-0 grid grid-cols-[280px_1fr_1fr] overflow-hidden">
      <aside class="border-r border-bd bg-s1/60 overflow-y-auto">
        <div class="px-4 py-3 border-b border-bd">
          <div class="text-2xs text-t3 font-mono">
            {t("paths.diff.summary", {
              differing: String(differing.length),
              identical: String(changes.length - differing.length),
            })}
          </div>
        </div>
        <ul class="p-2 space-y-0.5">
          {#each differing as c (c.slug)}
            <li>
              <button
                onclick={() => (selected = c.slug)}
                class="w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center gap-2 {(selectedChange?.slug ?? '') === c.slug
                  ? 'bg-yelp text-yeld'
                  : 'text-t2 hover:bg-s2 hover:text-char'}"
              >
                {#if c.kind === "added"}
                  <span class="text-2xs font-mono text-yeld">+</span>
                {:else if c.kind === "removed"}
                  <span class="text-2xs font-mono text-danger">−</span>
                {:else if c.kind === "changed"}
                  <span class="text-2xs font-mono text-accent2">~</span>
                {:else}
                  <span class="text-2xs font-mono text-t3">·</span>
                {/if}
                <span class="truncate flex-1">{c.slug}</span>
                {#if c.kind === "changed"}
                  <span class="text-2xs font-mono text-t3">
                    {#if c.linesAdded > 0}<span class="text-yeld">+{c.linesAdded}</span>{/if}
                    {#if c.linesAdded > 0 && c.linesRemoved > 0}{" / "}{/if}
                    {#if c.linesRemoved > 0}<span class="text-danger">−{c.linesRemoved}</span>{/if}
                  </span>
                {/if}
              </button>
            </li>
          {/each}
          {#if differing.length === 0}
            <li class="px-3 py-4 text-xs text-t3 italic">
              {t("paths.diff.identical")}
            </li>
          {/if}
        </ul>
      </aside>

      <div class="flex flex-col overflow-hidden border-r border-bd">
        <div class="px-5 py-2 border-b border-bd bg-s1/60 flex items-baseline gap-2">
          <span class="text-2xs uppercase tracking-wider text-t3 font-semibold">
            {t("paths.diff.labelCurrent")}
          </span>
          <span class="text-xs text-char truncate">{currentPath}</span>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-4">
          {#if selectedChange?.kind === "added"}
            <div class="text-t3 italic text-sm">{t("paths.diff.notOnPath")}</div>
          {:else if selectedChange?.a}
            <pre class="whitespace-pre-wrap font-sans text-sm text-char leading-relaxed">{selectedChange.a}</pre>
          {:else}
            <div class="text-t3 italic text-sm">—</div>
          {/if}
        </div>
      </div>

      <div class="flex flex-col overflow-hidden">
        <div class="px-5 py-2 border-b border-bd bg-s1/60 flex items-baseline gap-2">
          <span class="text-2xs uppercase tracking-wider text-t3 font-semibold">
            {t("paths.diff.labelOther")}
          </span>
          <span class="text-xs text-char truncate">{otherPath}</span>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-4">
          {#if selectedChange?.kind === "removed"}
            <div class="text-t3 italic text-sm">{t("paths.diff.notOnPath")}</div>
          {:else if selectedChange?.b}
            <pre class="whitespace-pre-wrap font-sans text-sm text-char leading-relaxed">{selectedChange.b}</pre>
          {:else}
            <div class="text-t3 italic text-sm">—</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
