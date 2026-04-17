# Changelog

All notable changes to Yarrow are recorded in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and the project aims to follow [Semantic Versioning](https://semver.org/) once
it reaches 1.0.

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
