// All git2-rs operations live here. No other module calls git2 directly.
// User-facing vocabulary: "checkpoint" = commit, "path" = branch, "sync" = push/pull.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use git2::{
    BranchType, Commit, Cred, FetchOptions, IndexAddOption, MergeOptions, ObjectType, Oid,
    PushOptions, RemoteCallbacks, Repository, RepositoryState, ResetType, Signature, Sort,
    Tree, TreeBuilder, TreeWalkMode, TreeWalkResult,
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

/// 2.1 Air-gapped notes. Registers (or unregisters) a per-note path in
/// `.git/info/exclude` — git's per-clone gitignore that is **not** part
/// of the working tree and never gets committed or pushed. The file
/// itself stays in `notes/<slug>.md` on disk and is fully editable; it
/// just becomes invisible to `git status`, `git add`, and every push.
///
/// Why per-clone exclude rather than the workspace's `.gitignore`:
/// `.gitignore` is checked in. Listing private slugs there would leak
/// the note titles via the commit history, which is exactly what we
/// were trying to avoid by making the note private in the first place.
/// `.git/info/exclude` solves this cleanly — it's a local file that
/// only the user's machine ever sees.
///
/// Idempotent: re-registering an already-listed slug is a no-op,
/// unregistering one that isn't listed is a no-op. Safe to call from
/// every save.
pub fn ensure_private_exclude(root: &Path, slug: &str, private: bool) -> Result<()> {
    let exclude_path = root.join(".git").join("info").join("exclude");
    let entry = format!("notes/{slug}.md");

    let existing = if exclude_path.exists() {
        std::fs::read_to_string(&exclude_path)?
    } else {
        String::new()
    };

    let mut lines: Vec<&str> = existing.lines().collect();
    let already_listed = lines.iter().any(|l| l.trim() == entry);

    if private && !already_listed {
        if let Some(parent) = exclude_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut updated = existing.trim_end().to_string();
        if !updated.is_empty() {
            updated.push('\n');
        }
        updated.push_str(&format!("# yarrow:private — kept off sync\n{entry}\n"));
        std::fs::write(&exclude_path, updated)?;
    } else if !private && already_listed {
        lines.retain(|l| l.trim() != entry);
        // Drop the marker comment when no private entries remain so the
        // file doesn't accumulate orphan headers.
        let only_marker_left = lines
            .iter()
            .all(|l| l.trim().is_empty() || l.trim().starts_with('#'));
        let body: String = if only_marker_left {
            lines
                .iter()
                .filter(|l| !l.trim().starts_with("# yarrow:private"))
                .copied()
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            lines.join("\n")
        };
        let mut trimmed = body.trim_end().to_string();
        if !trimmed.is_empty() {
            trimmed.push('\n');
        }
        std::fs::write(&exclude_path, trimmed)?;
    }
    Ok(())
}

pub fn init_workspace(path: &Path) -> Result<Repository> {
    let mut opts = git2::RepositoryInitOptions::new();
    opts.initial_head("main");
    let repo = Repository::init_opts(path, &opts)?;
    Ok(repo)
}

/// 3.0 — clone an existing Yarrow workspace from a remote git URL into
/// `dest`. The caller is responsible for `dest` being non-existent or
/// empty; this function will create it. SSH URLs authenticate via the
/// running ssh-agent (no password prompt). HTTPS URLs only work for
/// public repos here — token-based clones are not yet wired through
/// the UI.
///
/// On error, the caller should remove `dest` so a half-cloned tree
/// doesn't pollute the user's filesystem (see `cmd_clone_workspace`).
pub fn clone_workspace(url: &str, dest: &Path) -> Result<Repository> {
    let mut cb = RemoteCallbacks::new();
    cb.credentials(|_url, username, allowed| {
        // ssh-agent first (the common case for git@github.com:… style
        // URLs). Without an agent the clone of a private repo will
        // surface a Cred::default() and libgit2 will fail clearly.
        if allowed.contains(git2::CredentialType::SSH_KEY) {
            if let Some(user) = username {
                return Cred::ssh_key_from_agent(user);
            }
        }
        Cred::default()
    });

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(cb);

    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fetch_opts);
    let repo = builder.clone(url, dest)?;
    Ok(repo)
}

/// Returns `true` if `dir` looks like a Yarrow workspace — i.e. it
/// contains the canonical `.yarrow/config.toml` marker. We deliberately
/// gate on `config.toml` rather than `index.db`: the search-cache db is
/// gitignored (workspace.rs:192) and would not survive a fresh clone,
/// so checking it would reject every legitimately cloned workspace.
pub fn is_yarrow_workspace(dir: &Path) -> bool {
    dir.join(".yarrow").join("config.toml").is_file()
}

/// Create an empty commit on HEAD when the working tree has nothing
/// to commit yet. Used as a last-resort seed during first sync so
/// push has a branch to send.
fn empty_root_commit(repo: &Repository) -> Result<Oid> {
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let sig = signature()?;
    let oid = repo.commit(Some("HEAD"), &sig, &sig, "initial checkpoint", &tree, &[])?;
    Ok(oid)
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
    // Skip the commit when the working tree matches the current HEAD's
    // tree — there's nothing to record. This is the ONLY safe form of
    // "collapse", because it doesn't move the branch ref. The older
    // oscillation coalescer that walked further back and rewound the
    // branch when an ancestor's tree matched has been removed: it was
    // able to silently orphan unpublished commits (they lived in the
    // object store and reflog, but no longer in any branch), which
    // caused user edits to "disappear into history" after the next
    // fetch force-checked-out the server's HEAD over what had been
    // rewound away. Noisy history beats lost edits.
    if let Some(parent) = &parent_commit {
        if parent.tree()?.id() == tree_id {
            return Ok(parent.id());
        }
    }

    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();
    let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;
    Ok(oid)
}

/// Create a checkpoint commit for a note save.
///
/// Every save creates a fresh commit. We previously had an amend window
/// that rolled successive saves into one commit "to keep history clean",
/// but it had a subtle bug — `parent.time()` in git2 returns the
/// COMMITTER time, which is refreshed on each amend, so the window
/// renewed itself indefinitely. Users typing every 25 s saw the same
/// commit get amended forever and reported "history checkpoints aren't
/// being created" twice. Removing amend entirely is the cleaner fix:
/// the auto-save debounce already throttles the rate (one save per
/// typing burst, not per keystroke), so we don't need a second layer
/// of consolidation.
///
/// The `affinity_key` (typically the note slug) is recorded as a
/// trailer line `Yarrow-slug: <slug>` at the bottom of the commit
/// message so other code (history slider, etc.) can attribute commits
/// to a specific note. The trailer is stripped from the user-visible
/// message at the display layer.
pub fn checkpoint_or_amend(
    repo: &Repository,
    user_message: &str,
    affinity_key: &str,
) -> Result<Oid> {
    let mut index = repo.index()?;
    index.update_all(["*"].iter(), None)?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let sig = signature()?;

    let parent_commit = match repo.head() {
        Ok(head) => Some(head.peel_to_commit()?),
        Err(_) => None,
    };

    // No-op if the tree didn't actually change.
    if let Some(parent) = &parent_commit {
        if parent.tree()?.id() == tree_id {
            return Ok(parent.id());
        }
    }

    let message_with_trailer = format!("{}\n\nYarrow-slug: {}\n", user_message.trim_end(), affinity_key);
    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();
    let oid = repo.commit(Some("HEAD"), &sig, &sig, &message_with_trailer, &tree, &parents)?;
    Ok(oid)
}

