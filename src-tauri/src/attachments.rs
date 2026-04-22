// Attachments: binary files (images, PDFs, ...) dropped into the workspace.
//
// Storage layout: workspace_root/attachments/<16-hex>.<ext>
//
// Content-addressed by SHA-256 prefix so re-dropping the same image never
// creates a duplicate. Attachments live OUTSIDE .yarrow/ (which is partly
// gitignored) so they're versioned and synced like regular notes.
//
// Commands hand attachments in as base64-encoded byte arrays — Tauri's JSON
// IPC doesn't carry raw binary cleanly, and for the sizes a note-taking tool
// handles (<5 MB images) the encoding overhead is a non-issue.

use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::{Result, YarrowError};

pub const ATTACHMENTS_DIR: &str = "attachments";
/// Mirrors the relpath prefix that lives in the markdown. The web UI uses
/// this to recognise `![](attachments/abc.png)` lines for inline preview.
pub const MARKDOWN_PREFIX: &str = "attachments/";

/// Hard cap on a single attachment. A note workspace isn't a media library —
/// 10 MB covers typical images and PDFs while keeping sync payloads sane.
pub const MAX_ATTACHMENT_BYTES: usize = 10 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttachmentRef {
    /// Relative to workspace root — the string that gets embedded in markdown.
    pub relpath: String,
    /// Bytes size, useful for toasts ("attached 1.4 MB image").
    pub size: u64,
    /// Ready-to-paste markdown fragment, e.g. `![foo.png](attachments/<hash>.png)`.
    pub markdown: String,
    /// MIME type guessed from the extension — lets the renderer pick <img> vs. <a>.
    pub mime: String,
}

pub fn attachments_dir(root: &Path) -> PathBuf {
    root.join(ATTACHMENTS_DIR)
}

/// Extensions we actively preview inline. Other types still attach and link,
/// they just don't get an <img> widget.
pub fn is_image_ext(ext: &str) -> bool {
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "avif",
    )
}

fn guess_mime(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "png"  => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif"  => "image/gif",
        "webp" => "image/webp",
        "svg"  => "image/svg+xml",
        "avif" => "image/avif",
        "pdf"  => "application/pdf",
        "md" | "markdown" => "text/markdown",
        "txt"  => "text/plain",
        _      => "application/octet-stream",
    }
}

/// Copy bytes into the attachments dir. Returns a stable content-addressed
/// ref — calling twice with the same bytes produces the same file.
pub fn attach_bytes(root: &Path, display_name: &str, bytes: &[u8]) -> Result<AttachmentRef> {
    if bytes.is_empty() {
        return Err(YarrowError::Invalid("empty attachment".into()));
    }
    if bytes.len() > MAX_ATTACHMENT_BYTES {
        return Err(YarrowError::Invalid(format!(
            "attachment too large ({:.1} MB) — limit is {} MB",
            bytes.len() as f64 / (1024.0 * 1024.0),
            MAX_ATTACHMENT_BYTES / (1024 * 1024),
        )));
    }
    // Pull the extension off the user's display name, then sanitise:
    //   * ASCII alphanumeric only — no path separators, no NULs, no
    //     control chars that could confuse downstream shells or the
    //     browser's attachment viewer.
    //   * max 10 chars — real extensions top out at ~5 (`.tiff`,
    //     `.jpeg`, `.webp`, `.xlsx`); anything longer is a crafted
    //     filename and we swap it for `bin`.
    //   * non-empty — `bin` is a safe default for "I don't know".
    let raw_ext = Path::new(display_name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let ext = if raw_ext.is_empty()
        || raw_ext.len() > 10
        || !raw_ext.chars().all(|c| c.is_ascii_alphanumeric())
    {
        "bin".to_string()
    } else {
        raw_ext
    };

    // 16-hex (64 bits) is ample dedupe headroom for hand-scale vaults.
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    let hex: String = digest.iter().take(8).map(|b| format!("{:02x}", b)).collect();

    let filename = format!("{}.{}", hex, ext);
    let dir = attachments_dir(root);
    std::fs::create_dir_all(&dir)?;
    let dest = dir.join(&filename);
    if !dest.exists() {
        std::fs::write(&dest, bytes)?;
    }

    let relpath = format!("{}{}", MARKDOWN_PREFIX, filename);
    let safe_alt = sanitize_alt_text(display_name);
    let markdown = if is_image_ext(&ext) {
        format!("![{}]({})", safe_alt, relpath)
    } else {
        format!("[{}]({})", safe_alt, relpath)
    };
    Ok(AttachmentRef {
        relpath,
        size: bytes.len() as u64,
        markdown,
        mime: guess_mime(&ext).to_string(),
    })
}

/// Keep markdown link/image alt text from breaking out: drop newlines, carriage
/// returns, backticks, square/round brackets, pipes, and angle brackets. Result
/// is collapsed whitespace and trimmed.
fn sanitize_alt_text(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| {
            // Collapse whitespace control characters AND the markdown link
            // metacharacters to a space — either would break the emitted
            // `![alt](path)` if left in place.
            if c == '\n'
                || c == '\r'
                || c == '\t'
                || matches!(c, '`' | '[' | ']' | '(' | ')' | '|' | '<' | '>' | '"' | '\\')
            {
                ' '
            } else {
                c
            }
        })
        .collect();
    // Collapse runs of spaces and trim.
    let mut out = String::with_capacity(cleaned.len());
    let mut prev_space = false;
    for c in cleaned.chars() {
        if c == ' ' {
            if !prev_space {
                out.push(' ');
            }
            prev_space = true;
        } else {
            out.push(c);
            prev_space = false;
        }
    }
    let trimmed = out.trim();
    if trimmed.is_empty() {
        "attachment".into()
    } else {
        trimmed.to_string()
    }
}

/// Attach a file already on disk — convenient for drag-drop where Tauri gives
/// us a path rather than bytes.
pub fn attach_from_path(root: &Path, source: &Path) -> Result<AttachmentRef> {
    let bytes = std::fs::read(source)?;
    let display = source
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("attachment.bin");
    attach_bytes(root, display, &bytes)
}

#[derive(Debug, Serialize)]
pub struct AttachmentData {
    pub mime: String,
    pub base64: String,
}

/// Read an attachment for display — returns base64 + mime so the frontend
/// can stick it in a `data:` URL without needing filesystem-asset permissions.
pub fn read_attachment(root: &Path, relpath: &str) -> Result<AttachmentData> {
    // Defence against traversal: the only valid prefix is `attachments/` and
    // the remainder must not climb out of the dir.
    if !relpath.starts_with(MARKDOWN_PREFIX) {
        return Err(YarrowError::Invalid(format!("not an attachment: {}", relpath)));
    }
    let tail = &relpath[MARKDOWN_PREFIX.len()..];
    if tail.contains("..") || tail.contains('/') || tail.contains('\\') {
        return Err(YarrowError::Invalid(format!("invalid attachment path: {}", relpath)));
    }
    let path = attachments_dir(root).join(tail);
    if !path.exists() {
        return Err(YarrowError::Invalid(format!("attachment missing: {}", relpath)));
    }
    let bytes = std::fs::read(&path)?;
    let ext = Path::new(tail)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("bin");
    Ok(AttachmentData {
        mime: guess_mime(ext).to_string(),
        base64: STANDARD.encode(&bytes),
    })
}
