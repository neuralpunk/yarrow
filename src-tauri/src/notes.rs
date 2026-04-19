use std::path::{Path, PathBuf};

use chrono::{Datelike, Utc};
use gray_matter::{engine::YAML, Matter};
use serde::{Deserialize, Serialize};

use crate::crypto::{self, BodyEnvelope, MasterKey};
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
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub pinned: bool,
    // ── encryption metadata (spec §Storage shape) ──
    // `encrypted = true` means the body below is a single base64 ciphertext
    // blob. `kdf` and `salt` echo the workspace-level KDF parameters so each
    // note file is self-describing; the cipher nonce is per-note.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub encrypted: bool,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub kdf: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub salt: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteSummary {
    pub slug: String,
    pub title: String,
    pub modified: String,
    pub excerpt: String,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub encrypted: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub slug: String,
    pub frontmatter: Frontmatter,
    /// Decrypted plaintext body when the workspace is unlocked. Empty when
    /// the note is encrypted but the caller didn't have a master key.
    pub body: String,
    /// Mirrors `frontmatter.encrypted`; lifted to a top-level field so the
    /// frontend doesn't have to dig for it.
    #[serde(default)]
    pub encrypted: bool,
    /// `true` when `body` couldn't be decrypted because the workspace is
    /// locked. Frontend uses this to show the unlock prompt.
    #[serde(default)]
    pub locked: bool,
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
        // Body excerpt is meaningless on ciphertext; substitute a fixed hint
        // so the sidebar renders cleanly without leaking ciphertext chars.
        let excerpt = if fm.encrypted {
            "🔒 encrypted — unlock to preview".to_string()
        } else {
            excerpt_from(&body)
        };
        out.push(NoteSummary {
            slug,
            title,
            modified,
            excerpt,
            pinned: fm.pinned,
            encrypted: fm.encrypted,
            tags: fm.tags,
        });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

pub fn read(root: &Path, slug: &str) -> Result<Note> {
    read_with_key(root, slug, None)
}

/// Read a note, decrypting the body if it's encrypted and a key is provided.
/// When encrypted and no key is present, returns body="" and `locked=true`
/// so the caller can surface an unlock prompt.
pub fn read_with_key(root: &Path, slug: &str, key: Option<&MasterKey>) -> Result<Note> {
    let path = note_path(root, slug);
    if !path.exists() {
        return Err(YarrowError::NoteNotFound(slug.to_string()));
    }
    let raw = std::fs::read_to_string(&path)?;
    let (fm, body_text) = parse(&raw);
    if fm.encrypted {
        if let Some(k) = key {
            let nonce = crypto::decode_note_nonce(&fm.nonce)?;
            let ct = crypto::decode_bytes(body_text.trim())?;
            let env = BodyEnvelope { nonce, ciphertext: ct };
            let plaintext = env.open(k)?;
            Ok(Note {
                slug: slug.to_string(),
                frontmatter: fm,
                body: plaintext,
                encrypted: true,
                locked: false,
            })
        } else {
            Ok(Note {
                slug: slug.to_string(),
                frontmatter: fm,
                body: String::new(),
                encrypted: true,
                locked: true,
            })
        }
    } else {
        Ok(Note {
            slug: slug.to_string(),
            frontmatter: fm,
            body: body_text,
            encrypted: false,
            locked: false,
        })
    }
}

pub fn write(root: &Path, slug: &str, body: &str, frontmatter: Option<Frontmatter>) -> Result<Note> {
    write_with_key(root, slug, body, frontmatter, None)
}

/// Write a note. If the (existing or provided) frontmatter says `encrypted`,
/// the body is sealed with `key`. When locked (no key) the body argument is
/// ignored and we re-serialise the existing on-disk ciphertext unchanged —
/// frontmatter-only mutations (add_link, rename, pin…) stay possible while
/// encrypted notes are locked.
pub fn write_with_key(
    root: &Path,
    slug: &str,
    body: &str,
    frontmatter: Option<Frontmatter>,
    key: Option<&MasterKey>,
) -> Result<Note> {
    write_with_key_status(root, slug, body, frontmatter, key).map(|(n, _)| n)
}

