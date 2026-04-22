# Yarrow — Application Specification
> Version 0.1 · For use with Claude Code

---

## 1. Vision

Yarrow is a desktop note-taking and personal knowledge management tool where ideas can **branch, evolve, and connect**. It is powered entirely by git under the hood, but the user never sees or interacts with git directly. Git is purely invisible infrastructure.

The guiding principle: **a writer, researcher, or designer should be able to use Yarrow comfortably without any technical knowledge.** The fact that it's git-backed is a selling point for trust ("your data is in an open format") — not a requirement to understand.

---

## 2. Core Philosophy

- **Thinking is non-linear.** Notes should reflect how ideas actually form — branching, looping, doubling back.
- **Nothing is ever lost.** Every direction explored is preserved. Abandoned paths are an archive, not trash.
- **Plain text, forever.** Notes are `.md` files in a folder. Open in any editor. No lock-in, no proprietary format.
- **The UI vocabulary is human.** No git terminology anywhere in the interface. Ever.
- **Complexity lives in the backend.** The frontend should feel simple enough to disappear.

---

## 3. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Tauri 2.x** | Native performance, tiny binary (~10-25MB), cross-platform (macOS, Linux, Windows), Rust backend |
| Backend language | **Rust** | Memory safety, native speed, excellent git2-rs bindings |
| Git operations | **git2-rs** (`libgit2` bindings) | No shelling out to git binary, programmatic, fast |
| Frontend | **React + TypeScript** | Mature ecosystem, good graph/canvas library support |
| Graph rendering | **D3.js** or **@antv/g6** | Force-directed graph for the connections view |
| Note editor | **CodeMirror 6** | Lightweight markdown editor, extensible |
| Styling | **Tailwind CSS** | Utility-first, consistent |
| Note storage | **Plain `.md` files** | One file per note, git-tracked automatically |
| Graph/link data | **Frontmatter** in each `.md` file | Links stored as YAML frontmatter, plain text, diffable |
| Local database | **None** — git repo IS the database | |
| Sync remote | **Any git remote** (GitHub, Gitea, Forgejo, bare server) | User configures once, hidden thereafter |

### File structure of a Yarrow workspace
```
~/yarrow-workspace/
  .git/                     ← managed entirely by Yarrow, user never touches
  .yarrow/
    config.toml             ← workspace settings (remote URL, preferences)
    index.json              ← cached link graph (rebuilt from frontmatter on demand)
  notes/
    on-complexity.md
    systems-thinking.md
    distributed-trust.md
    ...
```

### Note file format
```markdown
---
title: On the nature of complexity
created: 2026-04-16T09:00:00Z
modified: 2026-04-16T11:30:00Z
links:
  - target: systems-thinking
    type: supports
  - target: distributed-trust
    type: challenges
  - target: ephemerality
    type: came-from
tags: []
---

Note body in plain markdown here.
```

---

## 4. The Terminology Dictionary

This is the single most important section. **No git terminology appears anywhere in the UI.** This table is the canonical mapping used throughout all UI copy, tooltips, labels, and error messages.

| Git concept | What Yarrow calls it |
|---|---|
| Repository / vault | **Workspace** |
| Commit | **Checkpoint** (auto, silent — user never manually commits) |
| Branch | **Path** |
| Create branch / fork | **Explore another direction** |
| Checkout / switch branch | **Switch to this path** |
| Merge | **Bring together** |
| Merge conflict | **Your thinking diverged here** |
| Stash | **Scratchpad** |
| `git push` / `git pull` | **Sync** (one button, no directionality shown) |
| Diff / what changed | **What changed** |
| Dead / abandoned branch | **Path not taken** |
| Tag / annotated commit | **Bookmark this version** |
| Commit message | **What were you thinking?** (optional prompt on note close) |
| Orphan (no links) | **Unconnected thought** |
| Cherry-pick | **Borrow this idea** |
| `git blame` / provenance | **Written when…** (hover on paragraph) |
| Remote | Hidden — just "where your workspace syncs to" |
| HEAD | Hidden |
| SHA / commit hash | Hidden |

