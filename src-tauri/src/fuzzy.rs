// Fuzzy ranking (2.1.0). A thin wrapper around `nucleo-matcher`, the
// same scorer Helix uses. We intentionally pick the lower-level
// `nucleo-matcher` crate rather than the threaded `nucleo` one — each
// call to `rank` is fully synchronous and finishes well under 5 ms for
// the ~500-candidate workloads we expect (command palette showing
// every note title + path name + command). Threading would add
// coordination overhead for no win at that scale.
//
// The ranker is order-preserving for identical scores: the original
// input order wins ties. This matters in the palette where the
// top-of-list commands ("New note", "Jump to today") should keep their
// natural precedence when a user's query matches them equally.

use nucleo_matcher::pattern::{AtomKind, CaseMatching, Normalization, Pattern};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzyHit {
    /// Index into the original `candidates` slice.
    pub index: usize,
    /// Nucleo's raw score — higher is better. We expose it so the
    /// caller can threshold or display it; most callers just care
    /// about order.
    pub score: u32,
}

/// Rank `candidates` against `query`, returning at most `limit` hits
/// in score-descending order. Candidates that don't match at all are
/// omitted. An empty `query` is treated as "match everything at equal
/// score" — so callers can use the same code path for "show all" and
/// "filter by query" without branching.
pub fn rank(query: &str, candidates: &[String], limit: usize) -> Vec<FuzzyHit> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        // Preserve input order, cap at limit.
        return candidates
            .iter()
            .take(limit.max(1))
            .enumerate()
            .map(|(i, _)| FuzzyHit { index: i, score: 0 })
            .collect();
    }

    let mut matcher = Matcher::new(Config::DEFAULT);
    let pattern = Pattern::new(
        trimmed,
        CaseMatching::Ignore,
        Normalization::Smart,
        AtomKind::Fuzzy,
    );

    // Reused scratch buffer for Utf32Str conversions — keeps per-call
    // allocations down to roughly the number of matching candidates.
    let mut buf: Vec<char> = Vec::new();
    let mut hits: Vec<FuzzyHit> = Vec::with_capacity(candidates.len().min(limit));
    for (idx, c) in candidates.iter().enumerate() {
        buf.clear();
        let haystack = Utf32Str::new(c, &mut buf);
        if let Some(score) = pattern.score(haystack, &mut matcher) {
            hits.push(FuzzyHit { index: idx, score });
        }
    }

    // Stable sort keeps input order for ties (see module doc).
    hits.sort_by(|a, b| b.score.cmp(&a.score));
    if hits.len() > limit {
        hits.truncate(limit);
    }
    hits
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn exact_prefix_wins() {
        let cands = s(&["thesis", "apothecary", "thermostat", "synthesis"]);
        let hits = rank("thes", &cands, 10);
        // "thesis" is a clean prefix; nucleo should rank it above
        // "synthesis" and far above "apothecary".
        assert!(!hits.is_empty());
        assert_eq!(cands[hits[0].index], "thesis");
    }

    #[test]
    fn typo_tolerance_catches_close_matches() {
        // Nucleo's fuzzy atom is tolerant of dropped / out-of-order
        // characters. "kttl" should still hit "kettle" even though
        // we've dropped the 'e's and the ending 'e' of "kettle".
        let cands = s(&["kettle", "doubt", "garden"]);
        let hits = rank("kttl", &cands, 10);
        assert!(hits.iter().any(|h| cands[h.index] == "kettle"));
    }

    #[test]
    fn empty_query_returns_input_order() {
        let cands = s(&["a", "b", "c", "d"]);
        let hits = rank("", &cands, 3);
        assert_eq!(hits.len(), 3);
        assert_eq!(hits.iter().map(|h| h.index).collect::<Vec<_>>(), vec![0, 1, 2]);
    }

    #[test]
    fn no_match_returns_empty() {
        let cands = s(&["hello", "world"]);
        let hits = rank("zzzzzzzzzz", &cands, 10);
        assert!(hits.is_empty());
    }
}
