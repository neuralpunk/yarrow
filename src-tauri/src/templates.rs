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
    /// 2.1 Kits: templates marked with the `<!-- kit: ... -->` directive
    /// group together into a dedicated picker ("Start a kit…") so the
    /// curated entry points don't drown in the long template list.
    /// `is_kit` is true when any kit_kind is set; `kit_kind` distinguishes
    /// the categories (journal / research / clinical / work / learning /
    /// writing / everyday / decision / spiritual).
    #[serde(default)]
    pub is_kit: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kit_kind: Option<String>,
    /// 2.1 Custom-templates split. `true` for templates whose name matches
    /// a `bundled()` entry (everything Yarrow ships with); `false` for
    /// user-authored templates dropped into `.yarrow/templates/`. The new
    /// note picker uses this to route bundled kits to the kit picker and
    /// custom templates to a separate modal.
    #[serde(default)]
    pub is_bundled: bool,
}

pub fn list(root: &Path) -> Result<Vec<TemplateInfo>> {
    let dir = workspace::templates_dir(root);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let bundled_names: std::collections::HashSet<&'static str> =
        bundled().iter().map(|(n, _)| *n).collect();
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
        // Kit kind: prefer the explicit `<!-- kit: ... -->` directive in
        // the file. If the file is one of our bundled names but doesn't
        // have the directive (an older workspace whose templates were
        // seeded before the kit system existed), fall back to the
        // bundled-default mapping so existing users still see them in
        // the kit picker without having to delete + re-seed.
        let kit_kind = extract_kit_kind(&raw)
            .or_else(|| default_kit_kind_for(&name).map(str::to_string));
        let is_bundled = bundled_names.contains(name.as_str());
        out.push(TemplateInfo {
            name: name.clone(),
            label,
            is_daily: name == "daily",
            is_kit: kit_kind.is_some(),
            kit_kind,
            is_bundled,
        });
    }
    out.sort_by_key(|a| a.label.to_lowercase());
    Ok(out)
}

/// Backstop for older workspaces. When a file at `<name>.md` is present
/// but has no `<!-- kit: ... -->` comment AND its name matches one of
/// our bundled templates, this returns the kind we would have given it
/// at seed time. Lets the kit picker keep grouping pre-2.1 templates
/// without a destructive re-seed.
pub fn default_kit_kind_for(name: &str) -> Option<&'static str> {
    match name {
        // journal
        "daily" | "morning-pages" | "morning-three" | "today-kindly"
        | "dear-self" | "long-exhale" | "sleep-ledger" | "gratitude-three"
        | "dream-journal" | "mood-energy" | "letter-future-self"
        | "anxiety-unspooler" | "annual-review" | "grief-checkin" => Some("journal"),
        // research
        "paper-card" | "lit-review-summary" | "methodology-card"
        | "hypothesis-card" | "experiment-log" | "annotated-bibliography"
        | "conference-talk" | "data-analysis-log" | "thesis-chapter" => Some("research"),
        // clinical
        "soap-note" | "birp-note" | "dap-note" | "supervision-prep"
        | "reflective-practice" | "intake-first-session" | "safety-plan"
        | "treatment-plan" | "risk-assessment" | "termination-summary"
        | "group-session" | "behavioral-chain" | "cognitive-distortion-log"
        | "case-formulation" => Some("clinical"),
        // work
        "meeting" | "project-brief" | "one-on-one" | "decision-log"
        | "postmortem" | "customer-interview" | "retrospective"
        | "brag-doc" | "standup" | "status-report" => Some("work"),
        // learning
        "book" | "cornell-notes" | "lecture-summary" | "concept-map"
        | "reading-log" | "tutorial-walkthrough" => Some("learning"),
        // writing
        "story-idea" | "character-sheet" | "scene-beat" | "poem-draft"
        | "critique-notes" | "submission-tracker" => Some("writing"),
        // everyday (health + life-admin)
        "recipe" | "vacation" | "doctor-visit" | "symptom-journal"
        | "medication-tracker" | "workout-log" | "habit-streak" => Some("everyday"),
        // decision
        "ten-ten-ten" | "wrap-framework" | "pre-mortem"
        | "weighted-pros-cons" | "eisenhower-matrix" | "five-whys" => Some("decision"),
        // spiritual
        "examen" | "lectio-divina" | "loving-kindness" => Some("spiritual"),
        // baking (2.2.0)
        "recipe-card" | "bake-log" | "holiday-baking-plan"
        | "sourdough-schedule" | "family-cookbook" => Some("baking"),
        _ => None,
    }
}

