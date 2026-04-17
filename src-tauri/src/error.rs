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
    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, YarrowError>;

impl Serialize for YarrowError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<anyhow::Error> for YarrowError {
    fn from(e: anyhow::Error) -> Self {
        YarrowError::Other(e.to_string())
    }
}
