use std::path::{Path, PathBuf};

use chrono::{Datelike, Utc};
use gray_matter::{engine::YAML, Matter};
use serde::{Deserialize, Serialize};

use crate::crypto::{self, BodyEnvelope, MasterKey};
use crate::error::{Result, YarrowError};
use crate::search_index;
use crate::workspace;

/// Best-effort search-index refresh. Reads the per-workspace toggle on
/// every call and no-ops when disabled (default for workspaces that
/// have explicitly turned indexing off). Encrypted bodies are always
/// excluded — we feed title + tags + slug only, matching the substring
/// path's behaviour. Failures are logged and swallowed.
fn touch_index_after_write(root: &Path, note: &Note) {
    let enabled = workspace::read_config(root)
        .map(|c| c.preferences.search_index_enabled)
        .unwrap_or(true);
    if !enabled { return; }
    // Redact the body for both encrypted AND private notes — the
    // `search_index::rebuild` path already does this; the per-save
    // `upsert` path was missing the private check, so PHI-bearing
    // bodies were leaking into FTS even though sidebar excerpts and
    // full-rebuild were both correctly redacted.
    let body = if note.frontmatter.encrypted || note.frontmatter.is_private() {
        String::new()
    } else {
        note.body.clone()
    };
    search_index::upsert_note_best_effort(
        root,
        &note.slug,
        &note.frontmatter.title,
        &body,
        &note.frontmatter.tags,
    );
}

fn touch_index_after_delete(root: &Path, slug: &str) {
    let enabled = workspace::read_config(root)
        .map(|c| c.preferences.search_index_enabled)
        .unwrap_or(true);
    if !enabled { return; }
    search_index::delete_note_best_effort(root, slug);
}

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

/// Margin-ink annotation — a thinking-about-the-thinking note pinned to a
/// short excerpt of the body. Stored in frontmatter so external markdown
/// tools can round-trip the file. See `AnnotationsGutter.tsx` for the UI.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct Annotation {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub anchor: String,
    #[serde(default)]
    pub body: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub at: String,
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
    /// 2.0 Margin Ink. Empty by default — serialization skips the key when
    /// the note has no annotations, so existing notes stay byte-identical.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub annotations: Vec<Annotation>,
    /// 2.1 Air-gapped notes. When `private = true` (or any tag matches
    /// "clinical"), the note is registered in `.git/info/exclude` so it
    /// stays out of every commit and therefore out of every sync. The
    /// file lives in the normal `notes/` tree on disk; only git's view
    /// of it differs.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub private: bool,
    /// 2.1 Folders. Pure presentation metadata — the file always lives
    /// at `notes/<slug>.md` regardless. The sidebar groups notes whose
    /// `folder` field matches, with `None` notes falling through to the
    /// existing time-based view. No on-disk migration; existing notes
    /// without this field just stay un-foldered.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
}

impl Frontmatter {
    /// Single source of truth for "is this a clinical / private note?"
    /// Tags are normalized to lowercase before comparison so `Clinical`,
    /// `CLINICAL`, and `clinical` all count.
    pub fn is_private(&self) -> bool {
        if self.private {
            return true;
        }
        self.tags.iter().any(|t| t.eq_ignore_ascii_case("clinical"))
    }
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
    /// Mirrors `frontmatter.is_private()` — lifted into the summary so
    /// the sidebar can render a lock badge without rereading the body.
    #[serde(default)]
    pub private: bool,
    /// Mirrors `frontmatter.folder`. Lifted into the summary so the
    /// sidebar can group rows without rereading every body. `None` is
    /// the un-foldered case (the default).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
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

/// One pass over the notes directory: reads each file exactly once and
/// returns the parsed frontmatter, body, and slug. Both `list` and
/// `graph::build` consume this so a save no longer pays for two
/// independent walks of the same disk tree (previously ~2N file reads
/// per save; now N).
pub struct ScannedNote {
    pub slug: String,
    pub fm: Frontmatter,
    pub body: String,
}

pub fn scan(root: &Path) -> Result<Vec<ScannedNote>> {
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
        out.push(ScannedNote { slug, fm, body });
    }
    Ok(out)
}

