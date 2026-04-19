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
