use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;

use tauri::State;

use base64::{engine::general_purpose::STANDARD, Engine as _};

use crate::app_config;
use crate::attachments;
use crate::crypto::{self, MasterKey};
use crate::error::{Result, YarrowError};
use crate::export;
use crate::git;
use crate::graph;
use crate::notes;
use crate::path_collections;
use crate::path_meta;
use crate::search;
use crate::templates;
use crate::workspace;
use zeroize::Zeroizing;

/// In-memory session state for a workspace's encryption. Nothing here is
/// persisted; everything is zeroed on lock / app quit.
pub struct Session {
    pub master_key: Option<MasterKey>,
    pub last_activity: Instant,
    /// Decrypted-body cache used by the history slider. Keyed by (slug, oid).
    /// Capped to keep memory bounded; zeroed on lock. Values are wrapped
    /// in `Zeroizing<String>` so the heap-allocated plaintext bytes are
    /// actively scrubbed when the cache is cleared — a bare `String`
    /// would only be dropped, leaving the bytes in place until the
    /// allocator reuses them.
    pub history_cache: HashMap<(String, String), Zeroizing<String>>,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            master_key: None,
            last_activity: Instant::now(),
            history_cache: HashMap::new(),
        }
    }
}

#[derive(Default)]
pub struct AppState {
    pub root: Mutex<Option<PathBuf>>,
    /// Serializes every git-index-touching operation (save → write → checkpoint
    /// → graph::build). Two in-flight saves otherwise interleave their index
    /// writes and corrupt the repo; callers hold this lock for the entire
    /// write+checkpoint+rebuild cycle.
    pub repo_lock: Mutex<()>,
    pub session: Mutex<Session>,
}

/// Recovers the inner value from a poisoned mutex. We prefer "best-effort keep
/// going" over "panic on every subsequent IPC call" — a poisoned `root` mutex
/// just means an earlier command panicked; the path itself is still valid.
fn unpoison<'a, T>(
    res: std::result::Result<std::sync::MutexGuard<'a, T>, std::sync::PoisonError<std::sync::MutexGuard<'a, T>>>,
) -> std::sync::MutexGuard<'a, T> {
    match res {
        Ok(g) => g,
        Err(poison) => poison.into_inner(),
    }
}

impl AppState {
    fn require_root(&self) -> Result<PathBuf> {
        unpoison(self.root.lock())
            .clone()
            .ok_or(YarrowError::NoWorkspace)
    }

    fn set_root(&self, p: PathBuf) {
        *unpoison(self.root.lock()) = Some(p);
        // New workspace = new session. Drop any prior key so a previously-
        // unlocked workspace doesn't bleed into the next.
        self.lock_session();
    }

    fn with_repo_locked<F, R>(&self, f: F) -> R
    where
        F: FnOnce() -> R,
    {
        let _guard = unpoison(self.repo_lock.lock());
        f()
    }

    /// Look at the session, enforcing idle timeout. Returns a cloned key if
    /// still unlocked; `None` if locked or timed out. A timeout triggers a
    /// zeroize in-place.
    pub fn current_key(&self, idle_secs: u32) -> Option<MasterKey> {
        let mut s = unpoison(self.session.lock());
        s.master_key.as_ref()?;
        if idle_secs > 0 && s.last_activity.elapsed().as_secs() > idle_secs as u64 {
            s.master_key = None;
            s.history_cache.clear();
            return None;
        }
        let key = s.master_key.as_ref().cloned();
        s.last_activity = Instant::now();
        key
    }

    pub fn touch_activity(&self) {
        let mut s = unpoison(self.session.lock());
        s.last_activity = Instant::now();
    }

    pub fn set_session_key(&self, key: MasterKey) {
        let mut s = unpoison(self.session.lock());
        s.master_key = Some(key);
        s.last_activity = Instant::now();
    }

    pub fn lock_session(&self) {
        let mut s = unpoison(self.session.lock());
        s.master_key = None;
        s.history_cache.clear();
    }

    pub fn is_unlocked(&self) -> bool {
        unpoison(self.session.lock()).master_key.is_some()
    }

    /// Look up a cached decrypted history body.
    pub fn history_cache_get(&self, slug: &str, oid: &str) -> Option<String> {
        unpoison(self.session.lock())
            .history_cache
            .get(&(slug.to_string(), oid.to_string()))
            .map(|z| (**z).clone())
    }

    /// Insert into the history cache, trimming oldest entries past 20/note.
    pub fn history_cache_put(&self, slug: &str, oid: &str, body: String) {
        let mut s = unpoison(self.session.lock());
        let entries_for_slug: usize = s
            .history_cache
            .keys()
            .filter(|(k_slug, _)| k_slug == slug)
            .count();
        if entries_for_slug >= 20 {
            // Drop one arbitrary entry for this slug — HashMap iteration is
            // unordered but "some old entry" is good enough here.
            if let Some(victim) = s
                .history_cache
                .keys()
                .find(|(k_slug, _)| k_slug == slug)
                .cloned()
            {
                s.history_cache.remove(&victim);
            }
        }
        s.history_cache.insert(
            (slug.to_string(), oid.to_string()),
            Zeroizing::new(body),
        );
    }
}

fn open_repo(root: &std::path::Path) -> Result<git2::Repository> {
    git::open(root)
}

