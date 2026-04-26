// 2.1.6 — Titlebar component now renders nothing on every platform.
// With `decorations: true` (and no `titleBarStyle` override), macOS,
// Windows, and Linux all draw their standard native title bar with
// the OS's window controls in the OS's expected place. Adding our
// own identity strip below would just produce the duplicate-bar
// look the user explicitly asked us to remove. Workspace name is
// already visible in the sidebar's workspace switcher; version is
// in Settings → About.
//
// We keep the component file (rather than ripping it out of
// `App.tsx`) so a future release that re-introduces a custom
// title-bar treatment — once macOS Tahoe's NSWindow quirks settle —
// has a clean place to land. For now, this is a noop.
//
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Titlebar(_props: { workspaceName?: string }) {
  return null;
}
