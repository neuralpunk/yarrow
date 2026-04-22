// Templates: reusable note scaffolds stored in `.yarrow/templates/`.
//
// Each template is a plain markdown file. The filename (without `.md`) is its
// name; the optional first-line comment `<!-- label: ... -->` sets a friendly
// label shown in the palette. Placeholders are substituted at render time:
//
//   {{date}}        — ISO date, e.g. 2026-04-17
//   {{date_human}}  — e.g. April 17, 2026
//   {{weekday}}     — e.g. Friday
//   {{time}}        — HH:MM local time
//   {{title}}       — the title the user typed
//   {{cursor}}      — no-op marker; stripped before writing
//
// `daily.md` is treated like any other template but is also surfaced as the
// default for ⌘T journaling.

use std::path::Path;

use chrono::{Datelike, Local};
use serde::{Deserialize, Serialize};

use crate::error::{Result, YarrowError};
use crate::workspace;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TemplateInfo {
    pub name: String,
    pub label: String,
    pub is_daily: bool,
}

pub fn list(root: &Path) -> Result<Vec<TemplateInfo>> {
    let dir = workspace::templates_dir(root);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let p = entry.path();
        if p.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let name = match p.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        let raw = std::fs::read_to_string(&p).unwrap_or_default();
        let label = extract_label(&raw).unwrap_or_else(|| humanize(&name));
        out.push(TemplateInfo {
            name: name.clone(),
            label,
            is_daily: name == "daily",
        });
    }
    out.sort_by_key(|a| a.label.to_lowercase());
    Ok(out)
}

pub fn read(root: &Path, name: &str) -> Result<String> {
    let path = workspace::templates_dir(root).join(format!("{}.md", sanitize_name(name)?));
    if !path.exists() {
        return Err(YarrowError::Invalid(format!("template not found: {}", name)));
    }
    Ok(std::fs::read_to_string(path)?)
}

pub fn write(root: &Path, name: &str, content: &str) -> Result<()> {
    let dir = workspace::templates_dir(root);
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.md", sanitize_name(name)?));
    std::fs::write(path, content)?;
    Ok(())
}

pub fn delete(root: &Path, name: &str) -> Result<()> {
    let path = workspace::templates_dir(root).join(format!("{}.md", sanitize_name(name)?));
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

/// Render a template's body with placeholder substitution. Strips the label
/// comment and the `{{cursor}}` marker.
pub fn render(template: &str, title: &str) -> String {
    let now = Local::now();
    let iso = now.format("%Y-%m-%d").to_string();
    let human = now.format("%B %-d, %Y").to_string();
    let weekday = now.format("%A").to_string();
    let time = now.format("%H:%M").to_string();
    let week = now.iso_week().week().to_string();

    let without_label = strip_label_comment(template);
    without_label
        .replace("{{date}}", &iso)
        .replace("{{date_human}}", &human)
        .replace("{{weekday}}", &weekday)
        .replace("{{time}}", &time)
        .replace("{{week_number}}", &week)
        .replace("{{title}}", title)
        .replace("{{cursor}}", "")
}

fn extract_label(raw: &str) -> Option<String> {
    let first = raw.lines().next()?.trim();
    let prefix = "<!-- label:";
    let rest = first.strip_prefix(prefix)?;
    let inner = rest.trim_end_matches("-->").trim();
    if inner.is_empty() {
        None
    } else {
        Some(inner.to_string())
    }
}

fn strip_label_comment(raw: &str) -> String {
    let mut lines = raw.lines();
    if let Some(first) = lines.clone().next() {
        if first.trim().starts_with("<!-- label:") {
            lines.next();
            return lines.collect::<Vec<_>>().join("\n");
        }
    }
    raw.to_string()
}

fn humanize(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut next_upper = true;
    for ch in name.chars() {
        if ch == '-' || ch == '_' {
            out.push(' ');
            next_upper = true;
        } else if next_upper {
            for u in ch.to_uppercase() { out.push(u); }
            next_upper = false;
        } else {
            out.push(ch);
        }
    }
    out
}

fn sanitize_name(name: &str) -> Result<String> {
    let cleaned: String = name
        .trim()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if cleaned.is_empty() {
        return Err(YarrowError::Invalid("template name can't be empty".into()));
    }
    Ok(cleaned.to_lowercase())
}

/// Bundled templates seeded into a fresh workspace's `.yarrow/templates/`.
/// Kept as plain strings so we stay single-binary with zero assets to ship.
pub fn bundled() -> Vec<(&'static str, &'static str)> {
    vec![
        ("daily", DAILY),
        ("meeting", MEETING),
        ("book", BOOK),
        ("recipe", RECIPE),
        ("vacation", VACATION),
        ("project-brief", PROJECT_BRIEF),
        ("morning-pages", MORNING_PAGES),
    ]
}

pub fn seed_defaults(root: &Path) -> Result<()> {
    let dir = workspace::templates_dir(root);
    std::fs::create_dir_all(&dir)?;
    for (name, body) in bundled() {
        let path = dir.join(format!("{}.md", name));
        if !path.exists() {
            std::fs::write(path, body)?;
        }
    }
    Ok(())
}

const DAILY: &str = r#"<!-- label: Daily journal -->
# {{weekday}}, {{date_human}}

## What mattered yesterday

-

## What I want to do today

- {{cursor}}

## Open questions

??

## Notes
"#;

const MEETING: &str = r#"<!-- label: Meeting notes -->
# {{title}}

**When:** {{date_human}} · {{time}}
**Attendees:**

## Agenda

- {{cursor}}

## Notes

## Decisions

## Action items

- [ ]
"#;

const BOOK: &str = r#"<!-- label: Book notes -->
# {{title}}

**Author:**
**Started:** {{date}}
**Finished:**

## One-sentence summary

{{cursor}}

## Key ideas

-

## Quotes

>

## What I'd tell a friend about it

## Questions I'm still sitting with

??
"#;

const RECIPE: &str = r#"<!-- label: Recipe -->
# {{title}}

**Source:**
**Servings:**
**Active time:**  ·  **Total time:**

## Ingredients

-

## Method

1. {{cursor}}

## Notes from last time

-

## Variations worth trying

-
"#;

const VACATION: &str = r#"<!-- label: Vacation planner -->
# {{title}}

**Dates:**
**Where:**
**Who's coming:**

## The shape of the trip

{{cursor}}

## Bookings

- [ ] Flights
- [ ] Lodging
- [ ] Car / transit
- [ ] Insurance

## To pack

-

## Things to do there

-

## Before we leave

- [ ]
"#;

const PROJECT_BRIEF: &str = r#"<!-- label: Project brief -->
# {{title}}

**Owner:**
**Kick-off:** {{date}}

## Why this exists

{{cursor}}

## Success looks like

-

## Out of scope

-

## Milestones

- [ ]

## Open questions

??
"#;

const MORNING_PAGES: &str = r#"<!-- label: Morning pages -->
# {{weekday}} morning · {{date_human}}

Three pages, unedited. No stopping. No rereading.

{{cursor}}
"#;
