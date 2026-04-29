<script lang="ts">
  import Modal from "./Modal.svelte";
  import { api } from "../lib/tauri";
  import { tr } from "../lib/i18n/index.svelte";
  import type { StringKey } from "../lib/i18n/index.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    /** Called with a ready-to-insert markdown callout block. */
    onInsert: (markdown: string) => void;
  }

  let { open, onClose, onInsert }: Props = $props();
  let t = $derived(tr());

  const TYPES = [
    { key: "note",     labelKey: "modals.callout.typeNote",     descKey: "modals.callout.typeNoteDesc" },
    { key: "info",     labelKey: "modals.callout.typeInfo",     descKey: "modals.callout.typeInfoDesc" },
    { key: "tip",      labelKey: "modals.callout.typeTip",      descKey: "modals.callout.typeTipDesc" },
    { key: "question", labelKey: "modals.callout.typeQuestion", descKey: "modals.callout.typeQuestionDesc" },
    { key: "decision", labelKey: "modals.callout.typeDecision", descKey: "modals.callout.typeDecisionDesc" },
    { key: "warning",  labelKey: "modals.callout.typeWarning",  descKey: "modals.callout.typeWarningDesc" },
    { key: "danger",   labelKey: "modals.callout.typeDanger",   descKey: "modals.callout.typeDangerDesc" },
    { key: "quote",    labelKey: "modals.callout.typeQuote",    descKey: "modals.callout.typeQuoteDesc" },
  ] as const satisfies ReadonlyArray<{ key: string; labelKey: StringKey; descKey: StringKey }>;

  type CalloutKey = (typeof TYPES)[number]["key"];

  let type = $state<CalloutKey>("note");
  let title = $state("");
  let body = $state("");
  let previewHtml = $state("");
  let bodyRef = $state<HTMLTextAreaElement | null>(null);

  $effect(() => {
    if (!open) return;
    type = "note";
    title = "";
    body = "";
    previewHtml = "";
    const tid = window.setTimeout(() => {
      const el = document.getElementById(
        "yarrow-callout-title-input",
      ) as HTMLInputElement | null;
      el?.focus();
    }, 30);
    return () => window.clearTimeout(tid);
  });

  let markdown = $derived(buildCallout(type, title, body));

  $effect(() => {
    if (!open) return;
    const md = markdown;
    const h = window.setTimeout(() => {
      api
        .renderMarkdownHtml(md)
        .then((html) => { previewHtml = html; })
        .catch(() => {
          previewHtml = `<p style='color:var(--danger)'>${t("modals.callout.previewFailed")}</p>`;
        });
    }, 160);
    return () => window.clearTimeout(h);
  });

  function commit() {
    onInsert(markdown);
    onClose();
  }

  function onAnyKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  }

  function buildCallout(t: CalloutKey, ti: string, bo: string): string {
    const tt = ti.trim();
    const firstLine = tt ? `> [!${t}] ${tt}` : `> [!${t}]`;
    const bodyLines = bo.split(/\r?\n/).map((l) => `> ${l}`).join("\n");
    const bodyBlock = bo.length > 0 ? `\n${bodyLines}` : "";
    return `\n${firstLine}${bodyBlock}\n`;
  }

  function defaultTitleFor(ty: CalloutKey): string {
    return ty.charAt(0).toUpperCase() + ty.slice(1);
  }
</script>

<Modal {open} {onClose} width="w-[780px]">
  {#snippet children()}
    <div class="flex items-baseline justify-between mb-4">
      <h2 class="font-serif text-xl text-char">{t("modals.callout.title")}</h2>
      <span class="font-serif italic text-2xs text-t3">
        {t("modals.callout.shortcutHint")}
      </span>
    </div>

    <div onkeydown={onAnyKeyDown} role="presentation">
      <!-- type picker -->
      <div class="mb-4">
        <div class="font-serif italic text-2xs text-t3 mb-2">
          {t("modals.callout.typeLabel")}
        </div>
        <div class="grid grid-cols-4 gap-2">
          {#each TYPES as ty (ty.key)}
            {@const active = ty.key === type}
            <button
              type="button"
              onclick={() => {
                type = ty.key;
                bodyRef?.focus();
              }}
              title={t(ty.descKey)}
              class="px-3 py-2 rounded-md border text-left transition flex items-center gap-2 {active
                ? 'bg-yelp border-yel text-char'
                : 'bg-s1 border-bd text-t2 hover:border-bd2 hover:text-char'}"
            >
              <span class="yarrow-callout-icon-chip" data-kind={ty.key} aria-hidden="true"></span>
              <span class="flex-1 min-w-0">
                <span class="font-serif italic text-sm block">{t(ty.labelKey)}</span>
                <span class="font-mono text-2xs text-t3 block truncate">{ty.key}</span>
              </span>
            </button>
          {/each}
        </div>
      </div>

      <!-- title + body inputs -->
      <div class="mb-4 space-y-3">
        <div>
          <label class="font-serif italic text-2xs text-t3 block mb-1" for="yarrow-callout-title-input">
            {t("modals.callout.titleField")}
          </label>
          <input
            id="yarrow-callout-title-input"
            bind:value={title}
            placeholder={defaultTitleFor(type)}
            class="w-full px-3 py-2 bg-s1 border border-bd rounded-sm text-char text-sm placeholder:text-t3 focus:outline-hidden focus:border-yel"
          />
        </div>
        <div>
          <label class="font-serif italic text-2xs text-t3 block mb-1" for="yarrow-callout-body-input">
            {t("modals.callout.bodyField")}
          </label>
          <textarea
            id="yarrow-callout-body-input"
            bind:this={bodyRef}
            bind:value={body}
            placeholder={t("modals.callout.bodyPlaceholder")}
            rows={4}
            class="w-full px-3 py-2 bg-s1 border border-bd rounded-sm text-char text-sm placeholder:text-t3 focus:outline-hidden focus:border-yel resize-y"
          ></textarea>
        </div>
      </div>

      <!-- live preview -->
      <div class="mb-4">
        <div class="font-serif italic text-2xs text-t3 mb-2">
          {t("modals.callout.previewLabel")}
        </div>
        <div class="bg-bg border border-bd rounded-md p-4 max-h-[220px] overflow-y-auto">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <div class="yarrow-reading">
            {@html previewHtml ||
              `<p style="color: var(--t3); font-style: italic;">${t("modals.callout.startTyping")}</p>`}
          </div>
        </div>
      </div>

      <!-- raw markdown peek -->
      <details class="mb-4">
        <summary class="font-serif italic text-2xs text-t3 cursor-pointer hover:text-t2 select-none">
          {t("modals.callout.showRaw")}
        </summary>
        <pre class="mt-2 font-mono text-[11px] text-t2 bg-s1 border border-bd rounded-md p-3 overflow-x-auto whitespace-pre">
{markdown.trim()}
        </pre>
      </details>

      <div class="flex items-center justify-end gap-2">
        <button onclick={onClose} class="px-3 py-1.5 text-xs text-t2 hover:text-char transition">
          {t("modals.callout.cancel")}
        </button>
        <button onclick={commit} class="px-3 py-1.5 text-xs rounded-md bg-char text-bg hover:bg-yeld transition">
          {t("modals.callout.insert")}
        </button>
      </div>
    </div>
  {/snippet}
</Modal>
