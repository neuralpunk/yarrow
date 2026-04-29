use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;

use tauri::{AppHandle, State};

use base64::{engine::general_purpose::STANDARD, Engine as _};

use crate::app_config;
use crate::attachments;
use crate::bibliography;
use crate::crypto::{self, MasterKey};
use crate::drafts;
use crate::error::{Result, YarrowError};
use crate::export;
use crate::find_replace;
use crate::foreign_import;
use crate::fuzzy;
use crate::git;
use crate::graph;
use crate::notes;
use crate::obsidian_import;
use crate::path_collections;
use crate::path_content;
use crate::path_meta;
use crate::recipe_clip;
use crate::sample_vault;
use crate::search;
use crate::search_index;
use crate::shopping_list;
use crate::templates;
use crate::trash;
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
    /// E2E (spec §8.1 option 3). Derived from the user's password at
    /// connect time via argon2id + AEAD. Used to unwrap workspace
    /// DEKs locally before each sync so the desktop can POST the
    /// unwrapped DEK to /workspaces/:id/unlock — the server no
    /// longer has a copy of our private key. Zeroed on disconnect,
    /// sign-out, or app quit.
    pub server_privkey: Option<Zeroizing<[u8; 32]>>,
    pub server_pubkey: Option<[u8; 32]>,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            master_key: None,
            last_activity: Instant::now(),
            history_cache: HashMap::new(),
            server_privkey: None,
            server_pubkey: None,
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
    /// Cached `notes::scan()` result for the active workspace. The save-
    /// pipeline previously re-read every note file on every checkpoint —
    /// at 1k notes that's ~1k disk reads + 1k YAML parses per debounced
    /// save, which dominated the typing-pause stall. With the cache the
    /// save path only re-reads the one slug that changed and patches it
    /// into the cached vec in-place, so the per-save cost is constant
    /// regardless of workspace size. Invalidated on workspace switch and
    /// on every command that mutates files outside the per-note save
    /// path (sync, merge, restore, import, rename, delete).
    pub scan_cache: Mutex<Option<(PathBuf, Vec<notes::ScannedNote>)>>,
    /// Background WebSocket listener for `/ws` push notifications from the
    /// currently-connected yarrow-server. One task per active workspace-
    /// with-server-config; swapped in/out from `cmd_open_workspace`,
    /// `cmd_server_connect_*`, `cmd_server_disconnect`, `cmd_close_workspace`.
    pub ws: crate::ws_client::Manager,
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
        // …and dump the cached scan — the next save will rebuild it for
        // the new workspace.
        self.scan_cache_invalidate();
    }

    /// Drop the cached scan. Call from any command that mutates files
    /// outside the save pipeline (sync pull, merge, restore, import,
    /// rename, delete). Cheap — the next save path repopulates it.
    pub fn scan_cache_invalidate(&self) {
        *unpoison(self.scan_cache.lock()) = None;
    }

    /// Hand the save pipeline a fresh `Vec<ScannedNote>` reflecting disk
    /// state. The caller passes the slug that just changed; the helper
    /// re-reads that one file, patches it into the cached scan (or
    /// builds the cache on first call), and returns a clone of the
    /// updated vec for graph + summary derivation. `None` for `slug`
    /// just primes/refreshes the cache without applying a delta.
    pub fn scan_cache_apply_save(
        &self,
        root: &std::path::Path,
        slug: Option<&str>,
    ) -> Result<Vec<notes::ScannedNote>> {
        self.scan_cache_with(root, slug, |scanned| scanned.to_vec())
    }

    /// Like [`scan_cache_apply_save`] but hands the cached `&[ScannedNote]`
    /// to a callback under the lock, returning whatever the callback
    /// produces. Lets callers compute summaries / graphs / membership
    /// maps without first cloning every note's body — which on a vault
    /// with megabytes of prose was the dominant cost of every save.
    pub fn scan_cache_with<R>(
        &self,
        root: &std::path::Path,
        slug: Option<&str>,
        f: impl FnOnce(&[notes::ScannedNote]) -> R,
    ) -> Result<R> {
        let mut cache = unpoison(self.scan_cache.lock());
        // Build the cache on first call, or rebuild it when the active
        // workspace path changed without a `set_root` going through
        // (defensive — every code path that sets root also invalidates).
        let needs_build = match cache.as_ref() {
            Some((cached_root, _)) if cached_root == root => false,
            _ => true,
        };
        if needs_build {
            *cache = Some((root.to_path_buf(), notes::scan(root)?));
        }
        let cached = cache.as_mut().expect("cache populated above");
        if let Some(slug) = slug {
            match notes::scan_one(root, slug)? {
                Some(entry) => {
                    if let Some(pos) = cached.1.iter().position(|s| s.slug == slug) {
                        cached.1[pos] = entry;
                    } else {
                        cached.1.push(entry);
                    }
                }
                None => cached.1.retain(|s| s.slug != slug),
            }
        }
        Ok(f(&cached.1))
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
    ///
    /// **Side-effect:** on a successful return this resets `last_activity`
    /// to now — the call counts as activity. Use [`peek_key`] for
    /// queries that should NOT extend the session (e.g. the periodic
    /// heartbeat from `cmd_activity_ping` — without the peek variant
    /// the heartbeat itself keeps the workspace forever-unlocked while
    /// the app is open).
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

    /// Like [`current_key`] but does NOT touch `last_activity`. Used by
    /// the background heartbeat so polling for liveness doesn't extend
    /// the session. Still triggers the timeout-zeroize on expiry — the
    /// heartbeat is the natural place for the lazy clear to fire.
    pub fn peek_key(&self, idle_secs: u32) -> Option<MasterKey> {
        let mut s = unpoison(self.session.lock());
        s.master_key.as_ref()?;
        if idle_secs > 0 && s.last_activity.elapsed().as_secs() > idle_secs as u64 {
            s.master_key = None;
            s.history_cache.clear();
            return None;
        }
        s.master_key.as_ref().cloned()
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

    /// Install the user's E2E server privkey + pubkey, derived locally
    /// from the password by `server::exchange_password_for_pat`. Used
    /// by `cmd_sync` to unwrap workspace DEKs before each sync run.
    pub fn set_server_identity(&self, priv_bytes: [u8; 32], pub_bytes: [u8; 32]) {
        let mut s = unpoison(self.session.lock());
        s.server_privkey = Some(Zeroizing::new(priv_bytes));
        s.server_pubkey = Some(pub_bytes);
    }

    /// Snapshot the installed server identity for use in a sync call.
    /// Returns `None` when the user hasn't connected in E2E mode yet
    /// (or has signed out of the server).
    pub fn server_identity(&self) -> Option<([u8; 32], [u8; 32])> {
        let s = unpoison(self.session.lock());
        let priv_b = s.server_privkey.as_ref()?;
        let pub_b = s.server_pubkey?;
        Some((**priv_b, pub_b))
    }

    pub fn forget_server_identity(&self) {
        let mut s = unpoison(self.session.lock());
        s.server_privkey = None;
        s.server_pubkey = None;
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

/// (Re)start or stop the background WebSocket listener for the workspace
/// at `root`. Reads the workspace's stored server config + PAT and hands
/// them to `ws_client::Manager::restart`; if no server is configured the
/// manager is told to stop. Safe to call from any command that mutates
/// the sync config — picking up every transition keeps the listener
/// single-sourced off the persisted config rather than ad-hoc per-caller.
fn sync_ws_listener(app: &AppHandle, state: &AppState, root: &std::path::Path) {
    let cfg = match workspace::read_config(root) {
        Ok(c) => c,
        Err(_) => {
            state.ws.stop();
            return;
        }
    };
    match (cfg.sync.server.as_ref(), cfg.sync.server_pat.as_ref()) {
        (Some(server), Some(pat)) => {
            state.ws.restart(
                server.server_url.clone(),
                server.email.clone(),
                pat.clone(),
                server.insecure_skip_tls_verify,
                app.clone(),
            );
        }
        _ => state.ws.stop(),
    }
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

/// Create a new workspace populated with the starter vault (~8 connected
/// notes + a secondary path). Wraps `workspace::init` + `sample_vault::seed`
/// behind a single call so the Onboarding screen can offer a "Try a sample"
/// button without choreographing two steps.
#[tauri::command]
pub fn cmd_init_sample_workspace(
    path: String,
    name: Option<String>,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    let root = PathBuf::from(&path);
    let ws_name = name.unwrap_or_else(|| {
        root.file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Sample vault".into())
    });
    let _report = sample_vault::bootstrap(&root, &ws_name)?;
    // Initial checkpoint so the sample content is git-tracked from the
    // first open, not ambient working-tree state.
    let repo = open_repo(&root)?;
    let _ = git::checkpoint(&repo, "checkpoint: seeded sample vault");
    let _ = graph::build(&root);
    let cfg = workspace::read_config(&root)?;
    let _ = app_config::remember(&root, &cfg.workspace.name);
    state.set_root(root);
    Ok(cfg)
}

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

/// 3.0 — clone an existing Yarrow workspace from a remote git URL into
/// `<parent>/<name>`. Mirrors `cmd_init_workspace` for the wizard's
/// "I already have one" path. The destination must not exist; if it
/// does, we error out so we never write into a folder the user might
/// already be using for something else.
///
/// Post-clone the cloned tree is validated by `git::is_yarrow_workspace`
/// — it must contain `.yarrow/config.toml`, the canonical workspace
/// marker. This is the gate the user asked for: it stops people from
/// accidentally cloning random repos and ending up with a broken
/// "workspace" full of unrelated code or third-party docs. On a
/// validation failure (or any clone error) we wipe the cloned dir so
/// no half-state lingers on disk.
#[tauri::command]
pub fn cmd_clone_workspace(
    parent: String,
    name: String,
    url: String,
    state: State<AppState>,
    app: AppHandle,
) -> Result<workspace::WorkspaceConfig> {
    // Reuse the same name-sanitization rules as `cmd_create_workspace_dir`.
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(YarrowError::Invalid("workspace name is required".into()));
    }
    if trimmed == "." || trimmed == ".." {
        return Err(YarrowError::Invalid(
            "workspace name can't be \".\" or \"..\" — pick a real name".into(),
        ));
    }
    if trimmed.chars().any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err(YarrowError::Invalid(
            "workspace name can't contain slashes or special filesystem characters".into(),
        ));
    }
    if trimmed.contains('\0') {
        return Err(YarrowError::Invalid(
            "workspace name can't contain a NUL byte".into(),
        ));
    }
    let url_trimmed = url.trim();
    if url_trimmed.is_empty() {
        return Err(YarrowError::Invalid("a git URL is required".into()));
    }
    // Scheme allowlist — protect users from being tricked into cloning
    // through `file://` (which would let a crafted URL hand back any
    // local path's contents) or unencrypted `http://` / `git://` /
    // `ftp://` (downgrade attacks). Permit only the forms we actually
    // support: HTTPS for hosted repos, SSH (`ssh://` URL or the
    // shorthand `git@host:path`) for keypair auth.
    let lower = url_trimmed.to_ascii_lowercase();
    let scheme_ok = lower.starts_with("https://")
        || lower.starts_with("ssh://")
        || (url_trimmed.contains('@') && url_trimmed.contains(':') && !lower.contains("://"));
    if !scheme_ok {
        return Err(YarrowError::Invalid(
            "Yarrow only clones from https:// or ssh:// URLs (or the git@host:path shorthand). \
             Other schemes — including file://, http://, git://, ftp:// — aren't allowed."
                .into(),
        ));
    }

    let parent_path = std::path::PathBuf::from(&parent);
    if !parent_path.is_dir() {
        return Err(YarrowError::Invalid(format!(
            "“{}” doesn't look like a real folder — pick a different location",
            parent_path.display(),
        )));
    }
    let target = parent_path.join(trimmed);
    if target.exists() {
        return Err(YarrowError::Invalid(format!(
            "“{}” already exists — pick a different name or remove it first",
            target.display(),
        )));
    }

    // Clone. Any failure (network, auth, bad URL) leaves no folder behind
    // because libgit2 only creates the dest on success path setup, but
    // some failure modes do leave a partial dir, so we sweep on error.
    let cloned = git::clone_workspace(url_trimmed, &target);
    if let Err(e) = cloned {
        let _ = std::fs::remove_dir_all(&target);
        return Err(e);
    }
    drop(cloned); // we don't need the Repository handle directly

    // Gate: the cloned tree must look like a real Yarrow workspace.
    // Reject anything else and clean up so we never leave a non-yarrow
    // checkout sitting under the user's workspaces root.
    if !git::is_yarrow_workspace(&target) {
        let _ = std::fs::remove_dir_all(&target);
        return Err(YarrowError::Invalid(
            "that repository doesn't look like a Yarrow workspace (no .yarrow/config.toml). \
             Make sure you cloned the right URL — only repositories created by Yarrow can be opened here."
                .into(),
        ));
    }

    // Open it the same way `cmd_open_workspace` does so the rest of
    // the app (recents list, sync listener, AppState root) sees it as
    // a normal opened workspace.
    let cfg = workspace::open(&target)?;
    let _ = app_config::remember(&target, &cfg.workspace.name);
    state.set_root(target.clone());
    sync_ws_listener(&app, &state, &target);
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
    if let Some(s) = slug.as_deref() {
        notes::validate_slug(s)?;
    }
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
    app: AppHandle,
) -> Result<workspace::WorkspaceConfig> {
    let root = PathBuf::from(path);
    let cfg = workspace::open(&root)?;
    let _ = app_config::remember(&root, &cfg.workspace.name);
    state.set_root(root.clone());
    // Start the WS listener if this workspace is already connected to a
    // server. Without this a user who quits + reopens Yarrow would miss
    // every `workspace.updated` event until they manually synced.
    sync_ws_listener(&app, &state, &root);
    Ok(cfg)
}

#[tauri::command]
pub fn cmd_list_recent_workspaces() -> Result<Vec<app_config::RecentWorkspace>> {
    Ok(app_config::list_recent())
}

/// Welcome-screen stats: notes-this-month, day-streak, words-this-month,
/// plus the most-recently-modified note across every recent workspace
/// for the "Continue" line. Computed fresh on every IntroPage mount so
/// the user sees current numbers (the per-launch snapshot model the
/// welcome-screen-enhancement spec calls for; see `welcome.rs`).
#[tauri::command]
pub fn cmd_welcome_stats() -> Result<crate::welcome::WelcomeStats> {
    Ok(crate::welcome::compute())
}

#[tauri::command]
pub fn cmd_forget_recent_workspace(path: String) -> Result<()> {
    app_config::forget(std::path::Path::new(&path))
}

/// Rename a recent (non-active) workspace from the IntroPage context
/// menu. Updates both the workspace's `config.toml` (so the next open
/// reflects the new name) and the global `app.toml` recent entry (so
/// the IntroPage list updates without a reload).
#[tauri::command]
pub fn cmd_rename_recent_workspace(path: String, name: String) -> Result<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(YarrowError::Invalid("Workspace name can't be blank.".into()));
    }
    let root = std::path::Path::new(&path);
    if !root.is_dir() {
        return Err(YarrowError::Invalid(
            "That folder no longer exists. Remove it from the list and add it again.".into(),
        ));
    }
    let mut cfg = workspace::read_config(root)?;
    cfg.workspace.name = trimmed.to_string();
    workspace::write_config(root, &cfg)?;
    app_config::update_name(root, trimmed)?;
    Ok(())
}

#[tauri::command]
pub fn cmd_active_workspace(state: State<AppState>) -> Option<String> {
    // `unpoison` (not bare `.unwrap()`) — if an earlier command panicked
    // inside a mutex-guarded region, the poisoned state is still a valid
    // workspace path. Panicking here on every IPC call would take the
    // whole app down instead of letting the user close and reopen.
    unpoison(state.root.lock())
        .as_ref()
        .and_then(|p| p.to_str().map(|s| s.to_string()))
}

#[tauri::command]
pub fn cmd_close_workspace(state: State<AppState>) {
    // Tear down the listener first — leaving it alive would keep firing
    // Tauri events into a frontend that's no longer mounting a workspace
    // view.
    state.ws.stop();
    // Same rationale as `cmd_active_workspace` — closing the workspace
    // is the recovery path a user reaches for *after* something has
    // gone wrong. It must never itself panic due to an inherited
    // poisoned mutex.
    *unpoison(state.root.lock()) = None;
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
    let token_is_absent = token.as_deref().map_or(true, |t| t.is_empty());
    cfg.sync.token = token;
    workspace::write_config(&root, &cfg)?;
    // This command is the user-facing "change my sync config" entry;
    // an empty/null token means "I want no token stored." write_config
    // no longer auto-wipes secrets, so clear explicitly here.
    if token_is_absent {
        let _ = workspace::clear_stored_secrets_on_disconnect(&root, true, false);
    }
    let repo = open_repo(&root)?;
    git::set_remote(&repo, "origin", &url)?;
    Ok(cfg)
}

// ───────── yarrow-server connect ─────────
//
// These commands wrap `server.rs` + the secrets/ config round-trip.
// They never write the PAT to `config.toml` — it lives in the OS
// keychain via `secrets::write_server_pat`.

fn token_label(root: &std::path::Path, cfg: &workspace::WorkspaceConfig) -> String {
    // "<hostname>-<workspace_name>" — matches the label shape the
    // integration spec recommends.
    let host = hostname();
    let name = if cfg.workspace.name.trim().is_empty() {
        root.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("yarrow")
            .to_string()
    } else {
        cfg.workspace.name.clone()
    };
    format!("{host}-{name}")
}

