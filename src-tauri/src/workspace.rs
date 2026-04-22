use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::error::{Result, YarrowError};
use crate::git;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct WorkspaceSection {
    pub name: String,
    pub created: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SyncSection {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_url: Option<String>,
    #[serde(default = "default_remote_type")]
    pub remote_type: String,
    /// Token is NEVER serialized into the shared config.toml — it's held only
    /// in memory after loading from the per-machine credentials file. We keep
    /// it on the struct for frontend convenience. See `read_credentials`.
    #[serde(skip)]
    pub token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
struct Credentials {
    #[serde(skip_serializing_if = "Option::is_none")]
    token: Option<String>,
}

fn default_remote_type() -> String {
    "custom".into()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preferences {
    #[serde(default = "default_decay")]
    pub decay_days: u32,
    #[serde(default = "default_debounce")]
    pub autocheckpoint_debounce_ms: u32,
    #[serde(default)]
    pub focus_mode_default: bool,
    #[serde(default = "default_true")]
    pub ask_thinking_on_close: bool,
    #[serde(default = "default_editor_font_size")]
    pub editor_font_size: u32,
    #[serde(default = "default_idle_lock")]
    pub encryption_idle_timeout_secs: u32,
    /// Whether to maintain the SQLite/FTS5 search cache in
    /// `.yarrow/index.db`. When off, search falls back to the pure
    /// substring scanner. Notes stay canonical either way.
    #[serde(default = "default_true")]
    pub search_index_enabled: bool,
}

fn default_decay() -> u32 {
    60
}
fn default_debounce() -> u32 {
    3000
}
fn default_true() -> bool {
    true
}
fn default_editor_font_size() -> u32 {
    16
}
fn default_idle_lock() -> u32 {
    900 // 15 minutes
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            decay_days: default_decay(),
            autocheckpoint_debounce_ms: default_debounce(),
            focus_mode_default: false,
            ask_thinking_on_close: true,
            editor_font_size: default_editor_font_size(),
            encryption_idle_timeout_secs: default_idle_lock(),
            search_index_enabled: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MappingSection {
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main_note: Option<String>,
}

fn default_mode() -> String {
    "mapped".into()
}

impl Default for MappingSection {
    fn default() -> Self {
        Self {
            mode: default_mode(),
            main_note: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceConfig {
    #[serde(default)]
    pub workspace: WorkspaceSection,
    #[serde(default)]
    pub sync: SyncSection,
    #[serde(default)]
    pub preferences: Preferences,
    #[serde(default)]
    pub mapping: MappingSection,
}

const YARROW_DIR: &str = ".yarrow";
const CONFIG_FILE: &str = "config.toml";
const CREDENTIALS_FILE: &str = "credentials.toml";
const SECURITY_FILE: &str = "security.toml";
const NOTES_DIR: &str = "notes";
const SCRATCHPAD_FILE: &str = "scratchpad.md";
const INDEX_FILE: &str = "index.json";
const GITIGNORE: &str = "\
# Yarrow derived/cache files and per-machine secrets — do not track
.yarrow/index.json
.yarrow/index.db
.yarrow/index.db-wal
.yarrow/index.db-shm
.yarrow/scratchpad.md
.yarrow/credentials.toml
.yarrow/trash/
.yarrow/session.json
";

pub fn yarrow_dir(root: &Path) -> PathBuf {
    root.join(YARROW_DIR)
}

pub fn config_path(root: &Path) -> PathBuf {
    yarrow_dir(root).join(CONFIG_FILE)
}

pub fn credentials_path(root: &Path) -> PathBuf {
    yarrow_dir(root).join(CREDENTIALS_FILE)
}

pub fn notes_dir(root: &Path) -> PathBuf {
    root.join(NOTES_DIR)
}

pub fn scratchpad_path(root: &Path) -> PathBuf {
    yarrow_dir(root).join(SCRATCHPAD_FILE)
}

/// Sidecar holding the `{ id, slug, oid, label, note, pinned_at }`
/// metadata for every keepsake pin. The authoritative protection is the
/// git ref at `refs/yarrow/keepsakes/<id>` — this file just lets the UI
/// list them without walking every ref on every open.
pub fn keepsakes_path(root: &Path) -> PathBuf {
    yarrow_dir(root).join("keepsakes.json")
}

pub fn security_path(root: &Path) -> PathBuf {
    yarrow_dir(root).join(SECURITY_FILE)
}

pub fn read_security(root: &Path) -> Result<Option<crate::crypto::WorkspaceEnvelope>> {
    let path = security_path(root);
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(path)?;
    let env: crate::crypto::WorkspaceEnvelope = toml::from_str(&raw)?;
    if env.enabled { Ok(Some(env)) } else { Ok(None) }
}

pub fn write_security(root: &Path, env: &crate::crypto::WorkspaceEnvelope) -> Result<()> {
    let path = security_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let raw = toml::to_string_pretty(env)?;
    std::fs::write(path, raw)?;
    Ok(())
}

pub fn clear_security(root: &Path) -> Result<()> {
    let path = security_path(root);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

pub fn templates_dir(root: &Path) -> PathBuf {
    yarrow_dir(root).join("templates")
}

pub fn daily_template_path(root: &Path) -> PathBuf {
    templates_dir(root).join("daily.md")
}

pub fn index_path(root: &Path) -> PathBuf {
    yarrow_dir(root).join(INDEX_FILE)
}

pub fn is_yarrow_workspace(root: &Path) -> bool {
    config_path(root).exists()
}

pub fn read_config(root: &Path) -> Result<WorkspaceConfig> {
    let path = config_path(root);
    if !path.exists() {
        return Err(YarrowError::NoWorkspace);
    }
    let raw = std::fs::read_to_string(path)?;
    let mut cfg: WorkspaceConfig = toml::from_str(&raw)?;
    // Tokens are stored separately and never committed to git.
    if let Ok(creds) = read_credentials(root) {
        cfg.sync.token = creds.token;
    }
    Ok(cfg)
}

pub fn write_config(root: &Path, config: &WorkspaceConfig) -> Result<()> {
    let path = config_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let raw = toml::to_string_pretty(config)?;
    std::fs::write(path, raw)?;
    write_credentials(
        root,
        &Credentials {
            token: config.sync.token.clone(),
        },
    )?;
    Ok(())
}

fn read_credentials(root: &Path) -> Result<Credentials> {
    let path = credentials_path(root);
    if !path.exists() {
        return Ok(Credentials::default());
    }
    let raw = std::fs::read_to_string(path)?;
    Ok(toml::from_str(&raw)?)
}

fn write_credentials(root: &Path, creds: &Credentials) -> Result<()> {
    let path = credentials_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if creds.token.is_some() {
        let raw = toml::to_string_pretty(creds)?;
        std::fs::write(path, raw)?;
    } else if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

/// Initialize a new Yarrow workspace at `root`.
///
/// `mode` is "mapped" (branch path mapping enabled, default) or "basic".
/// When `starting_note_title` is provided AND mode is mapped, a note with that
/// title is created and recorded as the workspace's `main_note`. Otherwise the
/// usual `getting-started.md` seed is written.
pub fn init(
    root: &Path,
    workspace_name: &str,
    mode: &str,
    starting_note_title: Option<&str>,
) -> Result<WorkspaceConfig> {
    std::fs::create_dir_all(root)?;

    let repo = git::init_workspace(root)?;

    let mapping = MappingSection {
        mode: if mode == "basic" { "basic".into() } else { "mapped".into() },
        ..MappingSection::default()
    };

    let config = WorkspaceConfig {
        workspace: WorkspaceSection {
            name: workspace_name.to_string(),
            created: Utc::now().to_rfc3339(),
        },
        sync: SyncSection::default(),
        preferences: Preferences::default(),
        mapping,
    };

    std::fs::create_dir_all(yarrow_dir(root))?;
    std::fs::create_dir_all(notes_dir(root))?;
    write_config(root, &config)?;
    std::fs::write(root.join(".gitignore"), GITIGNORE)?;

    let mut config = config;
    if config.mapping.mode == "mapped" {
        if let Some(title) = starting_note_title.map(|s| s.trim()).filter(|s| !s.is_empty()) {
            let note = crate::notes::create(root, title)?;
            config.mapping.main_note = Some(note.slug.clone());
            write_config(root, &config)?;
        } else {
            let seed = crate::notes::seed_note_markdown();
            let seed_path = notes_dir(root).join("getting-started.md");
            std::fs::write(&seed_path, seed)?;
            config.mapping.main_note = Some("getting-started".into());
            write_config(root, &config)?;
        }
    } else {
        let seed = crate::notes::seed_note_markdown();
        let seed_path = notes_dir(root).join("getting-started.md");
        std::fs::write(&seed_path, seed)?;
    }

    // Seed default templates (ignore errors — templates are a convenience).
    let _ = crate::templates::seed_defaults(root);

    // Initial checkpoint
    git::checkpoint(&repo, "checkpoint: workspace created")?;

    // If HEAD shorthand is not 'main', rename to 'main' for a friendlier default.
    if let Ok(name) = git::current_path_name(&repo) {
        if name != "main" {
            let _ = rename_current_to_main(&repo, &name);
        }
    }

    Ok(config)
}

fn rename_current_to_main(
    repo: &git2::Repository,
    current: &str,
) -> Result<()> {
    let mut branch = repo.find_branch(current, git2::BranchType::Local)?;
    branch.rename("main", false)?;
    repo.set_head("refs/heads/main")?;
    Ok(())
}

pub fn open(root: &Path) -> Result<WorkspaceConfig> {
    if !is_yarrow_workspace(root) {
        return Err(YarrowError::NoWorkspace);
    }
    // Back-fill default templates for workspaces created before 1.0.0 so the
    // palette's "New from template…" list is non-empty on first upgrade.
    let _ = crate::templates::seed_defaults(root);
    read_config(root)
}
