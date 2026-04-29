// Sidebar surfaces — NoteList, LinkedNotesList, OpenQuestions,
// Transclusions, ConnectionGraph, TagGraph, TagList, JournalCalendar,
// JournalList, ActivityMini, PathMinimap, RightRail.

export const sidebarEN = {
  // NoteList — row affordances
  "sidebar.notes.selectAria": "Select {title}",
  "sidebar.notes.staleTooltip": "Hasn't been visited in {days} days",
  "sidebar.notes.orphanTooltip": "This note isn't linked to anything yet",
  "sidebar.notes.starTooltip": "Starting note — your workspace's main",
  "sidebar.notes.encryptedTooltip": "Encrypted",
  "sidebar.notes.privateTooltip": "Private — never syncs (registered in .git/info/exclude)",
  "sidebar.notes.privateTooltipShort": "Private — never syncs",
  "sidebar.notes.unlinkedTooltip": "not linked",
  "sidebar.notes.startingNote": "Starting note",
  "sidebar.notes.pinned": "Pinned",
  "sidebar.notes.active": "Active",
  "sidebar.notes.homeNote": "Home note",
  "sidebar.notes.homeNoteOpenLabel": "Open this workspace's home note",
  "sidebar.notes.justNow": "just now",
  "sidebar.notes.relMinutes": "{n}m",
  "sidebar.notes.relHours": "{n}h",
  "sidebar.notes.relDays": "{n}d",
  "sidebar.notes.relWeeks": "{n}w",
  "sidebar.notes.relMonths": "{n}mo",

  // NoteList — pinned hero meta line
  "sidebar.notes.metaNotesOne": "{count} note",
  "sidebar.notes.metaNotesMany": "{count} notes",
  "sidebar.notes.metaPathsOne": " · {count} scenario",
  "sidebar.notes.metaPathsMany": " · {count} scenarios",

  // NoteList — tag filter banner
  "sidebar.notes.filteringPrefix": "filtering",
  "sidebar.notes.clearTagFilter": "Clear tag filter",

  // NoteList — selection bar
  "sidebar.notes.selected": "{count} selected",
  "sidebar.notes.selectAll": "all",
  "sidebar.notes.selectNone": "none",
  "sidebar.notes.selectDelete": "delete",

  // NoteList — group headers
  "sidebar.notes.groupToday": "Today",
  "sidebar.notes.groupYesterday": "Yesterday",
  "sidebar.notes.groupLastWeek": "Last Week",
  "sidebar.notes.groupOlder": "Older",
  "sidebar.notes.olderCollapse": "collapse",
  "sidebar.notes.olderMore": "+ {n} more",
  "sidebar.notes.olderShow": "+ {n} older",

  // NoteList — empty states
  "sidebar.notes.emptyFilteredHint": "No notes tagged #{tag}. Clear the filter to see the rest.",
  "sidebar.notes.clearFilter": "Clear filter",
  "sidebar.notes.newNote": "+ New note",

  // NoteList — orphan section
  "sidebar.notes.orphansOne": "{count} unlinked note",
  "sidebar.notes.orphansMany": "{count} unlinked notes",
  "sidebar.notes.orphansTitle": "Notes with no links yet — a nudge, nothing more",

  // NoteList — sticky footer
  "sidebar.notes.footerCountOne": "{count} note",
  "sidebar.notes.footerCountMany": "{count} notes",
  "sidebar.notes.viewSwitchToCards": "Switch to card view",
  "sidebar.notes.viewSwitchToList": "Switch to list view",
  "sidebar.notes.viewCards": "Card view",
  "sidebar.notes.viewList": "List view",
  "sidebar.notes.exitMultiSelect": "Exit multi-select",
  "sidebar.notes.enterMultiSelect": "Select multiple notes",
  "sidebar.notes.selectModeDone": "done",
  "sidebar.notes.selectMode": "select",
  "sidebar.notes.newAria": "New note",
  "sidebar.notes.newShort": "New",

  // NoteList — context menu
  "sidebar.notes.menuOpenInNewTab": "Open in new tab",
  "sidebar.notes.menuPin": "Pin to top",
  "sidebar.notes.menuUnpin": "Unpin",
  "sidebar.notes.menuRename": "Rename",
  "sidebar.notes.menuCopyMd": "Copy as Markdown",
  "sidebar.notes.menuMoveToFolder": "Move to folder…",
  "sidebar.notes.menuReveal": "Reveal in file manager",
  "sidebar.notes.menuDecrypt": "Decrypt note",
  "sidebar.notes.menuEncrypt": "Encrypt note",
  "sidebar.notes.menuUnlockHint": "Unlock the session first",
  "sidebar.notes.menuDelete": "Delete",

  // NoteList — rename modal
  "sidebar.notes.renameTitle": "Rename note",
  "sidebar.notes.renameCancel": "cancel",
  "sidebar.notes.renameAction": "rename",

  // NoteList — folder picker modal
  "sidebar.folders.title": "Move to folder",
  "sidebar.folders.intro": "Folders are sidebar-only — your notes still live as plain ",
  "sidebar.folders.introMd": " files in ",
  "sidebar.folders.introTrail": ".",
  "sidebar.folders.none": "(no folder — show in time-based list)",
  "sidebar.folders.current": "current",
  "sidebar.folders.namePlaceholder": "folder name",
  "sidebar.folders.create": "create",
  "sidebar.folders.newFolder": "New folder",
  "sidebar.folders.newFolderHint": "Folders are sidebar-only — your notes still live as plain .md files. The folder appears in the sidebar and any new note you move into it lands here.",

  // JournalList
  "sidebar.journal.title": "Journal",
  "sidebar.journal.calendar": "calendar",
  "sidebar.journal.calendarTooltip": "Browse the calendar",
  "sidebar.journal.todayTooltip": "Jump to today's journal ({shortcut})",
  "sidebar.journal.today": "Today",

  // JournalCalendar
  "sidebar.calendar.prevMonth": "Previous month",
  "sidebar.calendar.nextMonth": "Next month",
  "sidebar.calendar.dayS": "S",
  "sidebar.calendar.dayM": "M",
  "sidebar.calendar.dayT": "T",
  "sidebar.calendar.dayW": "W",
  "sidebar.calendar.dayF": "F",
  "sidebar.calendar.jumpToday": "Jump to today",
  "sidebar.calendar.entries": "{count} entries",

  // ActivityMini
  "sidebar.activity.title": "Activity",
  "sidebar.activity.window": "{days} days",
  "sidebar.activity.openTooltip": "Open the full activity heatmap",
  "sidebar.activity.cellTooltipOne": "{count} checkpoint · {date}",
  "sidebar.activity.cellTooltipMany": "{count} checkpoints · {date}",
  "sidebar.activity.totalOne": "checkpoint",
  "sidebar.activity.totalMany": "checkpoints",
  "sidebar.activity.streak": "{n}-day streak",
  "sidebar.activity.loading": "reading history…",

  // PathMinimap
  "sidebar.paths.title": "Your Scenarios",
  "sidebar.paths.helpTip": "Click the graph to open the full view.",
  "sidebar.paths.openTooltip": "Open the full scenarios graph",
  "sidebar.paths.seeAll": "see all scenarios →",
  "sidebar.paths.newTooltip": "Start a new scenario ({shortcut})",
  "sidebar.paths.nodeMembersOne": "{count} note",
  "sidebar.paths.nodeMembersMany": "{count} notes",

  // TagList
  "sidebar.tags.title": "Tags",

  // LinkedNotesList
  "sidebar.linked.title": "Linked Notes",
  "sidebar.linked.addTip": "Add connection",
  "sidebar.linked.addAria": "Add connection",
  "sidebar.linked.emptyHint": "Linking notes helps future-you find them: supports · challenges · came from · open question.",
  "sidebar.linked.addAction": "+ Add a connection",
  "sidebar.linked.removeTitle": "Remove connection",
  "sidebar.linked.addAnother": "Add another connection",

  // OpenQuestions
  "sidebar.questions.title": "Open questions",
  "sidebar.questions.helpTip": "Lines that start with ?? in your note",

  // Transclusions
  "sidebar.transclusions.title": "Embedded",
  "sidebar.transclusions.notFound": " · not found",

  // ConnectionGraph
  "sidebar.graph.emptyHeadline": "Create a few notes, then come back here.",
  "sidebar.graph.emptyHint": "The Map shows every note in your vault — even the disconnected ones — so you can drag them into relationships.",
  "sidebar.graph.expandedTitle": "Connections graph",
  // Static (motion-free) view labels — shown when reduce-motion is on
  // or when the user has Disable autoplay set.
  "sidebar.graph.staticHeader": "Connections (static view)",
  "sidebar.graph.staticCountOne": "{count} connection",
  "sidebar.graph.staticCountMany": "{count} connections",
  "sidebar.graph.staticPickANote":
    "Open a note to see what connects to it. The static view groups its connections by type — no motion, no graph layout.",
  "sidebar.graph.staticNoConnections":
    "Nothing connects here yet. Right-click another note in the sidebar and pick Connect to start.",
  "sidebar.graph.staticOutgoing": "from this note →",
  "sidebar.graph.staticIncoming": "← to this note",
  "sidebar.graph.expandTitle": "Open the static view in a larger surface",
  "sidebar.graph.expandButton": "Expand",
  "sidebar.graph.expandedMetaOne": "{notes} notes · {links} connection · click a node to open it · esc to close",
  "sidebar.graph.expandedMetaMany": "{notes} notes · {links} connections · click a node to open it · esc to close",
  "sidebar.graph.closeAria": "Close",
  "sidebar.graph.hoverConnect": "drag to connect",
  "sidebar.graph.hoverHighlight": "click to highlight connections",
  "sidebar.graph.hoverOpen": "click to open",
  "sidebar.graph.hoverMainTag": "★ main · ",
  "sidebar.graph.hoverConnOne": "{count} connection · {hint}",
  "sidebar.graph.hoverConnMany": "{count} connections · {hint}",
  "sidebar.graph.statDirect": "direct",
  "sidebar.graph.statTotal": "total",
  "sidebar.graph.statNotesLinks": "{notes} notes · {links} links",
  "sidebar.graph.layoutForce": "force",
  "sidebar.graph.layoutChord": "chord",
  "sidebar.graph.layoutForceTip": "Force-directed layout — the default radial web",
  "sidebar.graph.layoutChordTip": "Chord layout — every note on an outer ring, edges through centre",
  "sidebar.graph.connectExitTip": "Exit connect mode — drags will reposition notes again",
  "sidebar.graph.connectEnterTip": "Connect mode — drag from one note to another to link them",
  "sidebar.graph.connecting": "connecting",
  "sidebar.graph.connect": "connect",
  "sidebar.graph.nearbyAll": "Show every note",
  "sidebar.graph.nearbyOnly": "Focus on nearby notes",
  "sidebar.graph.recenter": "Re-center graph",
  "sidebar.graph.expand": "Expand — see the full graph",
  "sidebar.graph.spreadOn": "Spread nodes apart — easier to see and connect",
  "sidebar.graph.spreadOff": "Pack nodes closer — denser layout",
  "sidebar.graph.connectBanner": "Connect mode — drag a note onto another to link them",
  "sidebar.graph.exit": "exit",
  "sidebar.graph.legendMain": "main",
  "sidebar.graph.legendActive": "you're here",
  "sidebar.graph.legendNeighbor": "connected",
  "sidebar.graph.legendHint": "hover a kind to filter",
  "sidebar.graph.legendSupports": "supports",
  "sidebar.graph.legendChallenges": "challenges",
  "sidebar.graph.legendCameFrom": "came from",
  "sidebar.graph.legendOpenQuestion": "open question",
  "sidebar.graph.controlsHint": "scroll to zoom · drag to pan · click a node to open",
  "sidebar.graph.coachTitle": "Your graph is still growing —",
  "sidebar.graph.coachDismiss": "dismiss",
  "sidebar.graph.coachDismissTitle": "Hide these tips",
  "sidebar.graph.coachTip1": "Click “connect” in the toolbar, then drag one note onto another to link them. Flip back to view mode when you're done.",
  "sidebar.graph.coachTip2": "Click any note to center the graph on it — neighbors pull closer, distant ideas fade back.",
  "sidebar.graph.coachTip3": "Shift+drag on empty space to lasso several notes — then tag them or add them to a scenario in one move.",
  "sidebar.graph.connectAsPrefix": "connect ",
  "sidebar.graph.connectAsTo": " to ",
  "sidebar.graph.connectAsSuffix": " as…",
  "sidebar.graph.connectCancel": "cancel",
  "sidebar.graph.lassoSelected": "{count} selected",
  "sidebar.graph.lassoTag": "Tag…",
  "sidebar.graph.lassoPath": "Add to scenario…",
  "sidebar.graph.lassoPathDisabled": "Create a scenario first",
  "sidebar.graph.lassoTagPlaceholder": "tag name",
  "sidebar.graph.lassoApply": "apply",
  "sidebar.graph.lassoPickPath": "pick a scenario…",
  "sidebar.graph.lassoClear": "clear",

  // TagGraph
  "sidebar.tagGraph.title": "Tag graph",
  "sidebar.tagGraph.metaOne": "{tags} tag · {links} co-occurrence — click a tag to filter the note list",
  "sidebar.tagGraph.metaMany": "{tags} tags · {links} co-occurrences — click a tag to filter the note list",
  "sidebar.tagGraph.metaTagsOne": "{tags} tag · {links} co-occurrences — click a tag to filter the note list",
  "sidebar.tagGraph.metaLinksOne": "{tags} tags · {links} co-occurrence — click a tag to filter the note list",
  "sidebar.tagGraph.empty": "no tags yet",
  "sidebar.tagGraph.recenter": "Recenter",
  "sidebar.tagGraph.emptyHint": "Use the chip row under a note's title. Tags that show up on the same notes will draw themselves together here.",
  "sidebar.tagGraph.hoverNotesOne": "on {count} note",
  "sidebar.tagGraph.hoverNotesMany": "on {count} notes",
  "sidebar.tagGraph.footerHint": "Drag a tag to reposition · scroll to zoom · Esc to close",
  "sidebar.tagGraph.close": "Close",

  // RightRail
  "sidebar.rail.writingMode": "Writing mode · click for reading",
  "sidebar.rail.readingMode": "Reading mode · click for writing",
  "sidebar.rail.map": "Map",
  "sidebar.rail.links": "Links",
  "sidebar.rail.history": "History",
  "sidebar.rail.paths": "Scenarios",
  "sidebar.rail.branchHere": "Open a scenario from here · {shortcut}",
  "sidebar.rail.outline-solid": "Outline — headings in this note",
  "sidebar.rail.tags": "Tags — browse and learn what each colour means",
  "sidebar.rail.kits": "Kits — journal, research, clinical",
  "sidebar.rail.scratchpad": "Scratchpad · {shortcut}",
  "sidebar.rail.cookMode": "Cook mode — bigger text, screen stays awake",
  "sidebar.rail.settings": "Settings",
  "sidebar.rail.expand": "Show labels",
  "sidebar.rail.collapse": "Hide labels",

  // Outline panel
  "rightsidebar.outline.empty": "No headings yet — add a `# Title` to see this note's structure here.",
  "rightsidebar.outline.untitled": "(untitled)",

  // 3.0 Writer plugin — persona rail buttons
  "plugin.writer.rail.typewriterOff": "Typewriter mode — pin the cursor mid-screen",
  "plugin.writer.rail.typewriterOn": "Typewriter mode is on — click to turn off",
  "plugin.writer.rail.streak": "Writing streak: {count}d · {today} / {goal} today",

  // 3.0 Writer plugin — status bar widget
  "plugin.writer.status.todayShort": "{count} / {goal}",
  "plugin.writer.status.streakShort": "{count}d",
  "plugin.writer.status.streakTitle": "Consecutive days you've hit your daily word goal",
  "plugin.writer.status.title":
    "{count} of {goal} words today · {streak}-day streak — click to see details",

  // 3.0 Writer plugin — streak modal
  "plugin.writer.streak.title": "Writing streak",
  "plugin.writer.streak.intro":
    "Yarrow counts the words you add across the day. Hit your goal once and the streak ticks up; miss a day and it starts again. Deletions never subtract from today's progress.",
  "plugin.writer.streak.today": "Today",
  "plugin.writer.streak.todayCounter": "{count} / {goal}",
  "plugin.writer.streak.todayHit": "Goal hit. Streak ticked. Anything more is bonus.",
  "plugin.writer.streak.todayRemaining": "{count} more to go.",
  "plugin.writer.streak.current": "Current streak",
  "plugin.writer.streak.longest": "Longest",
  "plugin.writer.streak.daySingle": "day",
  "plugin.writer.streak.dayPlural": "days",
  "plugin.writer.streak.goalLabel": "Daily goal (words)",
  "plugin.writer.streak.goalHint":
    "Pick a number you can hit on a normal day, not your best one. 250 is a solid default.",
  "plugin.writer.streak.save": "Save",
  "plugin.writer.streak.reset": "Reset streak…",
  "plugin.writer.streak.confirmReset":
    "Reset your writing streak? Today's words, current and longest streak will all return to zero.",

  // 3.0 Researcher plugin — rail buttons
  "plugin.researcher.rail.questions":
    "Open questions in this note ({count})",
  "plugin.researcher.rail.sources":
    "Sources — workspace notes tagged #source / #paper / #cite ({count})",
  "plugin.researcher.rail.newSource": "New source — scaffold a citation note",

  // 3.0 Researcher plugin — status bar widget
  "plugin.researcher.status.title":
    "{count} open question(s) in this note — click to list them",

  // 3.0 Researcher plugin — questions modal
  "plugin.researcher.questions.title": "Open questions",
  "plugin.researcher.questions.intro":
    "The `??` markers in {title}. Click any line to jump straight to it. Workspace-wide question search ships in a later 3.x release.",
  "plugin.researcher.questions.empty":
    "No open questions in this note. Type `?? ` followed by an inquiry on any line to surface it here.",
  "plugin.researcher.questions.lineLabel": "L{line}",
  "plugin.researcher.questions.tip":
    "Tip — pair `?? open question` with a `#decision` note when you've answered it.",

  // 3.0 Researcher plugin — sources modal
  "plugin.researcher.sources.title": "Sources",
  "plugin.researcher.sources.intro":
    "Every note tagged with one of {tags} shows up here, newest-first. Click to open.",
  "plugin.researcher.sources.listLabel": "Workspace sources",
  "plugin.researcher.sources.create": "+ New source",
  "plugin.researcher.sources.empty":
    "No sources tagged yet. Click \"New source\" to scaffold one, or add `#source` to any existing note.",

  // 3.0 Developer plugin — rail buttons
  "plugin.developer.rail.decisions": "Decision log ({count})",
  "plugin.developer.rail.newAdr": "New ADR — scaffold an architecture decision",
  "plugin.developer.rail.codeHighlightOff":
    "Syntax-highlighted code blocks (off — click to turn on)",
  "plugin.developer.rail.codeHighlightOn":
    "Syntax-highlighted code blocks (on — click to turn off)",

  // 3.0 Developer plugin — status bar widget
  "plugin.developer.status.title":
    "{count} #decision-tagged notes in this workspace — click to open the log",
  "plugin.developer.status.shortLabel": "{count} decisions",

  // 3.0 Developer plugin — decision log modal
  "plugin.developer.decisions.title": "Decision log",
  "plugin.developer.decisions.intro":
    "Every note tagged `#decision`, `#decided`, or `#resolved` lives here, newest-first. Click to open one — or scaffold a fresh ADR with the button on the right.",
  "plugin.developer.decisions.listLabel": "Decisions ({count})",
  "plugin.developer.decisions.create": "+ New ADR",
  "plugin.developer.decisions.empty":
    "No decisions logged yet. Click \"New ADR\" to scaffold one, or add `#decision` to any existing note.",

  // 3.0 Clinician plugin — rail buttons
  "plugin.clinician.rail.sensitive":
    "Sensitive notes — #clinical / #private / #phi / #confidential ({count})",
  "plugin.clinician.rail.followups":
    "Follow-ups — #review / #followup / #todo / #wip ({count})",
  "plugin.clinician.rail.newSession":
    "New session note — SOAP / BIRP / DAP / Intake",

  // 3.0 Clinician plugin — status bar widget
  "plugin.clinician.status.title":
    "{count} follow-up note(s) in this workspace — click to open the list",
  "plugin.clinician.status.shortLabel": "{count} follow-up",

  // 3.0 Clinician plugin — sensitive modal
  "plugin.clinician.sensitive.title": "Sensitive notes",
  "plugin.clinician.sensitive.intro":
    "Every workspace note tagged with one of `#clinical`, `#private`, `#phi`, or `#confidential`. These are the same notes Yarrow already excludes from autocomplete previews and (when sync is set up to redact) from the server-side index.",
  "plugin.clinician.sensitive.listLabel": "Sensitive notes ({count})",
  "plugin.clinician.sensitive.empty":
    "No sensitive-tagged notes yet. Add `#clinical` to a note to surface it here.",
  "plugin.clinician.sensitive.note":
    "Sync redaction is configured per-workspace in Settings → Sync.",

  // 3.0 Clinician plugin — follow-ups modal
  "plugin.clinician.followups.title": "Follow-ups",
  "plugin.clinician.followups.intro":
    "Every workspace note tagged with `#review`, `#followup`, `#todo`, or `#wip` — what's pending, in one place.",
  "plugin.clinician.followups.listLabel": "Follow-ups ({count})",
  "plugin.clinician.followups.empty":
    "Nothing pending. Tag a note `#review` or `#followup` and it lands here.",

  // 3.0 Clinician plugin — session-kit picker modal
  "plugin.clinician.sessionKit.title": "New session note",
  "plugin.clinician.sessionKit.intro":
    "Pick the note shape that fits this session. The new note gets today's date in its title and starts pre-tagged `#clinical`, so it joins the Sensitive surface immediately.",
  "plugin.clinician.sessionKit.note":
    "All four kits live in the standard kit picker too — flip on every note shape Yarrow ships with via Settings → Templates.",
  "plugin.clinician.kits.soap": "SOAP — Subjective · Objective · Assessment · Plan",
  "plugin.clinician.kits.soapDesc":
    "The general-purpose case-note structure. Best for medical and psychotherapy sessions where you want a problem-focused record.",
  "plugin.clinician.kits.birp": "BIRP — Behavior · Intervention · Response · Plan",
  "plugin.clinician.kits.birpDesc":
    "Behavioral / clinical mental health. Captures what the client did, how you intervened, how they responded.",
  "plugin.clinician.kits.dap": "DAP — Data · Assessment · Plan",
  "plugin.clinician.kits.dapDesc":
    "Compact alternative to SOAP. Best for community mental health and quick-turnaround documentation.",
  "plugin.clinician.kits.intake": "Intake / first session",
  "plugin.clinician.kits.intakeDesc":
    "Presenting concern, history, mental-status snapshot, treatment plan starter, safety check.",

  // 3.0 Cooking plugin — rail buttons
  "plugin.cooking.rail.cookModeOff":
    "Cook mode — bigger text, screen stays awake (off — click to turn on)",
  "plugin.cooking.rail.cookModeOn":
    "Cook mode is on — click to turn off",
  "plugin.cooking.rail.clipRecipe":
    "Clip a recipe from a URL",
  "plugin.cooking.rail.addToShopping":
    "Add this recipe's ingredients to the shopping list",
  "plugin.cooking.rail.addToShoppingDisabled":
    "Open a recipe note to add its ingredients to the shopping list",

  // 3.0 Cooking plugin — status bar widget
  "plugin.cooking.status.title":
    "{count} recipe(s) in this workspace — click to open the library",
  "plugin.cooking.status.shortLabel": "{count} recipes",

  // 3.0 Cooking plugin — recipes modal
  "plugin.cooking.recipes.title": "Recipe library",
  "plugin.cooking.recipes.intro":
    "Every workspace note tagged with one of {tags}, sorted newest-first. Click to open. The clipper at the top right scaffolds a new recipe from any URL.",
  "plugin.cooking.recipes.listLabel": "Workspace recipes ({count})",
  "plugin.cooking.recipes.clip": "+ Clip a recipe",
  "plugin.cooking.recipes.empty":
    "No recipes tagged yet. Click \"Clip a recipe\" to scaffold one from a URL, or add `#recipe` to any existing note.",
} as const;

