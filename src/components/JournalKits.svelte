<script lang="ts">
  import type { TemplateInfo } from "../lib/types";
  import Modal from "./Modal.svelte";
  import EmptyState from "./EmptyState.svelte";
  import { tr } from "../lib/i18n/index.svelte";
  import type { StringKey } from "../lib/i18n/index.svelte";

  /**
   * Kits picker (2.1): a warm, illustrated grid of kit templates
   * grouped by `kit_kind` (journal / research / clinical / work /
   * learning / writing / everyday / decision / spiritual). Includes a
   * search box at the top so a roster of 60+ kits stays scannable.
   *
   * Picking a kit prompts for a title and funnels through the same
   * `createFromTemplate` backend path as the generic template picker.
   */

  interface Props {
    open: boolean;
    templates: TemplateInfo[];
    onClose: () => void;
    /** Called with (templateName, title) once the user commits. */
    onPick: (templateName: string, title: string) => void;
  }

  let { open, templates, onClose, onPick }: Props = $props();
  let t = $derived(tr());

  let pending = $state<string | null>(null);
  let title = $state("");
  let search = $state("");
  let searchRef = $state<HTMLInputElement | null>(null);
  let titleInputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!open) {
      pending = null;
      title = "";
      search = "";
    } else {
      const id = window.setTimeout(() => searchRef?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  });

  // Focus the title input when entering the pending state — replaces
  // the legacy `autofocus` attribute (which Svelte's a11y rules
  // discourage because users with screen readers can be jolted by it).
  $effect(() => {
    if (pending) {
      const id = window.setTimeout(() => titleInputEl?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  });

  // Doodle Icons set — kit slugs that have hand-drawn SVGs.
  const KITS_WITH_DOODLES: ReadonlySet<string> = new Set([
    "morning-three", "today-kindly", "dear-self", "long-exhale",
    "sleep-ledger", "gratitude-three", "dream-journal", "mood-energy",
    "letter-future-self", "anxiety-unspooler", "annual-review",
    "grief-checkin", "daily", "morning-pages",
    "paper-card", "lit-review-summary", "methodology-card",
    "hypothesis-card", "experiment-log", "annotated-bibliography",
    "conference-talk", "data-analysis-log", "thesis-chapter",
    "soap-note", "birp-note", "dap-note", "supervision-prep",
    "reflective-practice", "intake-first-session", "safety-plan",
    "treatment-plan", "risk-assessment", "termination-summary",
    "group-session", "behavioral-chain", "cognitive-distortion-log",
    "case-formulation",
    "meeting", "project-brief", "one-on-one", "decision-log",
    "postmortem", "customer-interview", "retrospective", "brag-doc",
    "standup", "status-report",
    "book", "cornell-notes", "lecture-summary", "concept-map",
    "reading-log", "tutorial-walkthrough",
    "story-idea", "character-sheet", "scene-beat", "poem-draft",
    "critique-notes", "submission-tracker",
    "recipe", "vacation", "doctor-visit", "symptom-journal",
    "medication-tracker", "workout-log", "habit-streak",
    "ten-ten-ten", "wrap-framework", "pre-mortem", "weighted-pros-cons",
    "eisenhower-matrix", "five-whys",
    "examen", "lectio-divina", "loving-kindness",
  ]);

  const KIT_STYLE: Record<string, { glyph: string; bg: string; stroke: string }> = {
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
    "paper-card":             { glyph: "📄", bg: "#E4DCC2", stroke: "#7A6A3E" },
    "lit-review-summary":     { glyph: "🗂", bg: "#D8E0D2", stroke: "#4F6A47" },
    "methodology-card":       { glyph: "🧪", bg: "#D2DCDF", stroke: "#436370" },
    "hypothesis-card":        { glyph: "🔬", bg: "#D5DAE0", stroke: "#46546A" },
    "experiment-log":         { glyph: "⚗", bg: "#D2D9DC", stroke: "#475F66" },
    "annotated-bibliography": { glyph: "📚", bg: "#E0D6BD", stroke: "#75603A" },
    "conference-talk":        { glyph: "🎤", bg: "#DBD2DC", stroke: "#5F4566" },
    "data-analysis-log":      { glyph: "📈", bg: "#D2DDD3", stroke: "#3E5A45" },
    "thesis-chapter":         { glyph: "📘", bg: "#D5DCE3", stroke: "#43526A" },
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
    "book":                  { glyph: "📕", bg: "#E1D7C4", stroke: "#7A5F35" },
    "cornell-notes":         { glyph: "🗒", bg: "#E0DCC9", stroke: "#75603A" },
    "lecture-summary":       { glyph: "🎓", bg: "#D8DEE6", stroke: "#46546A" },
    "concept-map":           { glyph: "🕸", bg: "#DDD9DE", stroke: "#54486A" },
    "reading-log":           { glyph: "📖", bg: "#E0D6BF", stroke: "#75603A" },
    "tutorial-walkthrough":  { glyph: "🪛", bg: "#D9DCDA", stroke: "#52584C" },
    "story-idea":          { glyph: "✨", bg: "#EBDDB8", stroke: "#7A6235" },
    "character-sheet":     { glyph: "🎭", bg: "#E0D6E0", stroke: "#5C4670" },
    "scene-beat":          { glyph: "🎬", bg: "#DCD6DC", stroke: "#54486A" },
    "poem-draft":          { glyph: "🪶", bg: "#EFE4C9", stroke: "#7A5F2C" },
    "critique-notes":      { glyph: "🔍", bg: "#DCDDD0", stroke: "#5A5738" },
    "submission-tracker":  { glyph: "✉", bg: "#DAD9D2", stroke: "#54533F" },
    "recipe":              { glyph: "🍲", bg: "#EDD6BE", stroke: "#76513A" },
    "vacation":            { glyph: "🧳", bg: "#D2DDD7", stroke: "#3E5A45" },
    "doctor-visit":        { glyph: "🩺", bg: "#D9DEE2", stroke: "#465468" },
    "symptom-journal":     { glyph: "🌡", bg: "#E5D6CF", stroke: "#75463A" },
    "medication-tracker":  { glyph: "💊", bg: "#DDD3DE", stroke: "#5C476A" },
    "workout-log":         { glyph: "🏃", bg: "#D8DDD3", stroke: "#4A5740" },
    "habit-streak":        { glyph: "✓", bg: "#E5DCBA", stroke: "#75653A" },
    "ten-ten-ten":         { glyph: "⏳", bg: "#E0D6BF", stroke: "#75603A" },
    "wrap-framework":      { glyph: "🧠", bg: "#DCD6E0", stroke: "#54486B" },
    "pre-mortem":          { glyph: "🪦", bg: "#D7DBDF", stroke: "#465367" },
    "weighted-pros-cons":  { glyph: "⚖", bg: "#DDD9C7", stroke: "#5F5638" },
    "eisenhower-matrix":   { glyph: "🎯", bg: "#E5D6CF", stroke: "#75463A" },
    "five-whys":           { glyph: "❓", bg: "#E5D8E2", stroke: "#74548A" },
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
    "morning-three": "Three lines, before anything else.",
    "today-kindly": "Five small things that went well today.",
    "dear-self": "A letter you don't have to send.",
    "long-exhale": "Before the day closes — what happened, what didn't.",
    "sleep-ledger": "Kept by the bed. Two lines.",
    "gratitude-three": "Three good things, with a 'why' line each.",
    "dream-journal": "Caught quickly, before it fades.",
    "mood-energy": "A 1-10 number + one sentence.",
    "letter-future-self": "Sealed today, opened later.",
    "anxiety-unspooler": "Worry → evidence → next concrete step.",
    "annual-review": "What mattered, what changed, what carries forward.",
    "grief-checkin": "No fix. Just a place to put it.",
    "daily": "Yesterday → today → questions, in one shape.",
    "morning-pages": "Three pages, unedited. No stopping.",
    "paper-card": "One note per paper. Citation, methodology, your critique.",
    "lit-review-summary": "Themes, disagreements, the gap you're filling.",
    "methodology-card": "Design, sample, instruments, analysis plan.",
    "hypothesis-card": "H₀ / H₁, predicted effect, falsifier.",
    "experiment-log": "What you ran, what you saw, what surprised.",
    "annotated-bibliography": "Slimmer than paper-card — for skim reads.",
    "conference-talk": "Speaker → claim → evidence → your pushback.",
    "data-analysis-log": "Question, query, output, what it changes.",
    "thesis-chapter": "Argument arc + section headings + figures.",
    "soap-note": "Subjective · Objective · Assessment · Plan. Private.",
    "birp-note": "Behavior · Intervention · Response · Plan. Private.",
    "dap-note": "Data · Assessment · Plan. Private.",
    "supervision-prep": "What you want help thinking through this week.",
    "reflective-practice": "The moment that pulled you. Just for you.",
    "intake-first-session": "Presenting concern, history, MSE, risk, plan.",
    "safety-plan": "Stanley-Brown shape. Co-developed with the client.",
    "treatment-plan": "Goals, objectives, interventions, review date.",
    "risk-assessment": "Structured screen at the moment of concern.",
    "termination-summary": "Gains, what's next, door-still-open language.",
    "group-session": "Attendance, theme, members by initial.",
    "behavioral-chain": "DBT-style chain analysis of a behaviour.",
    "cognitive-distortion-log": "Client homework: situation → thought → reframe.",
    "case-formulation": "5 P's: predisposing, precipitating, perpetuating, protective.",
    "meeting": "Agenda, decisions, action items.",
    "project-brief": "Why, success, scope, milestones.",
    "one-on-one": "Wins, blockers, asks, things to thank for.",
    "decision-log": "ADR-style. Context, options, decision, consequences.",
    "postmortem": "Timeline, contributing factors, action items.",
    "customer-interview": "Pains, asks, what they'd pay for, surprises.",
    "retrospective": "Keep · drop · try.",
    "brag-doc": "A running list of impact, dated.",
    "standup": "Yesterday · today · blockers.",
    "status-report": "🟢/🟡/🔴 plus what shipped, what's next.",
    "book": "Quotes, key ideas, what to tell a friend.",
    "cornell-notes": "Cue · notes · summary three-pane.",
    "lecture-summary": "Claim → evidence → your questions.",
    "concept-map": "Central idea + 5–8 spokes.",
    "reading-log": "What you read, one-sentence takeaway.",
    "tutorial-walkthrough": "Steps + where you got stuck.",
    "story-idea": "Premise · protagonist · tension · why now.",
    "character-sheet": "Wants · needs · lies · wound · arc · voice.",
    "scene-beat": "POV · goal · obstacle · turn · out.",
    "poem-draft": "A blank page with no scaffolding.",
    "critique-notes": "What worked, what didn't land, where you lost interest.",
    "submission-tracker": "Venue, date, response, next step.",
    "recipe": "Ingredients, method, notes from last time.",
    "vacation": "Shape, bookings, packing, things to do.",
    "doctor-visit": "Pre-Qs, what was said, next steps.",
    "symptom-journal": "Severity 1-10, triggers, what helped.",
    "medication-tracker": "Dose, schedule, side effects.",
    "workout-log": "Session, lifts, how it felt.",
    "habit-streak": "Daily check-in for one habit at a time.",
    "ten-ten-ten": "10 minutes / 10 months / 10 years.",
    "wrap-framework": "Widen · Reality-test · Attain distance · Prepare to be wrong.",
    "pre-mortem": "Assume it failed. Tell the story.",
    "weighted-pros-cons": "Honest weights matter more than honest items.",
    "eisenhower-matrix": "Urgent × Important quadrants.",
    "five-whys": "Root-cause chain, no skipping links.",
    "examen": "Ignatian nightly review — five gentle movements.",
    "lectio-divina": "Read · respond · rest, with a passage.",
    "loving-kindness": "Self · loved one · neutral · difficult · all beings.",
  };

  const KIND_LABEL_KEY: Record<string, StringKey> = {
    journal: "modals.kits.kindJournal",
    research: "modals.kits.kindResearch",
    clinical: "modals.kits.kindClinical",
    work: "modals.kits.kindWork",
    learning: "modals.kits.kindLearning",
    writing: "modals.kits.kindWriting",
    everyday: "modals.kits.kindEveryday",
    decision: "modals.kits.kindDecision",
    spiritual: "modals.kits.kindSpiritual",
  };

  const KIND_BLURB_KEY: Record<string, StringKey> = {
    journal: "modals.kits.blurbJournal",
    research: "modals.kits.blurbResearch",
    clinical: "modals.kits.blurbClinical",
    work: "modals.kits.blurbWork",
    learning: "modals.kits.blurbLearning",
    writing: "modals.kits.blurbWriting",
    everyday: "modals.kits.blurbEveryday",
    decision: "modals.kits.blurbDecision",
    spiritual: "modals.kits.blurbSpiritual",
  };

  const KIND_ORDER = [
    "journal", "research", "clinical", "work", "learning",
    "writing", "everyday", "decision", "spiritual",
  ] as const;

  function titleCase(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function defaultTitleFor(k: TemplateInfo): string {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    return `${k.label} — ${iso}`;
  }

  let grouped = $derived.by(() => {
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
      blurb: KIND_BLURB_KEY[kind]
        ? t(KIND_BLURB_KEY[kind])
        : t("modals.kits.fallbackBlurb"),
      kits: byKind.get(kind)!.sort((a, b) => a.label.localeCompare(b.label)),
    }));
  });

  let totalKits = $derived(grouped.reduce((acc, g) => acc + g.kits.length, 0));

  let pendingKit = $derived(
    pending ? templates.find((k) => k.name === pending) ?? null : null,
  );

  function commitPending() {
    const tt = title.trim();
    if (tt && pending) onPick(pending, tt);
  }
