// All git2-rs operations live here. No other module calls git2 directly.
// User-facing vocabulary: "checkpoint" = commit, "path" = branch, "sync" = push/pull.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use git2::{
    BranchType, Commit, Cred, FetchOptions, IndexAddOption, MergeOptions, ObjectType, Oid,
    PushOptions, RemoteCallbacks, Repository, RepositoryState, ResetType, Signature, Sort,
    Tree, TreeBuilder,
};
use serde::{Deserialize, Serialize};

use crate::error::{Result, YarrowError};

const AUTHOR_NAME: &str = "Yarrow";
const AUTHOR_EMAIL: &str = "noreply@yarrow.app";

fn signature() -> Result<Signature<'static>> {
    Ok(Signature::now(AUTHOR_NAME, AUTHOR_EMAIL)?)
}

pub fn open(path: &Path) -> Result<Repository> {
    Ok(Repository::open(path)?)
}

pub fn init_workspace(path: &Path) -> Result<Repository> {
    let repo = Repository::init(path)?;
    Ok(repo)
}

/// Stage all changes and create a checkpoint (commit). Returns the new OID.
/// If there are no changes and HEAD already exists, returns the current HEAD.
pub fn checkpoint(repo: &Repository, message: &str) -> Result<Oid> {
    let mut index = repo.index()?;
    index.update_all(["*"].iter(), None)?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let sig = signature()?;

    let parent_commit = match repo.head() {
        Ok(head) => Some(head.peel_to_commit()?),
        Err(_) => None, // initial commit
    };

    // If nothing changed from the parent tree, skip.
    if let Some(parent) = &parent_commit {
        if parent.tree()?.id() == tree_id {
            return Ok(parent.id());
        }

        // Oscillation coalescing. A very common pattern:
        //   1. User types a space        → save → commit A (adds " ")
        //   2. User backspaces the space → save → commit B (removes " ")
        // Commit A and commit B both have real diffs, but the net effect
        // is zero. If the working tree matches any recent local ancestor,
        // roll HEAD back to that ancestor instead of stacking a new
        // commit. Result: no history entry at all for paired edits that
        // end back where they started.
        //
        // Guardrails:
        //   • Only walk linear ancestry (no merge commits) — we can't
        //     safely collapse one parent of a merge without losing the
        //     other.
        //   • Only coalesce past commits that aren't yet on a remote.
        //     Anything published is immutable as far as we're concerned
        //     — rewriting it would force-push on next sync.
        //   • Small window (5 commits) so typical oscillation is caught
        //     without infinite history walks.
        const MAX_COALESCE: usize = 5;

        // Collect remote-tracking tips so we can spot commits that have
        // already been published. `refs/remotes/*` covers every remote.
        let mut published: Vec<Oid> = Vec::new();
        if let Ok(iter) = repo.references_glob("refs/remotes/*") {
            for r in iter.flatten() {
                if let Ok(c) = r.peel_to_commit() {
                    published.push(c.id());
                }
            }
        }
        let is_published = |oid: Oid| -> bool {
            published.iter().any(|&rem| {
                rem == oid || repo.graph_descendant_of(rem, oid).unwrap_or(false)
            })
        };

        // Skip coalescing entirely during a merge: mid-merge the working
        // tree can coincidentally match a pre-merge ancestor, and rolling
        // HEAD back there would destroy the in-progress merge state.
        let in_merge = !matches!(repo.state(), RepositoryState::Clean);

        // Only coalesce if HEAD itself isn't already pushed — if it is,
        // we'd rewrite published history on the next sync.
        if !in_merge && !is_published(parent.id()) && parent.parent_count() == 1 {
            let mut cursor = parent.parent(0).ok();
            for _ in 0..MAX_COALESCE {
                let Some(ancestor) = cursor else { break; };
                if ancestor.tree()?.id() == tree_id {
                    // Match. Roll the current branch ref back to this
                    // ancestor and return — no new commit, no diff.
                    let target = ancestor.id();
                    if let Ok(mut head_ref) = repo.head() {
                        // `head_ref` resolves to the branch ref (e.g.
                        // refs/heads/main) so set_target moves the
                        // branch, not HEAD-as-symbolic.
                        let _ = head_ref
                            .set_target(target, "yarrow: coalesce oscillating save");
                    }
                    return Ok(target);
                }
                if ancestor.parent_count() != 1 { break; }
                cursor = ancestor.parent(0).ok();
            }
        }
    }

    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();
    let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;
    Ok(oid)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PathInfo {
    pub name: String,
    pub is_current: bool,
    pub last_activity: Option<i64>,
}

pub fn list_paths(repo: &Repository) -> Result<Vec<PathInfo>> {
    let current = current_path_name(repo).ok();
    let mut out = Vec::new();
    for b in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = b?;
        let name = branch.name()?.unwrap_or("").to_string();
        if name.is_empty() {
            continue;
        }
        let last_activity = branch
            .get()
            .peel_to_commit()
            .ok()
            .map(|c| c.time().seconds());
        let is_current = current.as_deref() == Some(name.as_str());
        out.push(PathInfo {
            name,
            is_current,
            last_activity,
        });
    }
    Ok(out)
}

pub fn current_path_name(repo: &Repository) -> Result<String> {
    let head = repo.head()?;
    let name = head
        .shorthand()
        .ok_or_else(|| YarrowError::Other("detached HEAD".into()))?;
    Ok(name.to_string())
}

pub fn create_path(repo: &Repository, name: &str) -> Result<()> {
    let sanitized = sanitize_branch_name(name);
    let head_commit = repo.head()?.peel_to_commit()?;
    repo.branch(&sanitized, &head_commit, false)?;
    switch_path(repo, &sanitized)?;
    Ok(())
}

