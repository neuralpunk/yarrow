//! Per-path metadata: the *condition* / question a path is asking.
//!
//! Yarrow paths are git branches, but branches are just names. The thing a
//! user actually cares about — *"What if the Seattle job comes through?"* —
//! has nowhere to live. This module stores that as a tracked TOML file:
//! `.yarrow/path-meta.toml`. Each branch that has a condition gets an entry.
//!
//! Because conditions travel with their branch, we read the file from the
//! *tip of each branch* (not just the working tree) when aggregating for the
//! Paths view. Writes go to the working tree on whatever branch is current,
//! and are committed on the next checkpoint.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::workspace::yarrow_dir;

const META_FILE: &str = "path-meta.toml";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PathMeta {
    /// The question this path is asking: "If the Seattle job comes through".
    /// Empty string means "not yet named" — we show a prompt to fill it in.
    #[serde(default)]
    pub condition: String,
    /// When the condition was set, epoch seconds. Optional.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub set_at: Option<i64>,
}

/// Wire format for the TOML file. A flat map keyed by branch name.
#[derive(Debug, Serialize, Deserialize, Default)]
struct MetaFile {
    #[serde(default)]
    paths: HashMap<String, PathMeta>,
}

pub fn meta_path(root: &Path) -> PathBuf {
    yarrow_dir(root).join(META_FILE)
}

/// Read the working-tree version of the meta file. Returns an empty map if
/// the file is missing or unparseable — a corrupt meta should never block
/// the Paths UI from rendering.
pub fn read_working(root: &Path) -> HashMap<String, PathMeta> {
    let path = meta_path(root);
    if !path.exists() {
        return HashMap::new();
    }
    match std::fs::read_to_string(&path) {
        Ok(raw) => match toml::from_str::<MetaFile>(&raw) {
            Ok(f) => f.paths,
            Err(_) => HashMap::new(),
        },
        Err(_) => HashMap::new(),
    }
}

/// Parse raw TOML bytes (e.g. fetched from another branch's tree).
pub fn parse_bytes(bytes: &[u8]) -> HashMap<String, PathMeta> {
    let raw = match std::str::from_utf8(bytes) {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };
    match toml::from_str::<MetaFile>(raw) {
        Ok(f) => f.paths,
        Err(_) => HashMap::new(),
    }
}

/// Write the working-tree meta file. Caller is responsible for triggering
/// the next checkpoint so the change lands in git.
pub fn write_working(root: &Path, paths: &HashMap<String, PathMeta>) -> Result<()> {
    let path = meta_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let file = MetaFile {
        paths: paths.clone(),
    };
    let raw = toml::to_string_pretty(&file)?;
    std::fs::write(&path, raw)?;
    Ok(())
}

/// Set (or clear) the condition for a branch. Passing an empty string clears
/// the entry. Writes the file in place; the caller checkpoints.
pub fn set_condition(root: &Path, branch: &str, condition: &str) -> Result<()> {
    let mut map = read_working(root);
    if condition.trim().is_empty() {
        map.remove(branch);
    } else {
        let now = chrono::Utc::now().timestamp();
        map.insert(
            branch.to_string(),
            PathMeta {
                condition: condition.trim().to_string(),
                set_at: Some(now),
            },
        );
    }
    write_working(root, &map)
}
