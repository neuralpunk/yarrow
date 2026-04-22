use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::Serialize;
use walkdir::WalkDir;

use crate::error::{Result, YarrowError};
use crate::notes::{self, Frontmatter};
use crate::workspace;

#[derive(Serialize)]
pub struct ImportReport {
    pub imported: usize,
    pub skipped: usize,
    pub renamed: Vec<(String, String)>,
}

/// Copy every `.md` file under `source` into the workspace's `notes/`
/// directory, converting Obsidian-flavored frontmatter and `#tag` annotations
/// into Yarrow's frontmatter shape. `.obsidian/`, `.trash/`, and any path
/// segment beginning with a dot are skipped.
pub fn import_vault(workspace_root: &Path, source: &Path) -> Result<ImportReport> {
    if !source.is_dir() {
        return Err(YarrowError::Invalid(
            "Pick a folder that contains your Obsidian vault.".into(),
        ));
    }
    let notes_dir = workspace::notes_dir(workspace_root);
    std::fs::create_dir_all(&notes_dir)?;
    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut renamed: Vec<(String, String)> = Vec::new();

    for entry in WalkDir::new(source).into_iter().filter_entry(|e| {
        // Honor Obsidian's hidden config + scratch folders, plus any other
        // dotfile/dot-dir under the vault root.
        let name = e.file_name().to_string_lossy();
        !(name.starts_with('.') && e.depth() > 0)
    }) {
        let entry = match entry { Ok(e) => e, Err(_) => { skipped += 1; continue; } };
        if !entry.file_type().is_file() { continue; }
        let path = entry.path();
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        if !ext.eq_ignore_ascii_case("md") { continue; }
        match import_one(&notes_dir, source, path, &mut renamed) {
            Ok(_) => imported += 1,
            Err(_) => skipped += 1,
        }
    }
    Ok(ImportReport { imported, skipped, renamed })
}

fn import_one(
    notes_dir: &Path,
    vault_root: &Path,
    file: &Path,
    renamed: &mut Vec<(String, String)>,
) -> Result<PathBuf> {
    let raw = std::fs::read_to_string(file)?;
    let (existing_fm, body) = split_frontmatter(&raw);

    // Derive a default title: first non-empty H1 in the body, else file stem.
    let stem = file.file_stem().and_then(|s| s.to_str()).unwrap_or("untitled");
    let title = pick_title(&existing_fm, body, stem);
    let slug_base = notes::slug_from_title(&title);
    // Avoid collisions with notes already in the workspace by suffixing.
    let mut slug = slug_base.clone();
    let mut n = 1;
    while notes_dir.join(format!("{slug}.md")).exists() {
        n += 1;
        slug = format!("{slug_base}-{n}");
    }
    if slug != slug_base {
        let rel = file.strip_prefix(vault_root).unwrap_or(file).to_string_lossy().to_string();
        renamed.push((rel, slug.clone()));
    }

    // Extract `#tag` annotations from body. Obsidian also stores tags in
    // frontmatter; merge both sources, dedup, drop empties.
    let mut tags = collect_frontmatter_tags(&existing_fm);
    for t in scan_inline_tags(body) {
        if !tags.contains(&t) { tags.push(t); }
    }

    let now = Utc::now().to_rfc3339();
    let created = pick_yaml_string(&existing_fm, "created").unwrap_or_else(|| now.clone());
    let modified = pick_yaml_string(&existing_fm, "modified").unwrap_or_else(|| now.clone());

    let fm = Frontmatter {
        title,
        created,
        modified,
        links: vec![],
        tags,
        pinned: false,
        encrypted: false,
        kdf: String::new(),
        salt: String::new(),
        nonce: String::new(),
        annotations: vec![],
    };
    notes::write(notes_dir.parent().unwrap(), &slug, body.trim_start_matches('\n'), Some(fm))?;
    Ok(notes_dir.join(format!("{slug}.md")))
}

/// Returns `(frontmatter_yaml, body_after_frontmatter)`.
pub(crate) fn split_frontmatter(raw: &str) -> (String, &str) {
    if !raw.starts_with("---") { return (String::new(), raw); }
    let after_first = &raw[3..];
    if let Some(end) = after_first.find("\n---") {
        let yaml = &after_first[..end];
        // Body starts after the closing `---\n`.
        let rest_start = 3 + end + 4; // 3 for opening "---", 4 for "\n---"
        let body = if rest_start < raw.len() { &raw[rest_start..] } else { "" };
        let body = body.strip_prefix('\n').unwrap_or(body);
        return (yaml.trim_matches('\n').to_string(), body);
    }
    (String::new(), raw)
}