/// Same as `create_path`, but returns the sanitized branch name it produced
/// so the caller can address it (e.g. to write meta immediately after fork).
pub fn create_path_named(repo: &Repository, name: &str) -> Result<String> {
    let sanitized = sanitize_branch_name(name);
    let head_commit = repo.head()?.peel_to_commit()?;
    repo.branch(&sanitized, &head_commit, false)?;
    switch_path(repo, &sanitized)?;
    Ok(sanitized)
}

/// Commit a single file change (add/update or delete) onto a branch without
/// touching the working tree or HEAD. Used by "this note applies / doesn't
/// apply on this path" toggles so the user doesn't have to switch branches
/// just to edit the membership of a note.
///
/// Fails if `branch` is the *current* branch — for that, the normal save +
/// autocheckpoint path is correct and avoids working-tree drift.
pub fn branch_commit_file_change(
    repo: &Repository,
    branch: &str,
    relpath: &str,
    content: Option<&[u8]>,
    message: &str,
) -> Result<Oid> {
    if current_path_name(repo).ok().as_deref() == Some(branch) {
        return Err(YarrowError::Other(
            "This path is the one you're on — edit the note directly instead.".into(),
        ));
    }

    let branch_ref = repo.find_branch(branch, BranchType::Local)?;
    let tip_commit = branch_ref.get().peel_to_commit()?;
    let tip_tree = tip_commit.tree()?;

    // In-memory index: mutate the tree without touching disk.
    let mut index = git2::Index::new()?;
    index.read_tree(&tip_tree)?;

    match content {
        Some(bytes) => {
            let blob_oid = repo.blob(bytes)?;
            let entry = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0,
                ino: 0,
                mode: 0o100644,
                uid: 0,
                gid: 0,
                file_size: bytes.len() as u32,
                id: blob_oid,
                flags: 0,
                flags_extended: 0,
                path: relpath.as_bytes().to_vec(),
            };
            index.add(&entry)?;
        }
        None => {
            // Best-effort remove — if the path isn't indexed, nothing to do.
            let _ = index.remove_path(Path::new(relpath));
        }
    }

    let new_tree_oid = index.write_tree_to(repo)?;
    let new_tree = repo.find_tree(new_tree_oid)?;
    let sig = signature()?;
    let ref_name = format!("refs/heads/{}", branch);
    let new_commit_oid = repo.commit(
        Some(&ref_name),
        &sig,
        &sig,
        message,
        &new_tree,
        &[&tip_commit],
    )?;
    Ok(new_commit_oid)
}

/// Read a file at the tip of a specific branch, bypassing the working tree.
/// Returns `None` if the branch doesn't exist, the file isn't present at
/// that tip, or reading the blob fails. Used to aggregate per-branch
/// metadata (e.g. path conditions) without switching branches.
pub fn read_file_at_branch(
    repo: &Repository,
    branch: &str,
    relpath: &str,
) -> Option<Vec<u8>> {
    let b = repo.find_branch(branch, BranchType::Local).ok()?;
    let commit = b.get().peel_to_commit().ok()?;
    let tree = commit.tree().ok()?;
    let entry = tree.get_path(Path::new(relpath)).ok()?;
    let object = entry.to_object(repo).ok()?;
    let blob = object.as_blob()?;
    Some(blob.content().to_vec())
}

pub fn switch_path(repo: &Repository, name: &str) -> Result<()> {
    let (object, reference) = repo.revparse_ext(name).map_err(|_| {
        YarrowError::PathNotFound(name.to_string())
    })?;
    repo.checkout_tree(&object, None)?;
    match reference {
        Some(gref) => repo.set_head(gref.name().unwrap_or(name))?,
        None => repo.set_head_detached(object.id())?,
    }
    Ok(())
}

pub fn delete_path(repo: &Repository, name: &str) -> Result<()> {
    if current_path_name(repo).ok().as_deref() == Some(name) {
        return Err(YarrowError::CannotDeleteActivePath(name.to_string()));
    }
    let mut branch = repo.find_branch(name, BranchType::Local)?;
    branch.delete()?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MergeOutcome {
    pub clean: bool,
    pub conflicts: Vec<String>,
    pub merged_into: String,
}

/// Merges `from` into the currently checked-out path.
pub fn merge_into_current(repo: &Repository, from: &str) -> Result<MergeOutcome> {
    let into = current_path_name(repo)?;
    let from_ref = repo
        .find_branch(from, BranchType::Local)
        .map_err(|_| YarrowError::PathNotFound(from.to_string()))?;
    let from_commit = from_ref.get().peel_to_commit()?;
    let annotated = repo.find_annotated_commit(from_commit.id())?;

    let analysis = repo.merge_analysis(&[&annotated])?;

    if analysis.0.is_up_to_date() {
        return Ok(MergeOutcome {
            clean: true,
            conflicts: vec![],
            merged_into: into,
        });
    }

    if analysis.0.is_fast_forward() {
        let refname = format!("refs/heads/{}", into);
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(from_commit.id(), "fast-forward")?;
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        return Ok(MergeOutcome {
            clean: true,
            conflicts: vec![],
            merged_into: into,
        });
    }

    // Normal merge
    let mut merge_opts = MergeOptions::new();
    repo.merge(&[&annotated], Some(&mut merge_opts), None)?;
    let index = repo.index()?;
    if index.has_conflicts() {
        let conflicts: Vec<String> = index
            .conflicts()?
            .filter_map(|c| c.ok())
            .filter_map(|c| {
                c.our
                    .as_ref()
                    .and_then(|e| std::str::from_utf8(&e.path).ok().map(|s| s.to_string()))
            })
            .collect();
        return Ok(MergeOutcome {
            clean: false,
            conflicts,
            merged_into: into,
        });
    }

    // No conflicts — write merge commit.
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let sig = signature()?;
    let head_commit = repo.head()?.peel_to_commit()?;
    let message = format!("bring-together: {} into {}", from, into);
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &message,
        &tree,
        &[&head_commit, &from_commit],
    )?;
    repo.cleanup_state()?;
    Ok(MergeOutcome {
        clean: true,
        conflicts: vec![],
        merged_into: into,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub oid: String,
    pub message: String,
    pub timestamp: i64,
    pub thinking_note: Option<String>,
}

pub fn note_history(repo: &Repository, note_relpath: &str) -> Result<Vec<HistoryEntry>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME)?;
    revwalk.push_head()?;

    let mut out = Vec::new();
    let mut last_tree_entry: Option<Oid> = None;
    for oid in revwalk {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        let tree = commit.tree()?;
        let current_blob = tree
            .get_path(Path::new(note_relpath))
            .ok()
            .and_then(|te| if te.kind() == Some(ObjectType::Blob) { Some(te.id()) } else { None });

        if current_blob.is_none() {
            continue;
        }

        if last_tree_entry == current_blob {
            continue;
        }
        last_tree_entry = current_blob;

        let (message, thinking_note) = split_message(commit.message().unwrap_or(""));
        out.push(HistoryEntry {
            oid: oid.to_string(),
            message,
            timestamp: commit.time().seconds(),
            thinking_note,
        });
    }
    Ok(out)
}

