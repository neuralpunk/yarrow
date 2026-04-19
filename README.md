# Yarrow

> Notes that branch, evolve, and connect.

Yarrow is a local-first desktop note-taking app built around the way thinking
actually works — non-linear, branching, and never lost. Your notes are plain
markdown files in a folder you choose. Every change is a silent checkpoint you
can scrub back to. **Paths** are named lenses over your notes — collections
you can arrange as a tree, rooted at a designated main, so you can see at a
glance which notes matter under which *"if…"*.

Under the hood, Yarrow is [git](https://git-scm.com/). At the surface, there
is no git anywhere — no commits, no HEAD, no checkouts. Just writing, a graph
of paths to arrange your notes by, and connections you can draw between ideas.

---

## Table of contents

- [What it is](#what-it-is)
- [How it works](#how-it-works)
- [Install — prebuilt binaries](#install--prebuilt-binaries)
  - [macOS](#macos)
  - [Linux](#linux)
- [Install — from source](#install--from-source)
- [First run](#first-run)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Paths](#paths)
- [Importing from Obsidian](#importing-from-obsidian)
- [Sync](#sync)
- [Encryption](#encryption)
- [Principles](#principles)
- [Built with](#built-with)
- [License](#license)

---

## What it is

A single-binary desktop app for the kind of thinking that doesn't fit in a
linear outline. Features:

- **Paths as collections** — named lenses over your notes, branching off a designated root. One note can live in many paths; selecting a path never hides your other notes
- **Forking Road map** — full-screen graph of your paths, left → right, with drag-pan, scroll-zoom, inline "+ branch here" on every node, and hover-highlighted lineage (ancestry + descendants)
- **Per-path Map view** — open the connection graph filtered to any path's member notes
- **Designated main note** per path — the anchor that shows on the path's card
- **Silent auto-checkpointing** — every pause is a checkpoint you can scrub back through
- **Checkpoint & restore modal** — Now / Then side-by-side with diff highlighting
- **Typed connections** — `supports`, `challenges`, `came from`, `open question`
- **Radial connections graph** — structured layout with arrows, legend, and an expand-to-fullscreen view
- **`[[wikilinks]]`** with inline autocomplete, hover preview, and a per-link path-membership chip ("applies on 3 of 5 paths") plus a one-click "Start a path from this note"
- **`![[transclusion]]`** — embed another note, a heading, or a block into any note
- **`??` open questions** that surface in a dedicated panel
- **Pinned notes** — anchor a handful of always-visible notes at the top of the sidebar
- **Tags** — read from frontmatter, shown as a counted sidebar panel and filterable via `#tag` in the command palette
- **Templates** — pick a scaffold when you create a note; ships with meeting notes, book notes, vacation planner, morning pages, project brief, and daily journal
- **Local encryption** — per-note, opt-in ChaCha20-Poly1305 + Argon2id with a BIP39 12-word recovery phrase; frontmatter stays plaintext so graph, tags, and links keep working on locked notes
- **Bulk select** — multi-select notes in the sidebar and delete them in one go
- **Daily notes / journal** with a `Today` shortcut, recency sidebar, and month-grid calendar
- **Quick capture** (`⌘⇧Space` / `Ctrl+Shift+Space`) — pop a small window, append a timestamped entry to the scratchpad
- **Attachments** — drop images or files into the editor; inline image preview
- **Static-site export** — turn your workspace into a shareable HTML folder with client-side search
- **Command palette** (`⌘K` / `Ctrl+K`) and **quick note switcher** (`⌘O` / `Ctrl+O`)
- **Full history** — scrub any note back to any past version
- **Git-anywhere sync** — point it at GitHub, Gitea, or any bare server
- **Editorial type** — body renders in Source Serif 4 at a reading size; UI chrome stays in Inter; metadata in JetBrains Mono
- **Reading mode ↔ Writing mode** — toggle from the right rail (or Settings → Writing) to flip between a fully-rendered HTML view (themed code blocks, bordered tables, blockquote bars, KaTeX math, clickable wikilinks) and raw markdown for structural edits
- **Inline math (KaTeX)** — `$x^2$` renders inline, `$$\int_0^\infty…$$` renders centered; click into the delimiters to edit the LaTeX
- **Code-block syntax highlighting** — fenced ```` ```python ```` (and every other language) get keyword/string/comment colouring while editing, plus themed `<pre>` styling in reading mode
- **Smart paste** — paste a URL and Yarrow auto-fetches the page title, replacing the URL with `[<title>](url)`; with text selected, the selection becomes the link label
- **Spell-check with workspace dictionary** — wavy red underlines on misspellings outside code/wikilinks/URLs, right-click for suggestions and "Add to dictionary" — words live in committed `.yarrow/dictionary.txt` so the team shares vocabulary
- **Workspace-wide find & replace** (`⌘⇧F` / `Ctrl+Shift+F`) — regex toggle, scope (workspace / current path), live previews, undoable as one checkpoint
- **Trash** — deleted notes stash into `.yarrow/trash/` with restore + permanent-purge from a sidebar modal
- **Auto-rename wikilink updates** — renaming a note offers to rewrite every `[[Old Title]]` and `![[Old Title]]` (incl. `[[Old|alias]]` and `[[Old#section]]`) across the workspace as one checkpoint
- **Print / save as PDF** (`⌘P` / `Ctrl+P`) — pulldown-cmark renders the active note with print-friendly styling; save via your OS print dialog
- **Multiple windows** — *Open new window* in the palette spawns a second window onto the same workspace; positions/sizes persist across launches
- **Obsidian vault import** — start a new workspace from an existing Obsidian vault (preserves wikilinks, tags, frontmatter; skips `.obsidian/`)
- **Themes** — paper & plum (light), ink & plum (dark), and auto
- **Path decision tools** — every other path shows a `+N / −M` badge on its card vs. your current path; the path detail panel lists what you'd gain, what you'd leave behind, and what's edited differently (with optional grouping by tag); the **Decision matrix** lets you star must-have notes and read off which path satisfies them; hovering a path card highlights its members in the note list; drag any sidebar note onto a path card to add it
- **Plain markdown forever** — no proprietary format, no lock-in

Roughly ~15 MB binary. No bundled Chromium. No account required. No telemetry.

## How it works

Yarrow is a thin desktop shell (Tauri + Rust) around a tree of markdown files
sitting inside a real git repository.

```
your-workspace/
├── .yarrow/
│   ├── config.toml              # workspace preferences (shared)
│   ├── path-collections.toml    # your paths — a tree of note collections
│   ├── credentials.toml         # sync tokens (per-machine, gitignored)
│   ├── security.toml            # wrapped encryption keys (shared — opaque)
│   ├── dictionary.txt           # workspace spell-check vocabulary (committed)
│   ├── trash/                   # soft-deleted notes (gitignored)
│   ├── session.json             # last-active note per window (gitignored)
│   ├── scratchpad.md            # throwaway jotting (gitignored)
│   ├── templates/
│   │   ├── daily.md             # rendered into new journal entries
│   │   ├── meeting.md
│   │   ├── book.md
│   │   └── …                    # your own templates live here too
│   └── index.json               # derived link / tag cache (gitignored)
├── notes/
│   ├── my-first-note.md
│   ├── another-note.md
│   └── daily/
│       └── 2026-04-17.md        # journal entries
├── attachments/
│   └── 7f2c…e1.png              # content-addressed by SHA-256 prefix
└── .gitignore
```

Every `.md` file has YAML frontmatter (title, timestamps, typed links, tags).
Reciprocal links are written on both sides of each connection, so your notes
remain readable outside Yarrow in any plain-text editor.

**Paths are collections of note slugs**, not separate copies of your notes.
They're stored as a simple TOML tree in `.yarrow/path-collections.toml` —
one note can belong to many paths, and the file is readable and editable by
hand if you like.

Yarrow still uses git for **checkpoints** (every pause is a commit), **history**
(scrub any note back to any past version), and **sync** (push/pull the whole
workspace to any remote you own). Those three are the remaining Yarrow-to-git
vocabulary mappings — paths and branches are no longer the same thing.

| You see… | Under the hood |
|---|---|
| **checkpoint** | commit |
| **history** | `git log` for one file |
| **sync** | `git push` + `git pull` |
| **what were you thinking?** | optional commit message suffix |

Because the workspace is a real git repo, you can always `cd` into it and use
git directly — Yarrow never takes that away.

---

## Install — prebuilt binaries

Binaries are attached to each GitHub Release. Pick the one for your platform.

Visit <https://github.com/neuralpunk/yarrow/releases> and download the latest.

### macOS

Yarrow ships a universal `.dmg` and `.app.tar.gz` for both Apple Silicon and
Intel Macs.

1. Download **`Yarrow_<version>_universal.dmg`** from the latest release.
2. Open the `.dmg` and drag **Yarrow.app** to `/Applications`.
3. First launch: right-click the app → *Open* → *Open* to bypass Gatekeeper.
   (Until the app is notarized, macOS flags it as unsigned. This is safe and
   Gatekeeper will remember your choice.)

> **Upgrading from a pre-1.0.0 build on macOS?** The 1.0.0 release changes
> the bundle identifier (the trailing `.app` conflicted with macOS's
> application-bundle extension). macOS treats the new build as a separate
> app, so before installing 1.0.0:
>
> 1. Quit Yarrow if it's running.
> 2. Drag the old **Yarrow.app** from `/Applications` to the Trash.
> 3. Install 1.0.0 from the new `.dmg`.
>
> **Your notes are safe.** Yarrow stores everything in the workspace
> folder you picked — nothing note-related lives inside the app bundle.

To uninstall: drag `Yarrow.app` to the Trash. Your workspaces live in
whatever folder you chose — Yarrow never writes anywhere else.

### Linux

Three formats are published per release. Use whichever fits your distro:

| Format | Works on | Download |
|---|---|---|
| **AppImage** | any x86_64 distro | `Yarrow_<version>_amd64.AppImage` |
| **.deb** | Debian, Ubuntu, Mint, Pop!_OS | `yarrow_<version>_amd64.deb` |
| **.rpm** | Fedora, RHEL, openSUSE | `yarrow-<version>-1.x86_64.rpm` |

**AppImage** (works anywhere, no install):

```bash
chmod +x Yarrow_*.AppImage
./Yarrow_*.AppImage
```

**.deb** (Ubuntu / Debian / derivatives):

```bash
sudo apt install ./yarrow_*_amd64.deb
```

**.rpm** (Fedora / RHEL / openSUSE):

```bash
sudo dnf install ./yarrow-*.x86_64.rpm
# or on openSUSE:
sudo zypper install ./yarrow-*.x86_64.rpm
```

Linux runtime depends on `webkit2gtk-4.1`. On Fedora that's
`webkit2gtk4.1-devel`; on Debian/Ubuntu it's `libwebkit2gtk-4.1-0`. The
package installer pulls these in for `.deb` / `.rpm`; AppImage runs as long
as the runtime lib is present.

### Windows

A `.msi` installer and a portable `.exe` are published alongside the Mac and
Linux bundles on each release. Windows is tested on Windows 10+.

---

## Install — from source

You'll need:

- **Node.js** 20+ (any recent LTS) and **npm** 10+
- **Rust** stable (install via <https://rustup.rs>)
- Platform-specific Tauri prerequisites (see below)

### Platform prerequisites

**macOS:**

```bash
xcode-select --install
```

**Linux (Fedora):**

```bash
sudo dnf install webkit2gtk4.1-devel libsoup3-devel librsvg2-devel gtk3-devel
```

**Linux (Debian / Ubuntu):**

```bash
sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev \
                 libgtk-3-dev build-essential curl wget file
```

**Windows:**

- Visual Studio Build Tools 2019+ with "Desktop development with C++"
- WebView2 runtime (bundled with recent Windows 11; otherwise from
  <https://developer.microsoft.com/microsoft-edge/webview2/>)

### Clone and run

```bash
git clone https://github.com/neuralpunk/yarrow.git
cd yarrow
npm install
npm run tauri dev
```

That opens a dev build with hot reload. Close it when you're done — it
doesn't install anything on your system.

### Build a local release binary

```bash
npm run tauri build
```

The binary appears under `src-tauri/target/release/bundle/`. On Linux you'll
see `appimage/`, `deb/`, and `rpm/` subfolders; on macOS a `.dmg`; on Windows
a `.msi` and `.exe`.

### Other useful commands

```bash
npm run dev           # Vite frontend only (no Tauri window)
npm run build         # tsc + vite build (no Tauri)
npm run typecheck     # tsc --noEmit
cd src-tauri && cargo check    # validate the Rust backend
cd src-tauri && cargo test     # run Rust tests
```

### Try it with a sample workspace

```bash
./scripts/make-sample-workspace.sh ~/yarrow-demo
npm run tauri dev
# then point Yarrow at ~/yarrow-demo
```

The sample is a two-week European-trip planning vault with a dozen notes,
typed connections, and a second path.

---

## First run

On first launch, Yarrow asks you to **create** or **open** a workspace.

- **Create** opens a two-step in-app wizard:
  1. Pick what you're starting from — a blank notebook, or an existing
     Obsidian vault (file picker for the vault folder).
  2. Name the workspace, pick where it lives (defaults to
     `~/Documents/Yarrow/<name>`, editable, with a Browse button), choose
     **Branch path mapping** (recommended — paths, links, the map) or
     **Basic notes**, and for blank-mapped workspaces give the starting
     note a name. A live "Will create:" preview shows the absolute path
     forming as you type.

  Yarrow creates the folder, initializes a git repo, writes
  `.yarrow/config.toml`, and (for Obsidian imports) copies your `.md`
  files in as a single checkpoint.

- **Open** picks a folder that already has a `.yarrow/config.toml` inside.

Your workspace is just a git repo. You can back it up by copying the folder,
push it to a remote you own, or open the `.md` files in any other editor —
Yarrow will happily re-index on the next launch.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette — search, jump, run anything |
| `⌘O` / `Ctrl+O` | Quick note switcher (fuzzy title search) |
| `⌘N` / `Ctrl+N` | New note |
| `⌘⇧N` / `Ctrl+Shift+N` | Start a new path |
| `⌘⇧B` / `Ctrl+Shift+B` | Branch from the current note (same dialog) |
| `⌘T` / `Ctrl+T` | Jump to today's journal (auto-switches to main) |
| `⌘←` / `Ctrl+←` | Previous journal entry (while a daily note is open) |
| `⌘→` / `Ctrl+→` | Next journal entry (while a daily note is open) |
| `⌘⇧Space` / `Ctrl+Shift+Space` | Quick capture → scratchpad |
| `⌘⇧F` / `Ctrl+Shift+F` | Workspace-wide find &amp; replace |
| `⌘P` / `Ctrl+P` | Print or save the active note as PDF |
| `⌘\` / `Ctrl+\` | Toggle focus mode |
| `⌘L` / `Ctrl+L` | Lock encrypted notes (only when encryption is enabled) |
| `⌘,` / `Ctrl+,` | Open Settings |

---

## Paths

A **path** in Yarrow is a named collection of notes arranged as a branch off a
designated root. The shape is a tree: the root (`main` by default) is the
trunk, every other path is a child of some other path, and one note can
belong to many paths at once. Selecting a path never changes which notes you
can read — it's a lens, not a view-switch.

Every path has:

- **A name** — a slug like `if-seattle-job`.
- **An `if…` condition** — the question this path is asking
  (*"If the Seattle job comes through"*). Shown on the path card and on
  the fork signpost in the graph.
- **A parent** — every path except the root descends from another path.
- **A main note (★)** — the anchor. Shown on the path card and in the
  detail header. Any member note can be designated.
- **Members** — the note slugs this path contains. Add or remove them
  from the detail panel; the notes themselves are never copied or moved.

**Starting a new path.** Press `⌘⇧B` / `Ctrl+Shift+B` (from anywhere) or click
*Branch this* in the toolbar. You write the *"if…"* question; the path is
auto-named, created as a child of the root by default (pick any other path
from the chip row if you want a sub-branch), and the note you were writing
becomes its main note.

**The Forking Road map.** Open from the right-rail *Paths* button. Left to
right: root on the left, forks fan out to the right. Drag to pan, scroll to
zoom, `+` on any card to branch from there, click a node to select it and
open the detail panel. The selection highlights the path's **ancestry**
(what it's under) and **descendants** (what branches off it).

**The per-path Map.** Every path detail panel has an *Open the map for this
path* button. It opens the full connection graph filtered to only that
path's member notes and their wikilinks — the fast answer to *"what does
this path actually hold together?"*

**Managing paths.** In the detail panel: rename, edit the *"if…"*, designate
a main note, add and remove member notes, spin any member note off into its
own child path with one click. Deleting a path never deletes its notes;
children reattach to the deleted path's parent.

`.yarrow/path-collections.toml` is the whole story — readable, committable,
editable by hand. If something looks wrong, open it.

### Decision tools

Every path is a question. Yarrow gives you four ways to answer *"so what
does taking this one actually mean?"* — without writing a single side
document.

- **Card badges.** Each path card on the Forking Road graph shows a
  `+N / −M` badge relative to the path you're currently on. Hover the
  badge for a tooltip; the card you're on is labeled `YOU ARE HERE`.
- **"If you take this path…"** panel in the path detail. Three groups:
  `+` you'd gain, `~` present on both but with edited content, `−` you'd
  leave behind. Toggle "group by tag" to cluster the lists under their
  tags ("you'd lose 3 #museum notes").
- **Decision matrix** — open from the command palette. Rows are notes,
  columns are paths, cells are ✓/✗. Click a row's ☆ to star it as a
  must-have; column headers grow a `★ N/M` score that turns red if any
  starred row is missing. Filter by tag chip, by text, or to "only ★
  rows" once you've decided what matters. Stars persist per-workspace.
- **Hover-to-highlight** — pointing at a path card lights up its slugs
  in the note list and dims the rest. Opening a path keeps the highlight
  on while the detail panel is open. The two views read as one.
- **Drag-to-add** — drag any note from the sidebar onto a path card on
  the graph (or onto the "In this path" section of an open path) to add
  it. Useful for quickly assembling a path without opening the picker.

## Importing from Obsidian

Yarrow can read an Obsidian vault directly. Two ways in:

- **From the new-workspace wizard** — when creating a workspace, pick
  "Import an Obsidian vault" in step 1. The wizard pre-fills the new
  workspace name from the vault folder, and the import runs as part of
  workspace creation.
- **Into an existing workspace** — `⌘K` → *Import an Obsidian vault…*,
  pick the vault folder.

What's preserved: every `.md` file, your `[[wikilinks]]`, your `#tags`,
existing YAML frontmatter (`title`, `created`, `modified`, `tags`).

What's skipped: `.obsidian/` config, `.trash/`, anything else under a
dotfile directory.

The whole import is one git checkpoint, so if something looks wrong you
can scrub back through History on any imported note. Slug collisions
auto-suffix (`-2`, `-3`, …) and the wizard surfaces the rename list.

## Sync

**Sync is optional.** Yarrow works fully offline. If you want a backup or
multi-machine sync, point it at any git remote you own:

- GitHub (public or private)
- Gitea / Forgejo
- any bare git server you can reach

**Settings → Sync:** paste the clone URL, optionally an access token for
HTTPS private repos, and click *Sync*. The token is stored in
`.yarrow/credentials.toml` on this machine only — it's never committed.

Conflicts that arise from a pull surface through Yarrow's built-in
side-by-side resolver (*"your thinking diverged"*).

## Encryption

**Encryption is optional and per-note.** Turn it on from
**Settings → Security**, pick a password, and write down the 12-word recovery
phrase Yarrow shows you once. Then mark individual notes as encrypted from
the command palette (*Encrypt this note*) — the rest of your workspace stays
plain markdown.

Under the hood:

- **ChaCha20-Poly1305** AEAD seals each note body with a fresh 12-byte nonce.
- **Argon2id** (m = 64 MiB, t = 3, p = 1) derives keys from your password and
  from the recovery phrase.
- The workspace master key is **wrapped twice** in `.yarrow/security.toml` —
  once by the password-derived key and once by the recovery-derived key — so
  either can unlock without storing the other.
- Frontmatter (title, tags, links) stays plaintext. The sidebar, tag filter,
  and connection graph keep working on encrypted notes.
- Your password is never persisted. The master key lives in RAM for the
  session and is zeroed on lock, on idle timeout (configurable, default
  15 min), and on app quit.
- Encrypted notes are **skipped** by static-site export and full-text body
  search. Diffs for encrypted notes in the history slider are decrypted on
  demand against the session key.

Lose both your password and your recovery phrase and the encrypted notes are
gone. There is no backdoor — that's the point.

## Principles

- **Nothing you write is ever lost.** Abandoned paths are an archive, not the trash.
- **Plain text, forever.** `.md` files in a folder. Open in any editor.
- **Local-first.** Works fully offline. Sync to a remote you own, or don't.
- **Human vocabulary.** Paths are collections, checkpoints are commits — never git jargon in the UI.
- **Your notes, your keys.** Encryption is opt-in and client-side. Yarrow
  never sees your password, and there is no recovery backdoor beyond the
  phrase you wrote down.

## Built with

[Tauri 2](https://tauri.app) · [Rust](https://www.rust-lang.org) ·
[git2-rs](https://github.com/rust-lang/git2-rs) ·
[pulldown-cmark](https://github.com/raphlinus/pulldown-cmark) ·
[React](https://react.dev) + [TypeScript](https://www.typescriptlang.org) ·
[CodeMirror 6](https://codemirror.net) · [D3](https://d3js.org) ·
[Tailwind CSS](https://tailwindcss.com)

## License

[MIT](LICENSE)
