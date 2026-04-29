<script lang="ts">
  import { tr } from "../../lib/i18n/index.svelte";

  interface Node {
    depth: number;
    text: string;
    line: number;
    kind: "heading" | "bullet";
  }

  interface Props {
    body: string;
    onJump: (line: number) => void;
  }

  let { body, onJump }: Props = $props();
  let t = $derived(tr());

  const HEADING_RE = /^(#{1,6})\s+(.*)$/;
  const BULLET_RE = /^(\s{0,2})([-*+])\s+(?!\[[ xX]\])(.*)$/;

  function parse(b: string): Node[] {
    const out: Node[] = [];
    const lines = b.split("\n");
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      if (/^\s*```/.test(text)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const h = HEADING_RE.exec(text);
      if (h) {
        out.push({
          depth: h[1].length,
          text: h[2].trim(),
          line: i + 1,
          kind: "heading",
        });
        continue;
      }
      const bm = BULLET_RE.exec(text);
      if (bm) {
        const indent = bm[1].length;
        out.push({
          depth: 7 + Math.min(indent, 1),
          text: bm[3].trim(),
          line: i + 1,
          kind: "bullet",
        });
      }
    }
    return out;
  }

  // svelte-ignore state_referenced_locally
  let debouncedBody = $state(body);
  $effect(() => {
    const b = body;
    const id = window.setTimeout(() => (debouncedBody = b), 220);
    return () => window.clearTimeout(id);
  });

  let nodes = $derived(parse(debouncedBody));
</script>

{#if nodes.length === 0}
  <div class="text-sm text-t3 italic px-1 py-2">
    {t("rightsidebar.outline.empty")}
  </div>
{:else}
  <ul class="text-sm space-y-0.5" role="tree">
    {#each nodes as n, i (`${i}-${n.line}`)}
      {@const padLeft = (n.depth - 1) * 12}
      {@const isHeading = n.kind === "heading"}
      <li role="treeitem" aria-selected="false">
        <button
          type="button"
          onclick={() => onJump(n.line)}
          class={isHeading
            ? "w-full text-left rounded-sm px-2 py-1 hover:bg-s2 transition truncate text-char"
            : "w-full text-left rounded-sm px-2 py-0.5 hover:bg-s2 transition truncate text-t2 hover:text-char"}
          style:padding-left="{8 + padLeft}px"
          title={n.text}
        >
          {#if isHeading && n.depth === 1}
            <span class="font-serif text-[15px] leading-tight">
              {n.text || t("rightsidebar.outline.untitled")}
            </span>
          {:else if isHeading}
            <span class="font-serif">
              {n.text || t("rightsidebar.outline.untitled")}
            </span>
          {:else}
            <span class="text-2xs text-t3 mr-1.5">·</span>
            <span class="font-sans text-xs">
              {n.text || t("rightsidebar.outline.untitled")}
            </span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
{/if}