fn split_message(msg: &str) -> (String, Option<String>) {
    // Convention: first line is summary, blank line, then thinking note.
    let mut parts = msg.splitn(2, "\n\n");
    let head = parts.next().unwrap_or("").trim().to_string();
    let body = parts
        .next()
        .map(|b| b.trim().to_string())
        .filter(|s| !s.is_empty());
    (head, body)
}

/// Snapshot of every note on a given path (git branch). Used by the
/// path-diffing UI to compare two paths without round-tripping through
/// `switch_path`, which mutates the working tree.
pub fn notes_on_path(repo: &Repository, path_name: &str) -> Result<Vec<(String, String)>> {
    let branch = repo
        .find_branch(path_name, git2::BranchType::Local)
        .map_err(|_| YarrowError::PathNotFound(path_name.to_string()))?;
    let commit = branch.get().peel_to_commit()?;
    let tree = commit.tree()?;
    let mut out: Vec<(String, String)> = Vec::new();
    tree.walk(git2::TreeWalkMode::PreOrder, |dir, entry| {
        let name = entry.name().unwrap_or("");
        if !name.ends_with(".md") {
            return git2::TreeWalkResult::Ok;
        }
        let full = format!("{}{}", dir, name);
        if !full.starts_with("notes/") {
            return git2::TreeWalkResult::Ok;
        }
        let blob = match entry.to_object(repo).and_then(|o| o.peel_to_blob()) {
            Ok(b) => b,
            Err(_) => return git2::TreeWalkResult::Ok,
        };
        let content = String::from_utf8_lossy(blob.content()).to_string();
        let rel = full.trim_start_matches("notes/").trim_end_matches(".md");
        out.push((rel.to_string(), content));
        git2::TreeWalkResult::Ok
    })?;
    Ok(out)
}

/// One side of a path comparison entry — kept generic so the frontend can
/// diff arbitrary slugs without schema churn.
#[derive(serde::Serialize)]
pub struct PathDiffEntry {
    pub slug: String,
    pub status: &'static str, // "added" | "removed" | "modified" | "same"
    pub left_excerpt: Option<String>,
    pub right_excerpt: Option<String>,
    pub left_lines: usize,
    pub right_lines: usize,
}

#[derive(serde::Serialize)]
pub struct PathComparison {
    pub left: String,
    pub right: String,
    pub entries: Vec<PathDiffEntry>,
    pub summary: PathCompareSummary,
}

#[derive(serde::Serialize)]
pub struct PathCompareSummary {
    pub added: usize,
    pub removed: usize,
    pub modified: usize,
    pub same: usize,
}

fn excerpt(body: &str, max_chars: usize) -> Option<String> {
    let trimmed = body.trim_start_matches(|c: char| c == '-' || c.is_whitespace());
    let cleaned: String = trimmed
        .lines()
        .filter(|l| !l.trim().is_empty() && !l.starts_with("---"))
        .take(4)
        .collect::<Vec<_>>()
        .join("\n");
    if cleaned.is_empty() { return None; }
    if cleaned.len() <= max_chars { return Some(cleaned); }
    Some(cleaned.chars().take(max_chars).collect::<String>() + "…")
}

/// Compare two paths note-by-note. The result lists every slug on either
/// side, marking it added/removed/modified/same plus short excerpts so the
/// UI can render a side-by-side without a second round-trip.
pub fn compare_paths(repo: &Repository, left: &str, right: &str) -> Result<PathComparison> {
    use std::collections::BTreeMap;
    let left_notes = notes_on_path(repo, left)?;
    let right_notes = notes_on_path(repo, right)?;
    let mut by_slug: BTreeMap<String, (Option<String>, Option<String>)> = BTreeMap::new();
    for (slug, body) in left_notes {
        by_slug.entry(slug).or_insert((None, None)).0 = Some(body);
    }
    for (slug, body) in right_notes {
        by_slug.entry(slug).or_insert((None, None)).1 = Some(body);
    }
    let mut entries = Vec::with_capacity(by_slug.len());
    let mut summary = PathCompareSummary { added: 0, removed: 0, modified: 0, same: 0 };
    for (slug, (l, r)) in by_slug {
        let status: &'static str = match (&l, &r) {
            (Some(_), None) => { summary.removed += 1; "removed" }
            (None, Some(_)) => { summary.added += 1; "added" }
            (Some(a), Some(b)) if a == b => { summary.same += 1; "same" }
            (Some(_), Some(_)) => { summary.modified += 1; "modified" }
            (None, None) => continue,
        };
        let left_lines = l.as_ref().map(|s| s.lines().count()).unwrap_or(0);
        let right_lines = r.as_ref().map(|s| s.lines().count()).unwrap_or(0);
        entries.push(PathDiffEntry {
            slug,
            status,
            left_excerpt: l.as_deref().and_then(|b| excerpt(b, 240)),
            right_excerpt: r.as_deref().and_then(|b| excerpt(b, 240)),
            left_lines,
            right_lines,
        });
    }
    Ok(PathComparison {
        left: left.to_string(),
        right: right.to_string(),
        entries,
        summary,
    })
}

