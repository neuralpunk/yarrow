// Static-site export.
//
// Writes a self-contained folder the user can share or host:
//   dest/
//     index.html          — all notes in one page, with collapsible sections
//                           and a D3-force graph (via CDN)
//     attachments/…       — copied as-is so images resolve
//     styles.css          — Yarrow's design tokens, light palette for readability
//
// Design choices:
// * One HTML file (not per-note) keeps the artefact truly portable — a single
//   attachment you can email or drop into Dropbox. Readers scroll or use the
//   in-page table of contents.
// * Graph is rendered via D3 from a CDN in a collapsible details block.
//   Labelled "needs internet" so offline readers can still browse notes.
// * We export the light palette regardless of the user's current theme — it's
//   the most legible for an audience that's seeing the content for the first
//   time. Theming the export is a later-version concern.

use std::path::Path;

use git2::{BranchType, Repository};
use serde::Serialize;

use crate::error::{Result, YarrowError};
use crate::notes;
use crate::graph;
use crate::workspace;

#[derive(Debug, Serialize)]
pub struct ExportReport {
    pub dest: String,
    pub notes_exported: usize,
    pub attachments_exported: usize,
    #[serde(default)]
    pub encrypted_skipped: usize,
}

pub fn run(root: &Path, dest: &Path) -> Result<ExportReport> {
    std::fs::create_dir_all(dest)?;

    // Gather content
    let summaries = notes::list(root)?;
    let mut rendered: Vec<RenderedNote> = Vec::with_capacity(summaries.len());
    let mut raw_bodies: Vec<(String, String)> = Vec::with_capacity(summaries.len());
    let mut skipped = 0usize;
    for s in &summaries {
        let n = notes::read(root, &s.slug)?;
        // Per spec: encrypted notes are skipped on static export. The count
        // is surfaced in the report so the user can see they're excluded.
        if n.frontmatter.encrypted {
            skipped += 1;
            continue;
        }
        raw_bodies.push((n.slug.clone(), n.body.clone()));
        rendered.push(render_note(&n));
    }

    let graph_json = graph_payload(root)?;
    let search_json = search_payload(&rendered, &raw_bodies);
    let cfg = workspace::read_config(root).ok();
    let title = cfg
        .as_ref()
        .map(|c| c.workspace.name.clone())
        .unwrap_or_else(|| "Yarrow workspace".into());

    // Write files
    std::fs::write(dest.join("styles.css"), STYLES)?;
    std::fs::write(
        dest.join("index.html"),
        build_index(&title, &rendered, &graph_json, &search_json),
    )?;

    // Copy attachments if any
    let attach_count = copy_attachments(root, dest)?;

    Ok(ExportReport {
        dest: dest.to_string_lossy().to_string(),
        notes_exported: rendered.len(),
        attachments_exported: attach_count,
        encrypted_skipped: skipped,
    })
}

struct RenderedNote {
    slug: String,
    title: String,
    body_html: String,
}

fn render_note(n: &notes::Note) -> RenderedNote {
    use pulldown_cmark::{html, Options, Parser};
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    // Rewrite [[wikilinks]] to intra-page anchors so clicking a wikilink
    // jumps to the target section in the single-page export.
    let pre = rewrite_wikilinks(&n.body);
    let parser = Parser::new_ext(&pre, options);
    let mut html_out = String::new();
    html::push_html(&mut html_out, parser);
    RenderedNote {
        slug: n.slug.clone(),
        title: if n.frontmatter.title.is_empty() { n.slug.clone() } else { n.frontmatter.title.clone() },
        body_html: html_out,
    }
}

/// `[[Some Note]]` → `[Some Note](#note-some-note)`. The `#note-<slug>` anchor
/// is emitted by the index template as a section id.
fn rewrite_wikilinks(body: &str) -> String {
    let mut out = String::with_capacity(body.len());
    let mut last = 0;
    let bytes = body.as_bytes();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'[' && bytes[i + 1] == b'[' {
            let start = i;
            let mut j = i + 2;
            let mut found = None;
            while j + 1 < bytes.len() {
                if bytes[j] == b'\n' { break; }
                if bytes[j] == b']' && bytes[j + 1] == b']' {
                    found = Some(j + 2);
                    break;
                }
                j += 1;
            }
            if let Some(end) = found {
                out.push_str(&body[last..start]);
                let inner = &body[start + 2..end - 2];
                let anchor = note_anchor(inner);
                out.push_str(&format!("[{}](#{})", inner, anchor));
                last = end;
                i = end;
                continue;
            }
        }
        i += 1;
    }
    out.push_str(&body[last..]);
    out
}