/// Strip the trailer line(s) `checkpoint_or_amend` appends from a
/// user-visible commit message. Use when surfacing a commit subject or
/// body to the UI (history slider, log views).
pub fn user_visible_message(message: &str) -> String {
    let mut lines: Vec<&str> = message.lines().collect();
    while let Some(last) = lines.last() {
        let t = last.trim();
        if t.is_empty() || t.starts_with("Yarrow-slug:") {
            lines.pop();
        } else {
            break;
        }
    }
    lines.join("\n")
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

/// Soft cap on the number of history entries returned for a single note.
/// At ~5000 commits the unbounded walk + the timeline render combined to
/// stall the modal for seconds; capping at 500 covers the overwhelming
/// majority of real-world "scrub through this note's history" sessions
/// while keeping both sides snappy. Callers that need more can paginate
/// via `note_history_paged` (added below).
const NOTE_HISTORY_DEFAULT_LIMIT: usize = 500;

pub fn note_history(repo: &Repository, note_relpath: &str) -> Result<Vec<HistoryEntry>> {
    note_history_paged(repo, note_relpath, NOTE_HISTORY_DEFAULT_LIMIT, 0)
}

/// Walks the repo for checkpoints touching `note_relpath`, returning at
/// most `limit` entries starting at `offset` distinct-tree-entry hits.
/// `limit == 0` means "no cap"; non-zero values short-circuit the walk
/// once the page is filled, which matters at 5k+ commits where the bulk
/// of cost is the per-commit `tree.get_path()` lookup.
pub fn note_history_paged(
    repo: &Repository,
    note_relpath: &str,
    limit: usize,
    offset: usize,
) -> Result<Vec<HistoryEntry>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME)?;
    revwalk.push_head()?;

    let mut out = Vec::with_capacity(limit.min(64));
    let mut last_tree_entry: Option<Oid> = None;
    let mut hits = 0usize;
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

        // Distinct hit. Skip until we reach `offset`, then collect up to
        // `limit` entries. We can't apply offset against the raw revwalk
        // because identical-tree dedupe means the offset is in
        // distinct-version space, not commit-count space.
        if hits < offset {
            hits += 1;
            continue;
        }
        hits += 1;

        let (message, thinking_note) = split_message(commit.message().unwrap_or(""));
        out.push(HistoryEntry {
            oid: oid.to_string(),
            message,
            timestamp: commit.time().seconds(),
            thinking_note,
        });

        if limit != 0 && out.len() >= limit {
            break;
        }
    }
    Ok(out)
}

fn split_message(msg: &str) -> (String, Option<String>) {
    // Strip the `Yarrow-slug:` trailer (if present — added by
    // `checkpoint_or_amend`) before splitting head/body so the user
    // never sees it in the history slider.
    let cleaned = user_visible_message(msg);
    // Convention: first line is summary, blank line, then thinking note.
    let mut parts = cleaned.splitn(2, "\n\n");
    let head = parts.next().unwrap_or("").trim().to_string();
    let body = parts
        .next()
        .map(|b| b.trim().to_string())
        .filter(|s| !s.is_empty());
    (head, body)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivityDay {
    /// Local date in `YYYY-MM-DD` form.
    pub date: String,
    /// Number of checkpoints authored on this date.
    pub count: u32,
}

/// Histogram of checkpoints per local date, walking every branch so the
/// count reflects all paths — not just whichever one HEAD points at now.
/// Results are ordered oldest → newest and capped to the last `days` days
/// (0 means "no cap"). Commits older than the cutoff are skipped without
/// breaking, since `Sort::TIME` isn't strictly monotonic across merges.
pub fn writing_activity(repo: &Repository, days: u32) -> Result<Vec<ActivityDay>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME)?;
    // Walk every local branch so an activity bucket reflects all paths,
    // not just the current one. Revwalk dedupes commits reachable from
    // multiple branches, so this counts each checkpoint once.
    match revwalk.push_glob("refs/heads/*") {
        Ok(()) => {}
        Err(_) => {
            // Empty repo or no refs yet — return an empty histogram.
            return Ok(Vec::new());
        }
    }

    let cutoff: Option<i64> = if days == 0 {
        None
    } else {
        Some(chrono::Utc::now().timestamp() - (days as i64) * 86400)
    };

    let mut counts: std::collections::BTreeMap<String, u32> = std::collections::BTreeMap::new();
    for oid in revwalk {
        let oid = match oid {
            Ok(o) => o,
            Err(_) => continue,
        };
        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let ts = commit.time().seconds();
        if let Some(c) = cutoff {
            if ts < c {
                continue;
            }
        }
        // Local date so the calendar aligns with when the user was awake,
        // not UTC midnight. `from_timestamp` returns naive UTC; we convert
        // to Local for the label.
        let local = chrono::DateTime::<chrono::Utc>::from_timestamp(ts, 0)
            .map(|dt| dt.with_timezone(&chrono::Local));
        let Some(local) = local else { continue };
        let date = local.format("%Y-%m-%d").to_string();
        *counts.entry(date).or_insert(0) += 1;
    }

    Ok(counts
        .into_iter()
        .map(|(date, count)| ActivityDay { date, count })
        .collect())
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

/// Structure-preserving slice of a note body, for compare views that need
/// enough content to render a line-level diff. Keeps blank lines and
/// formatting; truncates on character count with a trailing ellipsis.
pub(crate) fn long_excerpt(body: &str, max_chars: usize) -> Option<String> {
    if body.is_empty() {
        return None;
    }
    let trimmed = body.trim_start_matches(|c: char| c == '-' || c.is_whitespace());
    if trimmed.len() <= max_chars {
        return Some(trimmed.to_string());
    }
    Some(trimmed.chars().take(max_chars).collect::<String>() + "…")
}

pub(crate) fn excerpt(body: &str, max_chars: usize) -> Option<String> {
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
    /// When the sync performed a three-way merge and found conflicts,
    /// this records how each one was resolved. Yarrow follows the
    /// Obsidian/Dropbox pattern: the server version wins at the
    /// original path, and the local (pre-merge) version is saved as a
    /// sibling file `<path>.conflict-<machine>-<ts>.md` so the user
    /// can review both and merge by hand.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub conflicts: Vec<ConflictResolution>,
    /// Workspace-relative paths whose on-disk contents changed between
    /// pre-sync HEAD and post-sync HEAD. The frontend consumes this to
    /// reload any open editor whose file we just rewrote under it —
    /// without that reload, the editor's stale in-memory buffer gets
    /// written back on the next autosave and the commit that carries
    /// the write deletes the server's edit. Empty when nothing moved.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub files_changed: Vec<String>,
    /// Set when the pre-push quota check bailed locally — no network
    /// push was attempted. Carries the offending files so the UI can
    /// point the user at what to delete or shrink. `ok`/`pushed` are
    /// both false in this case; the frontend treats this as a typed
    /// "try again after freeing space" outcome, not a hard error.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quota_blocked: Option<QuotaBlockInfo>,
}

impl SyncOutcome {
    /// Blank outcome with all booleans false and every list empty. Used
    /// to build the specific "quota blocked" outcome without having to
    /// spell out every default field at each call-site.
    pub fn blocked_skeleton(message: String, quota_blocked: QuotaBlockInfo) -> Self {
        Self {
            ok: false,
            fetched: false,
            pushed: false,
            message,
            conflicts: Vec::new(),
            files_changed: Vec::new(),
            quota_blocked: Some(quota_blocked),
        }
    }
}

/// A single local blob the pre-push estimate flagged as a likely
/// quota-buster. Lives next to `SyncOutcome` because the frontend needs
/// both shapes at once.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlobCulprit {
    /// Tree-relative path the blob last appeared at, best-effort — for
    /// a blob that was added then deleted in the range, this is the
    /// earliest sighting during the walk.
    pub path: String,
    /// Uncompressed blob bytes. Upper bound on what the blob
    /// contributes to the pack (the pack applies delta compression).
    pub size: u64,
    pub oid: String,
}

/// Payload the frontend renders when the pre-push check blocks the
/// sync. Carries numbers + named files so the banner can say "foo.mp4
/// is 512 MB, you have 100 MB left, shrink or delete it" instead of a
/// vague "over quota."
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuotaBlockInfo {
    /// Upper-bound bytes the push would ship, per the pre-push estimate.
    pub estimated_bytes: u64,
    /// Bytes currently free, per the server's /quota probe — the min of
    /// per-workspace and per-user remaining.
    pub remaining_bytes: u64,
    /// Largest locally-unpushed blobs, largest first, capped.
    pub culprits: Vec<BlobCulprit>,
    /// Copy-pastable command string the user can run to drop the
    /// biggest culprit from their own unpushed history. Stage 1 only
    /// populates this as a hint — the actual `shrink` command lands
    /// with stage 4.
    pub shrink_hint: String,
}

