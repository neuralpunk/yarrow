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
    /// User-assigned accent, as a CSS color string (e.g. `#dc8a4a`). When
    /// `None`, the UI falls back to the derived hue from the path name so
    /// upgraded workspaces keep their existing look without any migration.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// When set, this path auto-includes every note whose frontmatter
    /// `tags` contains this value. The reconciler runs on save / tag
    /// change / path edit and keeps `members` in sync. Notes added
    /// manually stay in `members` even if they don't carry the tag —
    /// the reconciler only adds, it never subtracts manual additions
    /// (we record each set so we can remove only what we added).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_membership_tag: Option<String>,
    /// `true` for paths that represent a **full copy of the workspace** —
    /// every existing note is a member at creation time, and newly-created
    /// notes are auto-added to keep the "I can edit any note on this path"
    /// invariant alive as the workspace grows. Defaults to `false` on load
    /// so legacy collections keep their curated memberships unchanged.
    #[serde(default)]
    pub full_workspace: bool,
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
    let members = list_workspace_slugs(workspace)?;
    let main = PathCollection {
        name: "main".into(),
        condition: "The trunk of your thinking.".into(),
        parent: String::new(),
        main_note: members.first().cloned(),
        members,
        created_at: Utc::now().timestamp(),
        color: None,
        auto_membership_tag: None,
        full_workspace: true,
    };
    let view = CollectionsView {
        root: "main".into(),
        collections: vec![main],
    };
    write_view(workspace, &view)?;
    Ok(view)
}

