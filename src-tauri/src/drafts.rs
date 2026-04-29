// Drafts (Pillar 2 of YARROW_BRANCHING_SPEC.md) — per-note alternative
// bodies stored as sibling files. They let a writer hold two or three
// versions of one note in mind at once without inventing a path/branch
// for the alternative.
//
// Design choices, deliberate:
//
//   * Files only, no git. Drafts live under
//     `.yarrow/drafts/<slug>/<draft-name>.md` which is gitignored.
//     Drafts are scratchpad-grade — never synced, never history-tracked.
//     If a draft is worth keeping, the user `promote`s it (which
//     overwrites the canonical note body and flushes through the normal
//     save → checkpoint path).
//
//   * No frontmatter. A draft is just a markdown body. The user is
//     iterating on PROSE, not metadata; tags and links live on the
//     canonical note. Promoting a draft preserves the canonical note's
//     frontmatter unchanged — only the body is replaced.
//
//   * Slug-scoped names, not globally unique. Two notes can each have
//     a draft called "rough." The full key is (note slug, draft name).
//
//   * Sanitised draft names. We accept anything the user types but
//     replace filesystem-hostile characters before writing. The
//     display name is preserved separately in a tiny `.meta.toml` so
//     the user sees their original phrasing back even if the file is
//     `rough-take.md`.

use crate::error::{Result, YarrowError};
use crate::workspace::yarrow_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Filesystem layout: every note's drafts live under a directory keyed
/// by its slug. We don't pre-create that dir until the first draft is
/// written.
fn drafts_root(workspace_root: &Path) -> PathBuf {
    yarrow_dir(workspace_root).join("drafts")
}

fn drafts_dir_for(workspace_root: &Path, slug: &str) -> PathBuf {
    drafts_root(workspace_root).join(slug)
}

fn meta_path(workspace_root: &Path, slug: &str) -> PathBuf {
    drafts_dir_for(workspace_root, slug).join(".meta.toml")
}

fn draft_file_path(workspace_root: &Path, slug: &str, name_id: &str) -> PathBuf {
    drafts_dir_for(workspace_root, slug).join(format!("{name_id}.md"))
}

/// Convert a user-supplied draft name into a filesystem-safe identifier.
/// Falls back to `draft` if the input is empty after sanitisation, so
/// callers always get a usable filename.
fn sanitise(name: &str) -> String {
    let cleaned: String = name
        .trim()
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => c,
            ' ' => '-',
            _ => '-',
        })
        .collect();
    let collapsed: String = cleaned
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "draft".to_string()
    } else {
        collapsed.to_lowercase()
    }
}

/// One draft as exposed to the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Draft {
    /// Filesystem-safe identifier — what we use as the `name` arg in
    /// every other command.
    pub id: String,
    /// User-typed name preserved through the round-trip. Falls back to
    /// `id` if no display name was recorded.
    pub display_name: String,
    /// Unix-secs mtime of the draft file, for sorting.
    pub modified: i64,
}