#[derive(Debug, Clone)]
pub struct PushEstimate {
    pub bytes: u64,
    pub culprits: Vec<BlobCulprit>,
}

impl PushEstimate {
    fn empty() -> Self {
        Self { bytes: 0, culprits: Vec::new() }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictResolution {
    pub path: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub copy_path: Option<String>,
}

/// Auth material for a sync run. Either a generic PAT (`x-access-token`
/// as the HTTP Basic username, the way GitHub and most git hosts want
/// it) or an explicit username+password pair, which yarrow-server
/// needs (Basic `email:pat` on `/git/<workspace_id>.git`).
#[derive(Clone)]
pub enum SyncCredentials {
    None,
    Token(String),
    UserPassword { username: String, password: String },
}

impl SyncCredentials {
    fn from_token(t: Option<&str>) -> Self {
        match t {
            Some(s) if !s.is_empty() => SyncCredentials::Token(s.to_string()),
            _ => SyncCredentials::None,
        }
    }

    fn build_callbacks(&self, insecure_tls: bool) -> RemoteCallbacks<'static> {
        let cloned = self.clone();
        let mut cb = RemoteCallbacks::new();
        cb.credentials(move |_url, username, allowed| {
            if allowed.contains(git2::CredentialType::SSH_KEY) {
                if let Some(user) = username {
                    return Cred::ssh_key_from_agent(user);
                }
            }
            if allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
                match &cloned {
                    SyncCredentials::Token(t) => {
                        return Cred::userpass_plaintext("x-access-token", t);
                    }
                    SyncCredentials::UserPassword { username, password } => {
                        return Cred::userpass_plaintext(username, password);
                    }
                    SyncCredentials::None => {}
                }
            }
            Cred::default()
        });
        if insecure_tls {
            // Dev-only: accept every TLS certificate the server
            // presents, including self-signed. libgit2 routes TLS
            // verification failures through this callback when it's
            // installed; returning `CertificateOk` short-circuits the
            // normal PKI check.
            cb.certificate_check(|_cert, _host| {
                Ok(git2::CertificateCheckStatus::CertificateOk)
            });
        }
        cb
    }
}

/// Upper-bound estimate of how many net-new bytes a push of the current
/// branch would ship. Used by the pre-push quota check so the client
/// can short-circuit before uploading a pack the server would reject.
///
/// The estimate is the sum of uncompressed sizes of blobs reachable from
/// the local HEAD commit that aren't already reachable from
/// `tracking_ref_full` (the server's last-known tip of this branch). The
/// real pack will be smaller (delta compression), so this over-estimates
/// — which is the right direction for a quota gate: we never let a bad
/// push through, and any over-rejection is cheap for the user to
/// re-attempt after a fetch.
///
/// When the tracking ref is missing (first sync), we fall back to the
/// full size of the HEAD tree's blobs as an upper bound.
pub fn estimate_push_size(repo: &Repository, tracking_ref_full: &str) -> Result<PushEstimate> {
    let head_oid = match repo.head().and_then(|r| r.peel_to_commit()) {
        Ok(c) => c.id(),
        Err(_) => return Ok(PushEstimate::empty()),
    };

    let tracking_oid = repo.refname_to_id(tracking_ref_full).ok();
    if tracking_oid == Some(head_oid) {
        return Ok(PushEstimate::empty());
    }

    // Seed the "already on server" set from the tracking commit's tree,
    // when we have one. First-sync path: empty set, every blob counts.
    let server_blobs: HashSet<Oid> = match tracking_oid {
        Some(oid) => collect_tree_blob_oids(repo, oid)?,
        None => HashSet::new(),
    };

    // Enumerate blobs the push would carry. For each commit in the
    // local..tracking range, walk its tree and record blobs whose OIDs
    // aren't already known to the server. Blob path is the first place
    // we saw it in the walk — good enough to name a culprit in the UI.
    let mut revwalk = repo.revwalk()?;
    revwalk.push(head_oid)?;
    if let Some(oid) = tracking_oid {
        let _ = revwalk.hide(oid);
    }

    let mut new_blobs: HashMap<Oid, (String, u64)> = HashMap::new();
    for oid_res in revwalk {
        let commit_oid = match oid_res {
            Ok(v) => v,
            Err(_) => continue,
        };
        let Ok(commit) = repo.find_commit(commit_oid) else { continue };
        let Ok(tree) = commit.tree() else { continue };
        tree.walk(TreeWalkMode::PreOrder, |root, entry| {
            if !matches!(entry.kind(), Some(ObjectType::Blob)) {
                return TreeWalkResult::Ok;
            }
            let eid = entry.id();
            if server_blobs.contains(&eid) || new_blobs.contains_key(&eid) {
                return TreeWalkResult::Ok;
            }
            if let Ok(blob) = repo.find_blob(eid) {
                let name = entry.name().unwrap_or("<?>");
                let path = if root.is_empty() {
                    name.to_string()
                } else {
                    format!("{root}{name}")
                };
                new_blobs.insert(eid, (path, blob.size() as u64));
            }
            TreeWalkResult::Ok
        })?;
    }

    // If we had no tracking ref and the HEAD tree is empty, this comes
    // back zero — matches first-sync-of-empty-workspace.
    if tracking_oid.is_none() && new_blobs.is_empty() {
        let head_tree = repo.find_commit(head_oid)?.tree()?;
        head_tree.walk(TreeWalkMode::PreOrder, |root, entry| {
            if !matches!(entry.kind(), Some(ObjectType::Blob)) {
                return TreeWalkResult::Ok;
            }
            if let Ok(blob) = repo.find_blob(entry.id()) {
                let name = entry.name().unwrap_or("<?>");
                let path = if root.is_empty() {
                    name.to_string()
                } else {
                    format!("{root}{name}")
                };
                new_blobs.insert(entry.id(), (path, blob.size() as u64));
            }
            TreeWalkResult::Ok
        })?;
    }

    let total: u64 = new_blobs.values().map(|(_, s)| *s).sum();
    let mut culprits: Vec<BlobCulprit> = new_blobs
        .into_iter()
        .map(|(oid, (path, size))| BlobCulprit {
            oid: oid.to_string(),
            path,
            size,
        })
        .collect();
    culprits.sort_by(|a, b| b.size.cmp(&a.size));
    culprits.truncate(5);

    Ok(PushEstimate { bytes: total, culprits })
}

fn collect_tree_blob_oids(repo: &Repository, commit_oid: Oid) -> Result<HashSet<Oid>> {
    let commit = repo.find_commit(commit_oid)?;
    let tree = commit.tree()?;
    let mut out = HashSet::new();
    tree.walk(TreeWalkMode::PreOrder, |_root, entry| {
        if matches!(entry.kind(), Some(ObjectType::Blob)) {
            out.insert(entry.id());
        }
        TreeWalkResult::Ok
    })?;
    Ok(out)
}

/// Build the fully-qualified tracking ref name the way `sync_to_server`
/// does for its wildcard fetch. Exposed so callers (notably the pre-push
/// quota check in `cmd_sync`) can estimate push size against the same
/// ref the push will actually compare to.
pub fn server_tracking_ref(branch: &str) -> String {
    format!("refs/yarrow/server-fetch/{branch}")
}

/// Fetch every branch from the server into the yarrow tracking-ref
/// namespace, no push, no merge. Separate from `sync_to_server` because
/// the post-purge recovery path needs to update the tracking ref
/// *without* also pushing local commits — if we pushed, the big blob
/// the user was trying to purge would go right back up.
///
/// The refspec uses `+` (force-update) so a server-side history rewrite
/// doesn't leave the client stuck with a stale tracking ref. That's
/// the whole point of this function: absorb the new history so a
/// subsequent `discard_unsynced_commits` can hard-reset onto it.
pub fn fetch_from_server(
    repo: &Repository,
    server_git_url: &str,
    email: &str,
    pat: &str,
    insecure_tls: bool,
) -> Result<()> {
    if insecure_tls {
        if let Ok(mut cfg) = repo.config() {
            let _ = cfg.set_bool("http.sslVerify", false);
        }
    }
    let mut remote = repo.remote_anonymous(server_git_url)?;
    let tracking_prefix = "refs/yarrow/server-fetch";
    let fetch_refspec = format!("+refs/heads/*:{}/*", tracking_prefix);
    let creds = SyncCredentials::UserPassword {
        username: email.to_string(),
        password: pat.to_string(),
    };
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(creds.build_callbacks(insecure_tls));
    remote.fetch(&[fetch_refspec], Some(&mut fetch_opts), None)?;
    Ok(())
}