/// Read the idle-lock timeout from the workspace config, defaulting to 15
/// minutes if the config can't be read.
fn idle_secs(root: &std::path::Path) -> u32 {
    workspace::read_config(root)
        .map(|c| c.preferences.encryption_idle_timeout_secs)
        .unwrap_or(900)
}

/// Try to fetch the session key, applying the workspace idle timeout. None
/// means "locked — the caller should refuse or return a locked sentinel."
fn maybe_key(state: &AppState, root: &std::path::Path) -> Option<MasterKey> {
    state.current_key(idle_secs(root))
}

fn require_key(state: &AppState, root: &std::path::Path) -> Result<MasterKey> {
    maybe_key(state, root).ok_or(YarrowError::LockedOut)
}

// ───────── workspace ─────────

#[tauri::command]
pub fn cmd_init_workspace(
    path: String,
    name: Option<String>,
    mode: Option<String>,
    starting_note_title: Option<String>,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    let root = PathBuf::from(path);
    let ws_name = name.unwrap_or_else(|| {
        root.file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "My Workspace".into())
    });
    let mode_ref = mode.as_deref().unwrap_or("mapped");
    let cfg = workspace::init(&root, &ws_name, mode_ref, starting_note_title.as_deref())?;
    let _ = app_config::remember(&root, &cfg.workspace.name);
    state.set_root(root);
    Ok(cfg)
}

#[tauri::command]
pub fn cmd_set_workspace_mode(
    mode: String,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    let root = state.require_root()?;
    let mut cfg = workspace::read_config(&root)?;
    cfg.mapping.mode = if mode == "basic" { "basic".into() } else { "mapped".into() };
    workspace::write_config(&root, &cfg)?;
    Ok(cfg)
}

#[tauri::command]
pub fn cmd_set_main_note(
    slug: Option<String>,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    let root = state.require_root()?;
    let mut cfg = workspace::read_config(&root)?;
    cfg.mapping.main_note = slug;
    workspace::write_config(&root, &cfg)?;
    Ok(cfg)
}

#[tauri::command]
pub fn cmd_open_workspace(
    path: String,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    let root = PathBuf::from(path);
    let cfg = workspace::open(&root)?;
    let _ = app_config::remember(&root, &cfg.workspace.name);
    state.set_root(root);
    Ok(cfg)
}

#[tauri::command]
pub fn cmd_list_recent_workspaces() -> Result<Vec<app_config::RecentWorkspace>> {
    Ok(app_config::list_recent())
}

#[tauri::command]
pub fn cmd_forget_recent_workspace(path: String) -> Result<()> {
    app_config::forget(std::path::Path::new(&path))
}

#[tauri::command]
pub fn cmd_active_workspace(state: State<AppState>) -> Option<String> {
    state
        .root
        .lock()
        .unwrap()
        .as_ref()
        .and_then(|p| p.to_str().map(|s| s.to_string()))
}

#[tauri::command]
pub fn cmd_close_workspace(state: State<AppState>) {
    *state.root.lock().unwrap() = None;
}

#[tauri::command]
pub fn cmd_read_config(state: State<AppState>) -> Result<workspace::WorkspaceConfig> {
    let root = state.require_root()?;
    workspace::read_config(&root)
}

#[tauri::command]
pub fn cmd_set_remote(
    url: String,
    remote_type: String,
    token: Option<String>,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    let root = state.require_root()?;
    let mut cfg = workspace::read_config(&root)?;
    cfg.sync.remote_url = Some(url.clone());
    cfg.sync.remote_type = remote_type;
    cfg.sync.token = token;
    workspace::write_config(&root, &cfg)?;
    let repo = open_repo(&root)?;
    git::set_remote(&repo, "origin", &url)?;
    Ok(cfg)
}

#[tauri::command]
pub fn cmd_update_preferences(
    prefs: workspace::Preferences,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    let root = state.require_root()?;
    let mut cfg = workspace::read_config(&root)?;
    cfg.preferences = prefs;
    workspace::write_config(&root, &cfg)?;
    Ok(cfg)
}

#[tauri::command]
pub fn cmd_update_workspace_name(
    name: String,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    let root = state.require_root()?;
    let mut cfg = workspace::read_config(&root)?;
    cfg.workspace.name = name.clone();
    workspace::write_config(&root, &cfg)?;
    let _ = app_config::remember(&root, &name);
    Ok(cfg)
}

// ───────── notes ─────────

#[tauri::command]
pub fn cmd_list_notes(state: State<AppState>) -> Result<Vec<notes::NoteSummary>> {
    let root = state.require_root()?;
    notes::list(&root)
}

#[tauri::command]
pub fn cmd_read_note(slug: String, state: State<AppState>) -> Result<notes::Note> {
    let root = state.require_root()?;
    let key = maybe_key(&state, &root);
    notes::read_with_key(&root, &slug, key.as_ref())
}

