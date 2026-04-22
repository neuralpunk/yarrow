use std::path::Path;

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::notes;
use crate::workspace;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphNode {
    pub slug: String,
    pub title: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagCount {
    pub tag: String,
    pub count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    #[serde(rename = "type")]
    pub link_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Graph {
    pub notes: Vec<GraphNode>,
    pub links: Vec<GraphEdge>,
    pub last_built: String,
    #[serde(default)]
    pub tags: Vec<TagCount>,
}

pub fn build(root: &Path) -> Result<Graph> {
    let scanned = notes::scan(root)?;
    Ok(build_from_scan(root, &scanned))
}

/// Build a Graph from an already-scanned note set. Used by the new combined
/// "list + graph" command path so a single save no longer walks the notes
/// directory twice.
pub fn build_from_scan(root: &Path, scanned: &[notes::ScannedNote]) -> Graph {
    use std::collections::BTreeMap;
    let mut nodes = Vec::with_capacity(scanned.len());
    let mut edges = Vec::new();
    let mut tag_counts: BTreeMap<String, usize> = BTreeMap::new();

    for n in scanned {
        for t in &n.fm.tags {
            let t = t.trim();
            if t.is_empty() { continue; }
            *tag_counts.entry(t.to_string()).or_insert(0) += 1;
        }
        nodes.push(GraphNode {
            slug: n.slug.clone(),
            title: if n.fm.title.is_empty() {
                n.slug.clone()
            } else {
                n.fm.title.clone()
            },
            tags: n.fm.tags.clone(),
        });
        for l in &n.fm.links {
            edges.push(GraphEdge {
                from: n.slug.clone(),
                to: l.target.clone(),
                link_type: l.link_type.clone(),
            });
        }
    }

    let mut tags: Vec<TagCount> = tag_counts
        .into_iter()
        .map(|(tag, count)| TagCount { tag, count })
        .collect();
    // Most-used first, alphabetical within ties (BTreeMap already sorts ties).
    tags.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.tag.cmp(&b.tag)));

    let graph = Graph {
        notes: nodes,
        links: edges,
        last_built: Utc::now().to_rfc3339(),
        tags,
    };
    let _ = write_cache(root, &graph);
    graph
}

fn write_cache(root: &Path, graph: &Graph) -> Result<()> {
    let path = workspace::index_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(graph)?;
    // Skip the disk write if the cached payload is identical — saves an
    // fs::write per save in the common case of edits that don't touch
    // links or tags. Compare byte-for-byte against the existing file.
    if let Ok(existing) = std::fs::read(&path) {
        if existing == raw.as_bytes() {
            return Ok(());
        }
    }
    std::fs::write(path, raw)?;
    Ok(())
}

