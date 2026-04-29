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
    /// When set, this workspace talks to a yarrow-server instance for
    /// sync instead of (or in addition to) the generic `remote_url`
    /// above. The PAT itself never lives here — it's kept in the OS
    /// keychain under a workspace-scoped key. See `secrets.rs`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub server: Option<WorkspaceServerConfig>,
    /// Cached PAT for the server config, injected by `read_config` from
    /// the OS keychain on load. Never serialized. Frontend-visible only
    /// so the Settings panel can display "connected" state — the token
    /// itself is not sent back to the UI by any typed wrapper.
    #[serde(skip)]
    pub server_pat: Option<String>,
}

/// Per-workspace association with a yarrow-server. Each workspace can
/// independently connect to a different server (or none at all). The
/// `workspace_id` is populated on first sync — see the sync command.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceServerConfig {
    /// Root of the server, e.g. `https://yarrow.example.com`. No
    /// trailing slash.
    pub server_url: String,
    /// Email used as the HTTP Basic username on git calls against
    /// `/git/<workspace_id>.git`.
    pub email: String,
    /// PAT id returned by `POST /api/v1/tokens`. `None` when the user
    /// pasted a bare token (revocation UI is disabled in that case).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pat_id: Option<String>,
    /// Human label we gave the token on the server — handy for the
    /// "connected as …" summary row.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pat_label: Option<String>,
    /// Workspace uuid on the server. `None` before the first successful
    /// sync; that first sync either creates a fresh workspace on the
    /// server or adopts one the user named. `alias = "vault_id"` keeps
    /// pre-v0.3 saved configs readable (the field was called `vault_id`
    /// before the server-wide rename).
    #[serde(default, skip_serializing_if = "Option::is_none", alias = "vault_id")]
    pub workspace_id: Option<String>,
    /// Display name used when the first sync creates the workspace on
    /// the server. Falls back to the local workspace name if unset.
    /// `alias = "vault_name"` for pre-v0.3 saved-config compatibility.
    #[serde(default, skip_serializing_if = "Option::is_none", alias = "vault_name")]
    pub workspace_name: Option<String>,
    /// Development escape hatch: when true, all HTTP + git calls to
    /// this server skip certificate verification. Intended for local
    /// `https://localhost:8443` setups with self-signed certs — do
    /// NOT turn on for production servers.
    #[serde(default, skip_serializing_if = "is_false")]
    pub insecure_skip_tls_verify: bool,
}

fn is_false(b: &bool) -> bool {
    !*b
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
    /// Auto-sync cadence in minutes. `0` disables the interval; any
    /// positive value sets the periodic sync timer in the UI. Default
    /// is 5 minutes — balances fresh-on-the-server against the cost
    /// of an HTTP round-trip per interval. Only fires when a sync
    /// remote is configured (generic git OR `sync.server`).
    #[serde(default = "default_autosync")]
    pub autosync_minutes: u32,
    /// How many days a deleted note stays in `.yarrow/trash/` before the
    /// next workspace open auto-purges it. The consultant's §3.8 review
    /// flagged the user trust contract here: the empty-trash copy
    /// promises a 30-day window, and that promise needs to be backed by
    /// an actual purge. `0` keeps trash forever (matches the consultant's
    /// "configurable up to 'forever'" recommendation).
    #[serde(default = "default_trash_retention")]
    pub trash_retention_days: u32,
}