#[tauri::command]
pub fn cmd_save_note(
    slug: String,
    body: String,
    thinking_note: Option<String>,
    state: State<AppState>,
) -> Result<notes::Note> {
    let root = state.require_root()?;
    // Figure out whether this note is encrypted before locking the repo so
    // we can surface a clean "locked" error without touching git state.
    let existing = notes::read_with_key(&root, &slug, None).ok();
    let is_encrypted = existing.as_ref().map(|n| n.encrypted).unwrap_or(false);
    let key = if is_encrypted {
        Some(require_key(&state, &root)?)
    } else {
        // Still touch activity so unrelated saves don't trip the idle lock
        // while the user is actively writing.
        state.touch_activity();
        None
    };
    state.with_repo_locked(|| -> Result<notes::Note> {
        let (note, changed) =
            notes::write_with_key_status(&root, &slug, &body, None, key.as_ref())?;
        // No-op save (body unchanged, frontmatter untouched): skip the
        // checkpoint *and* the graph rebuild. Previously we'd still call
        // both, which — on a ~1k-note workspace with frequent redundant
        // autosave fires from CodeMirror — added ~50 ms of unnecessary
        // work per keystroke pause.
        if !changed {
            return Ok(note);
        }
        let repo = open_repo(&root)?;
        let title = if note.frontmatter.title.is_empty() {
            note.slug.clone()
        } else {
            note.frontmatter.title.clone()
        };
        let mut message = format!("checkpoint: {}", title);
        if let Some(t) = thinking_note.as_ref().filter(|s| !s.trim().is_empty()) {
            message.push_str("\n\n");
            message.push_str(t.trim());
        }
        git::checkpoint(&repo, &message)?;
        let _ = graph::build(&root);
        Ok(note)
    })
}

#[tauri::command]
pub fn cmd_create_note(title: String, state: State<AppState>) -> Result<notes::Note> {
    let root = state.require_root()?;
    let note = notes::create(&root, &title)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: new note \"{}\"", title))?;
    let _ = graph::build(&root);
    Ok(note)
}

#[tauri::command]
pub fn cmd_rename_note(
    old_slug: String,
    new_title: String,
    state: State<AppState>,
) -> Result<notes::Note> {
    let root = state.require_root()?;
    let note = notes::rename(&root, &old_slug, &new_title)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: rename to \"{}\"", new_title))?;
    let _ = graph::build(&root);
    Ok(note)
}

#[tauri::command]
pub fn cmd_set_pinned(
    slug: String,
    pinned: bool,
    state: State<AppState>,
) -> Result<notes::Note> {
    let root = state.require_root()?;
    let mut note = notes::read(&root, &slug)?;
    if note.frontmatter.pinned == pinned {
        return Ok(note);
    }
    note.frontmatter.pinned = pinned;
    let saved = notes::write(&root, &slug, &note.body, Some(note.frontmatter))?;
    let repo = open_repo(&root)?;
    let verb = if pinned { "pin" } else { "unpin" };
    git::checkpoint(&repo, &format!("checkpoint: {} \"{}\"", verb, slug))?;
    Ok(saved)
}

#[tauri::command]
pub fn cmd_note_absolute_path(slug: String, state: State<AppState>) -> Result<String> {
    let root = state.require_root()?;
    let path = notes::note_path(&root, &slug);
    path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| YarrowError::Other("note path not utf-8".into()))
}

#[tauri::command]
pub fn cmd_delete_note(slug: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    notes::delete(&root, &slug)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: delete \"{}\"", slug))?;
    let _ = graph::build(&root);
    Ok(())
}

// ───────── encryption ─────────

#[derive(serde::Serialize, Clone)]
pub struct EncryptionStatus {
    pub enabled: bool,
    pub unlocked: bool,
    pub idle_timeout_secs: u32,
}

#[tauri::command]
pub fn cmd_encryption_status(state: State<AppState>) -> Result<EncryptionStatus> {
    let root = state.require_root()?;
    let enabled = workspace::read_security(&root)?.is_some();
    // Touch idle-check: if session has expired, current_key will clear it.
    let _ = state.current_key(idle_secs(&root));
    Ok(EncryptionStatus {
        enabled,
        unlocked: state.is_unlocked(),
        idle_timeout_secs: idle_secs(&root),
    })
}

#[derive(serde::Serialize)]
pub struct EnableEncryptionOutcome {
    pub recovery_phrase: String,
}

#[tauri::command]
pub fn cmd_enable_encryption(
    password: String,
    state: State<AppState>,
) -> Result<EnableEncryptionOutcome> {
    let root = state.require_root()?;
    if workspace::read_security(&root)?.is_some() {
        return Err(YarrowError::EncryptionAlreadyEnabled);
    }
    if password.len() < 8 {
        return Err(YarrowError::Invalid(
            "password must be at least 8 characters".into(),
        ));
    }
    let (env, master, phrase) = crypto::WorkspaceEnvelope::create(&password)?;
    workspace::write_security(&root, &env)?;
    state.set_session_key(master);
    Ok(EnableEncryptionOutcome { recovery_phrase: phrase })
}

#[tauri::command]
pub fn cmd_unlock_encryption(
    password: String,
    state: State<AppState>,
) -> Result<EncryptionStatus> {
    let root = state.require_root()?;
    let env = workspace::read_security(&root)?
        .ok_or(YarrowError::EncryptionDisabled)?;
    let master = env.unlock_with_password(&password)?;
    state.set_session_key(master);
    Ok(EncryptionStatus {
        enabled: true,
        unlocked: true,
        idle_timeout_secs: idle_secs(&root),
    })
}