/// Build a `NoteSummary` row from a scanned note. Pulled out so `list` and
/// `cmd_save_note_full` (and other batched-IPC callers) can derive
/// summaries without re-parsing.
pub fn summary_from(scanned: &ScannedNote) -> NoteSummary {
    let title = if scanned.fm.title.is_empty() { scanned.slug.clone() } else { scanned.fm.title.clone() };
    let modified = if scanned.fm.modified.is_empty() { scanned.fm.created.clone() } else { scanned.fm.modified.clone() };
    // Excerpt is the visible body preview that ships through to the
    // sidebar list, the command palette, and any tooltip surface that
    // shows a NoteSummary. Encrypted notes have always shown a stub
    // string; 2.1 extends the same redaction to *private* notes (the
    // clinical-kit class) so a glance at the sidebar can't read out
    // PHI to a passer-by, even when the note isn't sealed at rest.
    let excerpt = if scanned.fm.encrypted {
        "🔒 encrypted — unlock to preview".to_string()
    } else if scanned.fm.is_private() {
        "⊘ private — open the note to read".to_string()
    } else {
        excerpt_from(&scanned.body)
    };
    NoteSummary {
        slug: scanned.slug.clone(),
        title,
        modified,
        excerpt,
        pinned: scanned.fm.pinned,
        encrypted: scanned.fm.encrypted,
        tags: scanned.fm.tags.clone(),
        private: scanned.fm.is_private(),
        folder: scanned.fm.folder.clone(),
    }
}

pub fn list(root: &Path) -> Result<Vec<NoteSummary>> {
    let mut out: Vec<NoteSummary> = scan(root)?.iter().map(summary_from).collect();
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
                annotations: vec![],
                private: false,
                folder: None,
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
    // 2.1 Air-gapped notes: keep `.git/info/exclude` in sync with the
    // current is_private state so a tag toggle (clinical → not, or
    // vice-versa) is reflected in git's view of the workspace without
    // any UI follow-up. Idempotent — safe to call on every save.
    let _ = crate::git::ensure_private_exclude(root, slug, fm.is_private());
    let note = Note {
        slug: slug.to_string(),
        frontmatter: fm.clone(),
        body: if fm.encrypted && key.is_none() { String::new() } else { body.to_string() },
        encrypted: fm.encrypted,
        locked: fm.encrypted && key.is_none(),
    };
    // Cache update happens after the canonical write — if this fails the
    // save still succeeded and the index just falls behind.
    touch_index_after_write(root, &note);
    Ok((note, true))
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
    use std::sync::atomic::{AtomicU64, Ordering};
    // Process-global counter so two threads calling `atomic_write` on
    // the same nanosecond can't generate the same temp name. `SystemTime`
    // on some platforms has worse-than-nanosecond precision (subsec_nanos
    // can be identical across sub-microsecond calls on Windows). Adding
    // a strict-monotonic counter closes that gap — two writes from the
    // same pid in the same instant still get distinct names.
    static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);
    let parent = path
        .parent()
        .ok_or_else(|| YarrowError::Other(format!("no parent for {}", path.display())))?;
    std::fs::create_dir_all(parent)?;
    let pid = std::process::id();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let seq = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let stem = path.file_name().and_then(|s| s.to_str()).unwrap_or("note");
    let tmp = parent.join(format!(".{stem}.{pid}.{nanos}.{seq}.tmp"));
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
        annotations: vec![],
        private: false,
        folder: None,
    };
    write(root, &slug, "", Some(fm))
}

