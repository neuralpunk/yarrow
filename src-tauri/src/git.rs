// All git2-rs operations live here. No other module calls git2 directly.
// User-facing vocabulary: "checkpoint" = commit, "path" = branch, "sync" = push/pull.

use std::path::{Path, PathBuf};

use git2::{
    BranchType, Cred, FetchOptions, IndexAddOption, MergeOptions, ObjectType, Oid,
    PushOptions, RemoteCallbacks, Repository, RepositoryState, ResetType, Signature, Sort,
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
            } else if c.is_whitespace() {
                '-'
            } else {
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