fn hostname() -> String {
    // `hostname` pulled without a crate — fall back gracefully.
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "yarrow-desktop".into())
}

#[tauri::command]
pub fn cmd_server_connect_password(
    server_url: String,
    email: String,
    password: String,
    workspace_name: Option<String>,
    insecure_skip_tls_verify: Option<bool>,
    state: State<AppState>,
    app: AppHandle,
) -> Result<workspace::WorkspaceConfig> {
    let root = state.require_root()?;
    let mut cfg = workspace::read_config(&root)?;
    let server_url = crate::server::normalize_server_url(&server_url)?;
    let insecure = insecure_skip_tls_verify.unwrap_or(false);
    let label = token_label(&root, &cfg);
    let outcome = crate::server::exchange_password_for_pat(
        &server_url, &email, &password, &label, insecure,
    )?;
    // E2E: stash the derived privkey in AppState so subsequent sync
    // runs can unwrap workspace DEKs locally without asking the user
    // for their password again. Lives until disconnect / app quit.
    // Older servers without envelope fields return (None, None) here;
    // in that case sync will fail loudly with "server too old."
    //
    // Also persist to the OS keychain so app restart can re-install
    // without a password prompt. Keychain-only — never touches the
    // on-disk credentials file.
    if let (Some(priv_b), Some(pub_b)) = (outcome.server_privkey, outcome.server_pubkey) {
        state.set_server_identity(priv_b, pub_b);
        if let Err(e) = crate::secrets::write_server_privkey(&root, &priv_b, &pub_b) {
            eprintln!("[yarrow] WARN: couldn't cache server privkey in keychain — next launch will re-prompt ({e})");
        }
    }
    // Password goes out of scope here — Rust's `String` drop doesn't
    // zero memory, but we've at least stopped referencing it. Anything
    // stronger would require zeroize-wrapping the IPC arg, which isn't
    // worth the ergonomic cost given PAT + session cookie bytes live
    // briefly on the heap too.
    drop(password);
    cfg.sync.server = Some(workspace::WorkspaceServerConfig {
        server_url,
        email,
        pat_id: Some(outcome.pat_id),
        pat_label: Some(outcome.pat_label),
        workspace_id: None,
        workspace_name,
        insecure_skip_tls_verify: insecure,
    });
    cfg.sync.server_pat = Some(outcome.token);
    workspace::write_config(&root, &cfg)?;
    // Fire up the live-update channel now that we have a valid PAT on
    // file — without this the user stays in manual-sync-only land until
    // they restart the app.
    sync_ws_listener(&app, &state, &root);
    Ok(cfg)
}

#[tauri::command]
pub fn cmd_server_connect_token(
    server_url: String,
    email: String,
    token: String,
    // E2E (spec §8.1 option 3): the paste-a-token path only provides
    // auth material, not the password-derived KEK needed to unwrap
    // the user's private key. To use this path for sync against an
    // E2E server, the user must ALSO provide their password — we
    // use it locally to derive the privkey via /me's envelope fields,
    // then throw the password away. The server never sees it (PAT is
    // used for /me auth). `None` = legacy pre-E2E server OR user
    // is OK with sync being broken until they hit password flow.
    password: Option<String>,
    workspace_name: Option<String>,
    insecure_skip_tls_verify: Option<bool>,
    state: State<AppState>,
    app: AppHandle,
) -> Result<workspace::WorkspaceConfig> {
    let root = state.require_root()?;
    let mut cfg = workspace::read_config(&root)?;
    let server_url = crate::server::normalize_server_url(&server_url)?;
    let insecure = insecure_skip_tls_verify.unwrap_or(false);
    // Pasted-token path: verify the credential makes it past the git
    // basic-auth wall *before* persisting anything, so we don't store
    // a clearly-broken PAT.
    crate::server::test_pat(&server_url, &email, &token, insecure)?;

    // If the user handed us their password, derive the E2E privkey
    // right now and stash it — matches what password-path does after
    // /auth/login. Without this the workspace would be unsyncable
    // even though the token itself works for auth.
    if let Some(pw) = password.as_deref() {
        if !pw.is_empty() {
            match crate::server::derive_server_privkey_via_me(
                &server_url, &email, &token, pw, insecure,
            ) {
                Ok(Some((priv_b, pub_b))) => {
                    state.set_server_identity(priv_b, pub_b);
                    if let Err(e) = crate::secrets::write_server_privkey(&root, &priv_b, &pub_b)
                    {
                        eprintln!(
                            "[yarrow] WARN: couldn't cache server privkey in keychain \
                             after token+password connect — next launch will re-prompt ({e})"
                        );
                    }
                }
                Ok(None) => {
                    // /me didn't include envelope — server is likely
                    // pre-E2E. Persist anyway; sync will surface the
                    // mismatch with a clearer error than this path can.
                    eprintln!(
                        "[yarrow] WARN: server returned no envelope material on /me; \
                         E2E unlock will fail on next sync — upgrade the server"
                    );
                }
                Err(e) => {
                    return Err(YarrowError::Other(format!(
                        "Token accepted, but deriving your workspace key locally failed: {e}. \
                         Double-check your password."
                    )));
                }
            }
        }
    }
    // Password never stored. Consumed in memory only.
    drop(password);

    cfg.sync.server = Some(workspace::WorkspaceServerConfig {
        server_url,
        email,
        pat_id: None,
        pat_label: None,
        workspace_id: None,
        workspace_name,
        insecure_skip_tls_verify: insecure,
    });
    cfg.sync.server_pat = Some(token);
    workspace::write_config(&root, &cfg)?;
    sync_ws_listener(&app, &state, &root);
    Ok(cfg)
}

#[tauri::command]
pub fn cmd_server_test_connection(
    server_url: String,
    email: String,
    token: String,
    insecure_skip_tls_verify: Option<bool>,
) -> Result<()> {
    crate::server::test_pat(
        &server_url,
        &email,
        &token,
        insecure_skip_tls_verify.unwrap_or(false),
    )
}

#[tauri::command]
pub fn cmd_server_disconnect(
    revoke_on_server: bool,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    // Stop the listener up front — the rest of this command blocks on a
    // network revoke call that could take several seconds, and we don't
    // want `workspace.updated` events continuing to flow in the middle
    // of tearing down the config.
    state.ws.stop();
    let root = state.require_root()?;
    let mut cfg = workspace::read_config(&root)?;
    let mut revoke_error: Option<String> = None;
    if revoke_on_server {
        if let (Some(server), Some(pat)) = (cfg.sync.server.as_ref(), cfg.sync.server_pat.as_ref()) {
            if let Some(pat_id) = server.pat_id.as_deref() {
                if let Err(e) = crate::server::revoke_pat(
                    &server.server_url,
                    &server.email,
                    pat,
                    pat_id,
                    server.insecure_skip_tls_verify,
                ) {
                    // Surface the problem but still clear local state —
                    // leaving the UI stuck in "connected" when the
                    // server is unreachable is worse than failing soft.
                    revoke_error = Some(e.to_string());
                }
            }
        }
    }
    cfg.sync.server = None;
    cfg.sync.server_pat = None;
    workspace::write_config(&root, &cfg)?;
    // write_config no longer auto-clears secrets (preferences changes
    // and other routine writes used to wipe the PAT by accident).
    // Disconnect is the explicit intent here, so clean up the
    // keychain + credentials.toml directly.
    let _ = workspace::clear_stored_secrets_on_disconnect(&root, false, true);
    // E2E: drop the cached privkey from AppState AND from the OS
    // keychain. Without this, "disconnect" leaves the key material
    // behind — next reconnect would silently restore the old identity
    // even if the user meant to start fresh.
    state.forget_server_identity();
    let _ = crate::secrets::clear_server_privkey(&root);
    if let Some(msg) = revoke_error {
        // The local state is already cleared; hand the message back
        // so the UI can nudge the user to finish revocation on the
        // web. Config reflects the disconnected state.
        return Err(YarrowError::Other(format!(
            "Disconnected locally, but revoking on the server didn't succeed: {msg}"
        )));
    }
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
    notes::validate_slug(&slug)?;
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
    notes::validate_slug(&slug)?;
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
        // Route note saves through the 15-min amend window so a real
        // writing session produces 5–20 checkpoints per note, not 400.
        // The slug is the affinity key — only saves of the SAME note
        // amend the previous checkpoint.
        git::checkpoint_or_amend(&repo, &message, &note.slug)?;
        // Refresh the cached scan for this slug so the (now-rebuilt)
        // graph and any subsequent save see the same on-disk state we
        // just wrote.
        let _ = state.scan_cache_apply_save(&root, Some(&note.slug));
        let _ = graph::build(&root);
        Ok(note)
    })
}

/// Disk-only save. Writes the markdown body to the .md file with no
/// git checkpoint and no graph rebuild. The frontend fires this on a
/// short timer (~300 ms after the last keystroke) so the file on disk
/// is always within a few hundred ms of what the user is seeing in the
/// editor — even when the user-configurable git-checkpoint debounce
/// is set to several minutes. Pairs with `cmd_save_note` / `cmd_save_note_full`,
/// which still own the slow checkpoint+graph path on the longer timer.
#[tauri::command]
pub fn cmd_quicksave_note(
    slug: String,
    body: String,
    state: State<AppState>,
) -> Result<()> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let existing = notes::read_with_key(&root, &slug, None).ok();
    let is_encrypted = existing.as_ref().map(|n| n.encrypted).unwrap_or(false);
    let key = if is_encrypted {
        Some(require_key(&state, &root)?)
    } else {
        state.touch_activity();
        None
    };
    state.with_repo_locked(|| -> Result<()> {
        notes::write_with_key_status(&root, &slug, &body, None, key.as_ref())?;
        // Keep the scan cache fresh for the slug we just wrote so the
        // next checkpoint-debounced `cmd_save_note_full` doesn't have
        // to fall back to a full directory rescan. The file was just
        // written so it's still in OS cache; this re-read is ~50µs.
        let _ = state.scan_cache_apply_save(&root, Some(&slug));
        Ok(())
    })
}

/// Combined save: writes the note, rebuilds the graph from the same scan,
/// and returns the workspace summaries, graph, and orphan slugs in one IPC.
/// Replaces the four-IPC fan-out (`save_note` + `list_notes` + `get_graph`
/// + `orphans`) the frontend previously made after every keystroke pause.
#[derive(serde::Serialize)]
pub struct SaveOutcome {
    pub note: notes::Note,
    pub notes: Vec<notes::NoteSummary>,
    pub graph: graph::Graph,
    pub orphans: Vec<String>,
    /// `true` when the body actually changed and a checkpoint was written.
    /// Frontend uses this to skip its post-save toast / nonce on no-op saves.
    pub changed: bool,
}

#[tauri::command]
pub fn cmd_save_note_full(
    slug: String,
    body: String,
    thinking_note: Option<String>,
    state: State<AppState>,
) -> Result<SaveOutcome> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let existing = notes::read_with_key(&root, &slug, None).ok();
    let is_encrypted = existing.as_ref().map(|n| n.encrypted).unwrap_or(false);
    let key = if is_encrypted {
        Some(require_key(&state, &root)?)
    } else {
        state.touch_activity();
        None
    };
    state.with_repo_locked(|| -> Result<SaveOutcome> {
        // The frontend has two save layers wired into NoteEditor:
        //   - `cmd_quicksave_note` fires on a short ~300 ms debounce
        //     and writes the file to disk (no commit) so we don't lose
        //     keystrokes if the app crashes.
        //   - `cmd_save_note_full` (this command) fires on the user's
        //     configurable checkpoint debounce (default 8 s) and is
        //     supposed to wrap the typing burst into one git commit.
        //
        // Earlier versions short-circuited on `write_with_key_status`
        // returning `changed = false`, which is a "did we have to
        // touch the disk?" flag — but quicksave has already touched
        // it, so by the time this command runs that flag is always
        // false even when there's a real uncommitted change vs HEAD.
        // The result was that history checkpoints stopped showing up
        // for the very thing they're meant to capture. The correct
        // signal is "did we create a new commit?", which we now read
        // from the OID returned by checkpoint_or_amend.
        let (note, _file_changed) =
            notes::write_with_key_status(&root, &slug, &body, None, key.as_ref())?;
        let repo = open_repo(&root)?;
        let prev_oid = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_commit().ok())
            .map(|c| c.id());
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
        let new_oid = git::checkpoint_or_amend(&repo, &message, &note.slug)?;
        let made_new_commit = Some(new_oid) != prev_oid;
        if !made_new_commit {
            // Working tree already matches HEAD (nothing to record).
            // Skip the scan + graph rebuild — they'd produce the same
            // summaries the frontend already has.
            return Ok(SaveOutcome {
                note,
                notes: Vec::new(),
                graph: graph::Graph {
                    notes: Vec::new(),
                    links: Vec::new(),
                    last_built: String::new(),
                    tags: Vec::new(),
                },
                orphans: Vec::new(),
                changed: false,
            });
        }
        // ONE scan of the notes dir powers all three derived views: the
        // sidebar's `notes` list, the connection `graph`, and the orphan
        // list. The first save in a workspace builds the cache; every
        // subsequent save only re-reads the one slug that changed and
        // patches it into the cached vec — turning what was an O(N)
        // disk walk per save into O(1) regardless of workspace size.
        //
        // Mode-aware tail: graph + orphan computation is invisible to a
        // basic-notes user (the Map / Paths surfaces don't render). Skip
        // it entirely in that mode — saves a full link walk on every
        // typed save. Auto-path reconciliation also only matters when
        // there are paths to keep in sync, so it joins the same gate.
        let cfg = workspace::read_config(&root).ok();
        let is_mapped = cfg
            .as_ref()
            .map(|c| c.mapping.mode == "mapped")
            .unwrap_or(true); // unknown config → treat as mapped, safest default

        // Compute summaries + graph against the cached scan WITHOUT
        // cloning every body — the callback runs under the scan_cache
        // lock, but every consumer downstream (frontend serialization,
        // graph build, auto-path reconcile) only needs slug/frontmatter
        // metadata or in-place body reads. Cloning the whole vec used
        // to dominate save latency on a vault with megabytes of prose.
        let (mut summaries, by_slug, g, orphans) = state.scan_cache_with(
            &root,
            Some(&note.slug),
            |scanned| {
                let summaries: Vec<notes::NoteSummary> =
                    scanned.iter().map(notes::summary_from).collect();
                if is_mapped {
                    let by_slug: std::collections::HashMap<String, Vec<String>> = summaries
                        .iter()
                        .map(|s| (s.slug.clone(), s.tags.clone()))
                        .collect();
                    let g = graph::build_from_scan(&root, scanned);
                    let orphans = graph::orphan_slugs(&g);
                    (summaries, by_slug, g, orphans)
                } else {
                    (
                        summaries,
                        std::collections::HashMap::new(),
                        graph::Graph {
                            notes: Vec::new(),
                            links: Vec::new(),
                            last_built: String::new(),
                            tags: Vec::new(),
                        },
                        Vec::new(),
                    )
                }
            },
        )?;
        summaries.sort_by(|a, b| b.modified.cmp(&a.modified));

        // Auto-path reconciliation runs OUTSIDE the scan_cache lock —
        // it writes to path_collections.toml so we don't want to hold
        // the scan mutex while doing disk I/O on a separate file.
        if is_mapped {
            let _ = path_collections::reconcile_auto_membership(&root, &by_slug);
        }

        Ok(SaveOutcome {
            note,
            notes: summaries,
            graph: g,
            orphans,
            changed: true,
        })
    })
}

/// Read a note as it exists on a specific path. If the path has an override
/// for this slug, the override's body is returned (and its frontmatter if
/// present). Otherwise falls back to main's copy. Passing path_name=None or
/// the workspace root falls through to the regular read.
#[tauri::command]
pub fn cmd_read_note_on_path(
    slug: String,
    path_name: Option<String>,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let key = maybe_key(&state, &root);
    // Resolve which path (if any) should look at overrides.
    let effective = path_name
        .as_deref()
        .filter(|n| !n.is_empty())
        .filter(|n| {
            // Only non-root paths have overrides.
            match path_collections::read_all(&root) {
                Ok(view) => n != &view.root,
                Err(_) => false,
            }
        });

    if let Some(name) = effective {
        if let Ok(Some(raw)) = path_content::read_override(&root, name, &slug) {
            // Parse override to yield a Note shape. Overrides are always
            // plaintext — encryption isn't carried onto path scratch copies.
            let (fm, body) = notes::parse(&raw);
            return Ok(notes::Note {
                slug,
                frontmatter: fm,
                body,
                encrypted: false,
                locked: false,
            });
        }
    }
    notes::read_with_key(&root, &slug, key.as_ref())
}

/// Save a note's body onto a specific path. If path_name is None or equals
/// the workspace root, this delegates to the regular save (so callers don't
/// need to branch on which command to use — they can always call this one
/// and pass the current path). If path_name is a real non-root path, the
/// body is written to the path's override file and main is never touched.
/// No graph rebuild, no checkpoint — overrides are scratch space.
#[tauri::command]
pub fn cmd_save_note_on_path(
    slug: String,
    body: String,
    path_name: Option<String>,
    thinking_note: Option<String>,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let view = path_collections::read_all(&root).ok();
    let is_override = match (path_name.as_deref(), view.as_ref()) {
        (Some(name), Some(v)) => !name.is_empty() && name != v.root,
        _ => false,
    };

    if !is_override {
        // Fall through to the regular save path — same semantics as
        // cmd_save_note, including encryption and checkpointing.
        return cmd_save_note(slug, body, thinking_note, state);
    }

    let name = path_name.unwrap();
    // Read main's frontmatter so we can compose a complete override file.
    // Main's frontmatter becomes the seed for the override's frontmatter;
    // the user may edit those per-path fields later.
    let main_note = notes::read_with_key(&root, &slug, None).ok();
    let fm = main_note.map(|n| n.frontmatter).unwrap_or_default();
    let full = notes::serialize(&fm, &body);
    path_content::write_override(&root, &name, &slug, &full)?;
    state.touch_activity();
    // Return a Note shape mirroring what the frontend expects on save.
    Ok(notes::Note {
        slug,
        frontmatter: fm,
        body,
        encrypted: false,
        locked: false,
    })
}

