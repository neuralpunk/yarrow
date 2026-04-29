//! Welcome-screen stats and "Continue" lookup.
//!
//! The IntroPage shows three quiet stats below the tagline:
//! - notes-this-month: count of notes created or modified this calendar month
//! - day-streak: consecutive days back from today with at least one edit
//! - words-this-month: total word count of notes modified this month
//!
//! …plus a "Continue" line that surfaces the most recently modified note
//! across every recent workspace, so a returning user can resume in one tap.
//!
//! Per the welcome-screen-enhancement spec (§3 Data Layer): no per-edit
//! word-delta log exists in the codebase, so we approximate
//! "words written this month" by summing the word count of notes whose
//! `modified` falls in the current month. This is faithful to user intent
//! at the granularity Yarrow tracks (`modified` on the note frontmatter)
//! without inventing an edit-history datastore.
//!
//! Likewise the spec specifies "most recently *opened*" for the Continue
//! line; Yarrow doesn't track a per-note `last_opened` (only per-workspace),
//! so we use the most recently *modified* note as the proxy. Opening the
//! workspace lands the user on their last-active note via the existing
//! "where you left off" surface either way, so the visible behaviour is
//! the same.

use std::path::Path;

use chrono::{Datelike, NaiveDate, TimeZone, Utc};
use serde::Serialize;

use crate::app_config;
use crate::notes;

/// Returned from `cmd_welcome_stats` and rendered by the IntroPage.
#[derive(Debug, Serialize, Clone, Default)]
pub struct WelcomeStats {
    pub notes_this_month: u32,
    pub day_streak: u32,
    pub words_this_month: u32,
    pub continue_note: Option<ContinueNote>,
}

/// One-tap return entry. `workspace_path` is the absolute path the
/// frontend can pass to the existing `cmd_open_workspace` flow.
#[derive(Debug, Serialize, Clone)]
pub struct ContinueNote {
    pub workspace_path: String,
    pub workspace_name: String,
    pub note_slug: String,
    pub note_title: String,
    /// ISO 8601 — same shape the frontend's relative-time formatter expects.
    pub modified: String,
}

/// Compute every welcome-screen statistic in a single pass.
///
/// Walks `app_config::list_recent()` and, for each workspace whose folder
/// still exists on disk, scans the notes directory. The scan reads each
/// note's frontmatter + body once; per-stat helpers operate on the same
/// in-memory list. A typical user with ~3 workspaces of ~100 notes each
/// settles well under the 100ms target the spec sets.
pub fn compute() -> WelcomeStats {
    let recent = app_config::list_recent();
    if recent.is_empty() {
        return WelcomeStats::default();
    }

    // Aggregated buckets: every note across every workspace, kept just
    // long enough to compute the four numbers below.
    let mut all_notes: Vec<(String, String, notes::ScannedNote)> = Vec::new();
    for ws in &recent {
        let root = Path::new(&ws.path);
        if !root.is_dir() {
            continue;
        }
        let scanned = match notes::scan(root) {
            Ok(v) => v,
            Err(_) => continue,
        };
        for n in scanned {
            // Skip encrypted notes — we can't count their words and their
            // titles are sensitive enough that we don't surface them on
            // the Continue line either.
            if n.fm.encrypted {
                continue;
            }
            all_notes.push((ws.path.clone(), ws.name.clone(), n));
        }
    }

    let now = Utc::now();
    let start_of_month = match Utc.with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0).single() {
        Some(dt) => dt.to_rfc3339(),
        None => String::new(),
    };

    WelcomeStats {
        notes_this_month: count_notes_this_month(&all_notes, &start_of_month),
        day_streak: compute_day_streak(&all_notes, now.date_naive()),
        words_this_month: sum_words_this_month(&all_notes, &start_of_month),
        continue_note: pick_continue_note(&all_notes),
    }
}

fn count_notes_this_month(
    all_notes: &[(String, String, notes::ScannedNote)],
    start_of_month: &str,
) -> u32 {
    if start_of_month.is_empty() {
        return 0;
    }
    all_notes
        .iter()
        .filter(|(_, _, n)| {
            let modified = pick_modified(&n.fm);
            !modified.is_empty() && modified.as_str() >= start_of_month
        })
        .count() as u32
}

fn sum_words_this_month(
    all_notes: &[(String, String, notes::ScannedNote)],
    start_of_month: &str,
) -> u32 {
    if start_of_month.is_empty() {
        return 0;
    }
    let mut total: u32 = 0;
    for (_, _, n) in all_notes {
        let modified = pick_modified(&n.fm);
        if modified.is_empty() || modified.as_str() < start_of_month {
            continue;
        }
        total = total.saturating_add(word_count(&n.body));
    }
    total
}

/// Streak counts consecutive days, ending with today (if today has any
/// activity) or with yesterday (if today doesn't yet — so a user who
/// hasn't written today still sees their through-yesterday streak).
fn compute_day_streak(
    all_notes: &[(String, String, notes::ScannedNote)],
    today: NaiveDate,
) -> u32 {
    use std::collections::HashSet;
    let mut active_days: HashSet<NaiveDate> = HashSet::new();
    for (_, _, n) in all_notes {
        let modified = pick_modified(&n.fm);
        let day = match parse_date_only(&modified) {
            Some(d) => d,
            None => continue,
        };
        active_days.insert(day);
    }
    if active_days.is_empty() {
        return 0;
    }

    let mut streak: u32 = 0;
    let mut cursor = today;
    let mut today_inactive_skipped = false;

    loop {
        if active_days.contains(&cursor) {
            streak += 1;
            cursor = match cursor.pred_opt() {
                Some(d) => d,
                None => break,
            };
            continue;
        }
        // Today with no activity yet doesn't break the streak — count
        // backward from yesterday. After we've skipped today once, any
        // missing day actually breaks it.
        if cursor == today && !today_inactive_skipped {
            today_inactive_skipped = true;
            cursor = match cursor.pred_opt() {
                Some(d) => d,
                None => break,
            };
            continue;
        }
        break;
    }
    streak
}

fn pick_continue_note(
    all_notes: &[(String, String, notes::ScannedNote)],
) -> Option<ContinueNote> {
    let mut best: Option<(&str, &str, &notes::ScannedNote, String)> = None;
    for (path, name, n) in all_notes {
        let modified = pick_modified(&n.fm);
        if modified.is_empty() {
            continue;
        }
        match &best {
            Some((_, _, _, prev)) if modified.as_str() <= prev.as_str() => {}
            _ => {
                best = Some((path.as_str(), name.as_str(), n, modified));
            }
        }
    }
    let (path, name, n, modified) = best?;
    let title = if n.fm.title.is_empty() {
        n.slug.clone()
    } else {
        n.fm.title.clone()
    };
    Some(ContinueNote {
        workspace_path: path.to_string(),
        workspace_name: name.to_string(),
        note_slug: n.slug.clone(),
        note_title: title,
        modified,
    })
}

fn pick_modified(fm: &notes::Frontmatter) -> String {
    if !fm.modified.is_empty() {
        fm.modified.clone()
    } else {
        fm.created.clone()
    }
}

fn parse_date_only(iso: &str) -> Option<NaiveDate> {
    if iso.len() < 10 {
        return None;
    }
    NaiveDate::parse_from_str(&iso[..10], "%Y-%m-%d").ok()
}

fn word_count(body: &str) -> u32 {
    body.split_whitespace().count() as u32
}
