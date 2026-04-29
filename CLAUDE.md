# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

`YARROW_SPEC.md` is the product spec — v1 scope, data model, terminology rules, and design tokens. Read it before any architectural change.

## Commands

```bash
npm install              # frontend deps (already done; rerun after package.json edits)
npm run dev              # vite dev server only (no Tauri window)
npm run tauri dev        # full desktop app with hot reload
npm run tauri build      # bundled release binary
npm run typecheck        # svelte-check across .ts and .svelte files
npm run build            # svelte-check + vite build (no Tauri)
npm run lint             # vocab-lint + boundary-lint (run before commits touching UI copy or transport)

# Rust only
cd src-tauri && cargo check       # validate backend
cd src-tauri && cargo test        # run Rust tests
```

### Linux system prereqs (Fedora)

Tauri 2.x on Linux links against webkit2gtk. Install once:

```bash
sudo dnf install webkit2gtk4.1-devel libsoup3-devel librsvg2-devel gtk3-devel
```

`cargo check` fails at `soup3-sys` without these. Runtime packages alone are not enough.

## Architecture invariants

Hard constraints from the spec — violating any of these breaks product identity.

**Git is invisible infrastructure.** Every git concept has a human-facing name (`checkpoint`, `path`, `bring together`, `sync`, `what were you thinking?`). UI copy, error strings, tooltips, and even commit messages must use the Yarrow vocabulary. The full mapping is in spec §4 — treat it as a dictionary.

**All `git2::` calls live in `src-tauri/src/git.rs`.** No other module imports `git2`. The frontend never touches git directly — it goes through `#[tauri::command]` handlers in `commands.rs`. If you're reaching for `git2::` elsewhere, add a function to `git.rs` instead.

**Notes are `.md` files. No database.** The git repo IS the database. `.yarrow/index.json` is a derived cache rebuilt from frontmatter on every save and is gitignored. Links live in YAML frontmatter and are reciprocated on creation (`notes::add_link` writes both directions).

**Auto-checkpointing is debounced (default 8s) and silent.** Users never write commit messages. The optional "What were you thinking?" prompt fires on note close, not every save, and is appended to the auto-generated message.

**Scratchpad is gitignored.** `.yarrow/scratchpad.md` lives in `.gitignore` by design — "nothing here is saved permanently." Don't "fix" this.

**Yarrow-specific IPC goes through `src/lib/transport/`.** No code outside that directory imports `@tauri-apps/api/core` or calls `fetch()` for yarrow calls. `src/lib/tauri.ts` is a typed façade on top of the transport singleton — all consumers still `import { api }` from there. Plugin imports (`@tauri-apps/plugin-dialog`, `plugin-opener`, `plugin-window-state`) are fine to use directly since they aren't yarrow-specific. See `desktop-integration-spec.md` §3.

**Server PATs never touch `.git/config`.** When a workspace is connected to a yarrow-server, `cmd_sync` creates an anonymous git remote (`repo.remote_anonymous`) on every sync and hands credentials via `RemoteCallbacks`. The server URL + email + PAT id live in `config.toml`'s `[sync.server]` section; the PAT itself lives in the OS keychain (keyed `server-pat:<canonical_path>`), with the usual `secrets.rs` fallback to `.yarrow/credentials.toml` when no keychain is available. Disconnect clears both local state and — when `revoke_on_server` is true and the PAT has an id — calls `DELETE /api/v1/tokens/:id`.

**Frontend is Svelte 5 + Tailwind 4 (3.0).** All components are `.svelte` (Svelte 5 with runes — `$state`, `$derived`, `$effect`, `$props`). Stores live in `*.svelte.ts` files and use runes too — `import { mode } from "$lib/mode.svelte"` exports a singleton `mode` object whose `.id` / `.persona` / `.config` are reactive. There is no React, no `useX` hook layer, no JSX. Tailwind 4 is configured entirely in `src/index.css` via the `@theme` block (no `tailwind.config.js`); design tokens are CSS custom properties exposed as Tailwind colour/font names.