/// Enumerate every `.md` slug currently in the workspace's `notes/` dir.
/// Shared by `seed`, `create`, and the auto-add reconciler so new paths
/// and new notes stay in sync without duplicated walk logic.
pub(crate) fn list_workspace_slugs(workspace: &Path) -> Result<Vec<String>> {
    let notes_dir = crate::workspace::notes_dir(workspace);
    let mut out = Vec::new();
    if notes_dir.exists() {
        collect_slugs(&notes_dir, "", &mut out)?;
    }
    out.sort();
    out.dedup();
    Ok(out)
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
    parent: &str,
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
    // Honour the requested parent so the user can build genuine nested
    // chains (main → trip → budget → ...), not just a flat fan off the
    // root. Empty string or a name that doesn't match any existing
    // collection falls back to the current root as a safety net. The
    // chosen parent is still permanent: once stamped, it never changes
    // (promotion is still a pointer-flip on `view.root`).
    let parent = if parent.is_empty() {
        view.root.clone()
    } else if view.collections.iter().any(|c| c.name == parent) {
        parent.to_string()
    } else {
        view.root.clone()
    };
    let main_note = main_note.map(|s| s.to_string());
    // Seed the new path with a **full copy of the workspace** — every note
    // that currently exists on main is also a member of this path at
    // creation time. That lets the user edit any note on the path without
    // hitting "this note isn't on this path" dead-ends, and makes the
    // "compare paths" view meaningful (every slug lines up). Members stay
    // in sync as new notes are created, via the `full_workspace` flag.
    let mut members = list_workspace_slugs(workspace)?;
    if let Some(ref mn) = main_note {
        if !members.contains(mn) {
            members.insert(0, mn.clone());
        }
    }
    let new = PathCollection {
        name: name.clone(),
        condition: condition.trim().to_string(),
        parent,
        main_note,
        members,
        created_at: Utc::now().timestamp(),
        color: None,
        auto_membership_tag: None,
        full_workspace: true,
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

/// Set (or clear, when passing `None` / empty) the tag that drives this
/// path's auto-membership. Persisted alongside the rest of the path's
/// fields; reconciliation is invoked by the caller after this returns.
/// Append a prebuilt collection to the on-disk view. Used by the
/// sample-vault bootstrap — the normal `create()` flow derives its
/// members/main-note from the seed slug; here the caller has every
/// field ready and just wants them written.
pub fn append(workspace: &Path, new: PathCollection) -> Result<()> {
    let mut view = read_all(workspace)?;
    if view.collections.iter().any(|c| c.name == new.name) {
        return Err(YarrowError::Other(format!(
            "Path '{}' already exists.",
            new.name
        )));
    }
    view.collections.push(new);
    write_view(workspace, &view)
}

pub fn set_auto_membership_tag(
    workspace: &Path,
    name: &str,
    tag: Option<&str>,
) -> Result<()> {
    let mut view = read_all(workspace)?;
    let Some(c) = view.collections.iter_mut().find(|c| c.name == name) else {
        return Err(YarrowError::Other(format!("Path '{}' not found.", name)));
    };
    c.auto_membership_tag = match tag.map(|s| s.trim().trim_start_matches('#')) {
        Some("") | None => None,
        Some(v) => Some(v.to_string()),
    };
    write_view(workspace, &view)
}

/// Add a newly-created or newly-renamed slug to every `full_workspace`
/// path, so "the path is a full copy of main" stays true as the workspace
/// grows. Paths that are NOT marked full_workspace (legacy curated lenses
/// and tag-driven paths) are left alone. Idempotent.
pub fn reconcile_new_note(workspace: &Path, slug: &str) -> Result<()> {
    let mut view = read_all(workspace)?;
    let mut changed = false;
    for c in view.collections.iter_mut() {
        if !c.full_workspace {
            continue;
        }
        if c.members.iter().any(|s| s == slug) {
            continue;
        }
        c.members.push(slug.to_string());
        changed = true;
    }
    if changed {
        write_view(workspace, &view)?;
    }
    Ok(())
}

/// Remove a slug from every path's membership — called after a hard delete
/// so the membership lists don't dangle. Returns Ok even when nothing
/// matched. Does NOT touch per-path overrides (caller should clean those
/// up separately if desired).
pub fn reconcile_deleted_note(workspace: &Path, slug: &str) -> Result<()> {
    let mut view = read_all(workspace)?;
    let mut changed = false;
    for c in view.collections.iter_mut() {
        let before = c.members.len();
        c.members.retain(|s| s != slug);
        if c.main_note.as_deref() == Some(slug) {
            c.main_note = c.members.first().cloned();
            changed = true;
        }
        if c.members.len() != before {
            changed = true;
        }
    }
    if changed {
        write_view(workspace, &view)?;
    }
    Ok(())
}

/// Reconcile every path's membership with its `auto_membership_tag`.
///
/// Pure additive: if a path has `auto_membership_tag = Some("x")`, then
/// every note whose frontmatter tags contain `"x"` must be a member.
/// Notes added by the user that don't match the tag are left alone —
/// the reconciler never subtracts. Callers should invoke this after
/// any note save or tag edit so auto-paths stay fresh.
///
/// Returns the count of notes that were added across all paths, so
/// callers can decide whether a checkpoint/graph-rebuild is warranted.
pub fn reconcile_auto_membership(
    workspace: &Path,
    note_tags_by_slug: &HashMap<String, Vec<String>>,
) -> Result<usize> {
    let mut view = read_all(workspace)?;
    let mut added_total = 0usize;
    let mut changed = false;
    for c in view.collections.iter_mut() {
        let Some(tag) = c.auto_membership_tag.as_deref() else {
            continue;
        };
        if tag.is_empty() {
            continue;
        }
        let member_set: HashSet<String> = c.members.iter().cloned().collect();
        for (slug, tags) in note_tags_by_slug {
            if !tags.iter().any(|t| t == tag) {
                continue;
            }
            if member_set.contains(slug) {
                continue;
            }
            c.members.push(slug.clone());
            added_total += 1;
            changed = true;
        }
    }
    if changed {
        write_view(workspace, &view)?;
    }
    Ok(added_total)
}

/// Set (or clear, when passing an empty string) the user-assigned accent
/// color for a path. Lightly validates the input: must be a CSS hex color
/// (#rgb, #rrggbb, or #rrggbbaa). We refuse anything else so a malformed
/// value can't smuggle arbitrary CSS into `style=` attributes downstream.
pub fn set_color(workspace: &Path, name: &str, color: Option<&str>) -> Result<()> {
    let mut view = read_all(workspace)?;
    let Some(c) = view.collections.iter_mut().find(|c| c.name == name) else {
        return Err(YarrowError::Other(format!("Path '{}' not found.", name)));
    };
    c.color = match color.map(|s| s.trim()) {
        Some("") | None => None,
        Some(v) => {
            if !is_hex_color(v) {
                return Err(YarrowError::Other(
                    "Color must be a CSS hex value like #cc8844.".to_string(),
                ));
            }
            Some(v.to_string())
        }
    };
    write_view(workspace, &view)
}

fn is_hex_color(s: &str) -> bool {
    let bytes = s.as_bytes();
    if bytes.first() != Some(&b'#') {
        return false;
    }
    let rest = &bytes[1..];
    matches!(rest.len(), 3 | 4 | 6 | 8)
        && rest.iter().all(|b| b.is_ascii_hexdigit())
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

/// Result of promoting a path — tells the caller which slugs need to be
/// saved back into main (with encryption re-applied if the main version is
/// encrypted), and how many overrides total were applied.
pub struct PromoteResult {
    pub applied_slugs: Vec<(String, String)>, // (slug, new_body)
    pub override_count: usize,
}

/// Build the promotion plan — for each override the path has, pair the
/// slug with its (plaintext) body so the caller can run the save that
/// preserves encryption per-note. Doesn't mutate anything: the caller is
/// responsible for writing via `notes::write` and then calling
/// `delete_overrides_for_path` + `delete` on this module to finish.
pub fn build_promote_plan(workspace: &Path, path_name: &str) -> Result<PromoteResult> {
    let view = read_all(workspace)?;
    if view.root == path_name {
        return Err(YarrowError::Invalid(
            "That path is already the current main.".into(),
        ));
    }
    if !view.collections.iter().any(|c| c.name == path_name) {
        return Err(YarrowError::PathNotFound(path_name.to_string()));
    }
    let overridden = crate::path_content::list_overridden_slugs(workspace, path_name)?;
    let mut applied = Vec::with_capacity(overridden.len());
    for slug in &overridden {
        if let Some(raw) = crate::path_content::read_override(workspace, path_name, slug)? {
            // Skip frontmatter — the promote step re-serializes through
            // notes::write so the caller preserves encryption and
            // modified-timestamps correctly.
            let (_fm, body) = crate::notes::parse(&raw);
            applied.push((slug.clone(), body));
        }
    }
    Ok(PromoteResult {
        applied_slugs: applied,
        override_count: overridden.len(),
    })
}

/// After a successful promote, wipe the path's scratch content and remove
/// the collection entry. Keeps the root's name intact — we don't rename
/// the root here; "promoting" means "take this path's changes as truth,"
/// not "rename the root."
pub fn finalize_promote(workspace: &Path, path_name: &str) -> Result<()> {
    crate::path_content::delete_overrides_for_path(workspace, path_name)?;
    delete(workspace, path_name)?;
    Ok(())
}

/// Compare two v2 path collections by membership, producing a shape
/// compatible with the existing `git::PathComparison` so the frontend
/// doesn't need a second render path.
///
/// In v2, notes are lenses, not branches — their content is shared across
/// paths. So this compare is honest about what's being measured: which
/// notes a user has grouped into each path. When a note is a member of
/// both paths it's marked "same" (same content, by construction). When
/// it's only in one side, it's "added"/"removed" relative to that side.
pub fn compare_as_paths(
    workspace: &Path,
    left_name: &str,
    right_name: &str,
) -> Result<crate::git::PathComparison> {
    use std::collections::BTreeSet;
    let view = read_all(workspace)?;
    let left = view
        .collections
        .iter()
        .find(|c| c.name == left_name)
        .ok_or_else(|| YarrowError::PathNotFound(left_name.to_string()))?;
    let right = view
        .collections
        .iter()
        .find(|c| c.name == right_name)
        .ok_or_else(|| YarrowError::PathNotFound(right_name.to_string()))?;

    let left_set: HashSet<String> = left.members.iter().cloned().collect();
    let right_set: HashSet<String> = right.members.iter().cloned().collect();
    let all: BTreeSet<String> = left_set.union(&right_set).cloned().collect();

    let mut entries: Vec<crate::git::PathDiffEntry> = Vec::with_capacity(all.len());
    let mut summary = crate::git::PathCompareSummary {
        added: 0,
        removed: 0,
        modified: 0,
        same: 0,
    };

    // Resolve a side's effective body for this slug: override if the path
    // has one, else main's current body. Returns None when the slug isn't
    // present on that side at all.
    let resolve = |path_name: &str, slug: &str, present: bool| -> Option<String> {
        if !present {
            return None;
        }
        if path_name != view.root {
            if let Ok(Some(raw)) = crate::path_content::read_override(workspace, path_name, slug) {
                // Override file: parse frontmatter off, return body only.
                let (_, body) = crate::notes::parse(&raw);
                return Some(body);
            }
        }
        crate::notes::read(workspace, slug).ok().map(|n| n.body)
    };

    for slug in all {
        let in_left = left_set.contains(&slug);
        let in_right = right_set.contains(&slug);
        let left_body = resolve(left_name, &slug, in_left);
        let right_body = resolve(right_name, &slug, in_right);
        let l_lines = left_body.as_ref().map(|b| b.lines().count()).unwrap_or(0);
        let r_lines = right_body.as_ref().map(|b| b.lines().count()).unwrap_or(0);
        // Structure-preserving excerpts: keep blank lines and formatting so
        // the frontend can compute a meaningful line-level diff. 4000 chars
        // is enough for most real notes.
        let l_ex = left_body.as_deref().and_then(|b| crate::git::long_excerpt(b, 4000));
        let r_ex = right_body.as_deref().and_then(|b| crate::git::long_excerpt(b, 4000));

        let status: &'static str = match (in_left, in_right) {
            (true, true) => {
                // With overrides, content can legitimately differ even in v2.
                if left_body == right_body {
                    summary.same += 1;
                    "same"
                } else {
                    summary.modified += 1;
                    "modified"
                }
            }
            (true, false) => {
                summary.removed += 1;
                "removed"
            }
            (false, true) => {
                summary.added += 1;
                "added"
            }
            (false, false) => continue,
        };

        entries.push(crate::git::PathDiffEntry {
            slug,
            status,
            left_excerpt: l_ex,
            right_excerpt: r_ex,
            left_lines: l_lines,
            right_lines: r_lines,
        });
    }

    Ok(crate::git::PathComparison {
        left: left_name.to_string(),
        right: right_name.to_string(),
        entries,
        summary,
    })
}