#[tauri::command]
pub fn cmd_recover_encryption(
    phrase: String,
    new_password: String,
    state: State<AppState>,
) -> Result<EncryptionStatus> {
    let root = state.require_root()?;
    let mut env = workspace::read_security(&root)?
        .ok_or(YarrowError::EncryptionDisabled)?;
    if new_password.len() < 8 {
        return Err(YarrowError::Invalid(
            "password must be at least 8 characters".into(),
        ));
    }
    let master = env.unlock_with_recovery(&phrase)?;
    env.rewrap_password(&master, &new_password)?;
    workspace::write_security(&root, &env)?;
    state.set_session_key(master);
    Ok(EncryptionStatus {
        enabled: true,
        unlocked: true,
        idle_timeout_secs: idle_secs(&root),
    })
}

#[tauri::command]
pub fn cmd_lock_encryption(state: State<AppState>) -> Result<()> {
    state.lock_session();
    Ok(())
}

#[tauri::command]
pub fn cmd_activity_ping(state: State<AppState>) -> Result<bool> {
    let root = state.require_root()?;
    // Returns true if the session is still alive after idle check.
    Ok(state.current_key(idle_secs(&root)).is_some())
}

#[tauri::command]
pub fn cmd_change_encryption_password(
    old_password: String,
    new_password: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    let mut env = workspace::read_security(&root)?
        .ok_or(YarrowError::EncryptionDisabled)?;
    let master = env.unlock_with_password(&old_password)?;
    if new_password.len() < 8 {
        return Err(YarrowError::Invalid(
            "password must be at least 8 characters".into(),
        ));
    }
    env.rewrap_password(&master, &new_password)?;
    workspace::write_security(&root, &env)?;
    Ok(())
}

#[tauri::command]
pub fn cmd_regenerate_recovery_phrase(
    password: String,
    state: State<AppState>,
) -> Result<EnableEncryptionOutcome> {
    let root = state.require_root()?;
    let mut env = workspace::read_security(&root)?
        .ok_or(YarrowError::EncryptionDisabled)?;
    let master = env.unlock_with_password(&password)?;
    let phrase = env.rewrap_recovery(&master)?;
    workspace::write_security(&root, &env)?;
    Ok(EnableEncryptionOutcome { recovery_phrase: phrase })
}

/// Turn encryption off for the workspace: decrypts every encrypted note,
/// then removes `.yarrow/security.toml` and zeroes the session.
#[tauri::command]
pub fn cmd_disable_encryption(password: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    let env = workspace::read_security(&root)?
        .ok_or(YarrowError::EncryptionDisabled)?;
    let master = env.unlock_with_password(&password)?;

    state.with_repo_locked(|| -> Result<()> {
        // Walk every encrypted note and rewrite it as plaintext.
        for summary in notes::list(&root)? {
            if !summary.encrypted { continue; }
            let _ = notes::decrypt_note(&root, &summary.slug, &master);
        }
        workspace::clear_security(&root)?;
        state.lock_session();
        let repo = open_repo(&root)?;
        let _ = git::checkpoint(&repo, "checkpoint: disable encryption");
        let _ = graph::build(&root);
        Ok(())
    })
}

#[tauri::command]
pub fn cmd_encrypt_note(slug: String, state: State<AppState>) -> Result<notes::Note> {
    let root = state.require_root()?;
    let key = require_key(&state, &root)?;
    state.with_repo_locked(|| -> Result<notes::Note> {
        let note = notes::encrypt_note(&root, &slug, &key)?;
        let repo = open_repo(&root)?;
        git::checkpoint(&repo, &format!("checkpoint: encrypt \"{}\"", slug))?;

        // Seal past versions. Every historical commit on every branch that
        // still holds the plaintext blob gets its blob replaced with a
        // fresh-nonce ciphertext version (same master key). Without this,
        // `git log -p notes/foo.md` on the workspace folder would recover
        // everything the user wrote before hitting "Encrypt".
        let relpath = notes::relative_note_path(&slug);
        let root_for_transform = root.clone();
        let key_for_transform = key.clone();
        let seal_result = git::rewrite_file_history(
            &repo,
            std::path::Path::new(&relpath),
            |bytes| notes::seal_file_bytes(&root_for_transform, bytes, &key_for_transform),
        );
        if let Err(e) = seal_result {
            // We don't want a failed rewrite to silently leave plaintext in
            // history. Surface it as a command error so the frontend can
            // show a clear toast instead of a misleading "encrypted" check.
            return Err(crate::error::YarrowError::Other(format!(
                "encrypted the note but failed to seal its past versions: {}. \
                 The plaintext is still in .git history — consider running \
                 `git log -p` to audit, or restore from a backup.",
                e
            )));
        }
        // Reflogs and unreachable loose objects are the other two recovery
        // paths. Drop reflogs outright (we never surface them to users) and
        // ask `git gc` to prune loose objects best-effort.
        let _ = git::clear_reflogs(&repo);
        let _ = git::gc_unreachable(&repo);

        let _ = graph::build(&root);
        Ok(note)
    })
}

#[tauri::command]
pub fn cmd_decrypt_note(slug: String, state: State<AppState>) -> Result<notes::Note> {
    let root = state.require_root()?;
    let key = require_key(&state, &root)?;
    state.with_repo_locked(|| -> Result<notes::Note> {
        let note = notes::decrypt_note(&root, &slug, &key)?;
        let repo = open_repo(&root)?;
        git::checkpoint(&repo, &format!("checkpoint: decrypt \"{}\"", slug))?;
        let _ = graph::build(&root);
        Ok(note)
    })
}

