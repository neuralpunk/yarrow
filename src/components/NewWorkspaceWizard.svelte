<script module lang="ts">
  import type { PersonaId } from "../lib/modes";

  export type ImportSource = "obsidian" | "bear" | "logseq" | "notion";
  export type Origin =
    | { kind: "empty" }
    | { kind: "import"; source: ImportSource; vaultPath: string | null }
    | { kind: "clone"; url: string };

  export const IMPORT_SOURCES: Array<{
    id: ImportSource;
    label: string;
    taglineKey: "wizard.import.obsidian.tagline" | "wizard.import.bear.tagline" | "wizard.import.logseq.tagline" | "wizard.import.notion.tagline";
    pickHelpKey: "wizard.import.obsidian.pickHelp" | "wizard.import.bear.pickHelp" | "wizard.import.logseq.pickHelp" | "wizard.import.notion.pickHelp";
  }> = [
    { id: "obsidian", label: "Obsidian", taglineKey: "wizard.import.obsidian.tagline", pickHelpKey: "wizard.import.obsidian.pickHelp" },
    { id: "bear",     label: "Bear",     taglineKey: "wizard.import.bear.tagline",     pickHelpKey: "wizard.import.bear.pickHelp" },
    { id: "logseq",   label: "Logseq",   taglineKey: "wizard.import.logseq.tagline",   pickHelpKey: "wizard.import.logseq.pickHelp" },
    { id: "notion",   label: "Notion",   taglineKey: "wizard.import.notion.tagline",   pickHelpKey: "wizard.import.notion.pickHelp" },
  ];

  export const DEFAULT_NAME = "My notebook";

  export const PERSONA_TILES: ReadonlyArray<{
    id: PersonaId;
    labelKey: "settings.mode.option.writer.label" | "settings.mode.option.researcher.label" | "settings.mode.option.developer.label" | "settings.mode.option.clinician.label" | "settings.mode.option.cooking.label";
    descKey: "settings.mode.option.writer.desc" | "settings.mode.option.researcher.desc" | "settings.mode.option.developer.desc" | "settings.mode.option.clinician.desc" | "settings.mode.option.cooking.desc";
  }> = [
    { id: "writer",     labelKey: "settings.mode.option.writer.label",     descKey: "settings.mode.option.writer.desc" },
    { id: "researcher", labelKey: "settings.mode.option.researcher.label", descKey: "settings.mode.option.researcher.desc" },
    { id: "developer",  labelKey: "settings.mode.option.developer.label",  descKey: "settings.mode.option.developer.desc" },
    { id: "clinician",  labelKey: "settings.mode.option.clinician.label",  descKey: "settings.mode.option.clinician.desc" },
    { id: "cooking",    labelKey: "settings.mode.option.cooking.label",    descKey: "settings.mode.option.cooking.desc" },
  ];
</script>