/// List the slugs that have per-path overrides for a given path.
#[tauri::command]
pub fn cmd_list_path_overrides(
    path_name: String,
    state: State<AppState>,
) -> Result<Vec<String>> {
    let root = state.require_root()?;
    path_content::list_overridden_slugs(&root, &path_name)
}

/// Delete one override for a path/slug — lets the user "revert this note's
/// scratch version to main" without discarding the whole path.
#[tauri::command]
pub fn cmd_clear_path_override(
    path_name: String,
    slug: String,
    state: State<AppState>,
) -> Result<()> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    path_content::delete_override(&root, &path_name, &slug)
}

// ───────── borrow (Phase C — the spec's centerpiece operation) ─────────
//
// Borrow replaces whole-tree merge. Two forms:
//
//   * `cmd_borrow_note`  — overwrite dest with source's whole body.
//                          The exact UX of "actually I want this version
//                          of this note from solo-version on main."
//
//   * `cmd_borrow_text`  — splice a byte range from source into dest.
//                          Lets the frontend express "replace paragraph
//                          N" or "insert at cursor" with one primitive.
//
// Both routes write through the existing override infrastructure when
// the destination is a non-root path (so the source path is untouched
// and the destination's version diverges) and through the canonical
// save path when the destination IS the root (just a normal edit).
//
// Read-side semantics: an empty `source_path` means "the canonical
// trunk note." Same for `dest_path`. We resolve the source body once,
// then dispatch the write through the same code paths the editor uses
// so all existing concerns — checkpointing, encryption, override
// frontmatter seeding — Just Work without duplicating logic.

fn read_path_body(
    workspace: &std::path::Path,
    slug: &str,
    path_name: &str,
) -> Result<String> {
    let view = path_collections::read_all(workspace).ok();
    let on_root = match (path_name, view.as_ref()) {
        (n, Some(v)) => n.is_empty() || n == v.root,
        _ => path_name.is_empty(),
    };
    if !on_root {
        if let Ok(Some(raw)) = path_content::read_override(workspace, path_name, slug) {
            let (_fm, body) = notes::parse(&raw);
            return Ok(body);
        }
    }
    // Fall through: read the canonical body. Encryption isn't crossed
    // here — overlays carry plaintext only and a borrow that crosses an
    // encrypted boundary would surface as a locked-note error from the
    // canonical read. That's the right failure mode.
    let n = notes::read_with_key(workspace, slug, None)?;
    Ok(n.body)
}

#[tauri::command]
pub fn cmd_borrow_note(
    slug: String,
    source_path: String,
    dest_path: String,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let body = read_path_body(&root, &slug, &source_path)?;
    // Reuse the existing path-aware save so checkpointing /
    // overlay-frontmatter-seeding behave the same as a regular edit on
    // dest_path. An empty dest is treated as main by that command.
    let dest_arg = if dest_path.is_empty() { None } else { Some(dest_path) };
    cmd_save_note_on_path(slug, body, dest_arg, None, state)
}

#[tauri::command]
pub fn cmd_borrow_text(
    slug: String,
    source_path: String,
    dest_path: String,
    source_start: usize,
    source_end: usize,
    dest_start: usize,
    dest_end: usize,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let source_body = read_path_body(&root, &slug, &source_path)?;
    let mut dest_body = read_path_body(&root, &slug, &dest_path)?;
    // Clamp ranges to the actual byte lengths so a stale frontend
    // selection doesn't panic the backend.
    let s_lo = source_start.min(source_body.len());
    let s_hi = source_end.min(source_body.len()).max(s_lo);
    let d_lo = dest_start.min(dest_body.len());
    let d_hi = dest_end.min(dest_body.len()).max(d_lo);
    // Snap to char boundaries so we never split a multibyte UTF-8
    // sequence. `floor_char_boundary` is unstable, so we DIY it.
    fn snap_down(s: &str, mut i: usize) -> usize {
        while i > 0 && !s.is_char_boundary(i) {
            i -= 1;
        }
        i
    }
    fn snap_up(s: &str, mut i: usize) -> usize {
        while i < s.len() && !s.is_char_boundary(i) {
            i += 1;
        }
        i
    }
    let s_lo = snap_down(&source_body, s_lo);
    let s_hi = snap_up(&source_body, s_hi);
    let d_lo = snap_down(&dest_body, d_lo);
    let d_hi = snap_up(&dest_body, d_hi);
    let slice = &source_body[s_lo..s_hi];
    dest_body.replace_range(d_lo..d_hi, slice);

    let dest_arg = if dest_path.is_empty() { None } else { Some(dest_path) };
    cmd_save_note_on_path(slug, dest_body, dest_arg, None, state)
}

#[tauri::command]
pub fn cmd_create_note(title: String, state: State<AppState>) -> Result<notes::Note> {
    let root = state.require_root()?;
    let note = notes::create(&root, &title)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: new note \"{}\"", title))?;
    let _ = graph::build(&root);
    // Patch the new entry into the scan cache so the next debounced
    // save_full doesn't have to fall back to a full directory rescan.
    let _ = state.scan_cache_apply_save(&root, Some(&note.slug));
    // Keep every full-workspace path's membership in sync — a note created
    // anywhere should be reachable on any "full copy of main" path too.
    let _ = path_collections::reconcile_new_note(&root, &note.slug);
    Ok(note)
}

#[tauri::command]
pub fn cmd_rename_note(
    old_slug: String,
    new_title: String,
    rewrite_wikilinks: bool,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&old_slug)?;
    let root = state.require_root()?;
    let note = notes::rename(&root, &old_slug, &new_title, rewrite_wikilinks)?;
    let repo = open_repo(&root)?;
    let suffix = if rewrite_wikilinks { " (wikilinks updated)" } else { "" };
    git::checkpoint(&repo, &format!("checkpoint: rename to \"{}\"{}", new_title, suffix))?;
    let _ = graph::build(&root);
    // Rename moves the file (old_slug → new_slug) and may rewrite
    // wikilinks in any other note that referenced it. The cleanest way
    // to keep the cache coherent across that fan-out is a full rebuild
    // on the next save.
    state.scan_cache_invalidate();
    Ok(note)
}

#[tauri::command]
pub fn cmd_count_wikilink_references(slug: String, state: State<AppState>) -> Result<usize> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    notes::count_wikilink_refs(&root, &slug)
}

#[tauri::command]
pub fn cmd_set_pinned(
    slug: String,
    pinned: bool,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
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
    let _ = state.scan_cache_apply_save(&root, Some(&slug));
    Ok(saved)
}

/// Move a note into a folder, or out of one. `folder = None` (or an
/// empty/whitespace-only string from the frontend) clears the folder
/// and the note re-joins the un-foldered time-based view.
///
/// Folders are pure presentation metadata: the file always stays at
/// `notes/<slug>.md`. The sidebar groups by this field; nothing else
/// in the app cares about it. That keeps the change zero-risk for
/// existing users — a workspace with no folders defined renders
/// exactly as it always did.
#[tauri::command]
pub fn cmd_set_note_folder(
    slug: String,
    folder: Option<String>,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let mut note = notes::read(&root, &slug)?;
    // Folder names are pure metadata (the file always lives at
    // `notes/<slug>.md`), but we still need to keep them sane:
    //   - control chars (newline / tab / etc.) would corrupt the
    //     `folder:` line in YAML and could trip downstream parsers.
    //   - `/` or `\` reads as path nesting, which we don't support and
    //     which would hide the note from the sidebar's flat folder list.
    //   - 64 chars is plenty for a label and stops a paste-typo from
    //     producing a multi-megabyte frontmatter field.
    // None or empty after trim means "clear the folder", which is the
    // existing happy path.
    let cleaned = match folder.map(|f| f.trim().to_string()) {
        Some(ref f) if f.is_empty() => None,
        Some(f) => {
            if f.chars().count() > 64 {
                return Err(YarrowError::Invalid(
                    "Folder name is too long — keep it under 64 characters.".into(),
                ));
            }
            if f.chars().any(|c| c.is_control()) {
                return Err(YarrowError::Invalid(
                    "Folder name can't contain line breaks or control characters.".into(),
                ));
            }
            if f.contains('/') || f.contains('\\') {
                return Err(YarrowError::Invalid(
                    "Folder names are flat — slashes aren't supported.".into(),
                ));
            }
            Some(f)
        }
        None => None,
    };
    if note.frontmatter.folder == cleaned {
        return Ok(note);
    }
    let prev = note.frontmatter.folder.clone();
    note.frontmatter.folder = cleaned.clone();
    let saved = notes::write(&root, &slug, &note.body, Some(note.frontmatter))?;
    // Skip checkpointing private notes — same rule as everywhere else.
    if !saved.frontmatter.is_private() {
        let repo = open_repo(&root)?;
        let msg = match (prev, cleaned) {
            (None, Some(to)) => format!("checkpoint: move \"{}\" → folder \"{}\"", slug, to),
            (Some(_), None) => format!("checkpoint: move \"{}\" → root", slug),
            (Some(_), Some(to)) => format!("checkpoint: move \"{}\" → folder \"{}\"", slug, to),
            (None, None) => return Ok(saved),
        };
        git::checkpoint(&repo, &msg)?;
    }
    let _ = state.scan_cache_apply_save(&root, Some(&slug));
    Ok(saved)
}

/// Replace the note's tag list. Tags are stored in YAML frontmatter; the
/// editor's tag chip-input calls this to merge user edits in. Empty / blank
/// tags are filtered out and duplicates collapsed (case-sensitive).
#[tauri::command]
pub fn cmd_set_tags(
    slug: String,
    tags: Vec<String>,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let mut note = notes::read(&root, &slug)?;
    let mut cleaned: Vec<String> = tags.into_iter()
        .map(|t| t.trim().trim_start_matches('#').to_string())
        .filter(|t| !t.is_empty())
        .collect();
    // Stable de-dup: keep first occurrence, drop later identical entries.
    let mut seen = std::collections::HashSet::new();
    cleaned.retain(|t| seen.insert(t.clone()));
    if note.frontmatter.tags == cleaned {
        return Ok(note);
    }
    note.frontmatter.tags = cleaned;
    let saved = notes::write(&root, &slug, &note.body, Some(note.frontmatter))?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: tag \"{}\"", slug))?;
    let _ = graph::build(&root);
    let _ = state.scan_cache_apply_save(&root, Some(&slug));
    // Tag change may have just qualified this note for an auto-path —
    // reconcile immediately so the paths pane reflects it.
    let _ = reconcile_auto_paths(&root);
    Ok(saved)
}

/// Tag Bouquet (2.1): given a body + title, return up to `limit` tag
/// suggestions picked from the note's own words, preferring stems that
/// already exist as tags somewhere in the vault. Excludes tags the note
/// already has. Fully local, zero cost when the user doesn't invoke it.
#[tauri::command]
pub fn cmd_suggest_tags(
    body: String,
    title: String,
    existing_tags: Vec<String>,
    limit: Option<usize>,
    state: State<AppState>,
) -> Result<Vec<String>> {
    let root = state.require_root()?;
    // Collect the vault's full tag set from the scan — cheap enough given
    // typical vault sizes, and we avoid maintaining a parallel cache.
    let mut vault_tags: std::collections::HashSet<String> = std::collections::HashSet::new();
    for s in notes::scan(&root)?.iter() {
        for t in &s.fm.tags {
            vault_tags.insert(t.clone());
        }
    }
    let vault: Vec<String> = vault_tags.into_iter().collect();
    let cap = limit.unwrap_or(5).max(1).min(10);
    Ok(notes::suggest_tags(&body, &title, &existing_tags, &vault, cap))
}

/// Replace the note's margin-ink annotations list. Stored in YAML
/// frontmatter so external markdown tools round-trip without mangling.
/// Each save is its own silent checkpoint — annotations ARE versioned
/// history, so the user can scrub back through the evolving commentary
/// the same way they can scrub the body.
#[tauri::command]
pub fn cmd_set_annotations(
    slug: String,
    annotations: Vec<notes::Annotation>,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let mut note = notes::read(&root, &slug)?;
    // Annotations live in plaintext frontmatter. Refuse to write them on
    // an encrypted note — the bodies are user prose and would defeat
    // per-note encryption. `serialize` enforces the same invariant on
    // the disk side; this gives the IPC caller a clear error instead of
    // a silent drop.
    if note.frontmatter.encrypted {
        return Err(YarrowError::Other(
            "Annotations can't be added to encrypted notes — their bodies would \
             land in plaintext frontmatter. Decrypt the note first, or move the \
             commentary into the body itself."
                .into(),
        ));
    }
    // Normalize: drop entries that are *fully* empty (no anchor AND no
    // body) — those are garbage. Keep empty-body entries that have an
    // anchor, because that's the state right after the user clicks
    // "Annotate" and hasn't typed yet. Deletions are the client's job:
    // `AnnotationsGutter.commitEdit` already removes an entry from the
    // array when its body is cleared on blur. Stamp `at` on anything
    // missing it so the gutter can show relative time.
    let now = chrono::Utc::now().to_rfc3339();
    let cleaned: Vec<notes::Annotation> = annotations
        .into_iter()
        .filter(|a| !(a.body.trim().is_empty() && a.anchor.trim().is_empty()))
        .map(|mut a| {
            if a.at.is_empty() {
                a.at = now.clone();
            }
            a
        })
        .collect();
    if note.frontmatter.annotations == cleaned {
        return Ok(note);
    }
    note.frontmatter.annotations = cleaned;
    let saved = notes::write(&root, &slug, &note.body, Some(note.frontmatter))?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: annotations \"{}\"", slug))?;
    let _ = state.scan_cache_apply_save(&root, Some(&slug));
    Ok(saved)
}

#[tauri::command]
pub fn cmd_note_absolute_path(slug: String, state: State<AppState>) -> Result<String> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let path = notes::note_path(&root, &slug);
    path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| YarrowError::Other("note path not utf-8".into()))
}

#[tauri::command]
pub fn cmd_delete_note(slug: String, state: State<AppState>) -> Result<()> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    // Stash a copy in `.yarrow/trash/` before the destructive notes::delete
    // strips backlinks and removes the file. Stash is best-effort — if it
    // fails we still proceed with the delete (so a permission error on the
    // trash dir doesn't block the user from removing notes).
    let _ = trash::stash(&root, &slug);
    notes::delete(&root, &slug)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: delete \"{}\"", slug))?;
    let _ = graph::build(&root);
    // `notes::delete` strips backlinks from every other note that
    // referenced the deleted slug, so the cache could be stale on those
    // entries too. A full invalidate is the safe play here.
    state.scan_cache_invalidate();
    // Scrub the slug out of every path's membership so nothing dangles.
    let _ = path_collections::reconcile_deleted_note(&root, &slug);
    Ok(())
}

// ───────── trash ─────────

#[tauri::command]
pub fn cmd_list_trash(state: State<AppState>) -> Result<Vec<trash::TrashEntry>> {
    let root = state.require_root()?;
    trash::list(&root)
}

#[tauri::command]
pub fn cmd_restore_from_trash(slug: String, state: State<AppState>) -> Result<String> {
    notes::validate_trash_slug(&slug)?;
    let root = state.require_root()?;
    let restored_slug = trash::restore(&root, &slug)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: restore \"{}\"", restored_slug))?;
    let _ = graph::build(&root);
    Ok(restored_slug)
}

#[tauri::command]
pub fn cmd_purge_from_trash(slug: String, state: State<AppState>) -> Result<()> {
    notes::validate_trash_slug(&slug)?;
    let root = state.require_root()?;
    trash::purge(&root, &slug)
}

#[tauri::command]
pub fn cmd_empty_trash(state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    trash::empty(&root)
}

/// Render only the body of a note to HTML (no `<html>` shell, no styling).
/// The reading-mode pane wraps this in a themed container so it picks up
/// the user's font, background, and accent without being constrained by an
/// inline stylesheet.
#[tauri::command]
pub fn cmd_render_note_body_html(slug: String, state: State<AppState>) -> Result<String> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let session = unpoison(state.session.lock());
    let note = notes::read_with_key(&root, &slug, session.master_key.as_ref())?;
    drop(session);
    render_markdown(&note.body)
}

/// Render an arbitrary markdown string to HTML — same pipeline as
/// `cmd_render_note_body_html` but without a slug lookup. Used by the
/// Ley Lines reader: it injects inline `<del>`/`<ins>` tokens into a
/// synthesized body and renders the whole thing so diff markup lives
/// inside the prose instead of on top of it.
#[tauri::command]
pub fn cmd_render_markdown_html(body: String) -> Result<String> {
    render_markdown(&body)
}

fn render_markdown(body: &str) -> Result<String> {
    use pulldown_cmark::{html, Options, Parser};
    // SECURITY: do NOT add `Options::ENABLE_HTML`. With it omitted,
    // pulldown-cmark escapes any `<script>` / `<iframe>` / `<svg>` etc.
    // a user pastes into a note. The defense-in-depth `strip_xss_tripwire`
    // pass below assumes nothing dangerous makes it past this parser.
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_TASKLISTS);
    let parser = Parser::new_ext(body, options);
    let mut html_out = String::new();
    html::push_html(&mut html_out, parser);
    Ok(strip_xss_tripwire(&rewrite_callouts(&html_out)))
}

