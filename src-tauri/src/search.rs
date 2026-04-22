use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::notes;
use crate::search_index;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchHit {
    pub slug: String,
    pub title: String,
    pub snippet: String,
    pub score: i32,
}

/// Public entry point. `use_index=true` attempts the FTS5 cache first and
/// falls back to the pure substring scanner on any failure. Callers
/// typically read `WorkspaceConfig.preferences.search_index_enabled` to
/// decide the flag — the rest of the app doesn't need to know an index
/// exists.
pub fn search(root: &Path, query: &str, limit: usize, use_index: bool) -> Result<Vec<SearchHit>> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    if use_index {
        if let Some(hits) = try_index_search(root, q, limit) {
            return Ok(hits);
        }
        // Fell through → index couldn't answer the query. Degrade to
        // substring search rather than returning nothing.
    }
    substring_search(root, q, limit)
}

/// FTS5 attempt. Returns `None` on any failure so the caller can fall
/// back silently; an empty Vec means "the index is populated and the
/// query genuinely had no matches" (distinguishable from None).
fn try_index_search(root: &Path, q: &str, limit: usize) -> Option<Vec<SearchHit>> {
    let conn = search_index::open(root).ok()?;
    // Cold-start: if the cache is empty (first search after enabling
    // indexing, or after a clear), populate it once so subsequent
    // queries are instant. A failed rebuild falls through to substring.
    if matches!(search_index::row_count(&conn), Ok(0)) {
        drop(conn);
        if search_index::rebuild(root).is_err() {
            return None;
        }
        let conn2 = search_index::open(root).ok()?;
        return search_index::query(&conn2, q, limit).ok();
    }
    search_index::query(&conn, q, limit).ok()
}

/// Pure substring-and-weighted-terms search — the original path, kept
/// for graceful fallback and for workspaces that disable the cache.
fn substring_search(root: &Path, q: &str, limit: usize) -> Result<Vec<SearchHit>> {
    let q_lower = q.to_lowercase();
    let terms: Vec<&str> = q_lower
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .collect();

    let summaries = notes::list(root)?;
    let mut hits: Vec<SearchHit> = Vec::new();

    for s in &summaries {
        let note = match notes::read(root, &s.slug) {
            Ok(n) => n,
            Err(_) => continue,
        };
        let title_lower = note.frontmatter.title.to_lowercase();
        // Encrypted bodies are opaque ciphertext at rest — matching against
        // base64 would produce false positives. Fall back to title + tags +
        // slug only, per the open question in the 1.0.0 spec.
        let searchable_body = if note.frontmatter.encrypted { String::new() } else { note.body.clone() };
        let body_lower = searchable_body.to_lowercase();
        let slug_lower = note.slug.to_lowercase();

        let mut score = 0i32;
        for t in &terms {
            if title_lower == *t {
                score += 40;
            } else if title_lower.starts_with(t) {
                score += 20;
            } else if title_lower.contains(t) {
                score += 12;
            }
            if slug_lower.contains(t) {
                score += 6;
            }
            let body_hits = body_lower.matches(t).count() as i32;
            score += body_hits * 2;
            for tag in &note.frontmatter.tags {
                if tag.to_lowercase().contains(t) {
                    score += 5;
                }
            }
        }
        if score == 0 {
            continue;
        }

        let snippet = if note.frontmatter.encrypted {
            "🔒 encrypted — unlock to preview".to_string()
        } else {
            extract_snippet(&note.body, &q_lower, &terms)
        };
        hits.push(SearchHit {
            slug: note.slug.clone(),
            title: if note.frontmatter.title.is_empty() {
                note.slug.clone()
            } else {
                note.frontmatter.title.clone()
            },
            snippet,
            score,
        });
    }

    hits.sort_by_key(|h| std::cmp::Reverse(h.score));
    hits.truncate(limit);
    Ok(hits)
}

fn extract_snippet(body: &str, query_lower: &str, terms: &[&str]) -> String {
    let body_lower = body.to_lowercase();
    // Prefer a match for the full query, else first term.
    let (start_char_idx, matched_len) = match body_lower.find(query_lower) {
        Some(i) => (i, query_lower.len()),
        None => terms
            .iter()
            .filter_map(|t| body_lower.find(t).map(|i| (i, t.len())))
            .min_by_key(|(i, _)| *i)
            .unwrap_or((0, 0)),
    };
    let window = 120usize;
    let before = start_char_idx.saturating_sub(window / 2);
    let end = (start_char_idx + matched_len + window / 2).min(body.len());
    let (before, end) = (
        next_char_boundary(body, before, false),
        next_char_boundary(body, end, true),
    );
    let mut snippet = String::new();
    if before > 0 {
        snippet.push('…');
    }
    snippet.push_str(body[before..end].replace('\n', " ").trim());
    if end < body.len() {
        snippet.push('…');
    }
    snippet.chars().take(240).collect()
}

fn next_char_boundary(s: &str, mut idx: usize, forward: bool) -> usize {
    while idx <= s.len() && !s.is_char_boundary(idx) {
        if forward {
            idx += 1;
            if idx > s.len() {
                return s.len();
            }
        } else {
            if idx == 0 {
                return 0;
            }
            idx -= 1;
        }
    }
    idx.min(s.len())
}