/// Sync with configured remote: fetch + fast-forward, then push.
/// Auth supported: HTTPS with PAT in URL, or SSH with default keys.
pub fn sync(repo: &Repository, remote_name: &str, token: Option<&str>) -> Result<SyncOutcome> {
    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|_| YarrowError::NoRemote)?;
    let branch = current_path_name(repo)?;
    let fetch_head_name = format!("refs/remotes/{}/{}", remote_name, branch);
    let fetch_refspec = format!("refs/heads/{0}:refs/remotes/{1}/{0}", branch, remote_name);
    sync_with_remote(
        repo,
        &mut remote,
        &SyncCredentials::from_token(token),
        &branch,
        &fetch_refspec,
        Some(&fetch_head_name),
        false,
    )
}

/// Sync against a yarrow-server-style anonymous remote. The URL is
/// never written to `.git/config` — it's constructed on the fly and
/// the anonymous remote object goes out of scope at the end of this
/// call. Safer than storing `https://email:pat@host/...` in the repo.
pub fn sync_to_server(
    repo: &Repository,
    server_git_url: &str,
    email: &str,
    pat: &str,
    insecure_tls: bool,
) -> Result<SyncOutcome> {
    // libgit2's `certificate_check` callback isn't always honored on
    // Linux builds that use libcurl as the HTTP transport — the TLS
    // verify happens inside libcurl before libgit2 gets a chance to
    // ask us. Setting `http.sslVerify = false` on the repo config is
    // the belt-and-suspenders fix: it works regardless of HTTP backend.
    // Only applied when the workspace has explicitly opted into
    // `insecure_skip_tls_verify` via Settings (the "TLS: insecure" badge
    // in the UI). Persists on the repo, which matches user intent.
    //
    // CRITICAL: the off path must also write the repo config back to
    // `true`. Earlier versions only wrote on the way IN to insecure
    // mode and never on the way out — so a user who briefly enabled
    // insecure-TLS and then turned it off on Linux/libcurl would have
    // `http.sslVerify = false` stuck in `.git/config` and TLS
    // verification silently disabled forever. The unconditional write
    // below closes that hole.
    if let Ok(mut cfg) = repo.config() {
        let _ = cfg.set_bool("http.sslVerify", !insecure_tls);
    }

    // Fresh workspaces come up from `init_workspace` with no HEAD —
    // git init, but no initial commit. Sync would then fail at
    // `current_path_name` below with an "unborn branch" error before
    // making any network call, and the user sees "nothing happens."
    // If there's anything on disk, checkpoint it; otherwise create an
    // empty initial commit so the push has a branch to send.
    if repo.head().is_err() {
        match checkpoint(repo, "initial checkpoint (first sync)") {
            Ok(_) => {}
            Err(_) => {
                // Checkpoint can fail if the working tree has nothing
                // to commit at all — force an empty root commit so HEAD
                // exists. This only runs once per workspace.
                if let Err(e) = empty_root_commit(repo) {
                    return Err(YarrowError::Other(format!(
                        "couldn't initialize local history for first sync: {e}"
                    )));
                }
            }
        }
    }

    let mut remote = repo.remote_anonymous(server_git_url)?;
    let branch = current_path_name(repo)?;
    // Wildcard fetch so the first sync against a freshly-created
    // empty vault is a no-op instead of an error. With an explicit
    // source ref (`refs/heads/main:...`) libgit2 returns "couldn't
    // find remote ref" when the server has nothing yet, which would
    // break the very first push on a new vault.
    let tracking_prefix = "refs/yarrow/server-fetch";
    let fetch_refspec = format!("+refs/heads/*:{}/*", tracking_prefix);
    let tracking = format!("{}/{}", tracking_prefix, branch);
    let creds = SyncCredentials::UserPassword {
        username: email.to_string(),
        password: pat.to_string(),
    };
    sync_with_remote(
        repo,
        &mut remote,
        &creds,
        &branch,
        &fetch_refspec,
        Some(&tracking),
        insecure_tls,
    )
}

