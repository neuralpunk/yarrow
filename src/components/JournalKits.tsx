import { useEffect, useMemo, useRef, useState } from "react";
import type { TemplateInfo } from "../lib/types";
import Modal from "./Modal";
import EmptyState from "./EmptyState";
import { useT, type StringKey } from "../lib/i18n";

/**
 * Kits picker (2.1): a warm, illustrated grid of kit templates grouped
 * by `kit_kind` (journal / research / clinical / work / learning /
 * writing / everyday / decision / spiritual). Includes a search box at
 * the top so a roster of 60+ kits stays scannable.
 *
 * Picking a kit prompts for a title and funnels through the same
 * `createFromTemplate` backend path as the generic template picker.
 * The picker's only job is curation — the storage shape is identical
 * to every other template.
 */
interface Props {
  open: boolean;
  templates: TemplateInfo[];
  onClose: () => void;
  /** Called with (templateName, title) once the user commits. Parent is
   *  responsible for the createFromTemplate IPC + state refresh. */
  onPick: (templateName: string, title: string) => void;
}

// Per-kit visual: glyph + bg/stroke colors. Anything we don't have a
// hand-styled entry for falls through to a category-default style based
// on `kit_kind`, so adding a new kit just needs a name + body in
// templates.rs — no required UI work to make it look reasonable.
const KIT_STYLE: Record<string, { glyph: string; bg: string; stroke: string }> = {
  // journal
  "morning-three":      { glyph: "🌅", bg: "#F3E2B0", stroke: "#C89B3C" },
  "today-kindly":       { glyph: "🌿", bg: "#D7E5C9", stroke: "#4A6E45" },
  "dear-self":          { glyph: "✉",  bg: "#EFD0D6", stroke: "#C67E8C" },
  "long-exhale":        { glyph: "📖", bg: "#D0DDE6", stroke: "#4E7185" },
  "sleep-ledger":       { glyph: "🌙", bg: "#DFCDE1", stroke: "#6D5070" },
  "gratitude-three":    { glyph: "🌻", bg: "#F4E1AF", stroke: "#A07835" },
  "dream-journal":      { glyph: "💭", bg: "#D8D6E8", stroke: "#564F86" },
  "mood-energy":        { glyph: "📊", bg: "#E0DFD2", stroke: "#5E6051" },
  "letter-future-self": { glyph: "📜", bg: "#EBDFC9", stroke: "#7A5F3A" },
  "anxiety-unspooler":  { glyph: "🧶", bg: "#E8DACC", stroke: "#76553D" },
  "annual-review":      { glyph: "🗓", bg: "#E0D8C2", stroke: "#665837" },
  "grief-checkin":      { glyph: "🪷", bg: "#E5D8E2", stroke: "#74548A" },
  "daily":              { glyph: "🪶", bg: "#EFE4C9", stroke: "#7A5F2C" },
  "morning-pages":      { glyph: "📝", bg: "#EFE4C9", stroke: "#7A5F2C" },
  // research
  "paper-card":             { glyph: "📄", bg: "#E4DCC2", stroke: "#7A6A3E" },
  "lit-review-summary":     { glyph: "🗂", bg: "#D8E0D2", stroke: "#4F6A47" },
  "methodology-card":       { glyph: "🧪", bg: "#D2DCDF", stroke: "#436370" },
  "hypothesis-card":        { glyph: "🔬", bg: "#D5DAE0", stroke: "#46546A" },
  "experiment-log":         { glyph: "⚗", bg: "#D2D9DC", stroke: "#475F66" },
  "annotated-bibliography": { glyph: "📚", bg: "#E0D6BD", stroke: "#75603A" },
  "conference-talk":        { glyph: "🎤", bg: "#DBD2DC", stroke: "#5F4566" },
  "data-analysis-log":      { glyph: "📈", bg: "#D2DDD3", stroke: "#3E5A45" },
  "thesis-chapter":         { glyph: "📘", bg: "#D5DCE3", stroke: "#43526A" },
  // clinical
  "soap-note":           { glyph: "🅢", bg: "#E0D6E4", stroke: "#5F4670" },
  "birp-note":           { glyph: "🅑", bg: "#DCD7E8", stroke: "#544A75" },
  "dap-note":            { glyph: "🅓", bg: "#D2D6E2", stroke: "#3F4A6F" },
  "supervision-prep":    { glyph: "💬", bg: "#E2D5D2", stroke: "#7A4D45" },
  "reflective-practice": { glyph: "🪞", bg: "#D7DFDB", stroke: "#3F5E55" },
  "intake-first-session": { glyph: "📝", bg: "#DDD3DE", stroke: "#5C476A" },
  "safety-plan":         { glyph: "🛟", bg: "#E2D2D5", stroke: "#7A434B" },
  "treatment-plan":      { glyph: "🗺", bg: "#D8DEE0", stroke: "#46586A" },
  "risk-assessment":     { glyph: "⚠", bg: "#EAD8C9", stroke: "#7E5634" },
  "termination-summary": { glyph: "🕯", bg: "#E0D6CB", stroke: "#6E5644" },
  "group-session":       { glyph: "👥", bg: "#D8DDE2", stroke: "#475568" },
  "behavioral-chain":    { glyph: "🔗", bg: "#DCD6E0", stroke: "#54486B" },
  "cognitive-distortion-log": { glyph: "🪜", bg: "#DAD6E0", stroke: "#52486A" },
  "case-formulation":    { glyph: "🧩", bg: "#D7DBDF", stroke: "#465367" },
  // work
  "meeting":             { glyph: "👥", bg: "#D9DFE5", stroke: "#465268" },
  "project-brief":       { glyph: "📋", bg: "#DCDBD0", stroke: "#5C5740" },
  "one-on-one":          { glyph: "💬", bg: "#D9DEE4", stroke: "#465468" },
  "decision-log":        { glyph: "🪧", bg: "#DDD8C7", stroke: "#5F5638" },
  "postmortem":          { glyph: "🧯", bg: "#E5D6CF", stroke: "#75463A" },
  "customer-interview":  { glyph: "🎧", bg: "#D2DAD9", stroke: "#3E5957" },
  "retrospective":       { glyph: "🔄", bg: "#D8DCD3", stroke: "#4A5740" },
  "brag-doc":            { glyph: "🏆", bg: "#EBE0BB", stroke: "#7A6535" },
  "standup":             { glyph: "☀", bg: "#EFE2C0", stroke: "#7A5F2A" },
  "status-report":       { glyph: "📊", bg: "#D9DDE3", stroke: "#465268" },
  // learning
  "book":                  { glyph: "📕", bg: "#E1D7C4", stroke: "#7A5F35" },
  "cornell-notes":         { glyph: "🗒", bg: "#E0DCC9", stroke: "#75603A" },
  "lecture-summary":       { glyph: "🎓", bg: "#D8DEE6", stroke: "#46546A" },
  "concept-map":           { glyph: "🕸", bg: "#DDD9DE", stroke: "#54486A" },
  "reading-log":           { glyph: "📖", bg: "#E0D6BF", stroke: "#75603A" },
  "tutorial-walkthrough":  { glyph: "🪛", bg: "#D9DCDA", stroke: "#52584C" },
  // writing
  "story-idea":          { glyph: "✨", bg: "#EBDDB8", stroke: "#7A6235" },
  "character-sheet":     { glyph: "🎭", bg: "#E0D6E0", stroke: "#5C4670" },
  "scene-beat":          { glyph: "🎬", bg: "#DCD6DC", stroke: "#54486A" },
  "poem-draft":          { glyph: "🪶", bg: "#EFE4C9", stroke: "#7A5F2C" },
  "critique-notes":      { glyph: "🔍", bg: "#DCDDD0", stroke: "#5A5738" },
  "submission-tracker":  { glyph: "✉", bg: "#DAD9D2", stroke: "#54533F" },
  // everyday
  "recipe":              { glyph: "🍲", bg: "#EDD6BE", stroke: "#76513A" },
  "vacation":            { glyph: "🧳", bg: "#D2DDD7", stroke: "#3E5A45" },
  "doctor-visit":        { glyph: "🩺", bg: "#D9DEE2", stroke: "#465468" },
  "symptom-journal":     { glyph: "🌡", bg: "#E5D6CF", stroke: "#75463A" },
  "medication-tracker":  { glyph: "💊", bg: "#DDD3DE", stroke: "#5C476A" },
  "workout-log":         { glyph: "🏃", bg: "#D8DDD3", stroke: "#4A5740" },
  "habit-streak":        { glyph: "✓", bg: "#E5DCBA", stroke: "#75653A" },
  // decision
  "ten-ten-ten":         { glyph: "⏳", bg: "#E0D6BF", stroke: "#75603A" },
  "wrap-framework":      { glyph: "🧠", bg: "#DCD6E0", stroke: "#54486B" },
  "pre-mortem":          { glyph: "🪦", bg: "#D7DBDF", stroke: "#465367" },
  "weighted-pros-cons":  { glyph: "⚖", bg: "#DDD9C7", stroke: "#5F5638" },
  "eisenhower-matrix":   { glyph: "🎯", bg: "#E5D6CF", stroke: "#75463A" },
  "five-whys":           { glyph: "❓", bg: "#E5D8E2", stroke: "#74548A" },
  // spiritual
  "examen":              { glyph: "🕯", bg: "#E5D8B0", stroke: "#7A6232" },
  "lectio-divina":       { glyph: "📖", bg: "#E0D6BD", stroke: "#75603A" },
  "loving-kindness":     { glyph: "🪷", bg: "#E5D8E2", stroke: "#74548A" },
};

