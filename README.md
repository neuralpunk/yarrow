# Yarrow

> Notes that branch, evolve, and connect.

Yarrow is a local-first desktop note-taking app built around the way thinking
actually works — non-linear, branching, and never lost. Your notes are plain
markdown files in a folder you choose. Every change is a silent checkpoint you
can scrub back to. Every time you want to try a different take on an idea, you
open a new **direction**, and the original stays exactly where it was.

Under the hood, Yarrow is [git](https://git-scm.com/). At the surface, there is
no git anywhere — no commits, no branches, no HEAD. Just writing, paths you
can fork and return to, and connections you can draw between ideas.

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
- [Sync](#sync)
- [Principles](#principles)
- [Built with](#built-with)
- [License](#license)

---

## What it is

A single-binary desktop app for the kind of thinking that doesn't fit in a
linear outline. Features:

- **Branching paths** — try a different angle on any note without losing the original
- **Silent auto-checkpointing** — every pause is a checkpoint you can scrub back through
- **Typed connections** — `supports`, `challenges`, `came from`, `open question`
- **A living graph** — force-directed view of how your notes relate
- **`[[wikilinks]]`** with inline autocomplete and hover-to-preview
- **`??` open questions** that surface in a dedicated panel
- **Daily notes / journal** with a `Today` shortcut and recency sidebar
- **Attachments** — drop images or files into the editor; inline image preview
- **Static-site export** — turn your workspace into a shareable HTML folder
- **Command palette** (`⌘K` / `Ctrl+K`) and **quick note switcher** (`⌘O` / `Ctrl+O`)
- **Full history** — scrub any note back to any past version
- **Git-anywhere sync** — point it at GitHub, Gitea, or any bare server
- **Themes** — warm cream (light), warm dusk (dark), auto, and Blueberry + Yellow
- **Plain markdown forever** — no proprietary format, no lock-in

Roughly ~15 MB binary. No bundled Chromium. No account required. No telemetry.

## How it works

Yarrow is a thin desktop shell (Tauri + Rust) around a tree of markdown files
sitting inside a real git repository.

```
your-workspace/
├── .yarrow/
│   ├── config.toml          # workspace preferences (shared)
│   ├── credentials.toml     # sync tokens (per-machine, gitignored)
│   ├── scratchpad.md        # throwaway jotting (gitignored)
│   └── index.json           # derived link cache (gitignored)
├── notes/
│   ├── my-first-note.md
│   ├── another-note.md
│   └── daily/
│       └── 2026-04-17.md    # journal entries
├── attachments/
│   └── 7f2c…e1.png          # content-addressed by SHA-256 prefix
└── .gitignore
```

Every `.md` file has YAML frontmatter (title, timestamps, typed links, tags).
Reciprocal links are written on both sides of each connection, so your notes
remain readable outside Yarrow in any plain-text editor.

The mapping of Yarrow vocabulary to git primitives (fully hidden from the UI):

| You see… | Under the hood |
|---|---|
| **checkpoint** | commit |
| **path** | branch |
| **new direction** | `git checkout -b` |
| **bring together** | merge |
| **sync** | `git push` + `git pull` |
| **history** | `git log` for one file |
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

- **Create:** pick an empty folder. Yarrow initializes a git repo there,
  writes `.yarrow/config.toml`, drops a seed note, and opens the editor.
- **Open:** pick a folder that already has a `.yarrow/config.toml` inside.

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
| `⌘⇧N` / `Ctrl+Shift+N` | Explore a new direction (new path) |
| `⌘T` / `Ctrl+T` | Jump to today's journal (auto-switches to main) |
| `⌘\` / `Ctrl+\` | Toggle focus mode |
| `⌘,` / `Ctrl+,` | Open Settings |

---

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

## Principles

- **Nothing you write is ever lost.** Abandoned paths are an archive, not the trash.
- **Plain text, forever.** `.md` files in a folder. Open in any editor.
- **Local-first.** Works fully offline. Sync to a remote you own, or don't.
- **Human vocabulary.** Paths, checkpoints, directions — never git jargon.

## Built with

[Tauri 2](https://tauri.app) · [Rust](https://www.rust-lang.org) ·
[git2-rs](https://github.com/rust-lang/git2-rs) ·
[pulldown-cmark](https://github.com/raphlinus/pulldown-cmark) ·
[React](https://react.dev) + [TypeScript](https://www.typescriptlang.org) ·
[CodeMirror 6](https://codemirror.net) · [D3](https://d3js.org) ·
[Tailwind CSS](https://tailwindcss.com)

## License

To be announced alongside the first public release. See
[CHANGELOG.md](CHANGELOG.md) for release history.