/// Same as `write_with_key`, but also returns a boolean: `true` if the
/// file on disk was actually updated, `false` if this turned out to be a
/// no-op write (body unchanged and caller didn't force a frontmatter
/// override). Callers that rebuild the graph / write a git checkpoint
/// after a save use this to skip that work when nothing actually changed.
pub fn write_with_key_status(
    root: &Path,
    slug: &str,
    body: &str,
    frontmatter: Option<Frontmatter>,
    key: Option<&MasterKey>,
) -> Result<(Note, bool)> {
    let path = note_path(root, slug);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let now = Utc::now().to_rfc3339();

    // Load existing frontmatter + on-disk body text up front so we can
    // preserve ciphertext through locked-frontmatter mutations.
    let existing: Option<(Frontmatter, String)> = if path.exists() {
        std::fs::read_to_string(&path).ok().map(|raw| {
            let (fm, b) = parse(&raw);
            (fm, b)
        })
    } else { None };

    // No-op write detection. A big source of checkpoint bloat is "save
    // same body twice" (CodeMirror firing on redundant doc events, or a
    // user landing at an idle state after a paired edit/undo). If the
    // caller hasn't explicitly overridden frontmatter and the new body
    // matches what's already on disk, skip the write entirely — no file
    // mutation, no `modified` bump, nothing for git::checkpoint to see.
    if frontmatter.is_none() {
        if let Some((ref existing_fm, ref existing_body_on_disk)) = existing {
            let existing_plaintext: Option<String> = if existing_fm.encrypted {
                key.and_then(|k| {
                    let nonce = crypto::decode_note_nonce(&existing_fm.nonce).ok()?;
                    let ct = crypto::decode_bytes(existing_body_on_disk.trim()).ok()?;
                    let env = crypto::BodyEnvelope { nonce, ciphertext: ct };
                    env.open(k).ok()
                })
            } else {
                Some(existing_body_on_disk.clone())
            };
            if let Some(prev) = existing_plaintext {
                // Ignore trailing-newline drift between in-memory bodies
                // and on-disk serialization — they represent identical
                // content to everything downstream (editor, graph, search).
                if prev.trim_end_matches('\n') == body.trim_end_matches('\n') {
                    return Ok((
                        Note {
                            slug: slug.to_string(),
                            frontmatter: existing_fm.clone(),
                            body: body.to_string(),
                            encrypted: existing_fm.encrypted,
                            locked: false,
                        },
                        false,
                    ));
                }
            }
        }
    }

    let mut fm = frontmatter.unwrap_or_else(|| {
        existing
            .as_ref()
            .map(|(fm, _)| fm.clone())
            .unwrap_or_else(|| Frontmatter {
                title: slug.replace('-', " "),
                created: now.clone(),
                modified: now.clone(),
                links: vec![],
                tags: vec![],
                pinned: false,
                encrypted: false,
                kdf: String::new(),
                salt: String::new(),
                nonce: String::new(),
            })
    });
    if fm.created.is_empty() { fm.created = now.clone(); }
    fm.modified = now;
    if fm.title.is_empty() { fm.title = slug.replace('-', " "); }

    let body_on_disk: String = if fm.encrypted {
        if let Some(k) = key {
            let env = BodyEnvelope::seal(k, body)?;
            fm.kdf = if fm.kdf.is_empty() { "argon2id".into() } else { fm.kdf.clone() };
            fm.nonce = env.nonce_b64();
            if fm.salt.is_empty() {
                // Self-describing per spec §Storage shape. Fill in the
                // workspace salt so a file is legible on its own.
                if let Ok(Some(env_ws)) = workspace::read_security(root) {
                    fm.salt = env_ws.workspace_salt_b64().to_string();
                }
            }
            env.ciphertext_b64()
        } else {
            // Locked: keep the existing ciphertext + nonce untouched. If
            // there's no prior on-disk body (new encrypted note created
            // while locked), we can't write meaningful ciphertext — error out.
            match existing.as_ref() {
                Some((prev_fm, prev_body)) if prev_fm.encrypted => {
                    // Preserve nonce and ciphertext; don't drift.
                    fm.nonce = prev_fm.nonce.clone();
                    if fm.salt.is_empty() { fm.salt = prev_fm.salt.clone(); }
                    if fm.kdf.is_empty() { fm.kdf = prev_fm.kdf.clone(); }
                    prev_body.trim().to_string()
                }
                _ => {
                    return Err(YarrowError::LockedOut);
                }
            }
        }
    } else {
        body.to_string()
    };

    let serialized = serialize(&fm, &body_on_disk);
    atomic_write(&path, serialized.as_bytes())?;
    Ok((
        Note {
            slug: slug.to_string(),
            frontmatter: fm.clone(),
            body: if fm.encrypted && key.is_none() { String::new() } else { body.to_string() },
            encrypted: fm.encrypted,
            locked: fm.encrypted && key.is_none(),
        },
        true,
    ))
}