pub fn read(root: &Path, name: &str) -> Result<String> {
    let path = workspace::templates_dir(root).join(format!("{}.md", sanitize_name(name)?));
    if !path.exists() {
        return Err(YarrowError::Invalid(format!("template not found: {}", name)));
    }
    workspace::read_to_string_capped(&path)
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

/// Journal Kits (2.1) marker. Templates with `<!-- kit: <kind> -->` within
/// the first four header-style comments get flagged as kits so the picker
/// can group them. Recognized kinds: `journal`, `research`, `clinical`.
/// Anything else is treated as an unknown kit and surfaced as a generic
/// kit so user-authored kinds still appear in the picker.
pub fn extract_kit_kind(raw: &str) -> Option<String> {
    for line in raw.lines().take(4) {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix("<!-- kit:") {
            let inner = rest.trim_end_matches("-->").trim();
            if inner.is_empty() {
                continue;
            }
            return Some(inner.to_string());
        }
    }
    None
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
///
/// 2.1 adds five "Journal Kits" — templates tagged `<!-- kit: journal -->`
/// so the picker can group them. The underlying storage is the same as
/// every other template; the flag is purely cosmetic.
pub fn bundled() -> Vec<(&'static str, &'static str)> {
    vec![
        ("daily", DAILY),
        ("meeting", MEETING),
        ("book", BOOK),
        ("recipe", RECIPE),
        ("vacation", VACATION),
        ("project-brief", PROJECT_BRIEF),
        ("morning-pages", MORNING_PAGES),
        // ── journal kits ──
        ("morning-three",       KIT_MORNING_THREE),
        ("today-kindly",        KIT_TODAY_KINDLY),
        ("dear-self",           KIT_DEAR_SELF),
        ("long-exhale",         KIT_LONG_EXHALE),
        ("sleep-ledger",        KIT_SLEEP_LEDGER),
        ("gratitude-three",     KIT_GRATITUDE_THREE),
        ("dream-journal",       KIT_DREAM_JOURNAL),
        ("mood-energy",         KIT_MOOD_ENERGY),
        ("letter-future-self",  KIT_LETTER_FUTURE_SELF),
        ("anxiety-unspooler",   KIT_ANXIETY_UNSPOOLER),
        ("annual-review",       KIT_ANNUAL_REVIEW),
        ("grief-checkin",       KIT_GRIEF_CHECKIN),
        // ── research kits ──
        ("paper-card",          KIT_PAPER_CARD),
        ("lit-review-summary",  KIT_LIT_REVIEW),
        ("methodology-card",    KIT_METHODOLOGY),
        ("hypothesis-card",     KIT_HYPOTHESIS),
        ("experiment-log",      KIT_EXPERIMENT_LOG),
        ("annotated-bibliography", KIT_ANNOTATED_BIB),
        ("conference-talk",     KIT_CONFERENCE_TALK),
        ("data-analysis-log",   KIT_DATA_ANALYSIS_LOG),
        ("thesis-chapter",      KIT_THESIS_CHAPTER),
        // ── clinical kits ──
        ("soap-note",           KIT_SOAP),
        ("birp-note",           KIT_BIRP),
        ("dap-note",            KIT_DAP),
        ("supervision-prep",    KIT_SUPERVISION),
        ("reflective-practice", KIT_REFLECTIVE),
        ("intake-first-session", KIT_INTAKE),
        ("safety-plan",         KIT_SAFETY_PLAN),
        ("treatment-plan",      KIT_TREATMENT_PLAN),
        ("risk-assessment",     KIT_RISK_ASSESSMENT),
        ("termination-summary", KIT_TERMINATION),
        ("group-session",       KIT_GROUP_SESSION),
        ("behavioral-chain",    KIT_BEHAVIORAL_CHAIN),
        ("cognitive-distortion-log", KIT_COG_DISTORTION),
        ("case-formulation",    KIT_CASE_FORMULATION),
        // ── work kits ──
        ("one-on-one",          KIT_ONE_ON_ONE),
        ("decision-log",        KIT_DECISION_LOG),
        ("postmortem",          KIT_POSTMORTEM),
        ("customer-interview",  KIT_CUSTOMER_INTERVIEW),
        ("retrospective",       KIT_RETROSPECTIVE),
        ("brag-doc",            KIT_BRAG_DOC),
        ("standup",             KIT_STANDUP),
        ("status-report",       KIT_STATUS_REPORT),
        // ── learning kits ──
        ("cornell-notes",       KIT_CORNELL_NOTES),
        ("lecture-summary",     KIT_LECTURE_SUMMARY),
        ("concept-map",         KIT_CONCEPT_MAP),
        ("reading-log",         KIT_READING_LOG),
        ("tutorial-walkthrough", KIT_TUTORIAL_WALKTHROUGH),
        // ── writing kits ──
        ("story-idea",          KIT_STORY_IDEA),
        ("character-sheet",     KIT_CHARACTER_SHEET),
        ("scene-beat",          KIT_SCENE_BEAT),
        ("poem-draft",          KIT_POEM_DRAFT),
        ("critique-notes",      KIT_CRITIQUE_NOTES),
        ("submission-tracker",  KIT_SUBMISSION_TRACKER),
        // ── everyday kits ──
        ("doctor-visit",        KIT_DOCTOR_VISIT),
        ("symptom-journal",     KIT_SYMPTOM_JOURNAL),
        ("medication-tracker",  KIT_MEDICATION),
        ("workout-log",         KIT_WORKOUT),
        ("habit-streak",        KIT_HABIT_STREAK),
        // ── decision kits ──
        ("ten-ten-ten",         KIT_TEN_TEN_TEN),
        ("wrap-framework",      KIT_WRAP),
        ("pre-mortem",          KIT_PRE_MORTEM),
        ("weighted-pros-cons",  KIT_WEIGHTED_PROS_CONS),
        ("eisenhower-matrix",   KIT_EISENHOWER),
        ("five-whys",           KIT_FIVE_WHYS),
        // ── spiritual kits ──
        ("examen",              KIT_EXAMEN),
        ("lectio-divina",       KIT_LECTIO),
        ("loving-kindness",     KIT_LOVING_KINDNESS),
        // ── baking kits (2.2.0) ──
        ("recipe-card",         KIT_RECIPE_CARD),
        ("bake-log",            KIT_BAKE_LOG),
        ("holiday-baking-plan", KIT_HOLIDAY_BAKING),
        ("sourdough-schedule",  KIT_SOURDOUGH),
        ("family-cookbook",     KIT_FAMILY_COOKBOOK),
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
<!-- kit: journal -->
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
<!-- kit: work -->
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
<!-- kit: learning -->
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
<!-- kit: everyday -->
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
<!-- kit: everyday -->
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
<!-- kit: work -->
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
<!-- kit: journal -->
# {{weekday}} morning · {{date_human}}

Three pages, unedited. No stopping. No rereading.

{{cursor}}
"#;

// ──────────────── Journal Kits (2.1) ────────────────
//
// Each kit is a shape you can pour yourself into — a handful of quiet
// prompts, nothing else. Tagged `kit: journal` so the picker groups
// them into their own section. These are regular templates: the user
// can edit them freely in Settings → Templates, and they participate
// in the usual placeholder substitution.

const KIT_MORNING_THREE: &str = r#"<!-- label: The Morning Three -->
<!-- kit: journal -->
# The Morning Three · {{weekday}}, {{date_human}}

Three lines, before anything else.

## One you're carrying

{{cursor}}

## One you're watching

## One you're hoping
"#;

const KIT_TODAY_KINDLY: &str = r#"<!-- label: Today, kindly -->
<!-- kit: journal -->
# Today, kindly · {{date_human}}

Five small things that went well today. Not the big ones — the ones you
almost missed.

1. {{cursor}}
2.
3.
4.
5.

## A note of thanks to leave somewhere

>
"#;

const KIT_DEAR_SELF: &str = r#"<!-- label: Dear self — -->
<!-- kit: journal -->
# Dear self · {{weekday}}, {{time}}

A letter you don't have to send. Three paragraphs, three different versions
of you.

## To the self you were a year ago

{{cursor}}

## To the self you are today

## To the self you're becoming
"#;

const KIT_LONG_EXHALE: &str = r#"<!-- label: The Long Exhale -->
<!-- kit: journal -->
# The Long Exhale · {{weekday}} evening, {{date_human}}

Before the day closes.

## What happened

{{cursor}}

## What didn't

## What tomorrow might want
"#;

const KIT_SLEEP_LEDGER: &str = r#"<!-- label: Sleep ledger -->
<!-- kit: journal -->
# Sleep ledger · {{weekday}} night

Kept by the bed. Two lines.

- **One dream:** {{cursor}}
- **One thing to let go:**
"#;

// ──────────────── Research kits (2.1) ────────────────
//
// `paper-card` is the lit-review workhorse: one note per paper, with a
// fixed structure so titles, citations, methodology, findings, and the
// reader's critique are queryable later via tags. The kit body stays
// pure markdown — `cmd_create_from_template` injects the `paper` tag
// based on the template's `kit_kind: research` flag, which lets the
// @cite autocomplete scope to just paper cards.

const KIT_PAPER_CARD: &str = r#"<!-- label: Paper card (research) -->
<!-- kit: research -->
# {{title}}

**Authors:**
**Year:**
**Journal / venue:**
**DOI:**
**Citation key:**

## In one sentence

{{cursor}}

## Methodology

## Key findings

-

## My critique

## Open questions

??

## Connections

- Related to [[]]
"#;

const KIT_LIT_REVIEW: &str = r#"<!-- label: Lit review summary -->
<!-- kit: research -->
# {{title}}

**Topic:**
**Started:** {{date}}

## The question

{{cursor}}

## Papers I've read so far

- [[]]

## Themes that keep coming up

-

## Where the field disagrees

-

## What I think is missing

-

## Open questions

??
"#;

// ──────────────── Clinical kits (2.1) ────────────────
//
// SOAP / BIRP / DAP are the three most common case-note structures in
// clinical psychology. Each kit lays out the sections in the canonical
// order so the writer doesn't have to remember which acronym is which.
//
// `cmd_create_from_template` reads the `kit: clinical` flag and (a)
// auto-tags the new note `clinical` + sets `private: true`, (b) routes
// the file under `notes-private/` (gitignored) so it never leaves the
// machine via sync, and (c) wires the inline PHI scanner to flag
// obvious identifiers as the user types.

const KIT_SOAP: &str = r#"<!-- label: SOAP note (clinical) -->
<!-- kit: clinical -->
# {{title}} · {{date}}

> Private. This note lives in `notes-private/` and is excluded from sync. Redact identifying details before saving — the inline PHI scanner flags obvious patterns, but you are the reader of last resort.

## Subjective

What the client reported in their own words. Mood, presenting concern, recent context.

{{cursor}}

## Objective

What you observed. Affect, body language, attention, anything measurable.

## Assessment

Working formulation. How today fits the overall picture.

## Plan

Next session focus, between-session tasks, any consultation needed.
"#;

const KIT_BIRP: &str = r#"<!-- label: BIRP note (clinical) -->
<!-- kit: clinical -->
# {{title}} · {{date}}

> Private. This note lives in `notes-private/` and is excluded from sync. Redact identifying details before saving.

## Behavior

What the client did and said. Concrete, observable.

{{cursor}}

## Intervention

What you did. The technique, the prompt, the framing — the part you'd write up in a case study.

## Response

How they took it. What shifted, what didn't.

## Plan

Next steps, follow-up.
"#;

const KIT_DAP: &str = r#"<!-- label: DAP note (clinical) -->
<!-- kit: clinical -->
# {{title}} · {{date}}

> Private. This note lives in `notes-private/` and is excluded from sync. Redact identifying details before saving.

## Data

Subjective + objective in one section. What was reported, what you saw.

{{cursor}}

## Assessment

Your formulation of what's going on, fitted to the larger picture.

## Plan

Next session focus, between-session work, consultations.
"#;

const KIT_SUPERVISION: &str = r#"<!-- label: Supervision prep (clinical) -->
<!-- kit: clinical -->
# Supervision prep · {{date_human}}

> Private. Strip identifying details from any case excerpt before sharing with supervision.

## What I want help thinking through

{{cursor}}

## Cases I'm bringing

- [[]]

## A specific moment I'd like to replay

What happened, what I said, what I almost said, what I'm wondering about now.

## Themes across my caseload this week

-

## Questions for my supervisor

??
"#;

const KIT_REFLECTIVE: &str = r#"<!-- label: Reflective practice (clinical) -->
<!-- kit: clinical -->
# Reflective practice · {{date_human}}

> Private. For your own development; not part of any client's record.

## Today's edge

The moment that pulled me — irritation, longing, sleepiness, advocacy, anything that wasn't pure listening.

{{cursor}}

## What might that be telling me

About the client. About me. About the work.

## What I'd do differently next time

## What I want to keep doing
"#;

// ──────────────── Journal kits — 2.1 expansion ────────────────

const KIT_GRATITUDE_THREE: &str = r#"<!-- label: Three good things -->
<!-- kit: journal -->
# Three good things · {{date_human}}

Three things that went right today. The "why" line is the part that
matters — it's what your future self will read.

## 1.

{{cursor}}

**Why it landed:**

## 2.

**Why it landed:**

## 3.

**Why it landed:**
"#;

const KIT_DREAM_JOURNAL: &str = r#"<!-- label: Dream journal -->
<!-- kit: journal -->
# Dream · {{weekday}}, {{date_human}}

Caught quickly, before it fades.

## What I remember

{{cursor}}

## Who was in it

## What it felt like

## Recurring symbols / places

## A line to come back to
"#;

const KIT_MOOD_ENERGY: &str = r#"<!-- label: Mood + energy -->
<!-- kit: journal -->
# Mood + energy · {{date_human}}, {{time}}

## Mood (1-10)

{{cursor}}

## Energy (1-10)

## What shifted it

## Notes
"#;

const KIT_LETTER_FUTURE_SELF: &str = r#"<!-- label: Letter to future self -->
<!-- kit: journal -->
# Dear future me · sealed {{date_human}}

Read this on:

## What's true now

{{cursor}}

## What I'm hoping you've figured out

## What you should not forget about this version of me
"#;

const KIT_ANXIETY_UNSPOOLER: &str = r#"<!-- label: Anxiety unspooler -->
<!-- kit: journal -->
# Unspooling the worry · {{date}}

A non-clinical, CBT-shaped work-through. Slow down, name it, separate
the thought from the fact, pick the next concrete step.

## The worry

{{cursor}}

## What's the evidence FOR it?

## What's the evidence AGAINST it?

## What would I tell a friend in this exact spot?

## The smallest next step I can actually take
"#;

const KIT_ANNUAL_REVIEW: &str = r#"<!-- label: Annual review -->
<!-- kit: journal -->
# {{title}}

## What mattered most this year

{{cursor}}

## What changed in me

## What I learned the hard way

## What I want to carry forward

## What I'm ready to let go of

## Word for next year
"#;

const KIT_GRIEF_CHECKIN: &str = r#"<!-- label: Grief check-in -->
<!-- kit: journal -->
# Grief · {{date_human}}

No fix. No prescription. Just a place to put it.

## How I am right now, honestly

{{cursor}}

## What I'm missing today

## A small kindness I can give myself

## A line about them, for safekeeping
"#;

// ──────────────── Research kits — 2.1 expansion ────────────────

const KIT_METHODOLOGY: &str = r#"<!-- label: Methodology card -->
<!-- kit: research -->
# {{title}}

**Design:**
**Sample (N + recruitment):**
**Inclusion / exclusion:**
**Instruments / measures:**
**Procedure:**
**Analysis plan:**
**IRB status:**
**Pre-registration:**

## What this design can tell us

{{cursor}}

## What it cannot

## Open questions

??
"#;

const KIT_HYPOTHESIS: &str = r#"<!-- label: Hypothesis card -->
<!-- kit: research -->
# {{title}}

## H₀ (null)

{{cursor}}

## H₁ (alternative)

## Predicted effect (direction + size)

## Falsifier

What observation would tell us we're wrong.

## Connection to theory

- Builds on [[]]
- Contradicts [[]]
"#;

const KIT_EXPERIMENT_LOG: &str = r#"<!-- label: Experiment log -->
<!-- kit: research -->
# Experiment · {{title}}, {{date}}

## Condition

What's different from the last run.

{{cursor}}

## Procedure

## Observation

What happened.

## Surprise / anomaly

## Next thing to try
"#;

const KIT_ANNOTATED_BIB: &str = r#"<!-- label: Annotated bibliography entry -->
<!-- kit: research -->
# {{title}}

**Citation:** {{cursor}}

## Argument in one sentence

## How they back it up

## Where I think it's weak

## Why I'm reading this for my project
"#;

const KIT_CONFERENCE_TALK: &str = r#"<!-- label: Conference talk notes -->
<!-- kit: research -->
# {{title}}

**Speaker:**
**Session:**
**Date:** {{date}}

## Their claim in one line

{{cursor}}

## Evidence presented

## What I'd push back on

## What I want to follow up on

- Paper to find:
- Person to email:

## Connections to my work
"#;

const KIT_DATA_ANALYSIS_LOG: &str = r#"<!-- label: Data analysis log -->
<!-- kit: research -->
# Analysis · {{title}}, {{date}}

## Question

{{cursor}}

## Query / model

```
```

## Output

## Interpretation

## What this changes about my next step
"#;

const KIT_THESIS_CHAPTER: &str = r#"<!-- label: Thesis chapter scaffold -->
<!-- kit: research -->
# Chapter — {{title}}

## Argument arc

The chapter answers ___ by showing ___ and concludes that ___.

{{cursor}}

## Section headings

1.
2.
3.

## Figures / tables

## Sources I need to engage

- [[]]

## What this chapter is NOT trying to do
"#;

// ──────────────── Clinical kits — 2.1 expansion ────────────────

const KIT_INTAKE: &str = r#"<!-- label: Intake / first session -->
<!-- kit: clinical -->
# {{title}}

> Private. Lives in `notes/` but registered in `.git/info/exclude` and
> never enters a checkpoint. Redact identifying details before saving.

## Presenting concern

In the client's words.

{{cursor}}

## History of the concern

Onset, course, prior treatment, what they've tried.

## Mental status

Appearance · behavior · speech · mood · affect · thought · cognition · insight · judgment.

## Risk

SI/HI · means · plan · history · protective factors.

## Working formulation

## Plan

Treatment frame, frequency, focus, consent.
"#;

const KIT_SAFETY_PLAN: &str = r#"<!-- label: Crisis / safety plan -->
<!-- kit: clinical -->
# Safety plan · {{title}}

> Private. Stanley-Brown shape. Co-developed with the client.

## Warning signs

Thoughts, images, mood, situation, behaviour.

{{cursor}}

## Internal coping strategies

What I can do alone to take my mind off, lower the temperature.

## People + places that distract

## People I can ask for help

Names + numbers.

## Professionals + agencies

Therapist · psychiatrist · 988 · ER · local crisis line.

## Making the environment safer

Means restriction.
"#;

const KIT_TREATMENT_PLAN: &str = r#"<!-- label: Treatment plan -->
<!-- kit: clinical -->
# Treatment plan · {{title}}

> Private.

## Diagnosis / formulation

{{cursor}}

## Goals

Long-term, observable, the client agrees to them.

- 1.
- 2.

## Objectives under each goal

Measurable, time-bounded — the steps to reach the goal.

## Interventions

Modality, frequency, who delivers.

## Review

Date for next review.
"#;

const KIT_RISK_ASSESSMENT: &str = r#"<!-- label: Risk assessment -->
<!-- kit: clinical -->
# Risk · {{title}}, {{date}}

> Private. Document at the moment of concern.

## Suicidal ideation

Frequency, intensity, duration, controllability.

{{cursor}}

## Plan / means / intent

## Prior attempts

## Homicidal ideation

## Substance use

## Protective factors

## Decision

Level of care · safety plan made · who else notified.
"#;

const KIT_TERMINATION: &str = r#"<!-- label: Termination summary -->
<!-- kit: clinical -->
# Termination · {{title}}

> Private. The closing chapter of the case file.

## Reason for termination

Goals reached · client choice · provider change · external.

{{cursor}}

## Gains

What's different now.

## What's still in progress

## What I'd recommend the client keep doing

## Door-still-open language

## Records / referrals
"#;

const KIT_GROUP_SESSION: &str = r#"<!-- label: Group session notes -->
<!-- kit: clinical -->
# Group · {{title}}, {{date}}

> Private. Names redacted; refer to members by initial.

## Attendance

## Theme tonight

{{cursor}}

## What each member brought

- A.
- B.

## Group dynamics

## My intervention(s)

## Follow-up
"#;

const KIT_BEHAVIORAL_CHAIN: &str = r#"<!-- label: Behavioral chain (DBT) -->
<!-- kit: clinical -->
# Behavioral chain · {{title}}

> Private. DBT-style chain analysis.

## Vulnerability factors

What set things up.

## Prompting event

The moment it tipped.

{{cursor}}

## Links in the chain

Thoughts → feelings → urges → actions, in order.

## The behaviour

The thing we're analysing.

## Consequences

Short-term and long-term.

## Skills that could have intervened at each link

## Repair

What can be done now to lower harm.
"#;

const KIT_COG_DISTORTION: &str = r#"<!-- label: Cognitive distortion log -->
<!-- kit: clinical -->
# Distortion log · {{title}}

> Private. Client homework template.

## Situation

{{cursor}}

## Automatic thought

## Distortion type

All-or-nothing · catastrophising · mind reading · personalisation · should-statements · emotional reasoning · filtering · labeling · disqualifying-positive.

## Evidence for

## Evidence against

## Balanced reframe
"#;

const KIT_CASE_FORMULATION: &str = r#"<!-- label: Case formulation -->
<!-- kit: clinical -->
# Case formulation · {{title}}

> Private. The 5 P's frame.

## Presenting problem

{{cursor}}

## Predisposing factors

What set the stage.

## Precipitating factors

What lit the match.

## Perpetuating factors

What keeps it burning.

## Protective factors

What's already working.

## Working hypothesis

A sentence or two — the story I'm currently telling about why this
client is the way they are.
"#;

// ──────────────── Work kits — 2.1 (new kind) ────────────────

const KIT_ONE_ON_ONE: &str = r#"<!-- label: 1:1 prep -->
<!-- kit: work -->
# 1:1 · {{title}}, {{date}}

## Wins

To celebrate or share.

{{cursor}}

## Blockers

What I need help with.

## Asks

What I want from this conversation.

## Things to thank them for

## Carry-overs from last time
"#;

const KIT_DECISION_LOG: &str = r#"<!-- label: Decision log (ADR) -->
<!-- kit: work -->
# {{title}}

**Status:** proposed | accepted | superseded
**Date:** {{date}}

## Context

What's the situation that needs a decision.

{{cursor}}

## Options considered

- A —
- B —
- C —

## Decision

## Consequences

Both intended and risks accepted.

## Revisit when
"#;

const KIT_POSTMORTEM: &str = r#"<!-- label: Postmortem -->
<!-- kit: work -->
# Postmortem · {{title}}

**Incident date:**
**Severity:**
**Owners:**

## What happened

A crisp narrative — no blame.

{{cursor}}

## Timeline

- HH:MM —
- HH:MM —

## Contributing factors

## What went well

## What didn't

## Action items

- [ ]
- [ ]
"#;

const KIT_CUSTOMER_INTERVIEW: &str = r#"<!-- label: Customer interview -->
<!-- kit: work -->
# Interview · {{title}}, {{date}}

**Role:**
**Company:**
**How they came in:**

## Their world right now

{{cursor}}

## Pains

Quotes > paraphrase.

>

## Asks

What they wish was different.

## What they'd pay for

## What surprised me
"#;

const KIT_RETROSPECTIVE: &str = r#"<!-- label: Sprint retrospective -->
<!-- kit: work -->
# Retrospective · {{title}}

## Keep doing

What worked, name names.

{{cursor}}

## Drop

What we should stop.

## Try

Experiments for the next sprint.

## Action items + owners

- [ ]  — owner:
"#;

const KIT_BRAG_DOC: &str = r#"<!-- label: Brag doc -->
<!-- kit: work -->
# Brag · {{title}}

A running list of impact, dated. The thing you wish you had on hand
the day before performance review.

## {{date}}

{{cursor}}

##

##
"#;

const KIT_STANDUP: &str = r#"<!-- label: Standup -->
<!-- kit: work -->
# Standup · {{date}}

## Yesterday

{{cursor}}

## Today

## Blockers
"#;

const KIT_STATUS_REPORT: &str = r#"<!-- label: Status report -->
<!-- kit: work -->
# Status · {{title}}, {{date}}

## Headline

🟢 / 🟡 / 🔴 plus one sentence.

{{cursor}}

## What shipped this week

## What's next

## Risks

## Asks
"#;

// ──────────────── Learning kits — 2.1 (new kind) ────────────────

const KIT_CORNELL_NOTES: &str = r#"<!-- label: Cornell notes -->
<!-- kit: learning -->
# {{title}}

| cue | notes |
|-----|-------|
|     | {{cursor}} |
|     |       |
|     |       |

## Summary

The whole page in 2-3 sentences, written at the end.
"#;

const KIT_LECTURE_SUMMARY: &str = r#"<!-- label: Lecture summary -->
<!-- kit: learning -->
# {{title}}

**Course:**
**Lecturer:**
**Date:** {{date}}

## Claim

What the lecturer was actually arguing.

{{cursor}}

## Evidence

The supporting moves.

## My questions

??

## Connections to other reading

- [[]]
"#;

const KIT_CONCEPT_MAP: &str = r#"<!-- label: Concept map seed -->
<!-- kit: learning -->
# {{title}}

The central idea + 5-8 spokes. Not a substitute for thinking — a way
to see the shape of what I think I know.

## Central idea

{{cursor}}

## Spoke 1 —

## Spoke 2 —

## Spoke 3 —

## Spoke 4 —

## Spoke 5 —

## What's missing
"#;

const KIT_READING_LOG: &str = r#"<!-- label: Reading log -->
<!-- kit: learning -->
# Reading · {{date}}

## What I read

{{cursor}}

## One-sentence takeaway

## What to follow up on

## Connection to a current project
"#;

const KIT_TUTORIAL_WALKTHROUGH: &str = r#"<!-- label: Tutorial walk-through -->
<!-- kit: learning -->
# {{title}}

**Source:**
**Started:** {{date}}

## Steps + my notes

1. {{cursor}}
2.
3.

## Where I got stuck

## What I'd do differently next time

## Things I want to remember
"#;

// ──────────────── Writing kits — 2.1 (new kind) ────────────────

const KIT_STORY_IDEA: &str = r#"<!-- label: Story idea -->
<!-- kit: writing -->
# {{title}}

## Premise

One sentence.

{{cursor}}

## Protagonist

Wants · needs · the lie they believe.

## Central tension

## "But why now" — what makes this the moment

## Tone / closest cousin

A book or film that's the closest neighbour, even if mine is
nothing like it on the surface.
"#;

const KIT_CHARACTER_SHEET: &str = r#"<!-- label: Character sheet -->
<!-- kit: writing -->
# {{title}}

**Role:**
**Age / when:**

## Wants

What they're chasing on the surface.

{{cursor}}

## Needs

What they actually require to grow.

## Lies they believe

## Wound

The thing that shaped the lies.

## Change arc

Where they start → where they end.

## Voice

A line of dialogue only they would say.
"#;

const KIT_SCENE_BEAT: &str = r#"<!-- label: Scene beat sheet -->
<!-- kit: writing -->
# Scene · {{title}}

**POV:**
**Setting:**

## Goal

What the POV character wants in this scene.

{{cursor}}

## Obstacle

What's in the way.

## The turn

The thing that shifts in this scene that didn't shift before.

## Out

The line / image we leave on.
"#;

const KIT_POEM_DRAFT: &str = r#"<!-- label: Poem draft -->
<!-- kit: writing -->
# {{title}}

{{cursor}}
"#;

const KIT_CRITIQUE_NOTES: &str = r#"<!-- label: Critique notes -->
<!-- kit: writing -->
# Critique · {{title}}

**Author:**
**Workshop date:** {{date}}

## What worked

The line, the move, the page.

{{cursor}}

## What didn't land

## Where I lost interest

The honest one.

## A question I'd love to hear them answer

## A specific suggestion
"#;

const KIT_SUBMISSION_TRACKER: &str = r#"<!-- label: Submission tracker -->
<!-- kit: writing -->
# Submissions · {{title}}

| venue | date sent | response | next step |
|-------|-----------|----------|-----------|
|       | {{date}}  |          |           |

## Notes

{{cursor}}
"#;

// ──────────────── Everyday kits — 2.1 (new kind) ────────────────

const KIT_DOCTOR_VISIT: &str = r#"<!-- label: Doctor visit -->
<!-- kit: everyday -->
# {{title}}, {{date}}

## Pre-visit questions

What I want to ask, written down before I forget.

{{cursor}}

## What was said

## Diagnosis / impressions

## Meds + dosage

## Tests / referrals

## Next steps

When to follow up, what to watch for.
"#;

const KIT_SYMPTOM_JOURNAL: &str = r#"<!-- label: Symptom journal -->
<!-- kit: everyday -->
# Symptom · {{date}}, {{time}}

## Severity (1-10)

{{cursor}}

## What it felt like

## What I was doing right before

## What helped / didn't

## Pattern I notice over time
"#;

const KIT_MEDICATION: &str = r#"<!-- label: Medication tracker -->
<!-- kit: everyday -->
# {{title}}

**Started:** {{date}}
**Prescribed by:**
**Reason:**

## Dose + schedule

{{cursor}}

## How it's been going

Weekly check-ins.

## Side effects noticed

## Questions for next appointment
"#;

const KIT_WORKOUT: &str = r#"<!-- label: Workout log -->
<!-- kit: everyday -->
# {{date}} · {{weekday}}

## Session

What kind, how long.

{{cursor}}

## Lifts / sets / reps

## How it felt

## What to push next time
"#;

const KIT_HABIT_STREAK: &str = r#"<!-- label: Habit streak -->
<!-- kit: everyday -->
# {{title}}

**Started:** {{date}}
**Frequency target:**

## Why this habit

The deeper reason, written down so future-you can read it on a hard day.

{{cursor}}

## Daily check-in

| date | done? | notes |
|------|-------|-------|
| {{date}} |  |  |
"#;

// ──────────────── Decision kits — 2.1 (new kind) ────────────────

const KIT_TEN_TEN_TEN: &str = r#"<!-- label: 10-10-10 -->
<!-- kit: decision -->
# {{title}}

## The choice

{{cursor}}

## In 10 minutes

How will I feel about each option?

## In 10 months

## In 10 years

## What this tells me
"#;

const KIT_WRAP: &str = r#"<!-- label: WRAP framework -->
<!-- kit: decision -->
# {{title}}

The Heath brothers' four-part check.

## W — Widen options

What if neither / what's the third path?

{{cursor}}

## R — Reality-test

What's the smallest experiment I can run before committing?

## A — Attain distance

What would I tell a friend in this exact spot?

## P — Prepare to be wrong

What's the early warning sign that this isn't working?
"#;

const KIT_PRE_MORTEM: &str = r#"<!-- label: Pre-mortem -->
<!-- kit: decision -->
# Pre-mortem · {{title}}

Assume this decision FAILED a year from now. Tell the story.

## What went wrong

{{cursor}}

## The early warning signs we ignored

## The thing we should have done differently

## What this tells us to watch for from day one
"#;

const KIT_WEIGHTED_PROS_CONS: &str = r#"<!-- label: Weighted pros / cons -->
<!-- kit: decision -->
# {{title}}

Each row gets a 1-5 weight. Honest weights matter more than honest items.

## Pros

| weight | item |
|--------|------|
|        | {{cursor}} |
|        |      |

## Cons

| weight | item |
|--------|------|
|        |      |

## Sum

Pros total: ___
Cons total: ___

## What the math doesn't capture
"#;

const KIT_EISENHOWER: &str = r#"<!-- label: Eisenhower matrix -->
<!-- kit: decision -->
# {{title}}

## Urgent + Important — DO

{{cursor}}

## Important, Not Urgent — SCHEDULE

The slot most people skip. The actual investment work.

## Urgent, Not Important — DELEGATE

## Not Urgent, Not Important — DROP
"#;

const KIT_FIVE_WHYS: &str = r#"<!-- label: 5 Whys -->
<!-- kit: decision -->
# {{title}}

## The problem

{{cursor}}

## Why?

## Why?

## Why?

## Why?

## Why?

## What this tells me about where to actually intervene
"#;

// ──────────────── Spiritual kits — 2.1 (new kind) ────────────────

const KIT_EXAMEN: &str = r#"<!-- label: Examen -->
<!-- kit: spiritual -->
# Examen · {{date_human}} evening

The Ignatian nightly review. Five movements, gentle.

## 1. Gratitude

What I'm thankful for, today specifically.

{{cursor}}

## 2. Petition

Asking for the light to see clearly.

## 3. Review

Walking through the day, hour by hour or moment by moment.

## 4. Sorrow / response

Where did I miss the mark? What's the response that fits?

## 5. Resolve

What I want to carry into tomorrow.
"#;

const KIT_LECTIO: &str = r#"<!-- label: Lectio divina -->
<!-- kit: spiritual -->
# Lectio · {{date}}

**Passage:**

## First read — slowly

A word, a phrase that catches.

{{cursor}}

## Second read — louder, in my own voice

What does this say to me, today, where I am?

## Response

## Rest — sit, no words
"#;

const KIT_LOVING_KINDNESS: &str = r#"<!-- label: Loving-kindness session -->
<!-- kit: spiritual -->
# Metta · {{date}}, {{time}}

## Self

May I be safe. May I be peaceful. May I be healthy. May I live with ease.

## Loved one (name):

## Neutral person (someone I see but barely know):

## Difficult person:

## All beings:

## Notes from this sit

{{cursor}}
"#;

// ════════════════════════════════════════════════════════════
// 2.2.0 — Baking kits
//
// Five templates aimed at home bakers who want their recipes,
// schedules, and bake history to live alongside the rest of their
// notes. They lean on Yarrow's existing primitives:
//   · Wikilinks for ingredient cross-references ([[Brown Butter]])
//   · Paths for variations ("with rye flour", "halved")
//   · Tags (`#cookies`, `#fall`, `#kid-friendly`) for the bouquet
//   · The new `[[timer:Xm label]]` syntax for hands-free pacing
// ════════════════════════════════════════════════════════════

const KIT_RECIPE_CARD: &str = r#"<!-- label: Recipe card -->
<!-- kit: baking -->
---
tags: [recipe]
yield: ""
prep_time: ""
bake_time: ""
oven_temp: ""
pan: ""
adapted_from: ""
---

# {{title}}

> _One-line note about why this recipe matters to you. Where you first
> tasted it, who taught you, what makes it different from the others._

## Ingredients

- {{cursor}}

## Instructions

1.
2.
3.

## Notes

- Use the path system to fork variations: branch this note as
  "with brown butter," "halved," "scaled to 9×13," etc.
- Drop `[[timer:25m rest]]` anywhere below to add a tappable timer.
"#;

const KIT_BAKE_LOG: &str = r#"<!-- label: Bake log -->
<!-- kit: baking -->
---
tags: [bake-log]
recipe: ""
date: "{{date}}"
rating: ""
---

# {{title}} · {{date_human}}

**Recipe:** [[{{cursor}}]]
**Variation tried:**

## How it went

-

## What I'd change next time

-

## Photos

_Drag images in to attach. They live alongside the note, never on a
server (unless you've connected Yarrow Sync)._

## Family rating

- :
- :
"#;

const KIT_HOLIDAY_BAKING: &str = r#"<!-- label: Holiday baking plan -->
<!-- kit: baking -->
---
tags: [baking-plan]
holiday: ""
event_date: ""
---

# {{title}}

_For: {{cursor}}_
_Date: {{date_human}}_

## Recipes I want to make

- [ ] [[ ]] · _why I'm including it_
- [ ]
- [ ]

## Ingredients to buy

- [ ]

## Schedule

### 5 days out
- [ ] Make and freeze cookie doughs
- [ ] Confirm guest list / dietary needs

### 2 days out
- [ ] Bake first round (cookies that hold well)
- [ ] [[timer:8h proof]] sourdough overnight if making bread

### Day before
- [ ] Final bakes
- [ ] Plate and cover

### Morning of
- [ ] Pull frozen items, set on counter
- [ ] Reheat anything that needs it

## Lessons for next year

-
"#;

const KIT_SOURDOUGH: &str = r#"<!-- label: Sourdough schedule -->
<!-- kit: baking -->
---
tags: [sourdough]
loaf_count: ""
flour_blend: ""
hydration: ""
---

# {{title}}

_A staggered schedule for one bake day. Adjust the times to your
kitchen — colder houses slow everything down._

## Levain build

| When             | Step                                   | Notes |
| ---------------- | -------------------------------------- | ----- |
| **T-22h**, 9pm   | Feed levain (1:5:5)                    |       |
| **T-12h**, 7am   | Levain ready · float test              |       |

## Bulk + shape

| When             | Step                                          |
| ---------------- | --------------------------------------------- |
| **T-9h**, 10am   | Autolyse 1h · [[timer:60m autolyse]]          |
| **T-8h**, 11am   | Mix levain + salt                             |
| **T-7h**, 12pm   | Stretch & fold #1                             |
| **T-6h30**, 12:30| Stretch & fold #2                             |
| **T-6h**, 1pm    | Lamination / coil fold                        |
| **T-3h**, 4pm    | Pre-shape · bench rest [[timer:30m bench]]    |
| **T-2h30**, 4:30 | Final shape · cold retard                     |

## Bake

| When        | Step                                               |
| ----------- | -------------------------------------------------- |
| **T-1h**    | Preheat oven + Dutch oven · 500 °F               |
| **T-0**     | Score, load, lid on · [[timer:20m lid on]]       |
| **+20m**    | Lid off · drop to 460 °F · [[timer:25m crust]]   |
| **+45m**    | Pull · cool ≥ 1h · [[timer:60m cool]]             |

## What happened today

{{cursor}}
"#;

const KIT_FAMILY_COOKBOOK: &str = r#"<!-- label: Family cookbook page -->
<!-- kit: baking -->
---
tags: [cookbook]
---

# {{title}}

_A living index of recipes I keep coming back to. Each link goes to a
recipe card; click through to see the full thing or fork a variation._

## Cookies & bars

- [[ ]] · _everyone's favourite_
- [[ ]]
- [[ ]]

## Cakes & cupcakes

- [[ ]]
- [[ ]]

## Breads & rolls

- [[ ]]
- [[ ]]

## Pies & tarts

- [[ ]]
- [[ ]]

## Quick bakes

- [[ ]]

## Holidays / occasions

- **Christmas:** [[ ]]
- **Birthdays:** [[ ]]
- **Friday breakfast:** [[ ]]

## To try

- [ ] {{cursor}}
"#;
