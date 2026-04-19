import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // Keep the initial payload lean: split the heavy vendor code out of the
    // main entry so the first paint only parses what the shell actually needs.
    // React stays with the app entry (every path uses it); CodeMirror, D3,
    // and @tauri-apps plugins become their own chunks loaded on demand.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("d3")) return "vendor-d3";
          if (
            id.includes("@codemirror") ||
            id.includes("@lezer") ||
            id.includes("codemirror")
          ) return "vendor-codemirror";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("@tauri-apps")) return "vendor-tauri";
        },
      },
    },
    // Raise the warning threshold to a sane value post-split.
    chunkSizeWarningLimit: 650,
  },
}));
