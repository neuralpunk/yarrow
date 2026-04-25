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
npm run typecheck        # tsc --noEmit
npm run build            # tsc + vite build (no Tauri)

# Rust only
cd src-tauri && cargo check       # validate backend
cd src-tauri && cargo test        # run Rust tests (none yet)
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

**Auto-checkpointing is debounced (default 3s) and silent.** Users never write commit messages. The optional "What were you thinking?" prompt fires on note close, not every save, and is appended to the auto-generated message.

**Scratchpad is gitignored.** `.yarrow/scratchpad.md` lives in `.gitignore` by design — "nothing here is saved permanently." Don't "fix" this.

**Yarrow-specific IPC goes through `src/lib/transport/`.** No code outside that directory imports `@tauri-apps/api/core` or calls `fetch()` for yarrow calls. `src/lib/tauri.ts` is a typed façade on top of the transport singleton — all consumers still `import { api }` from there. Plugin imports (`@tauri-apps/plugin-dialog`, `plugin-opener`, `plugin-window-state`) are fine to use directly since they aren't yarrow-specific. See `desktop-integration-spec.md` §3.

**Server PATs never touch `.git/config`.** When a workspace is connected to a yarrow-server, `cmd_sync` creates an anonymous git remote (`repo.remote_anonymous`) on every sync and hands credentials via `RemoteCallbacks`. The server URL + email + PAT id live in `config.toml`'s `[sync.server]` section; the PAT itself lives in the OS keychain (keyed `server-pat:<canonical_path>`), with the usual `secrets.rs` fallback to `.yarrow/credentials.toml` when no keychain is available. Disconnect clears both local state and — when `revoke_on_server` is true and the PAT has an id — calls `DELETE /api/v1/tokens/:id`.

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
  App.tsx                            — Onboarding ↔ AppShell
  components/AppShell.tsx            — three-pane layout, owns all cross-component state + keyboard shortcuts
  components/Onboarding.tsx          — new/open workspace picker with intro
  components/CommandPalette.tsx      — ⌘K: search notes, switch paths, run commands
  components/ForkMoment.tsx          — SVG animation when a new direction is created
  components/ConflictResolver.tsx    — side-by-side "your thinking diverged" view
  components/ThemeToggle.tsx         — light / dark / auto cycle
  components/LeftSidebar/
    NoteList.tsx                     — notes + orphan subpanel + decay styling
    PathGraph.tsx                    — real branching SVG tree with fork connectors
  components/Editor/
    NoteEditor.tsx                   — CodeMirror 6, ?? markers, debounced save, hover blame, jump-to-line; wikilinks are inserted via right-click → Insert wikilink…
    Toolbar.tsx                      — path pill, new direction / connect / history / find / theme / focus / sync
    HistorySlider.tsx                — checkpoint scrubber + restore
    ForkSuggestion.tsx               — non-intrusive inline prompt when a paragraph looks divergent
  components/RightSidebar/
    ConnectionGraph.tsx              — D3 force-directed, theme-aware via CSS vars
    LinkedNotesList.tsx              — typed links with reciprocal-remove
    OpenQuestions.tsx                — lists current note's ?? items, click jumps to line
  components/{Modal,Scratchpad,RemoteSetup}.tsx
  components/Settings.tsx            — modal settings surface; Sync pane includes the "Connect to a Yarrow server" flow
  lib/transport/                     — pluggable Transport (TauriTransport today, HttpTransport stubbed for the future web build)
  lib/tauri.ts                       — typed wrappers around every invoke(), routed through the transport singleton
  lib/types.ts                       — shared IPC types + link-type colors/labels
  lib/format.ts                      — relativeTime, friendlyDate
  lib/theme.ts                       — useTheme hook, applies .dark class, persists in localStorage
  lib/forkDetection.ts               — divergent-paragraph heuristic + openQuestions(body)
```

State is centralized in `AppShell.tsx` — no context or external store. When adding features that need cross-component state, lift to AppShell.

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

Tailwind config (`tailwind.config.js`) mirrors spec §11. Don't hardcode hex colors — use the tokens (`bg-bg`, `text-char`, `bg-yel`, `border-bd`, etc). Fonts: `font-serif` (Fraunces — display), `font-sans` (Figtree — body), `font-mono` (JetBrains Mono — metadata). Fonts load via Google Fonts `@import` in `src/index.css`.
