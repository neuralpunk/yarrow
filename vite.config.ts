import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [svelte()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
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
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("d3")) return "vendor-d3";
          const isCmLanguage =
            id.includes("@codemirror/language-data") ||
            id.includes("@codemirror/lang-") ||
            (id.includes("@lezer/") &&
              !id.includes("@lezer/common") &&
              !id.includes("@lezer/highlight") &&
              !id.includes("@lezer/lr") &&
              !id.includes("@lezer/markdown"));
          if (isCmLanguage) return "vendor-cm-languages";
          if (
            id.includes("@codemirror") ||
            id.includes("@lezer") ||
            id.includes("codemirror")
          ) return "vendor-codemirror";
          if (id.includes("phosphor-svelte")) return "vendor-icons";
          if (id.includes("@tauri-apps")) return "vendor-tauri";
          if (
            id.includes("/sigma/") ||
            id.includes("/graphology") ||
            id.includes("/sigma-")
          ) return "vendor-sigma";
          if (id.includes("hunspell-asm")) return "vendor-hunspell";
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
}));