**Modes are biases, not gates (3.0).** The `mode` store (`src/lib/mode.svelte.ts`) holds the active `ModeId` and `ModeConfig`. `RightRail` and `AppShell` read it to bias what the rail and status bar surface — they NEVER hide a feature behind a mode in a way that makes it unreachable. Every feature stays one ⌘K away regardless of mode. The mode definitions live in `src/lib/modes.ts`; the persona slug (`writer` / `researcher` / `developer` / `clinician` / `cooking` / `null`) is the key plugins read.

**Persona plugins live in `src/plugins/<persona>/` and own three slots.** The Writer plugin is the reference shape:

- `Rail.svelte` — a Svelte 5 component that renders one or more `<button>`s plus a leading `<div class="w-5 h-px bg-bd my-1" />` divider. `AppShell` mounts it inside `<RightRail>` via a snippet/slot when `mode.persona === "<persona>"`. The plugin owns its own colour accent (Writer = rose).
- `StatusBarWidget.svelte` — rendered inline in the status bar, again gated on `mode.persona === "<persona>"`.
- `<Modal>.svelte` — plugin-owned modals are imported directly at the top of `AppShell.svelte` and rendered when the corresponding open-state flag is true. Vite already code-splits per-component, so no manual lazy wrapper is needed. Plugin state lives in plugin files (e.g. `streak.svelte.ts`); plugins should not reach into AppShell internals.

i18n strings for a plugin are added under `plugin.<persona>.<…>` keys across en/es/sv. Keep rail/status-bar strings in `sidebar.ts` (since the rail renders them); modal strings in `modals.ts` if they belong to a generic modal, or under the `plugin.<persona>.<…>` namespace alongside the rail strings if the modal is plugin-owned. Backwards-compat shims like a fallback "translation key" handler are not needed — the i18n type system will catch missing keys at build time.

When AppShell needs to feed a plugin (e.g. word-count delta → streak), the plugin exports an imperative function (`recordWords(delta)` in the Writer plugin) and AppShell calls it from the relevant lifecycle hook. Plugins should not subscribe to AppShell state.

## Layout