---

## 5. UI Layout

Yarrow uses a **three-pane layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│  [window chrome — macOS/Linux native titlebar]                  │
├──────────┬──────────────────────────────────┬───────────────────┤
│          │  [toolbar]                        │                   │
│  LEFT    │                                   │  RIGHT            │
│  SIDEBAR │  CENTER                           │  SIDEBAR          │
│          │  NOTE EDITOR                      │  CONNECTIONS      │
│  Notes   │                                   │  GRAPH + LINKS    │
│  +       │                                   │                   │
│  Paths   │                                   │                   │
│          │                                   │                   │
├──────────┴──────────────────────────────────┴───────────────────┤
│  [status bar]                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1 Left Sidebar

**Top section — Your Notes**
- List of all `.md` files in the workspace
- Active note highlighted with yellow left-border accent
- Click to open a note
- Right-click context menu: Rename, Delete, Move to Scratchpad
- "+" button to create a new note

**Bottom section — Your Paths**
- A visual representation of the path/branch tree for the currently open note
- Rendered as a vertical timeline with branching lines (like a simplified git graph but with human names)
- Each item shows: path name, relative time ("2 hours ago", "yesterday")
- Active path highlighted in yellow
- Fork points shown as a circle with two lines branching out
- Section at bottom labeled **"Paths not taken"** (collapsed by default) — shows abandoned paths

**New path button**
- At the very bottom: `↗ Explore a new direction…` — opens a dialog to name and create a new path from the current note state

### 5.2 Center Pane — Note Editor

**Toolbar (top of center pane):**
- Current path indicator (pill showing path name, e.g. "main path")
- `↗ New direction` — fork/branch from current state
- `⊕ Connect` — open link drawer to connect this note to another
- `◷ History` — open history slider
- `↑ Sync` — sync workspace to remote (right-aligned)
- Saved indicator (dot + "saved" text, auto-updates)

**Editor area:**
- Note title (large, editable h1 at top)
- Metadata line: "edited X ago · path name · N checkpoints · N connections" (muted, small)
- Horizontal rule
- Body: CodeMirror 6 markdown editor
  - Syntax highlighting for markdown
  - Inline wikilink autocomplete (`[[note name]]` syntax)
  - `??` syntax highlights as an "open question" inline mark
- **Smart fork detection**: when a paragraph appears to introduce a counterargument or divergent direction, a non-intrusive tooltip appears: `↗ Explore a different direction?` with "Yes, explore it" and "Not now" options
- Cursor blinks in yellow accent color

**History slider:**
- Triggered by the `◷ History` button
- Slides in as a panel at the bottom of the center pane
- A horizontal scrubber showing dots for each checkpoint
- Dragging left shows older versions of the note (read-only view)
- Hover a dot: shows the optional "What were you thinking?" note if one was left
- "You're viewing an older version" banner when not at HEAD
- "Restore this version" button

### 5.3 Right Sidebar — Connections

**Top section — Graph view**
- Force-directed node graph
- Current note = large yellow node (always centered/highlighted)
- Connected notes = smaller nodes, positioned by connection strength
- Edge lines are color-coded by type:
  - `supports` → yellow/gold
  - `challenges` → amber/orange
  - `came from` → muted/grey
  - `open question` → dashed line
- Clicking a node navigates to that note
- Scroll to zoom, drag to pan

**Bottom section — Linked Notes**
- List view of all connections for the current note
- Each item shows: colored dot (by link type), note title, link type label
- "+ Add connection" button opens a search dialog

---

## 6. Feature Specifications

### 6.1 Workspace Initialization

