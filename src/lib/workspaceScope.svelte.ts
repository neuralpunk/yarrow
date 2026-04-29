// 3.0 — workspace-scoped settings primitive (Svelte 5 port).
//
// Pre-3.0, every user preference (theme, mode/persona, fonts, paper,
// listMode, …) lived under a single global localStorage key, so a user
// who liked Dracula + JetBrains Mono in their developer notebook also
// got Dracula + JetBrains Mono pushed onto their plain journal vault.
// 3.0 makes those settings travel with the workspace: each preference
// keys its localStorage entry on `<base>:<workspacePath>` when a
// workspace is active. The plain `<base>` key still exists as a
// fallback so first-open of a workspace inherits the user's last
// global default — once they change a setting inside that workspace,
// the scoped key takes precedence forever after.
//
// Scope lifecycle:
//   1. AppShell receives a `workspacePath` prop and calls
//      `setWorkspaceScope(path)` on mount.
//   2. AppShell calls `setWorkspaceScope(null)` on unmount (workspace
//      close, or when the user goes back to the IntroPage).
//   3. The wizard / IntroPage operate with `null` scope so any tweaks
//      there land on the global default key.
//
// Pref stores subscribe to scope changes via `workspaceScope.scope`
// and re-read their persisted value when it fires — that's how a
// workspace switch in-place still snaps every setting to the new
// vault's preferences.

const SCOPE_EVT = "yarrow:workspace-scope-changed";
const LAST_KEY = "yarrow.lastActiveWorkspace";

function readInitial(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

class WorkspaceScopeStore {
  // Self-prime from the cached "last active workspace" so any module
  // whose top-level code reads a scoped preference (uiPrefs, paperPrefs,
  // …) picks up the right value on first paint. App.svelte still
  // confirms + refreshes this from `api.activeWorkspace()` once that
  // resolves.
  scope = $state<string | null>(readInitial());

  set(path: string | null): void {
    if (this.scope === path) return;
    this.scope = path;
    window.dispatchEvent(
      new CustomEvent<string | null>(SCOPE_EVT, { detail: path }),
    );
  }
}

export const workspaceScope = new WorkspaceScopeStore();

// Bridge: any window-level event triggered from outside this store
// (e.g. another module dispatching the legacy event) flows back into
// the rune state. Set up once at module load.
if (typeof window !== "undefined") {
  window.addEventListener(SCOPE_EVT, (e: Event) => {
    const detail = (e as CustomEvent<string | null>).detail;
    if (workspaceScope.scope !== detail) {
      workspaceScope.scope = detail;
    }
  });
}

export function getWorkspaceScope(): string | null {
  return workspaceScope.scope;
}

export function setWorkspaceScope(path: string | null): void {
  workspaceScope.set(path);
}

/** Build a workspace-scoped storage key. Returns the plain base key
 *  when no workspace is active so the IntroPage / wizard / pre-open
 *  state continues to read and write the user's "global default"
 *  preference. */
export function wsKey(base: string): string {
  return workspaceScope.scope ? `${base}:${workspaceScope.scope}` : base;
}

/** Read a scoped value with fallback to the global key. Used by stores
 *  that want first-open inheritance: if the workspace hasn't yet been
 *  customised for this setting, surface the user's most recent global
 *  choice instead of the hard default. */
export function readScoped(base: string): string | null {
  try {
    const scoped = localStorage.getItem(wsKey(base));
    if (scoped !== null) return scoped;
    if (workspaceScope.scope) {
      const global = localStorage.getItem(base);
      if (global !== null) return global;
    }
    return null;
  } catch {
    return null;
  }
}

/** Write a value to the scoped key. We deliberately do NOT update the
 *  plain global key here — once a user customises a setting inside a
 *  workspace, that change should not leak back to other workspaces. */
export function writeScoped(base: string, value: string): void {
  try {
    localStorage.setItem(wsKey(base), value);
  } catch {
    /* localStorage may throw in private mode / over-quota */
  }
}

export function onScopeChange(
  fn: (path: string | null) => void,
): () => void {
  const handler = (e: Event) =>
    fn((e as CustomEvent<string | null>).detail);
  window.addEventListener(SCOPE_EVT, handler);
  return () => window.removeEventListener(SCOPE_EVT, handler);
}
