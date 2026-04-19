//! Paths, v2 — as **collections of notes**, not git branches.
//!
//! A PathCollection is a named bundle: a condition ("if…"), a parent path
//! (forming a tree rooted at the workspace's designated main path), a
//! *main note* (the anchor for this collection), and a list of member
//! slugs. Unlike the v1 model, collections don't change which notes are
//! visible; they're a lens/overlay. One note can live in many paths.
//!
//! Storage: `.yarrow/path-collections.toml` (tracked). Reading auto-seeds
//! on first access — a single "main" collection containing every note
//! currently in `notes/`. Existing git branches are left alone; they're
//! just no longer surfaced as paths.
//!
//! Invariants enforced on write:
//!   - Exactly one collection has the `root` name and no parent.
//!   - Every non-root collection has a `parent` that references another
//!     collection by name.
//!   - `members` is unique (a slug can't be listed twice on one path).
//!   - `main_note`, if set, is in `members` (coerced if not).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::error::{Result, YarrowError};
use crate::workspace::yarrow_dir;

const FILE: &str = "path-collections.toml";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PathCollection {
    pub name: String,
    #[serde(default)]
    pub condition: String,
    /// The **permanent trunk** — the name of the path this one was branched
    /// off at creation time. This value is set once and never mutated by
    /// promote/demote. Empty string means "this path had no trunk at
    /// creation" (i.e. it was seeded as an original root).
    ///
    /// Live/ghost status is derived, not stored:
    ///   live  = (name == current_root) || (parent == current_root)
    ///   ghost = not live
    ///
    /// So if solo-trip was originally branched off main (parent = "main"),
    /// promoting solo makes it root; promoting main back makes solo live
    /// again (because solo.parent == "main" == root), restoring its
    /// original sibling-of-main relationship without any extra bookkeeping.
    #[serde(default)]
    pub parent: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main_note: Option<String>,
    #[serde(default)]
    pub members: Vec<String>,
    #[serde(default)]
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct CollectionsFile {
    #[serde(default = "default_root")]
    root: String,
    #[serde(default)]
    collections: Vec<PathCollection>,
}

fn default_root() -> String {
    "main".to_string()
}

pub fn file_path(workspace: &Path) -> PathBuf {
    yarrow_dir(workspace).join(FILE)
}

/// Full read, with first-use seeding.
pub fn read_all(workspace: &Path) -> Result<CollectionsView> {
    let path = file_path(workspace);
    if !path.exists() {
        return seed(workspace);
    }
    let raw = std::fs::read_to_string(&path)?;
    match toml::from_str::<CollectionsFile>(&raw) {
        Ok(mut f) => {
            // Normalize: sort root first, dedupe members, coerce main_note.
            for c in f.collections.iter_mut() {
                let mut seen = HashSet::new();
                c.members.retain(|s| seen.insert(s.clone()));
                if let Some(main) = c.main_note.as_ref() {
                    if !c.members.contains(main) {
                        c.members.insert(0, main.clone());
                    }
                }
            }
            // If the declared root is missing, repair by promoting whichever
            // collection has an empty parent (or re-seed from scratch).
            if !f.collections.iter().any(|c| c.name == f.root) {
                if let Some(rc) = f.collections.iter().find(|c| c.parent.is_empty()) {
                    f.root = rc.name.clone();
                } else {
                    return seed(workspace);
                }
            }
            // Migrate legacy data to the permanent-trunk model.
            //
            // The root is identified by `view.root`, NOT by having an empty
            // parent. A path can simultaneously be the current root AND carry
            // a permanent-trunk pointer in `parent` — and it MUST, so that
            // when the path is demoted later, its original era can be
            // restored. So we leave the root's parent alone.
            //
            //   - A path with parent == self is an era-swap artifact from
            //     the earlier era-swap model; clear it so the fallback
            //     below can assign a real trunk.
            //   - A non-root path with parent == "" (usually a path that
            //     was promoted and then demoted under the old model,
            //     losing its original trunk) gets re-parented to the
            //     current root — best-guess for "the workspace's primary
            //     trunk" so the first promote-back restores the sibling
            //     relationship.
            let root_name = f.root.clone();
            for c in f.collections.iter_mut() {
                if c.parent == c.name {
                    c.parent = String::new();
                }
            }
            for c in f.collections.iter_mut() {
                if c.name != root_name && c.parent.is_empty() {
                    c.parent = root_name.clone();
                }
            }
            Ok(CollectionsView { root: f.root, collections: f.collections })
        }
        Err(_) => seed(workspace),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionsView {
    pub root: String,
    pub collections: Vec<PathCollection>,
}

fn seed(workspace: &Path) -> Result<CollectionsView> {
    let notes_dir = crate::workspace::notes_dir(workspace);
    let mut members = Vec::new();
    if notes_dir.exists() {
        collect_slugs(&notes_dir, "", &mut members)?;
    }
    members.sort();
    let main = PathCollection {
        name: "main".into(),
        condition: "The trunk of your thinking.".into(),
        parent: String::new(),
        main_note: members.first().cloned(),
        members,
        created_at: Utc::now().timestamp(),
    };
    let view = CollectionsView {
        root: "main".into(),
        collections: vec![main],
    };
    write_view(workspace, &view)?;
    Ok(view)
}

fn collect_slugs(dir: &Path, prefix: &str, out: &mut Vec<String>) -> Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let ft = entry.file_type()?;
        let name_os = entry.file_name();
        let name = match name_os.to_str() {
            Some(s) => s,
            None => continue,
        };
        if ft.is_dir() {
            let sub = if prefix.is_empty() { name.to_string() } else { format!("{}/{}", prefix, name) };
            collect_slugs(&entry.path(), &sub, out)?;
            continue;
        }
        if let Some(slug) = name.strip_suffix(".md") {
            let full = if prefix.is_empty() { slug.to_string() } else { format!("{}/{}", prefix, slug) };
            out.push(full);
        }
    }
    Ok(())
}

fn write_view(workspace: &Path, view: &CollectionsView) -> Result<()> {
    let path = file_path(workspace);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let file = CollectionsFile {
        root: view.root.clone(),
        collections: view.collections.clone(),
    };
    let raw = toml::to_string_pretty(&file)?;
    std::fs::write(path, raw)?;
    Ok(())
}

// ───────────────────────── mutations ─────────────────────────

pub fn create(
    workspace: &Path,
    name: &str,
    condition: &str,
    _parent: &str,
    main_note: Option<&str>,
) -> Result<PathCollection> {
    let mut view = read_all(workspace)?;
    let name = sanitize_name(name);
    if name.is_empty() {
        return Err(YarrowError::Invalid("Path name cannot be empty.".into()));
    }
    if view.collections.iter().any(|c| c.name == name) {
        return Err(YarrowError::Other(format!("A path named '{}' already exists.", name)));
    }
    // The permanent trunk is the current root — whatever path the user is
    // branching off right now, that's this path's forever-home. Promoting
    // will never touch this value again. The `_parent` arg is ignored for
    // call-site compatibility.
    let parent = view.root.clone();
    let main_note = main_note.map(|s| s.to_string());
    let members: Vec<String> = main_note.iter().cloned().collect();
    let new = PathCollection {
        name: name.clone(),
        condition: condition.trim().to_string(),
        parent,
        main_note,
        members,
        created_at: Utc::now().timestamp(),
    };
    view.collections.push(new.clone());
    write_view(workspace, &view)?;
    Ok(new)
}

pub fn delete(workspace: &Path, name: &str) -> Result<()> {
    let mut view = read_all(workspace)?;
    if view.root == name {
        return Err(YarrowError::Other(
            "Can't delete the root path. Designate another root first.".into(),
        ));
    }
    // Reparent any children to this path's parent.
    let target = match view.collections.iter().find(|c| c.name == name) {
        Some(t) => t.clone(),
        None => return Ok(()),
    };
    for c in view.collections.iter_mut() {
        if c.parent == name {
            c.parent = target.parent.clone();
        }
    }
    view.collections.retain(|c| c.name != name);
    write_view(workspace, &view)
}

pub fn rename(workspace: &Path, old: &str, new: &str) -> Result<()> {
    let mut view = read_all(workspace)?;
    let new = sanitize_name(new);
    if new.is_empty() {
        return Err(YarrowError::Invalid("Path name cannot be empty.".into()));
    }
    if view.collections.iter().any(|c| c.name == new) {
        return Err(YarrowError::Other(format!("A path named '{}' already exists.", new)));
    }
    let mut found = false;
    for c in view.collections.iter_mut() {
        if c.name == old {
            c.name = new.clone();
            found = true;
        }
        if c.parent == old {
            c.parent = new.clone();
        }
    }
    if view.root == old {
        view.root = new.clone();
    }
    if !found {
        return Err(YarrowError::Other(format!("Path '{}' not found.", old)));
    }
    write_view(workspace, &view)
}

pub fn set_condition(workspace: &Path, name: &str, condition: &str) -> Result<()> {
    let mut view = read_all(workspace)?;
    let Some(c) = view.collections.iter_mut().find(|c| c.name == name) else {
        return Err(YarrowError::Other(format!("Path '{}' not found.", name)));
    };
    c.condition = condition.trim().to_string();
    write_view(workspace, &view)
}

pub fn set_main_note(workspace: &Path, name: &str, slug: Option<&str>) -> Result<()> {
    let mut view = read_all(workspace)?;
    let Some(c) = view.collections.iter_mut().find(|c| c.name == name) else {
        return Err(YarrowError::Other(format!("Path '{}' not found.", name)));
    };
    match slug {
        Some(s) => {
            if !c.members.contains(&s.to_string()) {
                c.members.insert(0, s.to_string());
            }
            c.main_note = Some(s.to_string());
        }
        None => {
            c.main_note = None;
        }
    }
    write_view(workspace, &view)
}

pub fn set_parent(workspace: &Path, name: &str, _parent: &str) -> Result<()> {
    // Flat-tree invariant: non-root paths always hang off the root. Callers
    // that want to move a path around should promote it to root instead.
    let mut view = read_all(workspace)?;
    if view.root == name {
        return Err(YarrowError::Other("The root path has no parent.".into()));
    }
    let root = view.root.clone();
    let Some(c) = view.collections.iter_mut().find(|c| c.name == name) else {
        return Err(YarrowError::Other(format!("Path '{}' not found.", name)));
    };
    c.parent = root;
    write_view(workspace, &view)
}

pub fn add_member(workspace: &Path, name: &str, slug: &str) -> Result<()> {
    let mut view = read_all(workspace)?;
    let Some(c) = view.collections.iter_mut().find(|c| c.name == name) else {
        return Err(YarrowError::Other(format!("Path '{}' not found.", name)));
    };
    if !c.members.iter().any(|s| s == slug) {
        c.members.push(slug.to_string());
    }
    write_view(workspace, &view)
}

pub fn remove_member(workspace: &Path, name: &str, slug: &str) -> Result<()> {
    let mut view = read_all(workspace)?;
    let Some(c) = view.collections.iter_mut().find(|c| c.name == name) else {
        return Err(YarrowError::Other(format!("Path '{}' not found.", name)));
    };
    c.members.retain(|s| s != slug);
    if c.main_note.as_deref() == Some(slug) {
        c.main_note = c.members.first().cloned();
    }
    write_view(workspace, &view)
}

/// Promote a collection to be the workspace root ("main").
///
/// In the permanent-trunk model, promoting is a one-line operation: flip
/// the `root` pointer. Every path's `parent` is already the permanent
/// trunk it was created under, so live/ghost status re-derives for free:
///
///   live  = (name == new_root) || (parent == new_root)
///   ghost = not live
///
/// So promoting solo-trip ghosts every path whose parent isn't solo-trip
/// (everyone from the main era); promoting main back flips them all live
/// again, including the previously-promoted solo-trip (whose parent is
/// still "main"). No bookkeeping, no era tags — just the pointer move.
pub fn set_root(workspace: &Path, name: &str) -> Result<()> {
    let mut view = read_all(workspace)?;
    if !view.collections.iter().any(|c| c.name == name) {
        return Err(YarrowError::Other(format!("Path '{}' not found.", name)));
    }
    view.root = name.to_string();
    write_view(workspace, &view)
}

/// Update every collection's members to drop slugs that no longer exist in
/// the working tree. Also drops collections whose main_note is missing? No —
/// keep the collection, just clear its main_note. Called after rename/delete.
pub fn reconcile_with_notes(workspace: &Path, existing_slugs: &HashSet<String>) -> Result<()> {
    let mut view = read_all(workspace)?;
    for c in view.collections.iter_mut() {
        c.members.retain(|s| existing_slugs.contains(s));
        if let Some(main) = c.main_note.clone() {
            if !existing_slugs.contains(&main) {
                c.main_note = c.members.first().cloned();
            }
        }
    }
    write_view(workspace, &view)
}

fn sanitize_name(name: &str) -> String {
    let slug: String = name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch.to_ascii_lowercase()
            } else {
                // Whitespace and any other unsupported character collapse
                // to a dash so multi-word conditions slugify cleanly.
                '-'
            }
        })
        .collect();
    let mut s = slug
        .split('-')
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    s.truncate(80);
    s
}

/// Lookup helpers used by commands that act on a single collection without
/// loading the whole file twice.
pub fn map_by_name(collections: &[PathCollection]) -> HashMap<String, PathCollection> {
    collections.iter().map(|c| (c.name.clone(), c.clone())).collect()
}