/// Final-pass tripwire. With `ENABLE_HTML` off the parser already
/// escapes raw HTML, so in normal operation these regexes never match.
/// They exist to catch future regressions — if someone enables HTML
/// pass-through, edits the parser config, or introduces a path that
/// concatenates user content into the rendered HTML without escaping,
/// the obvious XSS vectors get neutralised before the WebView sees
/// them. Cheap because the input is already small (a single rendered
/// note) and the regexes are compiled once.
fn strip_xss_tripwire(html: &str) -> String {
    use regex::Regex;
    use std::sync::OnceLock;
    static REGEXES: OnceLock<Vec<Regex>> = OnceLock::new();
    let res = REGEXES.get_or_init(|| {
        vec![
            // `<script>…</script>` and friends. `(?is)` = case-insensitive
            // + dotall so the body can span newlines.
            Regex::new(r"(?is)<script\b[^>]*>.*?</script\s*>").expect("static regex"),
            Regex::new(r"(?is)<iframe\b[^>]*>.*?</iframe\s*>").expect("static regex"),
            Regex::new(r"(?is)<object\b[^>]*>.*?</object\s*>").expect("static regex"),
            Regex::new(r"(?is)<embed\b[^>]*/?>").expect("static regex"),
            // Inline event handlers: ` onclick="…"`, ` onmouseover='…'`,
            // ` onerror=foo`. The leading whitespace is required so we
            // don't accidentally match `Notion`, `none`, etc.
            Regex::new(r#"(?i)\son[a-z]+\s*=\s*"[^"]*""#).expect("static regex"),
            Regex::new(r"(?i)\son[a-z]+\s*=\s*'[^']*'").expect("static regex"),
            Regex::new(r"(?i)\son[a-z]+\s*=\s*[^\s>]+").expect("static regex"),
            // `javascript:` URLs in href / src attributes.
            Regex::new(r"(?i)javascript\s*:").expect("static regex"),
        ]
    });
    let mut out = html.to_string();
    for re in res {
        out = re.replace_all(&out, "").into_owned();
    }
    out
}

/// Transform Obsidian-style `> [!type] Title / > body` blockquotes that
/// pulldown-cmark emitted as `<blockquote><p>[!type] Title\nbody</p></blockquote>`
/// into styled `<div class="yarrow-callout yarrow-callout-{type}">…</div>`
/// blocks. Unknown types are left as-is so arbitrary bracket content
/// (code examples, etc.) doesn't accidentally get rewritten.
fn rewrite_callouts(html: &str) -> String {
    use regex::Regex;
    // `(?s)` = dotall so `.*?` spans lines inside the blockquote.
    // Captures: 1 = type, 2 = first paragraph (title + optional body
    // joined by `\n`), 3 = any subsequent paragraphs still inside the
    // blockquote.
    let re = Regex::new(
        r"(?s)<blockquote>\s*<p>\[!([a-zA-Z][a-zA-Z0-9\-]*)\]\s*(.*?)</p>(.*?)</blockquote>",
    )
    .expect("static regex");
    re.replace_all(html, |caps: &regex::Captures| {
        let type_ = caps[1].to_ascii_lowercase();
        if !is_known_callout_type(&type_) {
            return caps[0].to_string();
        }
        let first_para = caps.get(2).map(|m| m.as_str()).unwrap_or("");
        let rest = caps.get(3).map(|m| m.as_str().trim()).unwrap_or("");
        // Split the first paragraph on its first newline: before = title,
        // after = opening body paragraph. If no newline, the whole thing
        // is just the title.
        let (title_raw, body_first) = match first_para.split_once('\n') {
            Some((t, b)) => (t.trim(), b.trim()),
            None => (first_para.trim(), ""),
        };
        let title = if title_raw.is_empty() {
            pretty_callout_type(&type_)
        } else {
            title_raw.to_string()
        };
        let mut body_html = String::new();
        if !body_first.is_empty() {
            body_html.push_str("<p>");
            body_html.push_str(body_first);
            body_html.push_str("</p>");
        }
        if !rest.is_empty() {
            body_html.push_str(rest);
        }
        format!(
            r#"<div class="yarrow-callout yarrow-callout-{t}"><div class="yarrow-callout-title">{title}</div><div class="yarrow-callout-body">{body}</div></div>"#,
            t = type_,
            title = title,
            body = body_html,
        )
    })
    .into_owned()
}

fn is_known_callout_type(t: &str) -> bool {
    matches!(
        t,
        "note"
            | "info"
            | "tip"
            | "question"
            | "decision"
            | "warning"
            | "danger"
            | "quote"
    )
}

fn pretty_callout_type(t: &str) -> String {
    let mut chars = t.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => {
            let mut s = String::new();
            s.extend(first.to_uppercase());
            s.push_str(chars.as_str());
            s
        }
    }
}

/// Render a single note as a self-contained HTML document with print-friendly
/// styling. The frontend writes the result into a hidden iframe and triggers
/// `window.print()` so the user can save as PDF using their OS print dialog.
#[tauri::command]
pub fn cmd_render_note_html(slug: String, state: State<AppState>) -> Result<String> {
    use pulldown_cmark::{html, Options, Parser};
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let session = unpoison(state.session.lock());
    let note = notes::read_with_key(&root, &slug, session.master_key.as_ref())?;
    drop(session);
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    let parser = Parser::new_ext(&note.body, options);
    let mut body = String::new();
    html::push_html(&mut body, parser);
    // Same tripwire as `render_markdown` — ENABLE_HTML is off so the
    // parser already escapes user-supplied HTML; this catches anything
    // that might slip through if the parser config is ever changed.
    let body = strip_xss_tripwire(&body);
    let title = if note.frontmatter.title.is_empty() {
        note.slug.clone()
    } else {
        note.frontmatter.title.clone()
    };
    let escaped_title = html_escape(&title);
    let doc = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title>\
        <style>{css}</style></head><body><h1>{title}</h1>{body}</body></html>",
        title = escaped_title,
        css = PRINT_CSS,
        body = body,
    );
    Ok(doc)
}