/// Transform the raw bytes of a note file into a sealed-at-rest equivalent.
///
/// Used when we rewrite past git history after encrypting a note: every
/// historical commit that still held plaintext gets its blob replaced with
/// this function's output, keyed with the current master key and given a
/// fresh random nonce per call (so identical plaintext doesn't produce
/// identical ciphertext across commits).
///
/// Returns `Ok(None)` when the file is already encrypted — nothing to do.
pub fn seal_file_bytes(
    root: &Path,
    bytes: &[u8],
    key: &MasterKey,
) -> Result<Option<Vec<u8>>> {
    let raw = match std::str::from_utf8(bytes) {
        Ok(s) => s,
        // Non-UTF8 notes shouldn't exist in Yarrow, but if one does we leave
        // it alone rather than corrupting it.
        Err(_) => return Ok(None),
    };
    let (mut fm, body) = parse(raw);
    if fm.encrypted {
        return Ok(None);
    }
    fm.encrypted = true;
    fm.kdf = "argon2id".into();
    let env = BodyEnvelope::seal(key, &body)?;
    fm.nonce = env.nonce_b64();
    if fm.salt.is_empty() {
        if let Ok(Some(env_ws)) = workspace::read_security(root) {
            fm.salt = env_ws.workspace_salt_b64().to_string();
        }
    }
    let sealed_body = env.ciphertext_b64();
    let out = serialize(&fm, &sealed_body);
    Ok(Some(out.into_bytes()))
}

/// Promote a plaintext note to encrypted. Requires the workspace key.
pub fn encrypt_note(root: &Path, slug: &str, key: &MasterKey) -> Result<Note> {
    let existing = read_with_key(root, slug, None)?;
    if existing.frontmatter.encrypted { return Ok(existing); }
    // We need the actual plaintext body — `read_with_key` with None gave us
    // the on-disk bytes (which are plaintext for an unencrypted note).
    let mut fm = existing.frontmatter;
    fm.encrypted = true;
    fm.kdf = "argon2id".into();
    fm.nonce.clear(); // fresh nonce on seal
    fm.salt.clear(); // re-filled from workspace envelope
    write_with_key(root, slug, &existing.body, Some(fm), Some(key))
}

/// Demote an encrypted note back to plaintext. Requires the workspace key.
pub fn decrypt_note(root: &Path, slug: &str, key: &MasterKey) -> Result<Note> {
    let existing = read_with_key(root, slug, Some(key))?;
    if !existing.frontmatter.encrypted { return Ok(existing); }
    let mut fm = existing.frontmatter;
    fm.encrypted = false;
    fm.kdf.clear();
    fm.salt.clear();
    fm.nonce.clear();
    write_with_key(root, slug, &existing.body, Some(fm), None)
}

/// Write to a sibling temp file and rename over the target. A crash mid-write
/// leaves the original intact rather than truncating it. `rename` on the same
/// filesystem is atomic on POSIX and best-effort on Windows.
fn atomic_write(path: &Path, contents: &[u8]) -> Result<()> {
    use std::io::Write;
    let parent = path
        .parent()
        .ok_or_else(|| YarrowError::Other(format!("no parent for {}", path.display())))?;
    std::fs::create_dir_all(parent)?;
    // Unique temp name so concurrent writes to different slugs don't collide.
    let pid = std::process::id();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let stem = path.file_name().and_then(|s| s.to_str()).unwrap_or("note");
    let tmp = parent.join(format!(".{}.{}.{}.tmp", stem, pid, nanos));
    {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(contents)?;
        f.sync_all().ok();
    }
    if let Err(e) = std::fs::rename(&tmp, path) {
        // Clean up the temp file on failure so we don't leak stale `.tmp`s.
        let _ = std::fs::remove_file(&tmp);
        return Err(e.into());
    }
    Ok(())
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
        pinned: false,
        encrypted: false,
        kdf: String::new(),
        salt: String::new(),
        nonce: String::new(),
    };
    write(root, &slug, "", Some(fm))
}

