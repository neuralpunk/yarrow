//! 2.2.0 — Smart shopping list (v1).
//!
//! When the user is in a recipe-shaped note, they can run "Add to
//! shopping list" — which scans the note for an `## Ingredients`
//! section (case-insensitive), extracts each `- ` / `* ` / `+ ` bullet,
//! and appends them to a workspace-level `shopping-list` note with the
//! recipe name as origin so duplicates from different recipes don't
//! collide.
//!
//! The shopping-list note is created on first use with a structured
//! body. Existing items aren't reordered — appended items go at the
//! end of the "Outstanding" section. Items already present (verbatim
//! ingredient text from the same source) are skipped to avoid the
//! "open the same recipe twice → duplicate everything" foot-gun.

use crate::error::Result;
use crate::notes;
use std::path::Path;

const SHOPPING_LIST_SLUG: &str = "shopping-list";
const OUTSTANDING_HEADER: &str = "## Outstanding";
const BOUGHT_HEADER: &str = "## Bought";

const TEMPLATE_BODY: &str = r#"---
tags: [shopping-list]
---

# Shopping list

_Items below are added when you run "Add to shopping list" from a recipe
note. Tick the box (`- [ ]` → `- [x]`) when you've bought something —
the next sync will move it down to **Bought** automatically. Source
recipes are wikilinked so you can jump back if you forget what you
needed it for._

## Outstanding

## Bought
"#;

/// Outcome reported back to the frontend so it can build a meaningful
/// toast ("Added 6 of 8 — 2 already on the list").
#[derive(Debug, Default, serde::Serialize)]
pub struct ShoppingListOutcome {
    pub added: u32,
    pub skipped_duplicates: u32,
    pub source_title: String,
}

/// Append `items` to the workspace's shopping-list note, tagging each
/// with the source recipe's title for back-reference.
pub fn add_items(
    root: &Path,
    items: &[String],
    source_title: &str,
) -> Result<ShoppingListOutcome> {
    let mut outcome = ShoppingListOutcome {
        source_title: source_title.to_string(),
        ..Default::default()
    };
    if items.is_empty() {
        return Ok(outcome);
    }

    // Read existing list (or seed it).
    let path = notes::note_path(root, SHOPPING_LIST_SLUG);
    let body = if path.exists() {
        std::fs::read_to_string(&path)?
    } else {
        // Don't create via notes::create here — that would trigger
        // index/graph rebuilds before we've written the body. Caller
        // wraps in with_repo_locked for the checkpoint.
        TEMPLATE_BODY.to_string()
    };

    let new_body = append_into_outstanding(&body, items, source_title, &mut outcome);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, new_body)?;
    Ok(outcome)
}

/// Pull ingredient lines out of a recipe note's body. Looks for an
/// `## Ingredients` heading (any case) and reads `-` / `*` / `+`
/// bullets until the next `##` or end-of-body.
pub fn extract_ingredients(body: &str) -> Vec<String> {
    let mut in_section = false;
    let mut out: Vec<String> = Vec::new();
    for raw_line in body.lines() {
        let line = raw_line.trim_end();
        if let Some(rest) = line.strip_prefix("## ") {
            // Heading — flip in/out depending on whether it's the
            // Ingredients section.
            in_section = rest.trim().eq_ignore_ascii_case("ingredients");
            continue;
        }
        if !in_section {
            continue;
        }
        // Bullet line?
        let trimmed = line.trim_start();
        let bullet_text = trimmed
            .strip_prefix("- ")
            .or_else(|| trimmed.strip_prefix("* "))
            .or_else(|| trimmed.strip_prefix("+ "));
        if let Some(text) = bullet_text {
            // Strip checkbox prefix `[ ]` or `[x]` since shopping-list
            // items get their own checkbox.
            let cleaned = text
                .trim_start_matches("[ ] ")
                .trim_start_matches("[x] ")
                .trim_start_matches("[X] ");
            let cleaned = cleaned.trim();
            if !cleaned.is_empty() {
                out.push(cleaned.to_string());
            }
        }
    }
    out
}

// ──────────────── internals ────────────────

