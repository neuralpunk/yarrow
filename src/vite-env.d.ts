/// <reference types="vite/client" />
/// <reference types="svelte" />

// Allow plain `.ts` modules (e.g. `lib/guidance.ts`) to default-import
// `.svelte` component constructors. .svelte files inside Svelte components
// resolve through the svelte-check plugin; .ts files need this ambient
// declaration to recognise the same default export.
declare module "*.svelte" {
  import type { Component } from "svelte";
  const component: Component;
  export default component;
}
