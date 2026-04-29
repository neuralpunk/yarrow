use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::{Result, YarrowError};
use crate::notes;

const TRASH_DIR: &str = ".yarrow/trash";

#[derive(Clone, Serialize, Deserialize)]
pub struct TrashEntry {
    pub slug: String,
    pub title: String,
    pub deleted_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
struct Sidecar {
    title: String,
    deleted_at: DateTime<Utc>,
    /// The original slug at deletion time. Stored so a restore puts the
    /// note back where it lived, even if the trash file got a suffix to
    /// avoid colliding with a previous deletion of the same name.
    /// Optional for backwards-compat with sidecars written before 1.1.x.
    #[serde(default)]
    original_slug: Option<String>,
}

fn trash_root(root: &Path) -> PathBuf { root.join(TRASH_DIR) }

/// Like [`notes::slug_is_filesystem_safe`] but accepts the `-deleted-<N>`
/// suffix that trash storage slugs may carry on top of a regular or
/// daily slug.
fn trash_slug_is_safe(slug: &str) -> bool {
    let core = slug
        .rsplit_once("-deleted-")
        .and_then(|(base, n)| {
            if !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) {
                Some(base)
            } else {
                None
            }
        })
        .unwrap_or(slug);
    notes::slug_is_filesystem_safe(core)
}

fn body_path(root: &Path, slug: &str) -> PathBuf {
    let safe = if trash_slug_is_safe(slug) { slug } else { notes::POISON_SLUG };
    trash_root(root).join(format!("{safe}.md"))
}

fn meta_path(root: &Path, slug: &str) -> PathBuf {
    let safe = if trash_slug_is_safe(slug) { slug } else { notes::POISON_SLUG };
    trash_root(root).join(format!("{safe}.meta.json"))
}

/// Move a note's file into `.yarrow/trash/`. The caller is responsible for
/// removing the live file from the working tree (and creating the checkpoint).
/// Returns the absolute body path inside the trash so callers can detect
/// already-trashed items.
///
/// If a trashed entry with the same slug already exists (i.e. the user
/// previously deleted a note, recreated one with the same title, then
/// deleted the new one), the new stash gets a numeric suffix so the older
/// trash entry isn't silently overwritten. Both remain restorable
/// independently from the Trash modal.
pub fn stash(root: &Path, slug: &str) -> Result<PathBuf> {
    fs::create_dir_all(trash_root(root))?;
    let live = notes::note_path(root, slug);
    if !live.exists() {
        return Err(YarrowError::NoteNotFound(slug.to_string()));
    }
    let title = match notes::read(root, slug) {
        Ok(n) => {
            let t = n.frontmatter.title;
            if t.is_empty() { slug.to_string() } else { t }
        }
        Err(_) => slug.to_string(),
    };
    // Pick a non-colliding storage slug: try the original first, then suffix.
    let mut storage_slug = slug.to_string();
    let mut n: u32 = 1;
    while body_path(root, &storage_slug).exists() {
        n += 1;
        storage_slug = format!("{slug}-deleted-{n}");
        if n > 9999 {
            // Defensive cap so a corrupt trash dir can't spin us forever.
            return Err(YarrowError::Other(
                "trash collision count exceeded — please empty trash".into(),
            ));
        }
    }
    let body = body_path(root, &storage_slug);
    fs::copy(&live, &body)?;
    let sidecar = Sidecar {
        title,
        deleted_at: Utc::now(),
        original_slug: Some(slug.to_string()),
    };
    fs::write(meta_path(root, &storage_slug), serde_json::to_vec_pretty(&sidecar)?)?;
    Ok(body)
}

pub fn list(root: &Path) -> Result<Vec<TrashEntry>> {
    let dir = trash_root(root);
    if !dir.exists() { return Ok(vec![]); }
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".md") { continue; }
        let slug = name.trim_end_matches(".md").to_string();
        let meta_p = meta_path(root, &slug);
        let (title, deleted_at) = if meta_p.exists() {
            let raw = fs::read(&meta_p)?;
            let s: Sidecar = serde_json::from_slice(&raw).unwrap_or(Sidecar {
                title: slug.clone(),
                deleted_at: Utc::now(),
                original_slug: None,
            });
            (s.title, s.deleted_at)
        } else {
            (slug.clone(), Utc::now())
        };
        out.push(TrashEntry { slug, title, deleted_at });
    }
    out.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
    Ok(out)
}

/// Restore a trashed note: copy `.yarrow/trash/<storage_slug>.md` back into
/// `notes/` under its original slug. If the original slot is occupied (the
/// user recreated something with the same title in the meantime), suffix
/// the restored note's slug so we don't clobber the live one. Caller is
/// responsible for the checkpoint. Sidecar + body are removed on success.
/// Returns the slug the note was restored under so the frontend can jump
/// straight to it.
pub fn restore(root: &Path, slug: &str) -> Result<String> {
    let body = body_path(root, slug);
    if !body.exists() {
        return Err(YarrowError::NoteNotFound(format!("trash: {slug}")));
    }
    // Read the sidecar to find the note's original slug — `slug` here is
    // the *storage* slug (may carry a `-deleted-N` suffix from collision).
    let target_slug = match fs::read(meta_path(root, slug))
        .ok()
        .and_then(|raw| serde_json::from_slice::<Sidecar>(&raw).ok())
        .and_then(|s| s.original_slug)
    {
        Some(s) => s,
        None => slug.to_string(),
    };
    let mut final_slug = target_slug.clone();
    let mut n: u32 = 1;
    while notes::note_path(root, &final_slug).exists() {
        n += 1;
        final_slug = format!("{target_slug}-restored-{n}");
        if n > 9999 {
            return Err(YarrowError::Other(
                "could not find a free slug to restore into".into(),
            ));
        }
    }
    let live = notes::note_path(root, &final_slug);
    if let Some(parent) = live.parent() { fs::create_dir_all(parent)?; }
    fs::copy(&body, &live)?;
    fs::remove_file(&body).ok();
    fs::remove_file(meta_path(root, slug)).ok();
    Ok(final_slug)
}

pub fn purge(root: &Path, slug: &str) -> Result<()> {
    let body = body_path(root, slug);
    if body.exists() { fs::remove_file(&body)?; }
    let meta = meta_path(root, slug);
    if meta.exists() { fs::remove_file(&meta)?; }
    Ok(())
}

pub fn empty(root: &Path) -> Result<()> {
    let dir = trash_root(root);
    if dir.exists() { fs::remove_dir_all(&dir)?; }
    Ok(())
}

/// Drop entries older than `days`. Returns the number of slugs purged.
pub fn purge_older_than(root: &Path, days: i64) -> Result<usize> {
    let cutoff = Utc::now() - chrono::Duration::days(days);
    let mut purged = 0usize;
    for entry in list(root)? {
        if entry.deleted_at < cutoff {
            purge(root, &entry.slug)?;
            purged += 1;
        }
    }
    Ok(purged)
}
