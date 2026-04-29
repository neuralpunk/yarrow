# Changelog

All notable changes to Yarrow are recorded in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and the project aims to follow [Semantic Versioning](https://semver.org/) once
it reaches 1.0.

## [3.0.0] — 2026-04-27

The first release of the 3.x line and a rewrite from the inside out. Three things land at once:

1. **Modes & Personas** — five UI presets (Basic, Path-Based, Writer, Researcher, Developer) that bias what the rail surfaces without locking anything away. Every feature stays one ⌘K away regardless of mode.
2. **Frontend rewrite, React 19 → Svelte 5 (runes)** — zero-regression port of every UI surface (107 `.tsx` → 107 `.svelte`, 18 hook modules → 18 `.svelte.ts` rune-class singletons). IPC contract unchanged.
3. **Design-system pass** — full token catalogue (spacing, radius, easing, duration, typography features, OKLCH palette, tinted shadows), Phosphor Light replaces Lucide for chrome glyphs, 75 hand-drawn Doodle Icons (Khushmeen Sidhu) replace emoji in the Kits picker, Tailwind 4 (Lightning CSS) replaces Tailwind 3 + autoprefixer, and Hunspell-WASM replaces nspell.

Plus expanded Accessibility (Visualizations subsection, reading-guide band, colour-blind-safe edge patterns, aria-live path-op announcements), a faster ConnectionGraph (Sigma WebGL above 50 nodes), and serious polish on macOS (vibrancy, native font, OS-style sheet entrance, system-accent focus rings, enriched About) and Linux (DE detection, Adwaita Sans on GNOME 46+).

### Added — Modes & Personas

- **Five UI presets**, picked from a new Settings → Modes & Personas tab. **Basic** strips the right rail to its core; **Path-Based** is the full Yarrow rail; **Writer / Researcher / Developer / Clinician / Cooking** are persona skins layered on Path-Based. Two-step picker (Mode → Persona). Persisted to `localStorage` (`yarrow.mode`); switching is instant and never hides a feature unreachably. Localised en / es / sv.
- **Mode-aware ⌘K** — the command palette surfaces an "Open Modes & Personas settings…" entry plus six direct switchers, so changing modes never requires opening Settings.
- **Persona plugins.**
  - **Writer** — typewriter mode + a delta-based daily writing-streak (status-bar pill, modal with progress, goal editor, reset escape hatch). Negative-edit clamping so revision doesn't subtract earned progress.
  - **Researcher** (emerald) — Open Questions list (`??` markers in active note), Sources list (`#source` / `#paper` / `#cite` / `#reference` / `#bibliography`), and a New Source scaffolder (URL / Author / Year + Quote / Notes / `??`).
  - **Developer** (slate-blue) — Decision Log (`#decision` / `#decided` / `#resolved`), New ADR scaffolder (Status / Context / Decision / Alternatives / Consequences), code-highlight toggle.
  - **Clinician** (teal) — sensitive-notes list (`#clinical` / `#private` / `#phi` / `#confidential`), follow-ups list (`#review` / `#followup` / `#todo` / `#wip`), four-card session-note picker (SOAP / BIRP / DAP / Intake) on the existing template registry.
  - **Cooking** (orange) — Cook mode (bigger text + screen wake-lock), Recipe Clipper, Add to Shopping List, Recipe Library status-bar pill.
- **Plugin architecture.** `src/plugins/<persona>/` is the canonical home for persona features; each plugin owns three slots — Rail (mounted via the new `personaSlot` prop on `<RightRail>`), status-bar widget, and lazy-imported modals. Adding a persona is a folder, not a core-file edit.

### Added — Design system

- **Token catalogue** in `src/index.css`: 4-pt spacing scale, radius scale, three-curve easing (`--ease-standard` mirrors Apple's), five-rung duration scale, four typography feature tokens (prose / tabular / mono / display), letter-spacing scale, **OKLCH palette** with theme-aware overrides, and a tinted shadow + tinted border stack (warm in light themes, deep-black in dark — never gray-on-cream).
- **Typography helpers** — `.y-prose`, `.y-tabular`, `.y-mono`, `.y-display-large/medium`, `.y-label-caps`, `.y-hanging-punct`. Editor surface picks up old-style figures (`onum`) and hanging punctuation (WebKit-only).
- **macOS sidebar vibrancy** — `window-vibrancy` crate attaches `NSVisualEffectMaterial::Sidebar` at startup; `data-mac-vibrancy="true"` stamped on `<html>` so the left sidebar drops to a translucent tint. Honours both the in-app Reduce Transparency setting and the OS-level `prefers-reduced-transparency` media query.
- **Linux DE detection** — new `cmd_desktop_env` reads `XDG_CURRENT_DESKTOP` (with `XDG_SESSION_DESKTOP` / `DESKTOP_SESSION` fallbacks) and stamps `<html data-de="…">`. Adwaita Sans now precedes `system-ui` in the chrome stack on GNOME 46+.
- **Phosphor Light** as the chrome icon library (`@phosphor-icons/react` → `phosphor-svelte`). `weight="light"` hardcoded in the wrap factory so no call site can opt into a heavier weight. `vendor-icons` chunk: 86 KB / 21 KB gzipped (then shrunk to 43 KB after the Svelte rewrite).
- **Hand-drawn Kits** — 75 Doodle Icons by Khushmeen Sidhu replace emoji in the Kits picker. Each SVG is tinted by category via CSS `mask-image`. Notable swaps (subset): `mood-energy` → analytics, `methodology-card` → flask, `hypothesis-card` → microscope, `eisenhower-matrix` → target. Source bundle gitignored; only the 75 used SVGs ship.
- **Stroke-derived icon weight** — `strokeForSize()` codifies the size→weight ladder per the design plan.
- **Animation hygiene utilities** — `.yarrow-anim-promote` (persistent GPU layer) and `.yarrow-anim-active` (transient promotion).
- **Decision-matrix best-match banner** — surfaces the option(s) with the best weighted score against starred criteria. Empty-state copy guides the user when no criteria are weighted.
- **Kits-picker category-chip nav** under the search input; smooth-scroll to category sections.
- **Quick Hand time-aware subtitle** — copy adapts by hour (morning / afternoon / evening / late). Settings tile swapped to the Command-palette icon to match the action it triggers.
- **Reading-guide band** in the editor when the a11y pref is on; gated behind reduce-motion.
- **Accessibility Visualizations subsection** — new prefs **Diff patterns alongside colour** (default on; strikethrough/underline on diff segments) and **Graph table-mode alternative** (replaces the force graph with a sortable table).
- **Per-edge stroke patterns on the Connections graph** when colour-blind-safe is active — solid `supports`, dash-dot `challenges`, dotted `came-from`, dashed `open-question`.
- **Path-operation aria-live announcements** for path created / switched, checkpoint pinned / unpinned / restored, note created / deleted (en / es / sv).
- **Tag Browser modal** — workspace-wide tag browser with a colour legend and a count-sorted all-tags list. Click a tag to toggle on the active note; right-click to copy `#tagname`.
- **Tag Browser intro copy compressed** to one tight sentence per kind across all locales.
- **Trim-checkpoints unified picker** consolidates the prior two buttons into one "Trim checkpoints…" with an age / empty-only chooser.
- **`NOTICE.md`** — third-party asset attribution (Doodle Icons, Phosphor Icons, Google Fonts).

### Added — Platform integration

- **macOS bottom-edge correction** — Settings → Appearance, Mac only. Five presets (None / Small / Medium / Large / X-Large = 0 / 90 / 100 / 150 / 220 px). Reflows immediately on pick.
- **macOS-style sheet entrance** — modals slide down with a slight scale, mirroring `NSWindow.beginSheet(_:)`. Honours `prefers-reduced-motion`.
- **Enriched About panel on macOS** — comments line, copyright + © year, GitHub source link, MIT licence, credits for the open-source stack (Tauri 2, Svelte 5, CodeMirror 6, D3).

### Added — Tag system

- **Special tag colours** — six new recognised kinds on top of `#clinical` (rose). Attention amber (`#review` / `#followup` / `#todo` / `#wip`), Mature emerald (`#evergreen` / `#permanent` / `#canonical`), Question cyan (`#question` / `#q` / `#open`), Decision indigo (`#decision` / `#decided` / `#resolved`), Draft italic-faded (`#draft` / `#sketch` / `#raw` / `#seedling`), Archived strikethrough (`#archived` / `#dead` / `#deprecated`). Case-insensitive exact-name match.

### Changed

- **Tailwind 3 → Tailwind 4 (Lightning CSS).** `tailwind.config.js` deleted — colour, font, animation, and keyframe tokens now live in a single `@theme` block at the top of `src/index.css`. `@tailwind base/components/utilities` → `@import 'tailwindcss';`; `darkMode: "class"` → `@custom-variant dark (&:is(.dark *));`. Autoprefixer dependency dropped (folded into Lightning CSS). Migrator-applied class renames across 70 files (`flex-shrink-0` → `shrink-0`, `outline-none` → `outline-hidden`, etc.). Production CSS bundle build time roughly a third of v3's; final bundle 184.98 KB / 35.64 KB gzipped. `svelte-check` passes 0/0 across 459 files post-migration.
- **Spell checker: nspell → hunspell-asm@4.0.2** (Hunspell C++ compiled to WASM). External API unchanged. More accurate affix matching on irregular morphology, and `removeUserWord` now actually removes from the live runtime (nspell exposed `add` but not `remove`). The 297 KB-gzipped `vendor-hunspell` chunk is lazy-loaded behind the off-by-default Spell-check extra.
- **ConnectionGraph WebGL renderer for dense graphs** — added `SigmaForceGraph.svelte` (Sigma 3 + graphology + ForceAtlas2). Used only past `DENSE_GRAPH_THRESHOLD` (50 notes) when the user explicitly opts in via the dense-gate banner; small graphs keep the existing D3 view unchanged. ForceAtlas2 (Barnes–Hut auto-on >200 nodes) settles the layout in 200 sync iterations at mount; canvas renders 60fps with no per-frame DOM cost. CSS variables read at mount and re-read via `MutationObserver` so theme + colour-blind toggles repaint without rebuild. **Sigma.js (MIT)** chosen over Cosmograph (CC-BY-NC-4.0 — would block paid distribution). New `vendor-sigma` chunk: 41 KB gzipped.
- **Frontend ported from React 19 → Svelte 5 (runes mode).** Full rewrite, end-to-end, zero-regression. `svelte-check` reports 0/0; build succeeds; every panel renders identically; every shortcut still lands at the same action; IPC contract untouched. Scope: 107 `.tsx` → 107 `.svelte`, 18 React-hook modules → 18 `.svelte.ts` rune-class singletons, `main.tsx` → `main.ts` Svelte 5 `mount()`, `GuidanceProvider` tree → singleton `guidance` store with `$effect.root`. Translation patterns: `useState` → `$state`, `useMemo` → `$derived.by`, `useEffect` → `$effect` with returned cleanup, mount-only → `onMount`, `useCallback` → plain functions, `useRef` → plain `let`, `useT()` → reactive translator, `lazy + Suspense` → direct imports (Vite `manualChunks` already splits the bundles). Helper sub-components (Toggle / Section / Row / etc.) inlined as `{#snippet}` blocks. The 21 inline radial-icon JSX components collapsed into one `RadialIcon.svelte` keyed off a string id. CodeMirror extension files split type-only imports for `verbatimModuleSyntax`, which is back on. Bundle: `vendor-icons` 86 KB → 43 KB gzipped (Phosphor's Svelte build is leaner); main `index` chunk 415 KB gzipped.
- **Modal backdrop hygiene** — OS `prefers-reduced-transparency` now strips `backdrop-filter` app-wide, not just under the in-app `.a11y-reduce-transparency` class. The in-app **Reduce Transparency** toggle now strips both the blur AND the 28%-black gradient overlay together (no more half-broken mid-state).
- **Active-note row styling** — switched to `bg-black/[0.07] dark:bg-black/[0.32]` plus a yellow inset bar on the leading edge so every theme reads consistently as "this note is open." Replaces the prior `bg-yel/30` which only worked in light themes.
- **Right-rail icon-with-label-below layout** — vertical-tile stack instead of horizontal row. `RAIL_WIDTH_EXPANDED` 210 → 132 px. History icon no longer gated on `showPathFeatures` (reachable from Basic too).
- **Settings modal sized up** — 860 × 720 → 1040 × 760 px, plus a `hintExtra` slot, larger gap and row padding, vertically centred controls. Dense panes no longer scroll horizontally on standard 1440-wide monitors.
- **Compare modal default view** flipped from "summary" to "marginalia" so the inline-annotation diff is what users see first.
- **Radial-menu wedge sizing** — `<foreignObject>` 104×60 → 116×72 to prevent label clipping at the curve. Outer halo refactored to a `::before` pseudo with `inset: 8px`.
- **Writer rail tone** — switched from hard-coded `text-rose-600` to a theme-aware `writer-rail-tone` token. Missed-goal indicator switched `bg-rose-500` → `bg-amber-500` so red is reserved for true error states.
- **Editor body numerals** — `.cm-content` adds `onum` (old-style figures); Linux keeps the `calt` 0 override layered on top.
- **Gestures pane** when the radial menu is off shows a disabled banner with a link to Accessibility → Motor (no longer silently dimmed); the tab itself is no longer gated on `radialOn`.
- **Scratchpad placeholder** uses the singular `scratchpad.placeholderActive` string when the pad is active for the open note.
- **Default macOS viewport correction bumped 0 → 100 px** on a fresh install so the left rail and status bar sit fully inside the visible content area. Hard floor of 200 px so a hostile override can't hide the chrome.
- **Native font stack on macOS chrome** — Apple system font (`-apple-system` / `BlinkMacSystemFont`) replaces Inter for chrome only; editor unaffected. Linux/Windows continue on Inter (with Adwaita Sans pre-fallback on GNOME 46+).
- **macOS focus rings** use the system accent (`AccentColor` keyword) instead of brand-yellow. Inputs/textareas keep their existing border-tint focus.

### Fixed

- **Bottom-left "+ New" button blanking the entire app.** `handleCreateNote` accepted an optional `prefilledTitle?: string`; bare `onClick={handleCreateNote}` callers passed React's `MouseEvent` straight through, the controlled input then tried to render a non-string value, React 19 unmounted the tree, and the screen went blank. Fixed by type-guarding the argument with `typeof prefilledTitle === "string"`.
- **Reset Accessibility Settings did nothing.** `localStorage.removeItem` doesn't fire change events; the per-pref `*-changed` events the hooks listen for never fired; the radial-menu pref didn't match the `yarrow.a11y.*` prefix the reset filter scanned. Fixed via `resetAccessibilityPrefs()` that writes defaults through the same helpers as ordinary changes (so events fire) and dispatches `yarrow:extras-radialMenu-changed` for the radial pref. A "Reset done" chip surfaces in Settings → About.
- **`cmd_write_text_file` build error** — was returning a non-existent `YarrowError::Workspace` variant; switched to `YarrowError::Other`.
- **Post-migration cleanup pass — `useRef` mirrors and `setTimeout` leaks.** Removed two leftover `useRef`-style mirrors in `AppShell.svelte` (`configRef`, `activeSlugRef`) — `$state` proxies dispatch reads through the latest value at access, so the mirror pattern is dead code in Svelte 5. Wrapped eight focus-on-mount `setTimeout` calls (across CommandPalette, QuickCapture, RecipeClipperModal, FindReplace, UnlockPrompt, QuickSwitcher, CustomTemplatesModal, JournalKits) with cleanup so timers don't fire after unmount. Captured the 1.4s "Copied" timer in `ExternalUrlFallbackModal` so it can be cleared on close. CodeMirror `EditorView.destroy()`, D3 `simulation.stop()`, every `MutationObserver` / `ResizeObserver`, and Tauri `listen()` unlisten functions are all properly cleaned up — verified file-by-file.

### Security & performance (3-phase audit)

A senior-engineer security & performance audit shipped in three phases. **75 unit tests** added (was 0) covering crypto migration, slug validation, and idle auto-lock.

- **Slug validation at the IPC boundary** — `notes::validate_slug` (and a `validate_trash_slug` variant for `-deleted-<N>` suffixes) guards ~46 `cmd_*` handlers that take a slug. ASCII alnum + `-` / `_` plus `daily/<YYYY-MM-DD>`; rejects `..`, backslash, leading slash, NUL, control chars. Closes a path-traversal class.
- **Defense-in-depth at the path-construction funnels** — `notes::note_path`, `trash::body_path`, `trash::meta_path`, and `path_content::override_file` swap a malformed slug for a poison sentinel (`__yarrow_invalid_slug__`) inside the intended subdirectory, so a slug from below the IPC boundary (rogue sync, import bug, hand-edit) produces "file not found" rather than escaping. The IPC and funnel layers are intentionally redundant — one for clean error UX, one for security depth.
- **Atomic mode-0600 write path for secrets** — `workspace::atomic_write_secret` opens the temp file with `OpenOptions::mode(0o600)` from creation on Unix (no chmod-after-write window). Used by `secrets.rs::write_file` (credentials.toml — sync token + server PAT) and `workspace::write_security` (security.toml — encryption envelope).
- **Argon2id parameters bumped + transparent migration.** `(m=64 MiB, t=3, p=1)` → `(m=128 MiB, t=4, p=1)`. Older workspaces unlock with whatever params their envelope recorded, then opportunistically re-derive + re-wrap under the current params. Snapshot rollback on any mid-migration error so a partial migration can never lock the user out. Backed by 12 unit tests including an injectable-failure rollback that asserts the envelope is byte-identical to its pre-migration state.
- **Idle auto-lock fix.** The 60-second activity heartbeat used to call `current_key`, which reset `last_activity` on every successful read — so the heartbeat itself extended the session forever. New `peek_key` returns the master key (or zeroes it on expiry) without touching `last_activity`; `cmd_activity_ping` and `cmd_encryption_status` use it. 11 tests lock in the lifecycle (fresh-unlocked, explicit lock clears, idle expiry zeroes the key + history cache, real activity extends, peek does NOT extend, peek still triggers expiry, 60-iteration heartbeat loop times out at the configured ceiling).
- **Sync `http.sslVerify` writes both directions.** A user who briefly enabled `insecure_skip_tls_verify` then turned it off on Linux/libcurl previously had `http.sslVerify = false` stuck in `.git/config`. Now `sync_to_server` unconditionally writes `http.sslVerify = !insecure_tls`.
- **Binary-conflict detection in the merge path** — `git::read_blob` refuses binary blobs (via `Blob::is_binary`) and non-UTF-8 content with a typed `Invalid` error instead of `String::from_utf8_lossy`-ing the bytes through the line-by-line resolver.
- **Clone URL scheme allowlist** — `cmd_clone_workspace` refuses anything other than `https://`, `ssh://`, or `git@host:path`. `file://`, `http://`, `git://`, `ftp://` are blocked.
- **Read-size cap (16 MiB)** on user-uploaded files — `workspace::read_to_string_capped` replaces bare `read_to_string` in `read_daily_template`, `templates::read`, and `bibtex_import`. Notes themselves stay uncapped (constrained by the editor; refusal would silently break a workspace).
- **Frontmatter parse — single pass.** `notes::parse` collapsed from two `Matter` passes to one, guarded by `catch_unwind(AssertUnwindSafe)`. Roughly 50% reduction on every read / scan / save.
- **Save-path body-clone elimination.** `cmd_save_note_full` no longer deep-clones the cached `Vec<ScannedNote>` (megabytes of prose on a typical vault). New `AppState::scan_cache_with` runs derivations under the lock against a borrowed slice; auto-path reconciliation moved outside the lock.
- **ResizeObserver coalesced through the RAF path** in `src/main.ts` — observer feeds `scheduleSync` instead of synchronous `syncViewportHeight`, eliminating per-pass style recalcs during window drag.
- **Frontend dependency cleanup.** `@codemirror/view` and `postcss` patch-bumped; `svelte-check` 0/0 across 385 files. The remaining 3 moderate `npm audit` advisories (transitive `nanoid <3.3.8` via `hunspell-asm@4.0.2 → emscripten-wasm-loader`) are **not reachable** from Yarrow code (nanoid is used internally to name a temp folder for the WASM module; the vulnerability requires caller-supplied non-integer input which neither Yarrow nor the hunspell stack provides). The proposed `npm audit fix --force` regresses hunspell-asm to 0.0.8 and breaks `removeWord` — held for an upstream fix-forward.

### Removed

- **React** — `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@phosphor-icons/react`, `@vitejs/plugin-react` removed from `package.json`. All 107 `.tsx` files deleted; `tsconfig.json` and `vite.config.ts` reverted to Svelte-only configuration.
- **Lucide React** — `lucide-react` removed (replaced by Phosphor earlier in the release; the Svelte rewrite then deleted the React replacement too).

## [2.2.0] — 2026-04-26

A big-feature release: a redesigned radial centre with configurable Still-Point gestures, a Compare modal that can diff two notes (not just two paths), baking-focused workflows behind an opt-in extra, and a serious macOS polish pass.

### Added

- **Still Point gestures.** Settings → Gestures binds tap / press-and-hold / double-tap to any of 12 actions. Defaults: palette · Quick Hand · focus mode.
- **Quick Hand modal** (3×3 grid) and **Constellation modal** (8 orbiting petals) — long-press destinations from the radial centre.
- **Inserts… and Format… modals** on the radial. Linear right-click menu mirrors them as proper submenus.
- **Cut / Copy / Paste / Select All** in both menus. Paste now uses the system clipboard via `tauri-plugin-clipboard-manager`.
- **Compare modal — Notes mode.** Diff two individual notes by title; the original Paths mode is still there behind a toggle.
- **Live-preview split-pane** in writing mode.
- **Outline panel** in the right rail (heading + bullet tree, click-to-jump).
- **APA bibliography auto-generator** from `paper`-tagged wikilinks.
- **Multi-note PDF export** — every note in a path as a single paginated PDF.
- **Export confirmation modal** for static-site export.
- **Cooking additions extra** (off by default). When on, surfaces: five baking kits (Recipe Card, Bake Log, Holiday Plan, Sourdough Schedule, Family Cookbook), inline `[label](timer:25m)` timers with corner-pill UI, Cook mode (big text + screen wake-lock), Recipe URL clipper (schema.org JSON-LD), Smart shopping list (v1), a right-rail cook-mode toggle, and a "Note from recipe URL" tile in the New Note modal.
- **Bake/cook times in clipped recipes auto-link** as timer pills (`Let it rest 25 minutes` → `[25 minutes](timer:25m)`). Compound durations collapse: `1 hour 30 minutes` → 90 min.
- **Native macOS menu bar** — File / Edit / View / Window with proper accelerators and predefined cut/copy/paste/undo items handed off to AppKit responders.
- **`acceptFirstMouse: true`** on macOS — first click on an unfocused window registers in the editor.
- **`prefers-reduced-motion: reduce`** universally respected — animations become instant.
- **macOS-aware scrollbars** — the universal `::-webkit-scrollbar` style is gated to non-Mac, so macOS keeps its native overlay scrollbars.

### Changed

- Settings modal bumped to **860 × 600** to accommodate Gestures + the new Cooking row.
- Storage tab in Settings is hidden unless connected to a Yarrow Sync server.
- Annotation gutter widened to 280 px and font-sized up so margin notes are legible alongside the body.

### Fixed

- **Drag-drop image attachments work.** Set `dragDropEnabled: false` so HTML5 drop reaches the editor instead of being intercepted by Tauri.
- **Disabled radial wedges are opaque.** The previous translucent fill made the radial look broken when more than one item was disabled.
- **Paste from system clipboard works.** Routes through `tauri-plugin-clipboard-manager` (webview's `navigator.clipboard.readText` is sandboxed and only sees Yarrow's own copies).
- **Copy gives a toast and dismisses the radial.** No more silent commits.
- **Recipe URL clipper "Error while decoding chunks" fixed.** Switched ureq → reqwest for that one fetch path; ureq's chunked-decoder failed on certain CDN-fronted sites (Pioneer Woman among them) regardless of compression-feature flags. Reqwest handles every variant cleanly.
- **Writing-mode scroll past inserted recipe content.** The live-preview wrapper was missing `min-h-0`, so its default `min-height: auto` let it grow past flex bounds and the editor's `overflow-y-auto` never engaged.
- **Recipe clipper now finds Recipes published with URL-prefixed `@type`** (`https://schema.org/Recipe` and `schema:Recipe` in addition to bare `"Recipe"`). The previous matcher only handled the bare form, which made several sites with otherwise valid schema.org JSON-LD return "no recipe metadata found".
- **Microdata fallback in the recipe clipper.** When schema.org JSON-LD turns up nothing, we now scan the HTML for `<div itemscope itemtype="…/Recipe">` markup and pull `itemprop` values into the recipe note. Covers older WordPress recipe sites (e.g. Inspired Taste).
- **Friendly Cloudflare error.** When a site is behind Cloudflare's bot-protection challenge, the clipper now detects it specifically (instead of "bot wall or geo block") and gives an actionable explanation rather than a confusing 403.
- **Mutex poisoning resilience.** Eight `state.session.lock().unwrap()` sites in `commands.rs` were replaced with the existing `unpoison()` helper. A single panicking command no longer cascades into every subsequent IPC call also panicking.
- **Outline panel debounced.** The line-by-line regex parse used to run on every keystroke; now debounced to 220 ms so large notes (5000+ lines) don't lag the editor.
- **PathCompare accessibility + cancellation.** Modal now has `role="dialog"` + `aria-modal` + `aria-labelledby` so screen readers identify it correctly. Notes-mode body fetches are cancelled cleanly on slug-flip / mode-toggle / close — eliminates React's "state update on unmounted component" warning.

### Removed

- Workspace tasks panel, persistent reminders + system tray icon, ICS calendar feeds, in-app PDF reader. Backend modules (`tasks.rs`, `reminders.rs`, `calendar.rs`), Tauri features (`tray-icon`, `tauri-plugin-notification`), and capability permissions trimmed in the same pass to keep scope tight.

## [2.1.7] — 2026-04-25

macOS bottom-cutoff — final layer + Settings icon repositioned. After 2.1.6 made the editor's "This note connects to" footer visible on macOS Tahoe (a meaningful step), the status bar at the very bottom was still hidden. Web research surfaced two compounding upstream Tauri bugs that explain the residual ~28 px overflow:

1. **`tauri-apps/tauri#6333`** — macOS treats the configured window height as **inclusive** of the title bar, while Linux and Windows treat it as **exclusive**. So `tauri.conf.json` `height: 900` is total-window-incl-title-bar on macOS but content-only on the others.
2. **Tauri's docs caveat** — title-bar height varies across macOS versions. macOS Tahoe's NSWindow title bar is a different height from Sequoia's, and Tauri can't always infer it.

Result: `100dvh` and `position: fixed; inset: 0` both resolved to a value that didn't match the actual visible content area in WKWebView. `window.innerHeight`, by contrast, reflects exactly what WKWebView has laid out for the document — i.e. the visible area.

### Fixed

- **JS-driven viewport height.** `main.tsx` now pins a `--vp-h` CSS custom property to `window.innerHeight` and re-syncs on `resize` / `orientationchange`. `html`, `body`, and `#root` use `height: var(--vp-h, 100dvh)` (with `100dvh` as the pre-JS fallback). `#root` is now `position: fixed; top: 0; left: 0; width: 100%; height: var(--vp-h)` — neither dimension depends on `100dvh` or `inset: 0` resolving correctly. The status bar finally lands inside the visible window on macOS Tahoe regardless of how WKWebView reports `100dvh`.

### Right-rail tweak

- **Settings icon moved up.** It used to live at the very bottom of the right rail (pushed there by a `flex-1` spacer). On macOS where earlier 2.1.x releases clipped the bottom of the visible area, the cog became unreachable. It's now placed just below the Scratchpad icon — with its own hairline divider above it so it still reads as a separate group — so you can always reach Settings even if the bottom 28 px somehow goes hidden.

## [2.1.6] — 2026-04-25

macOS bottom-cutoff — really, this time. Diagnosis: both `titleBarStyle: "Overlay"` and `titleBarStyle: "Transparent"` set the underlying NSWindow's `.fullSizeContentView` style mask on macOS, which makes the WKWebView take the **full window height** including the title-bar region; the title bar is then drawn over the top of the webview. Our `100dvh` and `position: fixed; inset: 0` resolve to that full window height, so the layout's status bar lands ~28 px below the visible bottom edge — exactly the symptom we kept seeing across 2.1.0 → 2.1.5 in different forms.

### Fixed

- **macOS bottom-cutoff (the real fix).** Removed `titleBarStyle: "Transparent"` from `tauri.conf.json`. With no `titleBarStyle` at all, macOS uses the default `Visible` style which does **not** set `.fullSizeContentView`: the webview is sized to (window − title bar) and the visible content area matches what `100dvh` reports. The status bar now lands inside the visible window. This was tried in 2.1.3 but the buggy `tauri-plugin-window-state` was still poisoning state at that point; with the plugin gone since 2.1.4, plain `decorations: true` finally has the runway to do its job.
- **Belt-and-suspenders flex-chain fix.** The App-level wrapper in `App.tsx` is now an explicit `flex flex-col` container, and `AppShell` uses `flex-1 min-h-0` instead of `h-full`. With only `flex-1` on the wrapper and `h-full` on AppShell, some browsers couldn't resolve `h-full` against an indefinite flex-child height and the layout would collapse to content size — letting the body pane spill past the viewport bottom and clip the status bar. The new chain has a definite flex-computed height at every level, so the status bar lands at the visible bottom on every browser engine regardless of what the OS does.

- **Custom Titlebar identity strip removed on every platform.** With `decorations: true` painting a native title bar on macOS, Windows, and Linux alike, the second-bar duplication that bit Linux in 2.1.4 would have bitten macOS in 2.1.6 too. The custom `<Titlebar>` component is now a no-op on every platform; the OS's native title bar is the only thing at the top of the window. Workspace name is still visible in the sidebar's workspace switcher; version is in Settings → About.

### Trade-off

Every platform now gets its standard native title bar — traffic lights on macOS, native min/max/close on Windows, GTK/KDE-themed bar on Linux. It's the boring, native-feeling desktop app — same look you'd get from any other open-source app that doesn't pay Apple's $99/yr to do custom window chrome. We can revisit a stylish branded title bar in a future release once macOS Tahoe's NSWindow quirks have a documented workaround upstream.

## [2.1.5] — 2026-04-25

Two follow-ups to 2.1.4: a Linux duplicate-bar fix and a deeper macOS bottom-cutoff fix backed by additional research into how `titleBarStyle: "Overlay"` interacts with the webview viewport.

### Fixed

- **macOS bottom-cutoff (the real fix).** Switched `titleBarStyle: "Overlay"` → `titleBarStyle: "Transparent"`. With Overlay, the webview takes the full window and our HTML extends *under* the (overlaid) title bar — but Tauri's docs explicitly call out "the height of the title bar is different on different OS versions, which can lead to window controls and title not being where you expect," and that's exactly the class of bug the user kept hitting on macOS Tahoe: webview viewport overshooting the visible content area by the title-bar height delta and pushing the bottom off-screen, even in fullscreen. With Transparent, the title bar is still drawn (transparent background, traffic lights at the OS-standard position) but the webview is sized to the window minus the title bar — so 100dvh resolves to actually-visible content and nothing overflows. This also drops the explicit `trafficLightPosition` (no longer needed; OS uses its standard position).
- **Linux duplicate "Yarrow" bar removed.** Fedora 43 (GNOME) does paint a native title bar with `decorations: true`, so our defensive custom Titlebar with min/max/close was rendering as a confusing second bar below the OS one. The custom Titlebar component now renders **only on macOS** — there it serves as the workspace identity strip ("Yarrow v2.1.5 · workspace name") just below the transparent OS title bar. On Linux and Windows, the native title bar carries the app's identity via its title text and there's no second bar.

### Trade-off

Linux and Windows users no longer see the workspace name in chrome — only in the sidebar's workspace switcher. The native title bar shows just "Yarrow." If we want workspace name back in the OS title bar, a future release can call `window.set_title()` on workspace switch to reflect the active workspace.

## [2.1.4] — 2026-04-25

macOS rebuild from the ground up, after web research surfaced two upstream Tauri bugs that were the actual cause of every 2.1.x macOS regression.

### What was actually broken

Two compounding upstream issues, both confirmed in the official Tauri / plugins-workspace issue trackers:

1. **`tauri-plugin-window-state` is broken on macOS.** Multiple unfixed bugs: random resize to ~half the min width on launch (issue #3289), broken size restore (issue #926), hangs the app when used with `decorations: false` (issue #14822), restores positions saved on a now-disconnected monitor without revalidating (issue #1097). The plugin was poisoning saved state across every 2.1.x release — each "fix" inherited the previous broken release's coordinates and the user only ever saw the middle slice of the app.
2. **`titleBarStyle: "Overlay"` requires `trafficLightPosition`.** Tauri 2.4.0+ supports custom traffic-light coordinates with Overlay style, but without an explicit `trafficLightPosition` the lights default to (0, 0) which renders directly under our custom Titlebar wordmark — invisible. Combined with `hiddenTitle: true` (which I'd added for cosmetics), the user saw no controls at all.

### Fixed

- **Removed `tauri-plugin-window-state` entirely.** The plugin's macOS bugs make it net-negative for our use case. Every launch now opens at the config default (1400 × 900 centered on the primary monitor); we lose cross-launch position memory but gain reliable startup behaviour. We can re-introduce position restoration via custom logic later — one that doesn't have the upstream macOS bugs.
- **Re-enabled `titleBarStyle: "Overlay"` with explicit `trafficLightPosition: { x: 12, y: 12 }`.** Traffic lights now render at the proper position on the top-left of the webview, sized to fit our 32px Titlebar. `hiddenTitle: true` is gone.
- **Restored the macOS `pl-[80px]` on the Titlebar** so the wordmark sits clear of the traffic-light overlay region.
- **The `rescue_offscreen_window()` setup hook** from 2.1.3 stays in place — defensive code is cheap, and even without the broken plugin we still want a safety net against any future window-positioning edge case.

### What macOS users will see in 2.1.4

A standard macOS app: traffic lights at the top-left of the window, no native title-bar text, our custom Titlebar carrying "Yarrow v2.1.4 · workspace name" with the wordmark cleared past the traffic lights. Window opens at 1400 × 900 centered on primary monitor (no inherited bad state from previous releases). Bottom of the app — status bar with notes count, sync pill, off-server pill — visible and within the screen.

### One-time clean slate (optional)

If you want to wipe the stale state file from earlier 2.1.x releases on macOS — purely cosmetic since 2.1.4 doesn't read it anyway — delete `~/Library/Application Support/com.yarrow.desktop/.window-state.json` (path may vary slightly).

## [2.1.3] — 2026-04-25

macOS deep-fix. The 2.1.2 attempt traded one half-fix for another: `titleBarStyle: "Overlay"` failed to position the window correctly on macOS Tahoe, AND the `tauri-plugin-window-state` plugin was still restoring stale, off-screen window coordinates inherited from the borderless 2.1.0 / 2.1.1 setup. Result: traffic lights ended up above the menu bar (invisible) and the status bar ended up below the dock (invisible). Same bug, deeper diagnosis.

### Fixed

- **Window-state self-heal on every launch.** New `rescue_offscreen_window` setup hook in `lib.rs` validates the restored window rect against the current monitor and forces a recentre + default size if the window is partly off-screen, oversized, or the saved coordinates are bogus. This breaks the bad-state-inherits-itself cycle that made every 2.1.x release "feel worse" on macOS Tahoe — even after a config fix landed, the saved state from the previous broken setup kept poisoning subsequent launches. Self-healing on a single clean launch; valid rects pass through untouched, so window-position memory is preserved on the happy path.
- **Tauri config simplified to plain `decorations: true`.** Dropped `titleBarStyle: "Overlay"` and `hiddenTitle: true` — both turned out to interact badly with macOS Tahoe's window manager (the title-bar-overlay path reportedly skipped traffic-light rendering on some Tahoe builds, and `hiddenTitle` may have compounded it). macOS now shows a standard NSWindow title bar with traffic lights at top-left and the window title text — boring, native, well-tested across every macOS version since 10.x. The custom Titlebar carries the version + workspace name as an identity strip immediately below.
- **Custom Titlebar `pl-[80px]` removed.** With no overlay region to clear, our identity strip starts cleanly from the left edge on every platform. Linux still shows the custom min / max / close buttons (GNOME Mutter fallback); macOS and Windows let the OS draw them.

### Note on the trade-off

Plain `decorations: true` means macOS users see "Yarrow" in the native title bar AND in our identity strip below — a small visible duplication. That's the cost of using the most-tested, most-reliable Mac window mode. We can revisit a custom-looking title bar (via a properly-tested `titleBarStyle: "Overlay"` once macOS Tahoe's behaviour is understood, or via a Rust-side native-API shim) in a future release once we've landed a full release cycle of stable macOS positioning.

## [2.1.2] — 2026-04-25

macOS window-positioning fix. The 2.1.1 CSS-only attempt closed the document-scroll path but didn't address the underlying issue: with `decorations: false`, Tauri's borderless `NSWindow` was being positioned past the visible bottom of the screen on macOS Tahoe, so the bottom of the app (status bar, sidebar utility row) was physically off-screen. CSS can't recover from a window that's larger than its display.

### Fixed

- **macOS borderless-window positioning.** Switched `decorations: false` → `decorations: true` and added `titleBarStyle: "Overlay"` + `hiddenTitle: true` in `tauri.conf.json`. macOS now draws the standard traffic-light controls as an overlay at the top-left of the webview (no native title bar text/area), and — crucially — the OS's window manager has the standard chrome it needs to position the window correctly relative to the menu bar and the screen's safe areas. The bottom of the app stays inside the visible region in normal, maximized, and full-screen modes alike. On macOS Tahoe specifically, this is the documented Tauri 2 pattern for "looks custom but native window behaviour."
- **Custom window controls now platform-conditional.** On macOS the OS-drawn traffic lights cover min / max / close, and on Windows the native title bar provides them — so our custom buttons are hidden on those platforms (rendering them was a duplicate-controls footgun). On Linux they stay, because GNOME Mutter (the default on Fedora 43 and most modern GNOME setups) declines to draw server-side decorations even with `decorations: true`, leaving the window otherwise unclosable except by keyboard shortcut. KDE / XFCE / other Linux WMs that do draw native chrome will see a small redundancy (native bar above + our buttons below) — cheap insurance against the no-chrome case.
- **Custom resize edges removed.** With `decorations: true`, native window borders handle resize on every platform that draws them; the custom `<WindowResizeEdges>` overlay was redundant and could intercept events along the window edge.
- **Titlebar wordmark padded clear of the traffic lights** on macOS only (`pl-[80px]`), so "Yarrow v2.1.2 · workspace name" no longer renders underneath the traffic-light overlay region.

### Platform-specific UX note

- **macOS**: traffic lights at top-left (overlay), no native title-bar text, our identity strip with the wordmark / version / workspace name carries the rest.
- **Windows**: native title bar with standard min / max / close in the OS's expected place; our identity strip sits just below as a slim wordmark band.
- **Linux**: behaviour depends on your window manager. GNOME / Mutter users see no native chrome — our custom buttons handle close / minimize / maximize. KDE / XFCE / other WMs that paint server-side decorations will see those plus our identity strip below.

## [2.1.1] — 2026-04-25

macOS scroll fix. Same-day patch on top of 2.1.0.

### Fixed

- **macOS document-scroll regression.** On macOS Tahoe with `decorations: false`, the webview occasionally reported its viewport a few pixels taller than the actual visible content area. Combined with the previous default of `overflow: visible` on `html` / `body` / `#root`, that turned the entire window into a scrollable webpage: a two-finger trackpad swipe up or down would shift the whole app, hiding the status bar (notes count, paths count, sync pill, off-server indicator) and the sidebar's utility row (Journal, Activity, Trash, Settings) below the visible edge. Adding `overflow: hidden` on `html` / `body` / `#root` plus `position: fixed; inset: 0` on `#root` pins the root exactly to the viewport so document-level scrolling is mechanically impossible. Yarrow's own internal scroll containers (note list, Settings panes, editor scroller, modal bodies) are unaffected — they each have their own `overflow-y: auto`.
- **Status bar `shrink-0`.** Defence in depth. The 28 px status bar at the bottom of AppShell gains `shrink-0` so a constrained flex column can never squeeze it out of view, regardless of what an over-tall body might do upstream.
- **`html` / `body` / `#root` height tightening.** Switched from `min-height: 100dvh` to `height: 100dvh`, so the surface is exactly viewport-tall — never larger. Combined with `overflow: hidden`, this closes every path that previously let document overflow accumulate.

## [2.1.0] — 2026-04-25

A warmth + workflow release. 75 bundled kits across nine categories, a research workflow with `@cite` + BibTeX import, a privacy-first clinical surface with on-device PHI scanning + air-gapped sync, optional sidebar folders, three UI languages, and a substantial pass on responsiveness, security, and data-leak hardening.

### Languages

- **Three UI locales: English, Latin American Spanish, Swedish.** ~1,810 keyed strings spanning every chrome surface (Onboarding, Settings, all modals, toolbar, sidebars, status bar, command palette, paths views). Notes, frontmatter, and templates are intentionally not translated — they're user content.
- **Live language switcher** on the Onboarding screen and in Settings → Appearance. Switching repaints the whole app in lock-step (pub/sub-backed `useLanguage()`), no remount.
- **Glossary-driven translations** so Yarrow's vocabulary (path, direction, checkpoint, bring together, scratchpad) stays consistent across surfaces. Spanish uses neutral usted-form; Swedish uses modern du-form. Brand names verbatim.
- **Modular i18n** at `src/lib/i18n/` — adding a new locale is one import + three table spreads in `index.ts`; missing keys fall back to English.

### Kits

- **75 bundled kits across nine categories** (was 5 in the original 2.1 cut). Driven by `<!-- kit: <kind> -->` directive in template bodies; picker auto-styles by kind.
  - Journal (12), Research (9), Clinical (14), Work (10), Learning (6), Writing (6), Everyday (7), Decision (6), Spiritual (3).
- **Picker rebuilt** — auto-focused search, larger serif headers, per-kit glyph + tint, hover blurb. New right-rail Kits button so the picker doesn't require a keystroke.
- **`default_kit_kind_for(name)` fallback** so workspaces seeded before kits group bundled templates correctly without re-seed.

### New-note modal

- **Three route tiles** — Blank, Kits, Your templates — replace the 19-tile grid. Custom-templates route shows only user-authored templates and only renders when at least one exists.
- **Bounded height** (`max-h-[80vh]`, flex-column layout) — header/footer pin, tiles scroll.

### Research workflow

- **`@cite` autocomplete** — typing `@` opens a paper-tagged note picker, inserts `[[Title]]`. Three-layer trigger pipeline survives IME quirks. Paper-tagged notes get a +99 boost. Memoized per `notes` array reference.
- **BibTeX import** — new `.bib` format alongside Obsidian / Bear / Logseq / Notion. Each entry becomes a paper-card note tagged `paper`. Hand-rolled parser handles brace/quoted/bare values, nested braces, directives, both `{}` and `()` delimiters. Brace-depth capped at 64 against pathological inputs.

### Clinical workflow

- **`Frontmatter.private` + air-gapped sync.** `private: true` (auto-set by clinical kits) registers the note's path in `.git/info/exclude` — stays out of commits and sync. File lives in normal `notes/<slug>.md`, fully editable, just invisible to git. No `git rm --cached`; toggling is reversible.
- **PHI scanner**, lazy-loaded on private notes only. Pure-JS, no IPC. Inline highlights for SSN, DOB, phone, email, street address, MRN, context-gated full names. 250ms debounced rebuild, conservative pattern-matching.
- **Sensitive tag color** for `clinical` / `private` / `phi` / `confidential` (rose accent, both palettes).
- **Sidebar `⊘` glyph** for private notes alongside the encryption lock.
- **Status bar pill** "N off-server" surfaces the air-gap when a remote is configured + private notes exist — no surprise that "sync" excludes clinical material.
- **`scripts/make-clinical-workspace.py`** seeds a populated test workspace — paper-cards, clinical case notes (SOAP/BIRP/DAP/supervision), real ChaCha20-Poly1305 encrypted notes, sample `.bib` file.

### Folders

- **Optional sidebar folders** via `Frontmatter.folder: Option<String>`. Foldered notes group at the top with collapsible sections, alphabetical sort, per-workspace collapse memory. Workspaces without folders render identically to v2.0.
- **`cmd_set_note_folder` IPC + "Move to folder…" picker.** Validates against control chars, slashes, and 64-char length. Pure metadata — file stays at `notes/<slug>.md`.

### Privacy & data-leak hardening

- **Welcome-back banner** never bookmarks private/encrypted/clinical notes; sweeps stale bookmarks on workspace open; render-gates against the localStorage-vs-async-list race.
- **`NoteSummary.excerpt` redacted** for private notes (`⊘ private — open the note to read`).
- **FTS index excludes private bodies** — title + tags only, mirroring encrypted handling.
- **`@cite` and wikilink autocomplete** exclude private + encrypted notes; @cite also excludes `clinical`-tagged notes.
- **Per-clone exclude over `.gitignore`** so private slug names stay out of commit history.

### Editor

- **Wikilink ranking** — exact > startsWith > word-boundary > slug, plus recently-opened recency boost (module-scoped LRU of 64) and `modified`-time tiebreak.
- **Differential spell-check** — rebuilds only on `docChanged` / `viewportChanged` / cross-line `selectionSet`.
- **IME composition guard** for table-Tab so CJK candidate selection no longer hops cells.
- **PHI scanner skip-redundant** — only force a CodeMirror layout when the decoration set actually changed (was firing every 250ms scan).
- **PHI line annotation linear** — single-pass `annotateLines()` instead of per-match O(n²) scan.
- **Where-you-left-off cursor restore** — `LeftOffState.cursorLine`; resume snaps to snippet text first, line number fallback.

### Type & paper

- **Calm Palettes** — warm cream + editorial gold (light); cool charcoal + dusty plum (dark). Typed-connection colors via CSS vars.
- **Type stack** → Fraunces + Inter Tight + JetBrains Mono with **Newsreader** as new body-serif default (`opsz` pinned per surface).
- **Webfonts via `<link>`** with `preconnect` — request races with CSS parsing.
- **Editor fade is pure opacity** — removed the 0.5px blur that webkit2gtk failed to fully recompose.
- **Paper texture scoped** to `.yarrow-paper` writing canvas only.
- **Radial menu** crisp on Linux — integer-pixel positioning, shadow off the SVG filter.
- **`zoom: 1` no longer a stacking context** — `--ui-zoom` removed from `<html>` at default scale.

### Sidebar & first-run warmth

- **Empty states** with inline-SVG illustrations across note list, connections, trash, diff, tag graph, search, command palette.
- **Tag Bouquet** — up to five local suggestions per note, Snowball-stemmed (`gardens` / `gardening` → `#garden`).
- **Card Library View** — stacked-card sidebar alongside the time-bucketed list.
- **Font Personalities** (Calm, Crisp, Writerly, Notebook) bundle UI font + editor font + scale.
- **Paper & Warmth** — six textured canvases + −300/+300K warmth slider (filter is opt-in; default is flat).
- **Toast tones** (info / success / soft) with kinder copy.
- **Onboarding wordmark** — 88px Fraunces "Yarrow" beside the sprig in the gold accent.

### Performance

- **Body `filter` + `zoom` are now opt-in** (gated by `data-paper-warmth-active` / `data-ui-zoom-active`). On default settings the body stays a flat hardware-friendly surface — was the single largest contributor to scroll/hover sluggishness on Linux/webkit2gtk.
- **Killed the blanket transition rule** that caught every `[class*="bg-s"]` / `[class*="bg-bg"]` element. Theme-switch crossfade now scoped to a temporary `html.theme-transitioning` window (~260ms during deliberate toggles).
- **Containment + content-visibility** — `.yarrow-paint-island` (`contain: layout paint style`) on NoteList scroller, Settings pane, editor wrapper; `.yarrow-row-island` / `.yarrow-card-island` (`content-visibility: auto`) on long-list children; `.yarrow-gpu-scroll` (`translateZ(0)`) GPU-promotes scroll containers.
- **NoteList row memoization** — extracted `NoteRow` as a memoized component with primitive props + ref-based stable callbacks. Per-keystroke fan-out no longer re-reconciles 100+ rows.
- **Lazy-modal prewarming** — 26 `lazy()` modals prefetched in two idle-window tiers (`requestIdleCallback`). First-open is now a render, not a chunk fetch.
- **`backdrop-blur-*` removed** across 24 components (modals, popovers). Solid translucent backgrounds carry the dim alone.
- **ConnectionGraph theme-only repaint** — colors moved to `.style("fill", "var(--…)")` so theme switches no longer rebuild the D3 simulation; chord pins, drag positions, and active simulation survive a toggle.
- **Backlink delete linear** — `delete_note` now uses `scan()` parsed frontmatter to skip notes without backlinks (was reading every note even with no relevant link).
- **`editorFade` scoped** to `.yarrow-note-host > .cm-editor` so it can't fire on unrelated CodeMirror surfaces.

### Security & hardening

- **Markdown XSS tripwire** — final-pass strip on rendered HTML for `<script>` / `<iframe>` / `<object>` / `<embed>` / inline `on*=` handlers / `javascript:` URLs. Defense-in-depth on top of pulldown-cmark's `ENABLE_HTML`-off default.
- **Frontmatter parse panic guard** — `parse_frontmatter` and `strip_frontmatter` wrapped in `catch_unwind`. Malformed YAML in a single note no longer takes the backend down.
- **WebSocket health watchdog** — listener now tracks last-frame timestamp; 75s without traffic triggers reconnect via the existing back-off path. Prevents silent NAT drops from blocking `workspace.updated` events.
- **TLS-skip honored on the WS path** — `insecure_skip_tls_verify` now threads through `connect_async_tls_with_config` so the dev escape hatch behaves consistently across REST and the push stream.
- **Folder field validation** — `cmd_set_note_folder` rejects control chars, path separators, and >64 char names.

### Sync

- **OS-keychain-backed sync token** via `keyring` (Keychain / Credential Manager / Secret Service) with file fallback + one-shot migration; `config.toml` carries no secrets.
- **"Last synced X ago"** label in the status pill.
- **Sync-error categorization** — `YarrowError::AuthFailed` / `NetworkUnavailable` from `git2::Error` class/code, with message-string fallback. Toasts begin with "authentication failed:" / "network unavailable:" instead of the generic.
- **Initial support for Yarrow Connect** — upcoming paid sync + publish service (July 2026). Yarrow itself stays free and open source.

### Settings

- **Settings → Workspace → Import notes…** route opens the existing import modal.
- **Fuzzy command palette** powered by `nucleo-matcher`.

### Repository hygiene

- **Web client relocated** to `~/DEV/AI/yarrow-server/web/` (the proprietary, paid-service repo). The MIT desktop repo no longer carries `WebApp.tsx`, the `web-*` libraries, the PWA manifest, or the `VITE_YARROW_TARGET=web` build target. Sync client (`server.rs`, `server_crypto.rs`, `ws_client.rs`, `secrets.rs`) + transport abstraction stay — those are public clients of yarrow-server's contract.

### Fixed

- **External URL trapping** — capture-phase click handler routes every external `<a>` through `openUrl()`; fallback modal on plugin failure.
- **`@cite` picker silently empty** — `from` now positioned past the `@` so the fuzzy matcher sees just the query.
- **Sync data loss** — removed the `checkpoint()` oscillation coalescer that could rewind the branch ref. Sync reports `files_changed`, prefetch LRU invalidates, open notes reload, `NoteEditor` cancels pending saves on external body change. Web-git fallback merge preserves both sides.
- **Welcome-back banner** visible in dark mode.
- **Reading mode** honours editor-font preference (was hardcoded to Fraunces).
- **New-note modal viewport overflow** as the kit roster grew.

## [2.0.0] — 2026-04-21

A big release. 2.0 is about posture (how the editor sits under your
hands), tools (the map becomes a real workspace, not a viewer), and
promises to your future self (pin a version, keep it forever). Plus a
new gesture-aware radial right-click menu, a cleaner left sidebar, a
new application mark, and imports from four more apps.

### Writing posture

- **Typewriter mode.** The active line pins to the vertical middle of
  the editor; the page scrolls underneath you. Off by default —
  Settings → Writing.
- **Margin Ink.** Right-click a selection → *Annotate* drops a card
  into a right-hand gutter anchored to the excerpt. Persists in YAML
  frontmatter (`annotations: [{ anchor, body, at }]`) so external
  markdown tools round-trip the file cleanly. Each save is a silent
  checkpoint.
- **Editorial reading.** Drop cap on the first paragraph, generous
  leading, pull quotes promoted from any blockquote prefixed with
  `> pull:`. Toggle from the reader header or Settings.
- **Path-tinted caret.** The caret takes the colour of the current
  path — accidentally editing the wrong draft becomes ambient
  information. On by default; accessibility toggle flips it off.
- **Where you left off.** One-line welcome-back banner when you reopen
  a recent workspace: note, path, the sentence you paused on, and
  three actions (*pick up here*, *start somewhere else*, *hide next
  time*). Stored per-workspace; ages out after 72 h.
- **Pinned keepsakes.** Any checkpoint can be pinned with a short
  label ("before the prologue cut") — pinning lays a real
  `refs/yarrow/keepsakes/<id>` git ref on the commit plus a sidecar at
  `.yarrow/keepsakes.json`. Both prune passes skip pinned oids, and if
  pruning rewrites an ancestor the keepsake ref + sidecar oid remap to
  the new commit in the same pass.

### The editor surface

- **Radial right-click menu + The Still Point.** Right-click in the
  editor opens a donut-shaped pie menu at the cursor. With no
  selection: **Wikilink · Table · Task · Code · Callout · Heading**.
  With a selection: **Wikilink · New path · Bold · Italic · Annotate ·
  Scratchpad · Copy**. `Tab`/`Shift-Tab` cycle; `Enter` commits; `Esc`
  cancels. The centre disc is gesture-aware — **tap** opens the
  command palette, **long-press** (380 ms ring-fill) opens the Map,
  **double-click** toggles Zen, **drag-out** commits a wedge directly,
  **scroll-wheel** rotates the hovered wedge. Ships on by default;
  Settings → Writing Extras → *Radial right-click menu* flips it to a
  plain vertical drop-down with the same item contract and keyboard
  nav. Right-click is now consistent across the whole editor column
  (outer padding, metadata, tag row) — real inputs keep the OS menu.
- **Wikilink autocomplete, restored.** Type `[[` to get a searchable
  list of notes. `Enter` inserts and consumes any stray `]` from
  bracket-closing so you don't end up with `[[Title]]]]`. Also:
  right-click → *Insert wikilink…* opens a modal with an **Embed inline
  (`![[…]]`)** toggle for when you want the target's body inlined.
- **Markdown tables.** Right-click → *Table* now opens a fill-as-you-go
  editor — stepper for rows/cols, per-column alignment toggle
  (`:---` / `:---:` / `---:`), real text inputs for every cell, Tab
  between cells, live markdown preview. Inside a pipe-table row, Tab
  past the last cell of the last row appends a fresh one.
- **Callouts.** Eight types — `note`, `info`, `tip`, `question`,
  `decision`, `warning`, `danger`, `quote` — render with distinct
  per-type icons and left-border tints in both writing and reading
  mode. Right-click → *Callout* opens a dedicated modal with a
  type-picker (icon chips), title + body inputs, and a live HTML
  preview that renders through the same backend pipeline reading mode
  uses.
- **Writing Extras.** Settings → Writing hosts opt-in, lazy-loaded
  editor features — **Code syntax highlighting**, **Math (KaTeX)**,
  **Spell check**, **Inline image previews** — each gated behind a
  dynamic import, all off by default (initial JS payload drops ~990 KB
  with defaults). Plus a radial-menu toggle (on by default).
- **Zen-mode indicator.** When focus mode is on, a pale-plum pill with
  a pulsing dot and an **exit** button appears in the toolbar — so you
  never need to remember `⌘\` to get out.

### The map and paths

- **Map as a tool, not a viewer.** A **View / Connect** mode toggle in
  the graph toolbar. In Connect mode, dragging from one note onto
  another draws a dashed rubber-band arrow and opens a typed-link
  popover (supports / challenges / came-from / open-question).
  Click-to-open is suppressed in Connect mode.
- **Shift-drag lasso.** Rubber-band selection on empty canvas; the
  floating action bar offers **Tag…** and **Add to path…** in one
  move.
- **Empty graph is usable.** Every note floats on the canvas from day
  one; the nearby-only filter and radial-ring force both adapt to a
  no-links state. Sparse graphs get a dismissable coach-mark tip.
- **Link-type colours + legend highlighter.** Edges stroke by type;
  hovering a legend row filters the graph — matching edges lift, the
  rest fade.
- **Paths on paths.** Branching off any path — not just the root —
  works. Nested chains (`main → trip → budget → …`) render as a
  genuine left-to-right timeline. Promotion stays a single pointer
  flip on `view.root`; the transitive parent walk keeps deep chains
  live instead of orphaning them.
- **Path colours.** Each collection takes a user-assigned hex accent
  (eight presets + native color-picker). Applied everywhere a path
  renders — toolbar pill, switcher, ForkingRoad, sidebar strip, path
  ribbon, and the path-tinted caret.
- **Auto-path by tag.** A path can pin an `auto_membership_tag`; the
  reconciler adds any matching note automatically after every save
  and tag edit. Manual additions are preserved — it only adds.
- **Cluster suggestions.** The paths pane surfaces a *"N suggested"*
  button when the graph has egocentric clusters that aren't already a
  path. Click to create with the cluster seeded in.
- **Activity heatmap + tag graph.** Palette → *Activity* opens a
  GitHub-style calendar of checkpoints across all paths (90-day /
  6-month / 1-year windows) with streak stats and a compact 14-day
  strip in the sidebar. Palette → *Tag graph* opens a force-directed
  view of tag co-occurrence coloured by greedy clusters; click a tag
  to filter.
- **Reader-mode inline diff (Ley Lines).** On a non-root path the
  reading view renders the path body with inline
  `<del>old</del><ins>new</ins>` on modified lines, dedicated classes
  on pure additions/deletions, and a left change-bar on every changed
  block via a post-render DOM walk.
- **Path-switching correctness.** Saves triggered by a path-switch
  unmount now always route to the path the edits were typed on (4th
  `onSave` argument captured at mount time). `activeNote` updates
  guard on `effectivePath === currentPath` so a stale async save can't
  slam a previous path's body back onto the visible editor.

### Onboarding + imports

- **Sample vault on first run.** Onboarding offers a *Try a sample
  vault* button that creates a workspace seeded with a **one-month,
  six-country Europe trip** — 25 notes, 10 nested paths
  (`add-sweden → stockholm-only → lapland-detour`, etc.), typed links,
  tags, and six checkpoints on main so the history slider has
  scrub-room on day one.
- **Imports from Bear, Logseq, Notion** — alongside Obsidian. The
  new-workspace wizard stages a picked source and shows a contextual
  card with the expected folder shape before the OS picker fires.
  Each parser handles per-app quirks (Bear's flat `.md` + inline
  `#tag`s, Logseq's `pages/` + `journals/` split with `_` → `-` for
  journal stems, Notion's ` <32-hex-id>.md` suffix stripped). Each
  import lands as one checkpoint.
- **Guided *Open a different folder* modal.** Instead of dropping you
  into the OS picker, onboarding shows what a Yarrow workspace looks
  like on disk first.
- **Daily journal as connector.** Opening today's journal auto-fills
  a `## Today's threads` section (inside HTML-comment markers) with
  wikilinks to every note modified today. The rest of the journal is
  untouched.

### Appearance + chrome

- **New Yarrow sprig mark.** A stem + five pinnate branches with
  seven filled nodes, defaults to `currentColor`, scales from 16 px to
  1024 px without redrawing. Replaces the old git-fork logo across
  the dock/taskbar icon, favicon, onboarding wordmark, new-workspace
  wizard, and the docs site. Platform icons regenerated
  (`icon.icns` / `.ico` / Linux sizes / Microsoft Store squircles /
  iOS + Android asset catalogs).
- **Editorial left sidebar.** Pinned-active hero card at the top,
  time-grouped sections (Today / Yesterday / Last Week / Older, older
  capped at 3 with a `+ N more` toggle), single-line serif rows,
  sticky count + New footer. A utility row underneath exposes
  Journal · Activity · Trash as one-click icon buttons.
- **Reading-mode math.** When the Math extra is on, KaTeX auto-render
  post-processes the rendered HTML so `$x^2$` and `$$…$$` typeset in
  reading mode too.

### Under the hood

- **New IPC commands:** `cmd_set_annotations`, `cmd_pin_checkpoint` /
  `cmd_list_pinned_checkpoints` / `cmd_unpin_checkpoint`,
  `cmd_writing_activity`, `cmd_render_markdown_html`,
  `cmd_import_bear_vault`, `cmd_import_logseq_vault`,
  `cmd_import_notion_vault`, `cmd_set_path_collection_color`,
  `cmd_set_path_collection_auto_tag`, `cmd_suggest_path_clusters`,
  `cmd_init_sample_workspace`.
- **New Rust modules:** `foreign_import` (Bear / Logseq / Notion
  parsers), `sample_vault` (starter content + bootstrap). New
  `graph::cluster_suggestions` for path suggestions; new
  `notes::reconcile_daily_threads`; new
  `path_collections::reconcile_auto_membership`.
- **Frontmatter schema additions (migration-safe):**
  `Frontmatter.annotations: Vec<Annotation>` and
  `PathCollection.{color, auto_membership_tag}`, each with
  `skip_serializing_if` so existing notes serialise byte-identical.
- **Keepsake plumbing.** `git::rewrite_history_dropping` consults
  `list_keepsakes_oids` before dropping any commit and remaps
  keepsake refs when ancestors are rewritten. Sidecar metadata lives
  in `.yarrow/keepsakes.json`.
- **Lazy editor chunks:** `extensions/{codeHighlight, math, spell,
  imagePreview, wikilinkAutocomplete}.ts`. Every CodeMirror tooltip is
  now parented to `document.body` via `tooltips({...})` to fix the
  webkit2gtk clipping that killed the old `[[` typeahead.
- **Radial menu stack:** `RadialMenu.tsx`, `LinearContextMenu.tsx`,
  `radialItems.tsx`, `center/actions.ts`. A 5-gesture centre disc
  resolves tap / long-press / double-click / drag-out / scroll in a
  single `mouseup` plus a passive-false wheel listener.
- **Version centralization.** `package.json` is the single source of
  truth; `scripts/sync-version.mjs` propagates to `src/lib/version.ts`,
  `Cargo.toml`, `tauri.conf.json`, and `package-lock.json`. New
  `npm run sync-version`.
- **Editor prefs factory.** `makeBoolPref(key, evt, default)` —
  localStorage-backed boolean with cross-window sync. Used by the
  three new 2.0 toggles (typewriter, editorial, caret-tint) and the
  radial-menu toggle.
- **`lib/leftOff.ts`.** Workspace-keyed bookmark store; writes
  debounced 900 ms, flushed on AppShell unmount.

### Stability

- **WebKit CPU spike on Paths open, fixed.** `PathsPane`'s
  `onCollectionsChanged` prop identity was regenerated on every
  AppShell render, pulling `refresh` into an infinite loop. Pinned in
  a ref; `refresh` is now `useCallback(…, [])`-stable.
- **No more crash on workspace close after an earlier panic.**
  `cmd_close_workspace` and `cmd_active_workspace` now use
  `unpoison()` — a poisoned mutex no longer takes down the recovery
  path.
- **Atomic-write temp filenames can't collide.** `notes::atomic_write`
  gained a strict-monotonic counter on top of pid + subsec-nanos, so
  two parallel writes within the same nanosecond are safe on every
  platform.

### Security &amp; hardening

- **SSRF: URL-title fetch re-validates every redirect.** The smart-paste
  fetcher used to check the initial URL against the
  loopback/private-IP allowlist and then follow up to 5 redirects
  unchecked — an attacker-controlled 302 could bounce us onto
  `169.254.169.254`. Redirects are now followed manually, capped at 3,
  with the allowlist + scheme check re-run on each hop.
- **Regex DoS blocked.** Find-replace patterns are capped at 2 KB;
  compiled NFA and DFA sizes are capped at 10 MB and 20 MB. Hostile
  patterns now fail to build with "bad pattern" instead of hanging the
  app.
- **Attachment extension sanitised.** Only
  `[a-z0-9]{1,10}` allowed; anything else falls back to `bin`.
  Blocks null bytes, control chars, and pathological filenames.
- **URL-title fetcher user-agent tracks `CARGO_PKG_VERSION`** — no
  more stale version string in outbound requests.

### Removed

- **The Narrative Threads feature set** — the Paths-pane
  Ledger/Timeline/Themes/Voice/Decision-phrases dashboard and the
  later semantic experiments. The whole pattern-reading pipeline went
  with it (`dimensions.rs`, `text_features.rs`, `embeddings.rs`,
  `semantic.rs`, their frontend modules, ~1360 lines of dashboard
  CSS, and the Rust deps `fastembed`, `rust-stemmers`,
  `vader_sentiment`, `chrono-english`, `aho-corasick`,
  `unicode-segmentation`).
- **The "N try paths open" banner** above the editor. The on-main
  pill row listing other paths went with it. The teaching ribbon
  that appears when you're *on* a try path is kept.
- **Scratchpad button in the left sidebar** — reachable from the
  right-sidebar tab; the second surface was redundant.
- **The old `[[`-typeahead fallback.** Replaced by the real tooltip-
  backed autocomplete and the right-click *Insert wikilink…* modal.

## [1.1.0] — 2026-04-19

The 1.1 release deepens the writing surface (real GitHub-style reading mode,
KaTeX, code-block syntax highlighting, smart paste, spell-check) and turns
the Paths system into a proper decision-support tool: every other path now
tells you, at a glance, what you'd gain and what you'd leave behind by
taking it. Workspace creation moves out of the OS folder picker into a
guided in-app wizard that can also import an Obsidian vault.

### Highlights

- **GitHub-style reading mode.** The reading toggle (right rail or
  Settings → Writing) now switches the editor for a fully rendered HTML
  view via pulldown-cmark — themed code blocks with a darker background,
  bordered tables, blockquote bars, task lists, and clickable wikilinks
  that open in-app. Editing flips back to CodeMirror.
- **Wikilink hover preview in reading mode.** The popover that's been in
  writing mode now appears in reading mode too, with the same excerpt and
  path-membership chips. Cache is shared across the two surfaces.
- **Inline KaTeX math.** `$x^2$` inline and `$$\int…$$` block math render
  to KaTeX widgets when the cursor is outside the delimiters; click in to
  edit the LaTeX source.
- **Code-block syntax highlighting.** Fenced ``` ```python ``` (and every
  other language registered with `@codemirror/language-data`) now gets
  keyword/string/comment colouring inside the editor. Reading mode keeps
  its own themed code styling independently.
- **Smart paste.** Paste a URL → it becomes `[<page title>](url)` after a
  background fetch; with a selection it becomes a labeled link without the
  fetch.
- **Spell-check with workspace dictionary.** Misspellings get a wavy red
  underline outside code fences / wikilinks / URLs. Right-click → suggestions
  popover and "Add to dictionary." Custom words live in a committed
  `.yarrow/dictionary.txt` so the team shares the same vocabulary.
- **Path decision-support.** The Paths pane now answers *"what does taking
  this path actually mean?"*:
  - **Three-state diff** in the path detail panel — `+` you'd gain, `~`
    present on both but edited differently, `−` you'd leave behind. The
    "edited differently" group fetches a real git comparison.
  - **Group by tag** toggle clusters the gains/losses under their tags.
  - **Decision matrix** (palette: *Decision matrix…*) — rows are notes,
    columns are paths, cells are ✓/✗. Star a row as must-have; column
    headers show `★ N/M` and turn red if any starred row is missing.
    Stars persist per-workspace.
  - **+N / −M badges** on every path card in the Forking Road graph,
    relative to the path you're currently on.
  - **Hover-to-highlight** — pointing at a path card lights up its slugs
    in the note list and dims the rest. Opening a path keeps the highlight
    on while you read its detail panel.
  - **Drag-to-add-to-path** — drag any sidebar note onto a path card or
    onto an open path's "In this path" section to add it.
- **Workspace-creation wizard.** Replaces the bare OS folder picker with a
  two-step in-app modal: pick what you're starting from (blank notebook or
  Obsidian vault), then name it / pick a location / choose mode / name a
  starting note. Live "Will create:" preview shows the absolute path.
- **Obsidian vault import.** From the new-workspace wizard *or* the
  command palette (*Import an Obsidian vault…*). Walks `.md` files,
  preserves `[[wikilinks]]` and `#tags`, skips `.obsidian/` and `.trash/`,
  and lands as a single checkpoint so you can roll back the whole import.
- **Workspace-wide find & replace.** Modal with regex toggle, scope
  switch (workspace / current path), live preview, and an in-app confirm
  step before applying. The whole change is one checkpoint.
- **Trash with undelete.** Deleting a note now stashes a copy under
  `.yarrow/trash/`. New Trash modal (left sidebar) lists removed notes
  with restore + permanent-purge actions.
- **Auto-rename wikilink updates.** Renaming a note pre-flights how many
  other notes link to it; if any do, asks: *Rename only this note* or
  *Rename and update wikilinks*. Handles `[[Title|alias]]` and
  `[[Title#section]]` variants too.
- **Print / save as PDF.** `⌘P` / `Ctrl+P` renders the active note via
  pulldown-cmark with print-friendly styling and opens the OS print dialog.
- **Multiple windows.** *Open new window* in the palette spawns a second
  window onto the same workspace. Window position and size are remembered
  across launches.
- **Path comparison view.** *Compare two paths…* in the palette opens a
  side-by-side panel with added / removed / changed / same counts.

### New keyboard shortcuts

- `⌘P` / `Ctrl+P` — print or save the active note as PDF
- `⌘⇧F` / `Ctrl+Shift+F` — workspace-wide find & replace

### Fixed

- **Cross-note content swap.** When a note switch happened mid-debounce,
  the editor's unmount-flush could write note A's body into note B's file
  (`handleSave` closed over a stale `activeSlug`). The editor now passes
  the slug captured at mount time so saves always land on the right note.
- **Window stuck small + unresizable.** The 1.0 build set
  `decorations: false` without supplying custom resize handles, so on most
  Linux WMs the window had no draggable edges. Decorations are back on,
  default size raised to 1400×900, min lowered to 820×560.
- **Onboarding scrolled off the top.** With many recent workspaces, the
  centered flex layout pushed the header off the scrollable region. Wrapped
  in `min-h-full` flex so the page centers when short and scrolls cleanly
  when long.
- **Find & replace pop-ups.** Replaced `confirm()` and `alert()` with
  in-app modals (panel-overlay confirm + a result modal in the shell).
- **Browser print intercepted.** `⌘P` no longer prints the editor chrome —
  it triggers Yarrow's own pulldown-cmark render.
- **Tag edits dropped on fast note switch.** TagChips now flushes its pending
  commit on unmount and refuses to be clobbered mid-edit.
- **Trash silently overwrote prior deletions of the same name.** Stash now
  picks a unique storage slug; restore puts the note back under its
  original slug (suffixing if that slot is now occupied).
- **`cmd_create_workspace_dir` accepted `.` and `..`.** Names that resolve
  to the parent directory itself are now rejected; parent path is
  validated before joining.
- **`cmd_fetch_url_title` had SSRF surface.** Now requires `http(s)` and
  refuses loopback / link-local / RFC 1918 / cloud-metadata IPs so smart
  paste can't probe the user's intranet.
- **Print iframe could leak in the DOM.** Added a 30 s safety-net cleanup
  in case `onload` never fires.
- **`Ctrl+P` opened the quick switcher instead of print.** An old keymap
  entry bound `Ctrl+P` alongside `Ctrl+O` and short-circuited; removed.

### Performance

- **Save fan-out: 4 IPCs → 1.** New `cmd_save_note_full` returns the saved
  note plus workspace summaries, graph, and orphans in one round-trip.
- **Single notes-dir walk per save.** `notes::list` and `graph::build` now
  share a `notes::scan` pass; previously each save walked the directory
  twice and parsed every frontmatter twice (~2N → ~N file reads).
- **No-op saves are free.** `cmd_save_note_full` short-circuits when the
  body is unchanged — no scan, no checkpoint, no frontend setState fan-out.
- **Topology refresh debounced.** `cmd_branch_topology` (a git walk) used
  to fire after every save even though content saves can't change branch
  topology. Now runs on a 1.5 s tail.
- **Graph cache write skipped when unchanged.** `index.json` is compared
  byte-for-byte before being rewritten — most edits no longer touch it.
- **Spell-check result memoization.** Per-word `isCorrect()` results are
  cached in a 4096-entry LRU; the spell decoration pass no longer re-runs
  affix matching on every word every keystroke.
- **Selection event guard.** The status bar's selection-changed event no
  longer dispatches "0/0" on every keystroke — only when the value
  actually changes — so AppShell stops re-rendering between characters.
- **Memo'd Toolbar + stable callback refs.** The path ribbon was unmemo'd
  and its parent passed inline arrows; both fixed.
- **Tightened broad chrome transition.** The universal `aside, header, …`
  background/border/color transition went from 220 ms → 140 ms so hover
  state changes feel snappier; theme crossfade still rides on the body's
  220 ms.
- **Lazy-prefetch widened.** NoteReader, DecisionMatrix, FindReplace, and
  Trash now warm during idle time alongside the editor + palette.

### Upgrade notes

- `.yarrow/dictionary.txt` is **committed** (workspace vocabulary belongs
  with the workspace). `.yarrow/trash/` and `.yarrow/session.json` are
  added to the gitignore.
- New backend deps: `ureq` (URL title fetch), `regex` (find/replace),
  `walkdir` (Obsidian importer), `tauri-plugin-window-state` (window
  position/size persistence).
- New frontend deps: `katex`, `nspell`, `dictionary-en`,
  `@codemirror/language-data`. The CodeMirror chunk grew because the
  English dictionary and the language registry are now loaded; both are
  lazy and only paid for when the editor mounts.
- Window position/size persists per-machine via the new plugin. If a
  pre-existing tiny size is restored from disk, drag the window once to
  resize and the new size will stick. To reset, delete
  `~/.local/share/com.yarrow.desktop/.window-state` (path varies).
- The `cmd_rename_note` IPC takes an extra `rewriteWikilinks: boolean`
  argument. The frontend pre-flights via `cmd_count_wikilink_references`
  and only prompts when there's actually something to rewrite.
- `tauri.conf.json` flips `decorations` back to `true`; the custom
  Titlebar component from 0.3 is no longer in use. Native window chrome
  is back so resize edges and OS shortcuts work.

---

## [1.0.0] — 2026-04-17

The 1.0 release pairs a daily-tool feature set (templates, tags, per-note
encryption, workspace switching) with a full editorial redesign that gives
Yarrow the feel of a field notebook instead of a code editor, and rebuilds
the Paths system from the ground up.

### Highlights

- **Editorial redesign.** Source Serif 4 body at 17px, reading-mode ↔
  writing-mode toggle that collapses raw markdown when you're not editing,
  a new paper-and-plum palette, a right tool-rail for Map / Links /
  History / Paths, and a redesigned Connections map with bigger, calmer
  circles and a flat visual language.
- **Paths, rethought.** Paths are no longer git branches — they're named
  **collections of notes** branching off a designated root, stored in
  `.yarrow/path-collections.toml`. A fullscreen Forking Road graph with
  pan/zoom, a detail panel that shows exactly which notes are in a path,
  and a ★ main note per path. One note can live in many paths; selecting
  a path never changes what you can read elsewhere.
- **Workspace modes.** Each workspace picks **Branch path mapping**
  (default) or **Basic notes**. Basic mode hides the Map, Paths, and
  linking affordances for users who just want a plain notebook. Mapped
  workspaces anchor on a designated **starting note**, settable during
  onboarding or via Settings.
- **Templates.** Six bundled (*Daily journal*, *Meeting notes*,
  *Book notes*, *Vacation planner*, *Project brief*, *Morning pages*),
  with `{{date}}` / `{{weekday}}` / `{{title}}` / `{{cursor}}` placeholders
  and a *Start from* chip row on the new-note modal. Manageable under
  Settings → Templates.
- **Tags.** YAML frontmatter tags surfaced first-class: a collapsible
  Tags panel in the sidebar, `#tag` search in the palette, and a filter
  pill on the note list.
- **Local encryption (opt-in, per-note).** ChaCha20-Poly1305 + Argon2id,
  BIP39 recovery phrase, session unlock with idle timeout. Body-only —
  frontmatter stays plaintext so links/tags/backlinks keep working. `⌘L`
  to lock; history scrubs decrypted checkpoints on demand. Encrypting a
  note seals history by rewriting past blobs too.
- **Workspace switching.** Sidebar chip + `⌘⇧O` popover for recent
  workspaces, plus *New workspace* and *Open another folder…* actions.
  Full remount on switch so no state leaks between workspaces.
- **Scratchpad, redesigned.** Docked right-side pane (resizable, toggled
  via `⌘⇧S`), inline "Keep as note", and an editor right-click → *Send
  to scratchpad* that auto-opens the pane.
- **Performance.** Initial JS payload ~985 KB → ~302 KB raw (322 → 92 KB
  gzipped) via React.lazy + manual chunks; idle warm-up prefetches heavy
  screens; hovering a note row prefetches it into a small LRU. Read/write
  mode toggle is hot-swapped via a CodeMirror Compartment — no flicker.
- **Checkpoint bloat fixes.** No-op saves are detected and skipped;
  oscillating edits (type → save → undo → save) coalesce onto the prior
  ancestor instead of stacking empty checkpoints.
- **Settings buildout.** Eight tabs (Appearance / Writing / Templates /
  Sync / Security / Workspace / Shortcuts / About), a search box, an
  interface-font + size picker, and a *Trim checkpoint history* pane
  that can forget old or empty checkpoints.
- **Quality-of-life.** Three-state save indicator, undo-delete toast
  (6.5s), word count + reading time with live selection count, a "today"
  chip on same-day notes, *Copy as markdown* and *Reveal in file manager*
  in the right-click menu, and a static-site export that now ships with
  client-side search.

### New keyboard shortcuts

- `⌘⇧B` / `Ctrl+Shift+B` — branch this note
- `⌘⇧O` / `Ctrl+Shift+O` — workspace switcher
- `⌘⇧S` / `Ctrl+Shift+S` — toggle scratchpad
- `⌘L` / `Ctrl+L` — lock encrypted notes (only when encryption is on)

### Upgrade notes

- `.yarrow/path-collections.toml` is a new **committed** file, auto-seeded
  on first open with a single "main" collection containing every note.
- `.yarrow/security.toml` is **committed** once encryption is enabled — it
  holds the wrapped master key (opaque without your password or recovery
  phrase), so recovery works on any device with the repo.
- `config.toml` gains a `[mapping]` section (`mode`, `main_note`) and
  `preferences.encryption_idle_timeout_secs`. Older configs default
  silently — mapped mode with no main note prompts once on first Map/Paths
  click.
- Frontmatter gains optional `pinned`, `encrypted`, `kdf`, `salt`, `nonce`
  fields. They only serialize when set; existing notes are byte-identical
  on re-save.
- `.yarrow/templates/` is back-filled with the six bundled templates on
  first open — existing custom templates are preserved.
- Existing git branches (the old "paths") stay on disk but are no longer
  surfaced. Delete them with `git branch -D` if you want a clean repo.
- New localStorage keys (per-machine): `yarrow.uiFont`, `yarrow.uiScale`,
  `yarrow.scratchpadWidth`. All have sane defaults.
- History pruning and "seal history on encrypt" rewrite git SHAs on local
  branches — synced workspaces will need a force-push after. Both modals
  surface this caveat.

---

## [0.3.0] — 2026-04-17

A release that deepens Yarrow's "living map of your thinking" identity. Five
new features lean into habit formation, shareability, and composable
structure; a major UX pass on history, paths, and the connections graph turns
the previously utilitarian surfaces professional; and a set of correctness
fixes close data-loss risks flagged during the 0.3 pre-ship audit.

### Added

#### Pinned notes
- Right-click any note in the sidebar and choose **Pin to top** (or **Unpin**)
  to anchor it in a dedicated *Pinned* section above the regular list.
- Backed by a `pinned: true` flag in YAML frontmatter — portable across
  editors, serialized only when true so unpinned notes keep clean frontmatter.
- Pinned section shows a small pin glyph on each entry; separated from the
  main list by a soft rule for visual rhythm.
- Pin/unpin writes a named checkpoint (*"checkpoint: pin X"*) so the action is
  visible in history like any other.

#### Quick capture
- New system shortcut `⌘⇧Space` / `Ctrl+Shift+Space` pops a small capture
  window over the current workspace. Type, hit `Ctrl+Enter` or the *Capture*
  button, and the entry is appended to the scratchpad with a timestamp header.
- Scratchpad stays gitignored — quick capture is pressure-free by design.
- `Esc` cancels; the window auto-focuses the textarea so it's a single keystroke
  from thought to saved draft.

#### Journal templates + calendar navigation
- Optional `.yarrow/templates/daily.md` file is rendered into every new daily
  entry, with `{{date}}` / `{{weekday}}` / `{{date_human}}` / `{{yesterday}}` /
  `{{week_number}}` substitution.
- New **Calendar** popover in the Journal section — full month grid with dots
  on days that have entries, today highlighted, active entry circled.
- Keyboard nav: `⌘←` / `⌘→` hops to the previous/next day while a daily note
  is open; the editor remounts so content switches cleanly.
- Entry-count footer in the calendar ("142 entries") for at-a-glance streak
  awareness without gamification.

#### Path export (Markdown bundle)
- Right-click any path → **Export as Markdown…** → pick a destination folder.
- Walks the branch tree at its tip and writes plain `.md` files (frontmatter
  stripped) plus a `README.md` summarising the path: name, date, note count,
  and a linked table of contents.
- Attachments from the working tree are copied verbatim so images resolve
  offline.
- Independent of the existing *static-site export* — this one is a portable
  Markdown folder you can hand to anyone, version-control elsewhere, or feed
  to another tool.

#### Transclusion (embedded notes)
- New `![[note]]` / `![[note#heading]]` / `![[note^block]]` syntax references
  another note's content inline. The editor marks embed tokens with a dashed
  yellow border to distinguish them from plain `[[wikilinks]]`.
- **Embedded** panel in the right sidebar resolves every embed in the current
  note and shows the target's title + a 320-char excerpt, clickable to jump.
- Heading embeds extract from `# Heading` down to the next equal-or-higher
  heading; block embeds match paragraphs ending in `^block-id`.
- Missing-target state is surfaced in red so stale embeds are obvious.

#### Path diffing
- Right-click any non-current path → **Compare with current path**.
- Fullscreen Now / Other view with a three-pane layout: list of changed notes
  on the left, current-path body in the middle, other-path body on the right.
- Per-note added/removed line counts (`+N / −M`) and a change badge
  (*added* / *removed* / *changed* / *same*) so you can see divergence at a
  glance.
- Reads branch tips directly via `git::notes_on_path` — no working-tree swaps,
  safe to run while editing.

### Changed

#### Checkpoint & restore rework
- The old bottom-strip slider is replaced by a centred modal (Settings-style),
  sized ~820×560 with clear *Now / Then* structure.
- Grouped **timeline** on the left buckets checkpoints into
  *Today / Yesterday / Earlier this week / This month / older*, each with a
  human relative time, full date, and inline thinking-note snippet.
- **Diff badge** on the preview header shows "+N since / −M gone" vs. the
  current version, or *"identical to now"* when nothing changed.
- New **Show differences only** toggle hides unchanged lines and marks
  additions (yellow gutter) and deletions (red gutter) for at-a-glance change
  review.
- `↑` / `↓` or `j` / `k` scrub checkpoints; `Enter` restores; `Esc` closes.
- Restore triggers a **confirmation overlay** inside the modal (no fullscreen
  takeover) and, on confirm, remounts the editor to force a clean load of the
  restored content.
- The latest checkpoint disables the *Restore* button with a label of
  *"This is the current version"* — fixes the previous confusing "restore
  does nothing" case.

#### Connections graph, redesigned
- Replaced the random-blob force layout with a **structured radial layout**:
  the active note is pinned at centre inside a soft outer glow, direct
  neighbours sit on an inner dashed guide ring, 2-hop notes on an outer ring.
  The layout now teaches relationship distance at a glance.
- **Directional arrows** with curved link paths (one arrowhead marker per link
  type) — readers can see *who* links to *whom*, not just that they're
  connected.
- **Plain-language hover tooltip** — over a link: *"Note A supports Note B"*;
  over a node: title + connection count + *"click to open"*.
- **Legend pill** at the bottom documents the four link-type colours with
  matching swatches (dashed for open-question).
- **Stats pill** shows "N direct · M total" when a note is active, workspace
  totals otherwise.
- **Nearby / All toggle** defaults to nearby (1–2 hops) to hide noise; power
  users can switch to the full map.
- **Expand button** opens a centred full-canvas modal (up to 1200×820) with
  its own ResizeObserver-driven viewport; clicking any node closes the modal
  and navigates to that note.
- Toolbar strip sits above the canvas instead of floating, so controls can
  never overlap nodes or stats on narrow sidebars.
- Restrained styling: hollow outer nodes, hairline strokes, solid filled
  active node only. No pastel overload.

#### Native-feeling window chrome
- Swapped the default OS decorations (the "grey panel" on Fedora) for a
  custom **Titlebar** component that shows the Yarrow name, version number,
  and active workspace, plus min / maximize / close controls.
- Full drag region on the titlebar; capability file updated with explicit
  `core:window:allow-start-dragging` / minimize / maximize / close permissions.
- Titlebar is theme-aware and uses the same design tokens as the rest of the
  surface — no jarring OS accent bar.

#### Left-sidebar hierarchy
- Your Notes, Journal, and Your Paths now read as three distinct sections.
  Soft `border-bd/20` hairlines + `mt-5 pt-5` spacing give visual rhythm
  without a bold separator.
- Pinned notes render in their own subsection at the top of Your Notes with a
  pin glyph and separator.

#### Wikilink hover preview
- Preview body now uses `text-char` for full readability in dark and blueberry
  themes (was `text-t2` which washed out on navy).
- Header shows a small *"click to open"* hint so the interaction is
  discoverable.
- Click handler accepts `![[embed]]` syntax and returns `true` to stop
  CodeMirror from swallowing the event with cursor placement.

#### Quick quality-of-life
- Version number surfaced on Onboarding and in the About pane.
- Custom Yarrow icon used for every build target (macOS / Linux / Windows /
  iOS / Android), regenerated from a 1024 source.

### Fixed

- **Mutex poisoning** (`commands.rs`): an `unpoison()` helper recovers from a
  poisoned lock instead of panicking, so one command panic no longer kills
  every subsequent IPC call for the rest of the session.
- **Concurrent save corruption**: `AppState` now owns a `repo_lock`; every
  write → checkpoint → graph::build cycle holds it, so two in-flight saves
  (e.g. fast typing + manual save) can no longer interleave git-index writes.
- **Atomic note writes**: `notes::write` now writes to a sibling temp file
  (`.<name>.<pid>.<nanos>.tmp`) and renames over the target. A crash mid-write
  leaves the original file intact rather than truncated.
- **Stale note on fast slug switch** (`AppShell`): the active-note read effect
  now has an `alive` cleanup flag; rapid switches drop stale results instead
  of landing an old note into state.
- **Unsaved edits lost on remount**: the editor's unmount cleanup now flushes
  pending debounced edits via an `onSaveRef` before destroying the view, so
  path switches, restores, and workspace close no longer lose the last sub-
  debounce window of typing.
- **Blueberry theme button contrast**: the *Keep this*, *Restore this version*,
  conflict *Save & continue*, and fork-suggestion *Yes, explore* buttons
  previously showed near-white text on yellow — now use `text-on-yel` (always
  dark) for WCAG-safe contrast on every theme.
- **Window dragging on Linux**: `data-tauri-drag-region` silently failed
  because `core:default` doesn't include window-manipulation permissions.
  Capability file now enumerates `core:window:default` +
  `allow-start-dragging` / minimize / toggle-maximize / close.
- **Connections graph control overlap**: controls moved into a compact
  icon-only toolbar above the canvas; narrow sidebars no longer produce
  stacked pills that crashed into nodes.
- **Wikilink click**: now matches the optional `!` prefix for embeds and
  returns `true` from the CodeMirror DOM handler, so clicking a link reliably
  navigates to the target note.
- **History restore ambiguity**: the latest-checkpoint case now explicitly
  says *"This is the current version"* and disables the restore button.

### Upgrade notes

- No schema changes to `config.toml`. Frontmatter gains an optional `pinned`
  field (absent = false) — existing notes load unchanged.
- `.yarrow/templates/` is lazy-created when you first save `daily.md`.
- The new icon set is checked in; rebuild (`npm run tauri build`) picks it up.
- New `repo_lock` serialises git-mutating IPC; this is transparent to users
  but may be noticeable as a ~millisecond delay if you trigger dozens of
  saves in a single render cycle.

---

## [0.2.0] — 2026-04-17

A release focused on making Yarrow's "non-linear thinking" identity deeper
rather than broader. Four features lean into daily usage, shareability, and
content richness; a set of UX fixes close gaps flagged during the 0.1 review.

### Added

#### Daily notes (journal)
- One markdown file per day at `notes/daily/YYYY-MM-DD.md`, human-titled
  ("April 17, 2026") with a `daily` tag in frontmatter.
- Daily notes **always live on `main`**. Opening one from a side-path silently
  switches back to `main` and surfaces a dismissible toast explaining why —
  the journal is intentionally a single stream, not N parallel journals.
- New `Journal` section in the left sidebar: a prominent "Today" pill plus the
  five most recent entries (each labelled "Today" / "Yesterday" / "April 15").
- New keyboard shortcut: `⌘T` / `Ctrl+T` jumps to today's journal.
- Command palette action: **Jump to today's journal**.
- Content-addressed + sort-by-date file listing (stable even when an older
  day's entry is re-edited).

#### Transclusion preview on `[[wikilink]]` hover
- Hover a wikilink for ~320 ms to see a themed popover with the target note's
  title (in serif) and a ~480-char body excerpt.
- Viewport-aware positioning: renders above the link when space below is tight;
  clamped to the window with a 12 px gutter.
- Graceful missing-target state: *"No note yet — click to create, or type more
  of the name."*
- Empty-target state: *"This note is empty."*
- `pointer-events: none` so the popover reveals without blocking clicks —
  hovering previews; clicking still navigates.
- The older hover-to-show-blame tooltip now yields to the preview over
  wikilinks, so only one tooltip ever renders at a time.
- Race-guarded: a rapid hover-off discards the in-flight fetch.

#### Attachments
- Drop images or files directly into a note, or paste from the clipboard
  (screenshots, copied files) — the editor copies them to
  `workspace/attachments/` and inserts a markdown reference at the cursor.
- Content-addressed storage (SHA-256 prefix) means re-dropping the same image
  never duplicates the file.
- **Inline image preview**: `![](attachments/...)` lines are rendered as
  actual `<img>` widgets beneath the source, loaded via a base64 IPC pipe so
  no Tauri asset-protocol config is needed. Images cache by relpath to keep
  scrolling snappy.
- Missing-attachment state is obvious (dashed red block) instead of silent.
- Attachments check-point into git automatically — they travel with sync.

#### Static-site export
- Export your whole workspace as a self-contained HTML folder via
  **Settings › Workspace → Choose folder & export**.
- One `index.html` with: workspace name, auto-generated table of contents,
  every note rendered to HTML (via `pulldown-cmark`), and a collapsible
  D3-force connection graph (labelled "needs internet" so offline readers
  still get the notes).
- `[[wikilinks]]` inside notes become in-page `#note-<slug>` anchors, so
  jumping between notes Just Works in the export.
- `attachments/` is copied verbatim, so images render offline in the export
  bundle.
- Self-contained `styles.css` with Yarrow's warm-light palette (chosen for
  readability regardless of the sender's current theme).
- Clicking a graph node jumps the page to that note's section.

#### Themes
- New **Blueberry + Yellow** palette — deep navy canvas
  (`#182833` / `#153040` / `#1F4762`) with warm amber accents
  (`#FFC619` / `#FDA300`) and a tan secondary (`#E09F5A`).
  Palette inspired by the Fab Mood "Blueberry + Yellow" colour story.
- Appearance picker redesigned: 2×2 grid (Light / Auto / Dark / Blueberry),
  each option showing a 3-swatch preview so the choice reads at a glance.
- The theme cycle shortcut now rotates through all four options.
- Implementation: palettes applied via `data-theme` attribute on `<html>`
  alongside the existing `.dark` class, so Tailwind `dark:` variants keep
  working without change.

#### Cross-platform keyboard shortcuts
- Shortcut labels now render platform-appropriately: `⌘K` on macOS,
  `Ctrl+K` on Windows and Linux; `⌘⇧N` → `Ctrl+Shift+N`, etc.
- New `src/lib/platform.ts` centralises the convention — a single `SK` object
  owns every displayed shortcut string.
- Swept all six rendering sites: Toolbar, CommandPalette, QuickSwitcher,
  Onboarding, NoteList, JournalList.
- Key *handling* was already cross-platform (`e.ctrlKey || e.metaKey`);
  this release fixes the **display** that had been Mac-only.

### Changed

- **Toolbar** regrouped visually. Actions now cluster as:
  *note actions* (Connect · History) | *path actions* (New direction · Find) |
  right-rail (Focus · Settings | save-state · Sync pill). Dividers separate
  the three groups — reduces cognitive load from seven undifferentiated buttons.
- **Status bar** cleaned up: the redundant "⌘K search · ⌘O jump · ⌘, settings"
  crumb is gone; those shortcuts live in toolbar tooltips and the palette.
- **Left-sidebar order** rethought: Your Notes → Journal → Paths not taken →
  Scratchpad. Scratchpad moved from inside `NoteList` into its own block, so
  Journal isn't wedged between notes and ephemera.
- **Native dialogs replaced with themed modals.**
  - New-note prompt (previously `window.prompt`) is now a modal that shows
    which path the note will land on.
  - Dirty-state path switch (previously `window.confirm`) is now a modal with
    a clear *"stay here / save & switch"* choice and copy that explains the
    draft is saved first.
  - Delete-note confirm button relabelled from generic "confirm" to the warmer
    "yes, delete" (matching the reassuring body copy).
- **Connection graph empty state** — was a single italic *"No connections
  yet"* line. Now a centred empty-state card with a dashed-circle icon and
  *"Connect this note to see how ideas relate — links appear here as a
  living map."* Also triggers on the single-note and zero-links cases, not
  just zero-notes.
- CLAUDE.md keyboard-shortcut table updated with the full cross-platform set,
  including the new `⌘T / Ctrl+T` and missing `⌘O / Ctrl+O` and `⌘, / Ctrl+,`.
- Editor blame tooltip (1200 ms provenance peek) now yields to the wikilink
  preview so the two never race for attention on the same hover.
- Appearance tab copy clarified: *"Auto follows your system light/dark
  preference. Blueberry is a deep-navy palette with warm amber accents."*

### Fixed

- `.gitignore` consolidated and deduped; added `.env*` / `*.pem` / `*.key`
  (secrets), `.yarrow/` (local credentials + scratchpad in test workspaces),
  `*.tsbuildinfo`, `.vite/`, `coverage/`, Rust profiling artefacts, and OS
  cruft (`desktop.ini`, `$RECYCLE.BIN/`).
- Editor no longer rebuilds the full note/path/graph/orphan state on every
  save when the open daily note already existed (avoids needless git churn).

### Upgrade notes

- No schema changes to `config.toml` or `notes/*.md`.
- Existing workspaces will pick up daily notes, attachments, and the Blueberry
  theme without any migration — the new directories (`notes/daily/`,
  `attachments/`) are created lazily on first use.
- Static-site export writes only to the destination folder you pick; it never
  mutates the workspace.

---

## [0.1.0] — 2026-04-16

Initial release. The v1 product as scoped in `YARROW_SPEC.md` §9 — a local,
git-backed tool for non-linear thinking that hides git entirely behind a
human-facing vocabulary (*checkpoint*, *path*, *bring together*, *sync*).

### Added

#### Workspace & data model
- Plain-markdown note files under `workspace/notes/`. No database — the git
  repo *is* the database.
- `.yarrow/` for derived files and per-machine secrets: `index.json` (rebuilt
  on every save), `scratchpad.md`, and `credentials.toml` (API tokens,
  gitignored, never synced).
- `config.toml` for shared workspace settings (name, sync remote, preferences).
- Onboarding flow for picking or creating a workspace folder, plus a recent-
  workspaces list on re-open.

#### Auto-checkpointing
- Every edit is silently checkpointed (git commit) on a debounced timer
  (default 3 s after last keystroke).
- Commit messages are auto-generated from the note title.
- Optional *"What were you thinking?"* prompt on close — non-modal, appended
  to the auto-generated message.
- Full per-note history with a scrubber: hover past checkpoints to preview,
  click to restore.

#### Paths (branches, renamed)
- First-class branching: every path is a `git` branch presented as a "what
  if I tried it this way" exploration.
- Real branching graph in the sidebar (SVG) showing fork points and divergence.
- *New direction* creates a path from the current tip; switching is safe
  (dirty drafts are saved first).
- *Bring together* (merge) with a side-by-side *"your thinking diverged"*
  conflict resolver that shows the base, your version, and theirs, with a
  merged editor and per-file resolution.
- Fork-moment SVG animation when a new path is created — a small celebration
  for non-destructive exploration.
- Smart fork suggestion: a gentle inline prompt when a paragraph starts with
  a divergent marker like "But" or "However". Dismissible and per-paragraph.

#### Connections
- `[[wikilink]]` autocomplete inside the editor (CodeMirror).
- Typed connections: *supports*, *challenges*, *came from*, *open question*.
  Each edge is reciprocated automatically — adding a link writes both sides.
- Removing a link cleans up the reverse reference too.
- D3 force-directed connection graph in the right sidebar, theme-aware and
  drag-to-reposition with a re-center button.
- Linked-notes list in the right sidebar with typed badges and snippets.

#### `??` markers (open questions)
- Lines starting with `??` are visually marked (wavy yellow underline) in
  the editor.
- *Open questions* panel in the right sidebar lists all `??` lines in the
  current note; clicking jumps the editor to that line.

#### Search & navigation
- Command palette (`⌘K` / `Ctrl+K`): substring + weighted scoring search over
  all notes, palette actions, and path switching — all in one place.
- Quick note switcher (`⌘O` / `Ctrl+O`): fuzzy title jump.
- Full-text search via a small search module with snippet extraction.
- Orphan panel: notes that link nowhere and are linked from nowhere — the
  "lost threads" list.
- Decay indicator: notes untouched for longer than the configured threshold
  fade visually — a gentle nudge, never deletion.

#### Editing experience
- CodeMirror 6 editor with markdown syntax highlighting, headings styled in
  Oranienbaum serif for a deliberate writing feel.
- Debounced auto-save with a subtle *"saved"* pulse.
- Focus mode (`⌘\` / `Ctrl+\`) collapses both sidebars for distraction-free
  writing.
- Editor font size configurable in *Settings › Writing*.
- Hover provenance ("blame"): 1.2-second hover on any paragraph surfaces a
  tooltip with *"Written 3 days ago · path main"*.
- Scratchpad: a `.yarrow/scratchpad.md` gitignored file for jotting without
  committing. Promotable to a real note when it matters.

#### Sync
- Push/pull to any git remote (GitHub, Gitea, or custom) you own. Yarrow
  never hosts anything — the workspace is a plain git repo.
- Per-workspace token storage in `.yarrow/credentials.toml` (never committed).
- Sync status pill in the status bar: *synced · local changes · syncing · sync
  failed · not synced anywhere*.
- Merge conflicts from pull surface through the same resolver used by the
  in-app merge flow.

#### Themes
- Light (warm cream) and Dark (warm dusk) palettes, plus Auto (follows OS).
- Design tokens live in `tailwind.config.js` and CSS variables so every
  surface inherits — no hardcoded hex.

#### Keyboard shortcuts (v0.1)
- `⌘K` Command palette
- `⌘N` New note
- `⌘⇧N` Explore a new direction
- `⌘\` Toggle focus mode

### Philosophy captured in v0.1
- **Git is invisible infrastructure.** Every git concept has a human-facing
  name. UI copy, error strings, and commit messages use the Yarrow
  vocabulary.
- **Notes are files.** The git repo is the database; `.md` files open in any
  editor; the project is zero-lock-in.
- **Nothing is ever lost.** Auto-checkpointing + branching means the user
  never has to think about save / commit / branch.
- **Writing beats configuring.** No commit messages, no save buttons, no
  conflict-resolution jargon — just prose and connections.

### Deferred from 0.1 (per YARROW_SPEC.md §9)
- Mobile app, team/shared vaults, AI/semantic features —
  not yet addressed in 0.2.
- Export to static site — **shipped in 0.2.**