On first launch, Yarrow shows an onboarding screen:
1. "Where would you like to keep your notes?" — folder picker (defaults to `~/Yarrow`)
2. Yarrow calls `git init` on the chosen folder (via git2-rs)
3. Creates `.yarrow/config.toml` with defaults
4. Creates an initial note `getting-started.md`
5. Makes an initial checkpoint (silent)

Opening an existing workspace: just open the folder. Yarrow detects `.yarrow/config.toml` and initializes.

### 6.2 Auto-Checkpointing

- Every note save triggers a git commit via git2-rs
- Debounced: waits 3 seconds after last keystroke before committing
- Commit message is auto-generated as `checkpoint: <note-title> <timestamp>` — user never sees this
- **Optional "What were you thinking?" prompt**: when a user closes a note (not on every save), a small non-modal toast appears at the bottom: `Leave a note about what you were thinking? (optional)` with a text input. If filled in, it is appended to the commit message. If ignored, it disappears after 5 seconds.

### 6.3 Exploring a New Direction (Branching)

**Trigger:** User clicks `↗ New direction` in the toolbar, or accepts the smart fork suggestion, or clicks `↗ Explore a new direction…` in the left sidebar.

**Flow:**
1. A small modal appears: "What direction are you exploring?" with a text input (e.g., "the counterargument", "more hopeful take", "before I read X")
2. User types a name and confirms
3. Yarrow calls `git checkout -b <sanitized-name>` via git2-rs
4. The path indicator in the toolbar updates to show the new path name
5. The left sidebar path tree updates to show the fork
6. The user continues writing — they are now on a new path

**Switching between paths:**
- Click any path in the left sidebar path tree
- Yarrow calls `git checkout <branch>` via git2-rs
- Editor reloads with the note content from that path

### 6.4 Bringing Paths Together (Merging)

- Triggered by right-clicking a path in the sidebar and selecting "Bring together with current path"
- If clean merge: Yarrow merges silently, updates the editor content, done
- If conflict: The editor enters "Your thinking diverged here" mode:
  - The conflicting paragraphs are shown side-by-side in the editor
  - A banner appears: "You wrote different things about this on two different paths. Which version feels right now?"
  - User can choose left, choose right, or manually edit the combined text
  - Confirming resolves the conflict and commits

### 6.5 Connections (Links)

**Creating a link:**
1. Click `⊕ Connect` in the toolbar, or type `[[` in the editor to trigger autocomplete
2. Search for the target note by name
3. Choose the link type: `supports` / `challenges` / `came from` / `open question`
4. Link is written to the frontmatter of the current note
5. A reverse backlink is automatically written to the target note's frontmatter

**Link types and their meaning:**
- `supports` — this note backs up the linked note's argument
- `challenges` — this note contradicts or questions the linked note
- `came from` — this note grew out of the linked note
- `open question` — this is an unresolved tension between the two notes; surfaces as a dangling edge in the graph

**Inline wikilinks:**
- `[[note title]]` in the body renders as a clickable pill
- Clicking navigates to that note
- These are cosmetic only — the actual link graph data lives in frontmatter

### 6.6 Scratchpad

- A special note that **does not auto-checkpoint**
- Accessible from the left sidebar (pinned at the bottom of the notes list)
- Clearly marked "Scratchpad — nothing here is saved permanently"
- A "Keep this" button at the top promotes content: prompts for a note title and moves the content to a real note, which then begins checkpointing normally
- Scratchpad content is stored in `.yarrow/scratchpad.md` and is `.gitignore`'d

### 6.7 Sync

- One button: `↑ Sync` in the editor toolbar
- On click: Yarrow calls `git push` and `git pull` (or `git pull --rebase`) via git2-rs
- Status indicator in the toolbar: green dot = synced, amber dot = local changes pending, red dot = sync error
- If no remote is configured, clicking Sync opens a setup dialog:
  - "Where would you like to back up your workspace?"
  - Options: GitHub (OAuth flow), Gitea (URL + token), Custom git URL
  - Once configured, stored in `.yarrow/config.toml`

