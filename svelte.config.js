import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  // Lets <script lang="ts"> work + handles the same TS/PostCSS flags
  // Vite uses elsewhere in the project. Tailwind utilities applied via
  // `class="…"` keep working without explicit CSS preprocessing — they're
  // resolved by Tailwind at build time, not by Svelte.
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Svelte 5 runes mode — the new $state/$derived/$effect/$props
    // primitives. Cleaner reactivity than legacy `let`-as-state and a
    // smaller mental model than the React hooks we're leaving behind.
    runes: true,
  },
};