fn sync_with_remote(
    repo: &Repository,
    remote: &mut git2::Remote<'_>,
    credentials: &SyncCredentials,
    branch: &str,
    fetch_refspec: &str,
    fetched_ref: Option<&str>,
    insecure_tls: bool,
) -> Result<SyncOutcome> {
    // Capture HEAD BEFORE any pull happens. After fast-forward / merge
    // updates the ref, we diff the two tree OIDs to know which paths on
    // disk the pull just rewrote. The frontend uses that list to reload
    // any open editor whose file we touched — otherwise the editor's
    // stale React state writes back on the next autosave and the commit
    // that carries the write deletes whatever the server just sent us.
    let pre_sync_head: Option<Oid> = repo
        .head()
        .and_then(|r| r.peel_to_commit())
        .map(|c| c.id())
        .ok();

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(credentials.build_callbacks(insecure_tls));
    remote.fetch(&[fetch_refspec], Some(&mut fetch_opts), None)?;

    let mut fetched = false;
    let mut conflicts_recorded: Vec<ConflictResolution> = Vec::new();
    if let Some(tracking) = fetched_ref {
        if let Ok(remote_ref) = repo.find_reference(tracking) {
            let remote_commit = remote_ref.peel_to_commit()?;
            let annotated = repo.find_annotated_commit(remote_commit.id())?;
            let analysis = repo.merge_analysis(&[&annotated])?;
            if analysis.0.is_up_to_date() {
                // Local has everything remote has (and possibly more
                // unpushed commits). Nothing to pull; push will flush.
            } else if analysis.0.is_fast_forward() {
                // Remote has strictly more history than local. Safe to
                // jump HEAD forward + overwrite working tree — pre-sync
                // checkpoint in cmd_sync captured any pending edits as
                // real commits already, so this force-checkout cannot
                // lose unsaved buffer content any more.
                let refname = format!("refs/heads/{}", branch);
                match repo.find_reference(&refname) {
                    Ok(mut reference) => {
                        reference.set_target(remote_commit.id(), "sync fast-forward")?;
                    }
                    Err(_) => {
                        repo.reference(&refname, remote_commit.id(), true, "sync fast-forward")?;
                    }
                }
                repo.set_head(&refname)?;
                repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
                fetched = true;
            } else {
                // Divergent: both local and remote have unique
                // commits. Attempt a real three-way merge. If the
                // merge has no conflicts, commit it and continue to
                // the push step. If it DOES, abort and surface the
                // conflict to the UI — the user resolves via the
                // desktop's existing bring-together flow.
                match attempt_merge(repo, &annotated, &remote_commit, branch) {
                    MergeResult::Clean => {
                        fetched = true;
                    }
                    MergeResult::ResolvedWithCopies(res) => {
                        fetched = true;
                        conflicts_recorded = res;
                    }
                    MergeResult::Failed(msg) => {
                        let _ = repo.cleanup_state();
                        return Ok(SyncOutcome {
                            ok: false,
                            fetched: false,
                            pushed: false,
                            message: format!("merge failed: {msg}"),
                            conflicts: Vec::new(),
                            files_changed: Vec::new(),
                            quota_blocked: None,
                        });
                    }
                }
            }
        }
    }

    // Push with per-ref rejection surfacing + one automatic retry on
    // ref-race (non-fast-forward / "incorrect old value" — happens
    // when another client pushed between our fetch and our push, or
    // when a rename fires the ref tip moved between pre-push fetch
    // and the push itself). The web client already does this; desktop
    // had to surface the error verbatim before. Now both clients
    // recover silently from the common race.
    let push_refspec = format!("refs/heads/{0}:refs/heads/{0}", branch);
    let mut push_result;
    let mut per_ref_rejections: Vec<String>;
    let mut retries = 0usize;
    loop {
        // Fresh accumulator every iteration. After a retry, prior-iteration
        // rejections must NOT carry over into the post-loop diagnostic — a
        // shared mutex would leak the pre-retry "non-fast-forward" message
        // into the success branch.
        let rejections: std::sync::Arc<std::sync::Mutex<Vec<String>>> =
            std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let mut push_opts = PushOptions::new();
        let mut push_cb = credentials.build_callbacks(insecure_tls);
        {
            let rejections = rejections.clone();
            push_cb.push_update_reference(move |refname, status| {
                if let Some(msg) = status {
                    if let Ok(mut guard) = rejections.lock() {
                        guard.push(format!("{refname}: {msg}"));
                    }
                }
                Ok(())
            });
        }
        push_opts.remote_callbacks(push_cb);
        push_result = remote.push(&[&push_refspec], Some(&mut push_opts));
        per_ref_rejections = rejections.lock().map(|g| g.clone()).unwrap_or_default();

        // Retry once on ref-race: re-fetch the remote and attempt a
        // fast-forward merge of the new remote head into our local
        // branch, then push again. If merge is not fast-forward we
        // bail out — the existing merge path above handles that for
        // the next user-initiated sync.
        let race = per_ref_rejections
            .iter()
            .any(|m| is_ref_race(m));
        if push_result.is_ok() && race && retries == 0 {
            retries += 1;
            let mut fetch_opts = FetchOptions::new();
            fetch_opts.remote_callbacks(credentials.build_callbacks(insecure_tls));
            if remote
                .fetch(&[fetch_refspec], Some(&mut fetch_opts), None)
                .is_err()
            {
                break;
            }
            let Some(tracking) = fetched_ref else { break };
            let Ok(remote_ref) = repo.find_reference(tracking) else { break };
            let Ok(remote_commit) = remote_ref.peel_to_commit() else { break };
            let Ok(annotated) = repo.find_annotated_commit(remote_commit.id()) else { break };
            let Ok(analysis) = repo.merge_analysis(&[&annotated]) else { break };
            if analysis.0.is_up_to_date() {
                // Somehow already caught up — retry the push as-is.
                continue;
            }
            if !analysis.0.is_fast_forward() {
                // Divergent; don't try to auto-merge in the retry
                // loop. User's next sync runs the merge path.
                break;
            }
            let refname = format!("refs/heads/{}", branch);
            match repo.find_reference(&refname) {
                Ok(mut reference) => {
                    let _ = reference
                        .set_target(remote_commit.id(), "sync ref-race ff");
                }
                Err(_) => {
                    let _ = repo.reference(&refname, remote_commit.id(), true, "sync ref-race ff");
                }
            }
            if repo.set_head(&refname).is_err() {
                break;
            }
            let _ = repo
                .checkout_head(Some(git2::build::CheckoutBuilder::default().force()));
            fetched = true;
            continue;
        }
        break;
    }

    // A push is only a real success when BOTH the top-level call
    // returned Ok AND no ref came back with a rejection message.
    let pushed = push_result.is_ok() && per_ref_rejections.is_empty();
    let message = match (&push_result, per_ref_rejections.as_slice()) {
        (Ok(_), []) => {
            if !conflicts_recorded.is_empty() {
                format!(
                    "synced — {} conflict{} resolved by keeping server version; local saved as .conflict-* copies",
                    conflicts_recorded.len(),
                    if conflicts_recorded.len() == 1 { "" } else { "s" }
                )
            } else if fetched {
                "synced (pulled + pushed)".into()
            } else {
                "synced".into()
            }
        }
        (Ok(_), rejections) => {
            // Top-level push ok but server rejected refs. This is the
            // case we were silently swallowing. Surface verbatim — the
            // message usually names the exact hook / ref-race / quota
            // reason (e.g. "refs/heads/main: pre-receive hook declined").
            format!("server rejected push: {}", rejections.join("; "))
        }
        (Err(e), _) => format!("push failed: {e}"),
    };

    // Diff pre- and post-sync HEAD to find which workspace files the
    // pull rewrote. Frontend reloads any open editor pointed at one of
    // these paths so a stale buffer can't overwrite the server's edit
    // on the next save.
    let post_sync_head: Option<Oid> = repo
        .head()
        .and_then(|r| r.peel_to_commit())
        .map(|c| c.id())
        .ok();
    let files_changed = match (pre_sync_head, post_sync_head) {
        (Some(from), Some(to)) if from != to => changed_paths_between(repo, from, to),
        _ => Vec::new(),
    };

    Ok(SyncOutcome {
        ok: pushed,
        fetched,
        pushed,
        message,
        conflicts: conflicts_recorded,
        files_changed,
        quota_blocked: None,
    })
}

/// Workspace-relative paths that differ between two commit trees, sorted
/// and deduped. Used by sync to tell the frontend which open notes need
/// reloading after a pull. Returns an empty list on any git error — the
/// frontend tolerates that (degrades to "don't reload") and a failure
/// here must not fail the sync itself.
fn changed_paths_between(repo: &Repository, from: Oid, to: Oid) -> Vec<String> {
    let Ok(from_tree) = repo.find_commit(from).and_then(|c| c.tree()) else {
        return Vec::new();
    };
    let Ok(to_tree) = repo.find_commit(to).and_then(|c| c.tree()) else {
        return Vec::new();
    };
    let Ok(diff) = repo.diff_tree_to_tree(Some(&from_tree), Some(&to_tree), None) else {
        return Vec::new();
    };
    let mut paths: Vec<String> = Vec::new();
    for delta in diff.deltas() {
        if let Some(p) = delta.new_file().path().and_then(|p| p.to_str()) {
            paths.push(p.to_string());
        }
        if let Some(p) = delta.old_file().path().and_then(|p| p.to_str()) {
            paths.push(p.to_string());
        }
    }
    paths.sort();
    paths.dedup();
    paths
}

/// True when a per-ref rejection looks like "another client raced us
/// to the server" rather than a real user-actionable error (auth fail,
/// quota exceeded, hook decline).
///
/// IMPORTANT: do NOT match the bare token "rejected". Pre-receive hooks
/// (quota / branch protection / validation) emit messages that contain
/// "rejected" but are NOT ref races — retrying with a force-checkout
/// would discard any working-tree state diverged in between, and the
/// retry would just hit the same hook decline anyway. Whitelist on the
/// precise libgit2 / git-protocol race shapes only.
fn is_ref_race(msg: &str) -> bool {
    let l = msg.to_ascii_lowercase();
    l.contains("non-fast-forward")
        || l.contains("non fast forward")
        || l.contains("not a simple fast-forward")
        || l.contains("incorrect old value")
        || l.contains("failed to update ref")
        || l.contains("stale info")
}

enum MergeResult {
    Clean,
    ResolvedWithCopies(Vec<ConflictResolution>),
    Failed(String),
}