export type SidebarKey = keyof typeof sidebarEN;

export const sidebarES: Record<SidebarKey, string> = {
  // NoteList — row affordances
  "sidebar.notes.selectAria": "Seleccionar {title}",
  "sidebar.notes.staleTooltip": "No se ha visitado en {days} días",
  "sidebar.notes.orphanTooltip": "Esta nota aún no está vinculada a nada",
  "sidebar.notes.starTooltip": "Nota inicial — la nota principal de tu espacio",
  "sidebar.notes.encryptedTooltip": "Cifrada",
  "sidebar.notes.privateTooltip": "Privada — nunca se sincroniza (registrada en .git/info/exclude)",
  "sidebar.notes.privateTooltipShort": "Privada — nunca se sincroniza",
  "sidebar.notes.unlinkedTooltip": "no vinculada",
  "sidebar.notes.startingNote": "Nota inicial",
  "sidebar.notes.pinned": "Fijada",
  "sidebar.notes.active": "Activa",
  "sidebar.notes.homeNote": "Nota inicial",
  "sidebar.notes.homeNoteOpenLabel": "Abrir la nota inicial de este espacio",
  "sidebar.notes.justNow": "justo ahora",
  "sidebar.notes.relMinutes": "{n} min",
  "sidebar.notes.relHours": "{n} h",
  "sidebar.notes.relDays": "{n} d",
  "sidebar.notes.relWeeks": "{n} sem",
  "sidebar.notes.relMonths": "{n} mes",

  // NoteList — pinned hero meta line
  "sidebar.notes.metaNotesOne": "{count} nota",
  "sidebar.notes.metaNotesMany": "{count} notas",
  "sidebar.notes.metaPathsOne": " · {count} escenario",
  "sidebar.notes.metaPathsMany": " · {count} escenarios",

  // NoteList — tag filter banner
  "sidebar.notes.filteringPrefix": "filtrando",
  "sidebar.notes.clearTagFilter": "Limpiar filtro de etiqueta",

  // NoteList — selection bar
  "sidebar.notes.selected": "{count} seleccionadas",
  "sidebar.notes.selectAll": "todas",
  "sidebar.notes.selectNone": "ninguna",
  "sidebar.notes.selectDelete": "eliminar",

  // NoteList — group headers
  "sidebar.notes.groupToday": "Hoy",
  "sidebar.notes.groupYesterday": "Ayer",
  "sidebar.notes.groupLastWeek": "Esta semana",
  "sidebar.notes.groupOlder": "Anteriores",
  "sidebar.notes.olderCollapse": "contraer",
  "sidebar.notes.olderMore": "+ {n} más",
  "sidebar.notes.olderShow": "+ {n} anteriores",

  // NoteList — empty states
  "sidebar.notes.emptyFilteredHint": "No hay notas con la etiqueta #{tag}. Limpia el filtro para ver el resto.",
  "sidebar.notes.clearFilter": "Limpiar filtro",
  "sidebar.notes.newNote": "+ Nueva nota",

  // NoteList — orphan section
  "sidebar.notes.orphansOne": "{count} nota sin vincular",
  "sidebar.notes.orphansMany": "{count} notas sin vincular",
  "sidebar.notes.orphansTitle": "Notas que aún no tienen enlaces — solo un recordatorio",

  // NoteList — sticky footer
  "sidebar.notes.footerCountOne": "{count} nota",
  "sidebar.notes.footerCountMany": "{count} notas",
  "sidebar.notes.viewSwitchToCards": "Cambiar a vista de tarjetas",
  "sidebar.notes.viewSwitchToList": "Cambiar a vista de lista",
  "sidebar.notes.viewCards": "Vista de tarjetas",
  "sidebar.notes.viewList": "Vista de lista",
  "sidebar.notes.exitMultiSelect": "Salir de selección múltiple",
  "sidebar.notes.enterMultiSelect": "Seleccionar varias notas",
  "sidebar.notes.selectModeDone": "listo",
  "sidebar.notes.selectMode": "seleccionar",
  "sidebar.notes.newAria": "Nueva nota",
  "sidebar.notes.newShort": "Nueva",

  // NoteList — context menu
  "sidebar.notes.menuOpenInNewTab": "Abrir en nueva pestaña",
  "sidebar.notes.menuPin": "Fijar arriba",
  "sidebar.notes.menuUnpin": "Quitar fijado",
  "sidebar.notes.menuRename": "Renombrar",
  "sidebar.notes.menuCopyMd": "Copiar como Markdown",
  "sidebar.notes.menuMoveToFolder": "Mover a carpeta…",
  "sidebar.notes.menuReveal": "Mostrar en el explorador",
  "sidebar.notes.menuDecrypt": "Descifrar nota",
  "sidebar.notes.menuEncrypt": "Cifrar nota",
  "sidebar.notes.menuUnlockHint": "Desbloquea la sesión primero",
  "sidebar.notes.menuDelete": "Eliminar",

  // NoteList — rename modal
  "sidebar.notes.renameTitle": "Renombrar nota",
  "sidebar.notes.renameCancel": "cancelar",
  "sidebar.notes.renameAction": "renombrar",

  // NoteList — folder picker modal
  "sidebar.folders.title": "Mover a carpeta",
  "sidebar.folders.intro": "Las carpetas solo existen en la barra lateral — tus notas siguen siendo archivos ",
  "sidebar.folders.introMd": " en ",
  "sidebar.folders.introTrail": ".",
  "sidebar.folders.none": "(sin carpeta — mostrar en la lista por fecha)",
  "sidebar.folders.current": "actual",
  "sidebar.folders.namePlaceholder": "nombre de la carpeta",
  "sidebar.folders.create": "crear",
  "sidebar.folders.newFolder": "Nueva carpeta",
  "sidebar.folders.newFolderHint": "Las carpetas son solo de la barra lateral — tus notas siguen siendo archivos .md normales. La carpeta aparece en la barra lateral y cualquier nota que muevas a ella aterrizará aquí.",

  // JournalList
  "sidebar.journal.title": "Diario",
  "sidebar.journal.calendar": "calendario",
  "sidebar.journal.calendarTooltip": "Explorar el calendario",
  "sidebar.journal.todayTooltip": "Saltar al diario de hoy ({shortcut})",
  "sidebar.journal.today": "Hoy",

  // JournalCalendar
  "sidebar.calendar.prevMonth": "Mes anterior",
  "sidebar.calendar.nextMonth": "Mes siguiente",
  "sidebar.calendar.dayS": "D",
  "sidebar.calendar.dayM": "L",
  "sidebar.calendar.dayT": "M",
  "sidebar.calendar.dayW": "M",
  "sidebar.calendar.dayF": "V",
  "sidebar.calendar.jumpToday": "Saltar a hoy",
  "sidebar.calendar.entries": "{count} entradas",

  // ActivityMini
  "sidebar.activity.title": "Actividad",
  "sidebar.activity.window": "{days} días",
  "sidebar.activity.openTooltip": "Abrir el mapa de calor completo de actividad",
  "sidebar.activity.cellTooltipOne": "{count} checkpoint · {date}",
  "sidebar.activity.cellTooltipMany": "{count} checkpoints · {date}",
  "sidebar.activity.totalOne": "checkpoint",
  "sidebar.activity.totalMany": "checkpoints",
  "sidebar.activity.streak": "racha de {n} días",
  "sidebar.activity.loading": "leyendo el historial…",

  // PathMinimap
  "sidebar.paths.title": "Tus Escenarios",
  "sidebar.paths.helpTip": "Haz clic en el gráfico para abrir la vista completa.",
  "sidebar.paths.openTooltip": "Abrir el gráfico completo de escenarios",
  "sidebar.paths.seeAll": "ver todos los escenarios →",
  "sidebar.paths.newTooltip": "Empezar un nuevo escenario ({shortcut})",
  "sidebar.paths.nodeMembersOne": "{count} nota",
  "sidebar.paths.nodeMembersMany": "{count} notas",

  // TagList
  "sidebar.tags.title": "Etiquetas",

  // LinkedNotesList
  "sidebar.linked.title": "Notas vinculadas",
  "sidebar.linked.addTip": "Añadir conexión",
  "sidebar.linked.addAria": "Añadir conexión",
  "sidebar.linked.emptyHint": "Vincular notas le ayudará a tu yo del futuro a encontrarlas: respalda · cuestiona · viene de · pregunta abierta.",
  "sidebar.linked.addAction": "+ Añadir una conexión",
  "sidebar.linked.removeTitle": "Quitar conexión",
  "sidebar.linked.addAnother": "Añadir otra conexión",

  // OpenQuestions
  "sidebar.questions.title": "Preguntas abiertas",
  "sidebar.questions.helpTip": "Líneas que empiezan con ?? en tu nota",

  // Transclusions
  "sidebar.transclusions.title": "Incrustadas",
  "sidebar.transclusions.notFound": " · no encontrada",

  // ConnectionGraph
  "sidebar.graph.emptyHeadline": "Crea algunas notas y luego vuelve aquí.",
  "sidebar.graph.emptyHint": "El mapa muestra todas las notas de tu espacio — incluso las desconectadas — para que puedas arrastrarlas y crear relaciones.",
  "sidebar.graph.expandedTitle": "Mapa de conexiones",
  "sidebar.graph.staticHeader": "Conexiones (vista estática)",
  "sidebar.graph.staticCountOne": "{count} conexión",
  "sidebar.graph.staticCountMany": "{count} conexiones",
  "sidebar.graph.staticPickANote":
    "Abre una nota para ver qué se conecta con ella. La vista estática agrupa sus conexiones por tipo — sin movimiento, sin grafo.",
  "sidebar.graph.staticNoConnections":
    "Aún no hay conexiones aquí. Haz clic derecho en otra nota de la barra lateral y elige Conectar para empezar.",
  "sidebar.graph.staticOutgoing": "desde esta nota →",
  "sidebar.graph.staticIncoming": "← hacia esta nota",
  "sidebar.graph.expandTitle": "Abrir la vista estática en una superficie mayor",
  "sidebar.graph.expandButton": "Expandir",
  "sidebar.graph.expandedMetaOne": "{notes} notas · {links} conexión · haz clic en un nodo para abrirlo · esc para cerrar",
  "sidebar.graph.expandedMetaMany": "{notes} notas · {links} conexiones · haz clic en un nodo para abrirlo · esc para cerrar",
  "sidebar.graph.closeAria": "Cerrar",
  "sidebar.graph.hoverConnect": "arrastra para conectar",
  "sidebar.graph.hoverHighlight": "haz clic para resaltar conexiones",
  "sidebar.graph.hoverOpen": "haz clic para abrir",
  "sidebar.graph.hoverMainTag": "★ principal · ",
  "sidebar.graph.hoverConnOne": "{count} conexión · {hint}",
  "sidebar.graph.hoverConnMany": "{count} conexiones · {hint}",
  "sidebar.graph.statDirect": "directas",
  "sidebar.graph.statTotal": "totales",
  "sidebar.graph.statNotesLinks": "{notes} notas · {links} enlaces",
  "sidebar.graph.layoutForce": "fuerzas",
  "sidebar.graph.layoutChord": "cuerda",
  "sidebar.graph.layoutForceTip": "Diseño de fuerzas — la red radial por defecto",
  "sidebar.graph.layoutChordTip": "Diseño en cuerda — todas las notas en un anillo, los enlaces cruzan por el centro",
  "sidebar.graph.connectExitTip": "Salir del modo conexión — los arrastres volverán a reposicionar las notas",
  "sidebar.graph.connectEnterTip": "Modo conexión — arrastra de una nota a otra para vincularlas",
  "sidebar.graph.connecting": "conectando",
  "sidebar.graph.connect": "conectar",
  "sidebar.graph.nearbyAll": "Mostrar todas las notas",
  "sidebar.graph.nearbyOnly": "Enfocar solo cercanos",
  "sidebar.graph.recenter": "Recentrar gráfico",
  "sidebar.graph.expand": "Expandir — ver el gráfico completo",
  "sidebar.graph.spreadOn": "Separar los nodos — más fácil ver y conectar",
  "sidebar.graph.spreadOff": "Acercar los nodos — diseño más denso",
  "sidebar.graph.connectBanner": "Modo conexión — arrastra una nota sobre otra para vincularlas",
  "sidebar.graph.exit": "salir",
  "sidebar.graph.legendMain": "principal",
  "sidebar.graph.legendActive": "estás aquí",
  "sidebar.graph.legendNeighbor": "conectada",
  "sidebar.graph.legendHint": "pasa el cursor por un tipo para filtrar",
  "sidebar.graph.legendSupports": "respalda",
  "sidebar.graph.legendChallenges": "cuestiona",
  "sidebar.graph.legendCameFrom": "viene de",
  "sidebar.graph.legendOpenQuestion": "pregunta abierta",
  "sidebar.graph.controlsHint": "rueda para acercar · arrastra para mover · clic en un nodo para abrir",
  "sidebar.graph.coachTitle": "Tu gráfico aún está creciendo —",
  "sidebar.graph.coachDismiss": "descartar",
  "sidebar.graph.coachDismissTitle": "Ocultar estos consejos",
  "sidebar.graph.coachTip1": "Haz clic en “conectar” en la barra de herramientas, luego arrastra una nota sobre otra para vincularlas. Vuelve al modo de vista cuando termines.",
  "sidebar.graph.coachTip2": "Haz clic en cualquier nota para centrar el gráfico en ella — los vecinos se acercan, las ideas lejanas se desvanecen.",
  "sidebar.graph.coachTip3": "Mayús + arrastrar en un espacio vacío para seleccionar varias notas — luego etiquétalas o añádelas a un escenario en un solo paso.",
  "sidebar.graph.connectAsPrefix": "conectar ",
  "sidebar.graph.connectAsTo": " con ",
  "sidebar.graph.connectAsSuffix": " como…",
  "sidebar.graph.connectCancel": "cancelar",
  "sidebar.graph.lassoSelected": "{count} seleccionadas",
  "sidebar.graph.lassoTag": "Etiqueta…",
  "sidebar.graph.lassoPath": "Añadir a un escenario…",
  "sidebar.graph.lassoPathDisabled": "Crea primero un escenario",
  "sidebar.graph.lassoTagPlaceholder": "nombre de etiqueta",
  "sidebar.graph.lassoApply": "aplicar",
  "sidebar.graph.lassoPickPath": "elige un escenario…",
  "sidebar.graph.lassoClear": "limpiar",

  // TagGraph
  "sidebar.tagGraph.title": "Mapa de etiquetas",
  "sidebar.tagGraph.metaOne": "{tags} etiqueta · {links} coincidencia — haz clic en una etiqueta para filtrar la lista",
  "sidebar.tagGraph.metaMany": "{tags} etiquetas · {links} coincidencias — haz clic en una etiqueta para filtrar la lista",
  "sidebar.tagGraph.metaTagsOne": "{tags} etiqueta · {links} coincidencias — haz clic en una etiqueta para filtrar la lista",
  "sidebar.tagGraph.metaLinksOne": "{tags} etiquetas · {links} coincidencia — haz clic en una etiqueta para filtrar la lista",
  "sidebar.tagGraph.empty": "aún no hay etiquetas",
  "sidebar.tagGraph.recenter": "Recentrar",
  "sidebar.tagGraph.emptyHint": "Usa la fila de chips bajo el título de una nota. Las etiquetas que aparezcan en las mismas notas se atraerán entre sí aquí.",
  "sidebar.tagGraph.hoverNotesOne": "en {count} nota",
  "sidebar.tagGraph.hoverNotesMany": "en {count} notas",
  "sidebar.tagGraph.footerHint": "Arrastra una etiqueta para reposicionarla · rueda para acercar · Esc para cerrar",
  "sidebar.tagGraph.close": "Cerrar",

  // RightRail
  "sidebar.rail.writingMode": "Modo escritura · clic para lectura",
  "sidebar.rail.readingMode": "Modo lectura · clic para escritura",
  "sidebar.rail.map": "Mapa",
  "sidebar.rail.links": "Enlaces",
  "sidebar.rail.history": "Historial",
  "sidebar.rail.paths": "Escenarios",
  "sidebar.rail.branchHere": "Ramificar desde aquí · {shortcut}",
  "sidebar.rail.outline-solid": "Esquema — encabezados de esta nota",
  "rightsidebar.outline.empty": "Aún no hay encabezados — añade un `# Título` para ver la estructura de esta nota aquí.",
  "rightsidebar.outline.untitled": "(sin título)",
  "sidebar.rail.tags": "Etiquetas — explora y aprende qué significa cada color",
  "sidebar.rail.kits": "Kits — diario, investigación, clínico",
  "sidebar.rail.scratchpad": "Borrador · {shortcut}",
  "sidebar.rail.cookMode": "Modo cocina — texto grande, pantalla siempre encendida",
  "sidebar.rail.settings": "Ajustes",
  "sidebar.rail.expand": "Mostrar etiquetas",
  "sidebar.rail.collapse": "Ocultar etiquetas",

  "plugin.writer.rail.typewriterOff": "Modo máquina de escribir — fija el cursor a media pantalla",
  "plugin.writer.rail.typewriterOn": "Modo máquina de escribir activo — clic para apagar",
  "plugin.writer.rail.streak": "Racha de escritura: {count}d · {today} / {goal} hoy",

  "plugin.writer.status.todayShort": "{count} / {goal}",
  "plugin.writer.status.streakShort": "{count}d",
  "plugin.writer.status.streakTitle": "Días seguidos cumpliendo tu meta diaria",
  "plugin.writer.status.title":
    "{count} de {goal} palabras hoy · racha de {streak} días — clic para ver detalles",

  "plugin.writer.streak.title": "Racha de escritura",
  "plugin.writer.streak.intro":
    "Yarrow cuenta las palabras que añades durante el día. Cumple la meta una vez y la racha sube; pierde un día y vuelve a empezar. Borrar no resta a tu progreso de hoy.",
  "plugin.writer.streak.today": "Hoy",
  "plugin.writer.streak.todayCounter": "{count} / {goal}",
  "plugin.writer.streak.todayHit": "Meta cumplida. Racha sumada. Lo que escribas más es ganancia.",
  "plugin.writer.streak.todayRemaining": "Faltan {count} palabras.",
  "plugin.writer.streak.current": "Racha actual",
  "plugin.writer.streak.longest": "Más larga",
  "plugin.writer.streak.daySingle": "día",
  "plugin.writer.streak.dayPlural": "días",
  "plugin.writer.streak.goalLabel": "Meta diaria (palabras)",
  "plugin.writer.streak.goalHint":
    "Elige un número que puedas cumplir en un día normal, no en tu mejor día. 250 es un buen punto de partida.",
  "plugin.writer.streak.save": "Guardar",
  "plugin.writer.streak.reset": "Reiniciar racha…",
  "plugin.writer.streak.confirmReset":
    "¿Reiniciar tu racha de escritura? Las palabras de hoy, la racha actual y la más larga volverán a cero.",

  "plugin.researcher.rail.questions":
    "Preguntas abiertas en esta nota ({count})",
  "plugin.researcher.rail.sources":
    "Fuentes — notas etiquetadas #source / #paper / #cite ({count})",
  "plugin.researcher.rail.newSource":
    "Nueva fuente — crea una nota de cita",

  "plugin.researcher.status.title":
    "{count} pregunta(s) abierta(s) en esta nota — clic para listarlas",

  "plugin.researcher.questions.title": "Preguntas abiertas",
  "plugin.researcher.questions.intro":
    "Los marcadores `??` en {title}. Haz clic en una línea para saltar a ella. La búsqueda de preguntas en todo el espacio llegará en una versión 3.x posterior.",
  "plugin.researcher.questions.empty":
    "No hay preguntas abiertas en esta nota. Escribe `?? ` seguido de una pregunta en cualquier línea para verla aquí.",
  "plugin.researcher.questions.lineLabel": "L{line}",
  "plugin.researcher.questions.tip":
    "Consejo — empareja `?? pregunta abierta` con una nota `#decision` cuando la hayas respondido.",

  "plugin.researcher.sources.title": "Fuentes",
  "plugin.researcher.sources.intro":
    "Cada nota etiquetada con una de {tags} aparece aquí, más reciente primero. Haz clic para abrir.",
  "plugin.researcher.sources.listLabel": "Fuentes del espacio",
  "plugin.researcher.sources.create": "+ Nueva fuente",
  "plugin.researcher.sources.empty":
    "Aún no hay fuentes etiquetadas. Haz clic en \"Nueva fuente\" para crear una, o añade `#source` a cualquier nota existente.",

  "plugin.developer.rail.decisions": "Registro de decisiones ({count})",
  "plugin.developer.rail.newAdr":
    "Nuevo ADR — crea un registro de decisión arquitectónica",
  "plugin.developer.rail.codeHighlightOff":
    "Resaltado de sintaxis en bloques de código (off — clic para activar)",
  "plugin.developer.rail.codeHighlightOn":
    "Resaltado de sintaxis en bloques de código (on — clic para desactivar)",

  "plugin.developer.status.title":
    "{count} notas con #decision en este espacio — clic para abrir el registro",
  "plugin.developer.status.shortLabel": "{count} decisiones",

  "plugin.developer.decisions.title": "Registro de decisiones",
  "plugin.developer.decisions.intro":
    "Cada nota etiquetada con `#decision`, `#decided` o `#resolved` vive aquí, más reciente primero. Haz clic para abrir una — o crea un ADR nuevo con el botón de la derecha.",
  "plugin.developer.decisions.listLabel": "Decisiones ({count})",
  "plugin.developer.decisions.create": "+ Nuevo ADR",
  "plugin.developer.decisions.empty":
    "Aún no hay decisiones registradas. Haz clic en \"Nuevo ADR\" para crear una, o añade `#decision` a cualquier nota existente.",

  "plugin.clinician.rail.sensitive":
    "Notas sensibles — #clinical / #private / #phi / #confidential ({count})",
  "plugin.clinician.rail.followups":
    "Seguimientos — #review / #followup / #todo / #wip ({count})",
  "plugin.clinician.rail.newSession":
    "Nueva nota de sesión — SOAP / BIRP / DAP / Acogida",

  "plugin.clinician.status.title":
    "{count} nota(s) de seguimiento en este espacio — clic para abrir la lista",
  "plugin.clinician.status.shortLabel": "{count} seguimientos",

  "plugin.clinician.sensitive.title": "Notas sensibles",
  "plugin.clinician.sensitive.intro":
    "Todas las notas del espacio etiquetadas con `#clinical`, `#private`, `#phi` o `#confidential`. Son las mismas que Yarrow ya excluye del autocompletado y (cuando la sincronización está configurada para censurar) del índice del servidor.",
  "plugin.clinician.sensitive.listLabel": "Notas sensibles ({count})",
  "plugin.clinician.sensitive.empty":
    "Aún no hay notas sensibles. Añade `#clinical` a una nota para verla aquí.",
  "plugin.clinician.sensitive.note":
    "La censura de sincronización se configura por espacio en Ajustes → Sincronización.",

  "plugin.clinician.followups.title": "Seguimientos",
  "plugin.clinician.followups.intro":
    "Todas las notas etiquetadas con `#review`, `#followup`, `#todo` o `#wip` — lo pendiente, en un solo lugar.",
  "plugin.clinician.followups.listLabel": "Seguimientos ({count})",
  "plugin.clinician.followups.empty":
    "Nada pendiente. Etiqueta una nota como `#review` o `#followup` y aparecerá aquí.",

  "plugin.clinician.sessionKit.title": "Nueva nota de sesión",
  "plugin.clinician.sessionKit.intro":
    "Elige la estructura que encaje con esta sesión. La nota nueva lleva la fecha de hoy en el título y la etiqueta `#clinical`, así se une de inmediato a la lista de sensibles.",
  "plugin.clinician.sessionKit.note":
    "Las cuatro plantillas también viven en el selector estándar — gestiónalas desde Ajustes → Plantillas.",
  "plugin.clinician.kits.soap": "SOAP — Subjetivo · Objetivo · Evaluación · Plan",
  "plugin.clinician.kits.soapDesc":
    "Estructura general de nota clínica. Buena para sesiones médicas y psicoterapéuticas con foco en el problema.",
  "plugin.clinician.kits.birp": "BIRP — Conducta · Intervención · Respuesta · Plan",
  "plugin.clinician.kits.birpDesc":
    "Salud mental conductual. Recoge lo que hizo el cliente, cómo intervienes y cómo responde.",
  "plugin.clinician.kits.dap": "DAP — Datos · Evaluación · Plan",
  "plugin.clinician.kits.dapDesc":
    "Alternativa más compacta a SOAP. Buena para salud mental comunitaria y documentación rápida.",
  "plugin.clinician.kits.intake": "Acogida / primera sesión",
  "plugin.clinician.kits.intakeDesc":
    "Motivo de consulta, historia, estado mental, plan de tratamiento inicial, evaluación de riesgo.",

  "plugin.cooking.rail.cookModeOff":
    "Modo cocina — texto grande, pantalla siempre encendida (off — clic para activar)",
  "plugin.cooking.rail.cookModeOn":
    "Modo cocina activo — clic para desactivar",
  "plugin.cooking.rail.clipRecipe":
    "Recortar una receta desde una URL",
  "plugin.cooking.rail.addToShopping":
    "Añadir los ingredientes de esta receta a la lista de la compra",
  "plugin.cooking.rail.addToShoppingDisabled":
    "Abre una nota de receta para añadir sus ingredientes a la lista",

  "plugin.cooking.status.title":
    "{count} receta(s) en este espacio — clic para abrir la biblioteca",
  "plugin.cooking.status.shortLabel": "{count} recetas",

  "plugin.cooking.recipes.title": "Biblioteca de recetas",
  "plugin.cooking.recipes.intro":
    "Cada nota etiquetada con una de {tags}, más reciente primero. Haz clic para abrir. El recortador arriba a la derecha crea una receta nueva desde cualquier URL.",
  "plugin.cooking.recipes.listLabel": "Recetas del espacio ({count})",
  "plugin.cooking.recipes.clip": "+ Recortar receta",
  "plugin.cooking.recipes.empty":
    "Aún no hay recetas etiquetadas. Haz clic en \"Recortar receta\" para crear una desde una URL, o añade `#recipe` a una nota existente.",
};