// ───────── templates ─────────

#[tauri::command]
pub fn cmd_list_templates(state: State<AppState>) -> Result<Vec<templates::TemplateInfo>> {
    let root = state.require_root()?;
    templates::list(&root)
}

#[tauri::command]
pub fn cmd_read_template(name: String, state: State<AppState>) -> Result<String> {
    let root = state.require_root()?;
    templates::read(&root, &name)
}

#[tauri::command]
pub fn cmd_write_template(
    name: String,
    content: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    templates::write(&root, &name, &content)
}

#[tauri::command]
pub fn cmd_delete_template(name: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    templates::delete(&root, &name)
}

#[tauri::command]
pub fn cmd_create_from_template(
    template: String,
    title: String,
    state: State<AppState>,
) -> Result<notes::Note> {
    let root = state.require_root()?;
    let tpl = templates::read(&root, &template)?;
    let body = templates::render(&tpl, &title);
    let note = notes::create(&root, &title)?;
    let saved = notes::write(&root, &note.slug, &body, Some(note.frontmatter))?;
    let repo = open_repo(&root)?;
    git::checkpoint(
        &repo,
        &format!("checkpoint: new note \"{}\" from template {}", title, template),
    )?;
    let _ = graph::build(&root);
    Ok(saved)
}

// ───────── attachments ─────────

#[tauri::command]
pub fn cmd_attach_bytes(
    name: String,
    data_base64: String,
    state: State<AppState>,
) -> Result<attachments::AttachmentRef> {
    let root = state.require_root()?;
    // Base64 is ~4/3 bigger than the raw bytes. Reject before decoding so a
    // 1 GB paste can't hit the allocator even once.
    let max_b64 = attachments::MAX_ATTACHMENT_BYTES
        .saturating_mul(4)
        .saturating_div(3)
        .saturating_add(128);
    if data_base64.len() > max_b64 {
        return Err(YarrowError::Invalid(format!(
            "attachment too large — limit is {} MB",
            attachments::MAX_ATTACHMENT_BYTES / (1024 * 1024),
        )));
    }
    let bytes = STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|e| YarrowError::Invalid(format!("base64 decode: {}", e)))?;
    let r = attachments::attach_bytes(&root, &name, &bytes)?;
    // Checkpoint the new file so it ships over sync.
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: attach {}", name))?;
    Ok(r)
}

#[tauri::command]
pub fn cmd_attach_from_path(
    source: String,
    state: State<AppState>,
) -> Result<attachments::AttachmentRef> {
    let root = state.require_root()?;
    let r = attachments::attach_from_path(&root, std::path::Path::new(&source))?;
    let repo = open_repo(&root)?;
    let name = std::path::Path::new(&source)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("attachment");
    git::checkpoint(&repo, &format!("checkpoint: attach {}", name))?;
    Ok(r)
}

#[tauri::command]
pub fn cmd_read_attachment(
    relpath: String,
    state: State<AppState>,
) -> Result<attachments::AttachmentData> {
    let root = state.require_root()?;
    attachments::read_attachment(&root, &relpath)
}

// ───────── static-site export ─────────

#[tauri::command]
pub fn cmd_export_static(
    dest: String,
    state: State<AppState>,
) -> Result<export::ExportReport> {
    let root = state.require_root()?;
    let dest_path = std::path::PathBuf::from(&dest);
    export::run(&root, &dest_path)
}

// ───────── daily notes ─────────

#[derive(serde::Serialize)]
pub struct DailyOpenOutcome {
    pub note: notes::Note,
    /// Name of the path we auto-switched away from (None if we were already
    /// on main). The UI uses this to surface a gentle notice so the user
    /// understands why their path changed.
    pub switched_from: Option<String>,
}

#[tauri::command]
pub fn cmd_open_daily(date_iso: String, state: State<AppState>) -> Result<DailyOpenOutcome> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;

    // Journal is always on main — switch there first if needed.
    let before = git::current_path_name(&repo).ok();
    let switched_from = match before {
        Some(name) if name != "main" => {
            git::switch_path(&repo, "main")?;
            Some(name)
        }
        _ => None,
    };

    let created_now = !notes::note_path(&root, &notes::daily_slug(&date_iso)).exists();
    let note = notes::ensure_daily(&root, &date_iso)?;

    if created_now {
        // Only checkpoint on first creation — avoid empty-diff commits for
        // existing entries the user is merely opening.
        git::checkpoint(
            &repo,
            &format!("checkpoint: open journal for {}", date_iso),
        )?;
        let _ = graph::build(&root);
    }

    Ok(DailyOpenOutcome { note, switched_from })
}

#[tauri::command]
pub fn cmd_list_daily(
    limit: Option<usize>,
    state: State<AppState>,
) -> Result<Vec<notes::NoteSummary>> {
    let root = state.require_root()?;
    notes::list_daily(&root, limit)
}

#[tauri::command]
pub fn cmd_list_daily_dates(state: State<AppState>) -> Result<Vec<String>> {
    let root = state.require_root()?;
    notes::list_daily_dates(&root)
}

#[tauri::command]
pub fn cmd_read_daily_template(state: State<AppState>) -> Result<String> {
    let root = state.require_root()?;
    notes::read_daily_template(&root)
}