/// Three-way merge of `remote_commit` into the current HEAD with
/// auto-conflict resolution via the Obsidian/Dropbox "conflict copy"
/// pattern: when a file is conflicted, server content wins at the
/// original path, and local (pre-merge) content is saved as a
/// sibling `<stem>.conflict-<host>-<ts>.<ext>`. Never leaves the repo
/// in a half-merged state; never leaves conflict markers in files.
/// User reconciles by comparing the original and the .conflict-* copy.
fn attempt_merge(
    repo: &Repository,
    annotated: &git2::AnnotatedCommit<'_>,
    remote_commit: &git2::Commit<'_>,
    branch: &str,
) -> MergeResult {
    let mut merge_opts = git2::MergeOptions::new();
    merge_opts.fail_on_conflict(false);
    if !matches!(repo.state(), git2::RepositoryState::Clean) {
        return MergeResult::Failed(
            "repo is in the middle of another merge/rebase — finish that first".into(),
        );
    }
    if let Err(e) = repo.merge(&[annotated], Some(&mut merge_opts), None) {
        return MergeResult::Failed(e.to_string());
    }

    let mut index = match repo.index() {
        Ok(i) => i,
        Err(e) => return MergeResult::Failed(format!("read index: {e}")),
    };

    let mut resolutions: Vec<ConflictResolution> = Vec::new();
    if index.has_conflicts() {
        match resolve_conflicts_via_copies(repo, &mut index) {
            Ok(list) => resolutions = list,
            Err(e) => {
                let _ = repo.cleanup_state();
                return MergeResult::Failed(format!("resolve conflicts: {e}"));
            }
        }
    }

    // Merge commit — index is guaranteed conflict-free now.
    let tree_id = match index.write_tree() {
        Ok(t) => t,
        Err(e) => {
            let _ = repo.cleanup_state();
            return MergeResult::Failed(format!("write index tree: {e}"));
        }
    };
    let tree = match repo.find_tree(tree_id) {
        Ok(t) => t,
        Err(e) => {
            let _ = repo.cleanup_state();
            return MergeResult::Failed(format!("find merge tree: {e}"));
        }
    };
    let sig = match signature() {
        Ok(s) => s,
        Err(e) => {
            let _ = repo.cleanup_state();
            return MergeResult::Failed(format!("signature: {e}"));
        }
    };
    let head_commit = match repo.head().and_then(|r| r.peel_to_commit()) {
        Ok(c) => c,
        Err(e) => {
            let _ = repo.cleanup_state();
            return MergeResult::Failed(format!("head commit: {e}"));
        }
    };
    let msg = if resolutions.is_empty() {
        format!("merge remote {branch} via sync")
    } else {
        format!(
            "merge remote {branch} via sync ({} conflict{} auto-resolved; see .conflict-* copies)",
            resolutions.len(),
            if resolutions.len() == 1 { "" } else { "s" }
        )
    };
    let parents = [&head_commit, remote_commit];
    let commit_id = match repo.commit(Some("HEAD"), &sig, &sig, &msg, &tree, &parents) {
        Ok(id) => id,
        Err(e) => {
            let _ = repo.cleanup_state();
            return MergeResult::Failed(format!("create merge commit: {e}"));
        }
    };

    let refname = format!("refs/heads/{}", branch);
    if let Ok(mut reference) = repo.find_reference(&refname) {
        let _ = reference.set_target(commit_id, "sync merge");
    }
    let _ = repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()));
    let _ = repo.cleanup_state();
    if resolutions.is_empty() {
        MergeResult::Clean
    } else {
        MergeResult::ResolvedWithCopies(resolutions)
    }
}

fn resolve_conflicts_via_copies(
    repo: &Repository,
    index: &mut git2::Index,
) -> std::result::Result<Vec<ConflictResolution>, String> {
    use std::path::Path as StdPath;

    let workdir = match repo.workdir() {
        Some(w) => w.to_path_buf(),
        None => return Err("bare repo has no working tree".into()),
    };
    let ts = chrono::Utc::now().format("%Y-%m-%d-%H%M%S").to_string();
    let host = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "desktop".into());
    let host = sanitize_host(&host);

    // Drain conflict entries into an owned list first. We can't hold
    // a borrow on `index` while mutating it.
    #[derive(Debug)]
    struct Triple {
        path: String,
        our_oid: Option<git2::Oid>,
        their_oid: Option<git2::Oid>,
    }
    let mut work: Vec<Triple> = Vec::new();
    {
        let conflicts = index.conflicts().map_err(|e| e.to_string())?;
        for c in conflicts {
            let c = c.map_err(|e| e.to_string())?;
            let path = c
                .our
                .as_ref()
                .or(c.their.as_ref())
                .or(c.ancestor.as_ref())
                .and_then(|e| std::str::from_utf8(&e.path).ok().map(String::from))
                .unwrap_or_default();
            work.push(Triple {
                path,
                our_oid: c.our.as_ref().map(|e| e.id),
                their_oid: c.their.as_ref().map(|e| e.id),
            });
        }
    }

    let mut resolutions = Vec::with_capacity(work.len());
    for triple in work {
        if triple.path.is_empty() {
            continue;
        }
        let rel = StdPath::new(&triple.path).to_path_buf();
        // Clear the conflict entry (stages 1/2/3) for this path from
        // the index. We re-stage whatever we end up writing below.
        let _ = index.remove_path(&rel);

        let abs = workdir.join(&rel);
        let (resolution, copy_rel_opt) = match (triple.our_oid, triple.their_oid) {
            (Some(our), Some(their)) => {
                // Both edited same file. Take theirs at the original
                // path; save ours as `.conflict-*` copy.
                let our_blob = repo.find_blob(our).map_err(|e| e.to_string())?;
                let their_blob = repo.find_blob(their).map_err(|e| e.to_string())?;
                let copy_rel = conflict_copy_path(&triple.path, &host, &ts);
                let abs_copy = workdir.join(&copy_rel);
                if let Some(parent) = abs_copy.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                std::fs::write(&abs_copy, our_blob.content()).map_err(|e| e.to_string())?;
                if let Some(parent) = abs.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                std::fs::write(&abs, their_blob.content()).map_err(|e| e.to_string())?;
                index
                    .add_path(StdPath::new(&copy_rel))
                    .map_err(|e| e.to_string())?;
                index.add_path(&rel).map_err(|e| e.to_string())?;
                (
                    "kept-server-version-saved-local-as-copy".to_string(),
                    Some(copy_rel),
                )
            }
            (Some(our), None) => {
                // Remote deleted; we edited. Save ours as copy,
                // accept remote delete at original path.
                let our_blob = repo.find_blob(our).map_err(|e| e.to_string())?;
                let copy_rel = conflict_copy_path(&triple.path, &host, &ts);
                let abs_copy = workdir.join(&copy_rel);
                if let Some(parent) = abs_copy.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                std::fs::write(&abs_copy, our_blob.content()).map_err(|e| e.to_string())?;
                if abs.exists() {
                    let _ = std::fs::remove_file(&abs);
                }
                index
                    .add_path(StdPath::new(&copy_rel))
                    .map_err(|e| e.to_string())?;
                (
                    "accepted-remote-delete-saved-local-as-copy".to_string(),
                    Some(copy_rel),
                )
            }
            (None, Some(their)) => {
                // We deleted; remote edited. Take theirs — the user's
                // delete becomes the minority action.
                let their_blob = repo.find_blob(their).map_err(|e| e.to_string())?;
                if let Some(parent) = abs.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                std::fs::write(&abs, their_blob.content()).map_err(|e| e.to_string())?;
                index.add_path(&rel).map_err(|e| e.to_string())?;
                ("kept-server-version-over-local-delete".to_string(), None)
            }
            (None, None) => ("both-sides-deleted".to_string(), None),
        };

        resolutions.push(ConflictResolution {
            path: triple.path,
            action: resolution,
            copy_path: copy_rel_opt,
        });
    }

    index.write().map_err(|e| e.to_string())?;
    Ok(resolutions)
}

fn conflict_copy_path(original: &str, host: &str, ts: &str) -> String {
    use std::path::Path as StdPath;
    let path = StdPath::new(original);
    let parent = path.parent();
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("note");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
    let filename = if ext.is_empty() {
        format!("{stem}.conflict-{host}-{ts}")
    } else {
        format!("{stem}.conflict-{host}-{ts}.{ext}")
    };
    match parent {
        Some(p) if !p.as_os_str().is_empty() => p.join(filename).to_string_lossy().into_owned(),
        _ => filename,
    }
}

