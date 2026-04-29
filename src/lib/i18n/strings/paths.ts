// Paths surfaces — PathsPane, ConditionEditor, ForkingRoad,
// DecisionMatrix, PathDiff, PathCompare, ConflictResolver, ForkMoment,
// PathDetail, PathsEmptyState, InlineDiffPane, CompareDiff.
//
// Yarrow vocabulary is product-specific. All git-flavoured words
// (branch / commit / merge / fork / diverge) are forbidden in
// user-facing copy — the equivalent Yarrow vocabulary is `path`,
// `checkpoint`, `bring together`, "open another scenario", "took a
// different turn." See scripts/vocab-lint.mjs for enforcement.

export const pathsEN = {
  // ── PathsPane (header / shell) ──────────────────────────────────────
  "paths.pane.title": "Scenarios",
  "paths.pane.viewGraph": "Graph",
  "paths.pane.viewCards": "Cards",
  "paths.pane.viewGraphTitle": "Show the scenario tree (default)",
  "paths.pane.viewCardsTitle": "Show scenarios as a flat list of cards",
  "paths.pane.viewToggleAria": "Switch scenario view",
  "paths.pane.subtitle": "Collections of notes, opening off {root}.",
  "paths.pane.backToRoot": "← Back to {root}",
  "paths.pane.backToRootTitle": "Go back to {root} — the trunk of your thinking",
  "paths.pane.newPathFromRoot": "New scenario from {root}",
  "paths.pane.newPathFromRootTitle": "Open a new 'if…' from {root}",
  "paths.pane.suggestedCount": "{count} suggested",
  "paths.pane.suggestedTitle": "Notes that cluster together but aren't yet a scenario",
  "paths.pane.decisionMatrix": "Decision matrix",
  "paths.pane.decisionMatrixTitle": "Star must-have notes; see at a glance which scenario satisfies them",
  "paths.pane.helpTitle": "How to read this",
  "paths.pane.closeTitle": "Close",
  "paths.pane.suggestedHeading": "Suggested scenarios",
  "paths.pane.suggestedHelp": "notes that cluster together — a scenario candidate you haven't made yet",
  "paths.pane.suggestionEdges": "{count} notes · {edges} connections",
  "paths.pane.suggestionMore": "+{count} more",
  "paths.pane.createPath": "Create scenario",
  "paths.pane.dismiss": "dismiss",
  "paths.pane.showDismissed": "Show {count} dismissed",
  "paths.pane.hideDismissed": "Hide {count} dismissed",
  "paths.pane.showDismissedTitle": "Review suggestions you've passed on",
  "paths.pane.dismissedHeading": "Dismissed earlier",
  "paths.pane.bringBackSuggestion": "bring back",
  "paths.pane.showMoreSuggestions": "+{count} more",
  "paths.pane.showFewerSuggestions": "show fewer",
  "paths.pane.showMoreSuggestionsTitle": "Show more candidate scenarios",
  "paths.pane.footerDrag": "drag to move · scroll to zoom",
  "paths.pane.footerClick": "click a scenario to see what's in it",
  "paths.pane.footerBranch": "+ to open a scenario · ★ marks each scenario's main note",
  "paths.pane.helpTitleHeading": "How scenarios work now",
  "paths.pane.helpIntro":
    "Scenarios are named collections of notes that open off a designated root. Notes are shared — one note can live in many scenarios. Selecting a scenario here doesn't change what you can read elsewhere.",
  "paths.pane.helpRootStrong": "The root",
  "paths.pane.helpRootBody":
    "is the trunk — labeled {root}. Every other scenario descends from it.",
  "paths.pane.helpSelectStrong": "Selecting a node",
  "paths.pane.helpSelectBody":
    "highlights its ancestry and everything that opens off it, and opens the detail panel on the right.",
  "paths.pane.helpDetailStrong": "In the detail panel",
  "paths.pane.helpDetailBody":
    "toggle which notes are in this scenario, mark one as the scenario's main note (★), and spin any member note off into its own child scenario.",
  "paths.pane.helpMapStrong": "The map button",
  "paths.pane.helpMapBody":
    "opens the connection graph filtered to this scenario's notes — perfect for \"what does this scenario actually hold together?\"",
  "paths.pane.helpPlusStrong": "The + button",
  "paths.pane.helpPlusBody":
    "on any node starts a child scenario. Type the if…, press Enter.",
  "paths.pane.helpDone": "got it",
  "paths.pane.renamePrompt": "Rename scenario \"{name}\" to:",
  "paths.pane.deleteConfirm":
    "Delete scenario \"{name}\"? Its notes stay — only the collection is removed. Children will reattach to its parent.",

  // ── PromoteConfirm modal ────────────────────────────────────────────
  "paths.promote.bringBack": "Bring",
  "paths.promote.promote": "Promote",
  "paths.promote.bringBackSuffix": "back as main?",
  "paths.promote.promoteSuffix": "to main?",
  "paths.promote.lead": "This is a structural change. Read before you type.",
  "paths.promote.bringBackTrunkStrong": "{name} returns as the trunk.",
  "paths.promote.bringBackTrunkBody":
    "Its era's peers — the scenarios ghosted alongside it — come back live as its siblings, preserving the shape they had before.",
  "paths.promote.bringBackOldStrong": "The current main, {root}, moves to the ghost zone.",
  "paths.promote.bringBackOldBody":
    "Any siblings of the current main go with it, so you can bring them back the same way later.",
  "paths.promote.promoteTrunkStrong": "{name} becomes the trunk.",
  "paths.promote.promoteTrunkBody":
    "The current main {root} and its sibling scenarios move to the ghost zone — preserved as history, rendered faded to the left of the new main.",
  "paths.promote.promoteRelStrong": "The relationships stay intact.",
  "paths.promote.promoteRelBody":
    "Ghost peers keep the shape of their era. Promoting any ghost back to main revives that whole era.",
  "paths.promote.notesStayStrong": "Your notes don't move.",
  "paths.promote.notesStayBody":
    "Nothing is deleted, nothing is renamed on disk — only the scenario tree's anchor shifts.",
  "paths.promote.reversibleStrong": "Reversible.",
  "paths.promote.reversibleBody": "Any ghost scenario can be promoted back later.",
  "paths.promote.typeToConfirm": "Type {phrase} to confirm",
  "paths.promote.cancel": "cancel",
  "paths.promote.confirm": "Promote to main",

  // ── ConditionEditor ─────────────────────────────────────────────────
  "paths.condition.kicker": "name this scenario",
  "paths.condition.heading": "What question is {name} asking?",
  "paths.condition.lead":
    "Start with If… or What if… — the condition that made you step off the main road. This is how future-you will recognize it.",
  "paths.condition.placeholder": "If the Seattle job comes through…",
  "paths.condition.preset1": "If it rains on the day",
  "paths.condition.preset2": "If I get the job",
  "paths.condition.preset3": "If the project is denied",
  "paths.condition.preset4": "If we stay put",
  "paths.condition.preset5": "If I quit",
  "paths.condition.cancel": "cancel",
  "paths.condition.clear": "clear",
  "paths.condition.clearTitle": "Remove this condition",
  "paths.condition.save": "save question",
  // Create-mode copy: same modal, used when opening a new scenario
  // off a parent. Branch name in the heading is the *parent*, not
  // the new scenario (which doesn't exist yet).
  "paths.condition.createKicker": "open a new scenario",
  "paths.condition.createHeading": "What's the “if…” opening off {name}?",
  "paths.condition.createLead":
    "Start with If… or What if… — the condition that made you step off this scenario. The scenario's short name is derived from what you write.",
  "paths.condition.createSave": "open scenario",

  // ── PathsEmptyState ─────────────────────────────────────────────────
  "paths.empty.started": "STARTED",
  "paths.empty.today": "TODAY",
  "paths.empty.heading": "Your map is a single road right now.",
  "paths.empty.body":
    "A scenario is a parallel version of your thinking — what you'd write if something were different. What's the first one you want to try on?",
  "paths.empty.preset1": "If it rains on the day",
  "paths.empty.preset2": "If the project is denied",
  "paths.empty.preset3": "If I quit to write",
  "paths.empty.preset4": "If we stay put",
  "paths.empty.start": "Start this scenario",
  "paths.empty.safe": "The version you have now stays safely on {name}.",

  // ── ForkingRoad (canvas controls + cards) ───────────────────────────
  "paths.road.loading": "Loading scenarios…",
  "paths.road.modeInk": "ink",
  "paths.road.modeInkTitle": "Tapered ink — full cards, filled ribbon connectors",
  "paths.road.modeRibbon": "ribbon",
  "paths.road.modeRibbonTitle":
    "Gradient ribbon — thin strokes that blend parent colour into child, compact pill nodes",
  "paths.road.fit": "fit",
  "paths.road.signpostName": "+ name this turn",
  "paths.road.cardMain": "MAIN",
  "paths.road.cardYouAreHere": "YOU ARE HERE",
  "paths.road.cardWasMain": "WAS MAIN",
  "paths.road.youAreHereTooltip": "you are here",
  "paths.road.cardCreated": "{count} note · created {when}",
  "paths.road.cardCreatedPlural": "{count} notes · created {when}",
  "paths.road.cardGhostMeta": "{count} note · ghost · {when}",
  "paths.road.cardGhostMetaPlural": "{count} notes · ghost · {when}",
  "paths.road.diffTooltip":
    "If you switch to \"{name}\" from your current scenario: {gained} {gainedNoteWord} added, {lost} removed.",
  "paths.road.diffNoteWord": "note",
  "paths.road.diffNoteWordPlural": "notes",
  "paths.road.gainedTooltipOne":
    "+{count} note in this scenario that's not in yours",
  "paths.road.gainedTooltipMany":
    "+{count} notes in this scenario that aren't in yours",
  "paths.road.lostTooltipOne":
    "−{count} note in your scenario that's not in this one",
  "paths.road.lostTooltipMany":
    "−{count} notes in your scenario that aren't in this one",
  "paths.road.pendingPlaceholder": "If the Seattle job comes through…",
  "paths.road.pendingHelp": "Enter to open a scenario off {parent}, Esc to cancel.",
  "paths.road.popoverCurrent": "current scenario",
  "paths.road.popoverPreview": "scenario preview",
  "paths.road.popoverNote": "{count} note",
  "paths.road.popoverNotePlural": "{count} notes",
  "paths.road.popoverGained": "+{count} gained",
  "paths.road.popoverLost": "−{count} lost",
  "paths.road.popoverInPath": "In this scenario",
  "paths.road.popoverMore": "… and {count} more",
  "paths.road.popoverHint": "click for full detail",

  // ── PathDetail ──────────────────────────────────────────────────────
  "paths.detail.ghostHeader": "Ghost scenario · opened from {parent}",
  "paths.detail.ghostHeaderUnknown": "—",
  "paths.detail.mainHeader": "★ Main · the trunk",
  "paths.detail.sideHeader": "Side scenario · opened from {parent}",
  "paths.detail.closeAria": "Close detail",
  "paths.detail.closeTitle": "Close (Esc)",
  "paths.detail.rename": "rename",
  "paths.detail.renameTitle": "Rename this scenario",
  "paths.detail.editConditionTitle":
    "Click to edit the question this scenario is asking",
  "paths.detail.namePrompt": "+ Name this scenario — what 'if…' is it asking?",
  "paths.detail.notesCountOne": "{count} note",
  "paths.detail.notesCountMany": "{count} notes",
  "paths.detail.created": "created {when}",
  "paths.detail.openMap": "Open the map for this scenario",
  "paths.detail.openMapTitle":
    "Show the connection graph filtered to this scenario's notes",
  "paths.detail.diffHeading": "If you take this scenario",
  "paths.detail.diffVs": "vs {name}",
  "paths.detail.diffFlat": "flat list",
  "paths.detail.diffGroup": "group by tag",
  "paths.detail.diffGroupTitle": "Cluster the lists by their tags",
  "paths.detail.diffGain": "you'd gain",
  "paths.detail.diffEdited": "present on both, but edited differently",
  "paths.detail.diffLose": "you'd leave behind",
  "paths.detail.diffLoseTitle": "Not on {name} — open to inspect",
  "paths.detail.diffChecking": "checking for differing edits…",
  "paths.detail.diffMore": "… and {count} more",
  "paths.detail.diffUntagged": "untagged",
  "paths.detail.inThisPath": "In this scenario",
  "paths.detail.adding": "done",
  "paths.detail.add": "+ add note",
  "paths.detail.emptyMembers": "No notes on this scenario yet. Use \"+ add note\".",
  "paths.detail.openTitle": "Open this note",
  "paths.detail.mainNoteTitle": "Main note for this scenario",
  "paths.detail.markMain": "mark main",
  "paths.detail.markMainTitle": "Designate this as the main note for this scenario",
  "paths.detail.branch": "spin off",
  "paths.detail.branchTitle": "Turn this note into a new child scenario",
  "paths.detail.remove": "remove",
  "paths.detail.removeTitle":
    "Remove this note from this scenario (doesn't delete the note)",
  "paths.detail.filterPlaceholder": "filter notes…",
  "paths.detail.filterEmpty": "No notes match. Every note is already on this scenario.",
  "paths.detail.filterCount": "{count} not on this scenario",
  "paths.detail.bringBack": "★ Bring back as main…",
  "paths.detail.promote": "★ Promote to main…",
  "paths.detail.promoteTitleGhost":
    "Bring {name} back as the workspace's main scenario",
  "paths.detail.promoteTitle": "Make {name} the workspace's main scenario",
  "paths.detail.deletePath": "Delete this scenario",
  "paths.detail.deletePathTitle": "Remove this scenario (doesn't delete any notes)",
  "paths.detail.trunkNote":
    "This is the trunk. Every other scenario opens off this one.",
  "paths.detail.ghostNote": "Historical · promote to bring this era back.",
  "paths.detail.autoTagAdd": "+ auto-include notes by tag",
  "paths.detail.autoTagAddTitle":
    "Auto-add every note tagged with a given value to this scenario",
  "paths.detail.autoIncludes": "auto-includes",
  "paths.detail.autoMatchOne": "· {count} note match",
  "paths.detail.autoMatchMany": "· {count} notes match",
  "paths.detail.change": "change",
  "paths.detail.clear": "clear",
  "paths.detail.autoLead": "auto-include notes tagged",
  "paths.detail.autoTagPlaceholder": "tag name",
  "paths.detail.autoSave": "save",
  "paths.detail.autoCancel": "cancel",
  "paths.detail.accent": "accent",
  "paths.detail.accentClearTitle": "Clear accent — use the default palette hue",
  "paths.detail.accentSetAria": "Set accent to {value}",
  "paths.detail.accentCustomTitle": "Pick a custom color",

  // ── DecisionMatrix ──────────────────────────────────────────────────
  "paths.matrix.title": "Decision matrix",
  "paths.matrix.subtitle":
    "Star the notes you can't live without, then read each scenario's column to see who satisfies the most.",
  "paths.matrix.bestMatch":
    "Best match: {names} — {hits} of {total} must-haves",
  "paths.matrix.bestMatchTie":
    "Tied at {hits} of {total} must-haves: {names}",
  "paths.matrix.noStars":
    "Star a few must-have notes above to see which scenario covers the most of them.",
  "paths.matrix.filterPlaceholder": "filter notes…",
  "paths.matrix.onlyStars": "Only ★ rows",
  "paths.matrix.tagsLabel": "tags:",
  "paths.matrix.allTags": "all",
  "paths.matrix.colHeader": "Note",
  "paths.matrix.colSortTitle":
    "{name} — click to sort rows by membership · click again to flip · click again to clear",
  "paths.matrix.empty": "No notes match.",
  "paths.matrix.starOn": "Unstar (no longer must-have)",
  "paths.matrix.starOff": "Mark as must-have",
  "paths.matrix.legend":
    "✓ note is on the scenario · ✗ a starred note is missing · ★ marks a must-have row",
  "paths.matrix.close": "Close",
  "paths.matrix.cellPresent": "present",
  "paths.matrix.cellMissing": "missing must-have",
  "paths.matrix.cellAbsent": "not on this scenario",

  // ── PathDiff (legacy compare) ───────────────────────────────────────
  "paths.diff.title": "Compare scenarios",
  "paths.diff.close": "close",
  "paths.diff.loadError": "Could not load: {message}",
  "paths.diff.summary": "{differing} differ · {identical} identical",
  "paths.diff.identical": "These scenarios have identical notes.",
  "paths.diff.notOnPath": "Not on this scenario.",
  "paths.diff.labelCurrent": "current",
  "paths.diff.labelOther": "other",

  // ── PathCompare (modern compare modal) ──────────────────────────────
  "paths.compare.title": "Compare",
  "paths.compare.subtitle":
    "Pick a scenario on each side. By default the list shows only notes that were edited on both scenarios — the show control on the right lets you widen it to include one-sided or identical notes too.",
  // 2.2.0 — Notes-mode strings.
  "paths.compare.subtitleNotes":
    "Pick two notes to see what's different between them. Headings, paragraph reordering, and inline edits all surface in whichever view you prefer.",
  "paths.compare.modeLabel": "Comparison scope",
  "paths.compare.modeNotes": "Notes",
  "paths.compare.modePaths": "Scenarios",
  "paths.compare.modeNotesTitle": "Compare two individual notes",
  "paths.compare.modePathsTitle": "Compare every note across two scenarios",
  "paths.compare.notesLeftCaption": "Left note",
  "paths.compare.notesRightCaption": "Right note",
  "paths.compare.notesPickPrompt": "Pick a note",
  "paths.compare.notesPickPromptTitle": "Pick two different notes to compare",
  "paths.compare.notesSameSelection":
    "Both sides are the same note — pick a different note on one side.",
  "paths.compare.notesSummary": "Comparing “{left}” to “{right}”",
  "paths.compare.notesEmptyWorkspaceTitle": "Not enough notes yet",
  "paths.compare.notesEmptyWorkspaceBody":
    "You need at least two notes in this workspace to compare. Create another and pop back here.",
  "paths.compare.show": "show",
  "paths.compare.subtitleEm": "show",
  "paths.compare.closeTitle": "Close",
  "paths.compare.leftCaption": "The left side",
  "paths.compare.rightCaption": "The right side",
  "paths.compare.swapTitle": "Swap sides",
  "paths.compare.swapAria": "Swap left and right",
  "paths.compare.sameSelection":
    "Both sides are the same scenario — pick a different scenario on one side to see a comparison.",
  "paths.compare.noCondition": "(no condition)",
  "paths.compare.summaryModifiedOne":
    "{count} note with different content",
  "paths.compare.summaryModifiedMany":
    "{count} notes with different content",
  "paths.compare.summaryAdded": "{count} only on {name}",
  "paths.compare.summaryRemoved": "{count} only on {name}",
  "paths.compare.summarySame": "{count} identical",
  "paths.compare.viewLabel": "view",
  "paths.compare.viewSwitchTitle":
    "Switch to the {label} view for modified notes",
  "paths.compare.showChanges": "Changes",
  "paths.compare.showChangesHelp":
    "Only notes with edited content on both sides",
  "paths.compare.showOneSided": "+ only-on-one-side",
  "paths.compare.showOneSidedHelp":
    "Include notes that exist on just one scenario",
  "paths.compare.showIdentical": "+ identical",
  "paths.compare.showIdenticalHelp":
    "Include notes that are the same on both scenarios",
  "paths.compare.errorTitle": "Couldn't compare these scenarios",
  "paths.compare.loading": "Comparing…",
  "paths.compare.pickPrompt": "Pick two scenarios above to compare.",
  "paths.compare.emptyChangedTitle":
    "No notes were edited on both sides.",
  "paths.compare.emptyChangedOneSiders":
    "Every difference between these scenarios is a note that exists on only one of them — nothing was rewritten on both.",
  "paths.compare.emptyChangedIdentical": "The two scenarios are identical.",
  "paths.compare.emptyShowOneSided": "Show one-sided notes ({count})",
  "paths.compare.emptyDiffsTitle": "No differences to show.",
  "paths.compare.emptyDiffsBody":
    "These two scenarios contain the same notes with the same content.",
  "paths.compare.emptyShowIdentical": "Show identical too ({count})",
  "paths.compare.emptyAll": "No notes to display.",
  "paths.compare.statusAdded": "Only on {name}",
  "paths.compare.statusRemoved": "Only on {name}",
  "paths.compare.statusModified": "Different versions",
  "paths.compare.statusSame": "Same on both",
  "paths.compare.rowHide": "▾ hide",
  "paths.compare.rowShow": "▸ show",
  "paths.compare.rowExpandHide": "Hide the details",
  "paths.compare.rowExpandShow": "Show the full content in the selected view",
  "paths.compare.rowSamePreview": "identical on both scenarios",
  "paths.compare.rowOnSide": "on {side}: ",
  "paths.compare.footerHelp":
    "Content for each scenario is what you see when you're editing on that scenario — any scratch edits you've made there show up here.",
  "paths.compare.close": "Close",

  // ── ConflictResolver ────────────────────────────────────────────────
  "paths.conflict.loading": "Loading conflict…",
  "paths.conflict.heading": "Your thinking took a different turn here",
  "paths.conflict.body":
    "You wrote different things about {name} on {currentPath} and {otherPath}. Which version feels right now? Or combine them.",
  "paths.conflict.progress": "{idx} of {total}",
  "paths.conflict.onPath": "On {name}",
  "paths.conflict.subtitleOurs": "your current version",
  "paths.conflict.subtitleTheirs": "version being brought in",
  "paths.conflict.noVersion": "(this scenario has no version)",
  "paths.conflict.useThis": "Use this one",
  "paths.conflict.combinedHeading": "Combined version",
  "paths.conflict.combinedHelp":
    "This is what will be saved — edit freely.",
  "paths.conflict.stop": "Stop and go back",
  "paths.conflict.acceptFinal": "Save — bring together",
  "paths.conflict.acceptNext": "Save this one & continue",
  "paths.conflict.abortTitle": "Stop bringing these scenarios together?",
  "paths.conflict.abortBody":
    "Your in-progress changes for bringing these together will be rolled back. The original contents on each scenario stay exactly as they were.",
  "paths.conflict.abortKeep": "keep going",
  "paths.conflict.abortConfirm": "yes, stop",

  // ── ForkMoment ──────────────────────────────────────────────────────
  "paths.forkMoment.exploring": "exploring",

  // ── InlineDiffPane ──────────────────────────────────────────────────
  "paths.inline.heading": "How this note differs from {main}",
  "paths.inline.youAreOn": "you're on {name}",
  "paths.inline.viewLabel": "view",
  "paths.inline.viewSwitchTitle": "Switch to the {label} view",
  "paths.inline.back": "Back to editing",
  "paths.inline.backTitle": "Stop diffing and go back to editing this note",
  "paths.inline.loadError": "Couldn't load the diff: {message}",
  "paths.inline.loading": "Loading…",
  "paths.inline.noDiffHint":
    "You haven't edited this note on \"{name}\" yet. Click Back to editing — the first keystroke starts a scenario-local copy.",

  // ── CompareDiff (shared diff views) ─────────────────────────────────
  "paths.cmpdiff.viewSummary": "Summary",
  "paths.cmpdiff.viewTrack": "Track changes",
  "paths.cmpdiff.viewSplit": "Side by side",
  "paths.cmpdiff.viewCards": "Paragraph cards",
  "paths.cmpdiff.viewMarginalia": "Marginalia",
  "paths.cmpdiff.bannerAdded":
    "This note is only on {name}. Showing its full content through the selected view.",
  "paths.cmpdiff.bannerRemoved":
    "This note is only on {leftName} — it doesn't exist on {rightName}. Showing what would be lost.",
  "paths.cmpdiff.summaryNoProse": "No prose changed.",
  "paths.cmpdiff.summaryIdentical":
    "The file body on {leftName} and {rightName} is identical.",
  "paths.cmpdiff.statWordsAdded": "words added",
  "paths.cmpdiff.statWordsCut": "words cut",
  "paths.cmpdiff.statParasEdited": "paragraphs edited",
  "paths.cmpdiff.statParasAdded": "paragraphs added",
  "paths.cmpdiff.statParasCut": "paragraphs cut",
  "paths.cmpdiff.statIdentical": "identical",
  "paths.cmpdiff.changeLog": "Change log",
  "paths.cmpdiff.was": "was — {name}",
  "paths.cmpdiff.now": "now — {name}",
  "paths.cmpdiff.newOn": "new on — {name}",
  "paths.cmpdiff.cutWasOn": "cut — was on {name}",
  "paths.cmpdiff.headlineMatch": "{rightName} matches {leftName} exactly.",
  "paths.cmpdiff.headlineEditsOne": "edits {count} paragraph",
  "paths.cmpdiff.headlineEditsMany": "edits {count} paragraphs",
  "paths.cmpdiff.headlineAddsOne": "adds {count} new one",
  "paths.cmpdiff.headlineAddsMany": "adds {count} new ones",
  "paths.cmpdiff.headlineCuts": "cuts {count}",
  "paths.cmpdiff.headlineAnd": "and",
  "paths.cmpdiff.changeAdded":
    "{where} — new paragraph on {name}: \"{text}\"",
  "paths.cmpdiff.changeRemoved":
    "{where} — paragraph cut from {name}: \"{text}\"",
  "paths.cmpdiff.changeEdited":
    "{where} — edited: \"{from}\" → \"{to}\"",
  "paths.cmpdiff.where": "¶{n}",
  "paths.cmpdiff.trackHeader":
    "Reading {rightName} with changes from {leftName}.",
  "paths.cmpdiff.hideDeletions": "hide deletions",
  "paths.cmpdiff.collapseSame": "collapse unchanged paragraphs",
  "paths.cmpdiff.parasDifferOf":
    "{changed} of {total} paragraphs differ",
  "paths.cmpdiff.unchangedRunOne": "— {count} paragraph unchanged —",
  "paths.cmpdiff.unchangedRunMany": "— {count} paragraphs unchanged —",
  "paths.cmpdiff.unchangedDotOne": "· {count} paragraph unchanged ·",
  "paths.cmpdiff.unchangedDotMany": "· {count} paragraphs unchanged ·",
  "paths.cmpdiff.splitWas": "was",
  "paths.cmpdiff.splitNow": "now",
  "paths.cmpdiff.splitAddedTag": "added, side = right",
  "paths.cmpdiff.splitCutTag": "cut, side = left",
  "paths.cmpdiff.splitNoPara": "[no paragraph on this side]",
  "paths.cmpdiff.kindAddedOn": "added on {name}",
  "paths.cmpdiff.kindCutOn": "cut on {name}",
  "paths.cmpdiff.kindEdited": "edited",
  "paths.cmpdiff.cardWhere": "paragraph {n}",
  "paths.cmpdiff.marginAdded": "added",
  "paths.cmpdiff.marginCut": "cut",
  "paths.cmpdiff.marginEdited": "rephrased",
  "paths.cmpdiff.marginAddedBody":
    "new on {rightName} — didn't exist on {leftName}",
  "paths.cmpdiff.marginCutBody": "was on {leftName}: \"{text}\"",
  "paths.cmpdiff.marginEditedBody": "was: \"{text}\"",
  "paths.cmpdiff.marginHeading": "Changes · {name}",
  "paths.cmpdiff.marginEmpty": "No prose changed.",

  // ── Borrow + path-awareness (Phase B/C) ────────────────────────
  // The borrow operation replaces whole-tree merge: pull one
  // paragraph or one whole note from another scenario into the one
  // you're writing on. Source is never advanced.
  "paths.aware.editingOn": "Editing on {path}",
  "paths.aware.alsoExistsOn": "also exists on",
  "paths.aware.differs": "differs",
  "paths.aware.same": "same",
  "paths.aware.peekTitle": "Peek at this note as it exists on {path}",
  "paths.peek.heading": "On {path}",
  "paths.peek.differs": "Differs from your version",
  "paths.peek.same": "Same as your version",
  "paths.peek.borrowAll": "Borrow this whole version",
  "paths.peek.borrowAllTitle": "Replace your version with the one from {path}",
  "paths.peek.openSideBySide": "Compare side-by-side",
  "paths.peek.close": "Close",
  "paths.peek.empty": "This note doesn't exist on {path}.",
  "paths.borrow.confirmAll":
    "Replace your current version with the one from {path}? Your current version stays in history.",
  "paths.borrow.toast": "Borrowed “{title}” from {path}.",
  "paths.borrow.toastSelection": "Borrowed selection from {path}.",
  "paths.borrow.errorLocked":
    "Can't borrow from a locked note. Unlock first.",
  "paths.borrow.errorGeneric": "Couldn't borrow: {error}",

  // ── Archive (Phase E) ──────────────────────────────────────────
  "paths.archive.setAside": "Set this scenario aside",
  "paths.archive.setAsideTitle":
    "Hide this scenario from the active list. You can bring it back any time — nothing is deleted.",
  "paths.archive.bringBack": "Bring this scenario back",
  "paths.archive.bringBackTitle":
    "Restore this scenario to the active list",
  "paths.archive.archivedBadge": "set aside",
  "paths.archive.confirmSet": "Set “{name}” aside? It stays on disk and you can restore it whenever you want.",
  "paths.archive.toastArchived": "Scenario “{name}” set aside.",
  "paths.archive.toastRestored": "Scenario “{name}” restored.",
  "paths.archive.cantArchiveRoot":
    "Can't set the trunk aside — adopt another scenario first.",
} as const;