const PRINT_CSS: &str = r#"
* { box-sizing: border-box; }
html, body { background: white; color: #1a1a1a; }
body {
  font-family: 'Fraunces', 'Georgia', 'Times New Roman', serif;
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 56px;
  line-height: 1.6;
  font-size: 16px;
}
h1 { font-size: 32px; margin: 0 0 24px; line-height: 1.2; }
h2 { font-size: 24px; margin-top: 32px; }
h3 { font-size: 19px; margin-top: 24px; }
p, li { margin: 0 0 12px; }
code, pre {
  font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace;
  font-size: 13px;
}
pre {
  background: #f5f4ef;
  padding: 12px 14px;
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre-wrap;
}
code { background: #f5f4ef; padding: 1px 4px; border-radius: 3px; }
pre code { background: transparent; padding: 0; }
blockquote {
  border-left: 3px solid #c9c5b8;
  margin: 12px 0;
  padding: 4px 14px;
  color: #555;
  font-style: italic;
}
table { border-collapse: collapse; margin: 12px 0; }
th, td { border: 1px solid #d0cdc2; padding: 6px 10px; }
th { background: #f5f4ef; }
hr { border: none; border-top: 1px solid #d0cdc2; margin: 24px 0; }
img { max-width: 100%; height: auto; }
a { color: #6b5d2f; text-decoration: none; border-bottom: 1px solid #c4b76b; }
@page { margin: 0.6in; }
"#;

// ───────── new-workspace helpers ─────────

/// Detect the Linux desktop environment from `XDG_CURRENT_DESKTOP` so the
/// frontend can apply DE-conditional styling (GNOME header-bar feel, KDE
/// Breeze conventions, etc.). Returns one of:
///   - "gnome"     — GNOME or any DE that includes GNOME in the chain
///   - "kde"       — KDE Plasma
///   - "xfce"      — XFCE
///   - "cinnamon"  — Cinnamon (Linux Mint default)
///   - "mate"      — MATE
///   - "unity"     — Unity (older Ubuntu)
///   - "lxqt" / "lxde"
///   - "unknown"   — anything else, or no XDG signal at all
///   - ""          — non-Linux platforms (macOS, Windows). The frontend
///                   uses this to skip the body-class entirely.
///
/// macOS and Windows return the empty string — they don't have a desktop
/// environment in the Linux sense, and the existing `data-platform`
/// attribute on `<html>` already covers their styling needs.
#[tauri::command]
pub fn cmd_desktop_env() -> String {
    #[cfg(not(target_os = "linux"))]
    {
        return String::new();
    }
    #[cfg(target_os = "linux")]
    {
        // XDG_CURRENT_DESKTOP can be a colon-separated list (e.g. "ubuntu:GNOME").
        // We match on substrings so a multi-token value still classifies cleanly.
        let raw = std::env::var("XDG_CURRENT_DESKTOP")
            .or_else(|_| std::env::var("XDG_SESSION_DESKTOP"))
            .or_else(|_| std::env::var("DESKTOP_SESSION"))
            .unwrap_or_default()
            .to_lowercase();
        if raw.is_empty() {
            return "unknown".to_string();
        }
        if raw.contains("gnome") || raw.contains("unity") && raw.contains("gnome") {
            return "gnome".to_string();
        }
        if raw.contains("kde") || raw.contains("plasma") {
            return "kde".to_string();
        }
        if raw.contains("xfce") {
            return "xfce".to_string();
        }
        if raw.contains("cinnamon") {
            return "cinnamon".to_string();
        }
        if raw.contains("mate") {
            return "mate".to_string();
        }
        if raw.contains("lxqt") {
            return "lxqt".to_string();
        }
        if raw.contains("lxde") {
            return "lxde".to_string();
        }
        if raw.contains("unity") {
            return "unity".to_string();
        }
        "unknown".to_string()
    }
}

/// Suggest a default place to put new workspaces — `~/Documents/Yarrow` if
/// it exists or can be created, falling back to the home directory. Used by
/// the onboarding wizard so the user doesn't have to think about location
/// unless they want to.
#[tauri::command]
pub fn cmd_default_workspaces_root() -> Result<String> {
    let candidate = dirs::document_dir()
        .or_else(dirs::home_dir)
        .ok_or_else(|| YarrowError::Other("could not determine home directory".into()))?;
    let yarrow_root = candidate.join("Yarrow");
    Ok(yarrow_root.to_string_lossy().to_string())
}

/// Create a directory `parent/name` (and any missing parents). Returns the
/// absolute path. Errors if a non-empty directory with that name already
/// exists — the wizard surfaces this so the user picks a different name
/// rather than us silently merging into an existing vault.
#[tauri::command]
pub fn cmd_create_workspace_dir(parent: String, name: String) -> Result<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(YarrowError::Invalid("workspace name is required".into()));
    }
    // Reject path-traversal payloads outright. A name of "." or ".." would
    // otherwise resolve to the parent directory itself (or its parent),
    // potentially treating an unrelated folder as a Yarrow workspace.
    // Same reason `/`, `\`, etc. are blocked: we want exactly one new
    // child directory, no escape into the surrounding filesystem.
    if trimmed == "." || trimmed == ".." {
        return Err(YarrowError::Invalid(
            "workspace name can't be \".\" or \"..\" — pick a real name".into(),
        ));
    }
    if trimmed.chars().any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err(YarrowError::Invalid(
            "workspace name can't contain slashes or special filesystem characters".into(),
        ));
    }
    if trimmed.contains('\0') {
        return Err(YarrowError::Invalid(
            "workspace name can't contain a NUL byte".into(),
        ));
    }
    let parent_path = std::path::PathBuf::from(&parent);
    if !parent_path.is_dir() {
        return Err(YarrowError::Invalid(format!(
            "“{}” doesn't look like a real folder — pick a different location",
            parent_path.display(),
        )));
    }
    let target = parent_path.join(trimmed);
    if target.exists() {
        let non_empty = std::fs::read_dir(&target)
            .map(|mut it| it.next().is_some())
            .unwrap_or(false);
        if non_empty {
            return Err(YarrowError::Invalid(format!(
                "“{trimmed}” already exists at that location and isn't empty. Pick a different name."
            )));
        }
    }
    std::fs::create_dir_all(&target)?;
    Ok(target.to_string_lossy().to_string())
}

// ───────── foreign imports ─────────

/// Per-file progress event emitted to the frontend during an import.
/// `current` is 0-indexed and matches the file `file` is *about to* be
/// processed. The final event in a run is always `current == total`
/// with an empty `file`, so the listener can flip to the post-import
/// summary screen the moment progress reaches the end.
#[derive(serde::Serialize, Clone)]
struct ImportProgress {
    current: usize,
    total: usize,
    file: String,
    source: &'static str,
}

/// Build the progress closure each `cmd_import_*` hands to its
/// importer's `_with_progress` variant. Captures the `AppHandle` by
/// clone so it lives long enough for the synchronous walk.
fn make_progress_emitter(
    app: AppHandle,
    source_label: &'static str,
) -> Box<dyn Fn(usize, usize, &str) + Send + Sync> {
    use tauri::Emitter;
    Box::new(move |current, total, file| {
        let _ = app.emit(
            "yarrow:import-progress",
            ImportProgress {
                current,
                total,
                file: file.to_string(),
                source: source_label,
            },
        );
    })
}

#[tauri::command]
pub fn cmd_import_obsidian_vault(
    app: AppHandle,
    source: String,
    state: State<AppState>,
) -> Result<obsidian_import::ImportReport> {
    let root = state.require_root()?;
    let emit = make_progress_emitter(app, "obsidian");
    let report = obsidian_import::import_vault_with_progress(
        &root,
        std::path::Path::new(&source),
        Some(&*emit),
    )?;
    post_import_checkpoint(&root, report.imported, "Obsidian")?;
    Ok(report)
}

#[tauri::command]
pub fn cmd_import_bear_vault(
    app: AppHandle,
    source: String,
    state: State<AppState>,
) -> Result<obsidian_import::ImportReport> {
    let root = state.require_root()?;
    let emit = make_progress_emitter(app, "bear");
    let report = foreign_import::import_bear_with_progress(
        &root,
        std::path::Path::new(&source),
        Some(&*emit),
    )?;
    post_import_checkpoint(&root, report.imported, "Bear")?;
    Ok(report)
}

#[tauri::command]
pub fn cmd_import_logseq_vault(
    app: AppHandle,
    source: String,
    state: State<AppState>,
) -> Result<obsidian_import::ImportReport> {
    let root = state.require_root()?;
    let emit = make_progress_emitter(app, "logseq");
    let report = foreign_import::import_logseq_with_progress(
        &root,
        std::path::Path::new(&source),
        Some(&*emit),
    )?;
    post_import_checkpoint(&root, report.imported, "Logseq")?;
    Ok(report)
}

#[tauri::command]
pub fn cmd_import_notion_vault(
    app: AppHandle,
    source: String,
    state: State<AppState>,
) -> Result<obsidian_import::ImportReport> {
    let root = state.require_root()?;
    let emit = make_progress_emitter(app, "notion");
    let report = foreign_import::import_notion_with_progress(
        &root,
        std::path::Path::new(&source),
        Some(&*emit),
    )?;
    post_import_checkpoint(&root, report.imported, "Notion")?;
    Ok(report)
}

#[tauri::command]
pub fn cmd_import_bibtex(
    app: AppHandle,
    source: String,
    state: State<AppState>,
) -> Result<obsidian_import::ImportReport> {
    let root = state.require_root()?;
    let emit = make_progress_emitter(app, "bibtex");
    let report = crate::bibtex_import::import_bibtex_with_progress(
        &root,
        std::path::Path::new(&source),
        Some(&*emit),
    )?;
    post_import_checkpoint(&root, report.imported, "BibTeX")?;
    Ok(report)
}

/// Shared post-import bookkeeping: one checkpoint + a graph rebuild so
/// the user can roll back the whole batch in one step if the import
/// pulled in something unexpected.
fn post_import_checkpoint(
    root: &std::path::Path,
    imported: usize,
    app_label: &str,
) -> Result<()> {
    if imported == 0 {
        return Ok(());
    }
    let repo = open_repo(root)?;
    git::checkpoint(
        &repo,
        &format!(
            "checkpoint: imported {} note{} from {}",
            imported,
            if imported == 1 { "" } else { "s" },
            app_label,
        ),
    )?;
    let _ = graph::build(root);
    Ok(())
}

// ───────── path comparison ─────────

#[tauri::command]
pub fn cmd_compare_paths(
    left: String,
    right: String,
    state: State<AppState>,
) -> Result<git::PathComparison> {
    let root = state.require_root()?;
    // v2: prefer a collection-based comparison when both names are known
    // collections. In v2, paths are lenses over the same notes — so the
    // honest diff is membership-based, and the shared content is surfaced
    // on both sides for slugs that live on both paths. Falls through to
    // the legacy branch-based diff only when one side has no collection
    // (e.g. an old workspace still referencing a git branch name).
    if let Ok(view) = path_collections::read_all(&root) {
        let has_left = view.collections.iter().any(|c| c.name == left);
        let has_right = view.collections.iter().any(|c| c.name == right);
        if has_left && has_right {
            return path_collections::compare_as_paths(&root, &left, &right);
        }
    }
    let repo = open_repo(&root)?;
    git::compare_paths(&repo, &left, &right)
}

// ───────── multiple windows ─────────

/// Spawn an additional Tauri window pointing at the same frontend, so the
/// user can view two notes (or a note + the path graph) at once. Workspace
/// state lives in `AppState`, which all windows share, so the new window
/// boots into the same workspace without re-running the Onboarding picker.
#[tauri::command]
pub fn cmd_open_new_window(app: tauri::AppHandle) -> Result<()> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    // Unique label per spawn — Tauri requires labels to be unique across the
    // app's window registry. A timestamp-derived label avoids collisions
    // across sessions and is short enough to be readable in logs.
    let label = format!(
        "win-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App("index.html".into()))
        .title("Yarrow")
        .inner_size(1400.0, 900.0)
        .min_inner_size(820.0, 560.0)
        .resizable(true)
        .maximizable(true)
        .build()
        .map_err(|e| YarrowError::Other(format!("could not open new window: {e}")))?;
    Ok(())
}

// ───────── spell-check user dictionary ─────────

const DICTIONARY_FILE: &str = ".yarrow/dictionary.txt";

#[tauri::command]
pub fn cmd_read_dictionary(state: State<AppState>) -> Result<Vec<String>> {
    let root = state.require_root()?;
    let path = root.join(DICTIONARY_FILE);
    if !path.exists() { return Ok(vec![]); }
    let raw = std::fs::read_to_string(&path)?;
    Ok(raw.lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && !s.starts_with('#'))
        .collect())
}

#[tauri::command]
pub fn cmd_write_dictionary(words: Vec<String>, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    let path = root.join(DICTIONARY_FILE);
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
    let mut sorted: Vec<String> = words.into_iter()
        .map(|w| w.trim().to_string())
        .filter(|w| !w.is_empty())
        .collect();
    sorted.sort();
    sorted.dedup();
    let body = format!(
        "# Yarrow workspace dictionary — words to consider correctly spelled.\n# One word per line. Committed so the team shares the same vocabulary.\n{}\n",
        sorted.join("\n"),
    );
    std::fs::write(&path, body)?;
    Ok(())
}

// ───────── find & replace ─────────

#[tauri::command]
pub fn cmd_find_replace_preview(
    pattern: String,
    regex_mode: bool,
    case_insensitive: bool,
    scope_slugs: Option<Vec<String>>,
    state: State<AppState>,
) -> Result<Vec<find_replace::PreviewHit>> {
    let root = state.require_root()?;
    find_replace::preview(&root, &pattern, regex_mode, case_insensitive, scope_slugs)
}

#[tauri::command]
pub fn cmd_find_replace_apply(
    pattern: String,
    replacement: String,
    regex_mode: bool,
    case_insensitive: bool,
    scope_slugs: Option<Vec<String>>,
    state: State<AppState>,
) -> Result<find_replace::ApplyReport> {
    let root = state.require_root()?;
    let report = find_replace::apply(
        &root, &pattern, &replacement, regex_mode, case_insensitive, scope_slugs,
    )?;
    if report.notes_changed > 0 {
        let repo = open_repo(&root)?;
        let summary = if report.notes_changed == 1 { "note" } else { "notes" };
        git::checkpoint(
            &repo,
            &format!(
                "checkpoint: find/replace — {} replacement{} across {} {summary}",
                report.total_replacements,
                if report.total_replacements == 1 { "" } else { "s" },
                report.notes_changed,
            ),
        )?;
        let _ = graph::build(&root);
    }
    Ok(report)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
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
    // Trigger the lazy idle-timeout clear without extending the
    // session — `peek_key` zeroes the in-memory key if expiry has
    // passed but does NOT reset `last_activity`. Status checks aren't
    // user activity, so they shouldn't keep the session alive.
    let _ = state.peek_key(idle_secs(&root));
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
    let mut env = workspace::read_security(&root)?
        .ok_or(YarrowError::EncryptionDisabled)?;
    let master = env.unlock_with_password(&password)?;
    // Transparent KDF migration. Older workspaces were created at lower
    // Argon2id parameters; if the envelope's stored params lag behind
    // the current constants, re-derive + re-wrap with the current
    // params and atomically rewrite security.toml. The user never sees
    // it — at most they notice their next unlock takes the new (longer)
    // duration. Migration failures are non-fatal — the unlock already
    // succeeded, and we'd rather leave the workspace at the old params
    // than refuse the unlock that the user just typed.
    if env.needs_migration() {
        if env
            .migrate_password_wrap_with_password(&master, &password)
            .is_ok()
        {
            // The migration is invisible to the user, so we don't fail
            // the unlock when persistence fails — the in-memory key
            // already worked and the next unlock will simply re-attempt
            // migration. But we DO want a stderr trace: a silent `let _ =`
            // here meant a chronic "migration never lands on disk"
            // failure mode (read-only `.yarrow/`, full disk, AV scanner
            // holding the file) was undiagnosable.
            if let Err(e) = workspace::write_security(&root, &env) {
                eprintln!(
                    "yarrow: KDF migration succeeded but persisting security.toml failed: {}",
                    e
                );
            }
        }
    }
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
    // Recovery flow always rewraps the password (with the new password
    // the user just provided). When the envelope was at older params,
    // also migrate the recovery wrap to the new params so future
    // recovery unlocks use the stronger derivation. The order is:
    // recovery-migrate first (purely local rewrap with the phrase we
    // already have) → password rewrap (the canonical params anchor,
    // which also bumps m/t/p on the envelope record). Either step's
    // failure rolls the envelope back via the snapshot inside the
    // migration helpers; then we'd surface the error.
    if env.needs_migration() {
        env.migrate_recovery_wrap_with_phrase(&master, &phrase)?;
    }
    env.rewrap_password(&master, &new_password)?;
    // Always stamp the current params on the envelope post-rewrap so
    // the file is self-consistent — `rewrap_password` wraps under the
    // current params, so the recorded params should match too.
    env.kdf = "argon2id".into();
    env.argon2_version = crypto::ARGON2_VERSION;
    let (m, t, p) = crypto::current_params();
    env.m_cost = m;
    env.t_cost = t;
    env.p_cost = p;
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
    // Heartbeat — must NOT extend the session. The frontend fires this
    // every 60s purely to surface the auto-locked toast when expiry
    // passes; if the heartbeat itself counted as activity, the session
    // would never expire while the app is open. `peek_key` returns the
    // key if still valid (or zeroes it if expired) but never touches
    // `last_activity`.
    Ok(state.peek_key(idle_secs(&root)).is_some())
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
    // The password change rewrapped under current params; stamp them on
    // the envelope so the params record matches the wrap.
    env.kdf = "argon2id".into();
    env.argon2_version = crypto::ARGON2_VERSION;
    let (m, t, p) = crypto::current_params();
    env.m_cost = m;
    env.t_cost = t;
    env.p_cost = p;
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
    // The new recovery wrap is at current params. If the password wrap
    // was still on legacy params, opportunistically migrate it too with
    // the password the user just used to authorise this rotation.
    if env.needs_migration() {
        let _ = env.migrate_password_wrap_with_password(&master, &password);
    }
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
        // Walk every encrypted note and rewrite it as plaintext. If ANY
        // decrypt fails we MUST keep the security envelope — otherwise
        // `clear_security` strips the master key and orphans every note we
        // didn't manage to decrypt. Better to refuse the whole operation
        // and let the user resolve the failure first.
        let mut failures: Vec<(String, String)> = Vec::new();
        for summary in notes::list(&root)? {
            if !summary.encrypted { continue; }
            if let Err(e) = notes::decrypt_note(&root, &summary.slug, &master) {
                failures.push((summary.slug.clone(), e.to_string()));
            }
        }
        if !failures.is_empty() {
            let preview = failures
                .iter()
                .take(3)
                .map(|(slug, err)| format!("{} ({})", slug, err))
                .collect::<Vec<_>>()
                .join(", ");
            let extra = if failures.len() > 3 {
                format!(" (+{} more)", failures.len() - 3)
            } else {
                String::new()
            };
            return Err(YarrowError::Other(format!(
                "Refusing to disable encryption: {} note(s) failed to decrypt — {}{}. \
                 The master key has been kept in place. Resolve the failures and try again.",
                failures.len(), preview, extra
            )));
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
    notes::validate_slug(&slug)?;
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
        // ask `git gc` to prune loose objects.
        let _ = git::clear_reflogs(&repo);
        // Unlike checkpoint-prune cleanup (where gc is "nice to have"), the
        // encryption-at-history seal needs gc to actually run — without it,
        // plaintext blobs sit loose in `.git/objects/` recoverable via
        // `git fsck --unreachable`, and the UI's "history sealed" promise
        // becomes a lie. Surface skip-or-failure as a typed error.
        match git::gc_unreachable(&repo)? {
            git::GcOutcome::Pruned => {}
            git::GcOutcome::GitNotAvailable => {
                return Err(crate::error::YarrowError::Other(
                    "Encrypted the note and severed history references, but `git` is not on PATH \
                     so the unreachable plaintext blobs cannot be pruned from .git/objects/. \
                     Install `git`, then run `git gc --prune=now` in the workspace folder to \
                     complete the seal."
                        .to_string(),
                ));
            }
            git::GcOutcome::GcFailed(msg) => {
                return Err(crate::error::YarrowError::Other(format!(
                    "Encrypted the note and severed history references, but the unreachable-blob \
                     prune failed: {msg}. Run `git gc --prune=now` in the workspace folder \
                     manually to complete the seal."
                )));
            }
        }

        let _ = graph::build(&root);
        Ok(note)
    })
}

#[tauri::command]
pub fn cmd_decrypt_note(slug: String, state: State<AppState>) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
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
    let kit_kind = templates::extract_kit_kind(&tpl);
    let body = templates::render(&tpl, &title);
    let note = notes::create(&root, &title)?;
    // 2.1 kit-aware frontmatter. The kit's `<!-- kit: <kind> -->` flag
    // tells us how to seed the new note's tags and privacy. Research
    // kits get `paper` so the @cite picker scopes to them; clinical
    // kits get `clinical` + `private: true` so they register in
    // `.git/info/exclude` and never sync.
    let mut fm = note.frontmatter;
    match kit_kind.as_deref() {
        Some("research") => {
            if !fm.tags.iter().any(|t| t.eq_ignore_ascii_case("paper")) {
                fm.tags.push("paper".into());
            }
        }
        Some("clinical") => {
            if !fm.tags.iter().any(|t| t.eq_ignore_ascii_case("clinical")) {
                fm.tags.push("clinical".into());
            }
            fm.private = true;
        }
        _ => {}
    }
    let saved = notes::write(&root, &note.slug, &body, Some(fm))?;
    let repo = open_repo(&root)?;
    // Skip checkpointing private notes — they shouldn't enter git
    // history, even on the local clone, so the workspace's commit log
    // doesn't leak slug names. The note still saves to disk; just no
    // commit. (`notes::write` has already registered the path in
    // .git/info/exclude, so an unrelated checkpoint elsewhere won't
    // sweep it in either.)
    if !saved.frontmatter.is_private() {
        git::checkpoint(
            &repo,
            &format!("checkpoint: new note \"{}\" from template {}", title, template),
        )?;
    }
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
    let mut note = notes::ensure_daily(&root, &date_iso)?;

    // Sync the auto-generated "Today's threads" section with every note
    // modified on this date, so the journal acts as a navigable spine
    // through the day's work without the user having to hand-link each
    // edited note. No-op when nothing changed / no edits today.
    let threads_changed = notes::reconcile_daily_threads(&root, &date_iso).unwrap_or(false);
    if threads_changed {
        // Re-read so the response reflects the updated body.
        note = notes::read(&root, &notes::daily_slug(&date_iso))?;
    }

    if created_now || threads_changed {
        // Checkpoint on first creation, or when we just refreshed the
        // threads section — both are user-visible content changes.
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
    notes::validate_slug(&from)?;
    notes::validate_slug(&to)?;
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
pub fn cmd_remove_link(
    from: String,
    to: String,
    link_type: String,
    state: State<AppState>,
) -> Result<()> {
    notes::validate_slug(&from)?;
    notes::validate_slug(&to)?;
    let root = state.require_root()?;
    notes::remove_link(&root, &from, &to, &link_type)?;
    let repo = open_repo(&root)?;
    git::checkpoint(
        &repo,
        &format!("checkpoint: disconnect {} → {} ({})", from, to, link_type),
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
    notes::validate_slug(&slug)?;
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
    let outcome = git::merge_into_current(&repo, &from)?;
    // Merging a branch can rewrite many files at once — drop the cache
    // so the next save_full re-reads what's now on disk.
    state.scan_cache_invalidate();
    Ok(outcome)
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
    // Also sweep any per-path scratch content when deleting the path, so a
    // path that's been "thrown away" doesn't leave dangling overrides on
    // disk that could surface if the user later creates a same-named path.
    let _ = path_content::delete_overrides_for_path(&root, &name);
    path_collections::delete(&root, &name)
}

/// Result of promoting a path to main — returned to the frontend so the UI
/// can summarize what actually happened ("applied 3 edits, archived path").
#[derive(serde::Serialize)]
pub struct PromoteOutcome {
    pub applied_slugs: Vec<String>,
    pub path_name: String,
}

/// Promote a path to main: every override the path holds is written back
/// onto the main note (preserving each note's encryption), the path's
/// scratch dir is cleared, the path collection is removed, and a single
/// git checkpoint captures the whole promotion. Returns the list of slugs
/// that changed so the frontend can flash a summary.
#[tauri::command]
pub fn cmd_promote_path_to_main(
    name: String,
    thinking_note: Option<String>,
    state: State<AppState>,
) -> Result<PromoteOutcome> {
    let root = state.require_root()?;
    let plan = path_collections::build_promote_plan(&root, &name)?;

    // If any main note is encrypted, the session must be unlocked so we
    // don't silently write plaintext over ciphertext. Fail loudly.
    for (slug, _) in &plan.applied_slugs {
        if let Ok(n) = notes::read_with_key(&root, slug, None) {
            if n.encrypted {
                let _ = require_key(&state, &root)?;
                break;
            }
        }
    }

    let applied: Vec<String> = state.with_repo_locked(|| -> Result<Vec<String>> {
        let mut done = Vec::with_capacity(plan.applied_slugs.len());
        for (slug, body) in &plan.applied_slugs {
            // Each main note keeps its own encryption status — if it was
            // encrypted, notes::write_with_key_status uses the session key
            // to re-seal; if plaintext, body is written as-is. We don't
            // carry frontmatter from the override (overrides are body-only
            // at rest), so main's frontmatter (title/tags/etc) stays put.
            let existing = notes::read_with_key(&root, slug, None).ok();
            let is_encrypted = existing.as_ref().map(|n| n.encrypted).unwrap_or(false);
            let key = if is_encrypted {
                Some(require_key(&state, &root)?)
            } else {
                None
            };
            notes::write_with_key(&root, slug, body, None, key.as_ref())?;
            done.push(slug.clone());
        }
        let repo = open_repo(&root)?;
        let mut msg = format!("promote: {} ({} notes updated)", name, plan.override_count);
        if let Some(t) = thinking_note.as_ref().filter(|s| !s.trim().is_empty()) {
            msg.push_str("\n\n");
            msg.push_str(t.trim());
        }
        git::checkpoint(&repo, &msg)?;
        let _ = graph::build(&root);
        Ok(done)
    })?;

    // Promote rewrites every member's main-note body in one go, so the
    // cache could be stale on many slugs at once. Drop it; the next
    // save_full will rebuild from the post-promote disk state.
    state.scan_cache_invalidate();

    // After a successful checkpoint, clean up the path. Done outside the
    // repo lock because it only touches `.yarrow/`.
    path_collections::finalize_promote(&root, &name)?;

    Ok(PromoteOutcome {
        applied_slugs: applied,
        path_name: name,
    })
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
pub fn cmd_set_path_collection_color(
    name: String,
    color: Option<String>,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    path_collections::set_color(&root, &name, color.as_deref())
}

/// "Set aside" / "Bring back" — toggle a path's archived flag. The
/// path stays on disk with all its overlays and history intact; only
/// the active list and the path-map dim treatment change.
#[tauri::command]
pub fn cmd_set_path_archived(
    name: String,
    archived: bool,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    path_collections::set_archived(&root, &name, archived)
}

/// For a given note, list which non-root paths have an override (i.e.
/// where this note's body diverges from main on that path). Empty list
/// when the note is identical across every path. Used by the editor
/// metadata strip's path-awareness line and by the path map for
/// per-path divergence counts.
#[tauri::command]
pub fn cmd_paths_diverging_for_note(
    slug: String,
    state: State<AppState>,
) -> Result<Vec<String>> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let view = match path_collections::read_all(&root) {
        Ok(v) => v,
        Err(_) => return Ok(Vec::new()),
    };
    let mut out = Vec::new();
    for c in view.collections.iter() {
        if c.name == view.root {
            continue;
        }
        if path_content::has_override(&root, &c.name, &slug) {
            out.push(c.name.clone());
        }
    }
    Ok(out)
}

/// Per-path divergence summary for the whole workspace: for each
/// non-root path, how many notes have an override. The path map uses
/// this to render the spec's "5 differ from main" badge without
/// fanning out to one IPC per card.
#[derive(serde::Serialize)]
pub struct PathDivergenceSummary {
    pub name: String,
    pub differs: usize,
    /// Slugs whose body diverges on this path. Frontend uses this to
    /// drive cell-level indicators (e.g. ◐ in the decision matrix).
    pub slugs: Vec<String>,
}

#[tauri::command]
pub fn cmd_path_divergence_summary(
    state: State<AppState>,
) -> Result<Vec<PathDivergenceSummary>> {
    let root = state.require_root()?;
    let view = match path_collections::read_all(&root) {
        Ok(v) => v,
        Err(_) => return Ok(Vec::new()),
    };
    let mut out = Vec::new();
    for c in view.collections.iter() {
        if c.name == view.root {
            continue;
        }
        let slugs = path_content::list_overridden_slugs(&root, &c.name).unwrap_or_default();
        out.push(PathDivergenceSummary {
            differs: slugs.len(),
            name: c.name.clone(),
            slugs,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn cmd_set_path_collection_auto_tag(
    name: String,
    tag: Option<String>,
    state: State<AppState>,
) -> Result<()> {
    let root = state.require_root()?;
    path_collections::set_auto_membership_tag(&root, &name, tag.as_deref())?;
    // Immediately reconcile with the current workspace state so the
    // user sees auto-membership kick in before their next save.
    let _ = reconcile_auto_paths(&root);
    Ok(())
}

#[tauri::command]
pub fn cmd_suggest_path_clusters(
    state: State<AppState>,
) -> Result<Vec<graph::ClusterSuggestion>> {
    let root = state.require_root()?;
    let g = graph::build(&root)?;
    let view = path_collections::read_all(&root)?;
    let existing: Vec<std::collections::HashSet<String>> = view
        .collections
        .iter()
        .map(|c| c.members.iter().cloned().collect())
        .collect();
    Ok(graph::cluster_suggestions(&g, &existing, 6))
}

/// Read every note's frontmatter tags and let path_collections reconcile.
/// Cheap on small/medium vaults; for giant vaults it's O(N) IO per call
/// but we only invoke after user-visible state-change events, not on
/// every keystroke.
fn reconcile_auto_paths(workspace: &std::path::Path) -> Result<usize> {
    let summaries = notes::list(workspace)?;
    let mut by_slug: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for s in summaries {
        by_slug.insert(s.slug, s.tags);
    }
    Ok(path_collections::reconcile_auto_membership(workspace, &by_slug)?)
}

#[tauri::command]
pub fn cmd_set_path_collection_main_note(
    name: String,
    slug: Option<String>,
    state: State<AppState>,
) -> Result<()> {
    if let Some(s) = slug.as_deref() {
        notes::validate_slug(s)?;
    }
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
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    path_collections::add_member(&root, &name, &slug)
}

#[tauri::command]
pub fn cmd_remove_note_from_path_collection(
    name: String,
    slug: String,
    state: State<AppState>,
) -> Result<()> {
    notes::validate_slug(&slug)?;
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
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::note_history(&repo, &notes::relative_note_path(&slug))
}

#[tauri::command]
pub fn cmd_writing_activity(
    days: u32,
    state: State<AppState>,
) -> Result<Vec<git::ActivityDay>> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::writing_activity(&repo, days)
}

#[tauri::command]
pub fn cmd_note_at_checkpoint(
    slug: String,
    oid: String,
    state: State<AppState>,
) -> Result<String> {
    notes::validate_slug(&slug)?;
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
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    let oid = git2::Oid::from_str(&oid).map_err(|e| YarrowError::Invalid(e.to_string()))?;
    git::restore_note(&repo, &root, &notes::relative_note_path(&slug), oid)?;
    let _ = state.scan_cache_apply_save(&root, Some(&slug));
    Ok(())
}

#[tauri::command]
pub fn cmd_paragraph_provenance(
    slug: String,
    line: u32,
    state: State<AppState>,
) -> Result<git::Provenance> {
    notes::validate_slug(&slug)?;
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

// ───────── keepsakes (pinned checkpoints) ─────────

#[tauri::command]
pub fn cmd_pin_checkpoint(
    slug: String,
    oid: String,
    label: String,
    note: Option<String>,
    state: State<AppState>,
) -> Result<git::Keepsake> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    let label = label.trim();
    if label.is_empty() {
        return Err(YarrowError::Invalid("keepsake needs a label".into()));
    }
    git::pin_checkpoint(
        &repo,
        &slug,
        &oid,
        label,
        note.as_deref().unwrap_or("").trim(),
    )
}

#[tauri::command]
pub fn cmd_list_pinned_checkpoints(state: State<AppState>) -> Result<Vec<git::Keepsake>> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::list_keepsakes(&repo)
}

#[tauri::command]
pub fn cmd_unpin_checkpoint(id: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::unpin_checkpoint(&repo, &id)
}

// ───────── sync ─────────

#[tauri::command]
pub fn cmd_sync(state: State<AppState>) -> Result<git::SyncOutcome> {
    eprintln!("[yarrow] cmd_sync: entry");
    let root = state.require_root()?;
    // A successful sync may pull, fast-forward, or merge — any of which
    // can rewrite many note files at once. Drop the scan cache up
    // front so whatever's on disk after sync is the source of truth
    // for the next save_full's cache rebuild.
    state.scan_cache_invalidate();
    let mut cfg = workspace::read_config(&root)?;
    let repo = open_repo(&root)?;
    eprintln!(
        "[yarrow] cmd_sync: root={} server_configured={} pat_present={}",
        root.display(),
        cfg.sync.server.is_some(),
        cfg.sync.server_pat.is_some(),
    );

    // Capture any pending working-tree edits BEFORE fetching from the
    // server. Without this, a fast-forward pull would force-checkout
    // the server's version over the user's unsaved changes, silently
    // losing whatever hadn't been auto-checkpointed yet (autosave
    // debounces; users who click Sync mid-typing outrun the timer).
    // Post-checkpoint the working tree matches HEAD, so force-checkout
    // after FF is safe, and a real divergence hits the merge path
    // with the user's intent preserved as a real commit.
    if repo.head().is_ok() {
        match git::checkpoint(&repo, "autocheckpoint: pre-sync") {
            Ok(_) => eprintln!("[yarrow] cmd_sync: pre-sync checkpoint ok"),
            Err(e) => eprintln!("[yarrow] cmd_sync: pre-sync checkpoint failed: {e}"),
        }
    } else {
        eprintln!("[yarrow] cmd_sync: no HEAD yet — fresh workspace");
    }

    // Server mode wins when configured. Falls through to the generic
    // remote only if no Yarrow server is attached to this workspace.
    if let Some(server) = cfg.sync.server.clone() {
        eprintln!(
            "[yarrow] cmd_sync: server path workspace_id={:?} url={}",
            server.workspace_id, server.server_url
        );
        let pat = cfg.sync.server_pat.as_deref().ok_or_else(|| {
            YarrowError::Other(
                "Your access token for this server isn't on this machine. Reconnect in Settings.".into(),
            )
        })?;

        // First sync? Adopt an existing same-named workspace if the
        // user already has one on this server, else create a new one.
        // Adopt-first prevents the duplicate-card race: two concurrent
        // syncs (autosync + manual click, or two recoveries after a
        // web-side delete) would each POST /workspaces and mint
        // different UUIDs, leaving the dashboard showing twin cards.
        // Listing first makes the create idempotent for this common case.
        let workspace_id = match server.workspace_id.clone() {
            Some(id) => id,
            None => {
                let name = server
                    .workspace_name
                    .clone()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| cfg.workspace.name.clone());
                let id = match crate::server::find_workspace_by_name(
                    &server.server_url,
                    &server.email,
                    pat,
                    &name,
                    server.insecure_skip_tls_verify,
                ) {
                    Ok(Some(existing)) => {
                        eprintln!(
                            "[yarrow] cmd_sync: adopting existing server workspace id={}",
                            existing.id
                        );
                        existing.id
                    }
                    _ => {
                        let created = crate::server::create_workspace(
                            &server.server_url,
                            &server.email,
                            pat,
                            &name,
                            server.insecure_skip_tls_verify,
                        )?;
                        eprintln!(
                            "[yarrow] cmd_sync: created new server workspace id={}",
                            created.id
                        );
                        created.id
                    }
                };
                // Persist the id so reconnect flows don't re-list /
                // re-create every sync.
                if let Some(s) = cfg.sync.server.as_mut() {
                    s.workspace_id = Some(id.clone());
                }
                workspace::write_config(&root, &cfg)?;
                id
            }
        };

        // E2E (spec §8.1 option 3): unlock the workspace on the server
        // before the sync runs. The server rejects /git/ with 423
        // Locked if this hasn't happened for the current session.
        //
        // If the in-process AppState doesn't have the privkey (app just
        // launched), try to restore it from the OS keychain. Only if
        // BOTH fail do we tell the user to reconnect.
        let server_identity = match state.server_identity() {
            Some(id) => Some(id),
            None => {
                let restored = crate::secrets::read_server_privkey(&root);
                if let Some((priv_b, pub_b)) = restored {
                    state.set_server_identity(priv_b, pub_b);
                    Some((priv_b, pub_b))
                } else {
                    None
                }
            }
        };
        let Some((server_priv, server_pub)) = server_identity else {
            eprintln!("[yarrow] cmd_sync: no server identity in AppState or keychain → reconnect error");
            return Err(YarrowError::Other(
                "Server requires re-connecting to unlock your workspace. Reconnect \
                 via Settings → Server to derive the key again (one password prompt)."
                    .into(),
            ));
        };
        eprintln!("[yarrow] cmd_sync: identity ok, calling /unlock");
        let workspace_id = match crate::server::unlock_workspace_on_server(
            &server.server_url,
            &server.email,
            pat,
            &workspace_id,
            &server_priv,
            &server_pub,
            server.insecure_skip_tls_verify,
        ) {
            Ok(()) => workspace_id,
            Err(YarrowError::RemoteWorkspaceGone) => {
                // The workspace_id we had is dead on the server
                // (deleted via web, etc). Before POSTing a fresh one,
                // check whether another device on this account already
                // recreated a same-named workspace we should adopt —
                // otherwise two devices recovering in parallel each
                // mint their own copy and the dashboard ends up with
                // twin "One month in Europe" cards. Adopt-first makes
                // the recovery idempotent across clients.
                eprintln!(
                    "[yarrow] cmd_sync: server workspace gone — adopting existing or recreating"
                );
                let name = server
                    .workspace_name
                    .clone()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| cfg.workspace.name.clone());
                let new_id = match crate::server::find_workspace_by_name(
                    &server.server_url,
                    &server.email,
                    pat,
                    &name,
                    server.insecure_skip_tls_verify,
                ) {
                    Ok(Some(existing)) => {
                        eprintln!(
                            "[yarrow] cmd_sync: adopted existing workspace id={}",
                            existing.id
                        );
                        existing.id
                    }
                    _ => {
                        let created = crate::server::create_workspace(
                            &server.server_url,
                            &server.email,
                            pat,
                            &name,
                            server.insecure_skip_tls_verify,
                        )?;
                        eprintln!(
                            "[yarrow] cmd_sync: created replacement workspace id={}",
                            created.id
                        );
                        created.id
                    }
                };
                if let Some(s) = cfg.sync.server.as_mut() {
                    s.workspace_id = Some(new_id.clone());
                }
                workspace::write_config(&root, &cfg)?;
                crate::server::unlock_workspace_on_server(
                    &server.server_url,
                    &server.email,
                    pat,
                    &new_id,
                    &server_priv,
                    &server_pub,
                    server.insecure_skip_tls_verify,
                )?;
                new_id
            }
            Err(e) => return Err(e),
        };
        eprintln!("[yarrow] cmd_sync: /unlock returned ok");

        // ── pre-push quota check (stage 1 of the trash/quota rework) ──
        //
        // Before handing the pack to libgit2, estimate how many net-new
        // bytes it would ship and compare against the server's current
        // quota. If the push would exceed the tightest remaining cap
        // (workspace or user, whichever is lower), bail locally with a
        // structured SyncOutcome that names the biggest culprit files —
        // no network upload, no retry loop. Keeps the server's 413 path
        // as a backstop for older clients.
        //
        // Non-fatal on probe or estimate error: fall through to the
        // existing sync and let the server enforce. The pre-push check
        // is an optimization, not a correctness gate.
        let quota_probe = crate::server::fetch_quota(
            &server.server_url,
            &server.email,
            pat,
            &workspace_id,
            server.insecure_skip_tls_verify,
        );
        if let Ok(quota) = &quota_probe {
            let branch = git::current_path_name(&repo)
                .unwrap_or_else(|_| "main".to_string());
            let tracking_ref = git::server_tracking_ref(&branch);
            if let Ok(estimate) = git::estimate_push_size(&repo, &tracking_ref) {
                if let Some(remaining) = quota.tightest_remaining_bytes() {
                    if estimate.bytes > remaining {
                        let biggest = estimate
                            .culprits
                            .first()
                            .map(|c| c.path.clone())
                            .unwrap_or_else(|| "<unknown>".to_string());
                        let message = format!(
                            "sync paused: this push would add {} MB but only {} MB is free — delete \
                             or shrink a file before syncing again",
                            estimate.bytes / 1_000_000,
                            remaining / 1_000_000,
                        );
                        eprintln!(
                            "[yarrow] cmd_sync: pre-push quota check blocked: est={} rem={} biggest={}",
                            estimate.bytes, remaining, biggest
                        );
                        return Ok(git::SyncOutcome::blocked_skeleton(
                            message,
                            git::QuotaBlockInfo {
                                estimated_bytes: estimate.bytes,
                                remaining_bytes: remaining,
                                culprits: estimate.culprits,
                                shrink_hint: format!("yarrow shrink {biggest}"),
                            },
                        ));
                    }
                }
            }
        } else if let Err(e) = &quota_probe {
            eprintln!(
                "[yarrow] cmd_sync: quota probe failed (non-fatal, falling through): {e}"
            );
        }

        let git_url = crate::server::git_url(&server.server_url, &workspace_id)?;
        eprintln!("[yarrow] cmd_sync: calling sync_to_server url={}", git_url);
        let outcome = git::sync_to_server(
            &repo,
            &git_url,
            &server.email,
            pat,
            server.insecure_skip_tls_verify,
        );
        match &outcome {
            Ok(o) => eprintln!("[yarrow] cmd_sync: sync_to_server ok: {:?}", o),
            Err(e) => eprintln!("[yarrow] cmd_sync: sync_to_server ERROR: {e}"),
        }

        // Post-push backstop for the pre-push quota check.
        //
        // The pre-push probe in this function can miss a quota
        // rejection (stale probe, new commit in the few milliseconds
        // between probe and push, server-side per-user cap tightening
        // mid-sync, etc.). In that case libgit2 surfaces the server's
        // 413 as an opaque "unexpected http status code: 413" which
        // the frontend would otherwise render as a scary raw toast.
        //
        // Detect the 413 signature in the outcome message, re-probe
        // quota + re-estimate culprits, and attach a QuotaBlockInfo so
        // the shared QuotaBlockedModal surfaces instead of the raw
        // libgit2 string. If any part of the re-probe fails we still
        // attach a zeroed QuotaBlockInfo so the user at least sees the
        // friendly modal + reference code rather than a wall of jargon.
        if let Ok(mut sync_out) = outcome {
            if !sync_out.ok
                && sync_out.quota_blocked.is_none()
                && looks_like_quota_rejection(&sync_out.message)
            {
                let branch = git::current_path_name(&repo)
                    .unwrap_or_else(|_| "main".to_string());
                let tracking_ref = git::server_tracking_ref(&branch);
                let estimate = git::estimate_push_size(&repo, &tracking_ref)
                    .unwrap_or_else(|_| git::PushEstimate {
                        bytes: 0,
                        culprits: Vec::new(),
                    });
                let remaining = crate::server::fetch_quota(
                    &server.server_url,
                    &server.email,
                    pat,
                    &workspace_id,
                    server.insecure_skip_tls_verify,
                )
                .ok()
                .and_then(|q| q.tightest_remaining_bytes())
                .unwrap_or(0);
                let biggest = estimate
                    .culprits
                    .first()
                    .map(|c| c.path.clone())
                    .unwrap_or_else(|| "your pending changes".to_string());
                eprintln!(
                    "[yarrow] cmd_sync: 413 backstop — rewrote outcome to quota_blocked (est={} rem={})",
                    estimate.bytes, remaining
                );
                sync_out.message = "the server doesn't have room for this sync yet"
                    .to_string();
                sync_out.quota_blocked = Some(git::QuotaBlockInfo {
                    estimated_bytes: estimate.bytes,
                    remaining_bytes: remaining,
                    culprits: estimate.culprits,
                    shrink_hint: format!("yarrow shrink {biggest}"),
                });
            }
            return Ok(sync_out);
        }
        return outcome.map_err(crate::error::classify_sync_error);
    }

    eprintln!("[yarrow] cmd_sync: server NOT configured, falling through to generic remote");
    if cfg.sync.remote_url.is_none() {
        eprintln!("[yarrow] cmd_sync: no remote_url either → NoRemote");
        return Err(YarrowError::NoRemote);
    }
    git::sync(&repo, "origin", cfg.sync.token.as_deref())
        .map_err(crate::error::classify_sync_error)
}

// ───────── reclaim-space ─────────
//
// Lists the biggest files in the workspace's history (including ones
// that have been deleted locally but are still in git history eating
// quota), then permanently removes the selected ones via the server's
// filter-repo endpoint. Irreversible. The server broadcasts
// `workspace.purged` on success so every device — including this one
// — should force-reclone after the call returns.

#[tauri::command]
pub fn cmd_list_large_blobs(
    state: State<AppState>,
) -> Result<Vec<crate::server::LargeBlobEntry>> {
    let root = state.require_root()?;
    let cfg = workspace::read_config(&root)?;
    let server = cfg.sync.server.as_ref().ok_or(YarrowError::NoRemote)?;
    let pat = cfg
        .sync
        .server_pat
        .as_deref()
        .ok_or(YarrowError::NoRemote)?;
    let workspace_id = server
        .workspace_id
        .as_deref()
        .ok_or_else(|| YarrowError::Other("this workspace isn't linked to a server yet".into()))?;
    crate::server::list_large_blobs(
        &server.server_url,
        &server.email,
        pat,
        workspace_id,
        server.insecure_skip_tls_verify,
    )
}

#[tauri::command]
pub fn cmd_reclaim_space(
    state: State<AppState>,
    paths: Vec<String>,
    expected_disk_bytes: Option<i64>,
) -> Result<crate::server::ReclaimSpaceOutcome> {
    if paths.is_empty() {
        return Err(YarrowError::Invalid(
            "select at least one file to permanently delete".into(),
        ));
    }
    let root = state.require_root()?;
    let cfg = workspace::read_config(&root)?;
    let server = cfg.sync.server.as_ref().ok_or(YarrowError::NoRemote)?;
    let pat = cfg
        .sync
        .server_pat
        .as_deref()
        .ok_or(YarrowError::NoRemote)?;
    let workspace_id = server
        .workspace_id
        .as_deref()
        .ok_or_else(|| YarrowError::Other("this workspace isn't linked to a server yet".into()))?;
    crate::server::reclaim_space(
        &server.server_url,
        &server.email,
        pat,
        workspace_id,
        &paths,
        expected_disk_bytes,
        server.insecure_skip_tls_verify,
    )
}

/// Pattern-match a SyncOutcome.message against the shapes the server's
/// 413 "storage quota exceeded" response can take by the time it has
/// been translated through libgit2's HTTP transport. Conservative —
/// erring on false-positive is fine (worst case the modal appears for
/// a non-quota error and the user sees "0 over" + can dismiss).
fn looks_like_quota_rejection(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    // Most specific first. The 413 status code surfaces both as
    // "unexpected http status code: 413" (libgit2's default) and as
    // "payload too large" (server's human message in the push-ref
    // rejection line). The "quota" token catches the server's own
    // message on the push-ref-reject path.
    lower.contains("413")
        || lower.contains("payload too large")
        || lower.contains("storage quota")
        || lower.contains("over quota")
        || lower.contains("quota exceeded")
}

// ───────── discard unsynced local changes ─────────
//
// The escape hatch for stage 1's pre-push quota reject: when a too-big
// file is stuck in unpushed local history and the user doesn't need the
// commits that contain it, this hard-resets the local branch to the
// server tip. Any local work since the last sync is lost — the UI
// warns the user with a preview list before calling this with
// `confirm=true`.

/// Preview or perform the discard. `confirm=false` returns the list of
/// commits that would be thrown away without touching the repo;
/// `confirm=true` runs `git reset --hard <tracking-tip>` and returns
/// the same summary with `performed: true`.
#[tauri::command]
pub fn cmd_discard_unsynced_changes(
    state: State<AppState>,
    confirm: bool,
) -> Result<git::DiscardOutcome> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    let branch = git::current_path_name(&repo)?;
    let tracking_ref = git::server_tracking_ref(&branch);
    let outcome = git::discard_unsynced_commits(&repo, &tracking_ref, confirm)?;
    if confirm {
        state.scan_cache_invalidate();
    }
    Ok(outcome)
}

/// Post-reclaim recovery: fetch the server's new history (no push)
/// and hard-reset local onto it. Used by the `workspace.purged`
/// WebSocket handler AND by a user-triggered "my app is stuck" button
/// in the Storage settings pane.
///
/// Why this exists separately from `cmd_sync`: after the server has
/// rewritten history (filter-repo), the desktop's local branch is on
/// a lineage the server no longer knows. A plain `cmd_sync` would
/// try to push those orphaned commits — which re-introduces the
/// exact blobs the server just purged. We need a one-way "absorb
/// server state, discard mine" operation instead.
///
/// `confirm=false` previews (same semantics as discard_unsynced_changes);
/// `confirm=true` actually runs the fetch + hard-reset.
#[tauri::command]
pub fn cmd_force_align_with_server(
    state: State<AppState>,
    confirm: bool,
) -> Result<git::DiscardOutcome> {
    let root = state.require_root()?;
    let cfg = workspace::read_config(&root)?;
    let server = cfg.sync.server.as_ref().ok_or(YarrowError::NoRemote)?;
    let pat = cfg
        .sync
        .server_pat
        .as_deref()
        .ok_or(YarrowError::NoRemote)?;
    let workspace_id = server
        .workspace_id
        .as_deref()
        .ok_or_else(|| YarrowError::Other("this workspace isn't linked to a server yet".into()))?;
    let repo = open_repo(&root)?;

    // Refresh the tracking ref first — without this, a stale tracking
    // ref from a pre-purge sync would make the subsequent hard-reset
    // a no-op (or worse, reset to the old sha that's gone from the
    // server). Only runs when `confirm=true`; the preview-only path
    // uses whatever tracking state is already on disk.
    if confirm {
        let git_url = crate::server::git_url(&server.server_url, workspace_id)?;
        git::fetch_from_server(
            &repo,
            &git_url,
            &server.email,
            pat,
            server.insecure_skip_tls_verify,
        )?;
    }

    let branch = git::current_path_name(&repo)?;
    let tracking_ref = git::server_tracking_ref(&branch);
    let outcome = git::discard_unsynced_commits(&repo, &tracking_ref, confirm)?;
    if confirm {
        state.scan_cache_invalidate();
    }
    Ok(outcome)
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

// Write arbitrary UTF-8 text to a user-chosen filesystem path. Used by
// the Settings → About export-as-JSON flow so the frontend can hand the
// path returned from `dialog.save(...)` to the backend without needing
// the tauri-plugin-fs file-write capability. Path is whatever the user
// just picked in the OS save dialog — no traversal hardening needed
// beyond what the OS already enforces (the file picker is the gate).
#[tauri::command]
pub fn cmd_write_text_file(path: String, content: String) -> Result<()> {
    let p = PathBuf::from(path);
    if let Some(parent) = p.parent() {
        // Best-effort parent-dir create — most OS save dialogs already
        // ensure the parent exists, but if a user typed a fresh subdir
        // into the filename field we don't want the write to fail just
        // because that one directory hasn't been mkdir'd yet.
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| {
                YarrowError::Other(format!(
                    "Could not create directory for export: {}",
                    e
                ))
            })?;
        }
    }
    std::fs::write(&p, content.as_bytes())
        .map_err(|e| YarrowError::Other(format!("Could not write file: {}", e)))
}

// ───────── search ─────────

#[tauri::command]
pub fn cmd_search(
    query: String,
    limit: Option<usize>,
    state: State<AppState>,
) -> Result<Vec<search::SearchHit>> {
    let root = state.require_root()?;
    // Read the per-workspace toggle. A missing/broken config means the
    // cache is allowed — the defaulted value is `true` — so users who
    // never touched Settings still get the fast path.
    let use_index = workspace::read_config(&root)
        .map(|c| c.preferences.search_index_enabled)
        .unwrap_or(true);
    search::search(&root, &query, limit.unwrap_or(25), use_index)
}

/// Fuzzy-rank a list of candidate strings against a query (2.1.0).
/// Powered by `nucleo-matcher` — the same scoring engine Helix uses.
/// Returns at most `limit` `{ index, score }` pairs in score-descending
/// order; missing matches are omitted. An empty/blank query returns
/// the first `limit` candidates at equal score (preserving their
/// original order), so the palette can use the same IPC whether or
/// not the user has typed anything.
///
/// This does no I/O and does NOT require an open workspace — it's pure
/// computation. Kept in `commands.rs` so the Tauri macro picks it up.
#[tauri::command]
pub fn cmd_fuzzy_rank(
    query: String,
    candidates: Vec<String>,
    limit: Option<usize>,
) -> Result<Vec<fuzzy::FuzzyHit>> {
    let cap = limit.unwrap_or(32).max(1).min(1024);
    Ok(fuzzy::rank(&query, &candidates, cap))
}

#[tauri::command]
pub fn cmd_clear_search_index(state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    // Wipe the db file. Rebuild happens lazily on the next search if
    // indexing is still enabled.
    search_index::clear_file(&root).map_err(|e| e.into())
}

/// Clear *every* derived cache: the graph index and the search DB.
/// Notes are untouched; both rebuild on demand (graph on next save,
/// search on next query). Intended for a user-visible "wipe all caches"
/// button — nothing permanent is lost.
#[tauri::command]
pub fn cmd_clear_all_cache(state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    // Graph index — derived from frontmatter links. Safe to delete; the
    // next save rebuilds it via `graph::build`.
    let graph_path = workspace::index_path(&root);
    if graph_path.exists() {
        std::fs::remove_file(&graph_path)?;
    }
    // Search cache — also wipes the WAL/SHM sidecars so we don't reopen
    // a half-committed write-ahead log against a missing main db.
    search_index::clear_file(&root)?;
    Ok(())
}

#[tauri::command]
pub fn cmd_rebuild_search_index(state: State<AppState>) -> Result<usize> {
    let root = state.require_root()?;
    search_index::rebuild(&root).map_err(|e| e.into())
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
    git::resolve_conflict(&repo, &root, &relpath, &content)?;
    state.scan_cache_invalidate();
    Ok(())
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
    state.scan_cache_invalidate();
    Ok(())
}

#[tauri::command]
pub fn cmd_abort_merge(state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::abort_merge(&repo)?;
    state.scan_cache_invalidate();
    Ok(())
}

/// Fetch a URL and extract its `<title>` text. Used by smart paste so a pasted
/// URL becomes a `[title](url)` markdown link. Best-effort: returns empty
/// string on failure so the caller can fall back to the raw URL.
///
/// Hardened against accidental SSRF / scheme misuse:
///   * accepts only `http://` and `https://`
///   * refuses obvious internal targets (loopback, link-local, private
///     IPv4 ranges, the cloud metadata IP) so a user pasting a URL —
///     or a future code path — can't make Yarrow probe the user's
///     intranet on their behalf
///   * caps response body size and overall request time
#[tauri::command]
pub fn cmd_fetch_url_title(url: String) -> Result<String> {
    use std::time::Duration;
    let parsed = url::Url::parse(&url)
        .map_err(|_| YarrowError::Invalid("not a valid URL".into()))?;
    let scheme = parsed.scheme().to_ascii_lowercase();
    if scheme != "http" && scheme != "https" {
        return Err(YarrowError::Invalid(format!(
            "only http(s) URLs are supported, not {scheme}:"
        )));
    }
    if let Some(host) = parsed.host_str() {
        if is_private_or_loopback(host) {
            // Silently succeed with an empty title — smart-paste will leave
            // the raw URL in place. We don't tell the caller why; an error
            // toast for every internal-network paste would be noisy and the
            // user typed the URL themselves anyway.
            return Ok(String::new());
        }
    }
    // Follow up to 3 redirects, but validate every hop against the
    // same private-IP / loopback allowlist — otherwise an attacker-
    // controlled site could 302 us at http://169.254.169.254/… and
    // bypass the pre-request IP check that only sees the initial URL.
    //
    // ureq's `AgentBuilder::redirects(n)` delegates the whole chain to
    // the agent without giving us a hook on each hop, so we do it by
    // hand: `redirects(0)` + a manual loop with explicit re-validation.
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(6))
        .user_agent(concat!("Yarrow/", env!("CARGO_PKG_VERSION"), " (+title-fetch)"))
        .redirects(0)
        .build();
    const MAX_REDIRECTS: u8 = 3;
    let mut current = url.clone();
    let mut hops: u8 = 0;
    let resp = loop {
        let r = match agent.get(&current).call() {
            Ok(r) => r,
            // ureq classifies 3xx as "errors" when redirects are off —
            // unwrap the Status error variant and follow manually.
            Err(ureq::Error::Status(code, r)) if (300..400).contains(&code) => r,
            Err(e) => {
                return Err(YarrowError::Other(format!("fetch failed: {e}")));
            }
        };
        if (300..400).contains(&r.status()) {
            if hops >= MAX_REDIRECTS {
                return Ok(String::new()); // give up quietly
            }
            let next = match r.header("location") {
                Some(loc) => loc.to_string(),
                None => return Ok(String::new()),
            };
            // Resolve relative redirects against the current URL.
            let next_abs = match url::Url::parse(&current).and_then(|base| base.join(&next)) {
                Ok(u) => u,
                Err(_) => return Ok(String::new()),
            };
            // Re-validate scheme and host — same checks as the first hop.
            let sch = next_abs.scheme().to_ascii_lowercase();
            if sch != "http" && sch != "https" { return Ok(String::new()); }
            if let Some(host) = next_abs.host_str() {
                if is_private_or_loopback(host) { return Ok(String::new()); }
            }
            current = next_abs.into();
            hops += 1;
            continue;
        }
        break r;
    };
    let mut body = String::new();
    use std::io::Read;
    resp.into_reader()
        .take(512 * 1024)
        .read_to_string(&mut body)
        .map_err(|e| YarrowError::Other(format!("read failed: {e}")))?;
    let title = extract_html_title(&body).unwrap_or_default();
    Ok(title)
}

