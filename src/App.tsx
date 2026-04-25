import { useEffect, useState } from "react";
import { api } from "./lib/tauri";
import Onboarding from "./components/Onboarding";
import AppShell from "./components/AppShell";
import Titlebar from "./components/Titlebar";
import WindowResizeEdges from "./components/WindowResizeEdges";
import ExternalUrlFallbackModal from "./components/ExternalUrlFallbackModal";
import { useTheme } from "./lib/theme";
import { GuidanceProvider } from "./lib/guidanceStore";
import { installExternalLinkInterceptor } from "./lib/openExternal";
// Side-effect import: applies the saved UI font + scale at module-load
// time so even the Onboarding screen renders in the user's preferred
// chrome face, not a flash of Inter.
import "./lib/uiPrefs";

export default function App() {
  useTheme();
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.activeWorkspace().then((p) => {
      setWorkspacePath(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Catch every external-URL click anywhere in the app and route it to the
  // OS browser. Without this, an `<a href="https://…">` in a note body
  // navigates the Tauri webview itself and the user is trapped with no
  // chrome to escape.
  useEffect(() => installExternalLinkInterceptor(), []);

  return (
    <GuidanceProvider>
      <div className="h-full flex flex-col relative">
        <WindowResizeEdges />
        <Titlebar />
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="h-full flex items-center justify-center text-t2">loading…</div>
          ) : !workspacePath ? (
            <Onboarding onReady={setWorkspacePath} />
          ) : (
            // Key by path so switching workspaces fully remounts AppShell —
            // every piece of state (active note, paths, caches) is scoped to
            // the previous workspace and has no business surviving the jump.
            <AppShell
              key={workspacePath}
              workspacePath={workspacePath}
              onClose={() => setWorkspacePath(null)}
              onSwitchWorkspace={setWorkspacePath}
            />
          )}
        </div>
        <ExternalUrlFallbackModal />
      </div>
    </GuidanceProvider>
  );
}