<script lang="ts">
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { api } from "../lib/tauri";
  import type { WorkspaceMode } from "../lib/types";
  import { tr } from "../lib/i18n/index.svelte";
  import { mode as modeStore } from "../lib/mode.svelte";
  import { MODE_DOT_CLASS } from "../lib/modes";

  interface Props {
    open: boolean;
    onClose: () => void;
    onReady: (path: string) => void;
    firstRun?: boolean;
  }

  let { open, onClose, onReady, firstRun }: Props = $props();
  let t = $derived(tr());

  // svelte-ignore state_referenced_locally
  let guided = $state(!!firstRun);
  let origin = $state<Origin>({ kind: "empty" });
  let name = $state(DEFAULT_NAME);
  let parent = $state("");
  let workspaceMode = $state<WorkspaceMode>("mapped");
  let startingTitle = $state("");
  let persona = $state<PersonaId | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let progress = $state<string | null>(null);

  $effect(() => {
    if (!open) return;
    guided = !!firstRun;
    origin = { kind: "empty" };
    name = DEFAULT_NAME;
    workspaceMode = "mapped";
    startingTitle = "";
    persona = null;
    busy = false;
    error = null;
    progress = null;
    api.defaultWorkspacesRoot().then((p) => (parent = p)).catch(() => (parent = ""));
  });

  let previewPath = $derived.by(() => {
    if (!parent || !name.trim()) return "";
    const sep = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
    const trimmed = parent.replace(/[\\/]+$/, "");
    return `${trimmed}${sep}${name.trim()}`;
  });

  async function create() {
    error = null;
    if (!parent.trim()) { error = t("wizard.error.pickLocation"); return; }
    if (!name.trim()) { error = t("wizard.error.giveName"); return; }
    if (origin.kind === "clone" && !origin.url.trim()) {
      error = t("wizard.error.giveUrl");
      return;
    }
    if (workspaceMode === "mapped" && origin.kind === "empty" && !startingTitle.trim()) {
      error = t("wizard.error.nameStartingNote");
      return;
    }
    busy = true;
    try {
      if (origin.kind === "clone") {
        progress = t("wizard.progress.cloning");
        await api.cloneWorkspace(parent.trim(), name.trim(), origin.url.trim());
        progress = t("wizard.progress.cloned");
        const sep = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
        const trimmed = parent.replace(/[\\/]+$/, "");
        const path = `${trimmed}${sep}${name.trim()}`;
        modeStore.set(workspaceMode === "basic" ? "basic" : (persona ?? "path"));
        onReady(path);
        return;
      }
      progress = t("wizard.progress.creatingFolder");
      const path = await api.createWorkspaceDir(parent.trim(), name.trim());
      progress = t("wizard.progress.initializing");
      await api.initWorkspace(
        path,
        undefined,
        workspaceMode,
        origin.kind === "import"
          ? undefined
          : (workspaceMode === "mapped" ? (startingTitle.trim() || undefined) : undefined),
      );
      if (origin.kind === "import" && origin.vaultPath) {
        const importOrigin: { source: ImportSource; vaultPath: string } = {
          source: origin.source,
          vaultPath: origin.vaultPath,
        };
        const sourceMeta = IMPORT_SOURCES.find((s) => s.id === importOrigin.source)!;
        progress = t("wizard.progress.importing", { source: sourceMeta.label });
        const report = await (importOrigin.source === "obsidian"
          ? api.importObsidianVault(importOrigin.vaultPath)
          : importOrigin.source === "bear"
            ? api.importBearVault(importOrigin.vaultPath)
            : importOrigin.source === "logseq"
              ? api.importLogseqVault(importOrigin.vaultPath)
              : api.importNotionVault(importOrigin.vaultPath));
        progress =
          report.imported === 1
            ? t("wizard.progress.importedOne", { source: sourceMeta.label })
            : t("wizard.progress.importedMany", { count: String(report.imported), source: sourceMeta.label });
      }
      modeStore.set(workspaceMode === "basic" ? "basic" : (persona ?? "path"));
      onReady(path);
    } catch (e) {
      error = String(e);
      progress = null;
    } finally {
      busy = false;
    }
  }

  // Step state — separate per-flow but tracked locally
  let guidedStep = $state(0);
  let quickStep = $state(0);

  $effect(() => {
    if (!open) return;
    guidedStep = 0;
    quickStep = 0;
  });

  let importing = $derived(origin.kind === "import");
  let cloning = $derived(origin.kind === "clone");
  let importNeedsFolder = $derived(importing && !(origin.kind === "import" && origin.vaultPath));
  let cloneNeedsUrl = $derived(cloning && !(origin.kind === "clone" && origin.url.trim()));

  let canAdvanceGuided = $derived.by(() => {
    if (guidedStep === 0) return !importNeedsFolder && !cloneNeedsUrl;
    if (guidedStep === 1) return name.trim().length > 0;
    if (guidedStep === 2) return parent.trim().length > 0;
    if (guidedStep === 3) {
      if (workspaceMode === "mapped" && origin.kind === "empty" && !startingTitle.trim()) return false;
      return true;
    }
    return false;
  });

  let canAdvanceQuick = $derived.by(() => {
    if (quickStep === 0)
      return !importNeedsFolder && !cloneNeedsUrl && name.trim().length > 0;
    if (quickStep === 1) {
      if (!parent.trim()) return false;
      if (workspaceMode === "mapped" && origin.kind === "empty" && !startingTitle.trim()) return false;
      return true;
    }
    return false;
  });

  function onGuidedNext() {
    if (!canAdvanceGuided) {
      if (guidedStep === 0 && importNeedsFolder) error = t("wizard.error.pickSourceFolder");
      else if (guidedStep === 0 && cloneNeedsUrl) error = t("wizard.error.giveUrl");
      else if (guidedStep === 1) error = t("wizard.error.giveName");
      else if (guidedStep === 2) error = t("wizard.error.pickLocation");
      else if (guidedStep === 3) error = t("wizard.error.nameStartingNote");
      return;
    }
    error = null;
    if (guidedStep === 3) create();
    else guidedStep += 1;
  }
  function onGuidedBack() {
    error = null;
    if (guidedStep === 0) onClose();
    else guidedStep -= 1;
  }

  function onQuickNext() {
    if (!canAdvanceQuick) {
      if (quickStep === 0) {
        if (importNeedsFolder) error = t("wizard.error.pickSourceFolder");
        else if (cloneNeedsUrl) error = t("wizard.error.giveUrl");
        else if (!name.trim()) error = t("wizard.error.giveName");
      } else {
        if (!parent.trim()) error = t("wizard.error.pickLocation");
        else error = t("wizard.error.nameStartingNote");
      }
      return;
    }
    error = null;
    if (quickStep === 1) create();
    else quickStep = 1;
  }
  function onQuickBack() {
    error = null;
    if (quickStep === 0) onClose();
    else quickStep = 0;
  }

  async function pickImportFolder() {
    if (origin.kind !== "import") return;
    error = null;
    try {
      const sel = await openDialog({ directory: true, multiple: false });
      if (typeof sel === "string") {
        origin = { kind: "import", source: origin.source, vaultPath: sel };
        const leaf = sel.split(/[\\/]/).filter(Boolean).pop();
        if (leaf) name = leaf;
      }
    } catch (e) {
      error = String(e);
    }
  }

  async function pickParent() {
    error = null;
    try {
      const sel = await openDialog({ directory: true, multiple: false });
      if (typeof sel === "string") parent = sel;
    } catch (e) {
      error = String(e);
    }
  }

  let activeDesc = $derived(
    persona === null
      ? t("wizard.guide.shape.personaNone.desc")
      : t(PERSONA_TILES.find((p) => p.id === persona)!.descKey),
  );