pub fn rename(root: &Path, old_slug: &str, new_title: &str) -> Result<Note> {
    let mut new_slug = slug_from_title(new_title);
    if new_slug == old_slug {
        // title-only change
        let note = read(root, old_slug)?;
        let mut fm = note.frontmatter;
        fm.title = new_title.to_string();
        // Plain `write` here; if encrypted + locked, ciphertext is preserved
        // via write_with_key's locked-frontmatter path.
        return write(root, old_slug, &note.body, Some(fm));
    }
    let mut n = 1;
    while note_path(root, &new_slug).exists() {
        n += 1;
        new_slug = format!("{}-{}", slug_from_title(new_title), n);
    }
    // Physically move first so frontmatter-only rewrite finds the ciphertext
    // at the new path — matters for encrypted notes where we can't re-seal
    // without the key.
    std::fs::rename(note_path(root, old_slug), note_path(root, &new_slug))?;
    let moved = read(root, &new_slug)?;
    let mut fm = moved.frontmatter;
    fm.title = new_title.to_string();
    let updated = write(root, &new_slug, &moved.body, Some(fm))?;
    update_backlinks_on_rename(root, old_slug, &new_slug)?;
    Ok(updated)
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
    if fm.pinned {
        out.push_str("pinned: true\n");
    }
    if fm.encrypted {
        out.push_str("encrypted: true\n");
        if !fm.kdf.is_empty() {
            out.push_str(&format!("kdf: {}\n", yaml_escape(&fm.kdf)));
        }
        if !fm.salt.is_empty() {
            out.push_str(&format!("salt: {}\n", yaml_escape(&fm.salt)));
        }
        if !fm.nonce.is_empty() {
            out.push_str(&format!("nonce: {}\n", yaml_escape(&fm.nonce)));
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
        pinned: false,
        encrypted: false,
        kdf: String::new(),
        salt: String::new(),
        nonce: String::new(),
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
        pinned: false,
        encrypted: false,
        kdf: String::new(),
        salt: String::new(),
        nonce: String::new(),
    };
    let body = render_daily_template(root, date_iso);
    write(root, &slug, &body, Some(fm))
}

fn render_daily_template(root: &Path, date_iso: &str) -> String {
    let tpl_path = workspace::daily_template_path(root);
    let tpl = match std::fs::read_to_string(&tpl_path) {
        Ok(s) => s,
        Err(_) => return String::new(),
    };
    let date = chrono::NaiveDate::parse_from_str(date_iso, "%Y-%m-%d").ok();
    let (weekday, human, week) = match date {
        Some(d) => (
            d.format("%A").to_string(),
            d.format("%B %-d, %Y").to_string(),
            d.iso_week().week().to_string(),
        ),
        None => (String::new(), date_iso.to_string(), String::new()),
    };
    let yesterday = date
        .and_then(|d| d.pred_opt())
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_default();
    // Drop the optional `<!-- label: ... -->` first line; it exists only to
    // give the template a friendly name in the picker.
    let body: String = {
        let mut lines = tpl.lines();
        let first = lines.clone().next().map(str::trim);
        if first.map(|s| s.starts_with("<!-- label:")).unwrap_or(false) {
            lines.next();
            lines.collect::<Vec<_>>().join("\n")
        } else {
            tpl
        }
    };
    body.replace("{{date}}", date_iso)
        .replace("{{weekday}}", &weekday)
        .replace("{{date_human}}", &human)
        .replace("{{yesterday}}", &yesterday)
        .replace("{{week_number}}", &week)
        .replace("{{cursor}}", "")
        .replace("{{title}}", &daily_title(date_iso))
}

/// Return ISO dates (YYYY-MM-DD) of every daily entry in the workspace.
pub fn list_daily_dates(root: &Path) -> Result<Vec<String>> {
    let dir = workspace::notes_dir(root).join("daily");
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if let Some(stem) = file_name.strip_suffix(".md") {
            if chrono::NaiveDate::parse_from_str(stem, "%Y-%m-%d").is_ok() {
                out.push(stem.to_string());
            }
        }
    }
    out.sort();
    out.reverse();
    Ok(out)
}

pub fn read_daily_template(root: &Path) -> Result<String> {
    let path = workspace::daily_template_path(root);
    if !path.exists() {
        return Ok(String::new());
    }
    Ok(std::fs::read_to_string(path)?)
}

pub fn write_daily_template(root: &Path, content: &str) -> Result<()> {
    let path = workspace::daily_template_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if content.trim().is_empty() && path.exists() {
        std::fs::remove_file(&path)?;
        return Ok(());
    }
    std::fs::write(path, content)?;
    Ok(())
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
        out.push(NoteSummary { slug, title, modified, excerpt, pinned: false, tags: fm.tags, encrypted: fm.encrypted });
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

pub fn append_scratchpad(root: &Path, entry: &str) -> Result<()> {
    let existing = read_scratchpad(root).unwrap_or_default();
    let stamp = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();
    let sep = if existing.is_empty() || existing.ends_with("\n\n") {
        ""
    } else if existing.ends_with('\n') {
        "\n"
    } else {
        "\n\n"
    };
    let block = format!("{}— {} —\n{}\n", sep, stamp, entry.trim());
    let next = format!("{}{}", existing, block);
    write_scratchpad(root, &next)
}