/// Reject hosts that point at the local machine, link-local addresses,
/// RFC 1918 private IPv4 ranges, and the well-known cloud metadata IP.
/// Best-effort: hostnames that DNS-resolve to private addresses sneak
/// through (we'd need to resolve and re-check post-DNS), but the common
/// "I pasted a URL with the IP in it" case is covered. For a desktop
/// notes app this is the right tradeoff between safety and friction.
fn is_private_or_loopback(host: &str) -> bool {
    use std::net::IpAddr;
    // Strip surrounding brackets if it's a literal IPv6 host.
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    if bare.eq_ignore_ascii_case("localhost") {
        return true;
    }
    if let Ok(ip) = bare.parse::<IpAddr>() {
        match ip {
            IpAddr::V4(v4) => {
                if v4.is_loopback() || v4.is_link_local() || v4.is_private() {
                    return true;
                }
                let octets = v4.octets();
                // 169.254.169.254 is the cloud-metadata service IP.
                if octets == [169, 254, 169, 254] {
                    return true;
                }
                // 0.0.0.0/8 is "this network" (also unroutable).
                if octets[0] == 0 {
                    return true;
                }
            }
            IpAddr::V6(v6) => {
                if v6.is_loopback() || v6.is_unspecified() {
                    return true;
                }
                let segs = v6.segments();
                // fe80::/10 link-local
                if (segs[0] & 0xffc0) == 0xfe80 {
                    return true;
                }
                // fc00::/7 unique local
                if (segs[0] & 0xfe00) == 0xfc00 {
                    return true;
                }
            }
        }
    }
    false
}