</script>

{#snippet primaryButton(onClick: () => void, disabled: boolean, label: string)}
  <button
    type="button"
    onclick={onClick}
    {disabled}
    class="yarrow-intro-figtree inline-flex items-center"
    style:background="var(--i-ink-2)"
    style:color="var(--i-ink-on-btn)"
    style:border="0"
    style:padding="11px 22px"
    style:border-radius="999px"
    style:font-size="14px"
    style:font-weight="500"
    style:gap="10px"
    style:cursor={disabled ? "not-allowed" : "pointer"}
    style:opacity={disabled ? 0.55 : 1}
  >
    <span aria-hidden="true" style:width="6px" style:height="6px" style:border-radius="999px" style:background="var(--i-accent-soft)" style:display="inline-block"></span>
    {label}
  </button>
{/snippet}

{#snippet secondaryButton(onClick: () => void, disabled: boolean, label: string)}
  <button
    type="button"
    onclick={onClick}
    {disabled}
    class="yarrow-intro-figtree"
    style:background="transparent"
    style:border="0"
    style:padding="11px 12px"
    style:color="var(--i-mute)"
    style:font-size="13.5px"
    style:cursor={disabled ? "not-allowed" : "pointer"}
    style:opacity={disabled ? 0.6 : 1}
  >
    {label}
  </button>
{/snippet}

{#snippet errorBlock()}
  {#if error}
    <div
      style:margin-top="12px"
      style:padding="10px 14px"
      style:border-radius="8px"
      style:background="color-mix(in srgb, #a04a4a 12%, transparent)"
      style:border="1px solid color-mix(in srgb, #a04a4a 30%, transparent)"
      style:color="#a04a4a"
      style:font-size="12.5px"
      role="alert"
    >
      <div class="yarrow-intro-mono uppercase" style:font-size="9.5px" style:letter-spacing="0.16em" style:margin-bottom="3px" style:opacity="0.9">
        {t("wizard.error.label")}
      </div>
      <div class="yarrow-intro-figtree">{error}</div>
    </div>
  {/if}
{/snippet}

{#snippet progressBlock()}
  {#if progress}
    <div
      style:margin-top="12px"
      style:padding="10px 14px"
      style:border-radius="8px"
      style:background="var(--i-key-bg)"
      style:border="1px solid var(--i-rule-strong)"
      aria-live="polite"
    >
      <div class="yarrow-intro-mono uppercase" style:font-size="9.5px" style:letter-spacing="0.16em" style:color="var(--i-mute)" style:margin-bottom="3px">
        {t("wizard.progress.title")}
      </div>
      <div class="yarrow-intro-figtree" style:font-size="12.5px" style:color="var(--i-char)">
        {progress}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet stepHeading(eyebrow: string | null, title: string, body: string | null)}
  <div style:margin-bottom="20px">
    {#if eyebrow}
      <div class="yarrow-intro-mono uppercase" style:font-size="11px" style:letter-spacing="0.18em" style:color="var(--i-mute)" style:margin-bottom="10px">
        {eyebrow}
      </div>
    {/if}
    <h2 class="yarrow-intro-mark" style:font-size="28px" style:margin="0" style:color="var(--i-ink)" style:line-height="1.1">
      {title}
    </h2>
    {#if body}
      <p class="yarrow-intro-figtree" style:margin="10px 0 0" style:color="var(--i-char)" style:font-size="13.5px" style:line-height="1.5" style:max-width="60ch">
        {body}
      </p>
    {/if}
  </div>
{/snippet}

{#snippet choiceTile(active: boolean, onClick: () => void, title: string, body: string)}
  <button
    type="button"
    onclick={onClick}
    class="yarrow-intro-figtree"
    style:width="100%"
    style:text-align="left"
    style:background={active ? "var(--i-row-selected)" : "transparent"}
    style:border="1px solid {active ? 'var(--i-accent)' : 'var(--i-rule-strong)'}"
    style:border-radius="12px"
    style:padding="16px 18px"
    style:cursor="pointer"
    style:box-shadow={active ? "inset 2px 0 0 var(--i-accent)" : "none"}
    style:transition="background 120ms ease, border-color 120ms ease"
  >
    <div class="yarrow-intro-name" style:font-size="20px" style:margin-bottom="6px">{title}</div>
    <div style:font-size="13.5px" style:color="var(--i-char)" style:line-height="1.55">{body}</div>
  </button>
{/snippet}

{#snippet shapeTile(active: boolean, onClick: () => void, title: string, body: string)}
  <button
    type="button"
    onclick={onClick}
    class="yarrow-intro-figtree"
    style:text-align="left"
    style:background={active ? "var(--i-row-selected)" : "transparent"}
    style:border="1px solid {active ? 'var(--i-accent)' : 'var(--i-rule-strong)'}"
    style:border-radius="10px"
    style:padding="14px"
    style:cursor="pointer"
  >
    <div class="yarrow-intro-name" style:font-size="17px" style:margin-bottom="4px">{title}</div>
    <div style:font-size="13px" style:color="var(--i-char)" style:line-height="1.5">{body}</div>
  </button>
{/snippet}

{#snippet personaTile(active: boolean, dotClass: string, title: string, onClick: () => void)}
  <button
    type="button"
    onclick={onClick}
    class="yarrow-intro-figtree"
    style:text-align="left"
    style:background={active ? "var(--i-row-selected)" : "transparent"}
    style:border="1px solid {active ? 'var(--i-accent)' : 'var(--i-rule-strong)'}"
    style:border-radius="10px"
    style:padding="10px 12px"
    style:cursor="pointer"
    style:display="flex"
    style:align-items="center"
    style:gap="9px"
    style:min-height="40px"
    style:box-shadow={active ? "inset 2px 0 0 var(--i-accent)" : "none"}
    style:transition="background 120ms ease, border-color 120ms ease"
  >
    <span aria-hidden="true" class={dotClass} style:width="9px" style:height="9px" style:border-radius="999px" style:display="inline-block" style:flex-shrink="0"></span>
    <span class="yarrow-intro-name" style:font-size="15px" style:color="var(--i-ink)" style:font-weight={active ? 600 : 400}>
      {title}
    </span>
  </button>
{/snippet}

{#snippet personaPicker()}
  <div>
    <p class="yarrow-intro-figtree" style:margin="0 0 10px" style:font-size="12.5px" style:color="var(--i-mute)" style:line-height="1.5">
      {t("wizard.guide.shape.personaIntro")}
    </p>
    <div style:display="grid" style:grid-template-columns="repeat(3, 1fr)" style:gap="8px">
      {@render personaTile(persona === null, MODE_DOT_CLASS.path, t("wizard.guide.shape.personaNone.label"), () => (persona = null))}
      {#each PERSONA_TILES as p (p.id)}
        {@render personaTile(persona === p.id, MODE_DOT_CLASS[p.id], t(p.labelKey), () => (persona = p.id))}
      {/each}
    </div>
    <p class="yarrow-intro-figtree" style:margin="8px 0 0" style:font-size="12.5px" style:color="var(--i-char)" style:line-height="1.45" style:min-height="1.45em" aria-live="polite">
      {activeDesc}
    </p>
  </div>
{/snippet}

{#snippet tip(text: string)}
  <li style:display="flex" style:align-items="baseline" style:gap="8px">
    <span aria-hidden="true" style:width="14px" style:height="14px" style:border-radius="999px" style:background="var(--i-accent-soft)" style:color="var(--i-ink)" style:font-family="'Oranienbaum', 'Fraunces', serif" style:font-style="italic" style:font-size="10px" style:display="inline-flex" style:align-items="center" style:justify-content="center" style:flex-shrink="0" style:margin-top="2px">
      i
    </span>
    <span>{text}</span>
  </li>
{/snippet}

{#snippet startingPointBody()}
  <div style:display="flex" style:flex-direction="column" style:gap="14px">
    {@render choiceTile(origin.kind === "empty", () => (origin = { kind: "empty" }), t("wizard.guide.start.blank.title"), t("wizard.guide.start.blank.body"))}
    <div>
      {@render choiceTile(origin.kind === "import", () => { if (origin.kind !== "import") origin = { kind: "import", source: "obsidian", vaultPath: null }; }, t("wizard.guide.start.import.title"), t("wizard.guide.start.import.body"))}
      {#if origin.kind === "import"}
        <div style:margin-top="14px" style:padding="16px 18px" style:border-radius="10px" style:background="var(--i-key-bg)" style:border="1px solid var(--i-rule)">
          <div style:display="grid" style:grid-template-columns="repeat(2, 1fr)" style:gap="8px" style:margin-bottom="12px">
            {#each IMPORT_SOURCES as s (s.id)}
              {@const selected = origin.kind === "import" && origin.source === s.id}
              <button
                type="button"
                disabled={busy}
                onclick={() => {
                  if (origin.kind === "import") origin = { kind: "import", source: s.id, vaultPath: origin.source === s.id ? origin.vaultPath : null };
                }}
                class="yarrow-intro-figtree"
                style:background={selected ? "var(--i-paper)" : "transparent"}
                style:border="1px solid {selected ? 'var(--i-accent)' : 'var(--i-rule-strong)'}"
                style:border-radius="8px"
                style:padding="10px 13px"
                style:font-size="13.5px"
                style:color="var(--i-ink)"
                style:cursor="pointer"
                style:text-align="left"
              >
                <span style:font-weight={selected ? 600 : 400}>{s.label}</span>
              </button>
            {/each}
          </div>
          <p class="yarrow-intro-figtree" style:margin="0" style:font-size="13px" style:color="var(--i-mute)" style:line-height="1.55">
            {t(IMPORT_SOURCES.find((s) => s.id === (origin.kind === "import" ? origin.source : "obsidian"))!.taglineKey)}
          </p>
          <p class="yarrow-intro-figtree" style:margin="6px 0 12px" style:font-size="13px" style:color="var(--i-char)" style:line-height="1.55">
            {t(IMPORT_SOURCES.find((s) => s.id === (origin.kind === "import" ? origin.source : "obsidian"))!.pickHelpKey)}
          </p>
          <button
            type="button"
            disabled={busy}
            onclick={pickImportFolder}
            class="yarrow-intro-figtree"
            style:background="transparent"
            style:border="1px solid var(--i-rule-strong)"
            style:border-radius="999px"
            style:padding="8px 16px"
            style:font-size="13px"
            style:color="var(--i-ink)"
            style:cursor="pointer"
          >
            {origin.kind === "import" && origin.vaultPath
              ? t("wizard.shape.import.pickAnotherFolder")
              : t("wizard.shape.import.pickFolder")}
          </button>
          {#if origin.kind === "import" && origin.vaultPath}
            <div class="yarrow-intro-mono" style:margin-top="10px" style:font-size="12px" style:color="var(--i-mute)" style:word-break="break-all">
              {origin.vaultPath}
            </div>
          {/if}
          <ul class="yarrow-intro-figtree" style:list-style="none" style:margin="14px 0 0" style:padding="0" style:display="flex" style:flex-direction="column" style:gap="6px" style:font-size="12.5px" style:color="var(--i-mute)">
            {@render tip(t("wizard.tip.preserved"))}
            {@render tip(t("wizard.tip.skippedConfig"))}
            {@render tip(t("wizard.tip.checkpointed"))}
          </ul>
        </div>
      {/if}
    </div>
    <div>
      {@render choiceTile(origin.kind === "clone", () => { if (origin.kind !== "clone") origin = { kind: "clone", url: "" }; }, t("wizard.guide.start.clone.title"), t("wizard.guide.start.clone.body"))}
      {#if origin.kind === "clone"}
        <div style:margin-top="14px" style:padding="16px 18px" style:border-radius="10px" style:background="var(--i-key-bg)" style:border="1px solid var(--i-rule)">
          <label class="yarrow-intro-mono uppercase" for="wizard-clone-url" style:display="block" style:font-size="11px" style:letter-spacing="0.18em" style:color="var(--i-mute)" style:margin-bottom="8px">
            {t("wizard.clone.urlLabel")}
          </label>
          <input
            id="wizard-clone-url"
            type="text"
            value={origin.url}
            oninput={(e) => (origin = { kind: "clone", url: (e.currentTarget as HTMLInputElement).value })}
            placeholder={t("wizard.clone.urlPlaceholder")}
            class="yarrow-intro-mono yarrow-intro-input"
            disabled={busy}
            style:width="100%"
            style:font-size="13.5px"
            style:background="var(--i-paper)"
            style:border="1px solid var(--i-rule-strong)"
            style:border-radius="10px"
            style:padding="11px 14px"
            style:outline="none"
            style:color="var(--i-ink)"
          />
          <p class="yarrow-intro-figtree" style:margin="10px 0 0" style:font-size="12.5px" style:color="var(--i-mute)" style:line-height="1.5">
            {t("wizard.clone.help")}
          </p>
          <p class="yarrow-intro-figtree" style:margin="6px 0 0" style:font-size="12.5px" style:color="var(--i-mute)" style:line-height="1.5" style:font-style="italic">
            {t("wizard.clone.gateNote")}
          </p>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet nameField()}
  <div>
    <label class="yarrow-intro-mono uppercase" for="wizard-name" style:display="block" style:font-size="11px" style:letter-spacing="0.18em" style:color="var(--i-mute)" style:margin-bottom="10px">
      {t("wizard.details.nameLabel")}
    </label>
    <input
      id="wizard-name"
      type="text"
      bind:value={name}
      placeholder={t("wizard.details.namePlaceholder")}
      class="yarrow-intro-name yarrow-intro-input"
      style:width="100%"
      style:font-size="26px"
      style:background="var(--i-paper)"
      style:border="1px solid var(--i-rule-strong)"
      style:border-radius="10px"
      style:padding="10px 14px"
      style:outline="none"
      style:color="var(--i-ink)"
    />
    {#if name.trim()}
      <div style:margin-top="14px" style:display="flex" style:align-items="baseline" style:gap="10px" style:font-size="12.5px" style:color="var(--i-mute)" class="yarrow-intro-figtree">
        <span class="yarrow-intro-mono uppercase" style:letter-spacing="0.18em" style:font-size="11px">
          {t("wizard.guide.name.previewLabel")}
        </span>
        <span class="yarrow-intro-name" style:font-size="17px" style:color="var(--i-ink)">
          {name.trim()}
        </span>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet locationField()}
  <div>
    <label class="yarrow-intro-mono uppercase" for="wizard-loc" style:display="block" style:font-size="11px" style:letter-spacing="0.18em" style:color="var(--i-mute)" style:margin-bottom="10px">
      {t("wizard.details.locationLabel")}
    </label>
    <div style:display="flex" style:gap="10px" style:align-items="stretch">
      <input
        id="wizard-loc"
        type="text"
        bind:value={parent}
        placeholder="/home/you/Documents"
        class="yarrow-intro-mono yarrow-intro-input"
        style:flex="1"
        style:min-width="0"
        style:font-size="13.5px"
        style:background="var(--i-paper)"
        style:border="1px solid var(--i-rule-strong)"
        style:border-radius="10px"
        style:padding="11px 14px"
        style:outline="none"
        style:color="var(--i-ink)"
      />
      <button
        type="button"
        onclick={pickParent}
        class="yarrow-intro-figtree"
        style:background="var(--i-key-bg)"
        style:border="1px solid var(--i-rule-strong)"
        style:border-radius="10px"
        style:padding="0 16px"
        style:font-size="13px"
        style:color="var(--i-ink)"
        style:cursor="pointer"
        style:white-space="nowrap"
        style:flex-shrink="0"
      >
        {t("wizard.details.locationBrowse")}
      </button>
    </div>
    {#if previewPath}
      <div style:margin-top="14px">
        <div class="yarrow-intro-mono uppercase" style:font-size="11px" style:letter-spacing="0.18em" style:color="var(--i-mute)" style:margin-bottom="6px">
          {t("wizard.guide.location.willCreate")}
        </div>
        <div class="yarrow-intro-mono" style:font-size="12.5px" style:color="var(--i-char)" style:padding="8px 12px" style:border-radius="8px" style:background="var(--i-key-bg)" style:word-break="break-all" style:font-style="italic">
          {previewPath}
        </div>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet shapeField(showHint: boolean)}
  {@const showStartingNote = workspaceMode === "mapped" && origin.kind === "empty"}
  {@const showPersona = workspaceMode === "mapped"}
  <div style:display="flex" style:flex-direction="column" style:gap="14px">
    <div style:display="grid" style:grid-template-columns="1fr 1fr" style:gap="12px">
      {@render shapeTile(workspaceMode === "mapped", () => (workspaceMode = "mapped"), t("wizard.details.mode.mapped.title"), t("wizard.details.mode.mapped.body"))}
      {@render shapeTile(workspaceMode === "basic", () => (workspaceMode = "basic"), t("wizard.details.mode.basic.title"), t("wizard.details.mode.basic.body"))}
    </div>
    {#if showPersona}
      {@render personaPicker()}
    {/if}
    {#if showStartingNote}
      <div>
        <label class="yarrow-intro-mono uppercase" for="wizard-starting" style:display="block" style:font-size="11px" style:letter-spacing="0.18em" style:color="var(--i-mute)" style:margin-bottom="8px">
          {t("wizard.details.startingNoteLabel")}
        </label>
        <input
          id="wizard-starting"
          type="text"
          bind:value={startingTitle}
          placeholder={t("wizard.details.startingNotePlaceholder")}
          class="yarrow-intro-name yarrow-intro-input"
          style:width="100%"
          style:font-size="20px"
          style:background="var(--i-paper)"
          style:border="1px solid var(--i-rule-strong)"
          style:border-radius="10px"
          style:padding="10px 14px"
          style:outline="none"
          style:color="var(--i-ink)"
        />
        {#if showHint}
          <p class="yarrow-intro-figtree" style:margin-top="8px" style:font-size="12.5px" style:color="var(--i-mute)" style:line-height="1.5">
            {t("wizard.guide.shape.startingNoteHint")}
          </p>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet stepShell(eyebrow: string, crumbs: string[], activeIdx: number, onCrumbClick: ((i: number) => void) | null, skipLabel: string | null, onSkip: (() => void) | null, body: import("svelte").Snippet, footer: import("svelte").Snippet)}
  <aside style:width="190px" style:flex-shrink="0" style:padding="28px 20px 24px 26px" style:border-right="1px solid var(--i-rule)" style:display="flex" style:flex-direction="column">
    <div class="yarrow-intro-mono uppercase" style:font-size="11px" style:letter-spacing="0.18em" style:color="var(--i-mute)" style:margin-bottom="20px">
      {eyebrow}
    </div>
    <div aria-hidden="true" style:width="32px" style:height="2px" style:background="var(--i-accent)" style:margin-bottom="22px"></div>
    <ol style:list-style="none" style:margin="0" style:padding="0" style:display="flex" style:flex-direction="column" style:gap="14px">
      {#each crumbs as c, i (i)}
        {@const active = i === activeIdx}
        {@const past = i < activeIdx}
        {@const clickable = !!onCrumbClick && (past || active)}
        <li>
          <button
            type="button"
            disabled={!clickable || busy}
            onclick={clickable ? () => onCrumbClick!(i) : undefined}
            class="yarrow-intro-figtree"
            style:background="transparent"
            style:border="0"
            style:padding="0"
            style:cursor={clickable ? "pointer" : "default"}
            style:display="flex"
            style:align-items="baseline"
            style:gap="10px"
            style:text-align="left"
            style:width="100%"
          >
            <span aria-hidden="true" style:width="8px" style:height="8px" style:border-radius="999px" style:background={active ? "var(--i-accent)" : past ? "var(--i-accent-soft)" : "var(--i-rule-strong)"} style:flex-shrink="0"></span>
            <span style:font-size="13.5px" style:color={active ? "var(--i-ink)" : past ? "var(--i-char)" : "var(--i-mute)"} style:font-weight={active ? 600 : 400}>
              {c}
            </span>
          </button>
        </li>
      {/each}
    </ol>
    <div style:margin-top="auto" style:display="flex" style:flex-direction="column" style:gap="10px">
      {#if onSkip && skipLabel}
        <button
          type="button"
          onclick={onSkip}
          disabled={busy}
          class="yarrow-intro-figtree"
          style:background="transparent"
          style:border="0"
          style:padding="0"
          style:color="var(--i-mute)"
          style:font-size="12.5px"
          style:text-decoration="underline"
          style:text-decoration-color="var(--i-rule-strong)"
          style:text-underline-offset="4px"
          style:cursor="pointer"
          style:text-align="left"
        >
          {skipLabel}
        </button>
      {/if}
      <button
        type="button"
        onclick={onClose}
        disabled={busy}
        class="yarrow-intro-figtree"
        style:background="transparent"
        style:border="0"
        style:padding="0"
        style:color="var(--i-mute)"
        style:font-size="12.5px"
        style:text-align="left"
        style:cursor="pointer"
      >
        ✕ Close
      </button>
    </div>
  </aside>

  <section style:flex="1" style:padding="30px 38px 22px" style:display="flex" style:flex-direction="column" style:min-width="0">
    <div style:flex="1" style:min-height="0" style:overflow-y="auto">{@render body()}</div>
    <div style:padding-top="16px" style:margin-top="14px" style:border-top="1px solid var(--i-rule)">
      {@render footer()}
    </div>
  </section>
{/snippet}

{#snippet guidedBody()}
  {#if guidedStep === 0}
    {@render stepHeading(null, t("wizard.guide.start.title"), t("wizard.guide.start.body"))}
    {@render startingPointBody()}
  {:else if guidedStep === 1}
    {@render stepHeading(null, t("wizard.guide.name.title"), t("wizard.guide.name.body"))}
    {@render nameField()}
  {:else if guidedStep === 2}
    {@render stepHeading(null, t("wizard.guide.location.title"), t("wizard.guide.location.body"))}
    {@render locationField()}
  {:else if guidedStep === 3}
    {@render stepHeading(null, t("wizard.guide.shape.title"), t("wizard.guide.shape.body"))}
    {@render shapeField(true)}
  {/if}
{/snippet}

{#snippet guidedFooter()}
  <div style:display="flex" style:align-items="center" style:justify-content="space-between">
    {@render secondaryButton(onGuidedBack, busy, guidedStep === 0 ? t("wizard.button.cancel") : t("wizard.button.back"))}
    {@render primaryButton(onGuidedNext, busy, busy ? t("wizard.button.creating") : guidedStep === 3 ? t("wizard.button.begin") : t("wizard.button.next"))}
  </div>
  {@render errorBlock()}
  {@render progressBlock()}
{/snippet}

{#snippet quickBody()}
  {#if quickStep === 0}
    {@render stepHeading(null, t("wizard.quick.step1.title"), t("wizard.quick.step1.body"))}
    <div style:display="flex" style:flex-direction="column" style:gap="20px">
      {@render startingPointBody()}
      {@render nameField()}
    </div>
  {:else if quickStep === 1}
    {@render stepHeading(null, t("wizard.quick.step2.title"), t("wizard.quick.step2.body"))}
    <div style:display="flex" style:flex-direction="column" style:gap="16px">
      {@render locationField()}
      {@render shapeField(false)}
    </div>
  {/if}
{/snippet}

{#snippet quickFooter()}
  <div style:display="flex" style:align-items="center" style:justify-content="space-between">
    {@render secondaryButton(onQuickBack, busy, quickStep === 0 ? t("wizard.button.cancel") : t("wizard.button.back"))}
    {@render primaryButton(onQuickNext, busy, busy ? t("wizard.button.creating") : quickStep === 1 ? t("wizard.button.create") : t("wizard.button.next"))}
  </div>
  {@render errorBlock()}
  {@render progressBlock()}
{/snippet}

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-6"
    style:background="rgba(31,26,8,0.30)"
    onclick={busy ? undefined : onClose}
    role="presentation"
  >
    <div
      onclick={(e) => e.stopPropagation()}
      class="yarrow-intro yarrow-intro-figtree w-full overflow-hidden flex"
      style:max-width={guided ? "960px" : "820px"}
      style:background="var(--i-paper)"
      style:color="var(--i-ink)"
      style:border="1px solid var(--i-rule-strong)"
      style:border-radius="14px"
      style:box-shadow="0 24px 60px -24px rgba(31,26,8,0.42)"
      style:min-height="520px"
      style:max-height="94vh"
      role="dialog"
      aria-modal="true"
      aria-label={t("wizard.eyebrow.firstRun")}
      tabindex="-1"
    >
      {#if guided}
        {@render stepShell(
          t("wizard.eyebrow.firstRun"),
          [t("wizard.crumb.start"), t("wizard.crumb.name"), t("wizard.crumb.location"), t("wizard.crumb.shape")],
          guidedStep,
          (i: number) => { error = null; guidedStep = i; },
          t("wizard.button.skip"),
          () => (guided = false),
          guidedBody,
          guidedFooter,
        )}
      {:else}
        {@render stepShell(
          t("wizard.eyebrow.return"),
          [t("wizard.crumb.start"), t("wizard.crumb.details")],
          quickStep,
          (i: number) => { error = null; quickStep = i; },
          null,
          null,
          quickBody,
          quickFooter,
        )}
      {/if}
    </div>
  </div>
{/if}
