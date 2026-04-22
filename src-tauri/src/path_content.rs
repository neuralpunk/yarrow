//! Per-path content overrides.
//!
//! Paths v2 treats paths as **lenses** over shared notes — which means edits
//! to a note on path X also touch main's copy, since there's only one file on
//! disk. For users who expect "scratch universe" behaviour ("I want to try
//! out a bigger budget on this path without changing my real budget"), this
//! module adds an opt-in override layer:
//!
//!   * When a user saves a note while on a non-root path, the new body is
//!     written to `.yarrow/path-content/<sanitized-path>/<slug>.md`
//!     instead of `notes/<slug>.md`.
//!   * When a user reads a note while on that path, the override is
//!     returned (if present), else the main file.
//!   * Main's copy is never touched by path-scoped writes — which is the
//!     whole point.
//!
//! Overrides are plain markdown files with the same frontmatter/body shape
//! as main notes. Encryption is NOT supported for overrides in v1 (the
//! main note stays encrypted as-is; overrides are plaintext scratchpad).
//!
//! Lifecycle:
//!   * `write_override` on save while on a non-root path.
//!   * `read_override` on load while on a non-root path — returns None to
//!     mean "no override, use main".
//!   * `list_overridden_slugs` to enumerate a path's scratch content, used
//!     by the compare view and by cleanup on path deletion.
//!   * `delete_overrides_for_path` when a path is thrown away.

use std::path::{Path, PathBuf};

use crate::error::{Result, YarrowError};
use crate::workspace::yarrow_dir;

const ROOT_DIR: &str = "path-content";

fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn path_dir(workspace: &Path, path_name: &str) -> PathBuf {
    yarrow_dir(workspace).join(ROOT_DIR).join(sanitize(path_name))
}

/// Absolute override file location for (path, slug). Parent dirs may not exist.
fn override_file(workspace: &Path, path_name: &str, slug: &str) -> PathBuf {
    let mut p = path_dir(workspace, path_name);
    for seg in slug.split('/') {
        p = p.join(seg);
    }
    p.set_extension("md");
    p
}

pub fn has_override(workspace: &Path, path_name: &str, slug: &str) -> bool {
    override_file(workspace, path_name, slug).exists()
}

pub fn read_override(workspace: &Path, path_name: &str, slug: &str) -> Result<Option<String>> {
    let p = override_file(workspace, path_name, slug);
    if !p.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&p)?;
    Ok(Some(raw))
}

/// Writes the full file content (frontmatter + body) to the override path.
/// Creates parent directories as needed.
pub fn write_override(workspace: &Path, path_name: &str, slug: &str, full_content: &str) -> Result<()> {
    let sanitized = sanitize(path_name);
    if sanitized.is_empty() {
        return Err(YarrowError::Invalid("invalid path name for override".into()));
    }
    let p = override_file(workspace, path_name, slug);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&p, full_content)?;
    Ok(())
}

pub fn delete_override(workspace: &Path, path_name: &str, slug: &str) -> Result<()> {
    let p = override_file(workspace, path_name, slug);
    if p.exists() {
        std::fs::remove_file(p)?;
    }
    Ok(())
}

pub fn list_overridden_slugs(workspace: &Path, path_name: &str) -> Result<Vec<String>> {
    let dir = path_dir(workspace, path_name);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    walk(&dir, &dir, &mut out)?;
    out.sort();
    Ok(out)
}

fn walk(base: &Path, cur: &Path, out: &mut Vec<String>) -> Result<()> {
    for entry in std::fs::read_dir(cur)? {
        let entry = entry?;
        let ft = entry.file_type()?;
        let path = entry.path();
        if ft.is_dir() {
            walk(base, &path, out)?;
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let rel = path.strip_prefix(base).unwrap_or(&path);
        let mut s = rel.with_extension("").to_string_lossy().replace('\\', "/");
        // On Windows, to_string_lossy could still yield backslashes even after replace — normalize.
        if s.starts_with('/') { s.remove(0); }
        out.push(s);
    }
    Ok(())
}

pub fn delete_overrides_for_path(workspace: &Path, path_name: &str) -> Result<()> {
    let dir = path_dir(workspace, path_name);
    if dir.exists() {
        std::fs::remove_dir_all(dir)?;
    }
    Ok(())
}

/// Helper: resolve the body that should be presented for (path, slug).
/// Reads override if present, else the main file's body. Returns None if
/// neither exists (caller decides whether to treat that as 404 or empty).
pub fn resolve_body(workspace: &Path, path_name: Option<&str>, slug: &str) -> Result<Option<String>> {
    if let Some(name) = path_name.filter(|n| !n.is_empty()) {
        if let Some(raw) = read_override(workspace, name, slug)? {
            return Ok(Some(extract_body(&raw)));
        }
    }
    // Fall back to main
    let main = crate::notes::note_path(workspace, slug);
    if !main.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&main)?;
    Ok(Some(extract_body(&raw)))
}

/// Extract the body portion from a raw .md file — skips YAML frontmatter if
/// present. Minimal duplicate of notes::parse's body-splitting step, kept
/// local so this module doesn't pull notes::parse transitively.
fn extract_body(raw: &str) -> String {
    let bytes = raw.as_bytes();
    if bytes.starts_with(b"---\n") || bytes.starts_with(b"---\r\n") {
        // Find closing `---` at start of a line.
        let search_from = if bytes.starts_with(b"---\r\n") { 5 } else { 4 };
        if let Some(end) = find_fm_end(&raw[search_from..]) {
            let body_start = search_from + end;
            return raw[body_start..].trim_start_matches('\n').to_string();
        }
    }
    raw.to_string()
}

fn find_fm_end(s: &str) -> Option<usize> {
    let mut idx = 0usize;
    for line in s.split_inclusive('\n') {
        let trimmed = line.trim_end_matches(|c| c == '\n' || c == '\r');
        if trimmed == "---" {
            return Some(idx + line.len());
        }
        idx += line.len();
    }
    None
}