/// Insert `items` into the Outstanding section. If the section header
/// is missing, append it. If a `Bought` section is present, insert
/// `Outstanding` before it; otherwise append to the end.
fn append_into_outstanding(
    body: &str,
    items: &[String],
    source: &str,
    outcome: &mut ShoppingListOutcome,
) -> String {
    let outstanding_idx = find_section(body, OUTSTANDING_HEADER);
    let mut working = body.to_string();
    if outstanding_idx.is_none() {
        // Add the Outstanding header. Place before the Bought header
        // if present, otherwise at the end.
        let bought_idx = find_section(body, BOUGHT_HEADER);
        let header_block = format!("{}\n\n", OUTSTANDING_HEADER);
        match bought_idx {
            Some(i) => {
                working.insert_str(i, &header_block);
            }
            None => {
                if !working.ends_with('\n') {
                    working.push('\n');
                }
                working.push('\n');
                working.push_str(&header_block);
            }
        }
    }

    // After ensuring the section exists, find its bounds.
    let outstanding_at = find_section(&working, OUTSTANDING_HEADER)
        .expect("Outstanding header just inserted");
    // Section runs from the line after the header to the next `## `
    // heading or EOF.
    let after_header = match working[outstanding_at..].find('\n') {
        Some(off) => outstanding_at + off + 1,
        None => working.len(),
    };
    let section_end = next_section_start(&working, after_header).unwrap_or(working.len());
    let section_text = &working[after_header..section_end];

    // Build dedup key set from existing items in this section.
    let mut existing: Vec<String> = Vec::new();
    for line in section_text.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix("- [ ] ").or_else(|| t.strip_prefix("- [x] ")) {
            existing.push(canonical(rest));
        }
    }

    // Build the new lines.
    let mut to_insert = String::new();
    if !section_text.ends_with('\n') {
        to_insert.push('\n');
    }
    for item in items {
        let key = canonical(&format!("{} · _from [[{}]]_", item, source));
        if existing.iter().any(|e| e == &key) {
            outcome.skipped_duplicates += 1;
            continue;
        }
        to_insert.push_str(&format!("- [ ] {} · _from [[{}]]_\n", item, source));
        outcome.added += 1;
        existing.push(key);
    }

    let mut out = String::new();
    out.push_str(&working[..section_end]);
    // If section text didn't end with newline, our `to_insert` started
    // with one to clean that up; otherwise append directly.
    if !working[..section_end].ends_with('\n') {
        out.push('\n');
    }
    out.push_str(&to_insert);
    out.push_str(&working[section_end..]);
    out
}

fn find_section(body: &str, header: &str) -> Option<usize> {
    // Match the header at the start of a line, case-insensitively.
    let lower_body = body.to_ascii_lowercase();
    let lower_header = header.to_ascii_lowercase();
    let mut search_from = 0usize;
    while let Some(rel) = lower_body[search_from..].find(&lower_header) {
        let at = search_from + rel;
        let prev = if at == 0 { '\n' } else { body.as_bytes()[at - 1] as char };
        if prev == '\n' {
            return Some(at);
        }
        search_from = at + lower_header.len();
    }
    None
}

fn next_section_start(body: &str, from: usize) -> Option<usize> {
    let lower_body = body.to_ascii_lowercase();
    let mut search_from = from;
    while let Some(rel) = lower_body[search_from..].find("## ") {
        let at = search_from + rel;
        let prev = if at == 0 { '\n' } else { body.as_bytes()[at - 1] as char };
        if prev == '\n' {
            return Some(at);
        }
        search_from = at + 3;
    }
    None
}

fn canonical(s: &str) -> String {
    s.trim().to_lowercase()
}

/// Slug of the workspace shopping list — used by the frontend to
/// navigate to the note after adding items.
pub fn shopping_list_slug() -> &'static str {
    SHOPPING_LIST_SLUG
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_bullets_from_ingredients_section() {
        let body = "# Cookies\n\n## Ingredients\n\n- 2 cups flour\n- 1 egg\n* 1 stick butter\n\n## Instructions\n\n1. Mix.\n";
        let items = extract_ingredients(body);
        assert_eq!(items, vec!["2 cups flour", "1 egg", "1 stick butter"]);
    }

    #[test]
    fn skips_checkbox_prefix() {
        let body = "## Ingredients\n\n- [ ] 2 cups flour\n- [x] 1 egg\n";
        let items = extract_ingredients(body);
        assert_eq!(items, vec!["2 cups flour", "1 egg"]);
    }

    #[test]
    fn appends_to_outstanding_section() {
        let mut outcome = ShoppingListOutcome::default();
        let body = TEMPLATE_BODY.to_string();
        let items = vec!["2 cups flour".to_string(), "1 egg".to_string()];
        let out = append_into_outstanding(&body, &items, "Cookies", &mut outcome);
        assert!(out.contains("- [ ] 2 cups flour · _from [[Cookies]]_"));
        assert!(out.contains("- [ ] 1 egg · _from [[Cookies]]_"));
        assert_eq!(outcome.added, 2);
        assert_eq!(outcome.skipped_duplicates, 0);
    }

    #[test]
    fn dedupes_same_recipe_same_item() {
        let mut outcome = ShoppingListOutcome::default();
        let body = TEMPLATE_BODY.to_string();
        let items = vec!["2 cups flour".to_string()];
        let once = append_into_outstanding(&body, &items, "Cookies", &mut outcome);
        let mut o2 = ShoppingListOutcome::default();
        let twice = append_into_outstanding(&once, &items, "Cookies", &mut o2);
        // Once already present; second pass should add nothing.
        assert_eq!(o2.added, 0);
        assert_eq!(o2.skipped_duplicates, 1);
        let n_lines = twice
            .lines()
            .filter(|l| l.contains("- [ ] 2 cups flour"))
            .count();
        assert_eq!(n_lines, 1);
    }
}
