//! Seeds a freshly-initialized workspace with a small set of connected
//! notes, demonstrating wikilinks, tags, typed connections, and paths.
//! The user can delete everything afterward — this is scaffolding, not
//! required content.
//!
//! Called after `workspace::init` by `cmd_init_sample_workspace`. Every
//! note here uses the existing `notes::write` path so frontmatter /
//! slug / checkpoint semantics match user-authored notes.

use std::path::Path;

use chrono::Utc;
use serde::Serialize;

use crate::error::Result;
use crate::notes::{self, Frontmatter, Link};
use crate::path_collections::{self, PathCollection};
use crate::workspace;

/// One seeded note: title + body + tags + any outbound typed links. The
/// function turns these into `.md` files on disk.
struct Seed {
    slug: &'static str,
    title: &'static str,
    body: &'static str,
    tags: &'static [&'static str],
    links: &'static [(&'static str, &'static str)], // (target slug, link type)
    pinned: bool,
}

const SEEDS: &[Seed] = &[
    Seed {
        slug: "welcome",
        title: "Welcome to Yarrow",
        body: "This is a small starter vault — eight notes connected by \
               wikilinks, tags, and paths. Delete anything you don't \
               want to keep; add your own notes any time.\n\n\
               Start with [[The daily journal]] if you want a warm-up \
               exercise, or [[Paths, explained]] if you want to see what \
               makes Yarrow different from other markdown apps.\n\n\
               ?? Should my first real note live on this path or on \
               `main`?\n",
        tags: &["welcome", "starter"],
        links: &[
            ("daily-journal", "supports"),
            ("paths-explained", "supports"),
        ],
        pinned: true,
    },
    Seed {
        slug: "paths-explained",
        title: "Paths, explained",
        body: "A **path** in Yarrow is a collection of notes held together \
               by a shared 'if…' question. You branch a path whenever you \
               want to explore an alternative without losing the original.\n\n\
               Every path has a *condition* — a short sentence that \
               captures the premise you're pursuing. Condition first, \
               notes later.\n\n\
               See also: [[Connections, explained]], [[Branching from an idea]].\n",
        tags: &["paths", "starter"],
        links: &[
            ("connections-explained", "supports"),
            ("branching-from-an-idea", "came-from"),
        ],
        pinned: false,
    },
    Seed {
        slug: "connections-explained",
        title: "Connections, explained",
        body: "A connection (or *wikilink*) is how notes talk to each \
               other. In writing mode, right-click → Insert wikilink… \
               to pick a target note. In the Map, drag one note onto \
               another to connect them.\n\n\
               Connections can be typed — *supports*, *challenges*, \
               *came from*, or *open question* — so the graph says \
               something about the *shape* of your thinking, not just \
               its topology.\n\n\
               See also: [[Paths, explained]], [[A fork moment]].\n",
        tags: &["connections", "starter"],
        links: &[("paths-explained", "supports")],
        pinned: false,
    },
    Seed {
        slug: "branching-from-an-idea",
        title: "Branching from an idea",
        body: "When a sentence you just wrote feels like the start of a \
               different direction, Yarrow offers to *branch* — create a \
               new path whose condition is that sentence.\n\n\
               You keep your current note intact. The branch is a \
               lens: later you can compare 'what would I do if this were \
               true?' against 'what I actually believe now.'\n\n\
               See: [[A fork moment]], [[Making a decision]].\n",
        tags: &["paths", "starter"],
        links: &[("a-fork-moment", "supports")],
        pinned: false,
    },
    Seed {
        slug: "daily-journal",
        title: "The daily journal",
        body: "Press ⌘T (Ctrl+T on Linux/Windows) to jump to today's \
               journal. Journals always live on `main` — they're the \
               least-fictional path.\n\n\
               Every time you open today's journal, Yarrow auto-links \
               the notes you edited that day under a 'Today's threads' \
               section. It's a lightweight way to trace what you were \
               thinking about across the day.\n\n\
               See: [[Welcome to Yarrow]].\n",
        tags: &["starter", "daily"],
        links: &[],
        pinned: false,
    },
    Seed {
        slug: "a-fork-moment",
        title: "A fork moment",
        body: "Sometimes you can feel the sentence you're about to \
               write veering away from the point of the note. That's a \
               fork moment. Yarrow watches for those and suggests \
               branching — you can accept or dismiss.\n\n\
               ?? When is a fork useful vs. just a distraction to \
               archive?\n\n\
               See: [[Branching from an idea]], [[Making a decision]].\n",
        tags: &["paths", "starter"],
        links: &[("making-a-decision", "supports")],
        pinned: false,
    },
    Seed {
        slug: "making-a-decision",
        title: "Making a decision",
        body: "Once you've explored a couple of paths, the **Decision \
               matrix** (⌘K → 'Decision matrix') lets you star the \
               must-have notes and see which path carries them.\n\n\
               Paths aren't permanent. Promote the one you want to live \
               in; the others become *ghost eras* — still searchable, \
               still real, just no longer active.\n\n\
               See: [[Reading mode vs writing mode]].\n",
        tags: &["paths", "starter"],
        links: &[("reading-mode-vs-writing-mode", "came-from")],
        pinned: false,
    },
    Seed {
        slug: "reading-mode-vs-writing-mode",
        title: "Reading mode vs writing mode",
        body: "**Writing mode** is the editor — your prose as raw \
               markdown with live affordances for links, tables, and \
               tags.\n\n\
               **Reading mode** (toggle in the toolbar) renders the \
               same note as a finished page: headings styled, \
               wikilinks clickable, footnotes expanded. Toggle back and \
               forth as you think.\n\n\
               The math and code-highlighting extras only render in \
               both modes if you enable them in Settings → Writing \
               extras. Off by default for performance.\n",
        tags: &["starter", "editor"],
        links: &[],
        pinned: false,
    },
];

