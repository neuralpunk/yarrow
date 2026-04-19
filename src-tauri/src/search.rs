use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::notes;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchHit {
    pub slug: String,
    pub title: String,
    pub snippet: String,
    pub score: i32,
}

pub fn search(root: &Path, query: &str, limit: usize) -> Result<Vec<SearchHit>> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
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
