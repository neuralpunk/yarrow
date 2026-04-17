import { useEffect, useState } from "react";
import { api } from "./lib/tauri";
import Onboarding from "./components/Onboarding";
import AppShell from "./components/AppShell";

export default function App() {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.activeWorkspace().then((p) => {
      setWorkspacePath(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center text-t2">loading…</div>;
  }

  if (!workspacePath) {
    return <Onboarding onReady={setWorkspacePath} />;
  }

  return <AppShell workspacePath={workspacePath} onClose={() => setWorkspacePath(null)} />;
}