#[derive(Debug, Serialize)]
pub struct SampleSeedReport {
    pub notes_created: usize,
    pub paths_created: usize,
}

/// Write every seed note, then stamp a `path-collections.toml` that
/// includes a second path ("explore-the-ideas") pre-populated with a
/// few of the notes so the Paths view isn't empty.
pub fn seed(workspace_root: &Path) -> Result<SampleSeedReport> {
    let now = Utc::now().to_rfc3339();
    for s in SEEDS {
        let fm = Frontmatter {
            title: s.title.to_string(),
            created: now.clone(),
            modified: now.clone(),
            links: s
                .links
                .iter()
                .map(|(target, type_)| Link {
                    target: (*target).to_string(),
                    link_type: (*type_).to_string(),
                })
                .collect(),
            tags: s.tags.iter().map(|t| (*t).to_string()).collect(),
            pinned: s.pinned,
            encrypted: false,
            kdf: String::new(),
            salt: String::new(),
            nonce: String::new(),
            annotations: vec![],
            private: false,
            folder: None,
        };
        notes::write(workspace_root, s.slug, s.body, Some(fm))?;
    }

    // Build an "explore-the-ideas" path containing the conceptual notes.
    // Main is seeded with every note by `path_collections::read_all`'s
    // first-use migration; we layer the second path on top.
    let _ = path_collections::read_all(workspace_root)?; // ensure seed
    let new_path = PathCollection {
        name: "explore-the-ideas".to_string(),
        condition: "If I lean into the non-linear thinking ideas".to_string(),
        parent: "main".to_string(),
        main_note: Some("paths-explained".to_string()),
        members: vec![
            "paths-explained".into(),
            "connections-explained".into(),
            "branching-from-an-idea".into(),
            "a-fork-moment".into(),
            "making-a-decision".into(),
        ],
        created_at: Utc::now().timestamp(),
        color: Some("#a85cc9".into()),
        auto_membership_tag: Some("paths".into()),
        full_workspace: false,
        archived: false,
    };
    path_collections::append(workspace_root, new_path)?;

    Ok(SampleSeedReport {
        notes_created: SEEDS.len(),
        paths_created: 1,
    })
}

/// Convenience wrapper used by the init-sample-workspace command so
/// callers don't need to reach into two modules.
pub fn bootstrap(workspace_root: &Path, name: &str) -> Result<SampleSeedReport> {
    workspace::init(workspace_root, name, "mapped", Some("welcome"))?;
    seed(workspace_root)
}
