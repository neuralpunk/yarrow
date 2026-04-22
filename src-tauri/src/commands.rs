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
use crate::find_replace;
use crate::foreign_import;
use crate::git;
use crate::graph;
use crate::notes;
use crate::obsidian_import;
use crate::path_collections;
use crate::path_content;
use crate::path_meta;
use crate::sample_vault;
use crate::search;
use crate::search_index;
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
        let (note, changed) =
            notes::write_with_key_status(&root, &slug, &body, None, key.as_ref())?;
        if !changed {
            // No checkpoint, no scan, no graph rebuild. The frontend gates
            // its setState calls on `changed` so a no-op save costs roughly
            // one disk-stat per second of typing — basically free.
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
        // ONE scan of the notes dir powers all three derived views: the
        // sidebar's `notes` list, the connection `graph`, and the orphan
        // list. Cuts the per-save file-read count roughly in half on big
        // workspaces.
        let scanned = notes::scan(&root)?;
        let mut summaries: Vec<notes::NoteSummary> =
            scanned.iter().map(notes::summary_from).collect();
        summaries.sort_by(|a, b| b.modified.cmp(&a.modified));

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

        let (g, orphans) = if is_mapped {
            // Auto-path reconciliation: if this save changed tags
            // (common) and any path has `auto_membership_tag` set,
            // sync membership before we hand fresh summaries back to
            // the frontend.
            let mut by_slug: std::collections::HashMap<String, Vec<String>> =
                std::collections::HashMap::new();
            for s in &summaries {
                by_slug.insert(s.slug.clone(), s.tags.clone());
            }
            let _ = path_collections::reconcile_auto_membership(&root, &by_slug);
            let g = graph::build_from_scan(&root, &scanned);
            let orphans = graph::orphan_slugs(&g);
            (g, orphans)
        } else {
            (
                graph::Graph {
                    notes: Vec::new(),
                    links: Vec::new(),
                    last_built: String::new(),
                    tags: Vec::new(),
                },
                Vec::new(),
            )
        };

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
    let root = state.require_root()?;
    path_content::delete_override(&root, &path_name, &slug)
}


#[tauri::command]
pub fn cmd_create_note(title: String, state: State<AppState>) -> Result<notes::Note> {
    let root = state.require_root()?;
    let note = notes::create(&root, &title)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: new note \"{}\"", title))?;
    let _ = graph::build(&root);
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
    let root = state.require_root()?;
    let note = notes::rename(&root, &old_slug, &new_title, rewrite_wikilinks)?;
    let repo = open_repo(&root)?;
    let suffix = if rewrite_wikilinks { " (wikilinks updated)" } else { "" };
    git::checkpoint(&repo, &format!("checkpoint: rename to \"{}\"{}", new_title, suffix))?;
    let _ = graph::build(&root);
    Ok(note)
}

#[tauri::command]
pub fn cmd_count_wikilink_references(slug: String, state: State<AppState>) -> Result<usize> {
    let root = state.require_root()?;
    notes::count_wikilink_refs(&root, &slug)
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

/// Replace the note's tag list. Tags are stored in YAML frontmatter; the
/// editor's tag chip-input calls this to merge user edits in. Empty / blank
/// tags are filtered out and duplicates collapsed (case-sensitive).
#[tauri::command]
pub fn cmd_set_tags(
    slug: String,
    tags: Vec<String>,
    state: State<AppState>,
) -> Result<notes::Note> {
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
    // Tag change may have just qualified this note for an auto-path —
    // reconcile immediately so the paths pane reflects it.
    let _ = reconcile_auto_paths(&root);
    Ok(saved)
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
    let root = state.require_root()?;
    let mut note = notes::read(&root, &slug)?;
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
    // Stash a copy in `.yarrow/trash/` before the destructive notes::delete
    // strips backlinks and removes the file. Stash is best-effort — if it
    // fails we still proceed with the delete (so a permission error on the
    // trash dir doesn't block the user from removing notes).
    let _ = trash::stash(&root, &slug);
    notes::delete(&root, &slug)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: delete \"{}\"", slug))?;
    let _ = graph::build(&root);
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
    let root = state.require_root()?;
    let restored_slug = trash::restore(&root, &slug)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: restore \"{}\"", restored_slug))?;
    let _ = graph::build(&root);
    Ok(restored_slug)
}

#[tauri::command]
pub fn cmd_purge_from_trash(slug: String, state: State<AppState>) -> Result<()> {
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
    let root = state.require_root()?;
    let session = state.session.lock().unwrap();
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
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_TASKLISTS);
    let parser = Parser::new_ext(body, options);
    let mut html_out = String::new();
    html::push_html(&mut html_out, parser);
    Ok(rewrite_callouts(&html_out))
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
    let root = state.require_root()?;
    let session = state.session.lock().unwrap();
    let note = notes::read_with_key(&root, &slug, session.master_key.as_ref())?;
    drop(session);
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    let parser = Parser::new_ext(&note.body, options);
    let mut body = String::new();
    html::push_html(&mut body, parser);
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

#[tauri::command]
pub fn cmd_import_obsidian_vault(
    source: String,
    state: State<AppState>,
) -> Result<obsidian_import::ImportReport> {
    let root = state.require_root()?;
    let report = obsidian_import::import_vault(&root, std::path::Path::new(&source))?;
    post_import_checkpoint(&root, report.imported, "Obsidian")?;
    Ok(report)
}

#[tauri::command]
pub fn cmd_import_bear_vault(
    source: String,
    state: State<AppState>,
) -> Result<obsidian_import::ImportReport> {
    let root = state.require_root()?;
    let report = foreign_import::import_bear(&root, std::path::Path::new(&source))?;
    post_import_checkpoint(&root, report.imported, "Bear")?;
    Ok(report)
}

#[tauri::command]
pub fn cmd_import_logseq_vault(
    source: String,
    state: State<AppState>,
) -> Result<obsidian_import::ImportReport> {
    let root = state.require_root()?;
    let report = foreign_import::import_logseq(&root, std::path::Path::new(&source))?;
    post_import_checkpoint(&root, report.imported, "Logseq")?;
    Ok(report)
}

#[tauri::command]
pub fn cmd_import_notion_vault(
    source: String,
    state: State<AppState>,
) -> Result<obsidian_import::ImportReport> {
    let root = state.require_root()?;
    let report = foreign_import::import_notion(&root, std::path::Path::new(&source))?;
    post_import_checkpoint(&root, report.imported, "Notion")?;
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

// ───────── keepsakes (pinned checkpoints) ─────────

#[tauri::command]
pub fn cmd_pin_checkpoint(
    slug: String,
    oid: String,
    label: String,
    note: Option<String>,
    state: State<AppState>,
) -> Result<git::Keepsake> {
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
    // Read the per-workspace toggle. A missing/broken config means the
    // cache is allowed — the defaulted value is `true` — so users who
    // never touched Settings still get the fast path.
    let use_index = workspace::read_config(&root)
        .map(|c| c.preferences.search_index_enabled)
        .unwrap_or(true);
    search::search(&root, &query, limit.unwrap_or(25), use_index)
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
