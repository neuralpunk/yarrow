import { useEffect, useState } from "react";
import { api } from "./lib/tauri";
import Onboarding from "./components/Onboarding";
import AppShell from "./components/AppShell";
import Titlebar from "./components/Titlebar";
import { useTheme } from "./lib/theme";

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

  return (
    <div className="h-full flex flex-col">
      <Titlebar />
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-t2">loading…</div>
        ) : !workspacePath ? (
          <Onboarding onReady={setWorkspacePath} />
        ) : (
          <AppShell workspacePath={workspacePath} onClose={() => setWorkspacePath(null)} />
        )}
      </div>
    </div>
  );
}