fn extract_html_title(html: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let start = lower.find("<title")?;
    let after_open = html[start..].find('>')? + start + 1;
    let end_rel = lower[after_open..].find("</title>")?;
    let raw = &html[after_open..after_open + end_rel];
    let decoded = raw
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ");
    let cleaned = decoded.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.is_empty() { None } else { Some(cleaned) }
}

// ───────── bibliography (2.2.0) ─────────

/// Render a bibliography for `slug` based on its `paper`-tagged
/// wikilinks. Read-only — returns the formatted block; doesn't touch
/// the note. Useful for live preview.
#[tauri::command]
pub fn cmd_render_bibliography(slug: String, state: State<AppState>) -> Result<String> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    state.touch_activity();
    let session = unpoison(state.session.lock());
    let key = session.master_key.as_ref().cloned();
    drop(session);
    let note = notes::read_with_key(&root, &slug, key.as_ref())?;
    bibliography::render(&root, &note.body)
}

/// Render the bibliography and upsert the fenced block into the note's
/// body. Re-runs replace the existing block in place. Returns the new
/// body so the frontend can hot-swap without an extra read.
#[tauri::command]
pub fn cmd_insert_bibliography(slug: String, state: State<AppState>) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    state.touch_activity();
    let session = unpoison(state.session.lock());
    let key = session.master_key.as_ref().cloned();
    drop(session);
    state.with_repo_locked(|| -> Result<notes::Note> {
        let existing = notes::read_with_key(&root, &slug, key.as_ref())?;
        let block = bibliography::render(&root, &existing.body)?;
        let new_body = bibliography::upsert_block(&existing.body, &block);
        if new_body == existing.body {
            return Ok(existing);
        }
        let (note, _changed) =
            notes::write_with_key_status(&root, &slug, &new_body, None, key.as_ref())?;
        let repo = open_repo(&root)?;
        let _ = git::checkpoint(&repo, "checkpoint: refreshed bibliography");
        Ok(note)
    })
}

// ───────── multi-note PDF render (2.2.0) ─────────

/// Render every note in `slugs` into a single standalone HTML document
/// with the same print styling as `cmd_render_note_html`. Each note
/// becomes its own `<section>` with a `page-break-before` CSS hint, so
/// the OS print → save-as-PDF flow yields a clean per-note paginated
/// document. Encrypted notes are skipped silently — they shouldn't end
/// up in a PDF the user later forgets is unencrypted on disk.
#[tauri::command]
pub fn cmd_render_notes_html(slugs: Vec<String>, state: State<AppState>) -> Result<String> {
    let root = state.require_root()?;
    let session = unpoison(state.session.lock());
    let key = session.master_key.as_ref().cloned();
    drop(session);
    render_multi_html(&root, &slugs, key.as_ref(), None)
}

