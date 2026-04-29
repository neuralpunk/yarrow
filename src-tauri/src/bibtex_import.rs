//! BibTeX import → paper-card notes (2.1).
//!
//! Reads a `.bib` file (or any text containing BibTeX entries) and emits
//! one Yarrow note per entry, shaped like the `paper-card` kit: title,
//! a citation block, sections for methodology / findings / critique,
//! and the `paper` tag so the `@cite` autocomplete picks it up.
//!
//! The parser is intentionally minimal — it handles the shapes Zotero
//! and BibLaTeX-style exports actually emit, not the full BibTeX spec.
//! `@comment`, `@preamble`, `@string` directives are skipped; nested
//! braces in field values are tracked so values like
//! `title = {{Some Title}}` survive intact.

use std::collections::HashMap;
use std::path::Path;

use chrono::Utc;

use crate::error::{Result, YarrowError};
use crate::notes::{self, Frontmatter};
use crate::obsidian_import::{ImportReport, ProgressFn};
use crate::workspace;

#[derive(Debug, Default)]
pub struct BibEntry {
    pub entry_type: String,
    pub key: String,
    pub fields: HashMap<String, String>,
}

pub fn import_bibtex(workspace_root: &Path, source: &Path) -> Result<ImportReport> {
    import_bibtex_with_progress(workspace_root, source, None)
}

pub fn import_bibtex_with_progress(
    workspace_root: &Path,
    source: &Path,
    progress: Option<ProgressFn>,
) -> Result<ImportReport> {
    if !source.exists() {
        return Err(YarrowError::Invalid(
            "Pick the .bib file you exported from Zotero, BibDesk, or your reference manager.".into(),
        ));
    }
    let raw = workspace::read_to_string_capped(source)?;
    let entries = parse(&raw);
    let notes_dir = workspace::notes_dir(workspace_root);
    std::fs::create_dir_all(&notes_dir)?;

    let total = entries.len();
    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut renamed: Vec<(String, String)> = Vec::new();

    for (i, entry) in entries.iter().enumerate() {
        if let Some(report) = progress {
            // BibTeX entries don't have filenames; surface the cite key
            // instead so the UI shows recognisable progress.
            report(i, total, &entry.key);
        }
        match write_paper_card(workspace_root, &notes_dir, entry, &mut renamed) {
            Ok(_) => imported += 1,
            Err(_) => skipped += 1,
        }
    }
    if let Some(report) = progress {
        report(total, total, "");
    }
    Ok(ImportReport { imported, skipped, renamed })
}

fn write_paper_card(
    workspace_root: &Path,
    notes_dir: &Path,
    entry: &BibEntry,
    renamed: &mut Vec<(String, String)>,
) -> Result<()> {
    let raw_title = entry.fields.get("title").cloned().unwrap_or_else(|| entry.key.clone());
    let title = clean_value(&raw_title);
    if title.trim().is_empty() {
        return Err(YarrowError::Invalid("entry missing title".into()));
    }

    let slug_base = notes::slug_from_title(&title);
    let mut slug = slug_base.clone();
    let mut n = 1;
    while notes_dir.join(format!("{slug}.md")).exists() {
        n += 1;
        slug = format!("{slug_base}-{n}");
    }
    if slug != slug_base {
        renamed.push((entry.key.clone(), slug.clone()));
    }

    let authors_raw = entry.fields.get("author").cloned().unwrap_or_default();
    let authors = clean_value(&authors_raw).replace(" and ", "; ");
    let year = clean_value(entry.fields.get("year").cloned().unwrap_or_default().as_str());
    let venue = entry
        .fields
        .get("journal")
        .or_else(|| entry.fields.get("booktitle"))
        .or_else(|| entry.fields.get("publisher"))
        .cloned()
        .map(|s| clean_value(&s))
        .unwrap_or_default();
    let doi = clean_value(entry.fields.get("doi").cloned().unwrap_or_default().as_str());
    let url = clean_value(entry.fields.get("url").cloned().unwrap_or_default().as_str());

    let now = Utc::now().to_rfc3339();
    let body = format_paper_body(&title, &authors, &year, &venue, &doi, &url, &entry.key);

    let fm = Frontmatter {
        title: title.clone(),
        created: now.clone(),
        modified: now,
        links: vec![],
        tags: vec!["paper".to_string()],
        pinned: false,
        encrypted: false,
        kdf: String::new(),
        salt: String::new(),
        nonce: String::new(),
        annotations: vec![],
        private: false,
        folder: None,
    };
    notes::write(workspace_root, &slug, &body, Some(fm))?;
    Ok(())
}

