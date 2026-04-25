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
    /// The remote workspace we're configured to sync with no longer
    /// exists (deleted out-of-band via the web UI, server reset, etc).
    /// `cmd_sync` catches this, clears the stale workspace_id in local
    /// config, and retries with a fresh `create_workspace` — so a
    /// deleted workspace cleanly morphs into a new empty one instead
    /// of leaving the user stuck with "sync failed" forever.
    #[error("server workspace no longer exists")]
    RemoteWorkspaceGone,
    #[error("invalid input: {0}")]
    Invalid(String),
    /// Sync-time authentication failed — bad PAT, expired token, server
    /// rejected credentials. Distinct from `Other` so the frontend can
    /// show "your sync token expired — reconnect in Settings" instead of
    /// the generic toast.
    #[error("authentication failed: {0}")]
    AuthFailed(String),
    /// Sync-time network failure — couldn't reach the remote at all
    /// (DNS, no route, TLS handshake never completed). Frontend renders
    /// "check your connection" rather than blaming the user's setup.
    #[error("network unavailable: {0}")]
    NetworkUnavailable(String),
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

/// Reclassify a sync-time error into one of the structured variants
/// (`AuthFailed`, `NetworkUnavailable`, `RemoteWorkspaceGone`) when the
/// underlying message matches a known shape. Falls through to the
/// original error otherwise so non-sync failures aren't laundered.
///
/// Why text matching? libgit2 surfaces HTTP/2 stream errors and SSL
/// handshakes as `git2::Error` with class=Net and the actual cause
/// buried in the message. We pull the cause back out to give the user
/// a useful toast.
pub fn classify_sync_error(err: YarrowError) -> YarrowError {
    let msg_lower;
    let class_code = match &err {
        YarrowError::Git(e) => {
            msg_lower = e.message().to_ascii_lowercase();
            Some((e.class(), e.code()))
        }
        YarrowError::Other(s) => {
            msg_lower = s.to_ascii_lowercase();
            None
        }
        _ => return err,
    };

    if let Some((class, code)) = class_code {
        use git2::ErrorClass as C;
        use git2::ErrorCode as K;
        match (class, code) {
            (_, K::Auth) | (C::Http, _) if msg_lower.contains("401")
                || msg_lower.contains("authentication") =>
            {
                return YarrowError::AuthFailed(msg_lower);
            }
            (C::Net, _) | (C::Ssl, _) | (C::Os, _) => {
                return YarrowError::NetworkUnavailable(msg_lower);
            }
            _ => {}
        }
    }

    if msg_lower.contains("authentication required")
        || msg_lower.contains("invalid credentials")
        || msg_lower.contains("403 forbidden")
        || msg_lower.contains("401 unauthorized")
        || msg_lower.contains("bad credentials")
    {
        return YarrowError::AuthFailed(msg_lower);
    }
    if msg_lower.contains("could not resolve host")
        || msg_lower.contains("connection refused")
        || msg_lower.contains("connection reset")
        || msg_lower.contains("no route to host")
        || msg_lower.contains("network is unreachable")
        || msg_lower.contains("operation timed out")
        || msg_lower.contains("ssl handshake")
        || msg_lower.contains("tls handshake")
    {
        return YarrowError::NetworkUnavailable(msg_lower);
    }
    err
}
