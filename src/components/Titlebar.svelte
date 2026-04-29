<script lang="ts">
  // 2.1.6 — Titlebar renders nothing on every platform. With
  // `decorations: true` (and no `titleBarStyle` override), macOS,
  // Windows, and Linux all draw their standard native title bar with
  // OS window controls in the expected place. Adding our own identity
  // strip below would produce the duplicate-bar look we explicitly
  // removed. Workspace name lives in the sidebar's workspace switcher;
  // version is in Settings → About.
  //
  // The component is kept (rather than ripped out of App.svelte) so a
  // future release that re-introduces a custom title-bar treatment —
  // once macOS Tahoe's NSWindow quirks settle — has a clean place to
  // land. For now, noop.
  interface Props {
    workspaceName?: string;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let { workspaceName: _workspaceName }: Props = $props();
</script>