pub fn note_at_checkpoint(repo: &Repository, note_relpath: &str, oid: Oid) -> Result<String> {
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;
    let entry = tree
        .get_path(Path::new(note_relpath))
        .map_err(|_| YarrowError::NoteNotFound(note_relpath.to_string()))?;
    let blob = repo.find_blob(entry.id())?;
    Ok(String::from_utf8_lossy(blob.content()).into_owned())
}

pub fn restore_note(
    repo: &Repository,
    workspace_root: &Path,
    note_relpath: &str,
    oid: Oid,
) -> Result<()> {
    let content = note_at_checkpoint(repo, note_relpath, oid)?;
    let abs = workspace_root.join(note_relpath);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&abs, content)?;
    let message = format!("checkpoint: restore {} to {}", note_relpath, &oid.to_string()[..8]);
    checkpoint(repo, &message)?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Provenance {
    pub timestamp: i64,
    pub path_name: String,
    pub oid: String,
}

pub fn paragraph_provenance(
    repo: &Repository,
    note_relpath: &str,
    line: u32,
) -> Result<Provenance> {
    let blame = repo.blame_file(Path::new(note_relpath), None)?;
    let hunk = blame
        .get_line(line as usize)
        .ok_or_else(|| YarrowError::Other("no blame for line".into()))?;
    let oid = hunk.final_commit_id();
    let commit = repo.find_commit(oid)?;
    let path_name = current_path_name(repo).unwrap_or_else(|_| "main".to_string());
    Ok(Provenance {
        timestamp: commit.time().seconds(),
        path_name,
        oid: oid.to_string(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncOutcome {
    pub ok: bool,
    pub fetched: bool,
    pub pushed: bool,
    pub message: String,
}

/// Sync with configured remote: fetch + fast-forward, then push.
/// Auth supported: HTTPS with PAT in URL, or SSH with default keys.
pub fn sync(repo: &Repository, remote_name: &str, token: Option<&str>) -> Result<SyncOutcome> {
    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|_| YarrowError::NoRemote)?;

    let mut callbacks = RemoteCallbacks::new();
    let token_owned = token.map(|s| s.to_string());
    callbacks.credentials(move |_url, username, allowed| {
        if allowed.contains(git2::CredentialType::SSH_KEY) {
            if let Some(user) = username {
                return Cred::ssh_key_from_agent(user);
            }
        }
        if allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Some(t) = &token_owned {
                return Cred::userpass_plaintext("x-access-token", t);
            }
        }
        Cred::default()
    });

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    let branch = current_path_name(repo)?;
    let refspec = format!("refs/heads/{0}:refs/remotes/{1}/{0}", branch, remote_name);
    remote.fetch(&[&refspec], Some(&mut fetch_opts), None)?;

    let mut fetched = false;
    let fetch_head_name = format!("refs/remotes/{}/{}", remote_name, branch);
    if let Ok(remote_ref) = repo.find_reference(&fetch_head_name) {
        let remote_commit = remote_ref.peel_to_commit()?;
        let annotated = repo.find_annotated_commit(remote_commit.id())?;
        let analysis = repo.merge_analysis(&[&annotated])?;
        if analysis.0.is_up_to_date() {
            // nothing to pull
        } else if analysis.0.is_fast_forward() {
            let refname = format!("refs/heads/{}", branch);
            let mut reference = repo.find_reference(&refname)?;
            reference.set_target(remote_commit.id(), "sync fast-forward")?;
            repo.set_head(&refname)?;
            repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
            fetched = true;
        } else {
            // divergent — v1: skip (surface error)
            return Ok(SyncOutcome {
                ok: false,
                fetched: false,
                pushed: false,
                message: "remote has diverged; bring-together required".into(),
            });
        }
    }

    // Push
    let mut push_callbacks = RemoteCallbacks::new();
    let token_owned2 = token.map(|s| s.to_string());
    push_callbacks.credentials(move |_url, username, allowed| {
        if allowed.contains(git2::CredentialType::SSH_KEY) {
            if let Some(user) = username {
                return Cred::ssh_key_from_agent(user);
            }
        }
        if allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Some(t) = &token_owned2 {
                return Cred::userpass_plaintext("x-access-token", t);
            }
        }
        Cred::default()
    });
    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(push_callbacks);
    let push_refspec = format!("refs/heads/{0}:refs/heads/{0}", branch);
    let push_result = remote.push(&[&push_refspec], Some(&mut push_opts));

    let pushed = push_result.is_ok();
    let message = match push_result {
        Ok(_) => "synced".into(),
        Err(e) => format!("fetched ok, push failed: {}", e),
    };

    Ok(SyncOutcome {
        ok: pushed || fetched,
        fetched,
        pushed,
        message,
    })
}

pub fn set_remote(repo: &Repository, name: &str, url: &str) -> Result<()> {
    if repo.find_remote(name).is_ok() {
        repo.remote_set_url(name, url)?;
    } else {
        repo.remote(name, url)?;
    }
    Ok(())
}

pub fn reset_hard_head(repo: &Repository) -> Result<()> {
    let head = repo.head()?.peel(ObjectType::Commit)?;
    repo.reset(&head, ResetType::Hard, None)?;
    Ok(())
}

fn sanitize_branch_name(name: &str) -> String {
    let slug: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '/' {
                c.to_ascii_lowercase()
            } else {
                // Whitespace + anything else collapses to a dash so the
                // branch name stays safe for refs/heads/* on every filesystem.
                '-'
            }
        })
        .collect();
    let trimmed: String = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "path".to_string()
    } else {
        trimmed
    }
}