/// Render every note in `path_name` into one document, ordered by the
/// path's stored member list. Empty when the path doesn't exist.
#[tauri::command]
pub fn cmd_render_path_html(path_name: String, state: State<AppState>) -> Result<String> {
    let root = state.require_root()?;
    let session = unpoison(state.session.lock());
    let key = session.master_key.as_ref().cloned();
    drop(session);
    let view = path_collections::read_all(&root)?;
    let slugs: Vec<String> = view
        .collections
        .iter()
        .find(|c| c.name == path_name)
        .map(|c| c.members.clone())
        .unwrap_or_default();
    if slugs.is_empty() {
        return Err(YarrowError::Invalid(format!(
            "no notes in path '{}'",
            path_name
        )));
    }
    render_multi_html(&root, &slugs, key.as_ref(), Some(&path_name))
}

fn render_multi_html(
    root: &std::path::Path,
    slugs: &[String],
    key: Option<&crypto::MasterKey>,
    cover_path_name: Option<&str>,
) -> Result<String> {
    use pulldown_cmark::{html, Options, Parser};

    let mut sections = String::new();
    let mut count = 0usize;
    let mut titles: Vec<String> = Vec::new();
    for slug in slugs {
        let note = match notes::read_with_key(root, slug, key) {
            Ok(n) if !n.encrypted => n,
            _ => continue,
        };
        let mut options = Options::empty();
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_TABLES);
        options.insert(Options::ENABLE_FOOTNOTES);
        options.insert(Options::ENABLE_TASKLISTS);
        let parser = Parser::new_ext(&note.body, options);
        let mut body = String::new();
        html::push_html(&mut body, parser);
        let body = strip_xss_tripwire(&body);
        let title = if note.frontmatter.title.is_empty() {
            note.slug.clone()
        } else {
            note.frontmatter.title.clone()
        };
        titles.push(title.clone());
        sections.push_str(&format!(
            "<section class=\"note\"><h1>{title}</h1>{body}</section>",
            title = html_escape(&title),
            body = body,
        ));
        count += 1;
    }

    let cover_title = cover_path_name
        .map(|n| html_escape(n))
        .unwrap_or_else(|| "Selection".to_string());
    let toc: String = titles
        .iter()
        .map(|t| format!("<li>{}</li>", html_escape(t)))
        .collect();
    let cover = format!(
        "<section class=\"cover\"><h1>{title}</h1>\
        <p class=\"cover-meta\">{count} notes · {date}</p>\
        <ol class=\"toc\">{toc}</ol></section>",
        title = cover_title,
        count = count,
        date = chrono::Utc::now().format("%Y-%m-%d"),
        toc = toc,
    );

    let doc = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title>\
        <style>{css}{multi}</style></head><body>{cover}{sections}</body></html>",
        title = cover_title,
        css = PRINT_CSS,
        multi = MULTI_PRINT_CSS,
        cover = cover,
        sections = sections,
    );
    Ok(doc)
}

const MULTI_PRINT_CSS: &str = r#"
section.note { page-break-before: always; }
section.cover { page-break-after: always; padding-top: 120px; text-align: left; }
section.cover h1 { font-size: 48px; line-height: 1.05; }
.cover-meta { color: #6b6b6b; font-size: 14px; margin-bottom: 32px; }
ol.toc { padding-left: 1.4em; line-height: 1.9; font-size: 14px; }
ol.toc li { margin-bottom: 4px; }
@media print { section { break-inside: avoid-page; } }
"#;

// ───────── smart shopping list (2.2.0) ─────────

/// Scan `slug`'s body for an `## Ingredients` section, append each
/// bullet to the workspace's `Shopping List` note, and return what
/// happened. Idempotent: re-running the same recipe is a no-op past
/// the first time (each line is dedup'd by canonical text + source).
#[tauri::command]
pub fn cmd_add_recipe_to_shopping_list(
    slug: String,
    state: State<AppState>,
) -> Result<shopping_list::ShoppingListOutcome> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    state.touch_activity();
    let session = unpoison(state.session.lock());
    let key = session.master_key.as_ref().cloned();
    drop(session);
    state.with_repo_locked(|| -> Result<shopping_list::ShoppingListOutcome> {
        let note = notes::read_with_key(&root, &slug, key.as_ref())?;
        let items = shopping_list::extract_ingredients(&note.body);
        let title = if note.frontmatter.title.trim().is_empty() {
            slug.clone()
        } else {
            note.frontmatter.title.clone()
        };
        let outcome = shopping_list::add_items(&root, &items, &title)?;
        // Only checkpoint when something actually changed — keeps the
        // history clean if the user hits the command twice.
        if outcome.added > 0 {
            let repo = open_repo(&root)?;
            let _ = git::checkpoint(
                &repo,
                &format!(
                    "checkpoint: added {} item(s) to shopping list from \"{}\"",
                    outcome.added, title
                ),
            );
        }
        Ok(outcome)
    })
}

/// Convenience: returns the slug of the shopping-list note so the
/// frontend can navigate to it after adding items.
#[tauri::command]
pub fn cmd_shopping_list_slug() -> String {
    shopping_list::shopping_list_slug().to_string()
}

// ───────── recipe URL clipper (2.2.0) ─────────

/// Fetch a URL, extract schema.org `Recipe` JSON-LD, and create a new
/// note populated from the clip. The returned `Note` is the freshly-
/// created note so the frontend can navigate to it.
#[tauri::command]
pub fn cmd_clip_recipe(url: String, state: State<AppState>) -> Result<notes::Note> {
    let root = state.require_root()?;
    state.touch_activity();
    // Fetch + parse outside the repo lock — the network call shouldn't
    // block other workspace operations.
    let data = recipe_clip::clip_from_url(&url)?;
    let body = recipe_clip::render_markdown(&data);
    let title = if data.name.trim().is_empty() {
        "Clipped recipe".to_string()
    } else {
        data.name.trim().to_string()
    };
    state.with_repo_locked(|| -> Result<notes::Note> {
        let note = notes::create(&root, &title)?;
        let session = unpoison(state.session.lock());
        let key = session.master_key.as_ref().cloned();
        drop(session);
        let (saved, _changed) =
            notes::write_with_key_status(&root, &note.slug, &body, None, key.as_ref())?;
        let repo = open_repo(&root)?;
        let _ = git::checkpoint(
            &repo,
            &format!("checkpoint: clipped recipe \"{}\"", title),
        );
        let _ = graph::build(&root);
        let _ = path_collections::reconcile_new_note(&root, &saved.slug);
        Ok(saved)
    })
}

// ───────── drafts (Pillar 2) ─────────
//
// Drafts are scratchpad-grade alternative bodies for a note, stored
// under `.yarrow/drafts/<slug>/<draft-id>.md` (gitignored). Spec lives
// in `YARROW_BRANCHING_SPEC.md` §6.2 and the design notes at the top of
// `drafts.rs`. The promote command is the only path that turns a draft
// into a real edit — it replaces the canonical note's body and routes
// through the normal save → checkpoint pipeline so the act of keeping a
// draft shows up in history exactly like any other edit.

#[tauri::command]
pub fn cmd_draft_list_for_note(
    slug: String,
    state: State<AppState>,
) -> Result<Vec<drafts::Draft>> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    drafts::list(&root, &slug)
}

#[tauri::command]
pub fn cmd_draft_create(
    slug: String,
    display_name: String,
    seed_body: String,
    state: State<AppState>,
) -> Result<drafts::Draft> {
    notes::validate_slug(&slug)?;
    let root = state.require_root()?;
    drafts::create(&root, &slug, &display_name, &seed_body)
}

#[tauri::command]
pub fn cmd_draft_read(
    slug: String,
    draft_id: String,
    state: State<AppState>,
) -> Result<String> {
    notes::validate_slug(&slug)?;
    notes::validate_slug(&draft_id)?;
    let root = state.require_root()?;
    drafts::read(&root, &slug, &draft_id)
}

#[tauri::command]
pub fn cmd_draft_save(
    slug: String,
    draft_id: String,
    body: String,
    state: State<AppState>,
) -> Result<()> {
    notes::validate_slug(&slug)?;
    notes::validate_slug(&draft_id)?;
    let root = state.require_root()?;
    drafts::save(&root, &slug, &draft_id, &body)
}

#[tauri::command]
pub fn cmd_draft_rename(
    slug: String,
    draft_id: String,
    display_name: String,
    state: State<AppState>,
) -> Result<()> {
    notes::validate_slug(&slug)?;
    notes::validate_slug(&draft_id)?;
    let root = state.require_root()?;
    drafts::rename(&root, &slug, &draft_id, &display_name)
}

#[tauri::command]
pub fn cmd_draft_discard(
    slug: String,
    draft_id: String,
    state: State<AppState>,
) -> Result<()> {
    notes::validate_slug(&slug)?;
    notes::validate_slug(&draft_id)?;
    let root = state.require_root()?;
    drafts::discard(&root, &slug, &draft_id)
}

/// Promote a draft to the canonical note. Reads the draft body, writes
/// it to the note via the normal write path (preserving frontmatter),
/// emits a single amend-aware checkpoint with a "kept draft" message,
/// then discards the draft file. Returns the saved Note so the frontend
/// can refresh its view.
#[tauri::command]
pub fn cmd_draft_promote(
    slug: String,
    draft_id: String,
    state: State<AppState>,
) -> Result<notes::Note> {
    notes::validate_slug(&slug)?;
    notes::validate_slug(&draft_id)?;
    let root = state.require_root()?;
    let body = drafts::read(&root, &slug, &draft_id)?;

    let existing = notes::read_with_key(&root, &slug, None).ok();
    let is_encrypted = existing.as_ref().map(|n| n.encrypted).unwrap_or(false);
    let key = if is_encrypted {
        Some(require_key(&state, &root)?)
    } else {
        state.touch_activity();
        None
    };

    state.with_repo_locked(|| -> Result<notes::Note> {
        let (note, _changed) =
            notes::write_with_key_status(&root, &slug, &body, None, key.as_ref())?;
        let repo = open_repo(&root)?;
        let title = if note.frontmatter.title.is_empty() {
            note.slug.clone()
        } else {
            note.frontmatter.title.clone()
        };
        // Distinct, human-readable message so the user can spot a
        // promote in history. Still routes through the amend window —
        // a user who promotes one draft, immediately edits, and saves
        // again gets one combined checkpoint, not two.
        let message = format!("checkpoint: kept draft for \"{}\"", title);
        git::checkpoint_or_amend(&repo, &message, &note.slug)?;
        let _ = drafts::discard(&root, &slug, &draft_id);
        let _ = graph::build(&root);
        Ok(note)
    })
}

#[cfg(test)]
mod idle_lock_tests {
    //! Whole-state tests for the encryption idle auto-lock.
    //!
    //! These don't go through Tauri — they exercise [`AppState`]
    //! directly, since the lifecycle that matters is purely
    //! Session-level: set_session_key → touch_activity → current_key/
    //! peek_key → lock_session.
    use super::*;
    use crate::crypto;
    use std::time::Duration;

    fn fresh_state_with_key() -> AppState {
        let st = AppState::default();
        st.set_session_key(crypto::random_master_key());
        st
    }

    #[test]
    fn fresh_session_is_unlocked() {
        let st = fresh_state_with_key();
        assert!(st.is_unlocked());
        assert!(st.current_key(900).is_some());
    }

    #[test]
    fn lock_session_clears_key_immediately() {
        let st = fresh_state_with_key();
        st.lock_session();
        assert!(!st.is_unlocked());
        assert!(st.current_key(900).is_none());
    }

    #[test]
    fn current_key_returns_none_after_idle_expiry() {
        let st = fresh_state_with_key();
        // Force last_activity into the deep past by reaching into the
        // session directly. Subtracting 10 minutes from `Instant::now()`
        // simulates a session that's been idle for 10 minutes.
        {
            let mut s = unpoison(st.session.lock());
            s.last_activity = Instant::now()
                .checked_sub(Duration::from_secs(600))
                .expect("Instant::now - 10min should fit");
        }
        // idle_secs = 300 (5 min) — we've been idle for 600s.
        assert!(st.current_key(300).is_none());
        // The key was zeroed in-place — subsequent calls also return None.
        assert!(!st.is_unlocked());
        assert!(st.current_key(300).is_none());
    }

    #[test]
    fn idle_secs_zero_disables_timeout() {
        let st = fresh_state_with_key();
        {
            let mut s = unpoison(st.session.lock());
            s.last_activity = Instant::now()
                .checked_sub(Duration::from_secs(99_999))
                .unwrap();
        }
        // idle_secs = 0 → timeout disabled, key remains.
        assert!(st.current_key(0).is_some());
        assert!(st.is_unlocked());
    }

    #[test]
    fn current_key_extends_session_on_successful_read() {
        let st = fresh_state_with_key();
        // Push activity 4 minutes into the past.
        {
            let mut s = unpoison(st.session.lock());
            s.last_activity = Instant::now()
                .checked_sub(Duration::from_secs(240))
                .unwrap();
        }
        // Successful current_key read with idle_secs = 300 (5min) — not
        // expired — should reset last_activity to ~now.
        let key = st.current_key(300);
        assert!(key.is_some());
        let elapsed = unpoison(st.session.lock()).last_activity.elapsed();
        assert!(
            elapsed < Duration::from_secs(2),
            "current_key should have reset last_activity to now, got elapsed={elapsed:?}"
        );
    }

    #[test]
    fn peek_key_does_not_extend_session() {
        // The bug-fix lock-in: peek_key MUST NOT reset last_activity.
        // Otherwise the 60-second heartbeat from cmd_activity_ping
        // would keep the session alive forever while the app is open.
        let st = fresh_state_with_key();
        // Push activity 4 minutes into the past.
        let target = Instant::now()
            .checked_sub(Duration::from_secs(240))
            .unwrap();
        {
            let mut s = unpoison(st.session.lock());
            s.last_activity = target;
        }
        // Peek with timeout 300s — not expired, returns the key.
        let key = st.peek_key(300);
        assert!(key.is_some());
        // last_activity is still ~4 minutes ago, NOT now.
        let after = unpoison(st.session.lock()).last_activity;
        assert!(
            after.elapsed() >= Duration::from_secs(238),
            "peek_key must not reset last_activity (elapsed dropped to {:?})",
            after.elapsed()
        );
    }

    #[test]
    fn peek_key_still_clears_on_expiry() {
        // peek_key triggers the lazy zeroize when the timeout has
        // passed, so the heartbeat itself is the natural place for
        // expiry to fire.
        let st = fresh_state_with_key();
        {
            let mut s = unpoison(st.session.lock());
            s.last_activity = Instant::now()
                .checked_sub(Duration::from_secs(901))
                .unwrap();
        }
        assert!(st.peek_key(900).is_none());
        assert!(!st.is_unlocked()); // proves the master key was zeroed
    }

    #[test]
    fn many_peeks_in_a_row_dont_keep_session_alive() {
        // Simulate the heartbeat firing many times during a long idle
        // window. Without the bug fix this loop would extend
        // last_activity on every iteration and the session would never
        // expire.
        let st = fresh_state_with_key();
        // Start at "1 second" of idle — well within timeout.
        {
            let mut s = unpoison(st.session.lock());
            s.last_activity = Instant::now()
                .checked_sub(Duration::from_secs(1))
                .unwrap();
        }
        // Pretend 60 heartbeats fire (60 minutes of polling), with the
        // last_activity manually advanced backwards each time the way
        // a real-time clock would be advancing forward.
        for minutes in 1..=60 {
            // peek
            let _ = st.peek_key(900);
            // simulate "minutes" minutes have actually elapsed since
            // unlock by pushing last_activity that far back.
            let mut s = unpoison(st.session.lock());
            s.last_activity = Instant::now()
                .checked_sub(Duration::from_secs(minutes * 60))
                .unwrap();
        }
        // After 60 minutes (idle_secs=900 = 15 minutes), the next peek
        // must zeroize the key. With the bug, peek_key would have
        // reset last_activity on every iteration and we'd still have
        // the key here.
        assert!(st.peek_key(900).is_none());
        assert!(!st.is_unlocked());
    }

    #[test]
    fn touch_activity_extends_session() {
        let st = fresh_state_with_key();
        {
            let mut s = unpoison(st.session.lock());
            s.last_activity = Instant::now()
                .checked_sub(Duration::from_secs(800))
                .unwrap();
        }
        // 800s in past, timeout 900s — still alive.
        st.touch_activity();
        // After touch, peek with 900s timeout still alive AND
        // last_activity is now (not 800s ago).
        let key = st.peek_key(900);
        assert!(key.is_some());
        let elapsed = unpoison(st.session.lock()).last_activity.elapsed();
        assert!(elapsed < Duration::from_secs(2));
    }

    #[test]
    fn lock_session_zeroes_history_cache_too() {
        let st = fresh_state_with_key();
        // Seed the history cache with one entry.
        {
            let mut s = unpoison(st.session.lock());
            s.history_cache.insert(
                ("note-1".into(), "deadbeef".into()),
                Zeroizing::new("plaintext-body".into()),
            );
        }
        st.lock_session();
        let s = unpoison(st.session.lock());
        assert!(s.master_key.is_none());
        assert!(s.history_cache.is_empty());
    }

    #[test]
    fn idle_expiry_zeroes_history_cache_too() {
        let st = fresh_state_with_key();
        {
            let mut s = unpoison(st.session.lock());
            s.history_cache.insert(
                ("note-1".into(), "deadbeef".into()),
                Zeroizing::new("plaintext-body".into()),
            );
            s.last_activity = Instant::now()
                .checked_sub(Duration::from_secs(901))
                .unwrap();
        }
        // Trigger expiry via current_key.
        let _ = st.current_key(900);
        let s = unpoison(st.session.lock());
        assert!(s.master_key.is_none());
        assert!(
            s.history_cache.is_empty(),
            "history cache must be cleared on idle expiry"
        );
    }
}

