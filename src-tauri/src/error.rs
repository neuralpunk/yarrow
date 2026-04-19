use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum YarrowError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("git error: {0}")]
    Git(#[from] git2::Error),
    #[error("toml parse error: {0}")]
    TomlDe(#[from] toml::de::Error),
    #[error("toml serialize error: {0}")]
    TomlSer(#[from] toml::ser::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("no active workspace")]
    NoWorkspace,
    #[error("note not found: {0}")]
    NoteNotFound(String),
    #[error("path not found: {0}")]
    PathNotFound(String),
    #[error("cannot delete active path: {0}")]
    CannotDeleteActivePath(String),
    #[error("merge conflicts: {0}")]
    MergeConflicts(String),
    #[error("no remote configured")]
    NoRemote,
    #[error("invalid input: {0}")]
    Invalid(String),
    #[error("encryption: {0}")]
    Crypto(String),
    #[error("encrypted notes are locked — unlock to continue")]
    LockedOut,
    #[error("encryption is not enabled for this workspace")]
    EncryptionDisabled,
    #[error("encryption is already enabled for this workspace")]
    EncryptionAlreadyEnabled,
    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, YarrowError>;

impl Serialize for YarrowError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        // Most variants serialize as-is, but `Io` wraps a raw `std::io::Error`
        // whose formatted text frequently includes the absolute filesystem
        // path that failed (e.g. "No such file or directory (os error 2):
        // /home/user/…/notes/foo.md"). That path is internal detail — it
        // aids reconnaissance against the workspace layout if it reaches
        // the frontend or a static-site export. Strip it here and surface
        // a stable, human-readable message instead.
        let msg = match self {
            YarrowError::Io(e) => format!("io error: {}", sanitize_io(e)),
            other => other.to_string(),
        };
        s.serialize_str(&msg)
    }
}

/// Keep the `ErrorKind` tag (so the frontend can still distinguish
/// "not found" from "permission denied") but drop the path string that
/// `std::io::Error`'s Display includes when the error came from a
/// `_with_path` constructor inside std.
fn sanitize_io(e: &std::io::Error) -> String {
    use std::io::ErrorKind as K;
    match e.kind() {
        K::NotFound          => "not found".into(),
        K::PermissionDenied  => "permission denied".into(),
        K::AlreadyExists     => "already exists".into(),
        K::InvalidInput      => "invalid input".into(),
        K::InvalidData       => "invalid data on disk".into(),
        K::WriteZero         => "write failed".into(),
        K::Interrupted       => "interrupted".into(),
        K::UnexpectedEof     => "unexpected end of file".into(),
        _                    => "filesystem error".into(),
    }
}

impl From<anyhow::Error> for YarrowError {
    fn from(e: anyhow::Error) -> Self {
        YarrowError::Other(e.to_string())
    }
}