export const sidebarSV: Record<SidebarKey, string> = {
  // NoteList — row affordances
  "sidebar.notes.selectAria": "Markera {title}",
  "sidebar.notes.staleTooltip": "Har inte besökts på {days} dagar",
  "sidebar.notes.orphanTooltip": "Den här anteckningen är inte länkad ännu",
  "sidebar.notes.starTooltip": "Startanteckning — arbetsytans huvudanteckning",
  "sidebar.notes.encryptedTooltip": "Krypterad",
  "sidebar.notes.privateTooltip": "Privat — synkas aldrig (registrerad i .git/info/exclude)",
  "sidebar.notes.privateTooltipShort": "Privat — synkas aldrig",
  "sidebar.notes.unlinkedTooltip": "ej länkad",
  "sidebar.notes.startingNote": "Startanteckning",
  "sidebar.notes.pinned": "Fäst",
  "sidebar.notes.active": "Aktiv",
  "sidebar.notes.homeNote": "Hemanteckning",
  "sidebar.notes.homeNoteOpenLabel": "Öppna arbetsytans hemanteckning",
  "sidebar.notes.justNow": "just nu",
  "sidebar.notes.relMinutes": "{n} min",
  "sidebar.notes.relHours": "{n} tim",
  "sidebar.notes.relDays": "{n} d",
  "sidebar.notes.relWeeks": "{n} v",
  "sidebar.notes.relMonths": "{n} mån",

  // NoteList — pinned hero meta line
  "sidebar.notes.metaNotesOne": "{count} anteckning",
  "sidebar.notes.metaNotesMany": "{count} anteckningar",
  "sidebar.notes.metaPathsOne": " · {count} scenario",
  "sidebar.notes.metaPathsMany": " · {count} scenarier",

  // NoteList — tag filter banner
  "sidebar.notes.filteringPrefix": "filtrerar",
  "sidebar.notes.clearTagFilter": "Rensa taggfilter",

  // NoteList — selection bar
  "sidebar.notes.selected": "{count} markerade",
  "sidebar.notes.selectAll": "alla",
  "sidebar.notes.selectNone": "inga",
  "sidebar.notes.selectDelete": "ta bort",

  // NoteList — group headers
  "sidebar.notes.groupToday": "Idag",
  "sidebar.notes.groupYesterday": "Igår",
  "sidebar.notes.groupLastWeek": "Denna vecka",
  "sidebar.notes.groupOlder": "Äldre",
  "sidebar.notes.olderCollapse": "dölj",
  "sidebar.notes.olderMore": "+ {n} till",
  "sidebar.notes.olderShow": "+ {n} äldre",

  // NoteList — empty states
  "sidebar.notes.emptyFilteredHint": "Inga anteckningar med taggen #{tag}. Rensa filtret för att se resten.",
  "sidebar.notes.clearFilter": "Rensa filter",
  "sidebar.notes.newNote": "+ Ny anteckning",

  // NoteList — orphan section
  "sidebar.notes.orphansOne": "{count} olänkad anteckning",
  "sidebar.notes.orphansMany": "{count} olänkade anteckningar",
  "sidebar.notes.orphansTitle": "Anteckningar utan länkar ännu — bara en knuff",

  // NoteList — sticky footer
  "sidebar.notes.footerCountOne": "{count} anteckning",
  "sidebar.notes.footerCountMany": "{count} anteckningar",
  "sidebar.notes.viewSwitchToCards": "Växla till kortvy",
  "sidebar.notes.viewSwitchToList": "Växla till listvy",
  "sidebar.notes.viewCards": "Kortvy",
  "sidebar.notes.viewList": "Listvy",
  "sidebar.notes.exitMultiSelect": "Avsluta urvalsläge",
  "sidebar.notes.enterMultiSelect": "Markera flera anteckningar",
  "sidebar.notes.selectModeDone": "klar",
  "sidebar.notes.selectMode": "markera",
  "sidebar.notes.newAria": "Ny anteckning",
  "sidebar.notes.newShort": "Ny",

  // NoteList — context menu
  "sidebar.notes.menuOpenInNewTab": "Öppna i ny flik",
  "sidebar.notes.menuPin": "Fäst högst upp",
  "sidebar.notes.menuUnpin": "Lossa",
  "sidebar.notes.menuRename": "Byt namn",
  "sidebar.notes.menuCopyMd": "Kopiera som Markdown",
  "sidebar.notes.menuMoveToFolder": "Flytta till mapp…",
  "sidebar.notes.menuReveal": "Visa i filhanteraren",
  "sidebar.notes.menuDecrypt": "Avkryptera anteckning",
  "sidebar.notes.menuEncrypt": "Kryptera anteckning",
  "sidebar.notes.menuUnlockHint": "Lås upp sessionen först",
  "sidebar.notes.menuDelete": "Ta bort",

  // NoteList — rename modal
  "sidebar.notes.renameTitle": "Byt namn på anteckning",
  "sidebar.notes.renameCancel": "avbryt",
  "sidebar.notes.renameAction": "byt namn",

  // NoteList — folder picker modal
  "sidebar.folders.title": "Flytta till mapp",
  "sidebar.folders.intro": "Mappar finns bara i sidofältet — dina anteckningar lever fortfarande som ",
  "sidebar.folders.introMd": "-filer i ",
  "sidebar.folders.introTrail": ".",
  "sidebar.folders.none": "(ingen mapp — visa i tidslistan)",
  "sidebar.folders.current": "nuvarande",
  "sidebar.folders.namePlaceholder": "mappnamn",
  "sidebar.folders.create": "skapa",
  "sidebar.folders.newFolder": "Ny mapp",
  "sidebar.folders.newFolderHint": "Mappar finns bara i sidofältet — dina anteckningar är fortfarande vanliga .md-filer. Mappen visas i sidofältet, och alla anteckningar du flyttar in i den hamnar här.",

  // JournalList
  "sidebar.journal.title": "Journal",
  "sidebar.journal.calendar": "kalender",
  "sidebar.journal.calendarTooltip": "Bläddra i kalendern",
  "sidebar.journal.todayTooltip": "Hoppa till dagens journal ({shortcut})",
  "sidebar.journal.today": "Idag",

  // JournalCalendar
  "sidebar.calendar.prevMonth": "Föregående månad",
  "sidebar.calendar.nextMonth": "Nästa månad",
  "sidebar.calendar.dayS": "S",
  "sidebar.calendar.dayM": "M",
  "sidebar.calendar.dayT": "T",
  "sidebar.calendar.dayW": "O",
  "sidebar.calendar.dayF": "F",
  "sidebar.calendar.jumpToday": "Hoppa till idag",
  "sidebar.calendar.entries": "{count} poster",

  // ActivityMini
  "sidebar.activity.title": "Aktivitet",
  "sidebar.activity.window": "{days} dagar",
  "sidebar.activity.openTooltip": "Öppna fullständig värmekarta",
  "sidebar.activity.cellTooltipOne": "{count} checkpoint · {date}",
  "sidebar.activity.cellTooltipMany": "{count} checkpoints · {date}",
  "sidebar.activity.totalOne": "checkpoint",
  "sidebar.activity.totalMany": "checkpoints",
  "sidebar.activity.streak": "{n} dagar i rad",
  "sidebar.activity.loading": "läser historik…",

  // PathMinimap
  "sidebar.paths.title": "Dina scenarier",
  "sidebar.paths.helpTip": "Klicka på diagrammet för att öppna fullständig vy.",
  "sidebar.paths.openTooltip": "Öppna fullständig scenariograf",
  "sidebar.paths.seeAll": "se alla scenarier →",
  "sidebar.paths.newTooltip": "Starta ett nytt scenario ({shortcut})",
  "sidebar.paths.nodeMembersOne": "{count} anteckning",
  "sidebar.paths.nodeMembersMany": "{count} anteckningar",

  // TagList
  "sidebar.tags.title": "Taggar",

  // LinkedNotesList
  "sidebar.linked.title": "Länkade anteckningar",
  "sidebar.linked.addTip": "Lägg till koppling",
  "sidebar.linked.addAria": "Lägg till koppling",
  "sidebar.linked.emptyHint": "Att länka anteckningar hjälper dig hitta dem senare: stödjer · utmanar · kommer från · öppen fråga.",
  "sidebar.linked.addAction": "+ Lägg till en koppling",
  "sidebar.linked.removeTitle": "Ta bort koppling",
  "sidebar.linked.addAnother": "Lägg till en till koppling",

  // OpenQuestions
  "sidebar.questions.title": "Öppna frågor",
  "sidebar.questions.helpTip": "Rader som börjar med ?? i din anteckning",

  // Transclusions
  "sidebar.transclusions.title": "Inbäddade",
  "sidebar.transclusions.notFound": " · hittas inte",

  // ConnectionGraph
  "sidebar.graph.emptyHeadline": "Skapa några anteckningar och kom sedan tillbaka hit.",
  "sidebar.graph.emptyHint": "Kartan visar varje anteckning i ditt valv — även de utan kopplingar — så att du kan dra ihop dem till relationer.",
  "sidebar.graph.expandedTitle": "Kopplingskarta",
  "sidebar.graph.staticHeader": "Kopplingar (statisk vy)",
  "sidebar.graph.staticCountOne": "{count} koppling",
  "sidebar.graph.staticCountMany": "{count} kopplingar",
  "sidebar.graph.staticPickANote":
    "Öppna en anteckning för att se vad som kopplas till den. Den statiska vyn grupperar kopplingar efter typ — utan rörelse, utan graf.",
  "sidebar.graph.staticNoConnections":
    "Inga kopplingar än. Högerklicka på en annan anteckning i sidofältet och välj Koppla för att börja.",
  "sidebar.graph.staticOutgoing": "från denna anteckning →",
  "sidebar.graph.staticIncoming": "← till denna anteckning",
  "sidebar.graph.expandTitle": "Öppna den statiska vyn i en större yta",
  "sidebar.graph.expandButton": "Expandera",
  "sidebar.graph.expandedMetaOne": "{notes} anteckningar · {links} koppling · klicka på en nod för att öppna · esc för att stänga",
  "sidebar.graph.expandedMetaMany": "{notes} anteckningar · {links} kopplingar · klicka på en nod för att öppna · esc för att stänga",
  "sidebar.graph.closeAria": "Stäng",
  "sidebar.graph.hoverConnect": "dra för att koppla",
  "sidebar.graph.hoverHighlight": "klicka för att markera kopplingar",
  "sidebar.graph.hoverOpen": "klicka för att öppna",
  "sidebar.graph.hoverMainTag": "★ huvud · ",
  "sidebar.graph.hoverConnOne": "{count} koppling · {hint}",
  "sidebar.graph.hoverConnMany": "{count} kopplingar · {hint}",
  "sidebar.graph.statDirect": "direkta",
  "sidebar.graph.statTotal": "totalt",
  "sidebar.graph.statNotesLinks": "{notes} anteckningar · {links} länkar",
  "sidebar.graph.layoutForce": "kraft",
  "sidebar.graph.layoutChord": "kord",
  "sidebar.graph.layoutForceTip": "Kraftbaserat diagram — det radiella standardnätet",
  "sidebar.graph.layoutChordTip": "Korddiagram — alla anteckningar på en yttre ring, kanter genom centrum",
  "sidebar.graph.connectExitTip": "Avsluta kopplingsläge — drag flyttar anteckningar igen",
  "sidebar.graph.connectEnterTip": "Kopplingsläge — dra från en anteckning till en annan för att länka dem",
  "sidebar.graph.connecting": "kopplar",
  "sidebar.graph.connect": "koppla",
  "sidebar.graph.nearbyAll": "Visa alla anteckningar",
  "sidebar.graph.nearbyOnly": "Bara närliggande",
  "sidebar.graph.recenter": "Centrera om",
  "sidebar.graph.expand": "Expandera — se hela diagrammet",
  "sidebar.graph.spreadOn": "Sprid ut noderna — lättare att se och koppla",
  "sidebar.graph.spreadOff": "Pack noderna tätare — kompakt layout",
  "sidebar.graph.connectBanner": "Kopplingsläge — dra en anteckning över en annan för att länka dem",
  "sidebar.graph.exit": "avsluta",
  "sidebar.graph.legendMain": "huvud",
  "sidebar.graph.legendActive": "du är här",
  "sidebar.graph.legendNeighbor": "kopplad",
  "sidebar.graph.legendHint": "håll muspekaren över en typ för att filtrera",
  "sidebar.graph.legendSupports": "stödjer",
  "sidebar.graph.legendChallenges": "utmanar",
  "sidebar.graph.legendCameFrom": "kommer från",
  "sidebar.graph.legendOpenQuestion": "öppen fråga",
  "sidebar.graph.controlsHint": "rulla för att zooma · dra för att panorera · klicka på en nod för att öppna",
  "sidebar.graph.coachTitle": "Ditt diagram växer fortfarande —",
  "sidebar.graph.coachDismiss": "avfärda",
  "sidebar.graph.coachDismissTitle": "Dölj de här tipsen",
  "sidebar.graph.coachTip1": "Klicka på ”koppla” i verktygsraden och dra sedan en anteckning över en annan för att länka dem. Växla tillbaka till visningsläge när du är klar.",
  "sidebar.graph.coachTip2": "Klicka på vilken anteckning som helst för att centrera diagrammet på den — grannar dras närmare, avlägsna idéer tonar bort.",
  "sidebar.graph.coachTip3": "Skift+drag på tom yta för att lassa flera anteckningar — tagga dem eller lägg dem i ett scenario i ett enda steg.",
  "sidebar.graph.connectAsPrefix": "koppla ",
  "sidebar.graph.connectAsTo": " till ",
  "sidebar.graph.connectAsSuffix": " som…",
  "sidebar.graph.connectCancel": "avbryt",
  "sidebar.graph.lassoSelected": "{count} markerade",
  "sidebar.graph.lassoTag": "Tagg…",
  "sidebar.graph.lassoPath": "Lägg i ett scenario…",
  "sidebar.graph.lassoPathDisabled": "Skapa ett scenario först",
  "sidebar.graph.lassoTagPlaceholder": "taggnamn",
  "sidebar.graph.lassoApply": "tillämpa",
  "sidebar.graph.lassoPickPath": "välj ett scenario…",
  "sidebar.graph.lassoClear": "rensa",

  // TagGraph
  "sidebar.tagGraph.title": "Taggdiagram",
  "sidebar.tagGraph.metaOne": "{tags} tagg · {links} samförekomst — klicka på en tagg för att filtrera listan",
  "sidebar.tagGraph.metaMany": "{tags} taggar · {links} samförekomster — klicka på en tagg för att filtrera listan",
  "sidebar.tagGraph.metaTagsOne": "{tags} tagg · {links} samförekomster — klicka på en tagg för att filtrera listan",
  "sidebar.tagGraph.metaLinksOne": "{tags} taggar · {links} samförekomst — klicka på en tagg för att filtrera listan",
  "sidebar.tagGraph.empty": "inga taggar ännu",
  "sidebar.tagGraph.recenter": "Centrera om",
  "sidebar.tagGraph.emptyHint": "Använd chiparna under en anteckningstitel. Taggar som dyker upp på samma anteckningar kommer att dras ihop här.",
  "sidebar.tagGraph.hoverNotesOne": "på {count} anteckning",
  "sidebar.tagGraph.hoverNotesMany": "på {count} anteckningar",
  "sidebar.tagGraph.footerHint": "Dra en tagg för att flytta den · rulla för att zooma · Esc för att stänga",
  "sidebar.tagGraph.close": "Stäng",

  // RightRail
  "sidebar.rail.writingMode": "Skrivläge · klicka för läsläge",
  "sidebar.rail.readingMode": "Läsläge · klicka för skrivläge",
  "sidebar.rail.map": "Karta",
  "sidebar.rail.links": "Länkar",
  "sidebar.rail.history": "Historik",
  "sidebar.rail.paths": "Scenarier",
  "sidebar.rail.branchHere": "Förgrena härifrån · {shortcut}",
  "sidebar.rail.outline-solid": "Översikt — rubriker i denna anteckning",
  "rightsidebar.outline.empty": "Inga rubriker än — lägg till `# Titel` för att se anteckningens struktur här.",
  "rightsidebar.outline.untitled": "(utan titel)",
  "sidebar.rail.tags": "Taggar — bläddra och lär dig vad varje färg betyder",
  "sidebar.rail.kits": "Kits — journal, forskning, kliniskt",
  "sidebar.rail.scratchpad": "Klotterblad · {shortcut}",
  "sidebar.rail.cookMode": "Matlagningsläge — större text, skärmen håller sig vaken",
  "sidebar.rail.settings": "Inställningar",
  "sidebar.rail.expand": "Visa etiketter",
  "sidebar.rail.collapse": "Dölj etiketter",

  "plugin.writer.rail.typewriterOff": "Skrivmaskinsläge — fäst markören mitt på skärmen",
  "plugin.writer.rail.typewriterOn": "Skrivmaskinsläge är på — klicka för att stänga av",
  "plugin.writer.rail.streak": "Skrivsvit: {count}d · {today} / {goal} idag",

  "plugin.writer.status.todayShort": "{count} / {goal}",
  "plugin.writer.status.streakShort": "{count}d",
  "plugin.writer.status.streakTitle": "Sammanhängande dagar du nått ditt dagsmål",
  "plugin.writer.status.title":
    "{count} av {goal} ord idag · {streak} dagars svit — klicka för detaljer",

  "plugin.writer.streak.title": "Skrivsvit",
  "plugin.writer.streak.intro":
    "Yarrow räknar orden du lägger till under dagen. Når du målet en gång tickar sviten upp; missa en dag och den börjar om. Att radera drar inte ifrån dagens framsteg.",
  "plugin.writer.streak.today": "Idag",
  "plugin.writer.streak.todayCounter": "{count} / {goal}",
  "plugin.writer.streak.todayHit": "Målet uppnått. Sviten har räknats. Mer skrivande är bonus.",
  "plugin.writer.streak.todayRemaining": "{count} ord kvar.",
  "plugin.writer.streak.current": "Nuvarande svit",
  "plugin.writer.streak.longest": "Längsta",
  "plugin.writer.streak.daySingle": "dag",
  "plugin.writer.streak.dayPlural": "dagar",
  "plugin.writer.streak.goalLabel": "Dagligt mål (ord)",
  "plugin.writer.streak.goalHint":
    "Välj ett antal du klarar en vanlig dag, inte din bästa. 250 är en bra grund.",
  "plugin.writer.streak.save": "Spara",
  "plugin.writer.streak.reset": "Återställ svit…",
  "plugin.writer.streak.confirmReset":
    "Återställa din skrivsvit? Dagens ord, nuvarande och längsta svit nollställs alla.",

  "plugin.researcher.rail.questions":
    "Öppna frågor i denna anteckning ({count})",
  "plugin.researcher.rail.sources":
    "Källor — anteckningar märkta #source / #paper / #cite ({count})",
  "plugin.researcher.rail.newSource":
    "Ny källa — skapa en citatanteckning",

  "plugin.researcher.status.title":
    "{count} öppen/öppna fråga/frågor i denna anteckning — klicka för att lista dem",

  "plugin.researcher.questions.title": "Öppna frågor",
  "plugin.researcher.questions.intro":
    "`??`-markörerna i {title}. Klicka på en rad för att hoppa direkt dit. Sök efter frågor i hela arbetsytan kommer i en senare 3.x-version.",
  "plugin.researcher.questions.empty":
    "Inga öppna frågor i denna anteckning. Skriv `?? ` följt av en fråga på valfri rad för att visa den här.",
  "plugin.researcher.questions.lineLabel": "R{line}",
  "plugin.researcher.questions.tip":
    "Tips — para `?? öppen fråga` med en `#decision`-anteckning när du svarat på den.",

  "plugin.researcher.sources.title": "Källor",
  "plugin.researcher.sources.intro":
    "Varje anteckning märkt med någon av {tags} visas här, nyaste först. Klicka för att öppna.",
  "plugin.researcher.sources.listLabel": "Arbetsytans källor",
  "plugin.researcher.sources.create": "+ Ny källa",
  "plugin.researcher.sources.empty":
    "Inga källor märkta än. Klicka på \"Ny källa\" för att skapa en, eller lägg till `#source` på en befintlig anteckning.",

  "plugin.developer.rail.decisions": "Beslutsregister ({count})",
  "plugin.developer.rail.newAdr":
    "Nytt ADR — skapa ett arkitekturbeslut",
  "plugin.developer.rail.codeHighlightOff":
    "Syntaxfärgade kodblock (av — klicka för att slå på)",
  "plugin.developer.rail.codeHighlightOn":
    "Syntaxfärgade kodblock (på — klicka för att stänga av)",

  "plugin.developer.status.title":
    "{count} anteckningar med #decision i denna arbetsyta — klicka för att öppna registret",
  "plugin.developer.status.shortLabel": "{count} beslut",

  "plugin.developer.decisions.title": "Beslutsregister",
  "plugin.developer.decisions.intro":
    "Varje anteckning märkt med `#decision`, `#decided` eller `#resolved` lever här, nyaste först. Klicka för att öppna en — eller skapa ett nytt ADR med knappen till höger.",
  "plugin.developer.decisions.listLabel": "Beslut ({count})",
  "plugin.developer.decisions.create": "+ Nytt ADR",
  "plugin.developer.decisions.empty":
    "Inga beslut loggade än. Klicka på \"Nytt ADR\" för att skapa ett, eller lägg till `#decision` på en befintlig anteckning.",

  "plugin.clinician.rail.sensitive":
    "Känsliga anteckningar — #clinical / #private / #phi / #confidential ({count})",
  "plugin.clinician.rail.followups":
    "Uppföljningar — #review / #followup / #todo / #wip ({count})",
  "plugin.clinician.rail.newSession":
    "Ny sessionsanteckning — SOAP / BIRP / DAP / Inskrivning",

  "plugin.clinician.status.title":
    "{count} uppföljningsanteckning(ar) i denna arbetsyta — klicka för att öppna listan",
  "plugin.clinician.status.shortLabel": "{count} uppföljningar",

  "plugin.clinician.sensitive.title": "Känsliga anteckningar",
  "plugin.clinician.sensitive.intro":
    "Alla anteckningar märkta med `#clinical`, `#private`, `#phi` eller `#confidential`. Samma anteckningar som Yarrow redan utelämnar från autoförslag och (när synk är konfigurerad att maska) från serverindexet.",
  "plugin.clinician.sensitive.listLabel": "Känsliga anteckningar ({count})",
  "plugin.clinician.sensitive.empty":
    "Inga känsliga anteckningar än. Lägg till `#clinical` på en anteckning för att se den här.",
  "plugin.clinician.sensitive.note":
    "Maskning vid synk konfigureras per arbetsyta i Inställningar → Synkronisering.",

  "plugin.clinician.followups.title": "Uppföljningar",
  "plugin.clinician.followups.intro":
    "Alla anteckningar märkta med `#review`, `#followup`, `#todo` eller `#wip` — det som är pågående, på ett ställe.",
  "plugin.clinician.followups.listLabel": "Uppföljningar ({count})",
  "plugin.clinician.followups.empty":
    "Inget pågår. Märk en anteckning `#review` eller `#followup` så hamnar den här.",

  "plugin.clinician.sessionKit.title": "Ny sessionsanteckning",
  "plugin.clinician.sessionKit.intro":
    "Välj formen som passar denna session. Den nya anteckningen får dagens datum i titeln och startar med `#clinical`, så den blir en del av Känsliga-listan direkt.",
  "plugin.clinician.sessionKit.note":
    "Alla fyra mallar finns även i den vanliga mallväljaren — hantera dem via Inställningar → Mallar.",
  "plugin.clinician.kits.soap": "SOAP — Subjektivt · Objektivt · Bedömning · Plan",
  "plugin.clinician.kits.soapDesc":
    "Allmän klinisk struktur. Bra för medicinska och psykoterapeutiska sessioner där du vill ha en problemfokuserad anteckning.",
  "plugin.clinician.kits.birp": "BIRP — Beteende · Intervention · Respons · Plan",
  "plugin.clinician.kits.birpDesc":
    "Beteendeinriktad psykisk hälsa. Fångar vad klienten gjorde, hur du intervenerade, hur de svarade.",
  "plugin.clinician.kits.dap": "DAP — Data · Bedömning · Plan",
  "plugin.clinician.kits.dapDesc":
    "Kompakt alternativ till SOAP. Bra för psykiatrisk öppenvård och snabb dokumentation.",
  "plugin.clinician.kits.intake": "Inskrivning / första session",
  "plugin.clinician.kits.intakeDesc":
    "Aktuell problematik, historik, status, behandlingsplan-start, säkerhetsbedömning.",

  "plugin.cooking.rail.cookModeOff":
    "Matlagningsläge — större text, skärmen håller sig vaken (av — klicka för att slå på)",
  "plugin.cooking.rail.cookModeOn":
    "Matlagningsläge är på — klicka för att stänga av",
  "plugin.cooking.rail.clipRecipe":
    "Klipp ett recept från en URL",
  "plugin.cooking.rail.addToShopping":
    "Lägg till receptets ingredienser i inköpslistan",
  "plugin.cooking.rail.addToShoppingDisabled":
    "Öppna en receptanteckning för att lägga ingredienserna i inköpslistan",

  "plugin.cooking.status.title":
    "{count} recept i denna arbetsyta — klicka för att öppna biblioteket",
  "plugin.cooking.status.shortLabel": "{count} recept",

  "plugin.cooking.recipes.title": "Receptbibliotek",
  "plugin.cooking.recipes.intro":
    "Varje anteckning märkt med någon av {tags}, nyaste först. Klicka för att öppna. Klipparen längst upp till höger skapar ett nytt recept från valfri URL.",
  "plugin.cooking.recipes.listLabel": "Arbetsytans recept ({count})",
  "plugin.cooking.recipes.clip": "+ Klipp recept",
  "plugin.cooking.recipes.empty":
    "Inga recept märkta än. Klicka på \"Klipp recept\" för att skapa ett från en URL, eller lägg till `#recipe` på en befintlig anteckning.",
};