### 6.8 The Connections Graph

- Rendered in the right sidebar using D3.js (or @antv/g6)
- Force-directed layout
- Current note always highlighted as the largest yellow node
- Nodes fade in opacity based on connection distance from current note (direct connections bright, second-degree dimmer, etc.)
- Edge lines colored by type (see 5.3)
- Hovering a node shows a tooltip with the note title and connection type
- Clicking a node navigates to that note
- Right-clicking an edge offers: "Change connection type" or "Remove connection"

### 6.9 Paths Not Taken (Dead Branches)

- Accessible via the "Paths not taken" collapsible in the left sidebar
- Lists all paths/branches that are not the current active path and have no recent activity
- Shown in muted styling with a date of last activity
- Clicking opens the note in read-only "history" view on that path
- Options: "Revive this path" (checks it out), "Delete permanently" (with confirmation)

### 6.10 Inline Open Questions

- Typing `??` followed by text creates an open question mark in the editor
- Example: `?? Does this argument hold if the system is adversarial?`
- Renders with a distinctive yellow underline in the editor
- A panel in the right sidebar (below the connections) shows all `??` items in the current note as a list
- These also appear in the connections graph as dashed outgoing edges from the note

### 6.11 Unconnected Thoughts (Orphan Detection)

- In the bottom of the left sidebar, a subtle indicator: "3 unconnected notes"
- Clicking opens a panel listing all notes with no incoming or outgoing links
- From this panel, you can quickly open a note, delete it, or connect it to another note

### 6.12 Provenance (Blame)

- Hovering over any paragraph in the editor for 1.5+ seconds shows a small tooltip:
  `Written on [date] · [path name]`
- This is powered by `git blame` via git2-rs on the note file
- Gives authors a sense of when and in what context a piece of thinking was formed

### 6.13 Focus Mode

- Triggered by a button in the toolbar (or keyboard shortcut)
- Hides the left sidebar and right sidebar
- Shows only the note title and body, full width
- A subtle "exit focus" button appears in the top-right corner on hover
- The path indicator and sync button remain visible but smaller

### 6.14 Decay Indicator

- Notes not opened or modified in more than 60 days (configurable) show a faint visual treatment in the notes list
- A small "◌ Hasn't been visited in 60 days" tooltip on hover
- Not deleted, not moved — just surfaced as potentially stale
- Can be dismissed per-note ("I know, it's fine")

---

## 7. Data Model

### 7.1 Note (`.md` file)

```
File: notes/<slug>.md
Git-tracked: yes
Auto-committed: yes (on save, debounced)
```

Frontmatter fields:
```yaml
title: string           # human-readable title
created: ISO8601        # creation timestamp
modified: ISO8601       # last modified timestamp
links:                  # outgoing connections
  - target: string      # slug of target note
    type: string        # supports | challenges | came-from | open-question
tags: string[]          # optional user tags
```

### 7.2 Workspace Config (`.yarrow/config.toml`)

```toml
[workspace]
name = "My Workspace"
created = "2026-04-16T09:00:00Z"

[sync]
remote_url = "https://github.com/user/my-yarrow.git"
remote_type = "github"  # github | gitea | custom

[preferences]
decay_days = 60
autocheckpoint_debounce_ms = 3000
focus_mode_default = false
ask_thinking_on_close = true
```

### 7.3 Link Graph Index (`.yarrow/index.json`)

- A cached flat representation of all note connections
- Rebuilt by scanning all `.md` frontmatter on workspace open and after any save
- Used to power the graph view without re-reading all files on every render
- Never committed to git (in `.gitignore`) — it's a derived cache

```json
{
  "notes": [
    { "slug": "on-complexity", "title": "On the nature of complexity" },
    { "slug": "systems-thinking", "title": "Systems thinking" }
  ],
  "links": [
    { "from": "on-complexity", "to": "systems-thinking", "type": "supports" },
    { "from": "on-complexity", "to": "distributed-trust", "type": "challenges" }
  ],
  "last_built": "2026-04-16T11:30:00Z"
}
```