export type PathsKey = keyof typeof pathsEN;

// Latin American Spanish — neutral usted register, no vosotros, no slang.
export const pathsES: Record<PathsKey, string> = {
  // ── PathsPane ──────────────────────────────────────────────────────
  "paths.pane.title": "Escenarios",
  "paths.pane.viewGraph": "Grafo",
  "paths.pane.viewCards": "Tarjetas",
  "paths.pane.viewGraphTitle": "Mostrar el árbol de escenarios (predeterminado)",
  "paths.pane.viewCardsTitle": "Mostrar escenarios como una lista plana de tarjetas",
  "paths.pane.viewToggleAria": "Cambiar vista de escenarios",
  "paths.pane.subtitle":
    "Colecciones de notas que se ramifican desde {root}.",
  "paths.pane.backToRoot": "← Volver a {root}",
  "paths.pane.backToRootTitle":
    "Volver a {root}: el tronco de tu pensamiento",
  "paths.pane.newPathFromRoot": "Nueva escenario desde {root}",
  "paths.pane.newPathFromRootTitle":
    "Bifurcar un nuevo «si…» desde {root}",
  "paths.pane.suggestedCount": "{count} sugeridas",
  "paths.pane.suggestedTitle":
    "Notas que se agrupan pero todavía no son un escenario",
  "paths.pane.decisionMatrix": "Matriz de decisión",
  "paths.pane.decisionMatrixTitle":
    "Marca con estrella las notas imprescindibles y mira de un vistazo qué escenario las cumple",
  "paths.pane.helpTitle": "Cómo leer esto",
  "paths.pane.closeTitle": "Cerrar",
  "paths.pane.suggestedHeading": "Escenarios sugeridos",
  "paths.pane.suggestedHelp":
    "notas que se agrupan: un escenario candidato que aún no has creado",
  "paths.pane.suggestionEdges": "{count} notas · {edges} conexiones",
  "paths.pane.suggestionMore": "+{count} más",
  "paths.pane.createPath": "Crear escenario",
  "paths.pane.dismiss": "descartar",
  "paths.pane.showDismissed": "Mostrar {count} descartados",
  "paths.pane.hideDismissed": "Ocultar {count} descartados",
  "paths.pane.showDismissedTitle": "Revisar sugerencias que has descartado",
  "paths.pane.dismissedHeading": "Descartados antes",
  "paths.pane.bringBackSuggestion": "recuperar",
  "paths.pane.showMoreSuggestions": "+{count} más",
  "paths.pane.showFewerSuggestions": "mostrar menos",
  "paths.pane.showMoreSuggestionsTitle": "Mostrar más escenarios candidatos",
  "paths.pane.footerDrag": "arrastra para mover · rueda para acercar",
  "paths.pane.footerClick":
    "haz clic en un escenario para ver lo que contiene",
  "paths.pane.footerBranch":
    "+ para bifurcar · ★ marca la nota principal de cada escenario",
  "paths.pane.helpTitleHeading": "Cómo funcionan los escenarios ahora",
  "paths.pane.helpIntro":
    "Los escenarios son colecciones de notas con nombre que se ramifican desde una raíz designada. Las notas se comparten: una misma nota puede vivir en muchos escenarios. Seleccionar un escenario aquí no cambia lo que puedes leer en otros lugares.",
  "paths.pane.helpRootStrong": "La raíz",
  "paths.pane.helpRootBody":
    "es el tronco, etiquetado como {root}. Todos los demás escenarios descienden de él.",
  "paths.pane.helpSelectStrong": "Seleccionar un nodo",
  "paths.pane.helpSelectBody":
    "resalta su línea ascendente y todo lo que se ramifica de él, y abre el panel de detalles a la derecha.",
  "paths.pane.helpDetailStrong": "En el panel de detalles",
  "paths.pane.helpDetailBody":
    "puedes alternar qué notas están en este escenario, marcar una como nota principal del escenario (★) y convertir cualquier nota miembro en su propio escenario hijo.",
  "paths.pane.helpMapStrong": "El botón del mapa",
  "paths.pane.helpMapBody":
    "abre el grafo de conexiones filtrado a las notas de este escenario: ideal para ver «¿qué mantiene unido realmente este escenario?».",
  "paths.pane.helpPlusStrong": "El botón +",
  "paths.pane.helpPlusBody":
    "en cualquier nodo inicia un escenario hijo. Escribe el si…, presiona Intro.",
  "paths.pane.helpDone": "entendido",
  "paths.pane.renamePrompt": "Renombrar el escenario «{name}» a:",
  "paths.pane.deleteConfirm":
    "¿Eliminar el escenario «{name}»? Sus notas se conservan; solo se elimina la colección. Los hijos se reasignan a su escenario padre.",

  // ── PromoteConfirm ─────────────────────────────────────────────────
  "paths.promote.bringBack": "Restaurar",
  "paths.promote.promote": "Promover",
  "paths.promote.bringBackSuffix": "como principal?",
  "paths.promote.promoteSuffix": "como principal?",
  "paths.promote.lead":
    "Este es un cambio estructural. Lee antes de escribir.",
  "paths.promote.bringBackTrunkStrong":
    "{name} regresa como tronco.",
  "paths.promote.bringBackTrunkBody":
    "Los pares de su época —los escenarios convertidos en fantasmas junto a él— vuelven en vivo como sus hermanos, conservando la forma que tenían antes.",
  "paths.promote.bringBackOldStrong":
    "La principal actual, {root}, pasa a la zona fantasma.",
  "paths.promote.bringBackOldBody":
    "Los hermanos de la principal actual la acompañan, así puedes restaurarlos más tarde de la misma forma.",
  "paths.promote.promoteTrunkStrong":
    "{name} se convierte en el tronco.",
  "paths.promote.promoteTrunkBody":
    "La principal actual {root} y sus escenarios hermanos pasan a la zona fantasma: se conservan como historia, dibujados atenuados a la izquierda de la nueva principal.",
  "paths.promote.promoteRelStrong":
    "Las relaciones quedan intactas.",
  "paths.promote.promoteRelBody":
    "Los pares fantasmas conservan la forma de su época. Promover cualquier fantasma de vuelta como principal revive toda esa época.",
  "paths.promote.notesStayStrong": "Tus notas no se mueven.",
  "paths.promote.notesStayBody":
    "No se borra nada, no se renombra nada en disco: solo cambia el ancla del árbol de escenarios.",
  "paths.promote.reversibleStrong": "Reversible.",
  "paths.promote.reversibleBody":
    "Cualquier escenario fantasma puede promoverse de nuevo más adelante.",
  "paths.promote.typeToConfirm": "Escribe {phrase} para confirmar",
  "paths.promote.cancel": "cancelar",
  "paths.promote.confirm": "Promover como principal",

  // ── ConditionEditor ────────────────────────────────────────────────
  "paths.condition.kicker": "nombra este escenario",
  "paths.condition.heading": "¿Qué pregunta plantea {name}?",
  "paths.condition.lead":
    "Empieza con Si… o Qué pasaría si… — la condición que te hizo salir del camino principal. Así te reconocerás a ti mismo en el futuro.",
  "paths.condition.placeholder":
    "Si llega la oferta de Seattle…",
  "paths.condition.preset1": "Si llueve ese día",
  "paths.condition.preset2": "Si me dan el trabajo",
  "paths.condition.preset3": "Si rechazan el proyecto",
  "paths.condition.preset4": "Si nos quedamos",
  "paths.condition.preset5": "Si renuncio",
  "paths.condition.cancel": "cancelar",
  "paths.condition.clear": "borrar",
  "paths.condition.clearTitle": "Quitar esta condición",
  "paths.condition.save": "guardar pregunta",
  "paths.condition.createKicker": "abrir un nuevo escenario",
  "paths.condition.createHeading": "¿Cuál es el «si…» que se abre desde {name}?",
  "paths.condition.createLead":
    "Empieza con Si… o Y si… — la condición que te hizo dar un paso fuera de este camino. El nombre corto del escenario se deriva de lo que escribas.",
  "paths.condition.createSave": "abrir escenario",

  // ── PathsEmptyState ────────────────────────────────────────────────
  "paths.empty.started": "INICIO",
  "paths.empty.today": "HOY",
  "paths.empty.heading":
    "Tu mapa es un solo camino por ahora.",
  "paths.empty.body":
    "Un escenario es una versión paralela de tu pensamiento: lo que escribirías si algo fuera distinto. ¿Cuál es el primero que quieres probar?",
  "paths.empty.preset1": "Si llueve ese día",
  "paths.empty.preset2": "Si rechazan el proyecto",
  "paths.empty.preset3": "Si renuncio para escribir",
  "paths.empty.preset4": "Si nos quedamos",
  "paths.empty.start": "Iniciar este escenario",
  "paths.empty.safe":
    "La versión que tienes ahora se queda a salvo en {name}.",

  // ── ForkingRoad ────────────────────────────────────────────────────
  "paths.road.loading": "Cargando escenarios…",
  "paths.road.modeInk": "tinta",
  "paths.road.modeInkTitle":
    "Tinta cónica: tarjetas completas y conectores tipo cinta rellena",
  "paths.road.modeRibbon": "cinta",
  "paths.road.modeRibbonTitle":
    "Cinta degradada: trazos finos que mezclan el color de la madre con el de la hija; nodos compactos en forma de píldora",
  "paths.road.fit": "ajustar",
  "paths.road.signpostName": "+ nombrar esta bifurcación",
  "paths.road.cardMain": "PRINCIPAL",
  "paths.road.cardYouAreHere": "ESTÁS AQUÍ",
  "paths.road.cardWasMain": "ERA PRINCIPAL",
  "paths.road.youAreHereTooltip": "estás aquí",
  "paths.road.cardCreated": "{count} nota · creada {when}",
  "paths.road.cardCreatedPlural": "{count} notas · creada {when}",
  "paths.road.cardGhostMeta": "{count} nota · fantasma · {when}",
  "paths.road.cardGhostMetaPlural": "{count} notas · fantasma · {when}",
  "paths.road.diffTooltip":
    "Si cambias a «{name}» desde tu escenario actual: {gained} {gainedNoteWord} añadidas, {lost} eliminadas.",
  "paths.road.gainedTooltipOne":
    "+{count} nota en este escenario que no está en el tuyo",
  "paths.road.gainedTooltipMany":
    "+{count} notas en este escenario que no están en el tuyo",
  "paths.road.lostTooltipOne":
    "−{count} nota de tu escenario que no está en este",
  "paths.road.lostTooltipMany":
    "−{count} notas de tu escenario que no están en este",

  "paths.road.diffNoteWord": "nota",
  "paths.road.diffNoteWordPlural": "notas",
  "paths.road.pendingPlaceholder": "Si llega la oferta de Seattle…",
  "paths.road.pendingHelp":
    "Intro para bifurcar desde {parent}, Esc para cancelar.",
  "paths.road.popoverCurrent": "escenario actual",
  "paths.road.popoverPreview": "vista previa del escenario",
  "paths.road.popoverNote": "{count} nota",
  "paths.road.popoverNotePlural": "{count} notas",
  "paths.road.popoverGained": "+{count} añadidas",
  "paths.road.popoverLost": "−{count} perdidas",
  "paths.road.popoverInPath": "En este escenario",
  "paths.road.popoverMore": "… y {count} más",
  "paths.road.popoverHint": "haz clic para ver el detalle completo",

  // ── PathDetail ─────────────────────────────────────────────────────
  "paths.detail.ghostHeader": "Escenario fantasma · ramificado desde {parent}",
  "paths.detail.ghostHeaderUnknown": "—",
  "paths.detail.mainHeader": "★ Principal · el tronco",
  "paths.detail.sideHeader":
    "Escenario lateral · ramificado desde {parent}",
  "paths.detail.closeAria": "Cerrar detalle",
  "paths.detail.closeTitle": "Cerrar (Esc)",
  "paths.detail.rename": "renombrar",
  "paths.detail.renameTitle": "Renombrar este escenario",
  "paths.detail.editConditionTitle":
    "Haz clic para editar la pregunta que plantea este escenario",
  "paths.detail.namePrompt":
    "+ Nombra este escenario — ¿qué «si…» plantea?",
  "paths.detail.notesCountOne": "{count} nota",
  "paths.detail.notesCountMany": "{count} notas",
  "paths.detail.created": "creado {when}",
  "paths.detail.openMap": "Abrir el mapa de este escenario",
  "paths.detail.openMapTitle":
    "Mostrar el grafo de conexiones filtrado a las notas de este escenario",
  "paths.detail.diffHeading": "Si tomas este escenario",
  "paths.detail.diffVs": "frente a {name}",
  "paths.detail.diffFlat": "lista plana",
  "paths.detail.diffGroup": "agrupar por etiqueta",
  "paths.detail.diffGroupTitle": "Agrupar las listas por sus etiquetas",
  "paths.detail.diffGain": "ganarías",
  "paths.detail.diffEdited":
    "presentes en ambas, pero editadas distinto",
  "paths.detail.diffLose": "dejarías atrás",
  "paths.detail.diffLoseTitle": "No está en {name}: ábrela para revisarla",
  "paths.detail.diffChecking": "buscando ediciones divergentes…",
  "paths.detail.diffMore": "… y {count} más",
  "paths.detail.diffUntagged": "sin etiqueta",
  "paths.detail.inThisPath": "En este escenario",
  "paths.detail.adding": "listo",
  "paths.detail.add": "+ añadir nota",
  "paths.detail.emptyMembers":
    "Aún no hay notas en este escenario. Usa «+ añadir nota».",
  "paths.detail.openTitle": "Abrir esta nota",
  "paths.detail.mainNoteTitle": "Nota principal de este escenario",
  "paths.detail.markMain": "marcar principal",
  "paths.detail.markMainTitle":
    "Designarla como nota principal de este escenario",
  "paths.detail.branch": "abrir hijo",
  "paths.detail.branchTitle":
    "Convertir esta nota en un nuevo escenario hijo",
  "paths.detail.remove": "quitar",
  "paths.detail.removeTitle":
    "Quitar esta nota de este escenario (no la elimina)",
  "paths.detail.filterPlaceholder": "filtrar notas…",
  "paths.detail.filterEmpty":
    "Ninguna nota coincide. Todas ya están en este escenario.",
  "paths.detail.filterCount": "{count} fuera de este escenario",
  "paths.detail.bringBack": "★ Restaurar como principal…",
  "paths.detail.promote": "★ Promover como principal…",
  "paths.detail.promoteTitleGhost":
    "Restaurar {name} como escenario principal del espacio de trabajo",
  "paths.detail.promoteTitle":
    "Hacer que {name} sea el escenario principal del espacio de trabajo",
  "paths.detail.deletePath": "Eliminar este escenario",
  "paths.detail.deletePathTitle":
    "Quitar este escenario (no elimina ninguna nota)",
  "paths.detail.trunkNote":
    "Este es el tronco. Todo lo demás se ramifica desde aquí.",
  "paths.detail.ghostNote":
    "Histórica · promuévela para recuperar esta época.",
  "paths.detail.autoTagAdd": "+ incluir notas automáticamente por etiqueta",
  "paths.detail.autoTagAddTitle":
    "Añadir automáticamente a este escenario cada nota con la etiqueta indicada",
  "paths.detail.autoIncludes": "incluye automáticamente",
  "paths.detail.autoMatchOne": "· {count} nota coincide",
  "paths.detail.autoMatchMany": "· {count} notas coinciden",
  "paths.detail.change": "cambiar",
  "paths.detail.clear": "borrar",
  "paths.detail.autoLead":
    "incluir automáticamente notas etiquetadas como",
  "paths.detail.autoTagPlaceholder": "nombre de etiqueta",
  "paths.detail.autoSave": "guardar",
  "paths.detail.autoCancel": "cancelar",
  "paths.detail.accent": "acento",
  "paths.detail.accentClearTitle":
    "Quitar acento — usar el tono de paleta predeterminado",
  "paths.detail.accentSetAria": "Establecer acento en {value}",
  "paths.detail.accentCustomTitle": "Elegir un color personalizado",

  // ── DecisionMatrix ─────────────────────────────────────────────────
  "paths.matrix.bestMatch":
    "Mejor coincidencia: {names} — {hits} de {total} imprescindibles",
  "paths.matrix.bestMatchTie":
    "Empate en {hits} de {total} imprescindibles: {names}",
  "paths.matrix.noStars":
    "Marca con estrella algunas notas imprescindibles arriba para ver qué escenario las cubre más.",
  "paths.matrix.title": "Matriz de decisión",
  "paths.matrix.subtitle":
    "Marca con estrella las notas sin las que no puedes vivir y luego lee la columna de cada escenario para ver cuál cumple más.",
  "paths.matrix.filterPlaceholder": "filtrar notas…",
  "paths.matrix.onlyStars": "Solo filas ★",
  "paths.matrix.tagsLabel": "etiquetas:",
  "paths.matrix.allTags": "todas",
  "paths.matrix.colHeader": "Nota",
  "paths.matrix.colSortTitle":
    "{name}: clic para ordenar las filas por pertenencia · clic de nuevo para invertir · clic otra vez para borrar",
  "paths.matrix.empty": "Ninguna nota coincide.",
  "paths.matrix.starOn":
    "Quitar estrella (ya no es imprescindible)",
  "paths.matrix.starOff": "Marcar como imprescindible",
  "paths.matrix.legend":
    "✓ la nota está en el escenario · ✗ falta una nota con estrella · ★ marca una fila imprescindible",
  "paths.matrix.close": "Cerrar",
  "paths.matrix.cellPresent": "presente",
  "paths.matrix.cellMissing": "imprescindible faltante",
  "paths.matrix.cellAbsent": "no está en este escenario",

  // ── PathDiff (legacy) ──────────────────────────────────────────────
  "paths.diff.title": "Comparar escenarios",
  "paths.diff.close": "cerrar",
  "paths.diff.loadError": "No se pudo cargar: {message}",
  "paths.diff.summary": "{differing} difieren · {identical} idénticas",
  "paths.diff.identical": "Estos escenarios tienen notas idénticas.",
  "paths.diff.notOnPath": "No está en este escenario.",
  "paths.diff.labelCurrent": "actual",
  "paths.diff.labelOther": "otra",

  // ── PathCompare ────────────────────────────────────────────────────
  "paths.compare.title": "Comparar",
  "paths.compare.subtitleNotes":
    "Elige dos notas para ver qué las diferencia. Los cambios en encabezados, el reordenamiento de párrafos y las ediciones en línea aparecen en la vista que prefieras.",
  "paths.compare.modeLabel": "Alcance de la comparación",
  "paths.compare.modeNotes": "Notas",
  "paths.compare.modePaths": "Escenarios",
  "paths.compare.modeNotesTitle": "Comparar dos notas individuales",
  "paths.compare.modePathsTitle": "Comparar todas las notas entre dos escenarios",
  "paths.compare.notesLeftCaption": "Nota izquierda",
  "paths.compare.notesRightCaption": "Nota derecha",
  "paths.compare.notesPickPrompt": "Elige una nota",
  "paths.compare.notesPickPromptTitle": "Elige dos notas distintas para comparar",
  "paths.compare.notesSameSelection":
    "Ambos lados son la misma nota — elige una nota diferente en uno de los lados.",
  "paths.compare.notesSummary": "Comparando «{left}» con «{right}»",
  "paths.compare.notesEmptyWorkspaceTitle": "Aún no hay notas suficientes",
  "paths.compare.notesEmptyWorkspaceBody":
    "Necesitas al menos dos notas en este espacio para comparar. Crea otra y vuelve aquí.",
  "paths.compare.subtitle":
    "Elige un escenario a cada lado. Por defecto, la lista solo muestra notas editadas en ambos escenarios: el control mostrar de la derecha te permite ampliarlo para incluir las notas presentes en un solo lado o las idénticas.",
  "paths.compare.show": "mostrar",
  "paths.compare.subtitleEm": "mostrar",
  "paths.compare.closeTitle": "Cerrar",
  "paths.compare.leftCaption": "El lado izquierdo",
  "paths.compare.rightCaption": "El lado derecho",
  "paths.compare.swapTitle": "Intercambiar lados",
  "paths.compare.swapAria": "Intercambiar izquierdo y derecho",
  "paths.compare.sameSelection":
    "Ambos lados son el mismo escenario — elige un escenario diferente en uno de los lados para ver una comparación.",
  "paths.compare.noCondition": "(sin condición)",
  "paths.compare.summaryModifiedOne":
    "{count} nota con contenido distinto",
  "paths.compare.summaryModifiedMany":
    "{count} notas con contenido distinto",
  "paths.compare.summaryAdded": "{count} solo en {name}",
  "paths.compare.summaryRemoved": "{count} solo en {name}",
  "paths.compare.summarySame": "{count} idénticas",
  "paths.compare.viewLabel": "vista",
  "paths.compare.viewSwitchTitle":
    "Cambiar a la vista {label} para notas modificadas",
  "paths.compare.showChanges": "Cambios",
  "paths.compare.showChangesHelp":
    "Solo notas con contenido editado en ambos lados",
  "paths.compare.showOneSided": "+ solo en un lado",
  "paths.compare.showOneSidedHelp":
    "Incluir notas que solo existen en un escenario",
  "paths.compare.showIdentical": "+ idénticas",
  "paths.compare.showIdenticalHelp":
    "Incluir notas que son iguales en ambos escenarios",
  "paths.compare.errorTitle": "No se pudieron comparar estos escenarios",
  "paths.compare.loading": "Comparando…",
  "paths.compare.pickPrompt":
    "Elige dos escenarios arriba para comparar.",
  "paths.compare.emptyChangedTitle":
    "Ninguna nota fue editada en ambos lados.",
  "paths.compare.emptyChangedOneSiders":
    "Cada diferencia entre estos escenarios es una nota que existe en solo uno de ellos — nada se reescribió en ambos.",
  "paths.compare.emptyChangedIdentical":
    "Los dos escenarios son idénticos.",
  "paths.compare.emptyShowOneSided":
    "Mostrar notas de un solo lado ({count})",
  "paths.compare.emptyDiffsTitle": "No hay diferencias para mostrar.",
  "paths.compare.emptyDiffsBody":
    "Estos dos escenarios contienen las mismas notas con el mismo contenido.",
  "paths.compare.emptyShowIdentical":
    "Mostrar también las idénticas ({count})",
  "paths.compare.emptyAll": "No hay notas que mostrar.",
  "paths.compare.statusAdded": "Solo en {name}",
  "paths.compare.statusRemoved": "Solo en {name}",
  "paths.compare.statusModified": "Versiones distintas",
  "paths.compare.statusSame": "Iguales en ambas",
  "paths.compare.rowHide": "▾ ocultar",
  "paths.compare.rowShow": "▸ mostrar",
  "paths.compare.rowExpandHide": "Ocultar los detalles",
  "paths.compare.rowExpandShow":
    "Mostrar el contenido completo en la vista seleccionada",
  "paths.compare.rowSamePreview": "idénticas en ambos escenarios",
  "paths.compare.rowOnSide": "en {side}: ",
  "paths.compare.footerHelp":
    "El contenido de cada escenario es el que ves cuando editas en él: las ediciones temporales que hayas hecho ahí también aparecen aquí.",
  "paths.compare.close": "Cerrar",

  // ── ConflictResolver ───────────────────────────────────────────────
  "paths.conflict.loading": "Cargando conflicto…",
  "paths.conflict.heading": "Tu pensamiento divergió aquí",
  "paths.conflict.body":
    "Escribiste cosas distintas sobre {name} en {currentPath} y {otherPath}. ¿Cuál versión te parece bien ahora? ¿O las combinas?",
  "paths.conflict.progress": "{idx} de {total}",
  "paths.conflict.onPath": "En {name}",
  "paths.conflict.subtitleOurs": "tu versión actual",
  "paths.conflict.subtitleTheirs": "versión que se está incorporando",
  "paths.conflict.noVersion": "(este escenario no tiene versión)",
  "paths.conflict.useThis": "Usar esta",
  "paths.conflict.combinedHeading": "Versión combinada",
  "paths.conflict.combinedHelp":
    "Esto es lo que se guardará — edítalo libremente.",
  "paths.conflict.stop": "Detener y volver",
  "paths.conflict.acceptFinal": "Guardar — unir escenarios",
  "paths.conflict.acceptNext": "Guardar esta y continuar",
  "paths.conflict.abortTitle": "¿Detener la unión de estos escenarios?",
  "paths.conflict.abortBody":
    "Tus cambios en curso para esta unión se revertirán. El contenido original de cada escenario queda exactamente como estaba.",
  "paths.conflict.abortKeep": "seguir uniendo",
  "paths.conflict.abortConfirm": "sí, detener",

  // ── ForkMoment ─────────────────────────────────────────────────────
  "paths.forkMoment.exploring": "explorando",

  // ── InlineDiffPane ─────────────────────────────────────────────────
  "paths.inline.heading":
    "En qué difiere esta nota respecto a {main}",
  "paths.inline.youAreOn": "estás en {name}",
  "paths.inline.viewLabel": "vista",
  "paths.inline.viewSwitchTitle": "Cambiar a la vista {label}",
  "paths.inline.back": "Volver a editar",
  "paths.inline.backTitle":
    "Dejar de comparar y volver a editar esta nota",
  "paths.inline.loadError":
    "No se pudieron cargar las diferencias: {message}",
  "paths.inline.loading": "Cargando…",
  "paths.inline.noDiffHint":
    "Aún no has editado esta nota en «{name}». Haz clic en Volver a editar — la primera tecla inicia una copia local del escenario.",

  // ── CompareDiff ────────────────────────────────────────────────────
  "paths.cmpdiff.viewSummary": "Resumen",
  "paths.cmpdiff.viewTrack": "Control de cambios",
  "paths.cmpdiff.viewSplit": "Lado a lado",
  "paths.cmpdiff.viewCards": "Tarjetas por párrafo",
  "paths.cmpdiff.viewMarginalia": "Marginalia",
  "paths.cmpdiff.bannerAdded":
    "Esta nota está solo en {name}. Mostrando todo su contenido en la vista seleccionada.",
  "paths.cmpdiff.bannerRemoved":
    "Esta nota está solo en {leftName} — no existe en {rightName}. Mostrando lo que se perdería.",
  "paths.cmpdiff.summaryNoProse": "No cambió ningún texto.",
  "paths.cmpdiff.summaryIdentical":
    "El cuerpo del archivo en {leftName} y {rightName} es idéntico.",
  "paths.cmpdiff.statWordsAdded": "palabras añadidas",
  "paths.cmpdiff.statWordsCut": "palabras quitadas",
  "paths.cmpdiff.statParasEdited": "párrafos editados",
  "paths.cmpdiff.statParasAdded": "párrafos añadidos",
  "paths.cmpdiff.statParasCut": "párrafos quitados",
  "paths.cmpdiff.statIdentical": "idénticos",
  "paths.cmpdiff.changeLog": "Registro de cambios",
  "paths.cmpdiff.was": "antes — {name}",
  "paths.cmpdiff.now": "ahora — {name}",
  "paths.cmpdiff.newOn": "nuevo en — {name}",
  "paths.cmpdiff.cutWasOn": "quitado — estaba en {name}",
  "paths.cmpdiff.headlineMatch":
    "{rightName} coincide exactamente con {leftName}.",
  "paths.cmpdiff.headlineEditsOne": "edita {count} párrafo",
  "paths.cmpdiff.headlineEditsMany": "edita {count} párrafos",
  "paths.cmpdiff.headlineAddsOne": "añade {count} nuevo",
  "paths.cmpdiff.headlineAddsMany": "añade {count} nuevos",
  "paths.cmpdiff.headlineCuts": "quita {count}",
  "paths.cmpdiff.headlineAnd": "y",
  "paths.cmpdiff.changeAdded":
    "{where} — nuevo párrafo en {name}: «{text}»",
  "paths.cmpdiff.changeRemoved":
    "{where} — párrafo quitado de {name}: «{text}»",
  "paths.cmpdiff.changeEdited":
    "{where} — editado: «{from}» → «{to}»",
  "paths.cmpdiff.where": "¶{n}",
  "paths.cmpdiff.trackHeader":
    "Leyendo {rightName} con cambios desde {leftName}.",
  "paths.cmpdiff.hideDeletions": "ocultar eliminaciones",
  "paths.cmpdiff.collapseSame": "contraer párrafos sin cambios",
  "paths.cmpdiff.parasDifferOf":
    "{changed} de {total} párrafos difieren",
  "paths.cmpdiff.unchangedRunOne": "— {count} párrafo sin cambios —",
  "paths.cmpdiff.unchangedRunMany": "— {count} párrafos sin cambios —",
  "paths.cmpdiff.unchangedDotOne": "· {count} párrafo sin cambios ·",
  "paths.cmpdiff.unchangedDotMany": "· {count} párrafos sin cambios ·",
  "paths.cmpdiff.splitWas": "antes",
  "paths.cmpdiff.splitNow": "ahora",
  "paths.cmpdiff.splitAddedTag": "añadido, lado = derecho",
  "paths.cmpdiff.splitCutTag": "quitado, lado = izquierdo",
  "paths.cmpdiff.splitNoPara": "[sin párrafo en este lado]",
  "paths.cmpdiff.kindAddedOn": "añadido en {name}",
  "paths.cmpdiff.kindCutOn": "quitado en {name}",
  "paths.cmpdiff.kindEdited": "editado",
  "paths.cmpdiff.cardWhere": "párrafo {n}",
  "paths.cmpdiff.marginAdded": "añadido",
  "paths.cmpdiff.marginCut": "quitado",
  "paths.cmpdiff.marginEdited": "reformulado",
  "paths.cmpdiff.marginAddedBody":
    "nuevo en {rightName} — no existía en {leftName}",
  "paths.cmpdiff.marginCutBody": "estaba en {leftName}: «{text}»",
  "paths.cmpdiff.marginEditedBody": "antes: «{text}»",
  "paths.cmpdiff.marginHeading": "Cambios · {name}",
  "paths.cmpdiff.marginEmpty": "No cambió ningún texto.",

  // Borrow + path-awareness
  "paths.aware.editingOn": "Editando en {path}",
  "paths.aware.alsoExistsOn": "también existe en",
  "paths.aware.differs": "difiere",
  "paths.aware.same": "igual",
  "paths.aware.peekTitle": "Echa un vistazo a esta nota tal como existe en {path}",
  "paths.peek.heading": "En {path}",
  "paths.peek.differs": "Difiere de tu versión",
  "paths.peek.same": "Igual que tu versión",
  "paths.peek.borrowAll": "Tomar prestada esta versión completa",
  "paths.peek.borrowAllTitle": "Reemplaza tu versión con la de {path}",
  "paths.peek.openSideBySide": "Comparar lado a lado",
  "paths.peek.close": "Cerrar",
  "paths.peek.empty": "Esta nota no existe en {path}.",
  "paths.borrow.confirmAll":
    "¿Reemplazar tu versión actual con la de {path}? Tu versión actual queda en el historial.",
  "paths.borrow.toast": "«{title}» tomada prestada de {path}.",
  "paths.borrow.toastSelection": "Selección tomada prestada de {path}.",
  "paths.borrow.errorLocked":
    "No se puede tomar prestada una nota bloqueada. Desbloquéala primero.",
  "paths.borrow.errorGeneric": "No se pudo tomar prestada: {error}",

  // Archive
  "paths.archive.setAside": "Apartar este escenario",
  "paths.archive.setAsideTitle":
    "Oculta este escenario de la lista activa. Puedes recuperarlo cuando quieras — nada se borra.",
  "paths.archive.bringBack": "Recuperar este escenario",
  "paths.archive.bringBackTitle":
    "Devuelve este escenario a la lista activa",
  "paths.archive.archivedBadge": "apartado",
  "paths.archive.confirmSet":
    "¿Apartar «{name}»? Queda en disco y puedes recuperarlo cuando quieras.",
  "paths.archive.toastArchived": "Escenario «{name}» apartado.",
  "paths.archive.toastRestored": "Escenario «{name}» recuperado.",
  "paths.archive.cantArchiveRoot":
    "No se puede apartar el tronco — adopta otro escenario primero.",
};