fn note_anchor(name: &str) -> String {
    let slug = slug::slugify(name);
    if slug.is_empty() { "note".into() } else { format!("note-{}", slug) }
}

fn slug_anchor(slug: &str) -> String {
    // Notes created through the app already have kebab-slugs; reuse so the
    // anchor matches what `rewrite_wikilinks` produces via name-slugging.
    format!("note-{}", slug)
}

fn graph_payload(root: &Path) -> Result<String> {
    let g = graph::build(root).unwrap_or_else(|_| graph::Graph {
        notes: vec![],
        links: vec![],
        last_built: String::new(),
        tags: vec![],
    });
    Ok(serde_json::to_string(&g).unwrap_or_else(|_| "{\"notes\":[],\"links\":[]}".into()))
}

#[derive(Serialize)]
struct SearchEntry {
    slug: String,
    title: String,
    text: String,
}

fn search_payload(rendered: &[RenderedNote], raw_bodies: &[(String, String)]) -> String {
    let lookup: std::collections::HashMap<&str, &str> = raw_bodies
        .iter()
        .map(|(s, b)| (s.as_str(), b.as_str()))
        .collect();
    let entries: Vec<SearchEntry> = rendered
        .iter()
        .map(|n| SearchEntry {
            slug: n.slug.clone(),
            title: n.title.clone(),
            text: lookup
                .get(n.slug.as_str())
                .map(|s| snippet_source(s))
                .unwrap_or_default(),
        })
        .collect();
    serde_json::to_string(&entries).unwrap_or_else(|_| "[]".into())
}

/// Compress a note body for the search index: collapse whitespace, cap length
/// so the index stays under a few hundred KB even for big vaults.
fn snippet_source(body: &str) -> String {
    let mut out = String::with_capacity(body.len().min(4096));
    let mut prev_space = false;
    for c in body.chars() {
        if c.is_whitespace() {
            if !prev_space { out.push(' '); prev_space = true; }
        } else {
            out.push(c);
            prev_space = false;
        }
        if out.len() >= 4096 { break; }
    }
    out.trim().to_string()
}

fn copy_attachments(root: &Path, dest: &Path) -> Result<usize> {
    let src = root.join(crate::attachments::ATTACHMENTS_DIR);
    if !src.exists() {
        return Ok(0);
    }
    let out_dir = dest.join(crate::attachments::ATTACHMENTS_DIR);
    std::fs::create_dir_all(&out_dir)?;
    let mut n = 0;
    for entry in std::fs::read_dir(&src)? {
        let entry = entry?;
        let p = entry.path();
        if p.is_file() {
            if let Some(name) = p.file_name() {
                std::fs::copy(&p, out_dir.join(name))?;
                n += 1;
            }
        }
    }
    Ok(n)
}

// ── templates ───────────────────────────────────────────────────────────