---

## 8. Git Abstraction Layer (Rust)

All git operations live in a Rust module (`src-tauri/src/git.rs`). This module is the only place in the codebase that touches git2-rs. The frontend never calls git directly.

### 8.1 Operations to implement

```rust
// Workspace
fn init_workspace(path: &Path) -> Result<()>
fn open_workspace(path: &Path) -> Result<Workspace>

// Checkpointing (commits)
fn checkpoint(repo: &Repository, message: &str) -> Result<Oid>
fn get_checkpoints(repo: &Repository, note_slug: &str) -> Result<Vec<Checkpoint>>
fn get_note_at_checkpoint(repo: &Repository, note_slug: &str, oid: Oid) -> Result<String>

// Paths (branches)
fn list_paths(repo: &Repository) -> Result<Vec<Path>>
fn create_path(repo: &Repository, name: &str) -> Result<()>
fn switch_path(repo: &Repository, name: &str) -> Result<()>
fn delete_path(repo: &Repository, name: &str) -> Result<()>
fn merge_paths(repo: &Repository, from: &str, into: &str) -> Result<MergeResult>

// Sync (push/pull)
fn sync(repo: &Repository, config: &SyncConfig) -> Result<SyncResult>

// Provenance (blame)
fn get_paragraph_provenance(repo: &Repository, note_slug: &str, line: u32) -> Result<Provenance>

// History
fn get_note_history(repo: &Repository, note_slug: &str) -> Result<Vec<HistoryEntry>>
fn restore_note_to_checkpoint(repo: &Repository, note_slug: &str, oid: Oid) -> Result<()>
```

### 8.2 Tauri commands (IPC bridge)

Each git operation is exposed as a Tauri command callable from the React frontend:

```rust
#[tauri::command]
async fn cmd_create_path(name: String, state: State<AppState>) -> Result<(), String>

#[tauri::command]
async fn cmd_sync(state: State<AppState>) -> Result<SyncStatus, String>

// etc.
```

---

## 9. v1 Scope — What to Build First

Focus ruthlessly on the core loop. Everything else is v2+.

### ✅ Must have in v1

- [ ] Workspace initialization (new + open existing)
- [ ] Note list in left sidebar (create, open, rename, delete)
- [ ] Markdown editor (CodeMirror 6)
- [ ] Auto-checkpointing (debounced save → silent git commit)
- [ ] Path list in left sidebar (visual branch tree)
- [ ] Create a new direction / path (branch)
- [ ] Switch between paths (checkout)
- [ ] Typed connections between notes (frontmatter links)
- [ ] Connections list in right sidebar
- [ ] Basic graph view in right sidebar (D3, force-directed)
- [ ] Sync with a configured remote (push/pull, one button)
- [ ] History slider (view past checkpoints)
- [ ] Wikilink autocomplete (`[[note title]]`)
- [ ] Focus mode
- [ ] Scratchpad

### ⏳ v2 features (explicitly out of scope for v1)

- Smart fork detection (AI/heuristic paragraph analysis)
- "Paths not taken" graveyard UI (the branches exist in git, just no dedicated UI yet)
- Inline `??` open questions rendering
- Orphan detection panel
- Decay indicator
- Provenance (blame) hover tooltip
- "Bring together" merge UI (the git merge works, just no UI yet)
- Conflict resolution UI
- Mobile companion app
- Export to static site
- AI features (semantic neighbor suggestions, etc.)
- Team/shared vaults

---

## 10. Non-Goals

These are things Yarrow will explicitly never do, to protect its identity:

- **Expose git terminology to the user.** Ever. Not even "advanced mode."
- **Require a cloud account to work.** Yarrow works fully offline.
- **Store notes in a proprietary format.** Always `.md`, always plain text.
- **Gate the core branching/graph features behind a paywall.** These are the product.
- **Become a task manager or project management tool.** Notes only.
- **Bundle Chromium (Electron).** Tauri only. Binary size and memory footprint are a feature.

---

## 11. Design Tokens (for UI implementation)

```css
--bg:    #fdfcf3;   /* warm cream — primary background */
--s1:    #faf6e4;   /* slightly deeper cream — sidebar bg */
--s2:    #f3eccc;   /* panel/toolbar bg */
--s3:    #e9e0aa;   /* active/hover states */
--yel:   #e8b820;   /* primary yellow accent — active nodes, highlights */
--yel2:  #f5c930;   /* brighter yellow — hover */
--yelp:  #fef6cc;   /* pale yellow — node fill, pills */
--yeld:  #b8900e;   /* dark yellow/amber — text on yellow bg, labels */
--char:  #1c1a08;   /* near-black with warm tint — primary text */
--ch2:   #3a3820;   /* secondary dark */
--t2:    #6e6b44;   /* muted body text */
--t3:    #a09c6c;   /* very muted / placeholder text */
--bd:    #ddd5a0;   /* borders */
--bd2:   #c8bf80;   /* slightly stronger borders */
```

**Typography:**
- Display / headings: `Fraunces` (serif, variable — opsz 9..144)
- Body / UI: `Figtree` (sans-serif, weights 300–600)
- Monospace / labels / metadata: `JetBrains Mono` (weights 400–500)

---

## 12. Project Structure

```
yarrow/
├── src-tauri/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── git.rs          ← all git2-rs operations
│       ├── workspace.rs    ← workspace init, config read/write
│       ├── notes.rs        ← note file CRUD, frontmatter parsing
│       ├── graph.rs        ← link index build/query
│       └── commands.rs     ← all #[tauri::command] handlers
├── src/                    ← React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── LeftSidebar/
│   │   │   ├── NoteList.tsx
│   │   │   └── PathTree.tsx
│   │   ├── Editor/
│   │   │   ├── NoteEditor.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   └── HistorySlider.tsx
│   │   └── RightSidebar/
│   │       ├── ConnectionGraph.tsx
│   │       └── LinkedNotesList.tsx
│   ├── hooks/
│   │   ├── useWorkspace.ts
│   │   ├── useNote.ts
│   │   └── useGraph.ts
│   └── lib/
│       ├── tauri.ts        ← typed wrappers around invoke()
│       └── frontmatter.ts  ← parse/serialize note frontmatter
├── package.json
├── tauri.conf.json
└── YARROW_SPEC.md          ← this file
```

---

## 13. Getting Started for Claude Code

To begin implementation:

1. Scaffold a new Tauri 2.x + React + TypeScript project:
   ```bash
   npm create tauri-app@latest yarrow -- --template react-ts
   ```

2. Add Rust dependencies to `src-tauri/Cargo.toml`:
   ```toml
   git2 = "0.19"
   serde = { version = "1", features = ["derive"] }
   serde_json = "1"
   toml = "0.8"
   gray_matter = "0.2"   # frontmatter parser
   ```

3. Add frontend dependencies:
   ```bash
   npm install codemirror @codemirror/lang-markdown d3 @types/d3
   npm install gray-matter tailwindcss
   ```

4. Build in this order:
   - `git.rs` — get all git operations working and tested
   - `workspace.rs` + `notes.rs` — file system operations
   - `commands.rs` — Tauri IPC bridge
   - Left sidebar (note list only, no paths yet)
   - Basic editor (CodeMirror, no toolbar)
   - Auto-checkpointing
   - Path list in sidebar
   - Create/switch paths
   - Connections UI (list first, graph second)
   - Sync

Start with the git layer and work outward. Every feature the user sees is just a UI wrapper around an operation in `git.rs`.