</script>

{#if open}
  {#if pending}
    <Modal
      open
      {onClose}
      title={pendingKit
        ? t("modals.kits.startTitle", { label: pendingKit.label })
        : t("modals.kits.startFallbackTitle")}
    >
      {#snippet children()}
        <p class="text-xs text-t2 mb-3 leading-relaxed">
          {t("modals.kits.startBody")}
        </p>
        <input
          bind:this={titleInputEl}
          bind:value={title}
          onkeydown={(e) => {
            if (e.key === "Enter") commitPending();
            else if (e.key === "Escape") pending = null;
          }}
          placeholder={pendingKit ? defaultTitleFor(pendingKit) : ""}
          class="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button
            class="px-3 py-1.5 text-sm text-t2 hover:text-char"
            onclick={() => { pending = null; }}
          >
            {t("modals.kits.back")}
          </button>
          <button
            class="btn-yel px-3 py-1.5 text-sm rounded-md"
            disabled={!title.trim()}
            onclick={commitPending}
          >
            {t("modals.kits.create")}
          </button>
        </div>
      {/snippet}
    </Modal>
  {:else}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-char/30 animate-fadeIn"
      onmousedown={onClose}
      role="presentation"
    >
      <div
        class="w-[920px] max-w-[94vw] max-h-[88vh] bg-bg border border-bd2 rounded-xl shadow-2xl overflow-hidden animate-slideUp flex flex-col"
        onmousedown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        <div class="shrink-0 px-6 py-5 border-b border-bd">
          <div class="font-serif text-2xl text-char">
            {t("modals.kits.title")}
          </div>
          <div class="font-serif italic text-sm text-t2 mt-1">
            {#if totalKits === 1 && grouped.length === 1}
              {t("modals.kits.subtitleOne", { kits: String(totalKits), cats: String(grouped.length) })}
            {:else if totalKits !== 1 && grouped.length === 1}
              {t("modals.kits.subtitleManyKits", { kits: String(totalKits), cats: String(grouped.length) })}
            {:else if totalKits === 1 && grouped.length !== 1}
              {t("modals.kits.subtitleManyCats", { kits: String(totalKits), cats: String(grouped.length) })}
            {:else}
              {t("modals.kits.subtitleMany", { kits: String(totalKits), cats: String(grouped.length) })}
            {/if}
          </div>
          <div class="mt-3">
            <input
              bind:this={searchRef}
              type="text"
              bind:value={search}
              onkeydown={(e) => {
                if (e.key === "Escape" && search) {
                  e.stopPropagation();
                  search = "";
                }
              }}
              placeholder={t("modals.kits.searchPlaceholder")}
              class="w-full px-3.5 py-2 bg-bg border border-bd rounded-full text-sm text-char placeholder:text-t3 focus:outline-hidden focus:border-bd2 transition"
            />
          </div>
          {#if grouped.length > 1}
            <div class="mt-3 flex items-center gap-1.5 flex-wrap text-2xs">
              {#each grouped as group (group.kind)}
                <button
                  type="button"
                  onclick={() => {
                    const el = document.getElementById(
                      `yarrow-kit-section-${group.kind}`,
                    );
                    if (el)
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                  }}
                  class="px-2.5 py-0.5 rounded-full bg-s1 text-t2 hover:bg-yelp hover:text-yeld border border-bd transition"
                  title={group.blurb}
                >
                  {group.label}
                  <span class="text-t3 ml-1">{group.kits.length}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-6">
          {#if grouped.length === 0}
            <EmptyState
              kind="checkpoints"
              title={search
                ? t("modals.kits.noMatchTitle", { query: search })
                : t("modals.kits.noKitsTitle")}
              hint={search
                ? t("modals.kits.noMatchHint")
                : t("modals.kits.noKitsHint")}
            />
          {:else}
            <div class="space-y-8">
              {#each grouped as group (group.kind)}
                <section
                  id="yarrow-kit-section-{group.kind}"
                  class="scroll-mt-2"
                >
                  <div class="mb-3">
                    <div class="font-serif text-lg text-char tracking-tight">
                      {group.label}
                    </div>
                    <div class="font-serif italic text-sm text-t2 mt-0.5 max-w-prose leading-relaxed">
                      {group.blurb}
                    </div>
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    {#each group.kits as k (k.name)}
                      {@const s =
                        KIT_STYLE[k.name] ||
                        KIND_FALLBACK_STYLE[group.kind] ||
                        FALLBACK_STYLE}
                      {@const blurb =
                        KIT_BLURB[k.name] ?? t("modals.kits.kitFallbackBlurb")}
                      <button
                        onclick={() => {
                          pending = k.name;
                          title = defaultTitleFor(k);
                        }}
                        title="{k.label} · {blurb}"
                        class="group text-left bg-bg border border-bd rounded-xl p-3 hover:border-yel hover:bg-yelp/40 transition"
                      >
                        <div
                          class="w-9 h-9 rounded-lg mb-2 flex items-center justify-center text-[18px]"
                          style:background={s.bg}
                          style:color={s.stroke}
                          style:border="1px solid {s.stroke}"
                        >
                          {#if KITS_WITH_DOODLES.has(k.name)}
                            <span
                              aria-hidden="true"
                              style:display="inline-block"
                              style:width="22px"
                              style:height="22px"
                              style:background-color={s.stroke}
                              style:-webkit-mask-image="url(/kits/{k.name}.svg)"
                              style:mask-image="url(/kits/{k.name}.svg)"
                              style:-webkit-mask-repeat="no-repeat"
                              style:mask-repeat="no-repeat"
                              style:-webkit-mask-position="center"
                              style:mask-position="center"
                              style:-webkit-mask-size="contain"
                              style:mask-size="contain"
                            ></span>
                          {:else}
                            {s.glyph}
                          {/if}
                        </div>
                        <div class="font-serif text-[14.5px] text-char leading-tight truncate">
                          {k.label}
                        </div>
                        <div class="text-2xs text-t2 mt-1 leading-relaxed line-clamp-2">
                          {blurb}
                        </div>
                      </button>
                    {/each}
                  </div>
                </section>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}