fn build_index(title: &str, notes: &[RenderedNote], graph_json: &str, search_json: &str) -> String {
    let mut toc = String::new();
    let mut body = String::new();
    for n in notes {
        let anchor = slug_anchor(&n.slug);
        toc.push_str(&format!(
            "<li><a href=\"#{anchor}\">{title}</a></li>",
            anchor = anchor,
            title = escape_html(&n.title),
        ));
        body.push_str(&format!(
            "<article id=\"{anchor}\"><h2>{title}</h2>{body}</article>",
            anchor = anchor,
            title = escape_html(&n.title),
            body = n.body_html,
        ));
    }
    format!(
        r##"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header class="y-hdr">
  <h1>{title}</h1>
  <div class="y-sub">exported from Yarrow · {count} notes</div>
</header>
<div class="y-search">
  <input id="y-search-input" type="search" placeholder="Search these notes…" autocomplete="off">
  <ol id="y-search-results"></ol>
</div>
<script>
window.__yarrow_search = {search};
(function() {{
  var input = document.getElementById('y-search-input');
  var out = document.getElementById('y-search-results');
  if (!input || !out) return;
  function esc(s) {{ return s.replace(/[&<>"]/g, function(c){{ return {{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}}[c]; }}); }}
  function run(q) {{
    q = q.trim().toLowerCase();
    out.innerHTML = '';
    if (!q) {{ out.style.display = 'none'; return; }}
    out.style.display = 'block';
    var hits = (window.__yarrow_search || [])
      .map(function(n) {{
        var t = n.title.toLowerCase();
        var b = (n.text || '').toLowerCase();
        var score = 0;
        if (t.indexOf(q) !== -1) score += 5;
        if (b.indexOf(q) !== -1) score += 1;
        return {{n: n, score: score, pos: b.indexOf(q)}};
      }})
      .filter(function(h) {{ return h.score > 0; }})
      .sort(function(a, b) {{ return b.score - a.score; }})
      .slice(0, 20);
    if (hits.length === 0) {{
      out.innerHTML = '<li class="y-search-empty">No matches.</li>';
      return;
    }}
    hits.forEach(function(h) {{
      var snippet = '';
      if (h.pos >= 0) {{
        var s = Math.max(0, h.pos - 40);
        var e = Math.min((h.n.text || '').length, h.pos + 80);
        snippet = (h.n.text || '').slice(s, e);
      }}
      var li = document.createElement('li');
      li.innerHTML = '<a href="#note-' + esc(h.n.slug) + '"><strong>' + esc(h.n.title) + '</strong>' + (snippet ? '<span class="y-search-snippet">…' + esc(snippet) + '…</span>' : '') + '</a>';
      out.appendChild(li);
    }});
  }}
  input.addEventListener('input', function(e) {{ run(e.target.value); }});
  input.addEventListener('keydown', function(e) {{
    if (e.key === 'Enter') {{
      var first = out.querySelector('a');
      if (first) {{ location.hash = first.getAttribute('href'); input.value = ''; run(''); }}
    }}
  }});
}})();
</script>
<nav class="y-toc">
  <h3>Contents</h3>
  <ol>{toc}</ol>
</nav>
<details class="y-graph">
  <summary>Connection graph <span class="y-note">(needs internet)</span></summary>
  <div id="graph"></div>
  <script src="https://d3js.org/d3.v7.min.js" defer></script>
  <script defer>
    window.__yarrow_graph = {graph};
    document.addEventListener('DOMContentLoaded', () => {{
      const g = window.__yarrow_graph;
      if (!g || !g.notes || !g.notes.length || !window.d3) return;
      const W = 760, H = 420;
      const svg = d3.select('#graph').append('svg').attr('viewBox', `0 0 ${{W}} ${{H}}`);
      const sim = d3.forceSimulation(g.notes.map(n => Object.assign({{}}, n)))
        .force('link', d3.forceLink(g.links.map(l => ({{source:l.from,target:l.to}}))).id(d => d.slug).distance(70))
        .force('charge', d3.forceManyBody().strength(-140))
        .force('center', d3.forceCenter(W/2, H/2))
        .force('collide', d3.forceCollide(22));
      const link = svg.append('g').selectAll('line').data(g.links).join('line')
        .attr('stroke', '#b8900e').attr('stroke-opacity', 0.45);
      const node = svg.append('g').selectAll('g').data(sim.nodes()).join('g').style('cursor','pointer')
        .on('click', (_, d) => {{ location.hash = '#note-' + d.slug; }});
      node.append('circle').attr('r', 5).attr('fill', '#f5c930').attr('stroke', '#b8900e');
      node.append('text').attr('dy', 14).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#342e0f').text(d => d.title.length > 18 ? d.title.slice(0,17)+'…' : d.title);
      sim.on('tick', () => {{
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${{d.x}},${{d.y}})`);
      }});
    }});
  </script>
</details>
<main>
{body}
</main>
<footer class="y-ftr">
  <p>Generated by <a href="https://github.com/">Yarrow</a>. Notes and connections are yours.</p>
</footer>
</body>
</html>
"##,
        title = escape_html(title),
        count = notes.len(),
        toc = toc,
        graph = graph_json,
        search = search_json,
        body = body,
    )
}

/// Export every note living on a specific path (git branch) as a Markdown
/// bundle. Produces a folder with plain `.md` files (frontmatter stripped)
/// plus a `README.md` summarising the path.
pub fn export_path_markdown(
    repo: &Repository,
    workspace_root: &Path,
    path_name: &str,
    dest: &Path,
) -> Result<ExportReport> {
    let branch = repo
        .find_branch(path_name, BranchType::Local)
        .map_err(|_| YarrowError::PathNotFound(path_name.to_string()))?;
    let commit = branch.get().peel_to_commit()?;
    let tree = commit.tree()?;

    std::fs::create_dir_all(dest)?;
    let mut count = 0usize;
    let mut titles: Vec<(String, String)> = Vec::new();

    tree.walk(git2::TreeWalkMode::PreOrder, |dir, entry| {
        let name = entry.name().unwrap_or("");
        if !name.ends_with(".md") {
            return git2::TreeWalkResult::Ok;
        }
        let full = format!("{}{}", dir, name);
        if !full.starts_with("notes/") {
            return git2::TreeWalkResult::Ok;
        }
        let blob = match entry.to_object(repo).and_then(|o| o.peel_to_blob()) {
            Ok(b) => b,
            Err(_) => return git2::TreeWalkResult::Ok,
        };
        let raw = String::from_utf8_lossy(blob.content()).to_string();
        let (title, body) = split_frontmatter(&raw);
        let rel = full.trim_start_matches("notes/");
        let out_path = dest.join(rel);
        if let Some(parent) = out_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if std::fs::write(&out_path, body).is_ok() {
            count += 1;
            titles.push((rel.to_string(), title));
        }
        git2::TreeWalkResult::Ok
    })?;

    // Copy attachments snapshot from the working tree (attachments are
    // stable across paths for v1)
    let attach_count = copy_attachments(workspace_root, dest)?;

    // README
    let cfg_name = workspace::read_config(workspace_root)
        .ok()
        .map(|c| c.workspace.name)
        .unwrap_or_else(|| "Yarrow workspace".into());
    let mut readme = String::new();
    readme.push_str(&format!("# {} — path: {}\n\n", cfg_name, path_name));
    readme.push_str(&format!(
        "Exported from Yarrow on {}. {} notes on this path.\n\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M"),
        count
    ));
    readme.push_str("## Notes on this path\n\n");
    titles.sort();
    for (rel, title) in &titles {
        let display = if title.is_empty() { rel.clone() } else { title.clone() };
        readme.push_str(&format!("- [{}]({})\n", display, rel));
    }
    std::fs::write(dest.join("README.md"), readme)?;

    Ok(ExportReport {
        dest: dest.to_string_lossy().to_string(),
        notes_exported: count,
        attachments_exported: attach_count,
        encrypted_skipped: 0,
    })
}

fn split_frontmatter(raw: &str) -> (String, String) {
    // Strip a leading `---\n...\n---\n` YAML block and return (title, body).
    // Title is best-effort: pulls `title: …` from the frontmatter if present.
    let mut title = String::new();
    if let Some(rest) = raw.strip_prefix("---\n") {
        if let Some(end) = rest.find("\n---\n") {
            let fm = &rest[..end];
            for line in fm.lines() {
                if let Some(v) = line.strip_prefix("title:") {
                    title = v.trim().trim_matches('"').trim_matches('\'').to_string();
                    break;
                }
            }
            let body = &rest[end + 5..];
            return (title, body.to_string());
        }
    }
    (title, raw.to_string())
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// Yarrow's warm-light palette inlined so the export is theme-consistent and
// self-contained. Kept deliberately separate from `index.css` since the web
// build uses Tailwind and we don't want to ship the entire stylesheet.
const STYLES: &str = r#"
:root {
  --bg: #fdfcf3; --s1: #faf6e4; --s2: #f3eccc; --s3: #e9e0aa;
  --yel: #e8b820; --yelp: #fef6cc; --yeld: #7a5d05;
  --char: #181602; --ch2: #342e0f; --t2: #4f4a24; --t3: #807a42;
  --bd: #ddd5a0; --link: #6a5000;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--char); }
body {
  font-family: ui-sans-serif, system-ui, -apple-system, 'Figtree', sans-serif;
  font-size: 16px; line-height: 1.65; letter-spacing: -0.003em;
}
.y-hdr { padding: 48px 24px 24px; text-align: center; border-bottom: 1px solid var(--bd); }
.y-hdr h1 { font-family: ui-serif, Georgia, 'Oranienbaum', serif; font-size: 42px; margin: 0; letter-spacing: -0.01em; }
.y-sub { color: var(--t3); font-size: 13px; font-family: ui-monospace, 'JetBrains Mono', monospace; margin-top: 6px; }
.y-search { max-width: 720px; margin: 20px auto 0; padding: 0 24px; }
.y-search input { width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid var(--bd); border-radius: 8px; background: var(--bg); color: var(--char); font-family: inherit; outline: none; }
.y-search input:focus { border-color: var(--yel); box-shadow: 0 0 0 3px var(--yelp); }
.y-search ol { display: none; list-style: none; padding: 6px; margin: 8px 0 0; background: var(--s1); border: 1px solid var(--bd); border-radius: 8px; max-height: 360px; overflow-y: auto; }
.y-search li { padding: 6px 8px; border-radius: 5px; }
.y-search li:hover { background: var(--yelp); }
.y-search li a { text-decoration: none; color: var(--char); display: block; }
.y-search-snippet { display: block; font-size: 12px; color: var(--t3); margin-top: 2px; font-style: italic; }
.y-search-empty { color: var(--t3); font-style: italic; padding: 8px; }
.y-toc { max-width: 720px; margin: 24px auto; padding: 18px 24px; background: var(--s1); border: 1px solid var(--bd); border-radius: 10px; }
.y-toc h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--t3); }
.y-toc ol { margin: 0; padding-left: 18px; }
.y-toc a { color: var(--link); text-decoration: none; }
.y-toc a:hover { text-decoration: underline; }
.y-graph { max-width: 720px; margin: 24px auto; padding: 12px 18px; background: var(--s1); border: 1px solid var(--bd); border-radius: 10px; }
.y-graph summary { cursor: pointer; font-weight: 500; }
.y-graph .y-note { color: var(--t3); font-size: 12px; font-weight: 400; }
.y-graph #graph { margin-top: 10px; }
.y-graph #graph svg { width: 100%; height: auto; background: var(--bg); border-radius: 8px; }
main { max-width: 720px; margin: 0 auto; padding: 32px 24px 80px; }
article { padding: 28px 0; border-bottom: 1px dashed var(--bd); }
article:last-child { border-bottom: 0; }
article h2 { font-family: ui-serif, Georgia, 'Oranienbaum', serif; font-size: 30px; letter-spacing: -0.005em; margin: 0 0 12px; }
article h3 { font-family: ui-serif, Georgia, 'Oranienbaum', serif; font-size: 20px; margin: 22px 0 6px; }
article p { margin: 0 0 12px; }
article a { color: var(--link); }
article code { background: var(--s2); padding: 1px 5px; border-radius: 3px; font-family: ui-monospace, 'JetBrains Mono', monospace; font-size: 0.92em; }
article pre { background: var(--s2); padding: 12px 14px; border-radius: 6px; overflow-x: auto; }
article pre code { background: none; padding: 0; }
article img { max-width: 100%; height: auto; border-radius: 6px; margin: 10px 0; }
article blockquote { border-left: 3px solid var(--yel); margin: 12px 0; padding: 2px 14px; color: var(--t2); }
article ul, article ol { padding-left: 22px; }
.y-ftr { text-align: center; padding: 24px; color: var(--t3); font-size: 12px; border-top: 1px solid var(--bd); }
.y-ftr a { color: var(--link); }
"#;
