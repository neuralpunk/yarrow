use std::path::Path;

use regex::{NoExpand, Regex, RegexBuilder};
use serde::Serialize;

use crate::error::{Result, YarrowError};
use crate::notes;

#[derive(Serialize)]
pub struct PreviewHit {
    pub slug: String,
    pub title: String,
    pub matches: usize,
    /// First few matched lines as `(line_number, line_text)`.
    pub samples: Vec<(usize, String)>,
}

#[derive(Serialize)]
pub struct ApplyReport {
    pub notes_changed: usize,
    pub total_replacements: usize,
}

fn build_regex(pattern: &str, regex_mode: bool, case_insensitive: bool) -> Result<Regex> {
    let pat = if regex_mode { pattern.to_string() } else { regex::escape(pattern) };
    RegexBuilder::new(&pat)
        .case_insensitive(case_insensitive)
        .multi_line(true)
        .build()
        .map_err(|e| YarrowError::Invalid(format!("bad pattern: {e}")))
}

/// Best-effort filter: when `scope_slugs` is `Some`, only notes whose slug
/// appears in the list are considered. Empty pattern returns no hits.
pub fn preview(
    root: &Path,
    pattern: &str,
    regex_mode: bool,
    case_insensitive: bool,
    scope_slugs: Option<Vec<String>>,
) -> Result<Vec<PreviewHit>> {
    if pattern.is_empty() { return Ok(vec![]); }
    let re = build_regex(pattern, regex_mode, case_insensitive)?;
    let mut hits = Vec::new();
    for summary in notes::list(root)? {
        if let Some(ref allow) = scope_slugs {
            if !allow.contains(&summary.slug) { continue; }
        }
        let note = match notes::read(root, &summary.slug) {
            Ok(n) => n,
            Err(_) => continue, // encrypted/locked or unreadable — skip silently
        };
        let mut count = 0usize;
        let mut samples: Vec<(usize, String)> = Vec::new();
        for (i, line) in note.body.lines().enumerate() {
            let mut iter = re.find_iter(line).peekable();
            if iter.peek().is_some() {
                let line_count = re.find_iter(line).count();
                count += line_count;
                if samples.len() < 3 {
                    samples.push((i + 1, line.to_string()));
                }
            }
        }
        if count > 0 {
            hits.push(PreviewHit {
                slug: summary.slug.clone(),
                title: summary.title,
                matches: count,
                samples,
            });
        }
    }
    Ok(hits)
}

pub fn apply(
    root: &Path,
    pattern: &str,
    replacement: &str,
    regex_mode: bool,
    case_insensitive: bool,
    scope_slugs: Option<Vec<String>>,
) -> Result<ApplyReport> {
    if pattern.is_empty() {
        return Ok(ApplyReport { notes_changed: 0, total_replacements: 0 });
    }
    let re = build_regex(pattern, regex_mode, case_insensitive)?;
    let mut notes_changed = 0usize;
    let mut total = 0usize;
    for summary in notes::list(root)? {
        if let Some(ref allow) = scope_slugs {
            if !allow.contains(&summary.slug) { continue; }
        }
        let note = match notes::read(root, &summary.slug) {
            Ok(n) => n,
            Err(_) => continue,
        };
        let count = re.find_iter(&note.body).count();
        if count == 0 { continue; }
        // `NoExpand` for literal mode (and as the safe default) — without
        // it, `$0`, `$1`, etc. in the replacement string would be expanded
        // as group references, surprising users who paste e.g. "$50" as a
        // literal price. In regex mode users can still use capture groups
        // by wrapping with `${1}` if they ever need to.
        let new_body = if regex_mode {
            re.replace_all(&note.body, replacement).to_string()
        } else {
            re.replace_all(&note.body, NoExpand(replacement)).to_string()
        };
        if new_body != note.body {
            notes::write(root, &summary.slug, &new_body, Some(note.frontmatter))?;
            notes_changed += 1;
            total += count;
        }
    }
    Ok(ApplyReport { notes_changed, total_replacements: total })
}
