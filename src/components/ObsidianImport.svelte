<script lang="ts">
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { api } from "../lib/tauri";
  import { getTransport } from "../lib/transport";
  import type { ObsidianImportReport } from "../lib/types";
  import { tr, type StringKey } from "../lib/i18n/index.svelte";

  interface ImportProgressEvent {
    current: number;
    total: number;
    file: string;
    source: string;
  }

  interface Props {
    open: boolean;
    onClose: () => void;
    onChanged: () => void;
  }

  let { open, onClose, onChanged }: Props = $props();
  let t = $derived(tr());

  type Format = "obsidian" | "bear" | "logseq" | "notion" | "bibtex";

  const FORMATS: Array<{
    id: Format;
    labelKey: StringKey;
    taglineKey: StringKey;
    pickHelpKey: StringKey;
    pickFile?: boolean;
  }> = [
    {
      id: "obsidian",
      labelKey: "modals.import.obsidianLabel",
      taglineKey: "modals.import.obsidianTagline",
      pickHelpKey: "modals.import.obsidianPickHelp",
    },
    {
      id: "bear",
      labelKey: "modals.import.bearLabel",
      taglineKey: "modals.import.bearTagline",
      pickHelpKey: "modals.import.bearPickHelp",
    },
    {
      id: "logseq",
      labelKey: "modals.import.logseqLabel",
      taglineKey: "modals.import.logseqTagline",
      pickHelpKey: "modals.import.logseqPickHelp",
    },
    {
      id: "notion",
      labelKey: "modals.import.notionLabel",
      taglineKey: "modals.import.notionTagline",
      pickHelpKey: "modals.import.notionPickHelp",
    },
    {
      id: "bibtex",
      labelKey: "modals.import.bibtexLabel",
      taglineKey: "modals.import.bibtexTagline",
      pickHelpKey: "modals.import.bibtexPickHelp",
      pickFile: true,
    },
  ];

  let format = $state<Format>("obsidian");
  let source = $state<string | null>(null);
  let running = $state(false);
  let progress = $state<ImportProgressEvent | null>(null);
  let report = $state<ObsidianImportReport | null>(null);
  let error = $state<string | null>(null);
  let unlisten: (() => void) | null = null;

  $effect(() => {
    if (!open) return;
    format = "obsidian";
    source = null;
    running = false;
    progress = null;
    report = null;
    error = null;
  });

  $effect(() => {
    return () => {
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
    };
  });

  let activeMeta = $derived(FORMATS.find((f) => f.id === format)!);

  async function pickFolder() {
    error = null;
    try {
      const sel = await openDialog({
        directory: !activeMeta.pickFile,
        multiple: false,
        filters: activeMeta.pickFile
          ? [{ name: "BibTeX", extensions: ["bib", "bibtex"] }]
          : undefined,
      });
      if (typeof sel === "string") source = sel;
    } catch (e) {
      error = String(e);
    }
  }

  async function run() {
    if (!source) return;
    running = true;
    progress = null;
    error = null;
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
    unlisten = getTransport().subscribe<ImportProgressEvent>(
      "yarrow:import-progress",
      (ev) => {
        if (ev.source !== format) return;
        progress = ev;
      },
    );
    try {
      const r = await (format === "obsidian"
        ? api.importObsidianVault(source)
        : format === "bear"
          ? api.importBearVault(source)
          : format === "logseq"
            ? api.importLogseqVault(source)
            : format === "notion"
              ? api.importNotionVault(source)
              : api.importBibtex(source));
      report = r;
      onChanged();
    } catch (e) {
      error = String(e);
    } finally {
      running = false;
      progress = null;
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 bg-char/30 flex items-center justify-center p-6"
    onmousedown={onClose}
    role="presentation"
  >
    <div
      onmousedown={(e) => e.stopPropagation()}
      class="w-full max-w-lg bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="px-5 py-4 border-b border-bd">
        <div class="font-serif text-xl text-char">{t("modals.import.title")}</div>
        <div class="text-2xs text-t3 mt-0.5 leading-relaxed">
          {t("modals.import.subtitle")}
        </div>
      </div>

      <div class="px-5 py-4 space-y-3">
        <div>
          <div class="font-serif italic text-2xs text-t3 mb-1.5">
            {t("modals.import.sourceHeading")}
          </div>
          <div class="grid grid-cols-4 gap-1.5">
            {#each FORMATS as f (f.id)}
              <button
                onclick={() => {
                  format = f.id;
                  report = null;
                  source = null;
                  error = null;
                }}
                disabled={running}
                class="px-2 py-1.5 text-xs rounded-md border transition {format === f.id
                  ? 'bg-char text-bg border-char'
                  : 'bg-s1 text-t2 border-bd hover:bg-s2 hover:text-char'} disabled:opacity-40"
              >
                {t(f.labelKey)}
              </button>
            {/each}
          </div>
          <div class="text-2xs text-t3 italic font-serif mt-2 leading-relaxed">
            {t(activeMeta.taglineKey)}
          </div>
        </div>

        <button
          onclick={pickFolder}
          disabled={running}
          class="w-full px-3 py-2 bg-s2 hover:bg-s3 text-char text-sm rounded-sm border border-bd disabled:opacity-50"
        >
          {source ? t("modals.import.pickAgain") : t(activeMeta.pickHelpKey)}
        </button>
        {#if source}
          <div class="text-2xs text-t3 font-mono break-all px-1">{source}</div>
        {/if}
        {#if error}
          <div class="text-xs text-danger bg-danger/10 px-3 py-2 rounded-sm">{error}</div>
        {/if}
        {#if running && !report}
          <div class="text-xs text-char bg-yelp/40 border border-yel/30 px-3 py-2 rounded-sm leading-relaxed">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-yel animate-pulse" aria-hidden="true"></span>
              <span class="font-medium">
                {#if progress && progress.total > 0}
                  {t("modals.import.runningProgress", {
                    current: String(Math.min(progress.current + 1, progress.total)),
                    total: String(progress.total),
                    source: t(activeMeta.labelKey),
                  })}
                {:else}
                  {t("modals.import.runningTitle", { source: t(activeMeta.labelKey) })}
                {/if}
              </span>
            </div>
            {#if progress && progress.total > 0}
              <div
                class="mt-2 h-1 rounded-full bg-bd overflow-hidden"
                role="progressbar"
                aria-valuenow={progress.current}
                aria-valuemin={0}
                aria-valuemax={progress.total}
              >
                <div
                  class="h-full bg-yel transition-[width] duration-150"
                  style:width="{Math.min(100, Math.round((progress.current / Math.max(1, progress.total)) * 100))}%"
                ></div>
              </div>
            {/if}
            <div class="text-2xs text-t2 mt-1 leading-relaxed truncate font-mono">
              {progress?.file ? progress.file : t("modals.import.runningBody")}
            </div>
          </div>
        {/if}
        {#if report}
          <div class="text-xs text-char bg-yelp/40 border border-yel/30 px-3 py-2 rounded-sm space-y-1">
            <div>
              {report.imported === 1
                ? t("modals.import.importedOne", { imported: String(report.imported), source: t(activeMeta.labelKey) })
                : t("modals.import.importedMany", { imported: String(report.imported), source: t(activeMeta.labelKey) })}
              {#if report.skipped > 0}
                {" "}{t("modals.import.skipped", { skipped: String(report.skipped) })}
              {/if}
            </div>
            {#if report.renamed.length > 0}
              <details class="text-2xs text-t2">
                <summary class="cursor-pointer text-t3">
                  {t("modals.import.renamedSummary", { count: String(report.renamed.length) })}
                </summary>
                <ul class="mt-1 max-h-32 overflow-y-auto font-mono space-y-0.5">
                  {#each report.renamed as [orig, slug] (orig)}
                    <li class="truncate">
                      {orig} → <span class="text-char">{slug}</span>
                    </li>
                  {/each}
                </ul>
              </details>
            {/if}
          </div>
        {/if}
      </div>

      <div class="px-5 py-3 border-t border-bd flex justify-end gap-2">
        <button
          onclick={onClose}
          class="text-xs px-3 py-1.5 rounded-sm bg-s2 text-t2 hover:bg-s3 hover:text-char"
        >
          {report ? t("modals.import.done") : t("modals.import.cancel")}
        </button>
        {#if !report}
          <button
            disabled={!source || running}
            onclick={run}
            class="text-xs px-3 py-1.5 rounded-sm bg-yel text-on-yel hover:bg-yeld disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? t("modals.import.importing") : t("modals.import.importFromAction", { source: t(activeMeta.labelKey) })}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
