//! Import notes from other markdown-flavored apps. Bear, Logseq, and
//! Notion each export to a slightly different folder shape; this module
//! walks the appropriate directories, adapts the per-file format, and
//! reuses `obsidian_import`'s helpers for the shared bits (frontmatter
//! split, title picking, tag harvesting).
//!
//! A successful import writes one checkpoint for rollback via the normal
//! command wrapper in `commands.rs`, just like the Obsidian flow.

use std::path::{Path, PathBuf};

use chrono::Utc;
use regex::Regex;
use walkdir::WalkDir;

use crate::error::{Result, YarrowError};
use crate::notes::{self, Frontmatter};
use crate::obsidian_import::{
    collect_frontmatter_tags, pick_title, scan_inline_tags, split_frontmatter, ImportReport,
};
use crate::workspace;

/// ── Bear ──────────────────────────────────────────────────────────────
///
/// Bear's "Export Markdown Files" command drops a folder of flat `.md`
/// files with no frontmatter. Tags live inline as `#tag`. The title is
/// whatever the author wrote as the note's first `# H1` line, or falls
/// back to the file stem.
pub fn import_bear(workspace_root: &Path, source: &Path) -> Result<ImportReport> {
    if !source.is_dir() {
        return Err(YarrowError::Invalid(
            "Pick the folder that contains your Bear export.".into(),
        ));
    }
    let notes_dir = workspace::notes_dir(workspace_root);
    std::fs::create_dir_all(&notes_dir)?;
    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut renamed: Vec<(String, String)> = Vec::new();

    for entry in WalkDir::new(source).into_iter().filter_entry(|e| {
        let name = e.file_name().to_string_lossy();
        !(name.starts_with('.') && e.depth() > 0)
    }) {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        if !ext.eq_ignore_ascii_case("md") && !ext.eq_ignore_ascii_case("markdown") {
            continue;
        }
        match import_bear_one(&notes_dir, source, path, &mut renamed) {
            Ok(_) => imported += 1,
            Err(_) => skipped += 1,
        }
    }
    Ok(ImportReport {
        imported,
        skipped,
        renamed,
    })
}

fn import_bear_one(
    notes_dir: &Path,
    root: &Path,
    file: &Path,
    renamed: &mut Vec<(String, String)>,
) -> Result<PathBuf> {
    let raw = std::fs::read_to_string(file)?;
    // Bear usually has no frontmatter, but users sometimes add one manually —
    // defer to the split helper so either form works.
    let (fm_yaml, body) = split_frontmatter(&raw);
    let stem = file
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled");
    let title = pick_title(&fm_yaml, body, stem);

    let slug = dedup_slug(notes_dir, &title, root, file, renamed);
    let tags = harvest_tags(&fm_yaml, body);

    write_note(notes_dir, &slug, body, title, tags)?;
    Ok(notes_dir.join(format!("{slug}.md")))
}

/// ── Logseq ────────────────────────────────────────────────────────────
///
/// A Logseq graph is a folder with (at minimum) `pages/` and often
/// `journals/`. `logseq/` holds config, `assets/` holds attachments, and
/// `draws/` holds Excalidraw files. We walk only pages and journals, one
/// level deep each, skipping hidden files.
///
/// Journal filenames look like `2026_04_19.md` — we normalize underscores
/// to hyphens so they slug cleanly. Logseq's block-bullet source format
/// is left as-is; Yarrow's editor renders bulleted lists fine.
pub fn import_logseq(workspace_root: &Path, source: &Path) -> Result<ImportReport> {
    if !source.is_dir() {
        return Err(YarrowError::Invalid(
            "Pick the folder that contains your Logseq graph (the one with pages/ and journals/).".into(),
        ));
    }
    let notes_dir = workspace::notes_dir(workspace_root);
    std::fs::create_dir_all(&notes_dir)?;
    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut renamed: Vec<(String, String)> = Vec::new();

    // Only walk the two directories Logseq uses for notes. Everything else
    // (logseq/, assets/, draws/, version-control side-files) is irrelevant
    // to the vault.
    for sub in ["pages", "journals"] {
        let sub_root = source.join(sub);
        if !sub_root.is_dir() {
            continue;
        }
        for entry in WalkDir::new(&sub_root).into_iter().filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !(name.starts_with('.') && e.depth() > 0)
        }) {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => {
                    skipped += 1;
                    continue;
                }
            };
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.path();
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if !ext.eq_ignore_ascii_case("md") {
                continue;
            }
            match import_logseq_one(&notes_dir, source, path, sub == "journals", &mut renamed) {
                Ok(_) => imported += 1,
                Err(_) => skipped += 1,
            }
        }
    }
    if imported + skipped == 0 {
        return Err(YarrowError::Invalid(
            "Couldn't find any pages/ or journals/ .md files under that folder.".into(),
        ));
    }
    Ok(ImportReport {
        imported,
        skipped,
        renamed,
    })
}

