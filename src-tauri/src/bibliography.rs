//! Render an auto-generated bibliography from a note's wikilinks.
//!
//! Walks the source note for `[[Title]]` wikilinks; for each match that
//! resolves to a `paper`-tagged note (the shape `bibtex_import.rs`
//! produces), extracts the metadata block from the linked note's body
//! and formats an APA-ish citation. The output is a single markdown
//! chunk wrapped in HTML comment fences so the user can re-run the
//! command later to refresh in place.
//!
//! Citation format choice — APA is the most-recognised and the
//! frontmatter shape we have (Authors / Year / Title / Venue / DOI)
//! maps to it without lossy transformation. Future iterations can add
//! style switches; for v1 we ship the most-asked-for and let the user
//! hand-edit if they want something different.
use crate::error::Result;
use crate::notes;
use std::collections::{HashMap, HashSet};
use std::path::Path;

const FENCE_OPEN: &str = "<!-- yarrow:bibliography -->";
const FENCE_CLOSE: &str = "<!-- /yarrow:bibliography -->";

#[derive(Debug, Default, Clone)]
struct PaperMeta {
    authors: String,
    year: String,
    title: String,
    venue: String,
    doi: String,
    url: String,
}

fn parse_paper_meta(body: &str, fallback_title: &str) -> PaperMeta {
    let mut m = PaperMeta {
        title: fallback_title.to_string(),
        ..Default::default()
    };
    for line in body.lines() {
        let trimmed = line.trim_start();
        if let Some(rest) = trimmed.strip_prefix("**Authors:**") {
            m.authors = rest.trim().to_string();
        } else if let Some(rest) = trimmed.strip_prefix("**Year:**") {
            m.year = rest.trim().to_string();
        } else if let Some(rest) = trimmed
            .strip_prefix("**Journal / venue:**")
            .or_else(|| trimmed.strip_prefix("**Journal:**"))
            .or_else(|| trimmed.strip_prefix("**Venue:**"))
        {
            m.venue = rest.trim().to_string();
        } else if let Some(rest) = trimmed.strip_prefix("**DOI:**") {
            m.doi = rest.trim().to_string();
        } else if let Some(rest) = trimmed.strip_prefix("**URL:**") {
            m.url = rest.trim().to_string();
        }
    }
    m
}

fn format_apa(m: &PaperMeta) -> String {
    let mut out = String::new();
    if !m.authors.is_empty() {
        out.push_str(&m.authors);
        if !m.year.is_empty() {
            out.push_str(&format!(" ({})", m.year));
        }
        out.push_str(". ");
    } else if !m.year.is_empty() {
        out.push_str(&format!("({}). ", m.year));
    }
    out.push_str(&m.title);
    if !out.ends_with('.') {
        out.push('.');
    }
    out.push(' ');
    if !m.venue.is_empty() {
        out.push('*');
        out.push_str(&m.venue);
        out.push('*');
        out.push('.');
        out.push(' ');
    }
    if !m.doi.is_empty() {
        out.push_str(&format!("https://doi.org/{}", m.doi.trim_start_matches("https://doi.org/")));
    } else if !m.url.is_empty() {
        out.push_str(&m.url);
    }
    out.trim_end().to_string()
}

fn extract_wikilinks(body: &str) -> Vec<String> {
    // [[Title]] or [[Title|alt]] — we only want the target. Skip code
    // fences so example wikilinks in tutorial notes don't pollute the list.
    let mut out = Vec::new();
    let mut in_fence = false;
    for line in body.lines() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        let bytes = line.as_bytes();
        let mut i = 0;
        while i + 1 < bytes.len() {
            if bytes[i] == b'[' && bytes[i + 1] == b'[' {
                let start = i + 2;
                let mut j = start;
                while j + 1 < bytes.len() && !(bytes[j] == b']' && bytes[j + 1] == b']') {
                    j += 1;
                }
                if j + 1 < bytes.len() {
                    let inner = &line[start..j];
                    let target = inner.split('|').next().unwrap_or(inner).trim();
                    if !target.is_empty() {
                        out.push(target.to_string());
                    }
                    i = j + 2;
                    continue;
                }
            }
            i += 1;
        }
    }
    out
}