// Modern Swedish — du-form, professional register.
export const pathsSV: Record<PathsKey, string> = {
  // ── PathsPane ──────────────────────────────────────────────────────
  "paths.pane.title": "Scenarier",
  "paths.pane.viewGraph": "Graf",
  "paths.pane.viewCards": "Kort",
  "paths.pane.viewGraphTitle": "Visa scenarioträdet (standard)",
  "paths.pane.viewCardsTitle": "Visa scenarier som en platt kortlista",
  "paths.pane.viewToggleAria": "Byt scenario-vy",
  "paths.pane.subtitle":
    "Samlingar med anteckningar som förgrenar sig från {root}.",
  "paths.pane.backToRoot": "← Tillbaka till {root}",
  "paths.pane.backToRootTitle":
    "Tillbaka till {root} — stammen i ditt tänkande",
  "paths.pane.newPathFromRoot": "Nytt scenario från {root}",
  "paths.pane.newPathFromRootTitle":
    "Förgrena ett nytt ”om …” från {root}",
  "paths.pane.suggestedCount": "{count} förslag",
  "paths.pane.suggestedTitle":
    "Anteckningar som hänger ihop men ännu inte är ett scenario",
  "paths.pane.decisionMatrix": "Beslutsmatris",
  "paths.pane.decisionMatrixTitle":
    "Stjärnmärk de oumbärliga anteckningarna och se direkt vilket scenario som uppfyller flest",
  "paths.pane.helpTitle": "Så här läser du detta",
  "paths.pane.closeTitle": "Stäng",
  "paths.pane.suggestedHeading": "Föreslagna scenarier",
  "paths.pane.suggestedHelp":
    "anteckningar som hänger ihop — ett scenariokandidat du ännu inte skapat",
  "paths.pane.suggestionEdges": "{count} anteckningar · {edges} kopplingar",
  "paths.pane.suggestionMore": "+{count} till",
  "paths.pane.createPath": "Skapa scenario",
  "paths.pane.dismiss": "avfärda",
  "paths.pane.showDismissed": "Visa {count} avfärdade",
  "paths.pane.hideDismissed": "Dölj {count} avfärdade",
  "paths.pane.showDismissedTitle": "Granska förslag du har passat",
  "paths.pane.dismissedHeading": "Avfärdade tidigare",
  "paths.pane.bringBackSuggestion": "ta tillbaka",
  "paths.pane.showMoreSuggestions": "+{count} till",
  "paths.pane.showFewerSuggestions": "visa färre",
  "paths.pane.showMoreSuggestionsTitle": "Visa fler kandidatscenarier",
  "paths.pane.footerDrag": "dra för att flytta · skrolla för att zooma",
  "paths.pane.footerClick":
    "klicka på ett scenario för att se vad det innehåller",
  "paths.pane.footerBranch":
    "+ för att förgrena · ★ markerar varje scenarios huvudanteckning",
  "paths.pane.helpTitleHeading": "Så fungerar scenarier nu",
  "paths.pane.helpIntro":
    "Scenarier är namngivna samlingar av anteckningar som förgrenar sig från en utsedd rot. Anteckningarna delas — en och samma anteckning kan ligga i flera scenarier. Att välja ett scenario här ändrar inte vad du kan läsa någon annanstans.",
  "paths.pane.helpRootStrong": "Roten",
  "paths.pane.helpRootBody":
    "är stammen — märkt {root}. Alla andra scenarier härstammar från den.",
  "paths.pane.helpSelectStrong": "Att välja en nod",
  "paths.pane.helpSelectBody":
    "lyfter fram dess anor och allt som förgrenar sig från den, och öppnar detaljpanelen till höger.",
  "paths.pane.helpDetailStrong": "I detaljpanelen",
  "paths.pane.helpDetailBody":
    "växlar du vilka anteckningar som ligger i det här scenariot, markerar en som scenariots huvudanteckning (★) och förgrenar valfri medlemsanteckning till ett eget barnscenario.",
  "paths.pane.helpMapStrong": "Kartknappen",
  "paths.pane.helpMapBody":
    "öppnar kopplingsgrafen filtrerad till scenariots anteckningar — perfekt för ”vad håller det här scenariot egentligen ihop?”",
  "paths.pane.helpPlusStrong": "+-knappen",
  "paths.pane.helpPlusBody":
    "på vilken nod som helst startar ett barnscenario. Skriv ”om …”, tryck på Retur.",
  "paths.pane.helpDone": "uppfattat",
  "paths.pane.renamePrompt": "Byt namn på scenariot ”{name}” till:",
  "paths.pane.deleteConfirm":
    "Ta bort scenariot ”{name}”? Anteckningarna ligger kvar — bara samlingen tas bort. Barn kopplas om till dess förälder.",

  // ── PromoteConfirm ─────────────────────────────────────────────────
  "paths.promote.bringBack": "Återställ",
  "paths.promote.promote": "Befordra",
  "paths.promote.bringBackSuffix": "som huvudscenario?",
  "paths.promote.promoteSuffix": "till huvudscenario?",
  "paths.promote.lead":
    "Det här är en strukturell ändring. Läs innan du skriver.",
  "paths.promote.bringBackTrunkStrong": "{name} återvänder som stam.",
  "paths.promote.bringBackTrunkBody":
    "Eraens jämlikar — scenarierna som blivit spöken vid sidan av det — kommer tillbaka i livet som syskon, och behåller den form de hade tidigare.",
  "paths.promote.bringBackOldStrong":
    "Det nuvarande huvudscenariot, {root}, flyttas till spökzonen.",
  "paths.promote.bringBackOldBody":
    "Eventuella syskon till nuvarande huvudscenario följer med, så att du kan återställa dem på samma sätt senare.",
  "paths.promote.promoteTrunkStrong": "{name} blir stammen.",
  "paths.promote.promoteTrunkBody":
    "Det nuvarande huvudscenariot {root} och dess syskonscenarier flyttas till spökzonen — bevarade som historik och tonade till vänster om det nya huvudscenariot.",
  "paths.promote.promoteRelStrong": "Relationerna förblir intakta.",
  "paths.promote.promoteRelBody":
    "Spökjämlikar behåller formen från sin era. Att befordra valfritt spöke tillbaka till huvudscenario återupplivar hela den eran.",
  "paths.promote.notesStayStrong": "Dina anteckningar flyttas inte.",
  "paths.promote.notesStayBody":
    "Inget tas bort, inget byter namn på disken — bara scenarioträdets ankare skiftar.",
  "paths.promote.reversibleStrong": "Reversibelt.",
  "paths.promote.reversibleBody":
    "Vilket spökscenario som helst kan befordras tillbaka senare.",
  "paths.promote.typeToConfirm": "Skriv {phrase} för att bekräfta",
  "paths.promote.cancel": "avbryt",
  "paths.promote.confirm": "Befordra till huvudscenario",

  // ── ConditionEditor ────────────────────────────────────────────────
  "paths.condition.kicker": "namnge detta scenario",
  "paths.condition.heading": "Vilken fråga ställer {name}?",
  "paths.condition.lead":
    "Börja med Om… eller Tänk om… — villkoret som fick dig att lämna huvudvägen. Så känner ditt framtida jag igen den.",
  "paths.condition.placeholder": "Om Seattle-jobbet går igenom…",
  "paths.condition.preset1": "Om det regnar den dagen",
  "paths.condition.preset2": "Om jag får jobbet",
  "paths.condition.preset3": "Om projektet nekas",
  "paths.condition.preset4": "Om vi stannar kvar",
  "paths.condition.preset5": "Om jag säger upp mig",
  "paths.condition.cancel": "avbryt",
  "paths.condition.clear": "rensa",
  "paths.condition.clearTitle": "Ta bort detta villkor",
  "paths.condition.save": "spara fråga",
  "paths.condition.createKicker": "öppna ett nytt scenario",
  "paths.condition.createHeading": "Vad är det ”om…” som öppnas från {name}?",
  "paths.condition.createLead":
    "Börja med Om… eller Tänk om… — villkoret som fick dig att ta ett steg åt sidan från den här vägen. Scenariots korta namn härleds från det du skriver.",
  "paths.condition.createSave": "öppna scenario",

  // ── PathsEmptyState ────────────────────────────────────────────────
  "paths.empty.started": "STARTADE",
  "paths.empty.today": "I DAG",
  "paths.empty.heading": "Din karta är en enda väg just nu.",
  "paths.empty.body":
    "Ett scenario är en parallell version av ditt tänkande — det du skulle skriva om något var annorlunda. Vilket vill du prova först?",
  "paths.empty.preset1": "Om det regnar den dagen",
  "paths.empty.preset2": "Om projektet nekas",
  "paths.empty.preset3": "Om jag säger upp mig för att skriva",
  "paths.empty.preset4": "Om vi stannar kvar",
  "paths.empty.start": "Starta detta scenario",
  "paths.empty.safe":
    "Versionen du har nu ligger tryggt kvar på {name}.",

  // ── ForkingRoad ────────────────────────────────────────────────────
  "paths.road.loading": "Laddar scenarier…",
  "paths.road.modeInk": "bläck",
  "paths.road.modeInkTitle":
    "Avsmalnande bläck — fullständiga kort, fyllda bandkopplingar",
  "paths.road.modeRibbon": "band",
  "paths.road.modeRibbonTitle":
    "Gradient-band — tunna streck som blandar förälderns färg in i barnets, kompakta pillenoder",
  "paths.road.fit": "anpassa",
  "paths.road.signpostName": "+ namnge denna förgrening",
  "paths.road.cardMain": "HUVUD",
  "paths.road.cardYouAreHere": "DU ÄR HÄR",
  "paths.road.cardWasMain": "VAR HUVUD",
  "paths.road.youAreHereTooltip": "du är här",
  "paths.road.cardCreated": "{count} anteckning · skapad {when}",
  "paths.road.cardCreatedPlural": "{count} anteckningar · skapad {when}",
  "paths.road.cardGhostMeta": "{count} anteckning · spöke · {when}",
  "paths.road.cardGhostMetaPlural": "{count} anteckningar · spöke · {when}",
  "paths.road.diffTooltip":
    "Om du byter till ”{name}” från ditt nuvarande scenario: {gained} {gainedNoteWord} tillagda, {lost} borttagna.",
  "paths.road.diffNoteWord": "anteckning",
  "paths.road.diffNoteWordPlural": "anteckningar",
  "paths.road.gainedTooltipOne":
    "+{count} anteckning i detta scenario som saknas i ditt",
  "paths.road.gainedTooltipMany":
    "+{count} anteckningar i detta scenario som saknas i ditt",
  "paths.road.lostTooltipOne":
    "−{count} anteckning i ditt scenario som saknas i detta",
  "paths.road.lostTooltipMany":
    "−{count} anteckningar i ditt scenario som saknas i detta",
  "paths.road.pendingPlaceholder": "Om Seattle-jobbet går igenom…",
  "paths.road.pendingHelp":
    "Retur för att förgrena från {parent}, Esc för att avbryta.",
  "paths.road.popoverCurrent": "aktuellt scenario",
  "paths.road.popoverPreview": "förhandsvisning av scenario",
  "paths.road.popoverNote": "{count} anteckning",
  "paths.road.popoverNotePlural": "{count} anteckningar",
  "paths.road.popoverGained": "+{count} tillagda",
  "paths.road.popoverLost": "−{count} förlorade",
  "paths.road.popoverInPath": "I detta scenario",
  "paths.road.popoverMore": "… och {count} till",
  "paths.road.popoverHint": "klicka för fullständig detalj",

  // ── PathDetail ─────────────────────────────────────────────────────
  "paths.detail.ghostHeader": "Spökscenario · förgrenat från {parent}",
  "paths.detail.ghostHeaderUnknown": "—",
  "paths.detail.mainHeader": "★ Huvud · stammen",
  "paths.detail.sideHeader":
    "Sidoscenario · förgrenat från {parent}",
  "paths.detail.closeAria": "Stäng detalj",
  "paths.detail.closeTitle": "Stäng (Esc)",
  "paths.detail.rename": "byt namn",
  "paths.detail.renameTitle": "Byt namn på detta scenario",
  "paths.detail.editConditionTitle":
    "Klicka för att redigera frågan detta scenario ställer",
  "paths.detail.namePrompt":
    "+ Namnge detta scenario — vilket ”om …” ställer den?",
  "paths.detail.notesCountOne": "{count} anteckning",
  "paths.detail.notesCountMany": "{count} anteckningar",
  "paths.detail.created": "skapad {when}",
  "paths.detail.openMap": "Öppna kartan för detta scenario",
  "paths.detail.openMapTitle":
    "Visa kopplingsgrafen filtrerad till scenariots anteckningar",
  "paths.detail.diffHeading": "Om du tar detta scenario",
  "paths.detail.diffVs": "mot {name}",
  "paths.detail.diffFlat": "platt lista",
  "paths.detail.diffGroup": "gruppera per tagg",
  "paths.detail.diffGroupTitle": "Klustra listorna efter taggar",
  "paths.detail.diffGain": "skulle du få",
  "paths.detail.diffEdited":
    "finns på båda, men har redigerats olika",
  "paths.detail.diffLose": "skulle du lämna kvar",
  "paths.detail.diffLoseTitle":
    "Saknas på {name} — öppna för att granska",
  "paths.detail.diffChecking": "söker efter divergerade ändringar…",
  "paths.detail.diffMore": "… och {count} till",
  "paths.detail.diffUntagged": "otaggade",
  "paths.detail.inThisPath": "I detta scenario",
  "paths.detail.adding": "klar",
  "paths.detail.add": "+ lägg till anteckning",
  "paths.detail.emptyMembers":
    "Inga anteckningar i detta scenario ännu. Använd ”+ lägg till anteckning”.",
  "paths.detail.openTitle": "Öppna denna anteckning",
  "paths.detail.mainNoteTitle": "Huvudanteckning för detta scenario",
  "paths.detail.markMain": "markera som huvud",
  "paths.detail.markMainTitle":
    "Utse denna som scenariots huvudanteckning",
  "paths.detail.branch": "öppna underscenario",
  "paths.detail.branchTitle":
    "Gör denna anteckning till ett nytt barnscenario",
  "paths.detail.remove": "ta bort",
  "paths.detail.removeTitle":
    "Ta bort denna anteckning från scenariot (raderar inte anteckningen)",
  "paths.detail.filterPlaceholder": "filtrera anteckningar…",
  "paths.detail.filterEmpty":
    "Ingen anteckning matchar. Alla finns redan i detta scenario.",
  "paths.detail.filterCount": "{count} utanför detta scenario",
  "paths.detail.bringBack": "★ Återställ som huvudscenario…",
  "paths.detail.promote": "★ Befordra till huvudscenario…",
  "paths.detail.promoteTitleGhost":
    "Återställ {name} som arbetsytans huvudscenario",
  "paths.detail.promoteTitle":
    "Gör {name} till arbetsytans huvudscenario",
  "paths.detail.deletePath": "Ta bort detta scenario",
  "paths.detail.deletePathTitle":
    "Ta bort detta scenario (raderar inga anteckningar)",
  "paths.detail.trunkNote":
    "Det här är stammen. Allt annat förgrenar sig härifrån.",
  "paths.detail.ghostNote":
    "Historisk · befordra för att hämta tillbaka denna era.",
  "paths.detail.autoTagAdd":
    "+ inkludera anteckningar automatiskt efter tagg",
  "paths.detail.autoTagAddTitle":
    "Lägg automatiskt till varje anteckning som har en viss tagg i scenariot",
  "paths.detail.autoIncludes": "inkluderar automatiskt",
  "paths.detail.autoMatchOne": "· {count} anteckning matchar",
  "paths.detail.autoMatchMany": "· {count} anteckningar matchar",
  "paths.detail.change": "ändra",
  "paths.detail.clear": "rensa",
  "paths.detail.autoLead":
    "inkludera automatiskt anteckningar märkta",
  "paths.detail.autoTagPlaceholder": "taggnamn",
  "paths.detail.autoSave": "spara",
  "paths.detail.autoCancel": "avbryt",
  "paths.detail.accent": "accent",
  "paths.detail.accentClearTitle":
    "Rensa accent — använd standardtonen från paletten",
  "paths.detail.accentSetAria": "Sätt accent till {value}",
  "paths.detail.accentCustomTitle": "Välj en anpassad färg",

  // ── DecisionMatrix ─────────────────────────────────────────────────
  "paths.matrix.bestMatch":
    "Bästa träff: {names} — {hits} av {total} måste-ha",
  "paths.matrix.bestMatchTie":
    "Lika på {hits} av {total} måste-ha: {names}",
  "paths.matrix.noStars":
    "Stjärnmarkera några måste-ha-anteckningar ovan för att se vilket scenario som täcker flest.",
  "paths.matrix.title": "Beslutsmatris",
  "paths.matrix.subtitle":
    "Stjärnmärk de anteckningar du inte klarar dig utan, läs sedan varje scenarios kolumn för att se vilket som uppfyller flest.",
  "paths.matrix.filterPlaceholder": "filtrera anteckningar…",
  "paths.matrix.onlyStars": "Endast ★-rader",
  "paths.matrix.tagsLabel": "taggar:",
  "paths.matrix.allTags": "alla",
  "paths.matrix.colHeader": "Anteckning",
  "paths.matrix.colSortTitle":
    "{name} — klicka för att sortera rader efter medlemskap · klicka igen för att vända · klicka en tredje gång för att rensa",
  "paths.matrix.empty": "Ingen anteckning matchar.",
  "paths.matrix.starOn":
    "Ta bort stjärna (inte längre oumbärlig)",
  "paths.matrix.starOff": "Markera som oumbärlig",
  "paths.matrix.legend":
    "✓ anteckningen finns i scenariot · ✗ en stjärnmärkt anteckning saknas · ★ markerar en oumbärlig rad",
  "paths.matrix.close": "Stäng",
  "paths.matrix.cellPresent": "närvarande",
  "paths.matrix.cellMissing": "oumbärlig saknas",
  "paths.matrix.cellAbsent": "finns inte i detta scenario",

  // ── PathDiff (legacy) ──────────────────────────────────────────────
  "paths.diff.title": "Jämför scenarier",
  "paths.diff.close": "stäng",
  "paths.diff.loadError": "Kunde inte ladda: {message}",
  "paths.diff.summary": "{differing} skiljer sig · {identical} identiska",
  "paths.diff.identical": "Dessa scenarier har identiska anteckningar.",
  "paths.diff.notOnPath": "Finns inte i detta scenario.",
  "paths.diff.labelCurrent": "aktuell",
  "paths.diff.labelOther": "annan",

  // ── PathCompare ────────────────────────────────────────────────────
  "paths.compare.title": "Jämför",
  "paths.compare.subtitleNotes":
    "Välj två anteckningar för att se vad som skiljer dem åt. Rubriker, omflyttade stycken och inline-ändringar dyker upp i den vy du föredrar.",
  "paths.compare.modeLabel": "Jämförelseomfång",
  "paths.compare.modeNotes": "Anteckningar",
  "paths.compare.modePaths": "Scenarier",
  "paths.compare.modeNotesTitle": "Jämför två enskilda anteckningar",
  "paths.compare.modePathsTitle": "Jämför varje anteckning mellan två scenarier",
  "paths.compare.notesLeftCaption": "Vänster anteckning",
  "paths.compare.notesRightCaption": "Höger anteckning",
  "paths.compare.notesPickPrompt": "Välj en anteckning",
  "paths.compare.notesPickPromptTitle": "Välj två olika anteckningar att jämföra",
  "paths.compare.notesSameSelection":
    "Båda sidorna är samma anteckning — välj en annan på en av sidorna.",
  "paths.compare.notesSummary": "Jämför ”{left}” med ”{right}”",
  "paths.compare.notesEmptyWorkspaceTitle": "Inte tillräckligt med anteckningar än",
  "paths.compare.notesEmptyWorkspaceBody":
    "Du behöver minst två anteckningar i arbetsytan för att jämföra. Skapa en till och kom tillbaka.",
  "paths.compare.subtitle":
    "Välj ett scenario på varje sida. Som standard visar listan bara anteckningar som redigerats i båda scenarier — visa-kontrollen till höger låter dig vidga den till att inkludera ensidiga eller identiska anteckningar.",
  "paths.compare.show": "visa",
  "paths.compare.subtitleEm": "visa",
  "paths.compare.closeTitle": "Stäng",
  "paths.compare.leftCaption": "Vänster sida",
  "paths.compare.rightCaption": "Höger sida",
  "paths.compare.swapTitle": "Byt sidor",
  "paths.compare.swapAria": "Byt vänster och höger",
  "paths.compare.sameSelection":
    "Båda sidor är samma scenario — välj ett annat scenario på en sida för att se en jämförelse.",
  "paths.compare.noCondition": "(inget villkor)",
  "paths.compare.summaryModifiedOne":
    "{count} anteckning med olika innehåll",
  "paths.compare.summaryModifiedMany":
    "{count} anteckningar med olika innehåll",
  "paths.compare.summaryAdded": "{count} endast på {name}",
  "paths.compare.summaryRemoved": "{count} endast på {name}",
  "paths.compare.summarySame": "{count} identiska",
  "paths.compare.viewLabel": "vy",
  "paths.compare.viewSwitchTitle":
    "Byt till vyn {label} för ändrade anteckningar",
  "paths.compare.showChanges": "Ändringar",
  "paths.compare.showChangesHelp":
    "Endast anteckningar med redigerat innehåll på båda sidor",
  "paths.compare.showOneSided": "+ endast-på-en-sida",
  "paths.compare.showOneSidedHelp":
    "Inkludera anteckningar som bara finns i ett scenario",
  "paths.compare.showIdentical": "+ identiska",
  "paths.compare.showIdenticalHelp":
    "Inkludera anteckningar som är desamma i båda scenarier",
  "paths.compare.errorTitle": "Kunde inte jämföra dessa scenarier",
  "paths.compare.loading": "Jämför…",
  "paths.compare.pickPrompt":
    "Välj två scenarier ovan för att jämföra.",
  "paths.compare.emptyChangedTitle":
    "Inga anteckningar redigerades på båda sidor.",
  "paths.compare.emptyChangedOneSiders":
    "Varje skillnad mellan dessa scenarier är en anteckning som bara finns på en av dem — inget skrevs om på båda.",
  "paths.compare.emptyChangedIdentical": "De två scenarierna är identiska.",
  "paths.compare.emptyShowOneSided":
    "Visa ensidiga anteckningar ({count})",
  "paths.compare.emptyDiffsTitle": "Inga skillnader att visa.",
  "paths.compare.emptyDiffsBody":
    "De två scenarierna innehåller samma anteckningar med samma innehåll.",
  "paths.compare.emptyShowIdentical":
    "Visa även identiska ({count})",
  "paths.compare.emptyAll": "Inga anteckningar att visa.",
  "paths.compare.statusAdded": "Endast på {name}",
  "paths.compare.statusRemoved": "Endast på {name}",
  "paths.compare.statusModified": "Olika versioner",
  "paths.compare.statusSame": "Lika på båda",
  "paths.compare.rowHide": "▾ dölj",
  "paths.compare.rowShow": "▸ visa",
  "paths.compare.rowExpandHide": "Dölj detaljerna",
  "paths.compare.rowExpandShow":
    "Visa hela innehållet i den valda vyn",
  "paths.compare.rowSamePreview": "identiska i båda scenarier",
  "paths.compare.rowOnSide": "på {side}: ",
  "paths.compare.footerHelp":
    "Innehållet för varje scenario är det du ser när du redigerar i det — eventuella tillfälliga ändringar du gjort där dyker upp här.",
  "paths.compare.close": "Stäng",

  // ── ConflictResolver ───────────────────────────────────────────────
  "paths.conflict.loading": "Laddar konflikt…",
  "paths.conflict.heading": "Ditt tänkande gick isär här",
  "paths.conflict.body":
    "Du skrev olika saker om {name} på {currentPath} och {otherPath}. Vilken version känns rätt nu? Eller kombinera dem.",
  "paths.conflict.progress": "{idx} av {total}",
  "paths.conflict.onPath": "På {name}",
  "paths.conflict.subtitleOurs": "din nuvarande version",
  "paths.conflict.subtitleTheirs": "version som förs in",
  "paths.conflict.noVersion": "(detta scenario har ingen version)",
  "paths.conflict.useThis": "Använd denna",
  "paths.conflict.combinedHeading": "Kombinerad version",
  "paths.conflict.combinedHelp":
    "Det är detta som sparas — redigera fritt.",
  "paths.conflict.stop": "Stoppa och gå tillbaka",
  "paths.conflict.acceptFinal": "Spara — för samman",
  "paths.conflict.acceptNext": "Spara denna och fortsätt",
  "paths.conflict.abortTitle":
    "Sluta föra samman dessa scenarier?",
  "paths.conflict.abortBody":
    "Pågående ändringar för denna sammanslagning rullas tillbaka. Det ursprungliga innehållet i varje scenario blir kvar exakt som det var.",
  "paths.conflict.abortKeep": "fortsätt slå samman",
  "paths.conflict.abortConfirm": "ja, stoppa",

  // ── ForkMoment ─────────────────────────────────────────────────────
  "paths.forkMoment.exploring": "utforskar",

  // ── InlineDiffPane ─────────────────────────────────────────────────
  "paths.inline.heading":
    "Hur denna anteckning skiljer sig från {main}",
  "paths.inline.youAreOn": "du är på {name}",
  "paths.inline.viewLabel": "vy",
  "paths.inline.viewSwitchTitle": "Byt till vyn {label}",
  "paths.inline.back": "Tillbaka till redigering",
  "paths.inline.backTitle":
    "Sluta jämföra och gå tillbaka till redigering av denna anteckning",
  "paths.inline.loadError":
    "Kunde inte ladda skillnaderna: {message}",
  "paths.inline.loading": "Laddar…",
  "paths.inline.noDiffHint":
    "Du har inte redigerat denna anteckning på ”{name}” ännu. Klicka på Tillbaka till redigering — första tangenttrycket startar en stigslokal kopia.",

  // ── CompareDiff ────────────────────────────────────────────────────
  "paths.cmpdiff.viewSummary": "Sammanfattning",
  "paths.cmpdiff.viewTrack": "Spåra ändringar",
  "paths.cmpdiff.viewSplit": "Sida vid sida",
  "paths.cmpdiff.viewCards": "Styckeskort",
  "paths.cmpdiff.viewMarginalia": "Marginalia",
  "paths.cmpdiff.bannerAdded":
    "Denna anteckning finns endast på {name}. Visar hela innehållet i den valda vyn.",
  "paths.cmpdiff.bannerRemoved":
    "Denna anteckning finns endast på {leftName} — den finns inte på {rightName}. Visar vad som skulle gå förlorat.",
  "paths.cmpdiff.summaryNoProse": "Ingen text ändrades.",
  "paths.cmpdiff.summaryIdentical":
    "Filinnehållet på {leftName} och {rightName} är identiskt.",
  "paths.cmpdiff.statWordsAdded": "ord tillagda",
  "paths.cmpdiff.statWordsCut": "ord borttagna",
  "paths.cmpdiff.statParasEdited": "stycken redigerade",
  "paths.cmpdiff.statParasAdded": "stycken tillagda",
  "paths.cmpdiff.statParasCut": "stycken borttagna",
  "paths.cmpdiff.statIdentical": "identiska",
  "paths.cmpdiff.changeLog": "Ändringslogg",
  "paths.cmpdiff.was": "var — {name}",
  "paths.cmpdiff.now": "nu — {name}",
  "paths.cmpdiff.newOn": "ny på — {name}",
  "paths.cmpdiff.cutWasOn": "borttagen — fanns på {name}",
  "paths.cmpdiff.headlineMatch":
    "{rightName} matchar {leftName} exakt.",
  "paths.cmpdiff.headlineEditsOne": "redigerar {count} stycke",
  "paths.cmpdiff.headlineEditsMany": "redigerar {count} stycken",
  "paths.cmpdiff.headlineAddsOne": "lägger till {count} nytt",
  "paths.cmpdiff.headlineAddsMany": "lägger till {count} nya",
  "paths.cmpdiff.headlineCuts": "tar bort {count}",
  "paths.cmpdiff.headlineAnd": "och",
  "paths.cmpdiff.changeAdded":
    "{where} — nytt stycke på {name}: ”{text}”",
  "paths.cmpdiff.changeRemoved":
    "{where} — stycke borttaget från {name}: ”{text}”",
  "paths.cmpdiff.changeEdited":
    "{where} — redigerat: ”{from}” → ”{to}”",
  "paths.cmpdiff.where": "¶{n}",
  "paths.cmpdiff.trackHeader":
    "Läser {rightName} med ändringar från {leftName}.",
  "paths.cmpdiff.hideDeletions": "dölj borttagningar",
  "paths.cmpdiff.collapseSame": "fäll ihop oförändrade stycken",
  "paths.cmpdiff.parasDifferOf":
    "{changed} av {total} stycken skiljer sig",
  "paths.cmpdiff.unchangedRunOne":
    "— {count} stycke oförändrat —",
  "paths.cmpdiff.unchangedRunMany":
    "— {count} stycken oförändrade —",
  "paths.cmpdiff.unchangedDotOne":
    "· {count} stycke oförändrat ·",
  "paths.cmpdiff.unchangedDotMany":
    "· {count} stycken oförändrade ·",
  "paths.cmpdiff.splitWas": "var",
  "paths.cmpdiff.splitNow": "nu",
  "paths.cmpdiff.splitAddedTag": "tillagt, sida = höger",
  "paths.cmpdiff.splitCutTag": "borttaget, sida = vänster",
  "paths.cmpdiff.splitNoPara": "[inget stycke på denna sida]",
  "paths.cmpdiff.kindAddedOn": "tillagt på {name}",
  "paths.cmpdiff.kindCutOn": "borttaget på {name}",
  "paths.cmpdiff.kindEdited": "redigerat",
  "paths.cmpdiff.cardWhere": "stycke {n}",
  "paths.cmpdiff.marginAdded": "tillagt",
  "paths.cmpdiff.marginCut": "borttaget",
  "paths.cmpdiff.marginEdited": "omformulerat",
  "paths.cmpdiff.marginAddedBody":
    "nytt på {rightName} — fanns inte på {leftName}",
  "paths.cmpdiff.marginCutBody": "fanns på {leftName}: ”{text}”",
  "paths.cmpdiff.marginEditedBody": "var: ”{text}”",
  "paths.cmpdiff.marginHeading": "Ändringar · {name}",
  "paths.cmpdiff.marginEmpty": "Ingen text ändrades.",

  // Borrow + path-awareness
  "paths.aware.editingOn": "Redigerar i {path}",
  "paths.aware.alsoExistsOn": "finns också i",
  "paths.aware.differs": "skiljer sig",
  "paths.aware.same": "samma",
  "paths.aware.peekTitle": "Titta in i hur den här anteckningen ser ut i {path}",
  "paths.peek.heading": "I {path}",
  "paths.peek.differs": "Skiljer sig från din version",
  "paths.peek.same": "Samma som din version",
  "paths.peek.borrowAll": "Låna hela den här versionen",
  "paths.peek.borrowAllTitle": "Ersätt din version med den från {path}",
  "paths.peek.openSideBySide": "Jämför sida vid sida",
  "paths.peek.close": "Stäng",
  "paths.peek.empty": "Den här anteckningen finns inte i {path}.",
  "paths.borrow.confirmAll":
    "Ersätta din nuvarande version med den från {path}? Din nuvarande version finns kvar i historiken.",
  "paths.borrow.toast": "”{title}” lånad från {path}.",
  "paths.borrow.toastSelection": "Markering lånad från {path}.",
  "paths.borrow.errorLocked":
    "Kan inte låna från en låst anteckning. Lås upp först.",
  "paths.borrow.errorGeneric": "Kunde inte låna: {error}",

  // Archive
  "paths.archive.setAside": "Lägg det här scenariot åt sidan",
  "paths.archive.setAsideTitle":
    "Dölj scenariot från den aktiva listan. Du kan ta tillbaka det när som helst — inget tas bort.",
  "paths.archive.bringBack": "Ta tillbaka det här scenariot",
  "paths.archive.bringBackTitle":
    "Återställ scenariot till den aktiva listan",
  "paths.archive.archivedBadge": "åt sidan",
  "paths.archive.confirmSet":
    "Lägga ”{name}” åt sidan? Det finns kvar på disk och du kan ta tillbaka det när du vill.",
  "paths.archive.toastArchived": "Scenariot ”{name}” lagt åt sidan.",
  "paths.archive.toastRestored": "Scenariot ”{name}” återställt.",
  "paths.archive.cantArchiveRoot":
    "Kan inte lägga stammen åt sidan — adoptera ett annat scenario först.",
};