fn import_logseq_one(
    notes_dir: &Path,
    root: &Path,
    file: &Path,
    is_journal: bool,
    renamed: &mut Vec<(String, String)>,
) -> Result<PathBuf> {
    let raw = std::fs::read_to_string(file)?;
    let (fm_yaml, body) = split_frontmatter(&raw);
    let stem = file
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled");
    // Logseq journals name files `YYYY_MM_DD`; normalize to a clean title.
    let stem_norm: String = if is_journal {
        stem.replace('_', "-")
    } else {
        stem.to_string()
    };
    let title = pick_title(&fm_yaml, body, &stem_norm);

    let slug = dedup_slug(notes_dir, &title, root, file, renamed);
    let tags = harvest_tags(&fm_yaml, body);

    write_note(notes_dir, &slug, body, title, tags)?;
    Ok(notes_dir.join(format!("{slug}.md")))
}

/// ── Notion ───────────────────────────────────────────────────────────
///
/// Notion's "Export as Markdown & CSV" option writes one `.md` per page
/// and names each file `<Title> <32-hex-id>.md`. Nested pages become
/// subfolders with the same naming. We walk everything, strip the ID
/// suffix for the title, and ignore CSVs (database dumps) with a skip.
pub fn import_notion(workspace_root: &Path, source: &Path) -> Result<ImportReport> {
    if !source.is_dir() {
        return Err(YarrowError::Invalid(
            "Pick the extracted Notion export folder (the one Notion zipped up).".into(),
        ));
    }
    let notes_dir = workspace::notes_dir(workspace_root);
    std::fs::create_dir_all(&notes_dir)?;
    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut renamed: Vec<(String, String)> = Vec::new();

    // Notion export has no hidden-config folder convention, but respect
    // common dotfile hygiene anyway (macOS's `.DS_Store`, etc.).
    for entry in WalkDir::new(source).into_iter().filter_entry(|e| {
        let name = e.file_name().to_string_lossy();
        !(name.starts_with('.') && e.depth() > 0)
    }) {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        if !ext.eq_ignore_ascii_case("md") {
            continue;
        }
        match import_notion_one(&notes_dir, source, path, &mut renamed) {
            Ok(_) => imported += 1,
            Err(_) => skipped += 1,
        }
    }
    Ok(ImportReport {
        imported,
        skipped,
        renamed,
    })
}

fn import_notion_one(
    notes_dir: &Path,
    root: &Path,
    file: &Path,
    renamed: &mut Vec<(String, String)>,
) -> Result<PathBuf> {
    let raw = std::fs::read_to_string(file)?;
    let (fm_yaml, body) = split_frontmatter(&raw);
    let stem = file
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled");
    let cleaned_stem = strip_notion_id(stem);

    // Notion often puts an `# Title` H1 at the top of every export; prefer
    // that for the title since the filename ID-stripped stem sometimes
    // loses emoji / punctuation.
    let title = pick_title(&fm_yaml, body, &cleaned_stem);

    let slug = dedup_slug(notes_dir, &title, root, file, renamed);
    let tags = harvest_tags(&fm_yaml, body);

    write_note(notes_dir, &slug, body, title, tags)?;
    Ok(notes_dir.join(format!("{slug}.md")))
}

/// Strip a Notion export's trailing ` <32 hex chars>` from a filename
/// stem. Leaves unrelated filenames untouched so the helper is safe for
/// both page files and the occasional artisan-named file people slip in.
fn strip_notion_id(stem: &str) -> String {
    // Single compile, single call-site — no need to lazy_static.
    let re = Regex::new(r" [0-9a-fA-F]{32}$").expect("static regex");
    re.replace(stem, "").into_owned()
}

// ── shared helpers ─────────────────────────────────────────────────────

/// Produce a collision-free slug for the destination `notes/` directory,
/// recording the original relative path in `renamed` whenever we had to
/// suffix. Common across all three importers so collision behavior is
/// identical regardless of source format.
fn dedup_slug(
    notes_dir: &Path,
    title: &str,
    source_root: &Path,
    file: &Path,
    renamed: &mut Vec<(String, String)>,
) -> String {
    let slug_base = notes::slug_from_title(title);
    let mut slug = slug_base.clone();
    let mut n = 1;
    while notes_dir.join(format!("{slug}.md")).exists() {
        n += 1;
        slug = format!("{slug_base}-{n}");
    }
    if slug != slug_base {
        let rel = file
            .strip_prefix(source_root)
            .unwrap_or(file)
            .to_string_lossy()
            .to_string();
        renamed.push((rel, slug.clone()));
    }
    slug
}

fn harvest_tags(fm_yaml: &str, body: &str) -> Vec<String> {
    let mut tags = collect_frontmatter_tags(fm_yaml);
    for t in scan_inline_tags(body) {
        if !tags.contains(&t) {
            tags.push(t);
        }
    }
    tags
}

fn write_note(
    notes_dir: &Path,
    slug: &str,
    body: &str,
    title: String,
    tags: Vec<String>,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let fm = Frontmatter {
        title,
        created: now.clone(),
        modified: now,
        links: vec![],
        tags,
        pinned: false,
        encrypted: false,
        kdf: String::new(),
        salt: String::new(),
        nonce: String::new(),
        annotations: vec![],
        private: false,
        folder: None,
    };
    notes::write(
        notes_dir.parent().unwrap(),
        slug,
        body.trim_start_matches('\n'),
        Some(fm),
    )?;
    Ok(())
}