/// Build the rendered bibliography for `slug`, scanning `body` for
/// wikilinks. The caller passes the source body in so we don't have to
/// re-read it (and so encrypted source notes can be unlocked at the
/// caller's layer instead of here). Returns the full chunk including
/// HTML-comment fences so callers can insert (or search-and-replace) it
/// as a single block. Empty string when there are zero `paper`-tagged
/// references.
pub fn render(root: &Path, body: &str) -> Result<String> {
    let scanned = notes::scan(root)?;
    // Build lookups: title → (slug, body, tags), slug → (title, body, tags)
    let mut by_title: HashMap<String, (String, String, Vec<String>)> = HashMap::new();
    let mut by_slug: HashMap<String, (String, String, Vec<String>)> = HashMap::new();
    for n in scanned {
        let title = if n.fm.title.trim().is_empty() {
            n.slug.clone()
        } else {
            n.fm.title.clone()
        };
        let tags = n.fm.tags.clone();
        by_title.insert(
            title.to_lowercase(),
            (n.slug.clone(), n.body.clone(), tags.clone()),
        );
        by_slug.insert(n.slug.clone(), (title, n.body, tags));
    }

    let mut seen: HashSet<String> = HashSet::new();
    let mut entries: Vec<String> = Vec::new();
    for target in extract_wikilinks(body) {
        // Try as a title first, then as a slug — wikilinks accept either.
        let key = target.to_lowercase();
        let resolved = by_title.get(&key).or_else(|| by_slug.get(target.as_str()));
        let Some((tslug, tbody, tags)) = resolved else { continue };
        if !tags.iter().any(|t| t == "paper") {
            continue;
        }
        if !seen.insert(tslug.clone()) {
            continue;
        }
        let meta = parse_paper_meta(tbody, target.as_str());
        let citation = format_apa(&meta);
        // Trailing wikilink keeps the source note discoverable from the
        // rendered bibliography — the same affordance as the "see also"
        // links we already use elsewhere.
        entries.push(format!("- {} [[{}]]", citation, target));
    }
    if entries.is_empty() {
        return Ok(String::new());
    }
    entries.sort();

    let mut out = String::new();
    out.push_str(FENCE_OPEN);
    out.push('\n');
    out.push_str("## References\n\n");
    for line in &entries {
        out.push_str(line);
        out.push('\n');
    }
    out.push_str(FENCE_CLOSE);
    out.push('\n');
    Ok(out)
}

/// Insert or replace the bibliography block in `body`. If the source
/// already contains a fenced block, replace it in place; otherwise
/// append the new chunk to the end of the body, separated by a blank
/// line. Returns the new body.
pub fn upsert_block(body: &str, block: &str) -> String {
    if block.is_empty() {
        // Caller asked us to upsert nothing — strip any existing block
        // so a note that no longer cites anything ends up clean.
        return strip_existing(body);
    }
    if let (Some(open_at), Some(close_at)) = (body.find(FENCE_OPEN), body.find(FENCE_CLOSE)) {
        if open_at < close_at {
            let after = close_at + FENCE_CLOSE.len();
            let mut out = String::new();
            out.push_str(&body[..open_at]);
            out.push_str(block.trim_end_matches('\n'));
            out.push_str(&body[after..]);
            return out;
        }
    }
    let mut out = body.trim_end().to_string();
    out.push_str("\n\n");
    out.push_str(block);
    out
}

fn strip_existing(body: &str) -> String {
    if let (Some(open_at), Some(close_at)) = (body.find(FENCE_OPEN), body.find(FENCE_CLOSE)) {
        if open_at < close_at {
            let after = close_at + FENCE_CLOSE.len();
            let mut out = String::new();
            out.push_str(body[..open_at].trim_end());
            out.push('\n');
            out.push_str(&body[after..]);
            return out;
        }
    }
    body.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_paper_meta() {
        let body = "**Authors:** Tufte, E.\n**Year:** 2006\n**Journal / venue:** Graphics Press\n**DOI:** 10.123/abc\n";
        let m = parse_paper_meta(body, "fallback");
        assert_eq!(m.authors, "Tufte, E.");
        assert_eq!(m.year, "2006");
        assert_eq!(m.venue, "Graphics Press");
        assert_eq!(m.doi, "10.123/abc");
    }

    #[test]
    fn formats_apa_full() {
        let m = PaperMeta {
            authors: "Tufte, E.".into(),
            year: "2006".into(),
            title: "Beautiful Evidence".into(),
            venue: "Graphics Press".into(),
            doi: "10.123/abc".into(),
            url: String::new(),
        };
        assert_eq!(
            format_apa(&m),
            "Tufte, E. (2006). Beautiful Evidence. *Graphics Press*. https://doi.org/10.123/abc"
        );
    }

    #[test]
    fn extracts_wikilinks_basic() {
        let body = "see [[Beautiful Evidence]] and [[On Bullshit|that thing]]\n```\n[[in fence]]\n```\n";
        assert_eq!(
            extract_wikilinks(body),
            vec!["Beautiful Evidence".to_string(), "On Bullshit".to_string()]
        );
    }

    #[test]
    fn upsert_appends_when_absent() {
        let body = "Some text.\n";
        let block = format!("{}\n## References\n\n- one\n{}\n", FENCE_OPEN, FENCE_CLOSE);
        let out = upsert_block(body, &block);
        assert!(out.contains("Some text."));
        assert!(out.contains(FENCE_OPEN));
        assert!(out.contains("- one"));
    }

    #[test]
    fn upsert_replaces_when_present() {
        let body = format!(
            "intro\n\n{}\n## References\n\n- old\n{}\nepilogue\n",
            FENCE_OPEN, FENCE_CLOSE
        );
        let block = format!("{}\n## References\n\n- new\n{}\n", FENCE_OPEN, FENCE_CLOSE);
        let out = upsert_block(&body, &block);
        assert!(out.contains("- new"));
        assert!(!out.contains("- old"));
        assert!(out.contains("epilogue"));
    }

    #[test]
    fn upsert_empty_strips_existing() {
        let body = format!(
            "intro\n\n{}\n## References\n\n- old\n{}\nepilogue\n",
            FENCE_OPEN, FENCE_CLOSE
        );
        let out = upsert_block(&body, "");
        assert!(!out.contains("- old"));
        assert!(out.contains("intro"));
        assert!(out.contains("epilogue"));
    }
}