fn default_decay() -> u32 {
    60
}
fn default_debounce() -> u32 {
    8000
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
fn default_autosync() -> u32 {
    5 // minutes; 0 disables
}
fn default_trash_retention() -> u32 {
    30 // days; 0 = keep forever
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
            autosync_minutes: default_autosync(),
            trash_retention_days: default_trash_retention(),
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
.yarrow/drafts/
.yarrow/path-content/
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
    atomic_write_secret(&path, raw.as_bytes())?;
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
    let raw = std::fs::read_to_string(&path)?;
    let mut cfg: WorkspaceConfig = toml::from_str(&raw)
        .map_err(|e| YarrowError::Other(format!("parsing {}: {e}", path.display())))?;
    // 2.1: sync token is stored in the OS keychain when possible, with a
    // transparent fallback to the pre-existing `.yarrow/credentials.toml`
    // on systems where no keychain is available. See `secrets.rs`.
    cfg.sync.token = crate::secrets::read_sync_token(root).unwrap_or(None);
    // 2.2: per-workspace yarrow-server PAT. Lives in the same secret
    // store as the generic sync token but under a different key so they
    // don't collide — a workspace can have both configured.
    cfg.sync.server_pat = crate::secrets::read_server_pat(root).unwrap_or(None);

    // Diagnostic: catch the "forgotten auth after restart" class of
    // bugs loudly instead of silently shipping the UI into a
    // disconnected state. If the user previously connected (server
    // config is in config.toml) but the PAT is missing from both
    // keychain and credentials.toml, something ate the secret store —
    // surface it in logs so we can figure out what.
    let has_server = cfg.sync.server.is_some();
    let has_pat = cfg
        .sync
        .server_pat
        .as_deref()
        .map(|t| !t.is_empty())
        .unwrap_or(false);
    if has_server && !has_pat {
        eprintln!(
            "[yarrow] WARN: server config present at {} but PAT missing — user will need to reconnect. \
             Check .yarrow/credentials.toml + OS keychain for the `yarrow/server-pat:*` entry.",
            root.display()
        );
    }
    eprintln!(
        "[yarrow] read workspace config at {} (server={has_server} pat={has_pat})",
        root.display()
    );
    Ok(cfg)
}

pub fn write_config(root: &Path, config: &WorkspaceConfig) -> Result<()> {
    let path = config_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let raw = toml::to_string_pretty(config)?;

    // Atomic write: temp-file + rename. A partial write (disk-full,
    // power loss, OS kill mid-write) on the direct `fs::write` path
    // would leave a truncated config.toml with no [sync.server] block,
    // permanently forgetting the user's server connection on the next
    // open. Atomic swap via rename-on-same-filesystem means the caller
    // always observes either the old file or the complete new one.
    atomic_write(&path, raw.as_bytes())?;

    // IMPORTANT: do NOT auto-clear the keychain/file-backed secrets
    // when the in-memory config has `None` for token / server_pat.
    // These fields are `#[serde(skip)]` — any caller that obtains a
    // `WorkspaceConfig` from somewhere other than `read_config` (or
    // forgets to refresh the in-memory field before writing) would
    // silently wipe live credentials from disk every time the config
    // is saved. Preferences updates, sync-remote changes, and similar
    // side-effect writes would all destroy the stored PAT.
    //
    // Writes now only CARRY FORWARD a present value; explicit deletion
    // is the job of `clear_stored_secrets_on_disconnect` (called from
    // the disconnect command paths).
    if let Some(tok) = config.sync.token.as_deref() {
        if !tok.is_empty() {
            crate::secrets::write_sync_token(root, tok)?;
        }
    }
    if let Some(tok) = config.sync.server_pat.as_deref() {
        if !tok.is_empty() {
            crate::secrets::write_server_pat(root, tok)?;
        }
    }
    let has_server = config.sync.server.is_some();
    let has_pat = config
        .sync
        .server_pat
        .as_deref()
        .map(|t| !t.is_empty())
        .unwrap_or(false);
    eprintln!(
        "[yarrow] wrote workspace config at {} (server={has_server} pat={has_pat})",
        root.display()
    );
    Ok(())
}

/// Atomic file write: write to `<path>.tmp`, fsync, then rename over
/// the target. Crash-safe on the happy path for every filesystem that
/// guarantees rename atomicity within a directory (ext4, xfs, apfs,
/// ntfs). Yarrow's `.yarrow/` lives inside the workspace root, which
/// is always on one filesystem, so this is safe.
pub(crate) fn atomic_write(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    atomic_write_inner(path, contents, false)
}

/// Cap on a single `read_to_string` for user-uploaded / user-authored
/// files (templates, daily-template, BibTeX imports). Markdown notes
/// intentionally bypass this — those are already constrained by the
/// editor and any refusal here would silently break a workspace. Pick a
/// size larger than any plausible legitimate document but small enough
/// to bound a malicious or accidentally-huge file (e.g. a binary blob
/// dropped into `.bib`) before it eats all RAM.
pub const READ_TO_STRING_CAP: u64 = 16 * 1024 * 1024;

/// Read a file as UTF-8, refusing to allocate more than `READ_TO_STRING_CAP`
/// bytes. Surfaces a clean [`YarrowError::Invalid`] on overflow instead of
/// the OOM that bare `read_to_string` would produce on a hostile input.
pub(crate) fn read_to_string_capped(path: &Path) -> Result<String> {
    use std::io::Read;
    let f = std::fs::File::open(path)?;
    let meta = f.metadata()?;
    if meta.len() > READ_TO_STRING_CAP {
        return Err(YarrowError::Invalid(format!(
            "file is {} bytes — refused to read more than {} MiB",
            meta.len(),
            READ_TO_STRING_CAP / (1024 * 1024),
        )));
    }
    let mut s = String::new();
    f.take(READ_TO_STRING_CAP + 1).read_to_string(&mut s)?;
    if s.len() as u64 > READ_TO_STRING_CAP {
        return Err(YarrowError::Invalid(format!(
            "file exceeds {} MiB cap",
            READ_TO_STRING_CAP / (1024 * 1024),
        )));
    }
    Ok(s)
}

/// Like `atomic_write`, but on Unix opens the tmp file with mode 0600
/// from the start so the file is never world- or group-readable, even
/// for the brief window between create() and the rename. Used for
/// credentials.toml (server PAT, sync token) and security.toml
/// (encryption envelope). On Windows the call is identical to
/// `atomic_write` — NTFS ACLs on a per-user `%APPDATA%`/profile path
/// already restrict access to the owning user; tightening further
/// would mean a winapi DACL pass which we have not done here.
pub(crate) fn atomic_write_secret(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    atomic_write_inner(path, contents, true)
}

fn atomic_write_inner(path: &Path, contents: &[u8], secret: bool) -> std::io::Result<()> {
    use std::io::Write;
    let tmp = path.with_extension(format!(
        "{}.tmp",
        path.extension().and_then(|s| s.to_str()).unwrap_or("")
    ));
    {
        let mut opts = std::fs::OpenOptions::new();
        opts.write(true).create(true).truncate(true);
        #[cfg(unix)]
        if secret {
            use std::os::unix::fs::OpenOptionsExt;
            // 0600 — owner read/write, no group/other access. Must be set
            // at open() time, not via a follow-up chmod, to avoid a
            // window where the file is briefly created with the umask
            // default (typically 0644 on Linux) and readable by other
            // local users.
            opts.mode(0o600);
        }
        #[cfg(not(unix))]
        let _ = secret; // suppress unused-var warning on non-Unix
        let mut f = opts.open(&tmp)?;
        f.write_all(contents)?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp, path)?;
    // Power-loss durability: on POSIX, `rename(2)` updates the parent
    // directory inode's entries — a crash before that inode page is
    // flushed can roll the rename back even though the data file's
    // contents were already synced. Fsyncing the parent directory makes
    // the rename itself durable. On non-Unix this is a best-effort
    // no-op.
    if let Some(parent) = path.parent() {
        let _ = fsync_dir(parent);
    }
    Ok(())
}

/// fsync a directory so previously-issued renames / unlinks within it
/// are durable across power loss. Best-effort: directory fsync is the
/// standard POSIX durability primitive, but Windows and certain Linux
/// filesystems (e.g. some FUSE mounts) don't honor it. Errors are
/// swallowed at the call sites — durability is a hardening property,
/// not a correctness one.
#[cfg(unix)]
pub(crate) fn fsync_dir(dir: &Path) -> std::io::Result<()> {
    let f = std::fs::File::open(dir)?;
    f.sync_all()
}
#[cfg(not(unix))]
pub(crate) fn fsync_dir(_dir: &Path) -> std::io::Result<()> {
    Ok(())
}

/// Explicit clear path used by disconnect flows. Writes an empty
/// config (the caller's responsibility to prepare that) AND wipes the
/// keychain/file-backed secrets. This is the only code path that
/// actually deletes PATs from disk now.
pub fn clear_stored_secrets_on_disconnect(
    root: &Path,
    clear_generic_token: bool,
    clear_server_pat: bool,
) -> Result<()> {
    if clear_generic_token {
        let _ = crate::secrets::clear_sync_token(root);
    }
    if clear_server_pat {
        let _ = crate::secrets::clear_server_pat(root);
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
            // Seed the welcome note plus a companion note about
            // wikilinks. The welcome note links to the companion so
            // a fresh workspace shows a working `[[wikilink]]` and a
            // non-empty connections graph from minute one — the
            // consultant's §3.3 recommendation.
            write_seeded_starter_pair(root)?;
            config.mapping.main_note = Some("getting-started".into());
            write_config(root, &config)?;
        }
    } else {
        write_seeded_starter_pair(root)?;
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

/// Write the two-note starter pair (`getting-started.md` +
/// `wikilinks-explained.md`) to a fresh workspace. Both notes link to
/// each other so the user lands on a working wikilink example and a
/// non-trivial connections graph instead of an empty editor + isolated
/// node. Idempotent: callers gate on first-run.
fn write_seeded_starter_pair(root: &Path) -> Result<()> {
    let getting_started = notes_dir(root).join("getting-started.md");
    let wikilinks = notes_dir(root).join("wikilinks-explained.md");
    std::fs::write(&getting_started, crate::notes::seed_note_markdown())?;
    std::fs::write(&wikilinks, crate::notes::seed_companion_note_markdown())?;
    Ok(())
}

pub fn open(root: &Path) -> Result<WorkspaceConfig> {
    if !is_yarrow_workspace(root) {
        return Err(YarrowError::NoWorkspace);
    }
    // Back-fill default templates for workspaces created before 1.0.0 so the
    // palette's "New from template…" list is non-empty on first upgrade.
    let _ = crate::templates::seed_defaults(root);
    let cfg = read_config(root)?;
    // Honour the user's configured trash-retention window. The empty-trash
    // copy promises a default 30-day grace period; this is the worker that
    // backs that promise. `0` is the "keep forever" setting per §3.8 of the
    // consultant audit. Best-effort — a stalled purge shouldn't block open.
    let retention = cfg.preferences.trash_retention_days;
    if retention > 0 {
        let _ = crate::trash::purge_older_than(root, retention as i64);
    }
    // 3.0.2 cleanup: any path-content override whose canonical main is
    // encrypted is a leaked plaintext copy from a pre-3.0.2 build. The
    // IPC layer now refuses to write these, but the working tree still
    // holds whatever was already there. Sweep them on every open so the
    // bleed is staunched on first launch of 3.0.2 and stays staunched
    // even if a future code path regresses. Best-effort — a failure
    // here mustn't block opening the workspace.
    if let Ok(purged) = crate::path_content::purge_overrides_for_encrypted_main(root) {
        if purged > 0 {
            eprintln!(
                "yarrow: purged {} encrypted-note path overrides on workspace open",
                purged
            );
        }
    }
    Ok(cfg)
}