fn format_paper_body(
    title: &str,
    authors: &str,
    year: &str,
    venue: &str,
    doi: &str,
    url: &str,
    citation_key: &str,
) -> String {
    let mut out = String::new();
    out.push_str(&format!("# {title}\n\n"));
    out.push_str(&format!("**Authors:** {authors}\n"));
    out.push_str(&format!("**Year:** {year}\n"));
    out.push_str(&format!("**Journal / venue:** {venue}\n"));
    out.push_str(&format!("**DOI:** {doi}\n"));
    if !url.is_empty() {
        out.push_str(&format!("**URL:** {url}\n"));
    }
    out.push_str(&format!("**Citation key:** {citation_key}\n\n"));
    out.push_str("## In one sentence\n\n\n");
    out.push_str("## Methodology\n\n\n");
    out.push_str("## Key findings\n\n-\n\n");
    out.push_str("## My critique\n\n\n");
    out.push_str("## Open questions\n\n??\n\n");
    out.push_str("## Connections\n\n- Related to [[]]\n");
    out
}

/// Strip wrapping braces / quotes and collapse whitespace + LaTeX
/// command artifacts that read poorly in plain markdown. Not exhaustive
/// — the goal is "looks like sane prose," not "LaTeX-perfect."
fn clean_value(raw: &str) -> String {
    let mut s = raw.trim().to_string();
    while (s.starts_with('{') && s.ends_with('}'))
        || (s.starts_with('"') && s.ends_with('"'))
    {
        s = s[1..s.len() - 1].to_string();
    }
    // Drop any leftover braces (common after stripping the outer pair):
    // `{Title with {Acronym} embedded}` → `Title with Acronym embedded`.
    s = s.replace(['{', '}'], "");
    // Common LaTeX noise.
    s = s.replace("\\&", "&").replace("--", "–");
    // Collapse runs of whitespace that crept in from line continuations.
    let mut prev_ws = false;
    let collapsed: String = s
        .chars()
        .filter_map(|c| {
            if c.is_whitespace() {
                if prev_ws {
                    None
                } else {
                    prev_ws = true;
                    Some(' ')
                }
            } else {
                prev_ws = false;
                Some(c)
            }
        })
        .collect();
    collapsed.trim().to_string()
}

// ─────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────

pub fn parse(text: &str) -> Vec<BibEntry> {
    let bytes = text.as_bytes();
    let mut entries = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        // Find next `@` that starts an entry (not inside an existing one).
        while i < bytes.len() && bytes[i] != b'@' {
            i += 1;
        }
        if i >= bytes.len() {
            break;
        }
        i += 1;

        let type_start = i;
        while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
            i += 1;
        }
        let entry_type = std::str::from_utf8(&bytes[type_start..i])
            .unwrap_or("")
            .to_lowercase();
        if entry_type.is_empty() {
            continue;
        }
        // Skip directives we don't care about. They still have an opening
        // delimiter we need to match-and-consume so we don't confuse the
        // outer loop.
        if matches!(entry_type.as_str(), "comment" | "preamble" | "string") {
            skip_balanced(bytes, &mut i);
            continue;
        }

        skip_whitespace(bytes, &mut i);
        if i >= bytes.len() || (bytes[i] != b'{' && bytes[i] != b'(') {
            continue;
        }
        let opener = bytes[i];
        let closer = if opener == b'{' { b'}' } else { b')' };
        i += 1;

        // Cite key (up to comma or end of entry).
        skip_whitespace(bytes, &mut i);
        let key_start = i;
        while i < bytes.len() && bytes[i] != b',' && bytes[i] != closer {
            i += 1;
        }
        let key = std::str::from_utf8(&bytes[key_start..i])
            .unwrap_or("")
            .trim()
            .to_string();
        if i < bytes.len() && bytes[i] == b',' {
            i += 1;
        }

        let mut fields = HashMap::new();
        loop {
            skip_whitespace(bytes, &mut i);
            if i >= bytes.len() || bytes[i] == closer {
                break;
            }
            let name_start = i;
            while i < bytes.len()
                && bytes[i] != b'='
                && !bytes[i].is_ascii_whitespace()
                && bytes[i] != closer
            {
                i += 1;
            }
            let field_name = std::str::from_utf8(&bytes[name_start..i])
                .unwrap_or("")
                .to_lowercase();
            skip_whitespace(bytes, &mut i);
            if i >= bytes.len() || bytes[i] != b'=' {
                break;
            }
            i += 1;
            skip_whitespace(bytes, &mut i);
            let value = read_value(bytes, &mut i, closer);
            if !field_name.is_empty() {
                fields.insert(field_name, value);
            }
            skip_whitespace(bytes, &mut i);
            if i < bytes.len() && bytes[i] == b',' {
                i += 1;
            }
        }
        if i < bytes.len() && bytes[i] == closer {
            i += 1;
        }
        entries.push(BibEntry {
            entry_type,
            key,
            fields,
        });
    }
    entries
}