#[tauri::command]
pub fn cmd_write_daily_template(content: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    notes::write_daily_template(&root, &content)
}

// ───────── links ─────────

#[tauri::command]
pub fn cmd_add_link(
    from: String,
    to: String,
    link_type: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    notes::add_link(&root, &from, &to, &link_type)?;
    let repo = open_repo(&root)?;
    git::checkpoint(
        &repo,
        &format!("checkpoint: connect {} → {} ({})", from, to, link_type),
    )?;
    let _ = graph::build(&root);
    Ok(())
}

#[tauri::command]
pub fn cmd_remove_link(from: String, to: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    notes::remove_link(&root, &from, &to)?;
    let repo = open_repo(&root)?;
    git::checkpoint(
        &repo,
        &format!("checkpoint: disconnect {} → {}", from, to),
    )?;
    let _ = graph::build(&root);
    Ok(())
}

// ───────── paths (branches) ─────────

#[tauri::command]
pub fn cmd_list_paths(state: State<AppState>) -> Result<Vec<git::PathInfo>> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::list_paths(&repo)
}

#[tauri::command]
pub fn cmd_current_path(state: State<AppState>) -> Result<String> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::current_path_name(&repo)
}

#[tauri::command]
pub fn cmd_create_path(
    name: String,
    condition: Option<String>,
    from: Option<String>,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    // If the caller specified a parent branch, switch there first so the
    // new branch forks from the intended point — not from whatever HEAD
    // happens to be. This matters for "branch from main" even when the
    // user is currently sitting on an unrelated sub-path.
    if let Some(parent) = from.as_deref() {
        let current = git::current_path_name(&repo).ok();
        if current.as_deref() != Some(parent) {
            git::switch_path(&repo, parent)?;
        }
    }
    let branch = git::create_path_named(&repo, &name)?;
    if let Some(c) = condition {
        let trimmed = c.trim();
        if !trimmed.is_empty() {
            path_meta::set_condition(&root, &branch, trimmed)?;
            let msg = format!("name this path: {}", trimmed);
            let _ = git::checkpoint(&repo, &msg);
        }
    }
    Ok(())
}

/// Read the condition map across all branches. Each local branch's own copy
/// of `.yarrow/path-meta.toml` is parsed from its tip, and we union all
/// entries so the Paths view can show every branch's question regardless of
/// which branch is currently checked out.
#[tauri::command]
pub fn cmd_list_path_meta(
    state: State<AppState>,
) -> Result<HashMap<String, path_meta::PathMeta>> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    let mut out: HashMap<String, path_meta::PathMeta> = HashMap::new();

    // Start with the working-tree version — captures uncommitted edits on
    // the current branch before we overlay branch-tip versions.
    for (k, v) in path_meta::read_working(&root) {
        out.insert(k, v);
    }

    // Then union in each branch's tip version. A newer (larger set_at) wins
    // so switching back to main and opening Paths doesn't lose an edit made
    // from another branch.
    let topo = git::branch_topology(&repo)?;
    for t in &topo {
        if let Some(bytes) = git::read_file_at_branch(&repo, &t.name, ".yarrow/path-meta.toml") {
            let map = path_meta::parse_bytes(&bytes);
            for (k, v) in map {
                match out.get(&k) {
                    Some(existing) if existing.set_at >= v.set_at => {}
                    _ => {
                        out.insert(k, v);
                    }
                }
            }
        }
    }

    Ok(out)
}

/// Toggle whether a note "applies" to a path. `present = true` means "this
/// note should exist on that path"; we copy its content from the *current*
/// branch's tip (the user's source of truth) and commit to the target
/// branch. `present = false` removes it from that branch. The working tree
/// is never touched, so the user's current edits are safe.
#[tauri::command]
pub fn cmd_set_note_on_path(
    branch: String,
    slug: String,
    present: bool,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    let relpath = notes::relative_note_path(&slug);

    if present {
        // Source the content from whichever branch the user is currently on.
        let current = git::current_path_name(&repo)?;
        let bytes = git::read_file_at_branch(&repo, &current, &relpath)
            .ok_or_else(|| YarrowError::Other(format!(
                "Can't copy '{}' — it doesn't exist on your current path.",
                slug
            )))?;
        let msg = format!("add note to this path: {}", slug);
        git::branch_commit_file_change(&repo, &branch, &relpath, Some(&bytes), &msg)?;
    } else {
        let msg = format!("remove note from this path: {}", slug);
        git::branch_commit_file_change(&repo, &branch, &relpath, None, &msg)?;
    }
    Ok(())
}

#[tauri::command]
pub fn cmd_set_path_condition(
    branch: String,
    condition: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    path_meta::set_condition(&root, &branch, &condition)?;
    let msg = if condition.trim().is_empty() {
        "unname this path".to_string()
    } else {
        format!("name this path: {}", condition.trim())
    };
    let _ = git::checkpoint(&repo, &msg);
    Ok(())
}

#[tauri::command]
pub fn cmd_switch_path(name: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::switch_path(&repo, &name)
}

#[tauri::command]
pub fn cmd_delete_path(name: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::delete_path(&repo, &name)
}

#[tauri::command]
pub fn cmd_merge_path(from: String, state: State<AppState>) -> Result<git::MergeOutcome> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::merge_into_current(&repo, &from)
}