pub fn rename(
    root: &Path,
    old_slug: &str,
    new_title: &str,
    rewrite_wikilinks: bool,
) -> Result<Note> {
    let old_title = read(root, old_slug)
        .map(|n| n.frontmatter.title)
        .unwrap_or_default();
    let mut new_slug = slug_from_title(new_title);
    if new_slug == old_slug {
        let note = read(root, old_slug)?;
        let mut fm = note.frontmatter;
        fm.title = new_title.to_string();
        let updated = write(root, old_slug, &note.body, Some(fm))?;
        if rewrite_wikilinks {
            rewrite_wikilinks_on_rename(root, &old_title, old_slug, new_title)?;
        }
        return Ok(updated);
    }
    let mut n = 1;
    while note_path(root, &new_slug).exists() {
        n += 1;
        new_slug = format!("{}-{}", slug_from_title(new_title), n);
    }
    std::fs::rename(note_path(root, old_slug), note_path(root, &new_slug))?;
    // The old slug no longer exists on disk, so its cache row would
    // become a ghost if we didn't clear it. The subsequent `write` will
    // upsert under the new slug via the `touch_index_after_write` hook.
    touch_index_after_delete(root, old_slug);
    let moved = read(root, &new_slug)?;
    let mut fm = moved.frontmatter;
    fm.title = new_title.to_string();
    let updated = write(root, &new_slug, &moved.body, Some(fm))?;
    // Frontmatter `links:` arrays always update — they're typed connections
    // the user explicitly created and would be silently broken by a slug
    // rename. Body wikilinks are opt-in (the wizard asks before mutating
    // every note in the workspace).
    update_backlinks_on_rename(root, old_slug, &new_slug)?;
    if rewrite_wikilinks {
        rewrite_wikilinks_on_rename(root, &old_title, old_slug, new_title)?;
    }
    Ok(updated)
}

/// Count notes whose body contains a wikilink to `slug` or its title — used
/// by the rename dialog to tell the user how many notes will be touched
/// before they decide to opt in.
pub fn count_wikilink_refs(root: &Path, slug: &str) -> Result<usize> {
    let title = read(root, slug)
        .map(|n| n.frontmatter.title)
        .unwrap_or_default();
    let candidates: Vec<String> = {
        let mut v = vec![slug.to_string()];
        if !title.is_empty() && title != slug { v.push(title); }
        v
    };
    let needles: Vec<(String, String)> = candidates.iter()
        .flat_map(|n| {
            let inline = format!("[[{}]]", n);
            let inline_pipe = format!("[[{}|", n);
            let inline_anchor = format!("[[{}#", n);
            let embed = format!("![[{}]]", n);
            let embed_pipe = format!("![[{}|", n);
            let embed_anchor = format!("![[{}#", n);
            vec![
                (inline, n.clone()),
                (inline_pipe, n.clone()),
                (inline_anchor, n.clone()),
                (embed, n.clone()),
                (embed_pipe, n.clone()),
                (embed_anchor, n.clone()),
            ]
        })
        .collect();
    let mut count = 0usize;
    for summary in list(root)? {
        if summary.slug == slug { continue; }
        let note = match read(root, &summary.slug) { Ok(n) => n, Err(_) => continue };
        for (needle, _) in &needles {
            if note.body.contains(needle) { count += 1; break; }
        }
    }
    Ok(count)
}

pub fn delete(root: &Path, slug: &str) -> Result<()> {
    let path = note_path(root, slug);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    // Remove references to this slug from all other notes. The 2.0
    // version called `list()` (full directory walk) followed by `read()`
    // for every note (a second walk + decrypt + parse), then wrote
    // each note unconditionally. On a 5000-note vault that was a 5000×
    // (read + parse + write) loop even when no backlinks existed.
    //
    // 2.1: a single `scan()` gives us already-parsed frontmatter for
    // every note. We check `fm.links` in-memory and only call `write()`
    // for notes that actually have a backlink to remove. write() with
    // an existing-encrypted note + no key still preserves the on-disk
    // ciphertext via its locked-encryption branch, so encrypted notes
    // with backlinks update their frontmatter correctly without us
    // needing to decrypt.
    for scanned in scan(root)? {
        if !scanned.fm.links.iter().any(|l| l.target == slug) {
            continue;
        }
        let mut fm = scanned.fm;
        fm.links.retain(|l| l.target != slug);
        write(root, &scanned.slug, &scanned.body, Some(fm))?;
    }
    // Drop the row from the search cache. The per-backlink writes above
    // already refreshed their own rows via `touch_index_after_write`.
    touch_index_after_delete(root, slug);
    Ok(())
}

