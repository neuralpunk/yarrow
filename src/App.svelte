<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "./lib/tauri";
  import IntroPage from "./components/IntroPage.svelte";
  import AppShell from "./components/AppShell.svelte";
  import Titlebar from "./components/Titlebar.svelte";
  import ExternalUrlFallbackModal from "./components/ExternalUrlFallbackModal.svelte";
  // Side-effect imports — these singleton stores self-apply via
  // `$effect.root` on first import, so just bringing them into the
  // module graph is enough to make the saved theme / a11y / mode /
  // ui-font / paper / language preferences land on <html> before the
  // first paint of any pane.
  import "./lib/theme.svelte";
  import "./lib/uiPrefs.svelte";
  import "./lib/paperPrefs.svelte";
  import "./lib/language.svelte";
  import "./lib/mode.svelte";
  import { installAccessibilityApplier } from "./lib/accessibilityPrefs.svelte";
  import { installExternalLinkInterceptor } from "./lib/openExternal";
  import { setWorkspaceScope } from "./lib/workspaceScope.svelte";

  let workspacePath = $state<string | null>(null);
  let loading = $state(true);

  // Centralised setter — every workspace transition (open / close /
  // switch / first-load) must funnel through here so the workspace
  // scope flips *before* the AppShell tree re-renders, ensuring every
  // store (theme, mode, paper, …) reads the correct scoped value on
  // its first read in the new workspace.
  function setWorkspacePath(p: string | null) {
    setWorkspaceScope(p);
    try {
      if (p) localStorage.setItem("yarrow.lastActiveWorkspace", p);
      else localStorage.removeItem("yarrow.lastActiveWorkspace");
    } catch {}
    workspacePath = p;
  }

  onMount(() => {
    installAccessibilityApplier();
    const removeInterceptor = installExternalLinkInterceptor();
    api
      .activeWorkspace()
      .then((p) => {
        setWorkspacePath(p);
        loading = false;
      })
      .catch(() => {
        loading = false;
      });
    return () => {
      removeInterceptor();
    };
  });
</script>

<div class="h-full flex flex-col relative">
  <Titlebar />
  <div class="flex-1 min-h-0 flex flex-col">
    {#if loading}
      <div class="flex-1 flex items-center justify-center text-t2">loading…</div>
    {:else if !workspacePath}
      <IntroPage onReady={setWorkspacePath} />
    {:else}
      {#key workspacePath}
        <AppShell
          {workspacePath}
          onClose={() => setWorkspacePath(null)}
          onSwitchWorkspace={setWorkspacePath}
        />
      {/key}
    {/if}
  </div>
  <ExternalUrlFallbackModal />
</div>