// ───────── path collections (v2 paths model) ─────────
//
// v2 paths are collections of notes, not git branches. Git branches stay
// for sync/history/checkpoints; the paths UI uses these commands.

#[tauri::command]
pub fn cmd_list_path_collections(
    state: State<AppState>,
) -> Result<path_collections::CollectionsView> {
    let root = state.require_root()?;
    path_collections::read_all(&root)
}

#[tauri::command]
pub fn cmd_create_path_collection(
    name: String,
    condition: String,
    parent: String,
    main_note: Option<String>,
    state: State<AppState>,
) -> Result<path_collections::PathCollection> {
    let root = state.require_root()?;
    path_collections::create(&root, &name, &condition, &parent, main_note.as_deref())
}

#[tauri::command]
pub fn cmd_delete_path_collection(name: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    path_collections::delete(&root, &name)
}

#[tauri::command]
pub fn cmd_rename_path_collection(
    old_name: String,
    new_name: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    path_collections::rename(&root, &old_name, &new_name)
}

#[tauri::command]
pub fn cmd_set_path_collection_condition(
    name: String,
    condition: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    path_collections::set_condition(&root, &name, &condition)
}

#[tauri::command]
pub fn cmd_set_path_collection_main_note(
    name: String,
    slug: Option<String>,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    path_collections::set_main_note(&root, &name, slug.as_deref())
}

#[tauri::command]
pub fn cmd_set_path_collection_parent(
    name: String,
    parent: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    path_collections::set_parent(&root, &name, &parent)
}

#[tauri::command]
pub fn cmd_add_note_to_path_collection(
    name: String,
    slug: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    path_collections::add_member(&root, &name, &slug)
}

#[tauri::command]
pub fn cmd_remove_note_from_path_collection(
    name: String,
    slug: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    path_collections::remove_member(&root, &name, &slug)
}

#[tauri::command]
pub fn cmd_set_path_collection_root(name: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    path_collections::set_root(&root, &name)
}

// ───────── graph ─────────

#[tauri::command]
pub fn cmd_get_graph(state: State<AppState>) -> Result<graph::Graph> {
    let root = state.require_root()?;
    graph::build(&root)
}

#[tauri::command]
pub fn cmd_orphans(state: State<AppState>) -> Result<Vec<String>> {
    let root = state.require_root()?;
    let g = graph::build(&root)?;
    Ok(graph::orphan_slugs(&g))
}

// ───────── history ─────────

#[tauri::command]
pub fn cmd_note_history(
    slug: String,
    state: State<AppState>,
) -> Result<Vec<git::HistoryEntry>> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::note_history(&repo, &notes::relative_note_path(&slug))
}

#[tauri::command]
pub fn cmd_note_at_checkpoint(
    slug: String,
    oid: String,
    state: State<AppState>,
) -> Result<String> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    let oid_val = git2::Oid::from_str(&oid).map_err(|e| YarrowError::Invalid(e.to_string()))?;
    let raw = git::note_at_checkpoint(&repo, &notes::relative_note_path(&slug), oid_val)?;

    // If this historical snapshot is encrypted, decrypt the body in-place so
    // the history slider shows plaintext. Requires an unlocked session. We
    // cache the decrypted body for the (slug, oid) pair; cleared on lock.
    if let Some((fm, body)) = split_raw_frontmatter(&raw) {
        if fm_encrypted(&fm) {
            if let Some(cached) = state.history_cache_get(&slug, &oid) {
                return Ok(rebuild_raw_with_body(&fm, &cached));
            }
            let key = require_key(&state, &root)?;
            let nonce_b64 = fm_field(&fm, "nonce").ok_or_else(|| {
                YarrowError::Crypto("historical note missing nonce".into())
            })?;
            let nonce = crypto::decode_note_nonce(&nonce_b64)?;
            let ct = crypto::decode_bytes(body.trim())?;
            let env = crypto::BodyEnvelope { nonce, ciphertext: ct };
            let plaintext = env.open(&key)?;
            state.history_cache_put(&slug, &oid, plaintext.clone());
            return Ok(rebuild_raw_with_body(&fm, &plaintext));
        }
    }
    Ok(raw)
}

/// Split a raw note file into (frontmatter-block, body). Returns None when
/// the file has no `---` frontmatter delimiter.
fn split_raw_frontmatter(raw: &str) -> Option<(String, String)> {
    let rest = raw.strip_prefix("---\n")?;
    let end = rest.find("\n---\n")?;
    let fm = rest[..end].to_string();
    let body = rest[end + 5..].to_string();
    Some((fm, body))
}

fn fm_encrypted(fm: &str) -> bool {
    fm.lines()
        .any(|l| l.trim_start().starts_with("encrypted:") && l.contains("true"))
}

fn fm_field(fm: &str, key: &str) -> Option<String> {
    for l in fm.lines() {
        let t = l.trim_start();
        if let Some(rest) = t.strip_prefix(&format!("{}:", key)) {
            return Some(
                rest.trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string(),
            );
        }
    }
    None
}

fn rebuild_raw_with_body(fm: &str, body: &str) -> String {
    let mut out = String::from("---\n");
    out.push_str(fm);
    if !fm.ends_with('\n') { out.push('\n'); }
    out.push_str("---\n");
    out.push_str(body);
    out
}