/// Rewrite every `[[wikilink]]` in every note's body that referred to the
/// old title or slug so it now refers to the new title. Called from `rename`
/// after the file move + frontmatter update.
fn rewrite_wikilinks_on_rename(
    root: &Path,
    old_title: &str,
    old_slug: &str,
    new_title: &str,
) -> Result<()> {
    let candidates: Vec<String> = {
        let mut v = vec![old_slug.to_string()];
        if !old_title.is_empty() && old_title != old_slug { v.push(old_title.to_string()); }
        v
    };
    for summary in list(root)? {
        let note = match read(root, &summary.slug) {
            Ok(n) => n,
            Err(_) => continue, // encrypted/locked notes get skipped, not corrupted
        };
        let mut body = note.body.clone();
        let mut changed = false;
        for needle in &candidates {
            // Cover `[[needle]]`, `![[needle]]`, plus aliased / anchored
            // forms `[[needle|alias]]` and `[[needle#section]]`. Precise
            // string replace (no regex) keeps it predictable.
            let pairs: [(String, String); 6] = [
                (format!("[[{}]]", needle),   format!("[[{}]]", new_title)),
                (format!("![[{}]]", needle),  format!("![[{}]]", new_title)),
                (format!("[[{}|", needle),    format!("[[{}|", new_title)),
                (format!("![[{}|", needle),   format!("![[{}|", new_title)),
                (format!("[[{}#", needle),    format!("[[{}#", new_title)),
                (format!("![[{}#", needle),   format!("![[{}#", new_title)),
            ];
            for (from, to) in &pairs {
                if body.contains(from) {
                    body = body.replace(from, to);
                    changed = true;
                }
            }
        }
        if changed {
            write(root, &summary.slug, &body, Some(note.frontmatter))?;
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

pub(crate) fn parse(raw: &str) -> (Frontmatter, String) {
    let fm = parse_frontmatter(raw);
    let body = strip_frontmatter(raw);
    (fm, body)
}

fn parse_frontmatter(raw: &str) -> Frontmatter {
    // gray_matter 0.2 / serde-yaml can panic on a few pathological
    // shapes (e.g. duplicate keys with conflicting types in the YAML
    // header). A bad note shouldn't take the whole backend down — the
    // sidebar would freeze, save commands would 500, and the user would
    // have no way to recover without hand-editing the file. Catching
    // here returns a default Frontmatter so the note still loads with
    // its body intact, just with empty metadata.
    std::panic::catch_unwind(|| {
        let matter = Matter::<YAML>::new();
        matter
            .parse(raw)
            .data
            .and_then(|d| d.deserialize::<Frontmatter>().ok())
            .unwrap_or_default()
    })
    .unwrap_or_default()
}

fn strip_frontmatter(raw: &str) -> String {
    // Same defensive wrap as `parse_frontmatter` — if the YAML header
    // makes the parser panic, fall back to the raw input so the note's
    // text isn't silently lost.
    std::panic::catch_unwind(|| {
        let matter = Matter::<YAML>::new();
        matter.parse(raw).content
    })
    .unwrap_or_else(|_| raw.to_string())
}

pub(crate) fn serialize(fm: &Frontmatter, body: &str) -> String {
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
    if fm.private {
        out.push_str("private: true\n");
    }
    if let Some(ref folder) = fm.folder {
        if !folder.is_empty() {
            out.push_str(&format!("folder: {}\n", yaml_escape(folder)));
        }
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
    if !fm.annotations.is_empty() {
        out.push_str("annotations:\n");
        for a in &fm.annotations {
            out.push_str(&format!("  - body: {}\n", yaml_escape(&a.body)));
            if !a.anchor.is_empty() {
                out.push_str(&format!("    anchor: {}\n", yaml_escape(&a.anchor)));
            }
            if !a.at.is_empty() {
                out.push_str(&format!("    at: {}\n", yaml_escape(&a.at)));
            }
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
        annotations: vec![],
        private: false,
        folder: None,
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
        annotations: vec![],
        private: false,
        folder: None,
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

/// Sync the "Today's threads" section of a daily note with every note
/// whose frontmatter `modified` date matches this journal date.
///
/// The rendered section lives between the two HTML-comment markers
/// below so the reconciler can find and rewrite its own block without
/// disturbing the user's surrounding prose. If the markers aren't in
/// the body yet, a fresh section is appended at the end.
///
/// `threads` is optional: when `None`, the section stays untouched
/// entirely — useful while the feature is toggling or when there's
/// nothing to sync. Returns `true` if the body changed on disk.
pub fn reconcile_daily_threads(root: &Path, date_iso: &str) -> Result<bool> {
    let daily = daily_slug(date_iso);
    let path = note_path(root, &daily);
    if !path.exists() {
        return Ok(false);
    }
    let mut note = read(root, &daily)?;

    // Find notes whose local `modified` date matches `date_iso`. We
    // parse the RFC3339 stamp's date component — cheap and correct for
    // any timezone-aware stamp the editor writes.
    let summaries = list(root)?;
    let mut hits: Vec<(String, String)> = Vec::new(); // (slug, title)
    for s in summaries {
        if s.slug == daily {
            continue;
        }
        // Skip other daily notes — connecting the journal to itself
        // would be noise.
        if s.slug.starts_with(DAILY_PREFIX) {
            continue;
        }
        let modified_date = s.modified.get(0..10).unwrap_or("");
        if modified_date != date_iso {
            continue;
        }
        let title = if s.title.trim().is_empty() {
            s.slug.clone()
        } else {
            s.title.clone()
        };
        hits.push((s.slug, title));
    }
    // Alphabetize for deterministic output.
    hits.sort_by(|a, b| a.1.to_lowercase().cmp(&b.1.to_lowercase()));

    let new_section = render_threads_section(&hits);
    let new_body = splice_threads_section(&note.body, &new_section);
    if new_body == note.body {
        return Ok(false);
    }
    note.body = new_body;
    write(root, &daily, &note.body, Some(note.frontmatter))?;
    Ok(true)
}

const THREADS_MARK_BEGIN: &str = "<!-- yarrow:threads:begin -->";
const THREADS_MARK_END: &str = "<!-- yarrow:threads:end -->";

fn render_threads_section(hits: &[(String, String)]) -> String {
    if hits.is_empty() {
        // Keep the markers even when empty, so the next reconciliation
        // can fill them in without re-appending a heading block.
        return format!(
            "## Today's threads\n{}\n_no notes edited on this date yet._\n{}",
            THREADS_MARK_BEGIN, THREADS_MARK_END
        );
    }
    let mut out = String::new();
    out.push_str("## Today's threads\n");
    out.push_str(THREADS_MARK_BEGIN);
    out.push('\n');
    for (_, title) in hits {
        out.push_str(&format!("- [[{}]]\n", title));
    }
    out.push_str(THREADS_MARK_END);
    out
}

/// Replace an existing threads section (if any) in the body with the
/// freshly rendered one, or append if the markers aren't present yet.
fn splice_threads_section(body: &str, new_section: &str) -> String {
    if let (Some(b), Some(e)) = (body.find(THREADS_MARK_BEGIN), body.find(THREADS_MARK_END)) {
        if e > b {
            // Walk the begin marker back to the start of its heading so
            // we replace the whole "## Today's threads" block, not just
            // the comment-enclosed list. The heading is immediately
            // before the begin marker in what we write.
            let before_begin = &body[..b];
            let heading_start = before_begin
                .rfind("## Today's threads")
                .unwrap_or(before_begin.len());
            let head = &body[..heading_start];
            let end_of_end_marker = e + THREADS_MARK_END.len();
            let tail = &body[end_of_end_marker..];
            let mut out = String::with_capacity(head.len() + new_section.len() + tail.len() + 2);
            out.push_str(head.trim_end_matches(|c: char| c == '\n' || c == ' '));
            if !out.is_empty() {
                out.push_str("\n\n");
            }
            out.push_str(new_section);
            out.push_str(tail);
            return out;
        }
    }
    // No existing section — append, guaranteeing a blank line first.
    let mut out = body.trim_end().to_string();
    if !out.is_empty() {
        out.push_str("\n\n");
    }
    out.push_str(new_section);
    out.push('\n');
    out
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
        let private = fm.is_private();
        let folder = fm.folder.clone();
        out.push(NoteSummary { slug, title, modified, excerpt, pinned: false, tags: fm.tags, encrypted: fm.encrypted, private, folder });
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

/// Tag Bouquet (2.1): compute up to `limit` tag suggestions for a note body.
///
/// The ranking is deliberately simple and fully local: every word in the
/// body is normalised, stop-words and short tokens are dropped, then each
/// surviving stem is scored by
///   2.0 × (already-a-vault-tag?)  — re-using existing tags is preferred
/// + 1.0 × min(occurrences, 5) / 5 — but common stems from the body float up
/// + 0.4 × title-occurrence        — title hits get a small boost
/// Results are capped, stripped of anything already applied to this note,
/// and returned in score-descending order. No embeddings, no network.
pub fn suggest_tags(
    body: &str,
    title: &str,
    existing_tags: &[String],
    vault_tags: &[String],
    limit: usize,
) -> Vec<String> {
    use rust_stemmers::{Algorithm, Stemmer};
    use std::collections::HashMap;

    // 2.1: Snowball English stemmer collapses inflections morphologically.
    // "gardens", "gardening", "gardener", "gardened" all stem to "garden",
    // so a single body token form matches an existing `#garden` tag and
    // we never emit near-duplicate suggestions. Replaces the hand-rolled
    // s-suffix strip that lived here in 2.1.0's initial cut.
    let stemmer = Stemmer::create(Algorithm::English);
    let stem = |s: &str| -> String { stemmer.stem(s).to_string() };

    // Stems of tags already on this note — we never re-suggest anything
    // that maps to an existing tag's stem (so "work" isn't suggested
    // when the user already has `#working`).
    let applied_stems: std::collections::HashSet<String> =
        existing_tags.iter().map(|s| stem(&s.to_lowercase())).collect();

    // stem → canonical vault surface form. When a vault tag "wins" the
    // suggestion, we emit its exact surface (`#garden`, not `#gardens`)
    // so the user keeps tagging with the form they've already chosen.
    let mut vault_surface_by_stem: HashMap<String, String> = HashMap::new();
    for t in vault_tags {
        let lc = t.to_lowercase();
        let st = stem(&lc);
        vault_surface_by_stem.entry(st).or_insert(lc);
    }

    // Short-and-common stop-words — filtered pre-stem so "the"/"their"
    // etc. never reach the scorer. Stemming wouldn't remove them (Snowball
    // leaves stop-words alone; that's a separate pass in Lucene). English-
    // only for now; whatlang + per-language stop lists can slot in later.
    static STOP: &[&str] = &[
        "the","a","an","and","or","but","if","then","when","with","without","of",
        "for","to","in","on","at","by","is","are","was","were","be","been","being",
        "this","that","these","those","it","its","as","from","into","about","over",
        "we","you","i","me","my","your","our","their","they","he","she","him","her",
        "so","not","no","yes","do","did","does","done","have","has","had","will",
        "would","could","should","can","may","might","must","just","very","more",
        "most","much","some","any","all","one","two","three","out","up","down",
        "also","than","only","even","still","too","get","got","go","going","make",
        "made","said","say","says","thing","things","someone","something","well",
        "like","really","back","here","there","what","which","who","whom","whose",
        "how","why","because","while","after","before","where","now","yet",
    ];
    let stop_set: std::collections::HashSet<&str> = STOP.iter().copied().collect();

    // Per-stem state: how many body tokens stemmed to it, which surface
    // forms we saw (shortest wins as fallback when no vault match), and
    // whether any surface appeared in the title (small score bump).
    struct StemInfo {
        count: u32,
        shortest_surface: String,
        in_title: bool,
    }
    let mut stems: HashMap<String, StemInfo> = HashMap::new();

    fn tally(
        stems: &mut HashMap<String, StemInfo>,
        stop_set: &std::collections::HashSet<&str>,
        stem_fn: &dyn Fn(&str) -> String,
        tok: &str,
        is_title: bool,
    ) {
        if tok.len() < 4 || tok.len() > 20 { return; }
        if stop_set.contains(tok) { return; }
        let st = stem_fn(tok);
        if st.is_empty() { return; }
        let entry = stems.entry(st).or_insert_with(|| StemInfo {
            count: 0,
            shortest_surface: tok.to_string(),
            in_title: false,
        });
        if !is_title {
            entry.count += 1;
        }
        if is_title {
            entry.in_title = true;
        }
        // Prefer the shortest surface form we've seen — "garden" over
        // "gardens" over "gardening" — unless a vault tag overrides
        // this at emit time.
        if tok.len() < entry.shortest_surface.len() {
            entry.shortest_surface = tok.to_string();
        }
    }

    // Tokeniser: walk chars, keep alphabetic runs (plus `-` and `_`),
    // lowercase eagerly, hand each completed token to `tally`.
    let mut walk = |text: &str, is_title: bool| {
        let mut curr = String::with_capacity(24);
        for ch in text.chars() {
            if ch.is_alphabetic() || ch == '-' || ch == '_' {
                for c in ch.to_lowercase() { curr.push(c); }
            } else {
                if !curr.is_empty() {
                    tally(&mut stems, &stop_set, &stem, &curr, is_title);
                    curr.clear();
                }
            }
        }
        if !curr.is_empty() {
            tally(&mut stems, &stop_set, &stem, &curr, is_title);
        }
    };
    walk(body, false);
    walk(title, true);

    // Score each stem: occurrence (capped at 5 hits), vault-preference
    // bonus (×2 when the user has already tagged with this stem), plus
    // a small title bump.
    let mut scored: Vec<(String, String, f32)> = stems
        .into_iter()
        .filter(|(st, _)| !applied_stems.contains(st))
        .map(|(st, info)| {
            let occ = (info.count as f32).min(5.0) / 5.0;
            let vault_bonus = if vault_surface_by_stem.contains_key(&st) { 2.0 } else { 0.0 };
            let title_bonus = if info.in_title { 0.4 } else { 0.0 };
            // Pick the surface form: vault's first if it wins, else the
            // shortest we saw in the text.
            let surface = vault_surface_by_stem
                .get(&st)
                .cloned()
                .unwrap_or(info.shortest_surface);
            (st, surface, occ + vault_bonus + title_bonus)
        })
        .collect();

    scored.sort_by(|a, b| {
        b.2.partial_cmp(&a.2)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.1.cmp(&b.1))
    });

    // Stems are unique by construction (HashMap key), so no post-filter
    // dedup is needed. We just cap and return surface forms.
    scored.into_iter()
        .take(limit)
        .map(|(_, surface, _)| surface)
        .collect()
}

#[cfg(test)]
mod suggest_tags_tests {
    use super::suggest_tags;

    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn plural_body_surfaces_singular_vault_tag() {
        // User already has `#garden`. Body uses "gardens" repeatedly. We
        // should suggest `garden` (the vault's surface form), NOT
        // `gardens` — because the user has chosen how they want this
        // concept tagged.
        let body = "I tend the gardens weekly. The gardens are fine. My gardens.";
        let out = suggest_tags(body, "on weekly care", &s(&[]), &s(&["garden"]), 5);
        assert!(out.contains(&"garden".to_string()),
            "expected 'garden' (vault surface) in {:?}", out);
        assert!(!out.contains(&"gardens".to_string()),
            "did not expect 'gardens' when vault has 'garden' in {:?}", out);
    }

    #[test]
    fn verb_inflections_collapse_to_one_suggestion() {
        // "writing", "writes", "wrote" should not all show up — they
        // stem together. Only one suggestion in the output.
        let body = "I am writing. She writes. He wrote. They are writing again.";
        let out = suggest_tags(body, "about writing", &s(&[]), &s(&[]), 10);
        let writing_hits: Vec<_> = out.iter()
            .filter(|w| w.starts_with("writ"))
            .collect();
        assert_eq!(writing_hits.len(), 1,
            "expected exactly one writ* suggestion, got {:?}", out);
    }

    #[test]
    fn already_applied_tag_blocks_its_inflections() {
        // User has `#working`. Body says "I worked on work today" —
        // nothing in the "work" family should be suggested.
        let body = "I worked on work today. The work was good. I am working.";
        let out = suggest_tags(body, "", &s(&["working"]), &s(&[]), 10);
        assert!(!out.iter().any(|w| w.starts_with("work")),
            "expected no work* suggestions when #working already applied, got {:?}", out);
    }
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
