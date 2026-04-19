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
    use std::collections::BTreeMap;
    let summaries = notes::list(root)?;
    let mut nodes = Vec::with_capacity(summaries.len());
    let mut edges = Vec::new();
    let mut tag_counts: BTreeMap<String, usize> = BTreeMap::new();

    for s in &summaries {
        let n = notes::read(root, &s.slug)?;
        for t in &n.frontmatter.tags {
            let t = t.trim();
            if t.is_empty() { continue; }
            *tag_counts.entry(t.to_string()).or_insert(0) += 1;
        }
        nodes.push(GraphNode {
            slug: n.slug.clone(),
            title: if n.frontmatter.title.is_empty() {
                n.slug.clone()
            } else {
                n.frontmatter.title.clone()
            },
            tags: n.frontmatter.tags.clone(),
        });
        for l in &n.frontmatter.links {
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
    write_cache(root, &graph)?;
    Ok(graph)
}

fn write_cache(root: &Path, graph: &Graph) -> Result<()> {
    let path = workspace::index_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(graph)?;
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