fn skip_whitespace(bytes: &[u8], i: &mut usize) {
    while *i < bytes.len() && (bytes[*i].is_ascii_whitespace()) {
        *i += 1;
    }
}

fn read_value(bytes: &[u8], i: &mut usize, entry_closer: u8) -> String {
    if *i >= bytes.len() {
        return String::new();
    }
    if bytes[*i] == b'{' {
        let start = *i;
        let mut depth = 0i32;
        // Defence against pathological / malicious .bib files. Real
        // BibTeX never nests deeper than `{{Title with {Acronym}}}`
        // (depth 3); 64 is comfortably past anything legitimate but
        // small enough that a craft file with 100k nested braces
        // can't blow the stack or burn unbounded CPU. On overflow we
        // bail by treating the unclosed group as ending at the cap
        // — the entry's other fields still parse normally.
        const MAX_BRACE_DEPTH: i32 = 64;
        while *i < bytes.len() {
            match bytes[*i] {
                b'{' => {
                    depth += 1;
                    if depth > MAX_BRACE_DEPTH {
                        // Skip forward to the matching close at depth 1
                        // OR the entry-closer, whichever comes first.
                        let mut excess = depth;
                        while *i < bytes.len() && excess > 1 {
                            *i += 1;
                            match bytes.get(*i) {
                                Some(b'{') => excess += 1,
                                Some(b'}') => excess -= 1,
                                _ => {}
                            }
                        }
                        depth = 1;
                    }
                }
                b'}' => {
                    depth -= 1;
                    if depth == 0 {
                        *i += 1;
                        return std::str::from_utf8(&bytes[start..*i])
                            .unwrap_or("")
                            .to_string();
                    }
                }
                _ => {}
            }
            *i += 1;
        }
        return std::str::from_utf8(&bytes[start..*i])
            .unwrap_or("")
            .to_string();
    }
    if bytes[*i] == b'"' {
        let start = *i;
        *i += 1;
        while *i < bytes.len() && bytes[*i] != b'"' {
            *i += 1;
        }
        if *i < bytes.len() {
            *i += 1;
        }
        return std::str::from_utf8(&bytes[start..*i])
            .unwrap_or("")
            .to_string();
    }
    // Bare value — number or @string reference. Read until comma /
    // entry-closer / whitespace.
    let start = *i;
    while *i < bytes.len()
        && bytes[*i] != b','
        && bytes[*i] != entry_closer
        && !bytes[*i].is_ascii_whitespace()
    {
        *i += 1;
    }
    std::str::from_utf8(&bytes[start..*i])
        .unwrap_or("")
        .to_string()
}

fn skip_balanced(bytes: &[u8], i: &mut usize) {
    skip_whitespace(bytes, i);
    if *i >= bytes.len() {
        return;
    }
    let opener = bytes[*i];
    if opener != b'{' && opener != b'(' {
        return;
    }
    let closer = if opener == b'{' { b'}' } else { b')' };
    *i += 1;
    let mut depth = 1i32;
    while *i < bytes.len() && depth > 0 {
        let c = bytes[*i];
        if c == opener {
            depth += 1;
        } else if c == closer {
            depth -= 1;
        }
        *i += 1;
    }
}
