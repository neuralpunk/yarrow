use std::path::{Path, PathBuf};

use chrono::Utc;
use gray_matter::{engine::YAML, Matter};
use serde::{Deserialize, Serialize};

use crate::error::{Result, YarrowError};
use crate::workspace;

pub const LINK_TYPES: &[&str] = &["supports", "challenges", "came-from", "open-question"];

/// Daily-note slug prefix — files live at `notes/daily/YYYY-MM-DD.md`.
/// Kept as a first-class convention so regular `list()` (which doesn't recurse)
/// naturally ignores them, keeping the main sidebar list focused on topic notes.
pub const DAILY_PREFIX: &str = "daily/";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Link {
    pub target: String,
    #[serde(rename = "type")]
    pub link_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Frontmatter {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub created: String,
    #[serde(default)]
    pub modified: String,
    #[serde(default)]
    pub links: Vec<Link>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteSummary {
    pub slug: String,
    pub title: String,
    pub modified: String,
    pub excerpt: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub slug: String,
    pub frontmatter: Frontmatter,
    pub body: String,
}

pub fn slug_from_title(title: &str) -> String {
    let s = slug::slugify(title);
    if s.is_empty() { "untitled".into() } else { s }
}

pub fn note_path(root: &Path, slug: &str) -> PathBuf {
    workspace::notes_dir(root).join(format!("{}.md", slug))
}

pub fn relative_note_path(slug: &str) -> String {
    format!("notes/{}.md", slug)
}

pub fn list(root: &Path) -> Result<Vec<NoteSummary>> {
    let dir = workspace::notes_dir(root);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let slug = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        if slug.is_empty() {
            continue;
        }
        let raw = std::fs::read_to_string(&path)?;
        let (fm, body) = parse(&raw);
        let title = if fm.title.is_empty() { slug.clone() } else { fm.title.clone() };
        let modified = if fm.modified.is_empty() { fm.created.clone() } else { fm.modified.clone() };
        let excerpt = excerpt_from(&body);
        out.push(NoteSummary { slug, title, modified, excerpt });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

pub fn read(root: &Path, slug: &str) -> Result<Note> {
    let path = note_path(root, slug);
    if !path.exists() {
        return Err(YarrowError::NoteNotFound(slug.to_string()));
    }
    let raw = std::fs::read_to_string(&path)?;
    let (fm, body) = parse(&raw);
    Ok(Note {
        slug: slug.to_string(),
        frontmatter: fm,
        body,
    })
}

pub fn write(root: &Path, slug: &str, body: &str, frontmatter: Option<Frontmatter>) -> Result<Note> {
    let path = note_path(root, slug);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let now = Utc::now().to_rfc3339();
    let mut fm = frontmatter.unwrap_or_else(|| {
        if path.exists() {
            if let Ok(raw) = std::fs::read_to_string(&path) {
                let (fm, _) = parse(&raw);
                return fm;
            }
        }
        Frontmatter {
            title: slug.replace('-', " "),
            created: now.clone(),
            modified: now.clone(),
            links: vec![],
            tags: vec![],
        }
    });
    if fm.created.is_empty() {
        fm.created = now.clone();
    }
    fm.modified = now;
    if fm.title.is_empty() {
        fm.title = slug.replace('-', " ");
    }

    let serialized = serialize(&fm, body);
    std::fs::write(&path, &serialized)?;
    Ok(Note {
        slug: slug.to_string(),
        frontmatter: fm,
        body: body.to_string(),
    })
}

pub fn create(root: &Path, title: &str) -> Result<Note> {
    let mut slug = slug_from_title(title);
    let mut n = 1;
    while note_path(root, &slug).exists() {
        n += 1;
        slug = format!("{}-{}", slug_from_title(title), n);
    }
    let now = Utc::now().to_rfc3339();
    let fm = Frontmatter {
        title: title.to_string(),
        created: now.clone(),
        modified: now,
        links: vec![],
        tags: vec![],
    };
    write(root, &slug, "", Some(fm))
}

pub fn rename(root: &Path, old_slug: &str, new_title: &str) -> Result<Note> {
    let mut new_slug = slug_from_title(new_title);
    if new_slug == old_slug {
        // title-only change
        let mut note = read(root, old_slug)?;
        note.frontmatter.title = new_title.to_string();
        return write(root, old_slug, &note.body, Some(note.frontmatter));
    }
    let mut n = 1;
    while note_path(root, &new_slug).exists() {
        n += 1;
        new_slug = format!("{}-{}", slug_from_title(new_title), n);
    }
    let note = read(root, old_slug)?;
    let mut fm = note.frontmatter;
    fm.title = new_title.to_string();
    let new = write(root, &new_slug, &note.body, Some(fm))?;
    std::fs::remove_file(note_path(root, old_slug))?;
    // Update backlinks in other notes that pointed to old_slug.
    update_backlinks_on_rename(root, old_slug, &new_slug)?;
    Ok(new)
}

pub fn delete(root: &Path, slug: &str) -> Result<()> {
    let path = note_path(root, slug);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    // Remove references to this slug from all other notes.
    for summary in list(root)? {
        let mut note = read(root, &summary.slug)?;
        let before = note.frontmatter.links.len();
        note.frontmatter.links.retain(|l| l.target != slug);
        if note.frontmatter.links.len() != before {
            write(root, &summary.slug, &note.body, Some(note.frontmatter))?;
        }
    }
    Ok(())
}

fn update_backlinks_on_rename(root: &Path, old_slug: &str, new_slug: &str) -> Result<()> {
    for summary in list(root)? {
        let mut note = read(root, &summary.slug)?;
        let mut changed = false;
        for l in note.frontmatter.links.iter_mut() {
            if l.target == old_slug {
                l.target = new_slug.to_string();
                changed = true;
            }
        }
        if changed {
            write(root, &summary.slug, &note.body, Some(note.frontmatter))?;
        }
    }
    Ok(())
}

pub fn add_link(root: &Path, from: &str, to: &str, link_type: &str) -> Result<()> {
    if !LINK_TYPES.contains(&link_type) {
        return Err(YarrowError::Invalid(format!(
            "unknown link type: {}",
            link_type
        )));
    }
    if !note_path(root, to).exists() {
        return Err(YarrowError::NoteNotFound(to.to_string()));
    }
    let mut from_note = read(root, from)?;
    // Dedupe: one edge per (target, type)
    let exists = from_note
        .frontmatter
        .links
        .iter()
        .any(|l| l.target == to && l.link_type == link_type);
    if !exists {
        from_note.frontmatter.links.push(Link {
            target: to.to_string(),
            link_type: link_type.to_string(),
        });
        write(root, from, &from_note.body, Some(from_note.frontmatter))?;
    }

    // Reverse backlink with reciprocal type.
    let back_type = reciprocal_type(link_type);
    let mut to_note = read(root, to)?;
    let back_exists = to_note
        .frontmatter
        .links
        .iter()
        .any(|l| l.target == from && l.link_type == back_type);
    if !back_exists {
        to_note.frontmatter.links.push(Link {
            target: from.to_string(),
            link_type: back_type.into(),
        });
        write(root, to, &to_note.body, Some(to_note.frontmatter))?;
    }
    Ok(())
}

pub fn remove_link(root: &Path, from: &str, to: &str) -> Result<()> {
    let mut from_note = read(root, from)?;
    let before = from_note.frontmatter.links.len();
    from_note.frontmatter.links.retain(|l| l.target != to);
    if from_note.frontmatter.links.len() != before {
        write(root, from, &from_note.body, Some(from_note.frontmatter))?;
    }
    if let Ok(mut to_note) = read(root, to) {
        let before = to_note.frontmatter.links.len();
        to_note.frontmatter.links.retain(|l| l.target != from);
        if to_note.frontmatter.links.len() != before {
            write(root, to, &to_note.body, Some(to_note.frontmatter))?;
        }
    }
    Ok(())
}

fn reciprocal_type(t: &str) -> &'static str {
    match t {
        "supports" => "supports",
        "challenges" => "challenges",
        "came-from" => "came-from",
        "open-question" => "open-question",
        _ => "came-from",
    }
}

fn excerpt_from(body: &str) -> String {
    // First ~140 chars of non-heading, non-blank content.
    let mut out = String::new();
    for line in body.lines() {
        let t = line.trim();
        if t.is_empty() || t.starts_with('#') || t.starts_with("---") {
            continue;
        }
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(t);
        if out.chars().count() >= 140 {
            break;
        }
    }
    let mut chars: Vec<char> = out.chars().take(140).collect();
    if out.chars().count() > 140 {
        chars.push('…');
    }
    chars.into_iter().collect()
}

fn parse(raw: &str) -> (Frontmatter, String) {
    let fm = parse_frontmatter(raw);
    let body = strip_frontmatter(raw);
    (fm, body)
}

fn parse_frontmatter(raw: &str) -> Frontmatter {
    let matter = Matter::<YAML>::new();
    matter
        .parse(raw)
        .data
        .and_then(|d| d.deserialize::<Frontmatter>().ok())
        .unwrap_or_default()
}

fn strip_frontmatter(raw: &str) -> String {
    let matter = Matter::<YAML>::new();
    matter.parse(raw).content
}

fn serialize(fm: &Frontmatter, body: &str) -> String {
    let mut out = String::from("---\n");
    out.push_str(&format!("title: {}\n", yaml_escape(&fm.title)));
    out.push_str(&format!("created: {}\n", fm.created));
    out.push_str(&format!("modified: {}\n", fm.modified));
    if fm.links.is_empty() {
        out.push_str("links: []\n");
    } else {
        out.push_str("links:\n");
        for l in &fm.links {
            out.push_str(&format!(
                "  - target: {}\n    type: {}\n",
                yaml_escape(&l.target),
                yaml_escape(&l.link_type)
            ));
        }
    }
    if fm.tags.is_empty() {
        out.push_str("tags: []\n");
    } else {
        out.push_str("tags:\n");
        for t in &fm.tags {
            out.push_str(&format!("  - {}\n", yaml_escape(t)));
        }
    }
    out.push_str("---\n");
    out.push_str(body);
    if !body.ends_with('\n') {
        out.push('\n');
    }
    out
}

fn yaml_escape(s: &str) -> String {
    if s.chars().any(|c| c == ':' || c == '#' || c == '"' || c == '\'' || c == '\n') {
        format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
    } else if s.is_empty() {
        "\"\"".to_string()
    } else {
        s.to_string()
    }
}

pub fn seed_note_markdown() -> String {
    let now = Utc::now().to_rfc3339();
    let fm = Frontmatter {
        title: "Getting started".into(),
        created: now.clone(),
        modified: now,
        links: vec![],
        tags: vec![],
    };
    let body = "\
Welcome.

Yarrow is for thinking out loud — branching, doubling back, changing your
mind. You don't manage any of that. Just write.

## Five things to try

Start typing anywhere in this note. Your changes are saved automatically
and every version is kept — no save button, no panic if you close the window.

Press **↗ New direction** (top-left toolbar) when you want to try a different
angle on this note. The current version stays safe under `main`. Your new
direction becomes its own path you can switch back to whenever.

Link notes together: type `[[` inside any paragraph and pick a note, or
click **⊕ Connect** to add a typed connection (supports, challenges, came
from, open question).

Leave a `??` followed by a question anywhere, like this:
?? What's the hardest thing to notice about your own thinking?
Those show up in a panel on the right.

Press ⌘K to jump to anything — another note, a path, a command. It's the
fastest way to move around.

## What you might notice

If you start a paragraph with a word like \"But\" or \"However\", Yarrow
will gently offer to branch for you. No pressure — you can always ignore.

The graph on the right gets denser as you connect more notes together.
Nothing is deleted, just not surfaced. Paths you abandon sit quietly in
*Paths not taken* — easy to revive.
";
    serialize(&fm, body)
}

// ─────────────────────────── daily notes ───────────────────────────
// Journal entries keyed by calendar date. One file per day, always on the
// `main` path — daily notes are intentionally path-agnostic so the user's
// journal stays a single stream regardless of what exploration they're in.

/// Slug for a daily note on a given date — e.g. "daily/2026-04-17".
pub fn daily_slug(date_iso: &str) -> String {
    format!("{}{}", DAILY_PREFIX, date_iso)
}

/// Human-readable title for a daily note — e.g. "April 17, 2026".
pub fn daily_title(date_iso: &str) -> String {
    match chrono::NaiveDate::parse_from_str(date_iso, "%Y-%m-%d") {
        Ok(d) => d.format("%B %-d, %Y").to_string(),
        Err(_) => date_iso.to_string(),
    }
}

/// Read-or-create a daily note for the given ISO date (YYYY-MM-DD).
/// Does NOT switch git paths — that's the caller's responsibility.
pub fn ensure_daily(root: &Path, date_iso: &str) -> Result<Note> {
    // Minimal validation: reject anything that's not YYYY-MM-DD to keep the
    // filesystem tidy (no accidental path traversal via weird date strings).
    if chrono::NaiveDate::parse_from_str(date_iso, "%Y-%m-%d").is_err() {
        return Err(YarrowError::Invalid(format!(
            "invalid daily date: {} (expected YYYY-MM-DD)",
            date_iso
        )));
    }
    let slug = daily_slug(date_iso);
    let path = note_path(root, &slug);
    if path.exists() {
        return read(root, &slug);
    }
    let now = Utc::now().to_rfc3339();
    let fm = Frontmatter {
        title: daily_title(date_iso),
        created: now.clone(),
        modified: now,
        links: vec![],
        tags: vec!["daily".into()],
    };
    write(root, &slug, "", Some(fm))
}

/// List all daily notes (most-recent first), newest `limit` only if provided.
pub fn list_daily(root: &Path, limit: Option<usize>) -> Result<Vec<NoteSummary>> {
    let dir = workspace::notes_dir(root).join("daily");
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let p = entry.path();
        if p.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let stem = match p.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        // Only YYYY-MM-DD files — skip anything else the user may have dropped in.
        if chrono::NaiveDate::parse_from_str(&stem, "%Y-%m-%d").is_err() {
            continue;
        }
        let raw = std::fs::read_to_string(&p)?;
        let (fm, body) = parse(&raw);
        let slug = daily_slug(&stem);
        let title = if fm.title.is_empty() { daily_title(&stem) } else { fm.title.clone() };
        let modified = if fm.modified.is_empty() { stem.clone() } else { fm.modified.clone() };
        let excerpt = excerpt_from(&body);
        out.push(NoteSummary { slug, title, modified, excerpt });
    }
    // Sort by the date in the slug (descending) — more stable than modified,
    // which drifts if the user re-edits an older day's entry.
    out.sort_by(|a, b| b.slug.cmp(&a.slug));
    if let Some(n) = limit {
        out.truncate(n);
    }
    Ok(out)
}

pub fn read_scratchpad(root: &Path) -> Result<String> {
    let path = workspace::scratchpad_path(root);
    if !path.exists() {
        return Ok(String::new());
    }
    Ok(std::fs::read_to_string(path)?)
}

pub fn write_scratchpad(root: &Path, content: &str) -> Result<()> {
    let path = workspace::scratchpad_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, content)?;
    Ok(())
}

pub fn clear_scratchpad(root: &Path) -> Result<()> {
    let path = workspace::scratchpad_path(root);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}