pub fn orphan_slugs(graph: &Graph) -> Vec<String> {
    use std::collections::HashSet;
    let mut connected: HashSet<&str> = HashSet::new();
    for e in &graph.links {
        connected.insert(&e.from);
        connected.insert(&e.to);
    }
    graph
        .notes
        .iter()
        .filter(|n| !connected.contains(n.slug.as_str()))
        .map(|n| n.slug.clone())
        .collect()
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ClusterSuggestion {
    /// Suggested path name, derived from the hub note's title.
    pub name: String,
    /// The hub note — high-degree seed of the cluster.
    pub seed_slug: String,
    pub seed_title: String,
    /// All slugs in the cluster, including the seed.
    pub members: Vec<String>,
    pub member_titles: Vec<String>,
    /// Edges internal to the cluster — higher = denser / more meaningful.
    pub internal_edges: usize,
}

/// Egocentric clusters: for each high-degree note, propose a path
/// containing that note + its immediate neighbors. Filter out clusters
/// that are too small / too big, prefer denser ones, and drop clusters
/// whose members already form a path.
///
/// Deliberately simple — no community detection. Works well on small
/// vaults; large vaults will have many plausible clusters and we cap
/// the return at `limit`.
pub fn cluster_suggestions(
    graph: &Graph,
    existing_path_members: &[std::collections::HashSet<String>],
    limit: usize,
) -> Vec<ClusterSuggestion> {
    use std::collections::{HashMap, HashSet};

    // Adjacency map (undirected).
    let mut adj: HashMap<String, HashSet<String>> = HashMap::new();
    for e in &graph.links {
        adj.entry(e.from.clone()).or_default().insert(e.to.clone());
        adj.entry(e.to.clone()).or_default().insert(e.from.clone());
    }
    let title_of: HashMap<String, String> = graph
        .notes
        .iter()
        .map(|n| (n.slug.clone(), n.title.clone()))
        .collect();

    let mut candidates: Vec<ClusterSuggestion> = Vec::new();
    let mut seen_signatures: HashSet<Vec<String>> = HashSet::new();

    // Sort notes by degree descending so we try the strongest hubs first.
    let mut notes_by_degree: Vec<(&String, usize)> = adj
        .iter()
        .map(|(slug, neighbors)| (slug, neighbors.len()))
        .collect();
    notes_by_degree.sort_by(|a, b| b.1.cmp(&a.1));

    for (seed_slug, degree) in notes_by_degree {
        if degree < 3 {
            break; // Sorted — nothing else will qualify.
        }
        let Some(neighbors) = adj.get(seed_slug) else {
            continue;
        };
        // Cluster = seed + neighbors. Cap at 12 to keep paths focused.
        if neighbors.len() + 1 > 12 {
            continue;
        }
        let mut members: Vec<String> = std::iter::once(seed_slug.clone())
            .chain(neighbors.iter().cloned())
            .collect();
        members.sort();

        // Skip if already equivalent to (or fully contained in) an
        // existing path — the user has clearly curated this cluster.
        let as_set: HashSet<String> = members.iter().cloned().collect();
        if existing_path_members
            .iter()
            .any(|p| !p.is_empty() && as_set.iter().all(|m| p.contains(m)))
        {
            continue;
        }

        // Dedup: same-signature cluster can be produced by different
        // seeds with overlapping neighborhoods.
        if !seen_signatures.insert(members.clone()) {
            continue;
        }

        // Count edges internal to the cluster — a denser cluster is a
        // stronger path suggestion.
        let mut internal = 0usize;
        for a in &members {
            let Some(ns) = adj.get(a) else { continue };
            for b in &members {
                if a < b && ns.contains(b) {
                    internal += 1;
                }
            }
        }
        // Density threshold: at least one more edge than a star would
        // have (each neighbor connects to seed = degree edges), so we
        // only surface clusters with some cross-linking.
        if internal <= degree {
            continue;
        }

        let seed_title = title_of
            .get(seed_slug)
            .cloned()
            .unwrap_or_else(|| seed_slug.clone());
        let member_titles: Vec<String> = members
            .iter()
            .map(|s| title_of.get(s).cloned().unwrap_or_else(|| s.clone()))
            .collect();
        let suggested_name = derive_cluster_name(&seed_title);

        candidates.push(ClusterSuggestion {
            name: suggested_name,
            seed_slug: seed_slug.clone(),
            seed_title,
            members,
            member_titles,
            internal_edges: internal,
        });
    }

    // Best candidates first, capped at the caller's limit.
    candidates.sort_by(|a, b| b.internal_edges.cmp(&a.internal_edges));
    candidates.into_iter().take(limit).collect()
}

/// Slugify the seed title into a tentative path name. Lowercase, hyphen
/// -join first few words, strip anything not `[a-z0-9-]`.
fn derive_cluster_name(title: &str) -> String {
    let cleaned: String = title
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == ' ' || c == '-' {
                c
            } else {
                ' '
            }
        })
        .collect();
    let name = cleaned
        .split_whitespace()
        .take(4)
        .collect::<Vec<_>>()
        .join("-");
    if name.is_empty() {
        "suggested-path".to_string()
    } else {
        name
    }
}