pub(crate) fn pick_title(fm_yaml: &str, body: &str, stem: &str) -> String {
    if let Some(t) = pick_yaml_string(fm_yaml, "title") {
        if !t.trim().is_empty() { return t; }
    }
    for line in body.lines().take(50) {
        let trimmed = line.trim_start();
        if let Some(rest) = trimmed.strip_prefix("# ") {
            let rest = rest.trim();
            if !rest.is_empty() { return rest.to_string(); }
        }
    }
    stem.to_string()
}

/// Extract a single string value from a flat YAML frontmatter (no nested
/// keys). Tolerates `key: value`, `key: "value"`, `key: 'value'`. Used for
/// title/created/modified and similar simple fields.
pub(crate) fn pick_yaml_string(yaml: &str, key: &str) -> Option<String> {
    let needle = format!("{key}:");
    for line in yaml.lines() {
        let trimmed = line.trim_start();
        if let Some(rest) = trimmed.strip_prefix(&needle) {
            let v = rest.trim().trim_matches(|c: char| c == '"' || c == '\'');
            if v.is_empty() { return None; }
            return Some(v.to_string());
        }
    }
    None
}

/// Pull tags from a flat YAML frontmatter. Supports both `tags: [a, b]`
/// inline arrays and the multi-line `tags:\n  - a` form.
pub(crate) fn collect_frontmatter_tags(yaml: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut in_tags_block = false;
    for line in yaml.lines() {
        let raw = line;
        let t = raw.trim_start();
        if let Some(rest) = t.strip_prefix("tags:") {
            in_tags_block = false;
            let rest = rest.trim();
            if rest.starts_with('[') {
                let inner = rest.trim_start_matches('[').trim_end_matches(']');
                for p in inner.split(',') {
                    let v = p.trim().trim_matches(|c: char| c == '"' || c == '\'');
                    if !v.is_empty() { out.push(v.to_string()); }
                }
            } else if rest.is_empty() {
                in_tags_block = true;
            } else {
                // single-value form: tags: foo
                out.push(rest.trim_matches(|c: char| c == '"' || c == '\'').to_string());
            }
            continue;
        }
        if in_tags_block {
            // Continued tag list (indented `- foo`); stop on a non-list line.
            let stripped = t.strip_prefix("- ").or_else(|| t.strip_prefix("-"));
            if let Some(v) = stripped {
                let v = v.trim().trim_matches(|c: char| c == '"' || c == '\'');
                if !v.is_empty() { out.push(v.to_string()); }
            } else if !t.is_empty() {
                in_tags_block = false;
            }
        }
    }
    out
}

/// Scan body for `#tag` annotations (Obsidian style). Excludes things that
/// look like Markdown headings (`# Heading`) or anchor refs (`#L42`).
pub(crate) fn scan_inline_tags(body: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut in_fence = false;
    for line in body.lines() {
        if line.trim_start().starts_with("```") { in_fence = !in_fence; continue; }
        if in_fence { continue; }
        // Skip markdown heading lines outright.
        if line.trim_start().starts_with("# ") { continue; }
        let bytes = line.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            if bytes[i] == b'#' {
                let prev_is_word = i > 0 && (bytes[i-1].is_ascii_alphanumeric() || bytes[i-1] == b'_');
                if !prev_is_word {
                    let start = i + 1;
                    let mut j = start;
                    while j < bytes.len() {
                        let c = bytes[j];
                        if c.is_ascii_alphanumeric() || c == b'_' || c == b'-' || c == b'/' {
                            j += 1;
                        } else { break; }
                    }
                    if j > start {
                        let tag = &line[start..j];
                        // Reject pure-numeric tags (likely line refs).
                        if !tag.chars().all(|c| c.is_ascii_digit()) {
                            if !out.iter().any(|t| t == tag) {
                                out.push(tag.to_string());
                            }
                        }
                        i = j;
                        continue;
                    }
                }
            }
            i += 1;
        }
    }
    out
}