pub fn workspace_has_commits(repo: &Repository) -> bool {
    repo.head().is_ok()
}

pub fn workspace_root(repo: &Repository) -> Option<PathBuf> {
    repo.workdir().map(|p| p.to_path_buf())
}

// ───────────────────────── branch topology ─────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchFork {
    pub parent_branch: String,
    pub fork_oid: String,
    pub fork_time: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchTopo {
    pub name: String,
    pub tip_oid: String,
    pub tip_time: i64,
    pub is_current: bool,
    pub forked_from: Option<BranchFork>,
}

pub fn branch_topology(repo: &Repository) -> Result<Vec<BranchTopo>> {
    let current = current_path_name(repo).ok();
    // Collect name, tip_oid, tip_time for every local branch.
    let mut all: Vec<(String, Oid, i64)> = Vec::new();
    for b in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = b?;
        let name = match branch.name()? {
            Some(n) => n.to_string(),
            None => continue,
        };
        let commit = branch.get().peel_to_commit()?;
        all.push((name, commit.id(), commit.time().seconds()));
    }

    // For each branch, find its most likely parent: the OTHER branch whose
    // merge-base with us is most recent (largest timestamp), and whose tip
    // differs from ours.
    let mut out = Vec::with_capacity(all.len());
    for (i, (name, tip, tip_time)) in all.iter().enumerate() {
        let mut best: Option<(usize, Oid, i64)> = None;
        for (j, (_other_name, other_tip, _)) in all.iter().enumerate() {
            if i == j || other_tip == tip {
                continue;
            }
            if let Ok(base) = repo.merge_base(*tip, *other_tip) {
                let base_time = repo
                    .find_commit(base)
                    .ok()
                    .map(|c| c.time().seconds())
                    .unwrap_or(0);
                let is_better = match best {
                    None => true,
                    Some((_, _, best_time)) => base_time > best_time,
                };
                if is_better {
                    best = Some((j, base, base_time));
                }
            }
        }

        let forked_from = best.map(|(j, base, base_time)| BranchFork {
            parent_branch: all[j].0.clone(),
            fork_oid: base.to_string(),
            fork_time: base_time,
        });

        out.push(BranchTopo {
            name: name.clone(),
            tip_oid: tip.to_string(),
            tip_time: *tip_time,
            is_current: current.as_deref() == Some(name.as_str()),
            forked_from,
        });
    }

    // Root-like branches (main/master or branches with no candidate parent) get
    // no `forked_from`. If a branch's "parent" equals itself up to an ancestor,
    // we already handle that by the tip != tip check.
    // Remove forked_from on a branch whose detected parent branch has this
    // branch as ITS parent (cycles) — pick whichever branch has the earlier
    // tip-time as the parent.
    for i in 0..out.len() {
        if let Some(fork) = out[i].forked_from.clone() {
            if let Some(parent_idx) = out.iter().position(|b| b.name == fork.parent_branch) {
                if let Some(their_fork) = &out[parent_idx].forked_from {
                    if their_fork.parent_branch == out[i].name {
                        // Cycle: whichever branch is older keeps its parent = None.
                        if out[i].tip_time < out[parent_idx].tip_time {
                            out[i].forked_from = None;
                        }
                    }
                }
            }
        }
    }
    Ok(out)
}

// ───────────────────────── conflict resolution ─────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictContent {
    pub relpath: String,
    pub base: Option<String>,
    pub ours: Option<String>,
    pub theirs: Option<String>,
    pub working: Option<String>,
}

pub fn is_merging(repo: &Repository) -> bool {
    repo.state() == RepositoryState::Merge
}

pub fn list_conflicts(repo: &Repository) -> Result<Vec<String>> {
    let index = repo.index()?;
    if !index.has_conflicts() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for c in index.conflicts()? {
        let c = c?;
        // Prefer "our" path, fall back to theirs or ancestor.
        let path = c
            .our
            .as_ref()
            .or(c.their.as_ref())
            .or(c.ancestor.as_ref())
            .and_then(|e| std::str::from_utf8(&e.path).ok().map(|s| s.to_string()));
        if let Some(p) = path {
            out.push(p);
        }
    }
    out.sort();
    out.dedup();
    Ok(out)
}

pub fn get_conflict_content(
    repo: &Repository,
    workspace_root: &Path,
    relpath: &str,
) -> Result<ConflictContent> {
    let index = repo.index()?;
    let mut base: Option<String> = None;
    let mut ours: Option<String> = None;
    let mut theirs: Option<String> = None;

    for c in index.conflicts()? {
        let c = c?;
        let matches = |entry: &git2::IndexEntry| {
            std::str::from_utf8(&entry.path).map(|s| s == relpath).unwrap_or(false)
        };
        if let Some(e) = c.ancestor.as_ref().filter(|e| matches(e)) {
            base = Some(read_blob(repo, e.id)?);
        }
        if let Some(e) = c.our.as_ref().filter(|e| matches(e)) {
            ours = Some(read_blob(repo, e.id)?);
        }
        if let Some(e) = c.their.as_ref().filter(|e| matches(e)) {
            theirs = Some(read_blob(repo, e.id)?);
        }
    }

    let working_path = workspace_root.join(relpath);
    let working = if working_path.exists() {
        Some(std::fs::read_to_string(&working_path)?)
    } else {
        None
    };

    Ok(ConflictContent {
        relpath: relpath.to_string(),
        base,
        ours,
        theirs,
        working,
    })
}