#[tauri::command]
pub fn cmd_restore_note(slug: String, oid: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    let oid = git2::Oid::from_str(&oid).map_err(|e| YarrowError::Invalid(e.to_string()))?;
    git::restore_note(&repo, &root, &notes::relative_note_path(&slug), oid)
}

#[tauri::command]
pub fn cmd_paragraph_provenance(
    slug: String,
    line: u32,
    state: State<AppState>,
) -> Result<git::Provenance> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::paragraph_provenance(&repo, &notes::relative_note_path(&slug), line)
}

// ───────── history pruning ─────────

#[tauri::command]
pub fn cmd_prune_history_older_than(
    days: u32,
    state: State<AppState>,
) -> Result<git::PruneReport> {
    let root = state.require_root()?;
    state.with_repo_locked(|| -> Result<git::PruneReport> {
        let repo = open_repo(&root)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let cutoff = now - (days as i64) * 86400;
        let report = git::prune_older_than(&repo, cutoff)?;
        let _ = git::clear_reflogs(&repo);
        let _ = git::gc_unreachable(&repo);
        Ok(report)
    })
}

#[tauri::command]
pub fn cmd_prune_empty_checkpoints(state: State<AppState>) -> Result<git::PruneReport> {
    let root = state.require_root()?;
    state.with_repo_locked(|| -> Result<git::PruneReport> {
        let repo = open_repo(&root)?;
        let report = git::prune_empty_content(&repo)?;
        let _ = git::clear_reflogs(&repo);
        let _ = git::gc_unreachable(&repo);
        Ok(report)
    })
}

// ───────── sync ─────────

#[tauri::command]
pub fn cmd_sync(state: State<AppState>) -> Result<git::SyncOutcome> {
    let root = state.require_root()?;
    let cfg = workspace::read_config(&root)?;
    if cfg.sync.remote_url.is_none() {
        return Err(YarrowError::NoRemote);
    }
    let repo = open_repo(&root)?;
    git::sync(&repo, "origin", cfg.sync.token.as_deref())
}

// ───────── path diffing ─────────

#[derive(serde::Serialize)]
pub struct PathNoteSnapshot {
    pub slug: String,
    pub body: String,
}

#[tauri::command]
pub fn cmd_notes_on_path(
    path_name: String,
    state: State<AppState>,
) -> Result<Vec<PathNoteSnapshot>> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    let items = git::notes_on_path(&repo, &path_name)?;
    Ok(items
        .into_iter()
        .map(|(slug, body)| PathNoteSnapshot { slug, body })
        .collect())
}

// ───────── path export ─────────

#[tauri::command]
pub fn cmd_export_path_markdown(
    path_name: String,
    dest: String,
    state: State<AppState>,
) -> Result<export::ExportReport> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    let dest_path = PathBuf::from(dest);
    export::export_path_markdown(&repo, &root, &path_name, &dest_path)
}

// ───────── scratchpad ─────────

#[tauri::command]
pub fn cmd_read_scratchpad(state: State<AppState>) -> Result<String> {
    let root = state.require_root()?;
    notes::read_scratchpad(&root)
}

#[tauri::command]
pub fn cmd_save_scratchpad(content: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    notes::write_scratchpad(&root, &content)
}

#[tauri::command]
pub fn cmd_append_scratchpad(entry: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    notes::append_scratchpad(&root, &entry)
}

#[tauri::command]
pub fn cmd_promote_scratchpad(
    title: String,
    state: State<AppState>,
) -> Result<notes::Note> {
    let root = state.require_root()?;
    let content = notes::read_scratchpad(&root)?;
    let note = notes::create(&root, &title)?;
    let _final = notes::write(&root, &note.slug, &content, Some(note.frontmatter.clone()))?;
    notes::clear_scratchpad(&root)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: keep scratchpad as \"{}\"", title))?;
    let _ = graph::build(&root);
    Ok(_final)
}

// ───────── search ─────────

#[tauri::command]
pub fn cmd_search(
    query: String,
    limit: Option<usize>,
    state: State<AppState>,
) -> Result<Vec<search::SearchHit>> {
    let root = state.require_root()?;
    search::search(&root, &query, limit.unwrap_or(25))
}

// ───────── branch topology ─────────

#[tauri::command]
pub fn cmd_branch_topology(state: State<AppState>) -> Result<Vec<git::BranchTopo>> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::branch_topology(&repo)
}

// ───────── merge state / conflicts ─────────

#[tauri::command]
pub fn cmd_merge_state(state: State<AppState>) -> Result<bool> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    Ok(git::is_merging(&repo))
}

#[tauri::command]
pub fn cmd_list_conflicts(state: State<AppState>) -> Result<Vec<String>> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::list_conflicts(&repo)
}

#[tauri::command]
pub fn cmd_get_conflict(
    relpath: String,
    state: State<AppState>,
) -> Result<git::ConflictContent> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::get_conflict_content(&repo, &root, &relpath)
}

#[tauri::command]
pub fn cmd_resolve_conflict(
    relpath: String,
    content: String,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::resolve_conflict(&repo, &root, &relpath, &content)
}

#[tauri::command]
pub fn cmd_finalize_merge(
    thinking: Option<String>,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::finalize_merge(&repo, thinking.as_deref())?;
    let _ = graph::build(&root);
    Ok(())
}

#[tauri::command]
pub fn cmd_abort_merge(state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::abort_merge(&repo)
}