fn sanitize_host(raw: &str) -> String {
    raw.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
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

/// A single commit from the tracking..HEAD range, returned as part of
/// the discard-unsynced-changes preview so the UI can show the user
/// what they're about to throw away.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscardedCommit {
    pub oid: String,
    /// First line of the commit message — what the UI lists.
    pub summary: String,
    /// Unix seconds. Rendered in the preview as "3 minutes ago" etc.
    pub time: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscardOutcome {
    /// True when the caller passed `confirm=true` and the reset ran.
    /// False when this was a dry-run preview.
    pub performed: bool,
    /// Count of commits that are (or would be) discarded.
    pub commits_ahead: usize,
    /// Newest-first commit summaries for the preview list.
    pub commits: Vec<DiscardedCommit>,
    /// The commit the local branch was (or would be) reset to — the
    /// last-known server tip. `None` when no tracking ref exists yet
    /// (i.e. first-ever sync).
    pub reset_to_oid: Option<String>,
    pub reset_to_summary: Option<String>,
}

/// Drop local commits that the server doesn't have. The "unstick" action
/// for the pre-push quota check: when a too-big local commit is stuck
/// in unpushed history and the user hasn't made other work they need to
/// preserve, a hard reset to the tracking ref throws away the offending
/// commit along with anything else ahead of the server.
///
/// When `confirm=false`, returns the preview only — nothing is reset.
/// The UI should call this once with `false`, show the user the commit
/// list, and call again with `true` on their go-ahead.
///
/// Refuses to run against an empty tracking ref: without one, a hard
/// reset would have no target, and "first sync never happened" is a
/// different problem this function shouldn't try to solve.
pub fn discard_unsynced_commits(
    repo: &Repository,
    tracking_ref: &str,
    confirm: bool,
) -> Result<DiscardOutcome> {
    let head_oid = repo
        .head()
        .and_then(|r| r.peel_to_commit())
        .map(|c| c.id())
        .map_err(|_| YarrowError::Other("no local HEAD to discard from".into()))?;

    let tracking_oid = repo.refname_to_id(tracking_ref).ok();
    let Some(tracking_oid) = tracking_oid else {
        return Err(YarrowError::Other(
            "no record of a previous sync — try syncing first, then discard if it fails".into(),
        ));
    };

    if head_oid == tracking_oid {
        return Ok(DiscardOutcome {
            performed: false,
            commits_ahead: 0,
            commits: Vec::new(),
            reset_to_oid: Some(tracking_oid.to_string()),
            reset_to_summary: commit_summary(repo, tracking_oid),
        });
    }

    // Enumerate commits in tracking..HEAD for the preview list. Newest
    // first (walk from HEAD, hide tracking). Cap at 50 — the banner
    // shouldn't render more than that anyway.
    let mut revwalk = repo.revwalk()?;
    revwalk.push(head_oid)?;
    let _ = revwalk.hide(tracking_oid);
    let mut commits: Vec<DiscardedCommit> = Vec::new();
    for (idx, oid_res) in revwalk.enumerate() {
        if idx >= 50 {
            break;
        }
        let Ok(oid) = oid_res else { continue };
        let Ok(commit) = repo.find_commit(oid) else { continue };
        let summary = commit
            .summary()
            .unwrap_or("(no message)")
            .to_string();
        commits.push(DiscardedCommit {
            oid: oid.to_string(),
            summary,
            time: commit.time().seconds(),
        });
    }
    let commits_ahead = commits.len();

    if !confirm {
        return Ok(DiscardOutcome {
            performed: false,
            commits_ahead,
            commits,
            reset_to_oid: Some(tracking_oid.to_string()),
            reset_to_summary: commit_summary(repo, tracking_oid),
        });
    }

    // Commit to the reset. Hard reset rewrites the working tree to the
    // tracking commit's tree; working-tree edits the user hadn't
    // committed yet are lost. That's the advertised contract.
    let target = repo.find_object(tracking_oid, Some(ObjectType::Commit))?;
    repo.reset(&target, ResetType::Hard, None)?;

    Ok(DiscardOutcome {
        performed: true,
        commits_ahead,
        commits,
        reset_to_oid: Some(tracking_oid.to_string()),
        reset_to_summary: commit_summary(repo, tracking_oid),
    })
}

fn commit_summary(repo: &Repository, oid: Oid) -> Option<String> {
    repo.find_commit(oid)
        .ok()
        .and_then(|c| c.summary().map(|s| s.to_string()))
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
    /// Unix timestamp of HEAD's commit (the "ours" side of the merge).
    /// Lets the resolver UI render a friendly relative-time chip so the
    /// user can tell which version is older. Note: this is the commit
    /// timestamp for the whole tree, not strictly this file — but in
    /// Yarrow's per-save-checkpoint model that's a close approximation
    /// of "when this file was last touched on this path".
    pub ours_timestamp: Option<i64>,
    /// Unix timestamp of MERGE_HEAD's commit (the "theirs" side).
    pub theirs_timestamp: Option<i64>,
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

    // Pull the HEAD and MERGE_HEAD commit timestamps so the resolver can
    // show "from {path}, 2 hours ago" instead of two anonymous panes.
    // Both reads are best-effort — a corrupted ref shouldn't block the
    // resolver from rendering, so we swallow errors and ship `None`.
    let ours_timestamp = repo
        .head()
        .ok()
        .and_then(|r| r.peel_to_commit().ok())
        .map(|c| c.time().seconds());
    let theirs_timestamp = std::fs::read_to_string(repo.path().join("MERGE_HEAD"))
        .ok()
        .and_then(|s| Oid::from_str(s.trim()).ok())
        .and_then(|oid| repo.find_commit(oid).ok())
        .map(|c| c.time().seconds());

    Ok(ConflictContent {
        relpath: relpath.to_string(),
        base,
        ours,
        theirs,
        working,
        ours_timestamp,
        theirs_timestamp,
    })
}

fn read_blob(repo: &Repository, oid: Oid) -> Result<String> {
    let blob = repo.find_blob(oid)?;
    // Yarrow's conflict UI is line-by-line text — feeding it a binary
    // blob (an attached image, a sealed-history ciphertext) would
    // produce garbage that the user can't safely "resolve". Surface a
    // clean error instead so the frontend can show "this file has a
    // binary conflict" and guide the user to the appropriate tool.
    if blob.is_binary() {
        return Err(YarrowError::Invalid(
            "binary file conflict — Yarrow's text resolver can't merge this safely".into(),
        ));
    }
    let bytes = blob.content();
    std::str::from_utf8(bytes)
        .map(|s| s.to_string())
        .map_err(|_| {
            YarrowError::Invalid(
                "non-UTF-8 conflict content — Yarrow's text resolver can't merge this safely"
                    .into(),
            )
        })
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

    // Remap keepsake refs. When we rewrite a pinned commit's parents
    // (because an ancestor was dropped), the commit itself gets a new
    // oid. Leaving the ref pointing at the old oid would protect a
    // soon-garbage-collected object — worse than useless, since the next
    // prune pass would skip over it and everything downstream. Repoint
    // each keepsake ref and update the sidecar's `oid` field to match.
    if let Some(workdir) = repo.workdir() {
        let mut list = read_keepsakes_file(workdir);
        let mut list_changed = false;
        if let Ok(refs) = repo.references_glob(&format!("{}*", KEEPSAKE_REF_PREFIX)) {
            for maybe in refs {
                let r = match maybe { Ok(r) => r, Err(_) => continue };
                let refname = r.name().map(|s| s.to_string());
                let target = match r.target() { Some(t) => t, None => continue };
                if let Some(Some(new_oid)) = map.get(&target) {
                    if *new_oid != target {
                        // Refresh the ref to the rewritten oid.
                        if let Some(n) = refname {
                            let _ = repo.reference(&n, *new_oid, true, "yarrow: keepsake remap");
                            // Update sidecar: find the entry whose id matches
                            // the ref tail and patch its oid.
                            let tail = n.strip_prefix(KEEPSAKE_REF_PREFIX).unwrap_or("");
                            for k in list.iter_mut() {
                                if k.id == tail {
                                    k.oid = new_oid.to_string();
                                    list_changed = true;
                                }
                            }
                        }
                    }
                }
            }
        }
        if list_changed {
            let _ = write_keepsakes_file(workdir, &list);
        }
    }

    Ok(PruneReport { removed, kept })
}

/// Drop every checkpoint older than `cutoff_secs` (unix timestamp). Children
/// of a pruned commit inherit its parent, so the surviving history is still
/// linear — only the old tail vanishes.
///
/// Keepsakes (pinned checkpoints) are respected — a commit with a
/// `refs/yarrow/keepsakes/*` ref is never dropped no matter how old.
pub fn prune_older_than(repo: &Repository, cutoff_secs: i64) -> Result<PruneReport> {
    let pinned = list_keepsakes_oids(repo);
    rewrite_history_dropping(repo, |commit, _tree| {
        if pinned.contains(&commit.id()) { return Ok(false); }
        Ok(commit.time().seconds() < cutoff_secs)
    })
}

/// Drop checkpoints whose note bodies were all empty — these typically come
/// from "new note" creations and scaffolds that the user hadn't filled in yet.
/// Pinned checkpoints are preserved.
pub fn prune_empty_content(repo: &Repository) -> Result<PruneReport> {
    let pinned = list_keepsakes_oids(repo);
    rewrite_history_dropping(repo, |commit, tree| {
        if pinned.contains(&commit.id()) { return Ok(false); }
        Ok(tree_has_empty_notes(repo, tree))
    })
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

// ───────────────────── keepsakes (pinned checkpoints) ─────────────────────
//
// A "keepsake" is a user-pinned checkpoint protected from history pruning.
// Two storage layers:
//   1. `refs/yarrow/keepsakes/<id>` — a real git ref on the commit oid.
//      Because git ignores unreachable objects, not refs, pinning a
//      checkpoint here guarantees history prune passes skip over it even
//      if its branch would otherwise drop it.
//   2. `.yarrow/keepsakes.json` — the sidecar with human metadata
//      (slug, label, note, pinned_at). The UI reads this; git never does.
//
// Prune passes consult `list_keepsakes_oids` before dropping a commit.

const KEEPSAKE_REF_PREFIX: &str = "refs/yarrow/keepsakes/";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Keepsake {
    pub id: String,
    pub slug: String,
    pub oid: String,
    pub label: String,
    #[serde(default)]
    pub note: String,
    pub pinned_at: i64,
}

fn keepsakes_file(repo_workdir: &Path) -> PathBuf {
    repo_workdir.join(".yarrow").join("keepsakes.json")
}

fn read_keepsakes_file(repo_workdir: &Path) -> Vec<Keepsake> {
    let path = keepsakes_file(repo_workdir);
    match std::fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn write_keepsakes_file(repo_workdir: &Path, list: &[Keepsake]) -> Result<()> {
    let path = keepsakes_file(repo_workdir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(list)
        .map_err(|e| YarrowError::Other(format!("keepsakes serialize: {}", e)))?;
    std::fs::write(&path, json)?;
    Ok(())
}

/// Make up a stable id that's URL-safe as a ref component. Not a git oid —
/// the oid lives in `keepsake.oid`.
fn new_keepsake_id(oid: Oid, label: &str) -> String {
    let now = chrono::Utc::now().timestamp_millis();
    // `slug::slugify` drops anything non-kebab so we get a clean ref
    // component and don't fight git's ref rules.
    let tag = slug::slugify(label);
    let tag = if tag.is_empty() { "pin".to_string() } else { tag };
    format!("{}-{}-{}", now, &oid.to_string()[..7], tag)
}

/// Pin a checkpoint. Writes both the ref and the sidecar metadata entry.
pub fn pin_checkpoint(
    repo: &Repository,
    slug: &str,
    oid_str: &str,
    label: &str,
    note: &str,
) -> Result<Keepsake> {
    let oid = Oid::from_str(oid_str)
        .map_err(|_| YarrowError::Invalid(format!("bad checkpoint oid: {}", oid_str)))?;
    // Sanity: the oid must exist in the repo. If it doesn't, the ref
    // would succeed but protect nothing meaningful — error out loudly.
    repo.find_commit(oid)
        .map_err(|_| YarrowError::Invalid(format!("no such checkpoint: {}", oid_str)))?;

    let id = new_keepsake_id(oid, label);
    let refname = format!("{}{}", KEEPSAKE_REF_PREFIX, id);
    repo.reference(&refname, oid, true, "yarrow: pin keepsake")?;

    let workdir = repo
        .workdir()
        .ok_or_else(|| YarrowError::Other("bare repo has no workdir".into()))?;

    let mut list = read_keepsakes_file(workdir);
    let now = chrono::Utc::now().timestamp();
    let ks = Keepsake {
        id: id.clone(),
        slug: slug.to_string(),
        oid: oid.to_string(),
        label: label.to_string(),
        note: note.to_string(),
        pinned_at: now,
    };
    list.push(ks.clone());
    write_keepsakes_file(workdir, &list)?;
    Ok(ks)
}

/// All keepsakes, newest first. UI reads this directly; git only knows
/// about the refs, not the metadata.
pub fn list_keepsakes(repo: &Repository) -> Result<Vec<Keepsake>> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| YarrowError::Other("bare repo has no workdir".into()))?;
    let mut list = read_keepsakes_file(workdir);
    list.sort_by(|a, b| b.pinned_at.cmp(&a.pinned_at));
    Ok(list)
}

/// Unpin. Drops both the ref and the sidecar entry. No-op when the id
/// is unknown — safe to call as part of a bulk cleanup.
pub fn unpin_checkpoint(repo: &Repository, id: &str) -> Result<()> {
    let refname = format!("{}{}", KEEPSAKE_REF_PREFIX, id);
    // Ignore "no such ref" — we want unpin to be idempotent.
    if let Ok(mut r) = repo.find_reference(&refname) {
        r.delete()?;
    }
    let workdir = repo
        .workdir()
        .ok_or_else(|| YarrowError::Other("bare repo has no workdir".into()))?;
    let mut list = read_keepsakes_file(workdir);
    let before = list.len();
    list.retain(|k| k.id != id);
    if list.len() != before {
        write_keepsakes_file(workdir, &list)?;
    }
    Ok(())
}

/// Every oid protected by a keepsake ref. Consulted by `rewrite_history_dropping`
/// so a prune pass can never remove a pinned checkpoint even if it matches
/// the user's filter (older-than, empty-content).
fn list_keepsakes_oids(repo: &Repository) -> std::collections::HashSet<Oid> {
    let mut out = std::collections::HashSet::new();
    if let Ok(refs) = repo.references_glob(&format!("{}*", KEEPSAKE_REF_PREFIX)) {
        for maybe in refs {
            if let Ok(r) = maybe {
                if let Some(target) = r.target() {
                    out.insert(target);
                }
            }
        }
    }
    out
}

/// Outcome of an unreachable-objects prune. Encryption-at-history needs
/// to know whether `git gc` actually ran — without the prune, plaintext
/// blobs stay in `.git/objects/` recoverable via `git fsck --unreachable`,
/// and the UI's "history sealed" promise becomes a lie.
#[derive(Debug)]
pub enum GcOutcome {
    /// `git gc --prune=now` ran and exited 0.
    Pruned,
    /// `git` is not on PATH. The rewrite + reflog drop still ran, but
    /// loose plaintext blobs persist until the user installs git and runs
    /// `git gc --prune=now` themselves.
    GitNotAvailable,
    /// `git` ran but exited non-zero, or some other I/O failure.
    GcFailed(String),
}

/// Ask the system `git` to prune unreachable objects so the plaintext
/// blobs no longer sit in `.git/objects/`. Returns a `GcOutcome` so the
/// caller can decide whether to surface the result — encryption-at-history
/// needs to refuse the operation if the prune was skipped, but plain
/// housekeeping callers can ignore the outcome.
pub fn gc_unreachable(repo: &Repository) -> Result<GcOutcome> {
    let Some(workdir) = repo.workdir() else {
        return Ok(GcOutcome::Pruned);
    };
    let result = std::process::Command::new("git")
        .arg("-C")
        .arg(workdir)
        .arg("gc")
        .arg("--prune=now")
        .arg("--quiet")
        .status();
    match result {
        Ok(s) if s.success() => Ok(GcOutcome::Pruned),
        Ok(s) => Ok(GcOutcome::GcFailed(format!(
            "git gc exited with status {}",
            s.code().map(|c| c.to_string()).unwrap_or_else(|| "<signal>".into())
        ))),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Ok(GcOutcome::GitNotAvailable)
        }
        Err(e) => Ok(GcOutcome::GcFailed(format!("git gc failed: {}", e))),
    }
}