fn read_blob(repo: &Repository, oid: Oid) -> Result<String> {
    let blob = repo.find_blob(oid)?;
    Ok(String::from_utf8_lossy(blob.content()).into_owned())
}

/// Write the resolved content to disk and mark the conflict resolved in the index.
pub fn resolve_conflict(
    repo: &Repository,
    workspace_root: &Path,
    relpath: &str,
    content: &str,
) -> Result<()> {
    let abs = workspace_root.join(relpath);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&abs, content)?;
    let mut index = repo.index()?;
    index.add_path(Path::new(relpath))?;
    index.write()?;
    Ok(())
}

pub fn abort_merge(repo: &Repository) -> Result<()> {
    // Reset hard to HEAD and clear merge state.
    reset_hard_head(repo)?;
    repo.cleanup_state()?;
    Ok(())
}

pub fn finalize_merge(repo: &Repository, extra_note: Option<&str>) -> Result<Oid> {
    let index = repo.index()?;
    if index.has_conflicts() {
        return Err(YarrowError::MergeConflicts(
            "resolve all conflicts before finalizing".into(),
        ));
    }
    // Need MERGE_HEAD for the second parent.
    let merge_head_path = repo.path().join("MERGE_HEAD");
    let merge_head_oid_str = std::fs::read_to_string(&merge_head_path)
        .map_err(|_| YarrowError::Other("no in-progress merge".into()))?;
    let merge_head_oid = Oid::from_str(merge_head_oid_str.trim())?;
    let merge_commit = repo.find_commit(merge_head_oid)?;

    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let head_commit = repo.head()?.peel_to_commit()?;
    let sig = signature()?;
    let into = current_path_name(repo).unwrap_or_else(|_| "current".into());
    let mut message = format!("bring-together: resolved merge into {}", into);
    if let Some(note) = extra_note.filter(|s| !s.trim().is_empty()) {
        message.push_str("\n\n");
        message.push_str(note.trim());
    }
    let oid = repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &message,
        &tree,
        &[&head_commit, &merge_commit],
    )?;
    repo.cleanup_state()?;
    Ok(oid)
}

// ───────────────────── history-rewrite for encryption ─────────────────────
//
// When a user encrypts a note, the current commit holds ciphertext but every
// prior commit still contains the plaintext blob in `.git/objects`. Anyone
// with filesystem access can `git log -p` the file and recover the clear
// text. This breaks the encryption story.
//
// `rewrite_file_history` walks every local branch, rebuilds each commit so
// the target file's blob is replaced by a caller-supplied transform, and
// re-points every ref to the rewritten tip. After the walk, old commit
// objects are unreachable; `gc_unreachable` then asks git (best-effort) to
// prune them from the object store.
//
// Tradeoffs:
//   • Every commit SHA on every branch shifts. A remote with the old
//     history will reject `sync` until the user force-pushes. This is a
//     deliberate user-facing tradeoff the encrypt command surfaces.
//   • Tags and remote-tracking refs are not rewritten. Yarrow doesn't
//     create tags. Remote-tracking refs will diverge and get fixed on the
//     next sync.
//   • Reflogs are cleared by the caller via `clear_reflogs` so they can't
//     be used to resurrect the old commits.

/// Rewrite every commit reachable from any local branch so that the blob at
/// `relpath` is replaced by `transform(old_bytes)` whenever it appears.
///
/// `transform` returns `Ok(Some(new_bytes))` to substitute, `Ok(None)` to
/// leave the blob untouched (e.g. commits where the file is already
/// encrypted). Commits where the file doesn't exist in the tree at all are
/// still rewritten (their parents may have been remapped), but the tree for
/// that commit is reused as-is.
///
/// Returns the number of commits rewritten.
pub fn rewrite_file_history<F>(
    repo: &Repository,
    relpath: &Path,
    mut transform: F,
) -> Result<usize>
where
    F: FnMut(&[u8]) -> Result<Option<Vec<u8>>>,
{
    // Split the path into string components once — git's internal paths are
    // always forward-slashed regardless of host OS.
    let components: Vec<String> = relpath
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect();
    if components.is_empty() {
        return Ok(0);
    }

    // Collect every local branch tip up front. We rewrite across *all*
    // branches so historical paths don't become a decryption oracle.
    let branch_tips: Vec<(String, Oid)> = repo
        .branches(Some(BranchType::Local))?
        .filter_map(|b| b.ok())
        .filter_map(|(branch, _)| {
            let name = branch.name().ok().flatten()?.to_string();
            let oid = branch.get().peel_to_commit().ok()?.id();
            Some((name, oid))
        })
        .collect();

    if branch_tips.is_empty() {
        return Ok(0);
    }

    // Walk every reachable commit in parents-first order so a commit's new
    // parents already exist in `map` by the time we rebuild it.
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::REVERSE)?;
    for (_, oid) in &branch_tips {
        revwalk.push(*oid)?;
    }

    let mut map: HashMap<Oid, Oid> = HashMap::new();
    let mut rewritten = 0usize;

    for maybe in revwalk {
        let old_oid = maybe?;
        let commit = repo.find_commit(old_oid)?;
        let old_tree = commit.tree()?;

        // Rebuild the tree, substituting the target blob when present.
        let new_tree_oid = rebuild_tree_with_blob(
            repo,
            &old_tree,
            &components,
            0,
            &mut transform,
        )?;
        let new_tree = repo.find_tree(new_tree_oid)?;

        // Map parents — any parent we've seen got rewritten; use the new
        // oid. A root commit simply has no parents.
        let new_parent_oids: Vec<Oid> = commit
            .parents()
            .map(|p| *map.get(&p.id()).unwrap_or(&p.id()))
            .collect();
        let new_parents: Vec<Commit> = new_parent_oids
            .iter()
            .map(|o| repo.find_commit(*o))
            .collect::<std::result::Result<_, _>>()?;
        let parent_refs: Vec<&Commit> = new_parents.iter().collect();

        let new_oid = repo.commit(
            None, // do not move any ref yet
            &commit.author(),
            &commit.committer(),
            commit.message().unwrap_or(""),
            &new_tree,
            &parent_refs,
        )?;

        if new_oid != old_oid {
            rewritten += 1;
        }
        map.insert(old_oid, new_oid);
    }

    // Re-point every branch to its rewritten tip.
    for (name, old_tip) in &branch_tips {
        if let Some(&new_tip) = map.get(old_tip) {
            if new_tip == *old_tip {
                continue;
            }
            let mut branch = repo.find_branch(name, BranchType::Local)?;
            branch
                .get_mut()
                .set_target(new_tip, "yarrow: seal encrypted history")?;
        }
    }

    // HEAD is symbolic (points at a branch name), so moving the branch also
    // moves HEAD. If HEAD is detached we update it explicitly.
    if let Ok(head) = repo.head() {
        if !head.is_branch() {
            if let Some(old_head_oid) = head.target() {
                if let Some(&new_head_oid) = map.get(&old_head_oid) {
                    repo.set_head_detached(new_head_oid)?;
                }
            }
        }
    }

    Ok(rewritten)
}

