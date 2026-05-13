// 3.2 — Inline Glossary, file-backed.
//
// The glossary is a standalone JSON file at `.yarrow/glossary.json` —
// authored entirely from the Settings → Glossary pane. Each entry is a
// `{ term, definition }` pair; the editor underlines every occurrence of
// a term and shows its definition in a hover tooltip.
//
// The file IS tracked in git (it travels with the workspace just like
// `config.toml` and the notes themselves) so a user's defined terms
// follow them across machines.
//
// This module owns the on-disk format. Reads tolerate a missing file
// (a fresh workspace has no glossary yet) and propagate parse errors so
// users notice when they've hand-edited the file into something invalid.
// Writes are atomic.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::error::Result;
use crate::workspace::{atomic_write, yarrow_dir};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct GlossaryEntry {
    pub term: String,
    pub definition: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct GlossaryFile {
    #[serde(default)]
    entries: Vec<GlossaryEntry>,
}

const GLOSSARY_FILE: &str = "glossary.json";

pub fn path(root: &Path) -> PathBuf {
    yarrow_dir(root).join(GLOSSARY_FILE)
}

/// Read the glossary file. Missing file → empty Vec; malformed JSON
/// surfaces as `YarrowError::Json`.
///
/// Entries are returned sorted by term length descending (with the term
/// itself as a stable tiebreaker) so prefix-overlapping terms like
/// "data" and "data structure" match the longer one first when the
/// editor scans paragraph text. Empty or whitespace-only terms and
/// definitions are filtered out. The on-disk order is preserved between
/// reads otherwise — sorting is purely an output-side concern.
pub fn read(root: &Path) -> Result<Vec<GlossaryEntry>> {
    let p = path(root);
    if !p.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(&p)?;
    let parsed: GlossaryFile = serde_json::from_str(&raw)?;
    Ok(sanitize_and_sort(parsed.entries))
}

/// Overwrite the glossary file with `entries`. Empty terms / definitions
/// are filtered out and case-insensitive duplicates are collapsed
/// (keeping the first occurrence) so the editor's regex never has to
/// worry about dupes. The on-disk order is the cleaned input order, not
/// the longest-first order — preserve what the user typed.
pub fn write(root: &Path, entries: &[GlossaryEntry]) -> Result<()> {
    let cleaned = clean(entries);
    let p = path(root);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let body = GlossaryFile { entries: cleaned };
    let raw = serde_json::to_string_pretty(&body)?;
    atomic_write(&p, raw.as_bytes())?;
    Ok(())
}

fn clean(entries: &[GlossaryEntry]) -> Vec<GlossaryEntry> {
    let mut out: Vec<GlossaryEntry> = Vec::with_capacity(entries.len());
    let mut seen: std::collections::HashSet<String> =
        std::collections::HashSet::with_capacity(entries.len());
    for e in entries {
        let term = e.term.trim().to_string();
        let definition = e.definition.trim().to_string();
        if term.is_empty() || definition.is_empty() {
            continue;
        }
        let key = term.to_lowercase();
        if !seen.insert(key) {
            continue;
        }
        out.push(GlossaryEntry { term, definition });
    }
    out
}

fn sanitize_and_sort(entries: Vec<GlossaryEntry>) -> Vec<GlossaryEntry> {
    let mut cleaned = clean(&entries);
    cleaned.sort_by(|a, b| {
        b.term
            .chars()
            .count()
            .cmp(&a.term.chars().count())
            .then_with(|| a.term.cmp(&b.term))
    });
    cleaned
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make(term: &str, def: &str) -> GlossaryEntry {
        GlossaryEntry {
            term: term.to_string(),
            definition: def.to_string(),
        }
    }

    #[test]
    fn clean_filters_empty_terms_and_definitions() {
        let entries = vec![
            make("   ", "empty term skipped"),
            make("Shore", ""),
            make("Tide", "The rise and fall of sea levels."),
            make("Orchard", "A cluster of fruit trees."),
        ];
        let out = clean(&entries);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].term, "Tide");
        assert_eq!(out[1].term, "Orchard");
    }

    #[test]
    fn clean_trims_whitespace() {
        let entries = vec![make("  Shore  ", "  surrounded by ws  ")];
        let out = clean(&entries);
        assert_eq!(out[0].term, "Shore");
        assert_eq!(out[0].definition, "surrounded by ws");
    }

    #[test]
    fn clean_dedups_case_insensitively_keeping_first() {
        let entries = vec![
            make("Tide", "The first definition wins."),
            make("tide", "Dup, dropped."),
            make("TIDE", "Also dropped."),
        ];
        let out = clean(&entries);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].term, "Tide");
        assert_eq!(out[0].definition, "The first definition wins.");
    }

    #[test]
    fn sanitize_and_sort_orders_longest_term_first() {
        let entries = vec![
            make("data", "Information."),
            make("data structure", "An organised way to store values."),
            make("data lake", "Raw repository of structured and unstructured data."),
        ];
        let out = sanitize_and_sort(entries);
        assert_eq!(out[0].term, "data structure");
        assert_eq!(out[1].term, "data lake");
        assert_eq!(out[2].term, "data");
    }

    #[test]
    fn parses_missing_entries_field_as_empty() {
        let parsed: GlossaryFile = serde_json::from_str("{}").unwrap();
        assert!(parsed.entries.is_empty());
    }

    #[test]
    fn round_trips_through_json() {
        let entries = vec![
            make("Shore", "The boundary where land meets the tide."),
            make("Tide", "The rise and fall of sea levels."),
        ];
        let raw = serde_json::to_string(&GlossaryFile { entries: entries.clone() }).unwrap();
        let parsed: GlossaryFile = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed.entries, entries);
    }
}
