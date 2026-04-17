use std::path::PathBuf;
use std::sync::Mutex;

use tauri::State;

use base64::{engine::general_purpose::STANDARD, Engine as _};

use crate::app_config;
use crate::attachments;
use crate::error::{Result, YarrowError};
use crate::export;
use crate::git;
use crate::graph;
use crate::notes;
use crate::search;
use crate::workspace;

#[derive(Default)]
pub struct AppState {
    pub root: Mutex<Option<PathBuf>>,
}

impl AppState {
    fn require_root(&self) -> Result<PathBuf> {
        self.root
            .lock()
            .unwrap()
            .clone()
            .ok_or(YarrowError::NoWorkspace)
    }

    fn set_root(&self, p: PathBuf) {
        *self.root.lock().unwrap() = Some(p);
    }
}

fn open_repo(root: &std::path::Path) -> Result<git2::Repository> {
    git::open(root)
}

// ───────── workspace ─────────

#[tauri::command]
pub fn cmd_init_workspace(
    path: String,
    name: Option<String>,
    state: State<AppState>,
) -> Result<workspace::WorkspaceConfig> {
    let root = PathBuf::from(path);
    let ws_name = name.unwrap_or_else(|| {
        root.file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "My Workspace".into())
    });
    let cfg = workspace::init(&root, &ws_name)?;
    let _ = app_config::remember(&root, &cfg.workspace.name);
    state.set_root(root);
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
    notes::read(&root, &slug)
}

#[tauri::command]
pub fn cmd_save_note(
    slug: String,
    body: String,
    thinking_note: Option<String>,
    state: State<AppState>,
) -> Result<notes::Note> {
    let root = state.require_root()?;
    let note = notes::write(&root, &slug, &body, None)?;
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
pub fn cmd_delete_note(slug: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    notes::delete(&root, &slug)?;
    let repo = open_repo(&root)?;
    git::checkpoint(&repo, &format!("checkpoint: delete \"{}\"", slug))?;
    let _ = graph::build(&root);
    Ok(())
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
pub fn cmd_create_path(name: String, state: State<AppState>) -> Result<()> {
    let root = state.require_root()?;
    let repo = open_repo(&root)?;
    git::create_path(&repo, &name)
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
    let oid = git2::Oid::from_str(&oid).map_err(|e| YarrowError::Invalid(e.to_string()))?;
    let raw = git::note_at_checkpoint(&repo, &notes::relative_note_path(&slug), oid)?;
    Ok(raw)
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