const KIND_FALLBACK_STYLE: Record<string, { glyph: string; bg: string; stroke: string }> = {
  journal:   { glyph: "✶", bg: "var(--yelp)", stroke: "var(--yel)" },
  research:  { glyph: "📄", bg: "#E4DCC2", stroke: "#7A6A3E" },
  clinical:  { glyph: "🅒", bg: "#E0D6E4", stroke: "#5F4670" },
  work:      { glyph: "📋", bg: "#DCDBD0", stroke: "#5C5740" },
  learning:  { glyph: "📕", bg: "#E1D7C4", stroke: "#7A5F35" },
  writing:   { glyph: "✒", bg: "#EFE4C9", stroke: "#7A5F2C" },
  everyday:  { glyph: "🍳", bg: "#EDD6BE", stroke: "#76513A" },
  decision:  { glyph: "⚖", bg: "#DDD9C7", stroke: "#5F5638" },
  spiritual: { glyph: "🕯", bg: "#E5D8B0", stroke: "#7A6232" },
};
const FALLBACK_STYLE = { glyph: "✶", bg: "var(--yelp)", stroke: "var(--yel)" };

const KIT_BLURB: Record<string, string> = {
  // journal
  "morning-three":      "Three lines, before anything else.",
  "today-kindly":       "Five small things that went well today.",
  "dear-self":          "A letter you don't have to send.",
  "long-exhale":        "Before the day closes — what happened, what didn't.",
  "sleep-ledger":       "Kept by the bed. Two lines.",
  "gratitude-three":    "Three good things, with a 'why' line each.",
  "dream-journal":      "Caught quickly, before it fades.",
  "mood-energy":        "A 1-10 number + one sentence.",
  "letter-future-self": "Sealed today, opened later.",
  "anxiety-unspooler":  "Worry → evidence → next concrete step.",
  "annual-review":      "What mattered, what changed, what carries forward.",
  "grief-checkin":      "No fix. Just a place to put it.",
  "daily":              "Yesterday → today → questions, in one shape.",
  "morning-pages":      "Three pages, unedited. No stopping.",
  // research
  "paper-card":              "One note per paper. Citation, methodology, your critique.",
  "lit-review-summary":      "Themes, disagreements, the gap you're filling.",
  "methodology-card":        "Design, sample, instruments, analysis plan.",
  "hypothesis-card":         "H₀ / H₁, predicted effect, falsifier.",
  "experiment-log":          "What you ran, what you saw, what surprised.",
  "annotated-bibliography":  "Slimmer than paper-card — for skim reads.",
  "conference-talk":         "Speaker → claim → evidence → your pushback.",
  "data-analysis-log":       "Question, query, output, what it changes.",
  "thesis-chapter":          "Argument arc + section headings + figures.",
  // clinical
  "soap-note":           "Subjective · Objective · Assessment · Plan. Private.",
  "birp-note":           "Behavior · Intervention · Response · Plan. Private.",
  "dap-note":            "Data · Assessment · Plan. Private.",
  "supervision-prep":    "What you want help thinking through this week.",
  "reflective-practice": "The moment that pulled you. Just for you.",
  "intake-first-session": "Presenting concern, history, MSE, risk, plan.",
  "safety-plan":         "Stanley-Brown shape. Co-developed with the client.",
  "treatment-plan":      "Goals, objectives, interventions, review date.",
  "risk-assessment":     "Structured screen at the moment of concern.",
  "termination-summary": "Gains, what's next, door-still-open language.",
  "group-session":       "Attendance, theme, members by initial.",
  "behavioral-chain":    "DBT-style chain analysis of a behaviour.",
  "cognitive-distortion-log": "Client homework: situation → thought → reframe.",
  "case-formulation":    "5 P's: predisposing, precipitating, perpetuating, protective.",
  // work
  "meeting":             "Agenda, decisions, action items.",
  "project-brief":       "Why, success, scope, milestones.",
  "one-on-one":          "Wins, blockers, asks, things to thank for.",
  "decision-log":        "ADR-style. Context, options, decision, consequences.",
  "postmortem":          "Timeline, contributing factors, action items.",
  "customer-interview":  "Pains, asks, what they'd pay for, surprises.",
  "retrospective":       "Keep · drop · try.",
  "brag-doc":            "A running list of impact, dated.",
  "standup":             "Yesterday · today · blockers.",
  "status-report":       "🟢/🟡/🔴 plus what shipped, what's next.",
  // learning
  "book":                  "Quotes, key ideas, what to tell a friend.",
  "cornell-notes":         "Cue · notes · summary three-pane.",
  "lecture-summary":       "Claim → evidence → your questions.",
  "concept-map":           "Central idea + 5–8 spokes.",
  "reading-log":           "What you read, one-sentence takeaway.",
  "tutorial-walkthrough":  "Steps + where you got stuck.",
  // writing
  "story-idea":          "Premise · protagonist · tension · why now.",
  "character-sheet":     "Wants · needs · lies · wound · arc · voice.",
  "scene-beat":          "POV · goal · obstacle · turn · out.",
  "poem-draft":          "A blank page with no scaffolding.",
  "critique-notes":      "What worked, what didn't land, where you lost interest.",
  "submission-tracker":  "Venue, date, response, next step.",
  // everyday
  "recipe":              "Ingredients, method, notes from last time.",
  "vacation":            "Shape, bookings, packing, things to do.",
  "doctor-visit":        "Pre-Qs, what was said, next steps.",
  "symptom-journal":     "Severity 1-10, triggers, what helped.",
  "medication-tracker":  "Dose, schedule, side effects.",
  "workout-log":         "Session, lifts, how it felt.",
  "habit-streak":        "Daily check-in for one habit at a time.",
  // decision
  "ten-ten-ten":         "10 minutes / 10 months / 10 years.",
  "wrap-framework":      "Widen · Reality-test · Attain distance · Prepare to be wrong.",
  "pre-mortem":          "Assume it failed. Tell the story.",
  "weighted-pros-cons":  "Honest weights matter more than honest items.",
  "eisenhower-matrix":   "Urgent × Important quadrants.",
  "five-whys":           "Root-cause chain, no skipping links.",
  // spiritual
  "examen":              "Ignatian nightly review — five gentle movements.",
  "lectio-divina":       "Read · respond · rest, with a passage.",
  "loving-kindness":     "Self · loved one · neutral · difficult · all beings.",
};