```
src-tauri/src/
  git.rs          — all git2-rs ops (init, checkpoint, paths, merge, sync, blame, history, branch topology, conflict helpers)
  workspace.rs    — config.toml, .yarrow/ dir, init/open; token lives in .yarrow/credentials.toml (gitignored)
  notes.rs        — note CRUD, frontmatter parse/serialize, reciprocal links
  graph.rs        — derived link index (cached to .yarrow/index.json)
  search.rs       — substring + weighted scoring search with snippet extraction
  commands.rs     — Tauri IPC bridge (every #[tauri::command])
  lib.rs          — builder + invoke_handler list
  error.rs        — YarrowError enum, serialized as string across IPC
  secrets.rs      — OS keychain for sync tokens and server PATs (Linux/macOS/Windows), with a per-workspace file fallback
  server.rs       — yarrow-server REST client (login → PAT exchange, vault create, token revoke, connection probe)

src/
  App.svelte                         — Onboarding ↔ AppShell
  main.ts                            — entrypoint; mounts App, sets --vp-h, wires the resize sync
  index.css                          — Tailwind 4 import + @theme block + global styles
  components/AppShell.svelte         — three-pane layout, owns all cross-component state + keyboard shortcuts + persona-plugin wiring
  components/IntroPage.svelte        — onboarding (new/open workspace + mode picker)
  components/CommandPalette.svelte   — ⌘K: search notes, switch paths, run commands
  components/ForkMoment.svelte       — SVG animation when a new direction is created
  components/ConflictResolver.svelte — side-by-side "your thinking diverged" view
  components/UnlockPrompt.svelte     — encryption unlock modal (password / recovery phrase)
  components/RightRail.svelte        — right-edge rail; renders the persona plugin's Rail snippet
  components/Titlebar.svelte         — custom titlebar (noop on platforms with native decorations)
  components/LeftSidebar/
    NoteList.svelte                  — notes + orphan subpanel + decay styling
    JournalCalendar.svelte / JournalList.svelte — journal pane
    PathMinimap.svelte               — path-graph minimap; the full graph renders in components/Paths/
    TagList.svelte                   — tag browser source for TagBrowserModal
  components/Paths/                  — path graph + path detail surfaces
  components/Editor/
    NoteEditor.svelte                — CodeMirror 6, ?? markers, debounced save, hover blame, jump-to-line; wikilinks are inserted via right-click → Insert wikilink…
    NoteReader.svelte                — read-mode renderer (markdown → HTML, transclusions, KaTeX)
    Toolbar.svelte                   — path pill, new direction / connect / history / find / theme / focus / sync
    HistorySlider.svelte             — checkpoint scrubber + restore
    ForkSuggestion.svelte            — non-intrusive inline prompt when a paragraph looks divergent
    RadialMenu.svelte / LinearContextMenu.svelte / radialItems.ts — right-click action set
    extensions/                      — CodeMirror extensions (paste handlers, decorations, etc.)
  components/RightSidebar/
    ConnectionGraph.svelte           — D3 force-directed, theme-aware via CSS vars
    SigmaForceGraph.svelte           — graphology + sigma renderer (alternate large-graph backend)
    LinkedNotesList.svelte           — typed links with reciprocal-remove
    OpenQuestions.svelte             — lists current note's ?? items, click jumps to line
    Outline.svelte / Transclusions.svelte
  components/{Modal,Scratchpad,Settings,TabBar,Trash}.svelte
  components/Settings.svelte         — modal settings surface; Sync pane includes the "Connect to a Yarrow server" flow
  lib/transport/                     — pluggable Transport (TauriTransport today, HttpTransport stubbed for the future web build)
  lib/tauri.ts                       — typed wrappers around every invoke(), routed through the transport singleton
  lib/types.ts                       — shared IPC types + link-type colors/labels
  lib/format.ts                      — relativeTime, friendlyDate
  lib/theme.svelte.ts                — theme store (light / dark / auto + per-theme variant), applies html[data-theme] + .dark, persists in localStorage
  lib/mode.svelte.ts                 — `mode` runes-store: id, persona, config; localStorage-backed, broadcast across tabs
  lib/modes.ts                       — Mode/Persona type definitions, the mode configs, MODE_ORDER, DEFAULT_MODE
  lib/forkDetection.ts               — divergent-paragraph heuristic + openQuestions(body)
  lib/i18n/                          — en/es/sv translation tables, type-checked at build time
  lib/*.svelte.ts                    — runes-stores: appearance, accessibilityPrefs, editorPrefs, gesturePrefs, listModePrefs, paperPrefs, personalityPrefs, uiPrefs, language, platform, workspaceScope, guidanceStore, macViewportFudge
  plugins/writer/                    — Writer-persona plugin (typewriter rail toggle, daily streak, status-bar widget, streak modal)
  plugins/writer/streak.svelte.ts      — writing-streak runes-store + recordWords(delta) imperative entrypoint
  plugins/writer/Rail.svelte           — persona rail buttons (typewriter toggle + streak)
  plugins/writer/StatusBarWidget.svelte — status-bar progress pill
  plugins/writer/StreakModal.svelte    — modal for goal config + streak overview
  plugins/researcher/                — Researcher-persona plugin (open-questions, sources list, source scaffolder)
  plugins/researcher/sources.ts        — source-tag vocabulary + filter helpers + newSourceBody scaffolder
  plugins/researcher/Rail.svelte       — persona rail buttons (questions / sources / new source)
  plugins/researcher/StatusBarWidget.svelte — `?? <count>` pill, surfaces when active note has open questions
  plugins/researcher/QuestionsModal.svelte  — active note's `??` markers with click-to-jump
  plugins/researcher/SourcesModal.svelte    — workspace sources list + "+ New source" affordance
  plugins/developer/                 — Developer-persona plugin (decision log, ADR scaffolder, code-highlight toggle)
  plugins/developer/adr.ts             — decision-tag vocabulary + filter helpers + newAdrBody scaffolder
  plugins/developer/Rail.svelte        — persona rail buttons (decisions / new ADR / code highlight)
  plugins/developer/StatusBarWidget.svelte — `<count> decisions` pill
  plugins/developer/DecisionLogModal.svelte — workspace decision-log list + "+ New ADR" affordance
  plugins/clinician/                 — Clinician-persona plugin (sensitive roster, follow-ups, session-kit picker)
  plugins/clinician/clinical.ts        — sensitive + attention filter helpers, SESSION_KITS registry
  plugins/clinician/Rail.svelte        — persona rail buttons (sensitive / follow-ups / new session note)
  plugins/clinician/StatusBarWidget.svelte — `<count> follow-up` pill
  plugins/clinician/SensitiveModal.svelte   — workspace sensitive-tagged notes list
  plugins/clinician/FollowUpsModal.svelte   — workspace #review/#followup/#todo/#wip list
  plugins/clinician/SessionKitModal.svelte  — SOAP / BIRP / DAP / Intake picker (calls cmd_create_from_template)
  plugins/cooking/                   — Cooking-persona plugin (cook mode, recipe clipper, shopping-list, recipe library)
  plugins/cooking/cooking.ts           — recipe-tag vocabulary + filter helpers
  plugins/cooking/Rail.svelte          — persona rail buttons (cook mode / clip recipe / add to shopping list)
  plugins/cooking/StatusBarWidget.svelte — `<count> recipes` pill
  plugins/cooking/RecipesModal.svelte    — workspace recipe library + "+ Clip a recipe" affordance
```