/// Recursive helper: return the oid of a new tree where the blob at
/// `components[depth..]` has been replaced via `transform`. When the file
/// isn't in the tree we return the original tree oid unchanged (callers can
/// still use this — they pay a tiny lookup cost but no write).
fn rebuild_tree_with_blob<F>(
    repo: &Repository,
    tree: &Tree,
    components: &[String],
    depth: usize,
    transform: &mut F,
) -> Result<Oid>
where
    F: FnMut(&[u8]) -> Result<Option<Vec<u8>>>,
{
    let entry_name = &components[depth];
    let entry = match tree.get_name(entry_name) {
        Some(e) => e,
        None => return Ok(tree.id()), // file doesn't exist at this commit
    };

    if depth == components.len() - 1 {
        // Final component — should be the blob itself.
        if entry.kind() != Some(ObjectType::Blob) {
            return Ok(tree.id());
        }
        let blob = repo.find_blob(entry.id())?;
        let replacement = transform(blob.content())?;
        let new_blob_bytes = match replacement {
            Some(b) => b,
            None => return Ok(tree.id()),
        };
        let new_blob_oid = repo.blob(&new_blob_bytes)?;
        let mut builder: TreeBuilder = repo.treebuilder(Some(tree))?;
        builder.insert(entry_name, new_blob_oid, entry.filemode())?;
        Ok(builder.write()?)
    } else {
        // Intermediate component — descend into the subtree.
        if entry.kind() != Some(ObjectType::Tree) {
            return Ok(tree.id());
        }
        let subtree = repo.find_tree(entry.id())?;
        let new_subtree_oid =
            rebuild_tree_with_blob(repo, &subtree, components, depth + 1, transform)?;
        if new_subtree_oid == subtree.id() {
            return Ok(tree.id());
        }
        let mut builder: TreeBuilder = repo.treebuilder(Some(tree))?;
        builder.insert(entry_name, new_subtree_oid, entry.filemode())?;
        Ok(builder.write()?)
    }
}

// ───────────────────── history pruning ─────────────────────
//
// User-facing "forget old checkpoints." Walks every commit reachable from any
// local branch and drops ones matching a caller-supplied predicate, splicing
// kept children onto the dropped commit's mapped parent. Merge commits are
// never dropped (splicing one side of a merge changes the meaning of the
// other side).
//
// Same rewrite tradeoff as encryption-sealing: SHAs change, so a previously
// synced remote diverges until the user force-pushes.

#[derive(Debug, Serialize, Deserialize)]
pub struct PruneReport {
    pub removed: usize,
    pub kept: usize,
}