const KIND_LABEL_KEY: Record<string, StringKey> = {
  journal:   "modals.kits.kindJournal",
  research:  "modals.kits.kindResearch",
  clinical:  "modals.kits.kindClinical",
  work:      "modals.kits.kindWork",
  learning:  "modals.kits.kindLearning",
  writing:   "modals.kits.kindWriting",
  everyday:  "modals.kits.kindEveryday",
  decision:  "modals.kits.kindDecision",
  spiritual: "modals.kits.kindSpiritual",
};

const KIND_BLURB_KEY: Record<string, StringKey> = {
  journal:   "modals.kits.blurbJournal",
  research:  "modals.kits.blurbResearch",
  clinical:  "modals.kits.blurbClinical",
  work:      "modals.kits.blurbWork",
  learning:  "modals.kits.blurbLearning",
  writing:   "modals.kits.blurbWriting",
  everyday:  "modals.kits.blurbEveryday",
  decision:  "modals.kits.blurbDecision",
  spiritual: "modals.kits.blurbSpiritual",
};

const KIND_ORDER = [
  "journal",
  "research",
  "clinical",
  "work",
  "learning",
  "writing",
  "everyday",
  "decision",
  "spiritual",
] as const;

export default function JournalKits({ open, templates, onClose, onPick }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const t = useT();

  useEffect(() => {
    if (!open) {
      setPending(null);
      setTitle("");
      setSearch("");
    } else {
      // Auto-focus the search box when the picker opens — `/` is the
      // muscle-memory trigger for "I know what I want, just let me type."
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byKind = new Map<string, TemplateInfo[]>();
    for (const tpl of templates) {
      if (!tpl.is_kit) continue;
      if (q) {
        const blurb = (KIT_BLURB[tpl.name] || "").toLowerCase();
        const haystack = `${tpl.label} ${tpl.name} ${blurb}`.toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      const kind = tpl.kit_kind || "journal";
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind)!.push(tpl);
    }
    const known = KIND_ORDER.filter((k) => byKind.has(k));
    const custom = Array.from(byKind.keys())
      .filter((k) => !KIND_ORDER.includes(k as (typeof KIND_ORDER)[number]))
      .sort();
    return [...known, ...custom].map((kind) => ({
      kind,
      label: KIND_LABEL_KEY[kind] ? t(KIND_LABEL_KEY[kind]) : titleCase(kind),
      blurb: KIND_BLURB_KEY[kind] ? t(KIND_BLURB_KEY[kind]) : t("modals.kits.fallbackBlurb"),
      kits: byKind.get(kind)!.sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [templates, search, t]);

  if (!open) return null;

  if (pending) {
    const kit = templates.find((k) => k.name === pending);
    return (
      <Modal open onClose={onClose} title={kit ? t("modals.kits.startTitle", { label: kit.label }) : t("modals.kits.startFallbackTitle")}>
        <p className="text-xs text-t2 mb-3 leading-relaxed">
          {t("modals.kits.startBody")}
        </p>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const tt = title.trim();
              if (tt) onPick(pending, tt);
            } else if (e.key === "Escape") {
              setPending(null);
            }
          }}
          placeholder={kit ? defaultTitleFor(kit) : ""}
          className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onClick={() => setPending(null)}
          >
            {t("modals.kits.back")}
          </button>
          <button
            className="btn-yel px-3 py-1.5 text-sm rounded-md"
            disabled={!title.trim()}
            onClick={() => {
              const tt = title.trim();
              if (tt) onPick(pending, tt);
            }}
          >
            {t("modals.kits.create")}
          </button>
        </div>
      </Modal>
    );
  }

  const totalKits = grouped.reduce((acc, g) => acc + g.kits.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-char/30 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-[920px] max-w-[94vw] max-h-[88vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden animate-slideUp flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 py-5 border-b border-bd">
          <div className="font-serif text-2xl text-char">{t("modals.kits.title")}</div>
          <div className="font-serif italic text-sm text-t2 mt-1">
            {(() => {
              const kits = totalKits;
              const cats = grouped.length;
              if (kits === 1 && cats === 1) return t("modals.kits.subtitleOne", { kits: String(kits), cats: String(cats) });
              if (kits !== 1 && cats === 1) return t("modals.kits.subtitleManyKits", { kits: String(kits), cats: String(cats) });
              if (kits === 1 && cats !== 1) return t("modals.kits.subtitleManyCats", { kits: String(kits), cats: String(cats) });
              return t("modals.kits.subtitleMany", { kits: String(kits), cats: String(cats) });
            })()}
          </div>
          <div className="mt-3">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && search) {
                  e.stopPropagation();
                  setSearch("");
                }
              }}
              placeholder={t("modals.kits.searchPlaceholder")}
              className="w-full px-3.5 py-2 bg-bg border border-bd rounded-full text-sm text-char placeholder:text-t3 focus:outline-none focus:border-bd2 transition"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {grouped.length === 0 ? (
            <EmptyState
              kind="checkpoints"
              title={search ? t("modals.kits.noMatchTitle", { query: search }) : t("modals.kits.noKitsTitle")}
              hint={
                search
                  ? t("modals.kits.noMatchHint")
                  : t("modals.kits.noKitsHint")
              }
            />
          ) : (
            <div className="space-y-8">
              {grouped.map((group) => (
                <section key={group.kind}>
                  <div className="mb-3">
                    <div className="font-serif text-lg text-char tracking-tight">
                      {group.label}
                    </div>
                    <div className="font-serif italic text-sm text-t2 mt-0.5 max-w-prose leading-relaxed">
                      {group.blurb}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {group.kits.map((k) => {
                      const s =
                        KIT_STYLE[k.name] ||
                        KIND_FALLBACK_STYLE[group.kind] ||
                        FALLBACK_STYLE;
                      const blurb = KIT_BLURB[k.name] ?? t("modals.kits.kitFallbackBlurb");
                      return (
                        <button
                          key={k.name}
                          onClick={() => {
                            setPending(k.name);
                            setTitle(defaultTitleFor(k));
                          }}
                          title={`${k.label} · ${blurb}`}
                          className="group text-left bg-bg border border-bd rounded-xl p-3 hover:border-yel hover:bg-yelp/40 transition"
                        >
                          <div
                            className="w-9 h-9 rounded-lg mb-2 flex items-center justify-center text-[18px]"
                            style={{ background: s.bg, color: s.stroke, border: `1px solid ${s.stroke}` }}
                          >
                            {s.glyph}
                          </div>
                          <div className="font-serif text-[14.5px] text-char leading-tight truncate">
                            {k.label}
                          </div>
                          <div className="text-2xs text-t2 mt-1 leading-relaxed line-clamp-2">
                            {blurb}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function defaultTitleFor(k: TemplateInfo): string {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  return `${k.label} — ${iso}`;
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