State is centralized in `AppShell.svelte` — no shared context, no external store framework. Cross-component prefs live in `*.svelte.ts` runes-stores under `src/lib/`. When adding features that need cross-component state, prefer a runes-store in `src/lib/` if it's a long-lived preference, or lift to AppShell if it's a transient, single-screen concern.

## Adding a backend operation

1. Add the function to the right module (`git.rs` if it touches git, else `notes.rs`/`workspace.rs`/`graph.rs`).
2. Wrap it in a `#[tauri::command] cmd_…` in `commands.rs`.
3. Register the command name in `lib.rs`'s `generate_handler![…]` list.
4. Add a typed wrapper in `src/lib/tauri.ts`.
5. If the op mutates state, also trigger `git::checkpoint` and `graph::build` in the command wrapper (existing commands show the pattern).

## v1 vs later

Spec §9 is the authoritative scope. Implemented to v1+: workspaces, auto-checkpointing, paths (real branching graph), merge with conflict resolution UI, typed connections with reciprocal backlinks, force-directed graph, sync, history slider, `[[wikilink]]` insertion via right-click picker (with optional `![[embed]]` inline transclusion), focus mode, scratchpad, `??` markers with side panel, smart fork detection (heuristic), blame hover tooltip, orphan panel, decay indicator, command palette with full-text search, animated fork moment, dark mode. Still explicitly deferred per spec §9: mobile app, export to static site, AI/semantic features, team/shared vaults.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| ⌘K / Ctrl+K | Command palette (search + jump + run) |
| ⌘O / Ctrl+O | Quick note switcher |
| ⌘N / Ctrl+N | New note |
| ⌘⇧N / Ctrl+Shift+N | Explore a new direction |
| ⌘T / Ctrl+T | Jump to today's journal (auto-switches to main) |
| ⌘\ / Ctrl+\ | Toggle focus mode |
| ⌘, / Ctrl+, | Open settings |

## Design tokens

Tailwind 4 is configured in CSS, not JS — there is no `tailwind.config.js`. The `@theme` block in `src/index.css` exposes design tokens as Tailwind utility names by mapping them to CSS custom properties (e.g. `--color-bg: var(--bg)` → `bg-bg`). The actual token values live in the theme CSS files keyed by `html[data-theme="…"]`, so changing theme swaps the underlying `--bg` etc. without rebuilding utility classes. Don't hardcode hex colors — always use the token-backed utilities (`bg-bg`, `text-char`, `bg-yel`, `border-bd`, etc).

Fonts: `--font-serif` (Newsreader — body / reading), `--font-display` (Fraunces — note titles, drop caps, wordmark only — never body), `--font-sans` (Inter Tight — chrome), `--font-mono` (JetBrains Mono — metadata), `--font-editor` (user-overridable, defaults to Newsreader). Webfonts load via `<link rel="stylesheet">` in `index.html` with `preconnect`, NOT via CSS `@import` — `@import` would block parsing of `index.css` and lengthen the perceptual font-swap window.