/// Rewrite all reachable history, dropping commits where `should_drop` returns
/// true. Returns how many commits were dropped.
fn rewrite_history_dropping<F>(repo: &Repository, mut should_drop: F) -> Result<PruneReport>
where
    F: FnMut(&Commit, &Tree) -> Result<bool>,
{
    let branch_tips: Vec<(String, Oid)> = repo
        .branches(Some(BranchType::Local))?
        .filter_map(|b| b.ok())
        .filter_map(|(branch, _)| {
            let name = branch.name().ok().flatten()?.to_string();
            let oid = branch.get().peel_to_commit().ok()?.id();
            Some((name, oid))
        })
        .collect();

    if branch_tips.is_empty() {
        return Ok(PruneReport { removed: 0, kept: 0 });
    }

    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::REVERSE)?;
    for (_, oid) in &branch_tips {
        revwalk.push(*oid)?;
    }

    // For each old oid: Some(new_oid) = replacement, None = dropped with no
    // remaining parent (happens only when a root commit is dropped).
    let mut map: HashMap<Oid, Option<Oid>> = HashMap::new();
    let mut removed = 0usize;
    let mut kept = 0usize;

    for maybe in revwalk {
        let old_oid = maybe?;
        let commit = repo.find_commit(old_oid)?;
        let tree = commit.tree()?;

        // Resolve each original parent through the map. A parent that was
        // itself dropped with no replacement contributes nothing.
        let new_parent_oids: Vec<Oid> = commit
            .parents()
            .filter_map(|p| map.get(&p.id()).copied().unwrap_or(Some(p.id())))
            .collect();

        let is_merge = commit.parent_count() >= 2;
        let drop_this = !is_merge && should_drop(&commit, &tree)?;

        if drop_this && new_parent_oids.len() <= 1 {
            // Splice: point children at our single (or zero) parent.
            map.insert(old_oid, new_parent_oids.into_iter().next());
            removed += 1;
            continue;
        }

        let parents_identical = commit.parent_count() == new_parent_oids.len()
            && commit
                .parents()
                .zip(new_parent_oids.iter())
                .all(|(p, np)| p.id() == *np);
        if parents_identical {
            map.insert(old_oid, Some(old_oid));
            kept += 1;
            continue;
        }

        let new_parent_commits: Vec<Commit> = new_parent_oids
            .iter()
            .map(|o| repo.find_commit(*o))
            .collect::<std::result::Result<_, _>>()?;
        let parent_refs: Vec<&Commit> = new_parent_commits.iter().collect();

        let new_oid = repo.commit(
            None,
            &commit.author(),
            &commit.committer(),
            commit.message().unwrap_or(""),
            &tree,
            &parent_refs,
        )?;
        map.insert(old_oid, Some(new_oid));
        kept += 1;
    }

    // Re-point every branch to its rewritten tip. If the tip was dropped with
    // no replacement (whole branch would disappear), leave it alone.
    for (name, old_tip) in &branch_tips {
        match map.get(old_tip) {
            Some(Some(new_tip)) if *new_tip != *old_tip => {
                let mut branch = repo.find_branch(name, BranchType::Local)?;
                branch.get_mut().set_target(*new_tip, "yarrow: prune history")?;
            }
            _ => {}
        }
    }

    Ok(PruneReport { removed, kept })
}

/// Drop every checkpoint older than `cutoff_secs` (unix timestamp). Children
/// of a pruned commit inherit its parent, so the surviving history is still
/// linear — only the old tail vanishes.
pub fn prune_older_than(repo: &Repository, cutoff_secs: i64) -> Result<PruneReport> {
    rewrite_history_dropping(repo, |commit, _tree| {
        Ok(commit.time().seconds() < cutoff_secs)
    })
}

/// Drop checkpoints whose note bodies were all empty — these typically come
/// from "new note" creations and scaffolds that the user hadn't filled in yet.
pub fn prune_empty_content(repo: &Repository) -> Result<PruneReport> {
    rewrite_history_dropping(repo, |_commit, tree| Ok(tree_has_empty_notes(repo, tree)))
}

/// True if the tree has at least one `notes/*.md` file AND every such file's
/// body (content after the `---` frontmatter) is whitespace. A tree with no
/// notes at all also returns true — those are early setup commits with no
/// user content.
fn tree_has_empty_notes(repo: &Repository, tree: &Tree) -> bool {
    let mut saw_any_note = false;
    let mut all_empty = true;
    let _ = tree.walk(git2::TreeWalkMode::PreOrder, |dir, entry| {
        let name = entry.name().unwrap_or("");
        if !name.ends_with(".md") {
            return git2::TreeWalkResult::Ok;
        }
        let full = format!("{}{}", dir, name);
        if !full.starts_with("notes/") {
            return git2::TreeWalkResult::Ok;
        }
        saw_any_note = true;
        let Ok(blob) = repo.find_blob(entry.id()) else {
            return git2::TreeWalkResult::Ok;
        };
        let content = String::from_utf8_lossy(blob.content());
        if note_body_has_content(&content) {
            all_empty = false;
            return git2::TreeWalkResult::Abort;
        }
        git2::TreeWalkResult::Ok
    });
    if !saw_any_note {
        return true;
    }
    all_empty
}

/// True if the markdown file's body (after frontmatter) contains any
/// non-whitespace characters.
fn note_body_has_content(raw: &str) -> bool {
    let body = if let Some(rest) = raw.strip_prefix("---\n") {
        match rest.find("\n---\n") {
            Some(end) => &rest[end + 5..],
            None => rest,
        }
    } else {
        raw
    };
    body.chars().any(|c| !c.is_whitespace())
}

/// Clear all reflog entries so the old commit oids can't be recovered via
/// `git reflog`. Called after `rewrite_file_history`.
pub fn clear_reflogs(repo: &Repository) -> Result<()> {
    // Enumerate every ref that could have a reflog and drop it entirely.
    for maybe in repo.references()? {
        let r = maybe?;
        if let Some(name) = r.name() {
            // `reflog_delete` wipes the log file for a ref; ignore "no
            // reflog" errors (detached HEAD, remote refs without logs, …).
            let _ = repo.reflog_delete(name);
        }
    }
    let _ = repo.reflog_delete("HEAD");
    Ok(())
}

/// Best-effort: ask the system `git` to prune unreachable objects so the
/// plaintext blobs no longer sit in `.git/objects`. If `git` isn't on PATH
/// we quietly skip — the rewrite still severed every reference, the loose
/// objects just linger until the user runs `git gc` themselves.
pub fn gc_unreachable(repo: &Repository) -> Result<()> {
    let Some(workdir) = repo.workdir() else {
        return Ok(());
    };
    // `--prune=now` drops all unreachable loose objects immediately.
    // `--quiet` keeps the subprocess silent on stdout.
    let status = std::process::Command::new("git")
        .arg("-C")
        .arg(workdir)
        .arg("gc")
        .arg("--prune=now")
        .arg("--quiet")
        .status();
    match status {
        Ok(s) if s.success() => Ok(()),
        _ => {
            // Not a hard failure — the sever is the essential part, gc is
            // just cleanup. We log but don't propagate.
            eprintln!(
                "yarrow: `git gc` unavailable or failed; plaintext objects \
                 remain loose until the user runs `git gc --prune=now` in \
                 the workspace."
            );
            Ok(())
        }
    }
}