/// `.meta.toml` schema — a tiny sidecar mapping draft id → display
/// name. Kept separate from the draft body so the body stays a clean
/// .md file the user could open in any editor.
#[derive(Debug, Default, Serialize, Deserialize)]
struct DraftsMeta {
    #[serde(default)]
    drafts: std::collections::BTreeMap<String, DraftMetaEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DraftMetaEntry {
    display_name: String,
}

fn read_meta(workspace_root: &Path, slug: &str) -> DraftsMeta {
    let path = meta_path(workspace_root, slug);
    let raw = match fs::read_to_string(&path) {
        Ok(r) => r,
        Err(_) => return DraftsMeta::default(),
    };
    toml::from_str(&raw).unwrap_or_default()
}

fn write_meta(workspace_root: &Path, slug: &str, meta: &DraftsMeta) -> Result<()> {
    let dir = drafts_dir_for(workspace_root, slug);
    fs::create_dir_all(&dir)?;
    let s = toml::to_string_pretty(meta).map_err(|e| YarrowError::Other(e.to_string()))?;
    fs::write(meta_path(workspace_root, slug), s)?;
    Ok(())
}

/// List drafts for a note. Empty Vec when the note has none — this
/// includes notes that have never had a draft (no directory yet).
pub fn list(workspace_root: &Path, slug: &str) -> Result<Vec<Draft>> {
    let dir = drafts_dir_for(workspace_root, slug);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let meta = read_meta(workspace_root, slug);
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        // Skip the meta sidecar.
        if name == ".meta.toml" {
            continue;
        }
        let id = match name.strip_suffix(".md") {
            Some(s) => s.to_string(),
            None => continue,
        };
        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let display_name = meta
            .drafts
            .get(&id)
            .map(|m| m.display_name.clone())
            .unwrap_or_else(|| id.clone());
        out.push(Draft { id, display_name, modified });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

/// Create a new draft seeded with the given body. Returns the draft id
/// (after sanitisation + collision avoidance — if the user creates two
/// drafts called "rough" we suffix the second with `-2`).
pub fn create(
    workspace_root: &Path,
    slug: &str,
    display_name: &str,
    seed_body: &str,
) -> Result<Draft> {
    let dir = drafts_dir_for(workspace_root, slug);
    fs::create_dir_all(&dir)?;
    let base = sanitise(display_name);
    let mut id = base.clone();
    let mut suffix = 2;
    while draft_file_path(workspace_root, slug, &id).exists() {
        id = format!("{base}-{suffix}");
        suffix += 1;
    }
    fs::write(draft_file_path(workspace_root, slug, &id), seed_body)?;
    let mut meta = read_meta(workspace_root, slug);
    meta.drafts.insert(
        id.clone(),
        DraftMetaEntry { display_name: display_name.trim().to_string() },
    );
    write_meta(workspace_root, slug, &meta)?;
    let modified = chrono::Utc::now().timestamp();
    Ok(Draft {
        id,
        display_name: display_name.trim().to_string(),
        modified,
    })
}

/// Read a draft's body. Errors if the draft doesn't exist.
pub fn read(workspace_root: &Path, slug: &str, draft_id: &str) -> Result<String> {
    let path = draft_file_path(workspace_root, slug, draft_id);
    if !path.exists() {
        return Err(YarrowError::Other(format!("draft not found: {draft_id}")));
    }
    Ok(fs::read_to_string(&path)?)
}

/// Save a draft's body. Creates the file on first save (the create call
/// also writes seed content; this is the "edit later" path).
pub fn save(workspace_root: &Path, slug: &str, draft_id: &str, body: &str) -> Result<()> {
    let dir = drafts_dir_for(workspace_root, slug);
    fs::create_dir_all(&dir)?;
    fs::write(draft_file_path(workspace_root, slug, draft_id), body)?;
    Ok(())
}

/// Rename a draft's display name. The filesystem id stays stable so
/// any in-flight save/read calls don't break — only the user-visible
/// label updates.
pub fn rename(
    workspace_root: &Path,
    slug: &str,
    draft_id: &str,
    new_display_name: &str,
) -> Result<()> {
    if !draft_file_path(workspace_root, slug, draft_id).exists() {
        return Err(YarrowError::Other(format!("draft not found: {draft_id}")));
    }
    let mut meta = read_meta(workspace_root, slug);
    meta.drafts.insert(
        draft_id.to_string(),
        DraftMetaEntry { display_name: new_display_name.trim().to_string() },
    );
    write_meta(workspace_root, slug, &meta)?;
    Ok(())
}

/// Discard a draft permanently. No trash, no undo — drafts are
/// scratchpad-grade. If discarding the last draft, the directory is
/// left in place (cheap to leave; harmless empty dir).
pub fn discard(workspace_root: &Path, slug: &str, draft_id: &str) -> Result<()> {
    let path = draft_file_path(workspace_root, slug, draft_id);
    if path.exists() {
        fs::remove_file(&path)?;
    }
    let mut meta = read_meta(workspace_root, slug);
    meta.drafts.remove(draft_id);
    write_meta(workspace_root, slug, &meta)?;
    Ok(())
}
