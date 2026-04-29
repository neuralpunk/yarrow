// Settings panes (writing, guidance, templates, sync, storage,
// security, workspace, shortcuts, about). Appearance lives in its
// own module since it landed earlier.

export const settingsEN = {
  // ── shell ──
  "settings.title": "Settings",
  "settings.searchPlaceholder": "Search…",
  "settings.escToClose": "esc to close",
  "settings.closeAria": "Close settings",
  "settings.closeTitle": "Close (Esc)",

  // ── tabs ──
  "settings.tabs.mode": "Modes & Personas",
  "settings.tabs.appearance": "Appearance",
  "settings.tabs.accessibility": "Accessibility",
  "settings.tabs.writing": "Writing",
  "settings.tabs.gestures": "Gestures",
  "settings.tabs.guidance": "Guidance",
  "settings.tabs.templates": "Templates",
  "settings.tabs.sync": "Sync",
  "settings.tabs.storage": "Storage",
  "settings.tabs.security": "Security",
  "settings.tabs.workspace": "Workspace",
  "settings.tabs.shortcuts": "Shortcuts",
  "settings.tabs.help": "Help",
  "settings.tabs.about": "About",

  // ── nav groups (3.1) ──
  "settings.nav.group.experience": "Experience",
  "settings.nav.group.content": "Content",
  "settings.nav.group.system": "System",
  "settings.nav.group.about": "About",

  // ── scope chips (3.1) ──
  "settings.scope.device": "Device",
  "settings.scope.workspace": "Workspace",
  "settings.scope.account": "Account",
  "settings.scope.mixed": "Mixed",
  "settings.scope.device.title":
    "Saved on this machine only — won't travel to other devices.",
  "settings.scope.workspace.title":
    "Travels with this notebook. Other devices that open the same workspace will see this.",
  "settings.scope.account.title":
    "Applies everywhere you sign in.",
  "settings.scope.mixed.title":
    "This pane has a mix of device-local and workspace-scoped settings — check each row.",

  // ── mode pane ──
  "settings.mode.title": "Modes & Personas",
  "settings.mode.hint":
    "Modes set the overall complexity. Personas layer craft-specific tools on top — both are reversible, and ⌘K reaches everything either of them hides.",
  "settings.mode.modeSection": "Mode",
  "settings.mode.personaSection": "Persona",
  "settings.mode.personaIntro":
    "Optional. A persona is a skin on top of Scenario-Based — it adds craft-specific tools without locking anything else away.",
  "settings.mode.personaNone": "None",
  "settings.mode.personaNoneDesc":
    "Plain Scenario-Based. The full Yarrow surface, no persona skin.",
  "settings.mode.footerNote":
    "Modes bias the rail and the palette; they never gate features. You can change this any time.",
  "settings.mode.option.basic.label": "Basic",
  "settings.mode.option.basic.desc":
    "Just write. No scenarios, no graph, no extras — auto-checkpointing still runs in the background.",
  "settings.mode.option.basic.bullet1": "Plain notes, tags, and scratchpad",
  "settings.mode.option.basic.bullet2": "No scenarios, graph, or kits in the rail",
  "settings.mode.option.basic.bullet3": "Auto-checkpointing keeps every save in the background",
  "settings.mode.option.basic.bullet4": "Everything still reachable via ⌘K",
  "settings.mode.option.path.label": "Scenario-Based",
  "settings.mode.option.path.desc":
    "The full Yarrow surface, no persona skin. The default for users who want everything Yarrow can do.",
  "settings.mode.option.path.bullet1": "Scenarios and reciprocal connections",
  "settings.mode.option.path.bullet2": "Force-directed connections graph",
  "settings.mode.option.path.bullet3": "History timeline and orphan panel",
  "settings.mode.option.path.bullet4": "Kits picker and full keyboard surface",
  "settings.mode.option.writer.label": "Writer",
  "settings.mode.option.writer.desc":
    "Scenario-Based + writer tools. A quiet, focused surface for prose.",
  "settings.mode.option.writer.bullet1": "Daily writing streak with a goal pill",
  "settings.mode.option.writer.bullet2": "Typewriter mode toggle",
  "settings.mode.option.writer.bullet3": "Quiet scenario chrome — focus on prose",
  "settings.mode.option.writer.bullet4": "Word count and progress meter in the status bar",
  "settings.mode.option.researcher.label": "Researcher",
  "settings.mode.option.researcher.desc":
    "Scenario-Based + research tools. For sourcing, citations, and open questions.",
  "settings.mode.option.researcher.bullet1": "Open questions panel (?? markers)",
  "settings.mode.option.researcher.bullet2": "Source library with filter helpers",
  "settings.mode.option.researcher.bullet3": "Source scaffolder for new references",
  "settings.mode.option.researcher.bullet4": "?? count pill in the status bar",
  "settings.mode.option.developer.label": "Developer",
  "settings.mode.option.developer.desc":
    "Scenario-Based + engineering tools. For decisions, code, and topology.",
  "settings.mode.option.developer.bullet1": "Decision log (ADR list)",
  "settings.mode.option.developer.bullet2": "ADR scaffolder for new decisions",
  "settings.mode.option.developer.bullet3": "Code syntax highlighting toggle",
  "settings.mode.option.developer.bullet4": "Decisions count pill in the status bar",
  "settings.mode.option.clinician.label": "Clinician",
  "settings.mode.option.clinician.desc":
    "Scenario-Based + clinical tools. For sensitive notes, follow-ups, and session structure.",
  "settings.mode.option.clinician.bullet1": "Sensitive notes roster",
  "settings.mode.option.clinician.bullet2": "Follow-ups board (#review, #followup, #todo, #wip)",
  "settings.mode.option.clinician.bullet3": "SOAP / BIRP / DAP / Intake session scaffolders",
  "settings.mode.option.clinician.bullet4": "Audit trail via auto-checkpoints",
  "settings.mode.option.cooking.label": "Cooking",
  "settings.mode.option.cooking.desc":
    "Scenario-Based + kitchen tools. For recipes, hands-free reading, and shopping.",
  "settings.mode.option.cooking.bullet1": "Cook mode with hands-free reading",
  "settings.mode.option.cooking.bullet2": "Recipe URL clipper",
  "settings.mode.option.cooking.bullet3": "Smart shopping list builder",
  "settings.mode.option.cooking.bullet4": "Recipe library and inline timers",

  // ── search ──
  "settings.search.empty":
    'Nothing matches "{query}". Try a word like "font", "sync", or "password".',
  "settings.search.resultsCount": "{count} result for \"{query}\"",
  "settings.search.resultsCountPlural": "{count} results for \"{query}\"",

  // search index entries (label / sublabel)
  "settings.search.mode.label": "Modes & Personas",
  "settings.search.mode.sublabel":
    "Basic · Scenario-Based · Writer · Researcher · Developer · Clinician · Cooking",
  "settings.search.appearance.theme.label": "Theme",
  "settings.search.appearance.theme.sublabel":
    "light · dark · auto · ashrose · dracula",
  "settings.search.appearance.size.label": "Interface size",
  "settings.search.appearance.size.sublabel": "compact · cozy · roomy",
  "settings.search.appearance.font.label": "Interface font",
  "settings.search.appearance.font.sublabel": "Inter · serif options",

  "settings.search.accessibility.label": "Accessibility",
  "settings.search.accessibility.sublabel":
    "vision · motion · motor · cognitive · screen reader · color",
  "settings.search.accessibility.contrast.label": "Contrast",
  "settings.search.accessibility.dyslexia.label": "Dyslexia-friendly font",
  "settings.search.accessibility.motion.label": "Reduce motion",

  "settings.search.writing.autosave.label": "Save every change after",
  "settings.search.writing.autosave.sublabel": "autosave debounce",
  "settings.search.writing.askThinking.label":
    "Ask what I was thinking on close",
  "settings.search.writing.fadeNotes.label": "Fade notes unvisited for",
  "settings.search.writing.editorFontSize.label": "Editor font size",
  "settings.search.writing.focusDefault.label":
    "Open workspaces in focus mode",
  "settings.search.writing.rawMarkdown.label": "Show raw markdown syntax",
  "settings.search.writing.editorFont.label": "Editor font",

  "settings.search.guidance.guidedMode.label": "Guided mode",
  "settings.search.guidance.guidedMode.sublabel":
    "hand-holding for complex features",
  "settings.search.guidance.reset.label": "Reset guidance",
  "settings.search.guidance.reset.sublabel":
    "see all the teaching modals again",

  "settings.search.templates.label": "Templates",
  "settings.search.templates.sublabel": "reusable note scaffolds",

  "settings.search.sync.repo.label": "Sync URL",
  "settings.search.sync.token.label": "Access token",
  "settings.search.sync.server.label": "Yarrow server",
  "settings.search.sync.server.sublabel": "self-hosted or Connect",
  "settings.search.sync.disconnect.label": "Disconnect server",

  "settings.search.security.localEnc.label": "Local encryption",
  "settings.search.security.localEnc.sublabel":
    "password + recovery phrase",
  "settings.search.security.idleLock.label": "Idle auto-lock",
  "settings.search.security.changePw.label": "Change password",
  "settings.search.security.recovery.label": "Recovery phrase",
  "settings.search.security.turnOff.label": "Turn off encryption",

  "settings.search.workspace.name.label": "Name",
  "settings.search.workspace.name.sublabel": "shown in the sidebar",
  "settings.search.workspace.folder.label": "Folder",
  "settings.search.workspace.folder.sublabel": "where your notes live",
  "settings.search.workspace.export.label": "Export as a static site",
  "settings.search.workspace.trim.label": "Trim checkpoint history",
  "settings.search.workspace.trim.sublabel": "forget old snapshots",
  "settings.search.workspace.close.label": "Close this workspace",

  "settings.search.shortcuts.label": "Keyboard shortcuts",

  "settings.search.about.label": "About Yarrow",
  "settings.search.about.sublabel": "version, links",

  // ── accessibility pane (3.1) ──
  "settings.accessibility.title": "Accessibility",
  "settings.accessibility.hint":
    "Adjust how Yarrow looks and behaves so it works for the way you read, type, and move. Every setting here is local to this machine.",

  "settings.accessibility.presets.title": "One-click presets",
  "settings.accessibility.presets.body":
    "Apply a tested bundle of changes in one go. You can still adjust any individual control afterwards — presets aren't locks.",
  "settings.accessibility.presets.changeCount": "Changes {count} settings · all reversible",

  "settings.accessibility.presets.low-vision.label": "Low vision",
  "settings.accessibility.presets.low-vision.desc":
    "Bigger text, higher-contrast palette, larger cursor, high-visibility focus ring.",
  "settings.accessibility.presets.dyslexia-friendly.label": "Dyslexia-friendly",
  "settings.accessibility.presets.dyslexia-friendly.desc":
    "Atkinson-style font, reading guide on, spell-check off — fewer red marks while you write.",
  "settings.accessibility.presets.reduced-motion.label": "Reduced motion",
  "settings.accessibility.presets.reduced-motion.desc":
    "Disables animations, autoplay, and transparency effects. Useful for vestibular sensitivity.",
  "settings.accessibility.presets.motor-friendly.label": "Motor-friendly",
  "settings.accessibility.presets.motor-friendly.desc":
    "Larger tap targets, sticky-keys-aware shortcut hints, no press-and-hold gestures.",

  "settings.accessibility.vision.title": "Vision",
  "settings.accessibility.vision.textScale.label": "Text size",
  "settings.accessibility.vision.textScale.hint":
    "Scales every UI text and editor body text together. The editor's own font-size setting still works on top of this.",
  "settings.accessibility.vision.contrast.label": "Contrast",
  "settings.accessibility.vision.contrast.hint":
    "Default = the shipped palette. High = AAA-level contrast version of your theme. Maximum = true black-and-white regardless of theme.",
  "settings.accessibility.vision.contrast.option.default": "Default",
  "settings.accessibility.vision.contrast.option.high": "High (AAA)",
  "settings.accessibility.vision.contrast.option.maximum": "Maximum",
  "settings.accessibility.vision.reduceTransparency.label": "Reduce transparency",
  "settings.accessibility.vision.reduceTransparency.hint":
    "Disables blur-sm and translucency on modal backdrops and popovers — cleaner edges, easier to read.",
  "settings.accessibility.vision.largerCursor.label": "Larger cursor",
  "settings.accessibility.vision.largerCursor.hint":
    "Bigger caret in the editor and a thicker focus indicator on selection.",
  "settings.accessibility.vision.dyslexiaFont.label": "Dyslexia-friendly font",
  "settings.accessibility.vision.dyslexiaFont.hint":
    "Switches editor text to Atkinson Hyperlegible. Doesn't change UI chrome — that's still your usual face.",

  "settings.accessibility.motion.title": "Motion",
  "settings.accessibility.motion.reduceMotion.label": "Reduce motion",
  "settings.accessibility.motion.reduceMotion.hint":
    "Auto follows your OS setting. On forces every animation off; off keeps them on regardless.",
  "settings.accessibility.motion.reduceMotion.option.auto": "Auto (system)",
  "settings.accessibility.motion.reduceMotion.option.on": "On",
  "settings.accessibility.motion.reduceMotion.option.off": "Off",
  "settings.accessibility.motion.disableAutoplay.label": "Disable autoplay",
  "settings.accessibility.motion.disableAutoplay.hint":
    "Stops the connections graph and similar visualisations from animating until you explicitly ask.",

  "settings.accessibility.motor.title": "Motor",
  "settings.accessibility.motor.largeTargets.label": "Larger hit targets",
  "settings.accessibility.motor.largeTargets.hint":
    "Bumps every interactive element to at least 44×44 pt — easier to hit with a trackpad or touch.",
  "settings.accessibility.motor.stickyKeys.label": "Sticky-keys aware",
  "settings.accessibility.motor.stickyKeys.hint":
    "Show shortcuts as sequences (⌘ then K) instead of chords (⌘K) — useful with the OS sticky-keys feature.",
  "settings.accessibility.motor.plainContextMenu.label":
    "Use plain right-click menu instead of radial",
  "settings.accessibility.motor.plainContextMenu.hint":
    "Replaces the press-and-hold radial menu with a standard vertical context menu — kinder for tremor, RSI, arthritis, or anyone who finds press-and-hold gestures painful.",
  "settings.gestures.disabled.title":
    "Gestures are disabled in Accessibility",
  "settings.gestures.disabled.body":
    "You've turned off the radial right-click menu under Accessibility → Motor. Re-enable it there and these gesture bindings will start working again.",
  "settings.gestures.disabled.openA11y": "Open Accessibility →",
  "settings.accessibility.viz.title": "Visualizations",
  "settings.accessibility.viz.animateGraph.label": "Animate the connections graph",
  "settings.accessibility.viz.animateGraph.hint":
    "Lets the force-directed simulation settle nodes when the graph opens. Turn off if subtle motion is uncomfortable; the graph still renders, just statically.",
  "settings.accessibility.viz.diffPatterns.label": "Diff patterns alongside color",
  "settings.accessibility.viz.diffPatterns.hint":
    "Adds underline + strikethrough to additions/removals so the diff stays legible without colour. Recommended on for everyone — it helps in bright light too.",
  "settings.accessibility.viz.graphTableAlt.label": "Show graph as a list",
  "settings.accessibility.viz.graphTableAlt.hint":
    "Replaces the spatial graph with a chip-grouped list of connections by relationship type. Easier for screen readers and anyone who prefers reading to scanning.",

  "settings.accessibility.cognitive.title": "Cognitive",
  "settings.accessibility.cognitive.readingGuide.label": "Reading guide",
  "settings.accessibility.cognitive.readingGuide.hint":
    "An optional horizontal bar that follows the cursor line — helps with not losing your place.",
  "settings.accessibility.cognitive.spellTone.label": "Spell-check tone",
  "settings.accessibility.cognitive.spellTone.hint":
    "Choose how misspellings are flagged. Off if you find persistent red squigglies stressful.",
  "settings.accessibility.cognitive.spellTone.option.underline": "Underline (default)",
  "settings.accessibility.cognitive.spellTone.option.highlight": "Highlight",
  "settings.accessibility.cognitive.spellTone.option.off": "Off",

  "settings.accessibility.reader.title": "Screen reader & keyboard",
  "settings.accessibility.reader.verbose.label": "Verbose announcements",
  "settings.accessibility.reader.verbose.hint":
    "Announce sync state, autosave events, and version checkpoints to screen readers as they happen.",
  "settings.accessibility.reader.focusRing.label": "Focus ring-3 style",
  "settings.accessibility.reader.focusRing.hint":
    "How visible the keyboard-focus indicator is. Subtle for matching the palette, High for clarity over aesthetics.",
  "settings.accessibility.reader.focusRing.option.subtle": "Subtle",
  "settings.accessibility.reader.focusRing.option.default": "Default",
  "settings.accessibility.reader.focusRing.option.high": "High visibility",

  "settings.accessibility.reset.title": "Reset",
  "settings.accessibility.color.title": "Color",
  "settings.accessibility.color.colorBlindType.label": "Color-blind palette",
  "settings.accessibility.color.colorBlindType.hint":
    "Shifts the accent and persona colours to a hue set distinguishable under the named dichromacy. Stacks with your chosen theme — light/dark surfaces stay the same.",
  "settings.accessibility.color.colorBlindType.option.off": "Off",
  "settings.accessibility.color.colorBlindType.option.deuteranopia":
    "Deuteranopia (red/green)",
  "settings.accessibility.color.colorBlindType.option.protanopia":
    "Protanopia (red/green)",
  "settings.accessibility.color.colorBlindType.option.tritanopia":
    "Tritanopia (blue/yellow)",
  "settings.accessibility.color.colorBlindType.option.achromatopsia":
    "Achromatopsia (greyscale)",
  "settings.accessibility.color.colorBlindSafe.label": "Color-blind safe mode",
  "settings.accessibility.color.colorBlindSafe.hint":
    "Adds shape or label cues alongside any colour-only state signal — the yellow selection accent gets a checkmark, sync states pick up icons.",

  // ── writing pane ──
  "settings.writing.title": "Writing",
  "settings.writing.hint": "How Yarrow behaves while you're writing notes.",
  "settings.writing.autosave.label": "Checkpoint to history after",
  "settings.writing.autosave.hint":
    "How long Yarrow waits after your last keystroke before adding the change to history. The .md file on disk is always written within ~300 ms of typing — this only sets how often Yarrow snapshots into git.",
  "settings.writing.autosave.seconds": "{value}s",
  "settings.writing.autosave.minutes": "{value} min",
  "settings.writing.autosave.preset2m": "2 min",
  "settings.writing.autosave.preset2mTitle": "Snapshot at most every 2 minutes",
  "settings.writing.autosave.preset5m": "5 min",
  "settings.writing.autosave.preset5mTitle": "Snapshot at most every 5 minutes",
  "settings.writing.autosave.preset10m": "10 min",
  "settings.writing.autosave.preset10mTitle": "Snapshot at most every 10 minutes",
  "settings.writing.autosave.preset15m": "15 min",
  "settings.writing.autosave.preset15mTitle": "Snapshot at most every 15 minutes",
  "settings.writing.askThinking.label":
    "Ask what I was thinking on close",
  "settings.writing.askThinking.hint":
    "A non-modal prompt when you close a note — optional.",
  "settings.writing.fade.label": "Fade notes unvisited for",
  "settings.writing.fade.hint":
    "Notes untouched longer than this appear dimmed — a gentle nudge, not deletion.",
  "settings.writing.fade.days": "{value}d",
  "settings.writing.editorSize.label": "Editor font size",
  "settings.writing.editorSize.hint":
    "Applies to the note body you type in. Takes effect immediately.",
  "settings.writing.editorSize.small": "Small (13)",
  "settings.writing.editorSize.snug": "Snug (14)",
  "settings.writing.editorSize.comfortable": "Comfortable (15)",
  "settings.writing.editorSize.standard": "Standard (16)",
  "settings.writing.editorSize.roomy": "Roomy (17)",
  "settings.writing.editorSize.large": "Large (19)",
  "settings.writing.editorSize.xl": "Extra large (22)",
  "settings.writing.editorSize.huge": "Huge (26)",
  "settings.writing.focusDefault.label": "Open workspaces in focus mode",
  "settings.writing.fastSearch.label": "Fast search indexing",
  "settings.writing.fastSearch.hint":
    "Keeps a local SQLite/FTS5 cache for instant search. Your notes stay canonical — the cache is rederivable and safe to delete.",
  "settings.writing.clearSearch.label": "Clear search cache",
  "settings.writing.clearSearch.hint":
    "Removes .yarrow/index.db. Your notes aren't touched — the cache rebuilds on the next search if indexing is still on.",
  "settings.writing.clearSearch.button": "Clear",
  "settings.writing.clearSearch.working": "Clearing…",
  "settings.writing.clearSearch.done":
    "Cache cleared — next search will rebuild it.",
  "settings.writing.typewriter.label": "Typewriter mode",
  "settings.writing.typewriter.hint":
    "The active line stays at the vertical middle of the editor — the page scrolls underneath. Reduces neck strain on long sessions.",
  "settings.writing.editorial.label": "Editorial reading",
  "settings.writing.editorial.hint":
    "Reading mode uses drop caps, pull quotes, and generous leading — so finished notes read like a magazine spread. Use > pull: to mark a pull-quote.",
  "settings.writing.pathCaret.label": "Scenario-tinted caret",
  "settings.writing.pathCaret.hint":
    "The caret takes the colour of the scenario you're writing on, so you always know which draft you're editing. Turn off for high-contrast defaults.",
  "settings.writing.cookMode.label": "Cook mode",
  "settings.writing.cookMode.hint":
    "Bumps rendered-note text to a bigger size and asks the OS to keep the screen awake — for hands-free reading while you bake or cook. Affects reader and live-preview surfaces only; the editor itself stays at its normal size.",
  "settings.writing.rawMarkdown.label": "Show raw markdown syntax",
  "settings.writing.rawMarkdown.hint":
    "Show ## headings, **bold**, and [[ ]] around links while you write. When off, tokens collapse on lines you're not editing.",
  "settings.writing.editorFont.title": "Editor font",
  "settings.writing.editorFont.tag": "Applies to the note body only",
  "settings.writing.editorFont.hint":
    "Pick a typeface for long-form writing. Chrome, tags, and metadata keep their own faces.",
  "settings.writing.editorFont.serif": "Serif",
  "settings.writing.editorFont.sans": "Sans-serif",
  "settings.writing.editorFont.mono": "Mono",
  "settings.writing.savingNow": "saving…",
  "settings.writing.autosaveNote": "changes save automatically",

  // ── extras section ──
  "settings.extras.title": "Writing extras",
  "settings.extras.hint":
    "Opt-in features that lazy-load their code only when enabled — the editor stays lean by default and picks these up the moment you flip them on.",

  // ── guidance ──
  "settings.guidance.title": "Guided mode",
  "settings.guidance.hint":
    "Yarrow has a handful of concepts that aren't obvious from looking at them — scenarios, checkpoints, wikilinks, comparison, syncs. Guided mode walks you through each one every time you use it, and keeps a quiet reminder visible when you're on a try scenario.",
  "settings.guidance.on": "Guided mode is on",
  "settings.guidance.off": "Guided mode is off",
  "settings.guidance.onHint":
    "Teaching modals fire every time you do a non-obvious thing — creating a scenario, inserting a wikilink, returning to main, and so on. The ribbon above the editor is always visible when you're on a non-main scenario. If one specific modal starts to annoy you, each one has its own 'Stop showing this one' opt-out.",
  "settings.guidance.offHint":
    "You're on your own. No teaching modals, no ribbons. Tooltips still appear on hover, and destructive actions still ask to confirm.",
  "settings.guidance.optouts.title": "Per-modal opt-outs",
  "settings.guidance.optouts.hint":
    "If you've silenced an individual modal via its 'Stop showing this one' button, this resets those choices. Guided mode itself stays on.",
  "settings.guidance.optouts.label": "Show every modal again",
  "settings.guidance.optouts.subhint":
    "clears all per-key opt-outs; every teaching moment fires again",
  "settings.guidance.optouts.button": "Reset opt-outs",

  // ── sync ──
  "settings.sync.title": "Sync",
  "settings.sync.hint":
    "Back up your workspace to a git remote you own. Your notes stay on your machine — this just keeps a copy in sync.",
  "settings.sync.kind": "Kind",
  "settings.sync.repoUrl": "Sync URL",
  "settings.sync.repoUrlPlaceholder":
    "https://github.com/you/your-notes.git",
  "settings.sync.token.label": "Access token",
  "settings.sync.token.optional":
    "(optional — HTTPS private notebooks)",
  "settings.sync.token.placeholder": "ghp_… / gitea token",
  "settings.sync.token.note":
    "Stored on this machine only — never pushed to the remote.",
  "settings.sync.save": "Save",
  "settings.sync.saving": "saving…",
  "settings.sync.saved": "saved — try syncing from the toolbar",
  "settings.sync.syncNow": "Sync now",
  "settings.sync.autoSync.label": "Auto-sync every",
  "settings.sync.autoSync.off": "Off",
  "settings.sync.autoSync.note":
    "Sync fires in the background at this cadence when a remote is connected. Paused when the window is hidden. Immediate sync also runs on window focus so coming back from another app catches you up.",

  // ── yarrow server connect ──
  "settings.server.title": "Yarrow server",
  "settings.server.tagSelfOrConnect": "self-hosted or Connect",
  "settings.server.intro":
    "Sync this workspace through a Yarrow server you (or a friend) run, or through the hosted Yarrow Connect tier. End-to-end, no third-party git host needed — just point it at the server and sign in once.",
  "settings.server.connect": "Connect to a Yarrow server",
  "settings.server.url.label": "Server URL",
  "settings.server.url.placeholder": "https://yarrow.example.com",
  "settings.server.method.label": "Sign-in method",
  "settings.server.method.password": "Email + password",
  "settings.server.method.token": "Paste an access token",
  "settings.server.email.label": "Email",
  "settings.server.email.placeholder": "you@example.com",
  "settings.server.password.label": "Password",
  "settings.server.password.note":
    "We'll use it once to mint an access token for this workspace, then forget the password. The token lives in your OS keychain.",
  "settings.server.token.label": "Access token",
  "settings.server.token.placeholder": "yrw_…",
  "settings.server.token.note":
    "Paste a token you generated on the server's web UI. Stored in your OS keychain, never in the workspace folder.",
  "settings.server.passwordForEnc.label": "Password",
  "settings.server.passwordForEnc.optional":
    "(needed for encrypted sync)",
  "settings.server.passwordForEnc.note":
    "Used once, locally, to unlock your workspace encryption key — never sent to the server. Without it, the token authenticates but syncs fail at the unlock step. Leave blank only when connecting to a pre-encryption server.",
  "settings.server.workspaceName.label":
    "Workspace name on the server",
  "settings.server.workspaceName.optional": "(optional)",
  "settings.server.workspaceName.placeholder": "workspace",
  "settings.server.workspaceName.note":
    "Used the first time you sync. Defaults to this workspace's name.",
  "settings.server.skipTls.label":
    "Skip TLS verification (development only)",
  "settings.server.skipTls.note.before": "Use for ",
  "settings.server.skipTls.note.localhost": "localhost",
  "settings.server.skipTls.note.middle":
    " servers with self-signed certificates. ",
  "settings.server.skipTls.note.warn":
    "Leave off for any real server",
  "settings.server.skipTls.note.after":
    " — you'd be trusting any man-in-the-middle between you and it.",
  "settings.server.test": "Test connection",
  "settings.server.testing": "testing…",
  "settings.server.testOk": "looks good ✓",
  "settings.server.connectButton": "Connect",
  "settings.server.connecting": "connecting…",
  "settings.server.cancel": "Cancel",

  "settings.server.connected": "connected",
  "settings.server.tlsInsecure": "TLS: insecure",
  "settings.server.tlsInsecureTitle":
    "TLS verification is disabled for this connection. Intended for local dev only.",
  "settings.server.connected.serverLabel": "Server:",
  "settings.server.connected.signedInAs": "Signed in as:",
  "settings.server.connected.tokenLabel": "Token:",
  "settings.server.connected.tokenDefault": "access token",
  "settings.server.connected.tokenIdSuffix": " · id {id}…",
  "settings.server.connected.tokenPasted": " · pasted",
  "settings.server.connected.workspaceLabel": "Workspace on server:",
  "settings.server.connected.workspaceFmt":
    "workspace {id}…",
  "settings.server.connected.workspaceNone":
    "no workspace yet — first sync will create one",
  "settings.server.connected.syncNow": "Sync now",
  "settings.server.connected.syncing": "syncing…",
  "settings.server.connected.disconnect": "Disconnect",
  "settings.server.connected.disconnecting": "disconnecting…",
  "settings.server.connected.revoke": "Revoke & disconnect",
  "settings.server.connected.revoking": "revoking…",
  "settings.server.connected.firstSyncNote.before":
    "On your next sync, Yarrow will create a workspace named ",
  "settings.server.connected.firstSyncNote.after":
    " on the server and push your notes up for the first time.",
  "settings.server.connected.syncedFmt": "synced — {message}",
  "settings.server.connected.syncFailedFmt": "sync failed — {message}",
  "settings.server.connected.conflict.title":
    "{count} conflict auto-resolved",
  "settings.server.connected.conflict.titlePlural":
    "{count} conflicts auto-resolved",
  "settings.server.connected.conflict.body":
    "The server version won at each scenario. Your local edits are saved as sibling files — open both and bring them together by hand, then delete the conflict copy.",
  "settings.server.connected.conflict.savedAs": "→ saved as",

  // ── templates ──
  "settings.templates.title": "Templates",
  "settings.templates.hint":
    "Reusable scaffolds for recurring note shapes. Files live in .yarrow/templates/ as plain .md — edit them here or in any external editor.",
  "settings.templates.empty": "No templates yet.",
  "settings.templates.daily": "daily",
  "settings.templates.new": "+ new",
  "settings.templates.delete": "delete",
  "settings.templates.placeholders": "Placeholders:",
  "settings.templates.save": "Save",
  "settings.templates.saved": "saved",
  "settings.templates.empty.editor":
    "Pick a template to edit, or create a new one.",
  "settings.templates.newModal.title": "New template",
  "settings.templates.newModal.body":
    "A short name is enough — the scaffold is editable right after. The filename is derived from what you type.",
  "settings.templates.newModal.placeholder": "e.g. 1:1 notes",
  "settings.templates.newModal.cancel": "cancel",
  "settings.templates.newModal.create": "create template",
  "settings.templates.deleteModal.title":
    'Delete template "{label}"?',
  "settings.templates.deleteModal.body.before":
    "The file is removed from ",
  "settings.templates.deleteModal.body.after":
    ". Notes already created from it aren't affected.",
  "settings.templates.deleteModal.keep": "keep it",
  "settings.templates.deleteModal.confirm": "yes, delete",

  // ── security ──
  "settings.security.title": "Security",
  "settings.security.hint":
    "Optional protections for notes you'd rather not leave in plain text. Off by default.",
  "settings.security.localEnc.title": "Local encryption",
  "settings.security.tag.unlocked": "unlocked",
  "settings.security.tag.lockedEnabled": "enabled · locked",
  "settings.security.tag.off": "off",
  "settings.security.localEnc.body":
    "Per-note, opt-in encryption with ChaCha20-Poly1305 and an Argon2id password. Frontmatter (title, tags, links) stays plaintext so the graph and tag filter keep working; only the body is sealed. A 12-word recovery phrase gets you back in if you forget the password.",
  "settings.security.enable": "Enable encryption…",
  "settings.security.idle.label": "Idle auto-lock",
  "settings.security.idle.hint":
    "Session locks if you're idle this long. 0 = never.",
  "settings.security.idle.never": "never",
  "settings.security.idle.minutes": "{value}m",
  "settings.security.unlock": "Unlock…",
  "settings.security.lockNow": "Lock now",
  "settings.security.changePw": "Change password…",
  "settings.security.newRecovery": "New recovery phrase…",
  "settings.security.turnOff": "Turn off encryption…",
  "settings.security.toast.afterPhrase":
    "Encryption is on. Notes are still readable — open a note and pick the 🔒 toolbar menu → Encrypt this note.",

  // enable encryption modal
  "settings.security.enableModal.title": "Enable encryption",
  "settings.security.enableModal.intro":
    "Turning this on lets you encrypt individual notes. Frontmatter (title, tags, links) stays plaintext so the graph, tag filter and backlinks keep working for encrypted notes.",
  "settings.security.enableModal.warn.title":
    "While a note is encrypted:",
  "settings.security.enableModal.warn.diffs":
    "Body diffs in history slider are ciphertext noise.",
  "settings.security.enableModal.warn.search":
    "Full-text search matches titles and tags only.",
  "settings.security.enableModal.warn.external":
    "Opening the .md in another editor shows ciphertext.",
  "settings.security.enableModal.warn.export":
    "Static-site export skips the note entirely.",
  "settings.security.enableModal.warn.lost":
    "Lose both the password and the recovery phrase and the note is gone.",
  "settings.security.enableModal.notNow": "not now",
  "settings.security.enableModal.continue":
    "I understand, continue",
  "settings.security.enableModal.passwordIntro":
    "Pick a workspace password. You'll type it whenever your session locks (or, optionally, never if you turn idle-lock off).",
  "settings.security.enableModal.password": "Password",
  "settings.security.enableModal.confirmPassword": "Confirm password",
  "settings.security.enableModal.cancel": "cancel",
  "settings.security.enableModal.settingUp": "setting up…",
  "settings.security.enableModal.enableButton": "enable encryption",
  "settings.security.error.mismatch": "passwords don't match",
  "settings.security.error.tooShort":
    "password must be at least 8 characters",

  // recovery phrase modal
  "settings.security.recoveryModal.title": "Your recovery phrase",
  "settings.security.recoveryModal.body.before":
    "Write these 12 words down somewhere safe — ",
  "settings.security.recoveryModal.body.bold":
    "this is the only time you'll see them.",
  "settings.security.recoveryModal.body.after":
    " They reset your password if you forget it, and they let anyone else decrypt your notes, so keep them offline.",
  "settings.security.recoveryModal.copy": "Copy to clipboard",
  "settings.security.recoveryModal.copyHint":
    "clear it before storing anywhere online",
  "settings.security.recoveryModal.confirm":
    "I've written this down somewhere safe",
  "settings.security.recoveryModal.done": "done",

  // disable encryption modal
  "settings.security.disableModal.title": "Turn off encryption",
  "settings.security.disableModal.body":
    "Every encrypted note in this workspace will be rewritten as plaintext and checkpointed. The security settings file is removed.",
  "settings.security.disableModal.password.label":
    "Password (to confirm)",
  "settings.security.disableModal.keep": "keep it on",
  "settings.security.disableModal.decrypting": "decrypting all…",
  "settings.security.disableModal.confirm": "turn it off",

  // change password modal
  "settings.security.changePwModal.title":
    "Change encryption password",
  "settings.security.changePwModal.current":
    "current password",
  "settings.security.changePwModal.new": "new password",
  "settings.security.changePwModal.confirm": "confirm new password",
  "settings.security.changePwModal.cancel": "cancel",
  "settings.security.changePwModal.saving": "saving…",
  "settings.security.changePwModal.submit": "change password",
  "settings.security.changePwModal.error.mismatch":
    "new passwords don't match",

  // regenerate recovery modal
  "settings.security.regenModal.title": "New recovery phrase",
  "settings.security.regenModal.body":
    "Generates a fresh 12-word phrase and invalidates the old one. Your password stays the same.",
  "settings.security.regenModal.current": "current password",
  "settings.security.regenModal.cancel": "cancel",
  "settings.security.regenModal.working": "working…",
  "settings.security.regenModal.submit": "generate new phrase",

  // ── workspace ──
  "settings.workspace.title": "Workspace",
  "settings.workspace.hint": "The folder your notes live in.",
  "settings.workspace.name.label": "Name",
  "settings.workspace.name.hint":
    "Shown in the top-left of the sidebar.",
  "settings.workspace.startingNote.label": "Starting note",
  "settings.workspace.startingNote.hint":
    "The anchor for decisions going forward — where your map begins.",
  "settings.workspace.startingNote.notSet": "Not set",
  "settings.workspace.startingNote.change": "Change…",
  "settings.workspace.folder.label": "Folder",
  "settings.workspace.folder.hint":
    "Where your notes are saved as .md files.",
  "settings.workspace.folder.showFull": "Show full path",
  "settings.workspace.folder.hideFull": "Hide full path",
  "settings.workspace.created.label": "Created",
  "settings.workspace.import.title":
    "Import notes from another app",
  "settings.workspace.import.body.before":
    "Pull notes in from Obsidian, Bear, Logseq, Notion, or a BibTeX (",
  "settings.workspace.import.body.bib": ".bib",
  "settings.workspace.import.body.middle": ") export. Each entry from a ",
  "settings.workspace.import.body.middle2":
    " file becomes a paper-card note tagged ",
  "settings.workspace.import.body.tag": "#paper",
  "settings.workspace.import.body.after":
    ", ready for the @cite picker.",
  "settings.workspace.import.button": "Import notes…",
  "settings.workspace.export.title": "Export as a static site",
  "settings.workspace.export.body":
    "Save your workspace as a self-contained HTML folder you can share or host anywhere. Attachments and the connection graph come along.",
  "settings.workspace.trim.title": "Trim checkpoint history",
  "settings.workspace.trim.body":
    "Your current notes are never touched. These forget older snapshots so the history slider stops crowding up. Each is a one-way rewrite — if you sync to a remote, you'll need to force-push after.",
  "settings.workspace.trash.title": "Trash retention",
  "settings.workspace.trash.body":
    "How long a deleted note waits in Trash before it's purged for good. The next workspace open does the cleanup. Pick Forever if you'd rather sweep manually.",
  "settings.workspace.trash.note":
    "Deleted notes are purged after {days} days at next workspace open.",
  "settings.workspace.trash.foreverNote":
    "Deleted notes stay in Trash until you empty it yourself.",
  "settings.workspace.trash.forever": "Forever",
  "settings.workspace.clearCache.title": "Clear all derived caches",
  "settings.workspace.clearCache.body.before": "Wipes ",
  "settings.workspace.clearCache.body.indexJson":
    ".yarrow/index.json",
  "settings.workspace.clearCache.body.middle": " (graph) and",
  "settings.workspace.clearCache.body.indexDb":
    ".yarrow/index.db",
  "settings.workspace.clearCache.body.after":
    " (search). Your notes stay exactly as they are — both caches rebuild on demand.",
  "settings.workspace.close.button": "Close this workspace",
  "settings.workspace.close.note":
    "Nothing is deleted — you can reopen this folder any time.",

  // export button
  "settings.export.dialogTitle": "Choose a folder for the export",
  "settings.export.go": "Export as static site…",
  "settings.export.exporting": "exporting…",
  "settings.export.report.note": "note",
  "settings.export.report.notes": "notes",
  "settings.export.report.attachment": "attachment",
  "settings.export.report.attachments": "attachments",
  "settings.export.report.skipped": "skipped {count} encrypted",
  "settings.export.report.summary":
    "Exported {notes} {noteWord}{attachBit}{skipBit} → {dest}",
  "settings.export.failed": "Export failed: {error}",
  "settings.export.attachBit": " + {count} {word}",

  // export modal (2.2.0)
  "settings.export.modal.title": "Export as static site",
  "settings.export.modal.body":
    "Yarrow will write a publishable copy of this workspace as static HTML — one page per note, with links between them preserved. Encrypted notes and anything you've kept private are skipped automatically.",
  "settings.export.modal.dest.label": "Destination folder",
  "settings.export.modal.dest.choose": "Choose a folder…",
  "settings.export.modal.dest.change": "Change folder",
  "settings.export.modal.cancel": "Cancel",
  "settings.export.modal.close": "Close",
  "settings.export.modal.confirm": "Export",
  "settings.export.modal.again": "Export again",

  // trim history buttons / modals
  "settings.trim.olderBtn": "Forget old checkpoints…",
  "settings.trim.emptyBtn": "Forget empty checkpoints",
  "settings.trim.unifiedBtn": "Trim checkpoints…",
  "settings.trim.unifiedPicker.title": "Trim checkpoints",
  "settings.trim.unifiedPicker.body":
    "Both choices drop saved snapshots — your current notes always stay exactly as they are. Pick which kind of checkpoint to forget, then we'll show you what's about to disappear.",
  "settings.trim.unifiedPicker.modeAge.label": "Older than…",
  "settings.trim.unifiedPicker.modeAge.hint":
    "Drop snapshots past a cutoff. Useful for trimming a long history.",
  "settings.trim.unifiedPicker.modeEmpty.label": "Empty checkpoints",
  "settings.trim.unifiedPicker.modeEmpty.hint":
    'Drop "new note" snapshots before any words landed. Most users keep nothing of value here.',
  "settings.trim.unifiedPicker.cutoffLabel": "Keep how far back?",
  "settings.trim.nothing":
    "Nothing to trim — no checkpoints {label}.",
  "settings.trim.label.older": "older than {days} days",
  "settings.trim.label.empty": "with no content",
  "settings.trim.removed.singular":
    "Forgot {count} checkpoint {label}. {kept} kept.",
  "settings.trim.removed.plural":
    "Forgot {count} checkpoints {label}. {kept} kept.",
  "settings.trim.failed": "Couldn't trim: {error}",
  "settings.trim.picker.title":
    "Forget checkpoints older than…",
  "settings.trim.picker.body":
    "Pick how far back to keep your history. Anything older will be dropped on every scenario — current notes stay exactly as they are.",
  "settings.trim.picker.daysFmt": "{days} days",
  "settings.trim.picker.keep180": "keep ~half a year",
  "settings.trim.picker.keep90": "keep ~a quarter",
  "settings.trim.picker.keep60": "keep ~two months",
  "settings.trim.picker.keep30": "keep ~a month",
  "settings.trim.picker.cancel": "cancel",
  "settings.trim.picker.continue": "continue",
  "settings.trim.confirmAge.title":
    "Forget checkpoints older than {days} days?",
  "settings.trim.confirmAge.body":
    "Every saved snapshot older than {days} days will be dropped on every scenario. Your current notes stay exactly as they are — only the old history slider entries disappear.",
  "settings.trim.confirm.warnTitle": "This can't be undone:",
  "settings.trim.confirmAge.warn.thinking":
    'Old "what were you thinking?" notes are erased.',
  "settings.trim.confirmAge.warn.blame":
    "Blame-hover provenance before the cutoff is lost.",
  "settings.trim.confirm.warn.forcePush":
    "If you sync to a remote, your next sync needs a force-push.",
  "settings.trim.keep": "keep everything",
  "settings.trim.trimming": "trimming…",
  "settings.trim.confirmDoit": "yes, forget them",
  "settings.trim.confirmEmpty.title":
    "Forget empty checkpoints?",
  "settings.trim.confirmEmpty.body":
    'Drops every saved snapshot where all your notes were still empty — mostly "new note" moments before you started writing. Snapshots with any real content are kept.',
  "settings.trim.confirmEmpty.warn.scrub":
    "You can no longer scrub back to a note's blank-scaffold moment.",

  // clear all cache button + modal
  "settings.clearCache.button": "Clear all cache",
  "settings.clearCache.done":
    "All derived caches cleared. Both will rebuild on demand.",
  "settings.clearCache.failed":
    "Couldn't clear caches: {error}",
  "settings.clearCache.modal.title":
    "Clear all derived caches?",
  "settings.clearCache.modal.body":
    "Deletes the graph index and the search database. Your notes and git history are untouched. Both caches are rebuilt automatically — but the next search on a large vault may pause briefly while FTS5 re-indexes every note.",
  "settings.clearCache.modal.does": "Does clear:",
  "settings.clearCache.modal.does.json":
    "— link graph",
  "settings.clearCache.modal.does.db":
    "+ WAL — search cache",
  "settings.clearCache.modal.doesnt": "Doesn't touch:",
  "settings.clearCache.modal.doesnt.md.before": "Your ",
  "settings.clearCache.modal.doesnt.md.after": " note files.",
  "settings.clearCache.modal.doesnt.git": "Git checkpoint history.",
  "settings.clearCache.modal.doesnt.workspace":
    "Workspace settings, templates, or attachments.",
  "settings.clearCache.modal.cancel": "cancel",
  "settings.clearCache.modal.clearing": "clearing…",
  "settings.clearCache.modal.confirm": "yes, clear everything",

  // ── storage ──
  "settings.storage.title": "Manage server storage",
  "settings.storage.intro.bold":
    "This page deletes files from the server",
  "settings.storage.intro.body":
    ", not from your device. Use it when you need to free up space on the server because a large file is eating your quota.",
  "settings.storage.body":
    "Below is every note still on the server, ranked by how much space it's taking in the workspace's full history (including past versions of notes you've edited and notes you've deleted locally but that still exist in history). Selecting a file and confirming removes it from the server forever and forces every other device to drop its copy on the next sync. Local copies on this device get rewritten to match.",
  "settings.storage.loadFailed":
    "Couldn't load large files: {error}",
  "settings.storage.loading": "Loading…",
  "settings.storage.empty":
    "Nothing stands out. The server's happy with this workspace.",
  "settings.storage.col.file": "File",
  "settings.storage.col.size": "Size",
  "settings.storage.dangling.path":
    "(dangling blob — no scenario)",
  "settings.storage.collapseAria": "Collapse history",
  "settings.storage.expandAria": "Expand history",
  "settings.storage.collapseTitle": "Hide past versions",
  "settings.storage.expandTitle": "Show past versions",
  "settings.storage.versionsCount": "{count} versions in history",
  "settings.storage.version.col": "Version (object id · oldest first)",
  "settings.storage.version.note":
    "Selecting removes every version above — this is a one-way rewrite of history.",
  "settings.storage.selected.singular":
    "{count} selected · {bytes} to free",
  "settings.storage.selected.plural":
    "{count} selected · {bytes} to free",
  "settings.storage.selected.empty":
    "Select files to permanently delete.",
  "settings.storage.deleteSelected": "Delete selected from server…",

  "settings.storage.confirm.title":
    "Permanently delete from the server?",
  "settings.storage.confirm.body.before":
    "You're about to delete ",
  "settings.storage.confirm.body.fileSingular": "file",
  "settings.storage.confirm.body.filePlural": "files",
  "settings.storage.confirm.body.middle":
    " from the server",
  "settings.storage.confirm.body.after":
    " and every past version of the workspace. The files will also disappear from this device and every other device that syncs — everywhere, forever.",
  "settings.storage.confirm.cantUndo": "This cannot be undone.",
  "settings.storage.confirm.done":
    "Done. Freed {bytes}. Other devices will re-download a clean copy on their next sync.",
  "settings.storage.confirm.typeToConfirm.before": "Type ",
  "settings.storage.confirm.typeToConfirm.after": " to confirm",
  "settings.storage.confirm.placeholder": "DELETE",
  "settings.storage.confirm.cancel": "Cancel",
  "settings.storage.confirm.deleting":
    "Deleting from server…",
  "settings.storage.confirm.confirmButton":
    "Yes, permanently delete from the server",
  "settings.storage.confirm.doneButton": "Done",

  // align with server panel
  "settings.align.title": "Stuck after freeing space?",
  "settings.align.body":
    "If you (or another device) just deleted files from the server but this device still thinks it's over quota, this button pulls the server's new state and drops any local unsynced changes that reference the deleted files. Use this if sync won't recover on its own.",
  "settings.align.button": "Sync server state now",
  "settings.align.syncing": "Syncing…",
  "settings.align.alreadyInSync":
    "Already in sync with the server.",
  "settings.align.dropped.singular":
    "Dropped {count} local change and re-aligned with the server.",
  "settings.align.dropped.plural":
    "Dropped {count} local changes and re-aligned with the server.",

  // ── shortcuts ──
  "settings.shortcuts.title": "Keyboard shortcuts",
  "settings.shortcuts.hint":
    "Shown in {platform} style. These aren't configurable yet.",
  "settings.shortcuts.platform.mac": "macOS",
  "settings.shortcuts.platform.other": "Windows / Linux",
  "settings.shortcuts.group.gettingAround": "Getting around",
  "settings.shortcuts.group.writing": "Writing",
  "settings.shortcuts.palette":
    "Command palette — search, jump, run",
  "settings.shortcuts.quickSwitch":
    "Quick note switcher (fuzzy title)",
  "settings.shortcuts.switchWorkspace": "Switch workspace",
  "settings.shortcuts.jumpToday": "Jump to today's journal",
  "settings.shortcuts.openSettings": "Open settings",
  "settings.shortcuts.newNote": "New note",
  "settings.shortcuts.newDirection":
    "Explore a new direction (new scenario)",
  "settings.shortcuts.branchFromHere":
    "Open a scenario from the current note",
  "settings.shortcuts.focusToggle":
    "Toggle focus mode (hide sidebars)",
  "settings.shortcuts.scratchpad": "Toggle scratchpad",
  "settings.shortcuts.editorHint.before":
    "Right-click in the editor to insert a ",
  "settings.shortcuts.editorHint.or": " or ",
  "settings.shortcuts.editorHint.middle":
    " — pick a note from the list, toggle inline if you want to transclude it. Type ",
  "settings.shortcuts.editorHint.after":
    " at the start of a line to mark an open question.",

  // ── help (3.1) ──
  "settings.help.title": "Help & feedback",
  "settings.help.hint":
    "Read docs, see what changed in this version, and reach the people who make Yarrow. Nothing here phones home unless you click it.",
  "settings.help.docs.title": "Documentation",
  "settings.help.docs.body":
    "The full docs live online but are also bundled with the app for offline reading.",
  "settings.help.docs.openOnline": "Open docs (online)",
  "settings.help.docs.shortcutsCheatsheet": "Keyboard shortcuts cheatsheet",
  "settings.help.whatsNew.title": "What's new",
  "settings.help.whatsNew.body":
    "You're on version {version}. Read the release notes for everything that's changed since you last upgraded.",
  "settings.help.whatsNew.viewChangelog": "View changelog",
  "settings.help.support.title": "Send feedback or report a bug",
  "settings.help.support.body":
    "Email is fine for a quick thought; GitHub issues are best for bugs you want tracked. We never collect anything you don't choose to share.",
  "settings.help.support.sendFeedback": "Send feedback…",
  "settings.help.support.openIssue": "Open a GitHub issue…",
  "settings.help.support.copyDiagnostics": "Copy diagnostics",
  "settings.help.feedback.subject": "Yarrow feedback",
  "settings.help.feedback.bodyTemplate":
    "(Your thoughts here. The line below is optional — Yarrow doesn't share it unless you keep it in the message.)\n\n— {diagnostics}",

  // ── about ──
  "settings.about.title": "About Yarrow",
  "settings.about.body1":
    "Yarrow is a note-taking tool for non-linear thinking. Your notes are plain markdown files in a folder — open them in any editor, back them up anywhere. Yarrow only keeps track of connections and versions for you.",
  "settings.about.body2":
    'Every save is a checkpoint. Every "new direction" is a path you can switch back to. Nothing you write is ever lost.',
  "settings.about.versionLine":
    "version {version} · local-first · plain markdown",
  "settings.about.links.title": "Links",
  "settings.about.links.docs": "User guide",
  "settings.about.links.changelog": "Changelog",
  "settings.about.links.github": "GitHub",
  "settings.about.links.website": "Website",

  // ── export / import settings (3.1) ──
  "settings.about.exportImport.title": "Export & import settings",
  "settings.about.exportImport.body":
    "Save a JSON snapshot of every Yarrow preference on this machine, or restore one on another. Notes themselves are not exported — only the controls in this panel. Useful when you set up a second machine and want it to feel the same.",
  "settings.about.exportImport.exportBtn": "Export settings…",
  "settings.about.exportImport.importBtn": "Import settings…",
  "settings.about.exportImport.savePromptTitle":
    "Save your Yarrow settings",
  "settings.about.exportImport.exporting": "Exporting…",
  "settings.about.exportImport.importing": "Importing…",
  "settings.about.exportImport.exportDone":
    "Exported {count} preferences.",
  "settings.about.exportImport.exportFailed":
    "Couldn't export: {error}",
  "settings.about.exportImport.importDone":
    "Imported {count} preferences. Reloading…",
  "settings.about.exportImport.importFailed":
    "Couldn't import: {error}",
  "settings.about.exportImport.notASnapshot":
    "That file isn't a Yarrow settings snapshot.",

  // ── reset to defaults (3.1) ──
  "settings.about.reset.title": "Reset every setting",
  "settings.about.reset.body":
    "Forget every preference and start over with the shipped defaults. Your notes, scenarios, and history aren't touched — only the controls in this panel. This is the nuclear option.",
  "settings.about.reset.button": "Reset every setting…",
  "settings.about.reset.confirmTitle": "Reset every Yarrow preference?",
  "settings.about.reset.confirmBody":
    "Themes, fonts, gesture bindings, mode picks, sync setup hints, guidance state, accessibility — all of it goes back to factory. Your notes stay exactly as they are.",
  "settings.about.reset.cancel": "Cancel",
  "settings.about.reset.confirmBtn": "Reset everything",
  "settings.about.resetA11y.title": "Reset accessibility settings",
  "settings.about.resetA11y.body":
    "Forget only the accessibility preferences (vision, motion, motor, cognitive, reader, color). Other settings — themes, fonts, gestures, modes — stay where they are.",
  "settings.about.resetA11y.button": "Reset accessibility…",
  "settings.about.resetA11y.confirmTitle":
    "Reset accessibility settings?",
  "settings.about.resetA11y.confirmBody":
    "Text scale, contrast, motion, hit-target size, dyslexia font, reading guide, color-blind palette, focus-ring style — all return to defaults. Nothing else changes.",
  "settings.about.resetA11y.confirmBtn": "Reset accessibility",
  "settings.about.resetA11y.done": "Reset done — all defaults restored.",
  "settings.about.resetWorkspace.title": "Reset all workspace settings",
  "settings.about.resetWorkspace.body":
    "Forget the per-workspace preferences stored in this workspace's config.toml — autocheckpoint debounce, decay days, editor font size, idle-lock timeout, autosync cadence, trash retention. Sync URL and any server connection are left alone. Your notes aren't touched.",
  "settings.about.resetWorkspace.button": "Reset workspace settings…",
  "settings.about.resetWorkspace.confirmTitle":
    "Reset workspace settings to defaults?",
  "settings.about.resetWorkspace.confirmBody":
    "Autocheckpoint debounce returns to 8 s, decay to 60 days, font size to 16, idle-lock to 15 min, autosync to 5 min, trash retention to 30 days. Sync remote and server token stay intact. Notes are not touched.",
  "settings.about.resetWorkspace.confirmBtn": "Reset workspace settings",

  // ── gestures (2.2.0) ──
  "settings.gestures.title": "The Still Point",
  "settings.gestures.hint":
    "The centre dot of the radial menu listens for three configurable gestures. Each one fires a single named action — pick yours below. Drag-out and scroll-wheel are structural to the radial and aren't bindable.",
  "settings.gestures.slot.tap.label": "Single tap",
  "settings.gestures.slot.tap.meta": "tap",
  "settings.gestures.slot.longPress.label": "Press & hold",
  "settings.gestures.slot.longPress.meta": "long-press · 380 ms",
  "settings.gestures.slot.doubleTap.label": "Double tap",
  "settings.gestures.slot.doubleTap.meta": "double-tap · 280 ms",
  "settings.gestures.group.core": "Core",
  "settings.gestures.group.navigation": "Navigation",
  "settings.gestures.group.writing": "Writing",
  "settings.gestures.group.system": "System",

  "settings.gestures.action.palette.label": "Open the command palette",
  "settings.gestures.action.palette.blurb": "search notes, run commands, jump anywhere — same as ⌘K.",
  "settings.gestures.action.quickHand.label": "Open the Quick Hand",
  "settings.gestures.action.quickHand.blurb": "a small modal with nine on-theme buttons for the things you reach for most.",
  "settings.gestures.action.constellationModal.label": "Open the Constellation",
  "settings.gestures.action.constellationModal.blurb": "eight buttons orbit the click point in a pie of small actions.",
  "settings.gestures.action.constellation.label": "Open the connection graph",
  "settings.gestures.action.constellation.blurb": "the right-rail map view — links between this note and its neighbours.",
  "settings.gestures.action.outline.label": "Show this note's outline-solid",
  "settings.gestures.action.outline.blurb": "headings and top-level bullets as a click-to-jump tree.",
  "settings.gestures.action.todayJournal.label": "Open today's journal",
  "settings.gestures.action.todayJournal.blurb": "creates the daily note from your template if it doesn't exist yet — same as ⌘T.",
  "settings.gestures.action.newNote.label": "Create a new note",
  "settings.gestures.action.newNote.blurb": "drop into the new-note dialog — same as ⌘N.",
  "settings.gestures.action.newPath.label": "Explore a new direction",
  "settings.gestures.action.newPath.blurb": "open a new scenario from where you are — same as ⌘⇧N.",
  "settings.gestures.action.livePreview.label": "Toggle live preview",
  "settings.gestures.action.livePreview.blurb": "split the writing pane and render the right side live as you type.",
  "settings.gestures.action.cookMode.label": "Toggle cook mode",
  "settings.gestures.action.cookMode.blurb": "big-text reading view with screen wake-lock — for hands-free recipes.",
  "settings.gestures.action.focus.label": "Toggle focus mode",
  "settings.gestures.action.focus.blurb": "hide the chrome — only the note remains. Same as ⌘\\.",
  "settings.gestures.action.scratchpad.label": "Toggle the scratchpad",
  "settings.gestures.action.scratchpad.blurb": "a docked notepad that saves everything but never keeps it permanently.",
  "settings.gestures.action.settings.label": "Open Settings",
  "settings.gestures.action.settings.blurb": "lands on this very pane — useful as a paranoid fallback while you're tuning.",

  "settings.gestures.structural.title": "Structural gestures",
  "settings.gestures.structural.hint":
    "Two more gestures live on the centre disc but aren't bindable — they're how the radial works as a radial.",
  "settings.gestures.structural.dragOut.tag": "drag-out",
  "settings.gestures.structural.dragOut.desc":
    "Press in the centre and flick the pointer toward any wedge — the wedge fires without a separate click.",
  "settings.gestures.structural.scroll.tag": "scroll wheel",
  "settings.gestures.structural.scroll.desc":
    "Spin the wheel while the menu is open to step the wedge highlight without moving the pointer.",

  "settings.gestures.reset.atDefaults": "Bindings are at their recommended defaults.",
  "settings.gestures.reset.modified": "Bindings have been changed from the recommended defaults.",
  "settings.gestures.reset.btn": "Reset to defaults",
  "settings.gestures.reset.confirmTitle": "Restore recommended gestures?",
  "settings.gestures.reset.confirmBody":
    "All three gesture bindings will go back to what Yarrow ships with. This affects only the centre dot — it doesn't touch any of your other settings.",
  "settings.gestures.reset.cancel": "Cancel",
  "settings.gestures.reset.confirm": "Reset",
} as const;

export type SettingsKey = keyof typeof settingsEN;

export const settingsES: Record<SettingsKey, string> = {
  // ── shell ──
  "settings.title": "Configuración",
  "settings.searchPlaceholder": "Buscar…",
  "settings.escToClose": "esc para cerrar",
  "settings.closeAria": "Cerrar configuración",
  "settings.closeTitle": "Cerrar (Esc)",

  // ── tabs ──
  "settings.tabs.mode": "Modos y personas",
  "settings.tabs.appearance": "Apariencia",
  "settings.tabs.accessibility": "Accesibilidad",
  "settings.tabs.writing": "Escritura",
  "settings.tabs.gestures": "Gestos",
  "settings.tabs.guidance": "Guía",
  "settings.tabs.templates": "Plantillas",
  "settings.tabs.sync": "Sincronización",
  "settings.tabs.storage": "Almacenamiento",
  "settings.tabs.security": "Seguridad",
  "settings.tabs.workspace": "Espacio de trabajo",
  "settings.tabs.shortcuts": "Atajos",
  "settings.tabs.help": "Ayuda",
  "settings.tabs.about": "Acerca de",

  // ── nav groups (3.1) ──
  "settings.nav.group.experience": "Experiencia",
  "settings.nav.group.content": "Contenido",
  "settings.nav.group.system": "Sistema",
  "settings.nav.group.about": "Información",

  // ── scope chips (3.1) ──
  "settings.scope.device": "Dispositivo",
  "settings.scope.workspace": "Espacio",
  "settings.scope.account": "Cuenta",
  "settings.scope.mixed": "Mixto",
  "settings.scope.device.title":
    "Guardado solo en esta máquina — no viajará a otros dispositivos.",
  "settings.scope.workspace.title":
    "Viaja con este cuaderno. Otros dispositivos que abran el mismo espacio lo verán.",
  "settings.scope.account.title":
    "Se aplica donde sea que inicies sesión.",
  "settings.scope.mixed.title":
    "Este panel mezcla ajustes locales del dispositivo y del espacio — revisa cada fila.",

  // ── mode pane ──
  "settings.mode.title": "Modos y personas",
  "settings.mode.hint":
    "Los modos definen la complejidad general. Las personas añaden herramientas específicas del oficio encima — ambos son reversibles, y ⌘K alcanza todo lo que cualquiera de los dos oculte.",
  "settings.mode.modeSection": "Modo",
  "settings.mode.personaSection": "Persona",
  "settings.mode.personaIntro":
    "Opcional. Una persona es una capa sobre Por escenarios — añade herramientas específicas del oficio sin bloquear nada más.",
  "settings.mode.personaNone": "Ninguna",
  "settings.mode.personaNoneDesc":
    "Por escenarios sin persona. La superficie completa de Yarrow, sin disfraz.",
  "settings.mode.footerNote":
    "Los modos sesgan la barra y la paleta; nunca bloquean funciones. Puedes cambiar de modo en cualquier momento.",
  "settings.mode.option.basic.label": "Básico",
  "settings.mode.option.basic.desc":
    "Solo escribir. Sin escenarios, sin grafo, sin extras — el guardado de puntos sigue funcionando en segundo plano.",
  "settings.mode.option.basic.bullet1": "Notas simples, etiquetas y bloc de notas",
  "settings.mode.option.basic.bullet2": "Sin escenarios, grafo ni kits en la barra",
  "settings.mode.option.basic.bullet3": "Los puntos de control automáticos siguen guardando en segundo plano",
  "settings.mode.option.basic.bullet4": "Todo sigue accesible vía ⌘K",
  "settings.mode.option.path.label": "Por escenarios",
  "settings.mode.option.path.desc":
    "La superficie completa de Yarrow, sin disfraz de persona. El predeterminado para quienes quieren todo lo que Yarrow puede hacer.",
  "settings.mode.option.path.bullet1": "Escenarios ramificadas y conexiones recíprocas",
  "settings.mode.option.path.bullet2": "Grafo de conexiones con fuerzas dirigidas",
  "settings.mode.option.path.bullet3": "Línea de tiempo del historial y panel de huérfanas",
  "settings.mode.option.path.bullet4": "Selector de kits y superficie completa de teclado",
  "settings.mode.option.writer.label": "Escritor/a",
  "settings.mode.option.writer.desc":
    "Por escenarios + herramientas de escritura. Una superficie tranquila y enfocada para la prosa.",
  "settings.mode.option.writer.bullet1": "Racha de escritura diaria con píldora de objetivo",
  "settings.mode.option.writer.bullet2": "Modo máquina de escribir",
  "settings.mode.option.writer.bullet3": "Adornos de escenario silenciados — concentración en la prosa",
  "settings.mode.option.writer.bullet4": "Conteo de palabras y medidor de progreso en la barra de estado",
  "settings.mode.option.researcher.label": "Investigador/a",
  "settings.mode.option.researcher.desc":
    "Por escenarios + herramientas de investigación. Para fuentes, citas y preguntas abiertas.",
  "settings.mode.option.researcher.bullet1": "Panel de preguntas abiertas (marcadores ??)",
  "settings.mode.option.researcher.bullet2": "Biblioteca de fuentes con filtros",
  "settings.mode.option.researcher.bullet3": "Plantilla para nuevas referencias",
  "settings.mode.option.researcher.bullet4": "Píldora de conteo ?? en la barra de estado",
  "settings.mode.option.developer.label": "Desarrollador/a",
  "settings.mode.option.developer.desc":
    "Por escenarios + herramientas de ingeniería. Para decisiones, código y topología.",
  "settings.mode.option.developer.bullet1": "Registro de decisiones (lista de ADR)",
  "settings.mode.option.developer.bullet2": "Plantilla para nuevas decisiones (ADR)",
  "settings.mode.option.developer.bullet3": "Resaltado de sintaxis de código",
  "settings.mode.option.developer.bullet4": "Píldora con conteo de decisiones en la barra de estado",
  "settings.mode.option.clinician.label": "Clínico/a",
  "settings.mode.option.clinician.desc":
    "Por escenarios + herramientas clínicas. Para notas sensibles, seguimientos y estructura de sesión.",
  "settings.mode.option.clinician.bullet1": "Lista de notas sensibles",
  "settings.mode.option.clinician.bullet2": "Panel de seguimientos (#review, #followup, #todo, #wip)",
  "settings.mode.option.clinician.bullet3": "Plantillas SOAP / BIRP / DAP / Acogida",
  "settings.mode.option.clinician.bullet4": "Trazabilidad mediante puntos de control automáticos",
  "settings.mode.option.cooking.label": "Cocina",
  "settings.mode.option.cooking.desc":
    "Por escenarios + herramientas de cocina. Para recetas, lectura sin manos y compras.",
  "settings.mode.option.cooking.bullet1": "Modo cocina con lectura sin manos",
  "settings.mode.option.cooking.bullet2": "Recortador de URL de recetas",
  "settings.mode.option.cooking.bullet3": "Constructor inteligente de lista de la compra",
  "settings.mode.option.cooking.bullet4": "Biblioteca de recetas y temporizadores integrados",

  // ── search ──
  "settings.search.empty":
    'Nada coincide con "{query}". Prueba una palabra como "fuente", "sincronización" o "contraseña".',
  "settings.search.resultsCount": "{count} resultado para \"{query}\"",
  "settings.search.resultsCountPlural":
    "{count} resultados para \"{query}\"",

  "settings.search.mode.label": "Modos y personas",
  "settings.search.mode.sublabel":
    "Básico · Por escenarios · Escritor/a · Investigador/a · Desarrollador/a · Clínico/a · Cocina",
  "settings.search.appearance.theme.label": "Tema",
  "settings.search.appearance.theme.sublabel":
    "claro · oscuro · auto · ashrose · dracula",
  "settings.search.accessibility.label": "Accesibilidad",
  "settings.search.accessibility.sublabel":
    "visión · movimiento · motor · cognitivo · lector de pantalla · color",
  "settings.search.accessibility.contrast.label": "Contraste",
  "settings.search.accessibility.dyslexia.label": "Fuente para dislexia",
  "settings.search.accessibility.motion.label": "Reducir movimiento",
  "settings.search.appearance.size.label": "Tamaño de la interfaz",
  "settings.search.appearance.size.sublabel":
    "compacto · cómodo · amplio",
  "settings.search.appearance.font.label":
    "Fuente de la interfaz",
  "settings.search.appearance.font.sublabel":
    "Inter · opciones serif",

  "settings.search.writing.autosave.label":
    "Guardar cada cambio después de",
  "settings.search.writing.autosave.sublabel":
    "demora del autoguardado",
  "settings.search.writing.askThinking.label":
    "Preguntar en qué estaba pensando al cerrar",
  "settings.search.writing.fadeNotes.label":
    "Atenuar notas no visitadas durante",
  "settings.search.writing.editorFontSize.label":
    "Tamaño de fuente del editor",
  "settings.search.writing.focusDefault.label":
    "Abrir espacios de trabajo en modo foco",
  "settings.search.writing.rawMarkdown.label":
    "Mostrar sintaxis markdown sin procesar",
  "settings.search.writing.editorFont.label": "Fuente del editor",

  "settings.search.guidance.guidedMode.label": "Modo guiado",
  "settings.search.guidance.guidedMode.sublabel":
    "acompañamiento para funciones complejas",
  "settings.search.guidance.reset.label": "Restablecer guía",
  "settings.search.guidance.reset.sublabel":
    "ver de nuevo todos los modales de enseñanza",

  "settings.search.templates.label": "Plantillas",
  "settings.search.templates.sublabel":
    "estructuras de notas reutilizables",

  "settings.search.sync.repo.label": "URL del repositorio",
  "settings.search.sync.token.label": "Token de acceso",
  "settings.search.sync.server.label": "Servidor Yarrow",
  "settings.search.sync.server.sublabel":
    "autohospedado o Connect",
  "settings.search.sync.disconnect.label":
    "Desconectar servidor",

  "settings.search.security.localEnc.label": "Cifrado local",
  "settings.search.security.localEnc.sublabel":
    "contraseña + frase de recuperación",
  "settings.search.security.idleLock.label":
    "Bloqueo automático por inactividad",
  "settings.search.security.changePw.label": "Cambiar contraseña",
  "settings.search.security.recovery.label":
    "Frase de recuperación",
  "settings.search.security.turnOff.label": "Desactivar cifrado",

  "settings.search.workspace.name.label": "Nombre",
  "settings.search.workspace.name.sublabel":
    "se muestra en la barra lateral",
  "settings.search.workspace.folder.label": "Carpeta",
  "settings.search.workspace.folder.sublabel":
    "donde viven tus notas",
  "settings.search.workspace.export.label":
    "Exportar como sitio estático",
  "settings.search.workspace.trim.label":
    "Recortar historial de puntos de control",
  "settings.search.workspace.trim.sublabel":
    "olvidar instantáneas antiguas",
  "settings.search.workspace.close.label":
    "Cerrar este espacio de trabajo",

  "settings.search.shortcuts.label": "Atajos de teclado",

  "settings.search.about.label": "Acerca de Yarrow",
  "settings.search.about.sublabel": "versión, enlaces",

  // ── accessibility pane (3.1) ──
  "settings.accessibility.title": "Accesibilidad",
  "settings.accessibility.hint":
    "Ajusta cómo se ve y se comporta Yarrow para que funcione con tu forma de leer, escribir y moverte. Cada ajuste aquí es local a esta máquina.",

  "settings.accessibility.presets.title": "Ajustes preestablecidos",
  "settings.accessibility.presets.body":
    "Aplica un paquete de cambios probado de una vez. Después puedes seguir ajustando cualquier control individual — los preajustes no son bloqueos.",
  "settings.accessibility.presets.changeCount": "Cambia {count} ajustes · todo reversible",

  "settings.accessibility.presets.low-vision.label": "Baja visión",
  "settings.accessibility.presets.low-vision.desc":
    "Texto más grande, paleta de mayor contraste, cursor más grande y aro de foco más visible.",
  "settings.accessibility.presets.dyslexia-friendly.label": "Amigable con dislexia",
  "settings.accessibility.presets.dyslexia-friendly.desc":
    "Tipografía estilo Atkinson, guía de lectura activa, corrector ortográfico desactivado.",
  "settings.accessibility.presets.reduced-motion.label": "Movimiento reducido",
  "settings.accessibility.presets.reduced-motion.desc":
    "Desactiva animaciones, autoplay y efectos de transparencia. Útil para sensibilidad vestibular.",
  "settings.accessibility.presets.motor-friendly.label": "Amigable motor",
  "settings.accessibility.presets.motor-friendly.desc":
    "Áreas de toque más grandes, atajos en secuencia y sin gestos de pulsación larga.",

  "settings.accessibility.vision.title": "Visión",
  "settings.accessibility.vision.textScale.label": "Tamaño del texto",
  "settings.accessibility.vision.textScale.hint":
    "Escala todo el texto de la interfaz y del editor a la vez. El tamaño de fuente del editor sigue funcionando encima de esto.",
  "settings.accessibility.vision.contrast.label": "Contraste",
  "settings.accessibility.vision.contrast.hint":
    "Predeterminado = la paleta original. Alto = versión AAA del tema. Máximo = blanco y negro reales independientemente del tema.",
  "settings.accessibility.vision.contrast.option.default": "Predeterminado",
  "settings.accessibility.vision.contrast.option.high": "Alto (AAA)",
  "settings.accessibility.vision.contrast.option.maximum": "Máximo",
  "settings.accessibility.vision.reduceTransparency.label": "Reducir transparencia",
  "settings.accessibility.vision.reduceTransparency.hint":
    "Desactiva el desenfoque y la translucidez en fondos modales y popovers — bordes más nítidos, más fácil de leer.",
  "settings.accessibility.vision.largerCursor.label": "Cursor más grande",
  "settings.accessibility.vision.largerCursor.hint":
    "Cursor más grande en el editor e indicador de foco más grueso en la selección.",
  "settings.accessibility.vision.dyslexiaFont.label": "Fuente para dislexia",
  "settings.accessibility.vision.dyslexiaFont.hint":
    "Cambia el texto del editor a Atkinson Hyperlegible. No afecta a la interfaz — esa mantiene su tipografía habitual.",

  "settings.accessibility.motion.title": "Movimiento",
  "settings.accessibility.motion.reduceMotion.label": "Reducir movimiento",
  "settings.accessibility.motion.reduceMotion.hint":
    "Auto sigue el ajuste del sistema. Activado fuerza la desactivación de toda animación; Desactivado las mantiene siempre.",
  "settings.accessibility.motion.reduceMotion.option.auto": "Auto (sistema)",
  "settings.accessibility.motion.reduceMotion.option.on": "Activado",
  "settings.accessibility.motion.reduceMotion.option.off": "Desactivado",
  "settings.accessibility.motion.disableAutoplay.label": "Desactivar autoplay",
  "settings.accessibility.motion.disableAutoplay.hint":
    "Detiene las animaciones del grafo de conexiones y otras visualizaciones hasta que las pidas explícitamente.",

  "settings.accessibility.motor.plainContextMenu.label":
    "Usar el menú contextual estándar en lugar del radial",
  "settings.accessibility.motor.plainContextMenu.hint":
    "Sustituye el menú radial por un menú contextual vertical estándar — más amable con temblor, lesiones por movimientos repetitivos, artritis o cualquiera a quien le resulten dolorosos los gestos de mantener pulsado.",
  "settings.gestures.disabled.title":
    "Los gestos están desactivados en Accesibilidad",
  "settings.gestures.disabled.body":
    "Has desactivado el menú radial del clic derecho en Accesibilidad → Motor. Reactívalo allí y estas asignaciones de gestos volverán a funcionar.",
  "settings.gestures.disabled.openA11y": "Abrir Accesibilidad →",
  "settings.accessibility.viz.title": "Visualizaciones",
  "settings.accessibility.viz.animateGraph.label": "Animar el grafo de conexiones",
  "settings.accessibility.viz.animateGraph.hint":
    "Permite que la simulación dirigida coloque los nodos al abrir el grafo. Desactívalo si el movimiento sutil te incomoda; el grafo sigue renderizándose, simplemente estático.",
  "settings.accessibility.viz.diffPatterns.label": "Patrones de diff junto al color",
  "settings.accessibility.viz.diffPatterns.hint":
    "Añade subrayado + tachado a las adiciones/eliminaciones para que el diff siga siendo legible sin color. Recomendado para todos — también ayuda con luz intensa.",
  "settings.accessibility.viz.graphTableAlt.label": "Mostrar el grafo como lista",
  "settings.accessibility.viz.graphTableAlt.hint":
    "Sustituye el grafo espacial por una lista de conexiones agrupadas por tipo de relación. Más fácil para lectores de pantalla y para quienes prefieren leer a explorar.",
  "settings.accessibility.motor.title": "Motor",
  "settings.accessibility.motor.largeTargets.label": "Áreas de toque más grandes",
  "settings.accessibility.motor.largeTargets.hint":
    "Aumenta cada elemento interactivo al menos a 44×44 pt — más fácil con trackpad o táctil.",
  "settings.accessibility.motor.stickyKeys.label": "Compatible con sticky keys",
  "settings.accessibility.motor.stickyKeys.hint":
    "Muestra atajos en secuencia (⌘ y luego K) en vez de combinaciones (⌘K) — útil con la función de teclas pegajosas del sistema.",

  "settings.accessibility.cognitive.title": "Cognitivo",
  "settings.accessibility.cognitive.readingGuide.label": "Guía de lectura",
  "settings.accessibility.cognitive.readingGuide.hint":
    "Una barra horizontal opcional que sigue la línea del cursor — ayuda a no perder el sitio.",
  "settings.accessibility.cognitive.spellTone.label": "Tono del corrector",
  "settings.accessibility.cognitive.spellTone.hint":
    "Elige cómo se marcan las faltas. Desactivado si las líneas rojas persistentes te resultan estresantes.",
  "settings.accessibility.cognitive.spellTone.option.underline": "Subrayado (predeterminado)",
  "settings.accessibility.cognitive.spellTone.option.highlight": "Resaltado",
  "settings.accessibility.cognitive.spellTone.option.off": "Desactivado",

  "settings.accessibility.reader.title": "Lector de pantalla y teclado",
  "settings.accessibility.reader.verbose.label": "Anuncios verbosos",
  "settings.accessibility.reader.verbose.hint":
    "Anuncia el estado de sincronización, los eventos de autoguardado y los puntos de control a los lectores de pantalla en tiempo real.",
  "settings.accessibility.reader.focusRing.label": "Estilo del aro de foco",
  "settings.accessibility.reader.focusRing.hint":
    "Cuán visible es el indicador de foco del teclado. Sutil para encajar con la paleta, Alto para claridad sobre estética.",
  "settings.accessibility.reader.focusRing.option.subtle": "Sutil",
  "settings.accessibility.reader.focusRing.option.default": "Predeterminado",
  "settings.accessibility.reader.focusRing.option.high": "Alta visibilidad",

  "settings.accessibility.reset.title": "Restablecer",
  "settings.accessibility.color.title": "Color",
  "settings.accessibility.color.colorBlindType.label":
    "Paleta para daltonismo",
  "settings.accessibility.color.colorBlindType.hint":
    "Ajusta los colores de acento y personas a un conjunto de tonos distinguibles para cada tipo de daltonismo. Se combina con tu tema — las superficies claras/oscuras permanecen.",
  "settings.accessibility.color.colorBlindType.option.off": "Apagado",
  "settings.accessibility.color.colorBlindType.option.deuteranopia":
    "Deuteranopía (rojo/verde)",
  "settings.accessibility.color.colorBlindType.option.protanopia":
    "Protanopía (rojo/verde)",
  "settings.accessibility.color.colorBlindType.option.tritanopia":
    "Tritanopía (azul/amarillo)",
  "settings.accessibility.color.colorBlindType.option.achromatopsia":
    "Acromatopsia (escala de grises)",
  "settings.accessibility.color.colorBlindSafe.label": "Modo seguro para daltonismo",
  "settings.accessibility.color.colorBlindSafe.hint":
    "Añade pistas de forma o etiquetas a cualquier señal de estado solo por color — el acento amarillo gana una marca de verificación, los estados de sincronización ganan iconos.",

  // ── writing pane ──
  "settings.writing.title": "Escritura",
  "settings.writing.hint":
    "Cómo se comporta Yarrow mientras escribes notas.",
  "settings.writing.autosave.label":
    "Marca de historial después de",
  "settings.writing.autosave.hint":
    "Cuánto espera Yarrow tras tu última pulsación antes de añadir el cambio al historial. El archivo .md siempre se escribe en disco en ~300 ms de tu escritura: esto solo controla con qué frecuencia se hace una instantánea en git.",
  "settings.writing.autosave.seconds": "{value}s",
  "settings.writing.autosave.minutes": "{value} min",
  "settings.writing.autosave.preset2m": "2 min",
  "settings.writing.autosave.preset2mTitle": "Instantánea como máximo cada 2 minutos",
  "settings.writing.autosave.preset5m": "5 min",
  "settings.writing.autosave.preset5mTitle": "Instantánea como máximo cada 5 minutos",
  "settings.writing.autosave.preset10m": "10 min",
  "settings.writing.autosave.preset10mTitle": "Instantánea como máximo cada 10 minutos",
  "settings.writing.autosave.preset15m": "15 min",
  "settings.writing.autosave.preset15mTitle": "Instantánea como máximo cada 15 minutos",
  "settings.writing.askThinking.label":
    "Preguntar en qué estaba pensando al cerrar",
  "settings.writing.askThinking.hint":
    "Un aviso no modal cuando cierras una nota; opcional.",
  "settings.writing.fade.label":
    "Atenuar notas no visitadas durante",
  "settings.writing.fade.hint":
    "Las notas que no se tocan por más tiempo aparecen atenuadas: un recordatorio amable, no una eliminación.",
  "settings.writing.fade.days": "{value}d",
  "settings.writing.editorSize.label":
    "Tamaño de fuente del editor",
  "settings.writing.editorSize.hint":
    "Se aplica al cuerpo de la nota que escribes. Tiene efecto inmediato.",
  "settings.writing.editorSize.small": "Pequeño (13)",
  "settings.writing.editorSize.snug": "Ajustado (14)",
  "settings.writing.editorSize.comfortable": "Cómodo (15)",
  "settings.writing.editorSize.standard": "Estándar (16)",
  "settings.writing.editorSize.roomy": "Amplio (17)",
  "settings.writing.editorSize.large": "Grande (19)",
  "settings.writing.editorSize.xl": "Extra grande (22)",
  "settings.writing.editorSize.huge": "Enorme (26)",
  "settings.writing.focusDefault.label":
    "Abrir espacios de trabajo en modo foco",
  "settings.writing.fastSearch.label":
    "Indexación de búsqueda rápida",
  "settings.writing.fastSearch.hint":
    "Mantiene una caché local SQLite/FTS5 para búsqueda instantánea. Tus notas siguen siendo lo canónico: la caché se puede regenerar y es seguro eliminarla.",
  "settings.writing.clearSearch.label":
    "Borrar caché de búsqueda",
  "settings.writing.clearSearch.hint":
    "Elimina .yarrow/index.db. Tus notas no se tocan: la caché se reconstruye en la siguiente búsqueda si la indexación sigue activa.",
  "settings.writing.clearSearch.button": "Borrar",
  "settings.writing.clearSearch.working": "Borrando…",
  "settings.writing.clearSearch.done":
    "Caché borrada: la próxima búsqueda la reconstruirá.",
  "settings.writing.typewriter.label": "Modo máquina de escribir",
  "settings.writing.typewriter.hint":
    "La línea activa se queda en el centro vertical del editor: la página se desplaza por debajo. Reduce la tensión cervical en sesiones largas.",
  "settings.writing.editorial.label": "Lectura editorial",
  "settings.writing.editorial.hint":
    "El modo lectura usa capitulares, citas destacadas y una interlínea generosa, así las notas terminadas se leen como una página de revista. Usa > pull: para marcar una cita destacada.",
  "settings.writing.pathCaret.label": "Cursor con tinte de el escenario",
  "settings.writing.pathCaret.hint":
    "El cursor toma el color de el escenario en la que escribes, así siempre sabes qué borrador estás editando. Desactívalo para un contraste alto por defecto.",
  "settings.writing.cookMode.label": "Modo cocina",
  "settings.writing.cookMode.hint":
    "Aumenta el tamaño del texto renderizado y pide al sistema que mantenga la pantalla encendida — para leer recetas con las manos llenas. Afecta solo al lector y a la vista previa en vivo; el editor mantiene su tamaño habitual.",
  "settings.writing.rawMarkdown.label":
    "Mostrar sintaxis markdown sin procesar",
  "settings.writing.rawMarkdown.hint":
    "Muestra ## en encabezados, **negritas** y [[ ]] en torno a los enlaces mientras escribes. Cuando está apagado, los marcadores se contraen en las líneas que no estás editando.",
  "settings.writing.editorFont.title": "Fuente del editor",
  "settings.writing.editorFont.tag":
    "Se aplica solo al cuerpo de la nota",
  "settings.writing.editorFont.hint":
    "Elige una tipografía para escribir textos largos. La interfaz, las etiquetas y los metadatos conservan las suyas.",
  "settings.writing.editorFont.serif": "Serif",
  "settings.writing.editorFont.sans": "Sans-serif",
  "settings.writing.editorFont.mono": "Mono",
  "settings.writing.savingNow": "guardando…",
  "settings.writing.autosaveNote":
    "los cambios se guardan automáticamente",

  // ── extras ──
  "settings.extras.title": "Extras de escritura",
  "settings.extras.hint":
    "Funciones opcionales que cargan su código solo cuando se activan: el editor se mantiene ligero por defecto y las suma en cuanto las activas.",

  // ── guidance ──
  "settings.guidance.title": "Modo guiado",
  "settings.guidance.hint":
    "Yarrow tiene varias ideas que no se ven a simple vista: escenarios, puntos de control, wikienlaces, comparación, sincronizaciones. El modo guiado te acompaña en cada una cada vez que la usas y deja un recordatorio discreto cuando estás en un escenario de prueba.",
  "settings.guidance.on": "El modo guiado está activado",
  "settings.guidance.off": "El modo guiado está desactivado",
  "settings.guidance.onHint":
    "Los modales de enseñanza aparecen cada vez que haces algo poco evidente: crear un escenario, insertar un wikienlace, regresar a la principal, etcétera. La cinta sobre el editor siempre se ve cuando estás en un escenario que no es la principal. Si un modal específico te molesta, cada uno tiene su propia opción «Dejar de mostrar este».",
  "settings.guidance.offHint":
    "Te las arreglas por tu cuenta. Sin modales de enseñanza ni cintas. Las pistas siguen apareciendo al pasar el cursor y las acciones destructivas siguen pidiendo confirmación.",
  "settings.guidance.optouts.title":
    "Opt-outs por modal",
  "settings.guidance.optouts.hint":
    "Si silenciaste un modal individual con su botón «Dejar de mostrar este», esto restablece esas decisiones. El modo guiado en sí queda activado.",
  "settings.guidance.optouts.label":
    "Mostrar todos los modales otra vez",
  "settings.guidance.optouts.subhint":
    "borra todos los opt-outs por clave; cada momento de enseñanza vuelve a aparecer",
  "settings.guidance.optouts.button":
    "Restablecer opt-outs",

  // ── sync ──
  "settings.sync.title": "Sincronización",
  "settings.sync.hint":
    "Respalda tu espacio de trabajo en un remoto git que controles. Tus notas siguen en tu equipo; esto solo mantiene una copia sincronizada.",
  "settings.sync.kind": "Tipo",
  "settings.sync.repoUrl": "URL del repositorio",
  "settings.sync.repoUrlPlaceholder":
    "https://github.com/tu/tus-notas.git",
  "settings.sync.token.label": "Token de acceso",
  "settings.sync.token.optional":
    "(opcional — cuadernos privados HTTPS)",
  "settings.sync.token.placeholder": "ghp_… / token de gitea",
  "settings.sync.token.note":
    "Se guarda solo en este equipo: nunca se envía al remoto.",
  "settings.sync.save": "Guardar",
  "settings.sync.saving": "guardando…",
  "settings.sync.saved":
    "guardado: prueba a sincronizar desde la barra de herramientas",
  "settings.sync.syncNow": "Sincronizar ahora",
  "settings.sync.autoSync.label":
    "Sincronización automática cada",
  "settings.sync.autoSync.off": "Apagada",
  "settings.sync.autoSync.note":
    "La sincronización se ejecuta en segundo plano con esta cadencia cuando hay un remoto conectado. Se pausa cuando la ventana está oculta. También se sincroniza al instante al volver al foco para que recuperes el ritmo al regresar de otra app.",

  // ── server ──
  "settings.server.title": "Servidor Yarrow",
  "settings.server.tagSelfOrConnect":
    "autohospedado o Connect",
  "settings.server.intro":
    "Sincroniza este espacio de trabajo a través de un servidor Yarrow que tú (o un amigo) ejecuten, o por el plan hospedado Yarrow Connect. De extremo a extremo, sin necesidad de un host de git de terceros: solo apúntalo al servidor e inicia sesión una vez.",
  "settings.server.connect": "Conectar a un servidor Yarrow",
  "settings.server.url.label": "URL del servidor",
  "settings.server.url.placeholder":
    "https://yarrow.ejemplo.com",
  "settings.server.method.label": "Método de inicio de sesión",
  "settings.server.method.password":
    "Correo electrónico + contraseña",
  "settings.server.method.token": "Pegar un token de acceso",
  "settings.server.email.label": "Correo electrónico",
  "settings.server.email.placeholder": "tu@ejemplo.com",
  "settings.server.password.label": "Contraseña",
  "settings.server.password.note":
    "La usaremos una vez para emitir un token de acceso para este espacio de trabajo y luego olvidaremos la contraseña. El token vive en tu llavero del sistema.",
  "settings.server.token.label": "Token de acceso",
  "settings.server.token.placeholder": "yrw_…",
  "settings.server.token.note":
    "Pega un token que generaste en la web del servidor. Se guarda en tu llavero del sistema, nunca en la carpeta del espacio de trabajo.",
  "settings.server.passwordForEnc.label": "Contraseña",
  "settings.server.passwordForEnc.optional":
    "(necesaria para sincronización cifrada)",
  "settings.server.passwordForEnc.note":
    "Se usa una vez, localmente, para desbloquear la clave de cifrado de tu espacio de trabajo: nunca se envía al servidor. Sin ella, el token autentica pero las sincronizaciones fallan en el paso de desbloqueo. Déjala en blanco solo cuando te conectes a un servidor previo al cifrado.",
  "settings.server.workspaceName.label":
    "Nombre del espacio de trabajo en el servidor",
  "settings.server.workspaceName.optional": "(opcional)",
  "settings.server.workspaceName.placeholder":
    "espacio de trabajo",
  "settings.server.workspaceName.note":
    "Se usa la primera vez que sincronizas. Por defecto toma el nombre de este espacio de trabajo.",
  "settings.server.skipTls.label":
    "Omitir verificación TLS (solo desarrollo)",
  "settings.server.skipTls.note.before": "Úsalo para servidores en ",
  "settings.server.skipTls.note.localhost": "localhost",
  "settings.server.skipTls.note.middle":
    " con certificados autofirmados. ",
  "settings.server.skipTls.note.warn":
    "Déjalo apagado para cualquier servidor real",
  "settings.server.skipTls.note.after":
    ": estarías confiando en cualquier intermediario entre tú y él.",
  "settings.server.test": "Probar conexión",
  "settings.server.testing": "probando…",
  "settings.server.testOk": "se ve bien ✓",
  "settings.server.connectButton": "Conectar",
  "settings.server.connecting": "conectando…",
  "settings.server.cancel": "Cancelar",

  "settings.server.connected": "conectado",
  "settings.server.tlsInsecure": "TLS: inseguro",
  "settings.server.tlsInsecureTitle":
    "La verificación TLS está deshabilitada para esta conexión. Solo para desarrollo local.",
  "settings.server.connected.serverLabel": "Servidor:",
  "settings.server.connected.signedInAs":
    "Sesión iniciada como:",
  "settings.server.connected.tokenLabel": "Token:",
  "settings.server.connected.tokenDefault": "token de acceso",
  "settings.server.connected.tokenIdSuffix": " · id {id}…",
  "settings.server.connected.tokenPasted": " · pegado",
  "settings.server.connected.workspaceLabel":
    "Espacio de trabajo en el servidor:",
  "settings.server.connected.workspaceFmt":
    "espacio de trabajo {id}…",
  "settings.server.connected.workspaceNone":
    "aún no hay espacio de trabajo: la primera sincronización lo creará",
  "settings.server.connected.syncNow": "Sincronizar ahora",
  "settings.server.connected.syncing": "sincronizando…",
  "settings.server.connected.disconnect": "Desconectar",
  "settings.server.connected.disconnecting": "desconectando…",
  "settings.server.connected.revoke":
    "Revocar y desconectar",
  "settings.server.connected.revoking": "revocando…",
  "settings.server.connected.firstSyncNote.before":
    "En tu próxima sincronización, Yarrow creará un espacio de trabajo llamado ",
  "settings.server.connected.firstSyncNote.after":
    " en el servidor y enviará tus notas por primera vez.",
  "settings.server.connected.syncedFmt":
    "sincronizado — {message}",
  "settings.server.connected.syncFailedFmt":
    "falló la sincronización — {message}",
  "settings.server.connected.conflict.title":
    "{count} conflicto autorresuelto",
  "settings.server.connected.conflict.titlePlural":
    "{count} conflictos autorresueltos",
  "settings.server.connected.conflict.body":
    "La versión del servidor ganó en cada escenario. Tus ediciones locales se guardaron como archivos hermanos: ábrelos y combínalos a mano, luego elimina la copia del conflicto.",
  "settings.server.connected.conflict.savedAs":
    "→ guardado como",

  // ── templates ──
  "settings.templates.title": "Plantillas",
  "settings.templates.hint":
    "Andamios reutilizables para formas recurrentes de notas. Los archivos viven en .yarrow/templates/ como .md plano: edítalos aquí o en cualquier editor externo.",
  "settings.templates.empty": "Aún no hay plantillas.",
  "settings.templates.daily": "diario",
  "settings.templates.new": "+ nueva",
  "settings.templates.delete": "eliminar",
  "settings.templates.placeholders":
    "Variables:",
  "settings.templates.save": "Guardar",
  "settings.templates.saved": "guardado",
  "settings.templates.empty.editor":
    "Elige una plantilla para editar o crea una nueva.",
  "settings.templates.newModal.title": "Nueva plantilla",
  "settings.templates.newModal.body":
    "Con un nombre corto basta: el andamio se puede editar de inmediato. El nombre del archivo se deriva de lo que escribas.",
  "settings.templates.newModal.placeholder":
    "p. ej. notas 1:1",
  "settings.templates.newModal.cancel": "cancelar",
  "settings.templates.newModal.create": "crear plantilla",
  "settings.templates.deleteModal.title":
    '¿Eliminar la plantilla "{label}"?',
  "settings.templates.deleteModal.body.before":
    "El archivo se elimina de ",
  "settings.templates.deleteModal.body.after":
    ". Las notas ya creadas a partir de ella no se ven afectadas.",
  "settings.templates.deleteModal.keep": "déjala",
  "settings.templates.deleteModal.confirm": "sí, eliminar",

  // ── security ──
  "settings.security.title": "Seguridad",
  "settings.security.hint":
    "Protecciones opcionales para notas que prefieres no dejar en texto plano. Apagado por defecto.",
  "settings.security.localEnc.title": "Cifrado local",
  "settings.security.tag.unlocked": "desbloqueado",
  "settings.security.tag.lockedEnabled": "activado · bloqueado",
  "settings.security.tag.off": "apagado",
  "settings.security.localEnc.body":
    "Cifrado opcional por nota con ChaCha20-Poly1305 y una contraseña Argon2id. El frontmatter (título, etiquetas, enlaces) queda en texto plano para que el grafo y el filtro de etiquetas sigan funcionando; solo el cuerpo se sella. Una frase de recuperación de 12 palabras te devuelve el acceso si olvidas la contraseña.",
  "settings.security.enable": "Activar cifrado…",
  "settings.security.idle.label":
    "Bloqueo automático por inactividad",
  "settings.security.idle.hint":
    "La sesión se bloquea si estás inactivo este tiempo. 0 = nunca.",
  "settings.security.idle.never": "nunca",
  "settings.security.idle.minutes": "{value}m",
  "settings.security.unlock": "Desbloquear…",
  "settings.security.lockNow": "Bloquear ahora",
  "settings.security.changePw": "Cambiar contraseña…",
  "settings.security.newRecovery":
    "Nueva frase de recuperación…",
  "settings.security.turnOff": "Desactivar cifrado…",
  "settings.security.toast.afterPhrase":
    "El cifrado está activo. Las notas siguen siendo legibles: abre una nota y elige el menú 🔒 de la barra de herramientas → Cifrar esta nota.",

  "settings.security.enableModal.title": "Activar cifrado",
  "settings.security.enableModal.intro":
    "Activarlo te permite cifrar notas individuales. El frontmatter (título, etiquetas, enlaces) queda en texto plano para que el grafo, el filtro de etiquetas y los retroenlaces sigan funcionando con notas cifradas.",
  "settings.security.enableModal.warn.title":
    "Mientras una nota está cifrada:",
  "settings.security.enableModal.warn.diffs":
    "Las diferencias de cuerpo en el deslizador del historial son ruido cifrado.",
  "settings.security.enableModal.warn.search":
    "La búsqueda de texto completo solo coincide con títulos y etiquetas.",
  "settings.security.enableModal.warn.external":
    "Abrir el .md en otro editor muestra texto cifrado.",
  "settings.security.enableModal.warn.export":
    "La exportación a sitio estático omite la nota por completo.",
  "settings.security.enableModal.warn.lost":
    "Si pierdes la contraseña y la frase de recuperación, la nota se va para siempre.",
  "settings.security.enableModal.notNow": "ahora no",
  "settings.security.enableModal.continue":
    "entiendo, continuar",
  "settings.security.enableModal.passwordIntro":
    "Elige una contraseña para el espacio de trabajo. La escribirás cada vez que se bloquee la sesión (o nunca, si apagas el bloqueo por inactividad).",
  "settings.security.enableModal.password": "Contraseña",
  "settings.security.enableModal.confirmPassword":
    "Confirmar contraseña",
  "settings.security.enableModal.cancel": "cancelar",
  "settings.security.enableModal.settingUp":
    "preparando…",
  "settings.security.enableModal.enableButton":
    "activar cifrado",
  "settings.security.error.mismatch":
    "las contraseñas no coinciden",
  "settings.security.error.tooShort":
    "la contraseña debe tener al menos 8 caracteres",

  "settings.security.recoveryModal.title":
    "Tu frase de recuperación",
  "settings.security.recoveryModal.body.before":
    "Anota estas 12 palabras en un lugar seguro: ",
  "settings.security.recoveryModal.body.bold":
    "esta es la única vez que las verás.",
  "settings.security.recoveryModal.body.after":
    " Restablecen tu contraseña si la olvidas y permiten que cualquier otra persona descifre tus notas, así que mantenlas fuera de línea.",
  "settings.security.recoveryModal.copy":
    "Copiar al portapapeles",
  "settings.security.recoveryModal.copyHint":
    "límpialo antes de guardarlo en cualquier sitio en línea",
  "settings.security.recoveryModal.confirm":
    "Las anoté en un lugar seguro",
  "settings.security.recoveryModal.done": "listo",

  "settings.security.disableModal.title":
    "Desactivar cifrado",
  "settings.security.disableModal.body":
    "Cada nota cifrada en este espacio de trabajo se reescribirá como texto plano y se hará un punto de control. El archivo de configuración de seguridad se elimina.",
  "settings.security.disableModal.password.label":
    "Contraseña (para confirmar)",
  "settings.security.disableModal.keep": "déjalo activado",
  "settings.security.disableModal.decrypting":
    "descifrando todo…",
  "settings.security.disableModal.confirm":
    "desactivarlo",

  "settings.security.changePwModal.title":
    "Cambiar contraseña de cifrado",
  "settings.security.changePwModal.current":
    "contraseña actual",
  "settings.security.changePwModal.new": "nueva contraseña",
  "settings.security.changePwModal.confirm":
    "confirmar nueva contraseña",
  "settings.security.changePwModal.cancel": "cancelar",
  "settings.security.changePwModal.saving": "guardando…",
  "settings.security.changePwModal.submit":
    "cambiar contraseña",
  "settings.security.changePwModal.error.mismatch":
    "las nuevas contraseñas no coinciden",

  "settings.security.regenModal.title":
    "Nueva frase de recuperación",
  "settings.security.regenModal.body":
    "Genera una frase nueva de 12 palabras e invalida la anterior. Tu contraseña sigue siendo la misma.",
  "settings.security.regenModal.current":
    "contraseña actual",
  "settings.security.regenModal.cancel": "cancelar",
  "settings.security.regenModal.working": "procesando…",
  "settings.security.regenModal.submit":
    "generar nueva frase",

  // ── workspace ──
  "settings.workspace.title": "Espacio de trabajo",
  "settings.workspace.hint":
    "La carpeta donde viven tus notas.",
  "settings.workspace.name.label": "Nombre",
  "settings.workspace.name.hint":
    "Se muestra arriba a la izquierda en la barra lateral.",
  "settings.workspace.startingNote.label": "Nota inicial",
  "settings.workspace.startingNote.hint":
    "El ancla para las decisiones que vienen: donde empieza tu mapa.",
  "settings.workspace.startingNote.notSet": "Sin definir",
  "settings.workspace.startingNote.change": "Cambiar…",
  "settings.workspace.folder.label": "Carpeta",
  "settings.workspace.folder.hint":
    "Donde se guardan tus notas como archivos .md.",
  "settings.workspace.folder.showFull": "Mostrar ruta completa",
  "settings.workspace.folder.hideFull": "Ocultar ruta completa",
  "settings.workspace.created.label": "Creado",
  "settings.workspace.import.title":
    "Importar notas desde otra app",
  "settings.workspace.import.body.before":
    "Trae notas desde Obsidian, Bear, Logseq, Notion o una exportación BibTeX (",
  "settings.workspace.import.body.bib": ".bib",
  "settings.workspace.import.body.middle":
    "). Cada entrada de un archivo ",
  "settings.workspace.import.body.middle2":
    " se vuelve una ficha de paper etiquetada ",
  "settings.workspace.import.body.tag": "#paper",
  "settings.workspace.import.body.after":
    ", lista para el selector @cite.",
  "settings.workspace.import.button": "Importar notas…",
  "settings.workspace.export.title":
    "Exportar como sitio estático",
  "settings.workspace.export.body":
    "Guarda tu espacio de trabajo como una carpeta HTML autocontenida que puedes compartir o alojar donde quieras. Los adjuntos y el grafo de conexiones se incluyen.",
  "settings.workspace.trim.title":
    "Recortar historial de puntos de control",
  "settings.workspace.trim.body":
    "Tus notas actuales nunca se tocan. Esto olvida instantáneas más antiguas para que el deslizador del historial deje de saturarse. Cada acción es una reescritura de un solo sentido: si sincronizas con un remoto, después tendrás que hacer force-push.",
  "settings.workspace.trash.title": "Retención de la papelera",
  "settings.workspace.trash.body":
    "Cuánto tiempo espera una nota eliminada en la Papelera antes de purgarse definitivamente. La limpieza ocurre al abrir el espacio de trabajo. Elige «Para siempre» si prefieres vaciarla manualmente.",
  "settings.workspace.trash.note":
    "Las notas eliminadas se purgan tras {days} días al abrir el espacio.",
  "settings.workspace.trash.foreverNote":
    "Las notas eliminadas permanecen en la Papelera hasta que la vacíes tú.",
  "settings.workspace.trash.forever": "Para siempre",
  "settings.workspace.clearCache.title":
    "Borrar todas las cachés derivadas",
  "settings.workspace.clearCache.body.before": "Elimina ",
  "settings.workspace.clearCache.body.indexJson":
    ".yarrow/index.json",
  "settings.workspace.clearCache.body.middle":
    " (grafo) y",
  "settings.workspace.clearCache.body.indexDb":
    ".yarrow/index.db",
  "settings.workspace.clearCache.body.after":
    " (búsqueda). Tus notas quedan exactamente igual: ambas cachés se reconstruyen a demanda.",
  "settings.workspace.close.button":
    "Cerrar este espacio de trabajo",
  "settings.workspace.close.note":
    "Nada se elimina: puedes reabrir esta carpeta cuando quieras.",

  "settings.export.dialogTitle":
    "Elige una carpeta para la exportación",
  "settings.export.go": "Exportar como sitio estático…",
  "settings.export.exporting": "exportando…",
  "settings.export.report.note": "nota",
  "settings.export.report.notes": "notas",
  "settings.export.report.attachment": "adjunto",
  "settings.export.report.attachments": "adjuntos",
  "settings.export.report.skipped":
    "se omitieron {count} cifradas",
  "settings.export.report.summary":
    "Se exportaron {notes} {noteWord}{attachBit}{skipBit} → {dest}",
  "settings.export.failed":
    "Error al exportar: {error}",
  "settings.export.attachBit": " + {count} {word}",

  "settings.export.modal.title": "Exportar como sitio estático",
  "settings.export.modal.body":
    "Yarrow escribirá una copia publicable de este espacio de trabajo como HTML estático — una página por nota, conservando los enlaces entre ellas. Las notas cifradas y todo lo que hayas mantenido privado se omiten automáticamente.",
  "settings.export.modal.dest.label": "Carpeta de destino",
  "settings.export.modal.dest.choose": "Elegir una carpeta…",
  "settings.export.modal.dest.change": "Cambiar carpeta",
  "settings.export.modal.cancel": "Cancelar",
  "settings.export.modal.close": "Cerrar",
  "settings.export.modal.confirm": "Exportar",
  "settings.export.modal.again": "Exportar de nuevo",

  "settings.trim.olderBtn":
    "Olvidar puntos de control antiguos…",
  "settings.trim.emptyBtn":
    "Olvidar puntos de control vacíos",
  "settings.trim.unifiedBtn": "Recortar puntos de control…",
  "settings.trim.unifiedPicker.title": "Recortar puntos de control",
  "settings.trim.unifiedPicker.body":
    "Ambas opciones descartan instantáneas guardadas — tus notas actuales se quedan exactamente como están. Elige qué tipo olvidar y te mostraremos qué va a desaparecer.",
  "settings.trim.unifiedPicker.modeAge.label": "Más antiguos que…",
  "settings.trim.unifiedPicker.modeAge.hint":
    "Descarta instantáneas más allá de un corte. Útil para podar un historial largo.",
  "settings.trim.unifiedPicker.modeEmpty.label": "Puntos de control vacíos",
  "settings.trim.unifiedPicker.modeEmpty.hint":
    'Descarta instantáneas de "nota nueva" antes de que aterrizara contenido. La mayoría no encuentra valor aquí.',
  "settings.trim.unifiedPicker.cutoffLabel": "¿Cuánto conservar?",
  "settings.trim.nothing":
    "Nada que recortar: no hay puntos de control {label}.",
  "settings.trim.label.older":
    "más antiguos que {days} días",
  "settings.trim.label.empty": "sin contenido",
  "settings.trim.removed.singular":
    "Se olvidó {count} punto de control {label}. Se conservaron {kept}.",
  "settings.trim.removed.plural":
    "Se olvidaron {count} puntos de control {label}. Se conservaron {kept}.",
  "settings.trim.failed":
    "No se pudo recortar: {error}",
  "settings.trim.picker.title":
    "Olvidar puntos de control más antiguos que…",
  "settings.trim.picker.body":
    "Elige cuánto historial conservar. Cualquier cosa más antigua se descarta en cada escenario: las notas actuales quedan exactamente igual.",
  "settings.trim.picker.daysFmt": "{days} días",
  "settings.trim.picker.keep180": "conservar ~medio año",
  "settings.trim.picker.keep90":
    "conservar ~un trimestre",
  "settings.trim.picker.keep60": "conservar ~dos meses",
  "settings.trim.picker.keep30": "conservar ~un mes",
  "settings.trim.picker.cancel": "cancelar",
  "settings.trim.picker.continue": "continuar",
  "settings.trim.confirmAge.title":
    "¿Olvidar puntos de control más antiguos que {days} días?",
  "settings.trim.confirmAge.body":
    "Cada instantánea guardada con más de {days} días de antigüedad se descartará en cada escenario. Tus notas actuales quedan exactamente igual: solo desaparecen las entradas antiguas del deslizador del historial.",
  "settings.trim.confirm.warnTitle":
    "Esto no se puede deshacer:",
  "settings.trim.confirmAge.warn.thinking":
    'Las antiguas notas «¿en qué estabas pensando?» se borran.',
  "settings.trim.confirmAge.warn.blame":
    "Se pierde la procedencia de blame-hover anterior al corte.",
  "settings.trim.confirm.warn.forcePush":
    "Si sincronizas con un remoto, tu próxima sincronización necesitará un force-push.",
  "settings.trim.keep": "conservar todo",
  "settings.trim.trimming": "recortando…",
  "settings.trim.confirmDoit": "sí, olvidarlos",
  "settings.trim.confirmEmpty.title":
    "¿Olvidar puntos de control vacíos?",
  "settings.trim.confirmEmpty.body":
    'Descarta cada instantánea guardada en la que todas tus notas seguían vacías: sobre todo momentos «nueva nota» antes de empezar a escribir. Las instantáneas con contenido real se conservan.',
  "settings.trim.confirmEmpty.warn.scrub":
    "Ya no podrás retroceder al momento del andamio en blanco de una nota.",

  "settings.clearCache.button": "Borrar toda la caché",
  "settings.clearCache.done":
    "Todas las cachés derivadas se borraron. Ambas se reconstruirán a demanda.",
  "settings.clearCache.failed":
    "No se pudieron borrar las cachés: {error}",
  "settings.clearCache.modal.title":
    "¿Borrar todas las cachés derivadas?",
  "settings.clearCache.modal.body":
    "Elimina el índice del grafo y la base de datos de búsqueda. Tus notas y el historial git no se tocan. Ambas cachés se reconstruyen automáticamente, pero la próxima búsqueda en una bóveda grande puede pausarse brevemente mientras FTS5 reindexa cada nota.",
  "settings.clearCache.modal.does": "Sí borra:",
  "settings.clearCache.modal.does.json": "— grafo de enlaces",
  "settings.clearCache.modal.does.db":
    "+ WAL — caché de búsqueda",
  "settings.clearCache.modal.doesnt": "No toca:",
  "settings.clearCache.modal.doesnt.md.before": "Tus archivos de nota ",
  "settings.clearCache.modal.doesnt.md.after": ".",
  "settings.clearCache.modal.doesnt.git":
    "Historial de puntos de control git.",
  "settings.clearCache.modal.doesnt.workspace":
    "Configuración del espacio de trabajo, plantillas o adjuntos.",
  "settings.clearCache.modal.cancel": "cancelar",
  "settings.clearCache.modal.clearing": "borrando…",
  "settings.clearCache.modal.confirm":
    "sí, borrar todo",

  // ── storage ──
  "settings.storage.title":
    "Administrar almacenamiento del servidor",
  "settings.storage.intro.bold":
    "Esta página elimina archivos del servidor",
  "settings.storage.intro.body":
    ", no de tu equipo. Úsala cuando necesites liberar espacio en el servidor porque un archivo grande se está comiendo tu cuota.",
  "settings.storage.body":
    "Abajo aparece cada nota que sigue en el servidor, ordenada por cuánto espacio ocupa en el historial completo del espacio de trabajo (incluidas versiones pasadas de notas que editaste y notas que eliminaste localmente pero que aún existen en el historial). Seleccionar un archivo y confirmar lo elimina del servidor para siempre y obliga a cada otro dispositivo a soltar su copia en la próxima sincronización. Las copias locales en este equipo se reescriben para coincidir.",
  "settings.storage.loadFailed":
    "No se pudieron cargar los archivos grandes: {error}",
  "settings.storage.loading": "Cargando…",
  "settings.storage.empty":
    "Nada destaca. El servidor está cómodo con este espacio de trabajo.",
  "settings.storage.col.file": "Archivo",
  "settings.storage.col.size": "Tamaño",
  "settings.storage.dangling.path":
    "(blob colgante: sin escenario)",
  "settings.storage.collapseAria": "Contraer historial",
  "settings.storage.expandAria": "Expandir historial",
  "settings.storage.collapseTitle":
    "Ocultar versiones pasadas",
  "settings.storage.expandTitle":
    "Mostrar versiones pasadas",
  "settings.storage.versionsCount":
    "{count} versiones en el historial",
  "settings.storage.version.col":
    "Versión (id de objeto · más antigua primero)",
  "settings.storage.version.note":
    "Seleccionar elimina cada versión de arriba: una reescritura unidireccional del historial.",
  "settings.storage.selected.singular":
    "{count} seleccionado · {bytes} a liberar",
  "settings.storage.selected.plural":
    "{count} seleccionados · {bytes} a liberar",
  "settings.storage.selected.empty":
    "Selecciona archivos para eliminarlos permanentemente.",
  "settings.storage.deleteSelected":
    "Eliminar lo seleccionado del servidor…",

  "settings.storage.confirm.title":
    "¿Eliminar permanentemente del servidor?",
  "settings.storage.confirm.body.before":
    "Estás a punto de eliminar ",
  "settings.storage.confirm.body.fileSingular": "archivo",
  "settings.storage.confirm.body.filePlural": "archivos",
  "settings.storage.confirm.body.middle": " del servidor",
  "settings.storage.confirm.body.after":
    " y de cada versión pasada del espacio de trabajo. Los archivos también desaparecerán de este equipo y de cada otro dispositivo que sincroniza: en todas partes, para siempre.",
  "settings.storage.confirm.cantUndo":
    "Esto no se puede deshacer.",
  "settings.storage.confirm.done":
    "Listo. Se liberaron {bytes}. Otros dispositivos volverán a descargar una copia limpia en su próxima sincronización.",
  "settings.storage.confirm.typeToConfirm.before":
    "Escribe ",
  "settings.storage.confirm.typeToConfirm.after":
    " para confirmar",
  "settings.storage.confirm.placeholder": "DELETE",
  "settings.storage.confirm.cancel": "Cancelar",
  "settings.storage.confirm.deleting":
    "Eliminando del servidor…",
  "settings.storage.confirm.confirmButton":
    "Sí, eliminar permanentemente del servidor",
  "settings.storage.confirm.doneButton": "Listo",

  "settings.align.title":
    "¿Atascado tras liberar espacio?",
  "settings.align.body":
    "Si tú (u otro dispositivo) acabas de eliminar archivos del servidor pero este equipo sigue creyendo que está sobre la cuota, este botón trae el nuevo estado del servidor y descarta cualquier cambio local sin sincronizar que haga referencia a los archivos eliminados. Úsalo si la sincronización no se recupera por sí sola.",
  "settings.align.button":
    "Sincronizar el estado del servidor ahora",
  "settings.align.syncing": "Sincronizando…",
  "settings.align.alreadyInSync":
    "Ya está sincronizado con el servidor.",
  "settings.align.dropped.singular":
    "Se descartó {count} cambio local y se realineó con el servidor.",
  "settings.align.dropped.plural":
    "Se descartaron {count} cambios locales y se realineó con el servidor.",

  // ── shortcuts ──
  "settings.shortcuts.title": "Atajos de teclado",
  "settings.shortcuts.hint":
    "Mostrados en estilo {platform}. Aún no son configurables.",
  "settings.shortcuts.platform.mac": "macOS",
  "settings.shortcuts.platform.other": "Windows / Linux",
  "settings.shortcuts.group.gettingAround":
    "Moverte por la app",
  "settings.shortcuts.group.writing": "Escritura",
  "settings.shortcuts.palette":
    "Paleta de comandos: buscar, saltar, ejecutar",
  "settings.shortcuts.quickSwitch":
    "Cambio rápido de nota (título difuso)",
  "settings.shortcuts.switchWorkspace":
    "Cambiar de espacio de trabajo",
  "settings.shortcuts.jumpToday": "Ir al diario de hoy",
  "settings.shortcuts.openSettings": "Abrir configuración",
  "settings.shortcuts.newNote": "Nueva nota",
  "settings.shortcuts.newDirection":
    "Explorar una nueva dirección (nuevo escenario)",
  "settings.shortcuts.branchFromHere":
    "Bifurcar desde la nota actual",
  "settings.shortcuts.focusToggle":
    "Alternar modo foco (ocultar barras laterales)",
  "settings.shortcuts.scratchpad": "Alternar borrador",
  "settings.shortcuts.editorHint.before":
    "Haz clic derecho en el editor para insertar un ",
  "settings.shortcuts.editorHint.or": " o ",
  "settings.shortcuts.editorHint.middle":
    ": elige una nota de la lista y activa «en línea» si quieres transcluirla. Escribe ",
  "settings.shortcuts.editorHint.after":
    " al inicio de una línea para marcar una pregunta abierta.",

  // ── help (3.1) ──
  "settings.help.title": "Ayuda y comentarios",
  "settings.help.hint":
    "Lee la documentación, mira qué cambió en esta versión y contacta con el equipo de Yarrow. Nada aquí se envía a casa hasta que tú haces clic.",
  "settings.help.docs.title": "Documentación",
  "settings.help.docs.body":
    "Los documentos completos están en línea pero también vienen con la app para lectura sin conexión.",
  "settings.help.docs.openOnline": "Abrir documentación (en línea)",
  "settings.help.docs.shortcutsCheatsheet": "Hoja de atajos de teclado",
  "settings.help.whatsNew.title": "Novedades",
  "settings.help.whatsNew.body":
    "Estás en la versión {version}. Lee las notas de la versión para todos los cambios desde tu última actualización.",
  "settings.help.whatsNew.viewChangelog": "Ver el changelog",
  "settings.help.support.title": "Enviar comentarios o reportar un bug",
  "settings.help.support.body":
    "Un correo va bien para una idea rápida; las issues de GitHub son mejores para bugs que quieres seguir. Nunca recopilamos nada que no decidas compartir.",
  "settings.help.support.sendFeedback": "Enviar comentarios…",
  "settings.help.support.openIssue": "Abrir una issue en GitHub…",
  "settings.help.support.copyDiagnostics": "Copiar diagnóstico",
  "settings.help.feedback.subject": "Comentarios sobre Yarrow",
  "settings.help.feedback.bodyTemplate":
    "(Escribe aquí. La línea de abajo es opcional — Yarrow no la comparte salvo que la dejes en el mensaje.)\n\n— {diagnostics}",

  // ── about ──
  "settings.about.title": "Acerca de Yarrow",
  "settings.about.body1":
    "Yarrow es una herramienta de notas para el pensamiento no lineal. Tus notas son archivos markdown planos en una carpeta: ábrelos en cualquier editor, respáldalos donde quieras. Yarrow solo lleva el seguimiento de las conexiones y las versiones por ti.",
  "settings.about.body2":
    'Cada guardado es un punto de control. Cada «nueva dirección» es una ruta a la que puedes volver. Nada de lo que escribas se pierde.',
  "settings.about.versionLine":
    "versión {version} · primero local · markdown plano",
  "settings.about.links.title": "Enlaces",
  "settings.about.links.docs": "Guía del usuario",
  "settings.about.links.changelog": "Registro de cambios",
  "settings.about.links.github": "GitHub",
  "settings.about.links.website": "Sitio web",

  // ── export / import settings (3.1) ──
  "settings.about.exportImport.title": "Exportar e importar ajustes",
  "settings.about.exportImport.body":
    "Guarda un volcado JSON de todas las preferencias de Yarrow en esta máquina, o restáuralo en otra. Las notas en sí no se exportan — solo los controles de este panel. Útil al configurar una segunda máquina y querer que se sienta igual.",
  "settings.about.exportImport.exportBtn": "Exportar ajustes…",
  "settings.about.exportImport.importBtn": "Importar ajustes…",
  "settings.about.exportImport.savePromptTitle":
    "Guardar tus ajustes de Yarrow",
  "settings.about.exportImport.exporting": "Exportando…",
  "settings.about.exportImport.importing": "Importando…",
  "settings.about.exportImport.exportDone":
    "Exportadas {count} preferencias.",
  "settings.about.exportImport.exportFailed":
    "No se pudo exportar: {error}",
  "settings.about.exportImport.importDone":
    "Importadas {count} preferencias. Recargando…",
  "settings.about.exportImport.importFailed":
    "No se pudo importar: {error}",
  "settings.about.exportImport.notASnapshot":
    "Ese archivo no es un volcado de ajustes de Yarrow.",

  // ── reset to defaults (3.1) ──
  "settings.about.reset.title": "Restablecer todos los ajustes",
  "settings.about.reset.body":
    "Olvidar todas las preferencias y empezar de cero con los valores por defecto. Tus notas, escenarios e historial no se tocan — solo los controles de este panel. Es la opción nuclear.",
  "settings.about.reset.button": "Restablecer todos los ajustes…",
  "settings.about.reset.confirmTitle": "¿Restablecer todas las preferencias de Yarrow?",
  "settings.about.reset.confirmBody":
    "Temas, fuentes, atajos gestuales, elecciones de modo, ayudas de configuración, estado guiado, accesibilidad — todo vuelve de fábrica. Tus notas permanecen exactamente como están.",
  "settings.about.reset.cancel": "Cancelar",
  "settings.about.reset.confirmBtn": "Restablecer todo",
  "settings.about.resetA11y.title": "Restablecer accesibilidad",
  "settings.about.resetA11y.body":
    "Olvidar solo las preferencias de accesibilidad (vista, movimiento, motor, cognitivo, lector, color). El resto — temas, fuentes, gestos, modos — permanece igual.",
  "settings.about.resetA11y.button": "Restablecer accesibilidad…",
  "settings.about.resetA11y.confirmTitle":
    "¿Restablecer los ajustes de accesibilidad?",
  "settings.about.resetA11y.confirmBody":
    "Escala de texto, contraste, movimiento, tamaño de objetivos, fuente para dislexia, guía de lectura, paleta para daltonismo, anillo de foco — todo vuelve a los valores predeterminados. Nada más cambia.",
  "settings.about.resetA11y.confirmBtn": "Restablecer accesibilidad",
  "settings.about.resetA11y.done": "Listo — todos los valores predeterminados están restaurados.",
  "settings.about.resetWorkspace.title": "Restablecer ajustes del espacio de trabajo",
  "settings.about.resetWorkspace.body":
    "Olvidar las preferencias propias de este espacio de trabajo guardadas en su config.toml — debounce de checkpoint, días de decaimiento, tamaño de fuente del editor, tiempo de inactividad, cadencia de sincronización, retención de papelera. La URL de sincronización y la conexión al servidor no se tocan. Tus notas tampoco.",
  "settings.about.resetWorkspace.button": "Restablecer ajustes del espacio…",
  "settings.about.resetWorkspace.confirmTitle":
    "¿Restablecer los ajustes del espacio de trabajo?",
  "settings.about.resetWorkspace.confirmBody":
    "El debounce vuelve a 8 s, decaimiento a 60 días, tamaño de fuente a 16, inactividad a 15 min, sincronización a 5 min, retención de papelera a 30 días. El remoto de sincronización y el token del servidor permanecen intactos. Las notas no se tocan.",
  "settings.about.resetWorkspace.confirmBtn": "Restablecer ajustes del espacio",

  // ── gestures (2.2.0) ──
  "settings.gestures.title": "El Punto Quieto",
  "settings.gestures.hint":
    "El punto central del menú radial escucha tres gestos configurables. Cada uno dispara una acción nombrada — elige las tuyas abajo. Arrastrar-fuera y rueda de scroll son estructurales y no son configurables.",
  "settings.gestures.slot.tap.label": "Toque simple",
  "settings.gestures.slot.tap.meta": "tap",
  "settings.gestures.slot.longPress.label": "Mantener pulsado",
  "settings.gestures.slot.longPress.meta": "pulsación larga · 380 ms",
  "settings.gestures.slot.doubleTap.label": "Doble toque",
  "settings.gestures.slot.doubleTap.meta": "doble toque · 280 ms",
  "settings.gestures.group.core": "Esenciales",
  "settings.gestures.group.navigation": "Navegación",
  "settings.gestures.group.writing": "Escritura",
  "settings.gestures.group.system": "Sistema",

  "settings.gestures.action.palette.label": "Abrir la paleta de comandos",
  "settings.gestures.action.palette.blurb": "buscar notas, ejecutar comandos, saltar a cualquier sitio — igual que ⌘K.",
  "settings.gestures.action.quickHand.label": "Abrir la Mano Rápida",
  "settings.gestures.action.quickHand.blurb": "un pequeño modal con nueve botones para las cosas que más usas.",
  "settings.gestures.action.constellationModal.label": "Abrir la Constelación",
  "settings.gestures.action.constellationModal.blurb": "ocho botones orbitan el punto del clic en un pequeño abanico de acciones.",
  "settings.gestures.action.constellation.label": "Abrir el grafo de conexiones",
  "settings.gestures.action.constellation.blurb": "el panel-mapa de la barra derecha — vínculos entre esta nota y sus vecinas.",
  "settings.gestures.action.outline.label": "Mostrar el esquema",
  "settings.gestures.action.outline.blurb": "encabezados y viñetas de primer nivel como árbol clicable.",
  "settings.gestures.action.todayJournal.label": "Abrir el diario de hoy",
  "settings.gestures.action.todayJournal.blurb": "crea la nota diaria desde tu plantilla si no existe — igual que ⌘T.",
  "settings.gestures.action.newNote.label": "Crear una nota nueva",
  "settings.gestures.action.newNote.blurb": "abre el diálogo de nueva nota — igual que ⌘N.",
  "settings.gestures.action.newPath.label": "Explorar una dirección nueva",
  "settings.gestures.action.newPath.blurb": "bifurca un escenario desde donde estás — igual que ⌘⇧N.",
  "settings.gestures.action.livePreview.label": "Alternar vista previa en vivo",
  "settings.gestures.action.livePreview.blurb": "divide el panel de escritura y renderiza el lado derecho mientras escribes.",
  "settings.gestures.action.cookMode.label": "Alternar modo cocina",
  "settings.gestures.action.cookMode.blurb": "vista de lectura con texto grande y pantalla siempre encendida — para recetas con las manos llenas.",
  "settings.gestures.action.focus.label": "Alternar modo enfoque",
  "settings.gestures.action.focus.blurb": "oculta los marcos — solo queda la nota. Igual que ⌘\\.",
  "settings.gestures.action.scratchpad.label": "Alternar el borrador",
  "settings.gestures.action.scratchpad.blurb": "un bloc anclado que guarda todo pero nunca compromete a git.",
  "settings.gestures.action.settings.label": "Abrir ajustes",
  "settings.gestures.action.settings.blurb": "te trae a este mismo panel — útil como atajo paranoico mientras configuras.",

  "settings.gestures.structural.title": "Gestos estructurales",
  "settings.gestures.structural.hint":
    "Dos gestos más viven en el disco central pero no son configurables — son cómo el radial funciona como radial.",
  "settings.gestures.structural.dragOut.tag": "arrastrar-fuera",
  "settings.gestures.structural.dragOut.desc":
    "Pulsa en el centro y flecha el puntero hacia cualquier sector — se dispara sin un clic separado.",
  "settings.gestures.structural.scroll.tag": "rueda",
  "settings.gestures.structural.scroll.desc":
    "Gira la rueda con el menú abierto para mover el resaltado sin mover el puntero.",

  "settings.gestures.reset.atDefaults": "Las asignaciones están en los valores recomendados.",
  "settings.gestures.reset.modified": "Las asignaciones difieren de los valores recomendados.",
  "settings.gestures.reset.btn": "Restablecer",
  "settings.gestures.reset.confirmTitle": "¿Restaurar gestos recomendados?",
  "settings.gestures.reset.confirmBody":
    "Las tres asignaciones volverán a lo que Yarrow trae por defecto. Esto solo afecta al punto central — no toca ningún otro ajuste.",
  "settings.gestures.reset.cancel": "Cancelar",
  "settings.gestures.reset.confirm": "Restablecer",
};

export const settingsSV: Record<SettingsKey, string> = {
  // ── shell ──
  "settings.title": "Inställningar",
  "settings.searchPlaceholder": "Sök…",
  "settings.escToClose": "esc för att stänga",
  "settings.closeAria": "Stäng inställningar",
  "settings.closeTitle": "Stäng (Esc)",

  // ── tabs ──
  "settings.tabs.mode": "Lägen och personor",
  "settings.tabs.appearance": "Utseende",
  "settings.tabs.accessibility": "Tillgänglighet",
  "settings.tabs.writing": "Skrivande",
  "settings.tabs.gestures": "Gester",
  "settings.tabs.guidance": "Vägledning",
  "settings.tabs.templates": "Mallar",
  "settings.tabs.sync": "Synkronisering",
  "settings.tabs.storage": "Lagring",
  "settings.tabs.security": "Säkerhet",
  "settings.tabs.workspace": "Arbetsyta",
  "settings.tabs.shortcuts": "Kortkommandon",
  "settings.tabs.help": "Hjälp",
  "settings.tabs.about": "Om",

  // ── nav groups (3.1) ──
  "settings.nav.group.experience": "Upplevelse",
  "settings.nav.group.content": "Innehåll",
  "settings.nav.group.system": "System",
  "settings.nav.group.about": "Om",

  // ── scope chips (3.1) ──
  "settings.scope.device": "Enhet",
  "settings.scope.workspace": "Arbetsyta",
  "settings.scope.account": "Konto",
  "settings.scope.mixed": "Blandat",
  "settings.scope.device.title":
    "Sparas endast på den här maskinen — färdas inte till andra enheter.",
  "settings.scope.workspace.title":
    "Färdas med den här anteckningsboken. Andra enheter som öppnar samma arbetsyta ser det här.",
  "settings.scope.account.title":
    "Gäller överallt där du loggar in.",
  "settings.scope.mixed.title":
    "Den här panelen blandar enhetslokala och arbetsytsbundna inställningar — kolla varje rad.",

  // ── mode pane ──
  "settings.mode.title": "Lägen och personor",
  "settings.mode.hint":
    "Lägen styr den övergripande komplexiteten. Personor lägger till hantverksspecifika verktyg ovanpå — båda är reversibla, och ⌘K når allt det ena eller andra döljer.",
  "settings.mode.modeSection": "Läge",
  "settings.mode.personaSection": "Persona",
  "settings.mode.personaIntro":
    "Frivilligt. En persona är ett skin ovanpå Vägbaserat — lägger till hantverksspecifika verktyg utan att låsa något annat.",
  "settings.mode.personaNone": "Ingen",
  "settings.mode.personaNoneDesc":
    "Rent Vägbaserat. Hela Yarrow-ytan utan persona-skin.",
  "settings.mode.footerNote":
    "Lägen styr listan och paletten; de spärrar aldrig funktioner. Du kan byta när som helst.",
  "settings.mode.option.basic.label": "Enkelt",
  "settings.mode.option.basic.desc":
    "Bara skriva. Inga vägar, ingen graf, inga extrafunktioner — autocheckpoint kör fortfarande i bakgrunden.",
  "settings.mode.option.basic.bullet1": "Vanliga anteckningar, taggar och kladdblock",
  "settings.mode.option.basic.bullet2": "Inga vägar, graf eller kits i listen",
  "settings.mode.option.basic.bullet3": "Autocheckpoint sparar varje ändring i bakgrunden",
  "settings.mode.option.basic.bullet4": "Allt nås fortfarande via ⌘K",
  "settings.mode.option.path.label": "Vägbaserat",
  "settings.mode.option.path.desc":
    "Hela Yarrow-ytan utan persona-skin. Standard för dig som vill ha allt Yarrow kan.",
  "settings.mode.option.path.bullet1": "Vägar med förgreningar och ömsesidiga kopplingar",
  "settings.mode.option.path.bullet2": "Kraftriktad anslutningsgraf",
  "settings.mode.option.path.bullet3": "Historiktidslinje och föräldralösa-panel",
  "settings.mode.option.path.bullet4": "Kits-väljare och hela tangentbordsytan",
  "settings.mode.option.writer.label": "Skribent",
  "settings.mode.option.writer.desc":
    "Vägbaserat + skrivverktyg. En lugn, fokuserad yta för prosa.",
  "settings.mode.option.writer.bullet1": "Daglig skrivserie med målpiller",
  "settings.mode.option.writer.bullet2": "Skrivmaskinsläge",
  "settings.mode.option.writer.bullet3": "Tystade vägdetaljer — fokus på prosan",
  "settings.mode.option.writer.bullet4": "Ordräknare och framstegsindikator i statusraden",
  "settings.mode.option.researcher.label": "Forskare",
  "settings.mode.option.researcher.desc":
    "Vägbaserat + forskarverktyg. För källor, citat och öppna frågor.",
  "settings.mode.option.researcher.bullet1": "Panel för öppna frågor (??-markörer)",
  "settings.mode.option.researcher.bullet2": "Källbibliotek med filter",
  "settings.mode.option.researcher.bullet3": "Mall för nya källor",
  "settings.mode.option.researcher.bullet4": "??-räknare i statusraden",
  "settings.mode.option.developer.label": "Utvecklare",
  "settings.mode.option.developer.desc":
    "Vägbaserat + ingenjörsverktyg. För beslut, kod och topologi.",
  "settings.mode.option.developer.bullet1": "Beslutslogg (ADR-lista)",
  "settings.mode.option.developer.bullet2": "Mall för nya beslut (ADR)",
  "settings.mode.option.developer.bullet3": "Syntaxmarkering för kod",
  "settings.mode.option.developer.bullet4": "Beslutsräknare i statusraden",
  "settings.mode.option.clinician.label": "Kliniker",
  "settings.mode.option.clinician.desc":
    "Vägbaserat + kliniska verktyg. För känsliga anteckningar, uppföljningar och sessionsstruktur.",
  "settings.mode.option.clinician.bullet1": "Lista över känsliga anteckningar",
  "settings.mode.option.clinician.bullet2": "Uppföljningstavla (#review, #followup, #todo, #wip)",
  "settings.mode.option.clinician.bullet3": "Mallar för SOAP / BIRP / DAP / Inskrivning",
  "settings.mode.option.clinician.bullet4": "Spårbarhet via autocheckpoints",
  "settings.mode.option.cooking.label": "Matlagning",
  "settings.mode.option.cooking.desc":
    "Vägbaserat + köksverktyg. För recept, läsning utan händer och inköp.",
  "settings.mode.option.cooking.bullet1": "Matlagningsläge med läsning utan händer",
  "settings.mode.option.cooking.bullet2": "Receptklippare för URL:er",
  "settings.mode.option.cooking.bullet3": "Smart inköpslista",
  "settings.mode.option.cooking.bullet4": "Receptbibliotek och inbyggda timers",

  // ── search ──
  "settings.search.empty":
    'Inget matchar "{query}". Prova ett ord som "typsnitt", "synk" eller "lösenord".',
  "settings.search.resultsCount":
    "{count} träff för \"{query}\"",
  "settings.search.resultsCountPlural":
    "{count} träffar för \"{query}\"",

  "settings.search.mode.label": "Lägen och personor",
  "settings.search.mode.sublabel":
    "Enkelt · Vägbaserat · Skribent · Forskare · Utvecklare · Kliniker · Matlagning",
  "settings.search.appearance.theme.label": "Tema",
  "settings.search.appearance.theme.sublabel":
    "ljus · mörk · auto · ashrose · dracula",
  "settings.search.accessibility.label": "Tillgänglighet",
  "settings.search.accessibility.sublabel":
    "syn · rörelse · motorik · kognitivt · skärmläsare · färg",
  "settings.search.accessibility.contrast.label": "Kontrast",
  "settings.search.accessibility.dyslexia.label": "Dyslexi-typsnitt",
  "settings.search.accessibility.motion.label": "Minska rörelse",
  "settings.search.appearance.size.label":
    "Gränssnittsstorlek",
  "settings.search.appearance.size.sublabel":
    "kompakt · bekväm · luftig",
  "settings.search.appearance.font.label":
    "Gränssnittstypsnitt",
  "settings.search.appearance.font.sublabel":
    "Inter · serif-alternativ",

  "settings.search.writing.autosave.label":
    "Spara varje ändring efter",
  "settings.search.writing.autosave.sublabel":
    "fördröjning för autospar",
  "settings.search.writing.askThinking.label":
    "Fråga vad jag tänkte vid stängning",
  "settings.search.writing.fadeNotes.label":
    "Tona ner anteckningar som inte besökts på",
  "settings.search.writing.editorFontSize.label":
    "Typsnittsstorlek i editorn",
  "settings.search.writing.focusDefault.label":
    "Öppna arbetsytor i fokusläge",
  "settings.search.writing.rawMarkdown.label":
    "Visa rå markdown-syntax",
  "settings.search.writing.editorFont.label":
    "Editorns typsnitt",

  "settings.search.guidance.guidedMode.label": "Guidat läge",
  "settings.search.guidance.guidedMode.sublabel":
    "handledning för komplexa funktioner",
  "settings.search.guidance.reset.label":
    "Återställ vägledning",
  "settings.search.guidance.reset.sublabel":
    "se alla undervisningsdialoger igen",

  "settings.search.templates.label": "Mallar",
  "settings.search.templates.sublabel":
    "återanvändbara anteckningsstommar",

  "settings.search.sync.repo.label": "Synk-URL",
  "settings.search.sync.token.label": "Åtkomsttoken",
  "settings.search.sync.server.label": "Yarrow-server",
  "settings.search.sync.server.sublabel":
    "egen drift eller Connect",
  "settings.search.sync.disconnect.label":
    "Koppla från servern",

  "settings.search.security.localEnc.label":
    "Lokal kryptering",
  "settings.search.security.localEnc.sublabel":
    "lösenord + återställningsfras",
  "settings.search.security.idleLock.label":
    "Automatlås vid inaktivitet",
  "settings.search.security.changePw.label":
    "Byt lösenord",
  "settings.search.security.recovery.label":
    "Återställningsfras",
  "settings.search.security.turnOff.label":
    "Stäng av kryptering",

  "settings.search.workspace.name.label": "Namn",
  "settings.search.workspace.name.sublabel":
    "visas i sidofältet",
  "settings.search.workspace.folder.label": "Mapp",
  "settings.search.workspace.folder.sublabel":
    "där dina anteckningar ligger",
  "settings.search.workspace.export.label":
    "Exportera som statisk webbplats",
  "settings.search.workspace.trim.label":
    "Trimma kontrollpunkthistorik",
  "settings.search.workspace.trim.sublabel":
    "glöm gamla ögonblicksbilder",
  "settings.search.workspace.close.label":
    "Stäng den här arbetsytan",

  "settings.search.shortcuts.label": "Kortkommandon",

  "settings.search.about.label": "Om Yarrow",
  "settings.search.about.sublabel": "version, länkar",

  // ── accessibility pane (3.1) ──
  "settings.accessibility.title": "Tillgänglighet",
  "settings.accessibility.hint":
    "Anpassa hur Yarrow ser ut och uppför sig så det fungerar med ditt sätt att läsa, skriva och röra dig. Varje inställning här är lokal för den här maskinen.",

  "settings.accessibility.presets.title": "Färdiga lägen",
  "settings.accessibility.presets.body":
    "Tillämpa ett testat paket av ändringar på en gång. Du kan fortfarande justera enskilda kontroller efteråt — förinställningarna är inga lås.",
  "settings.accessibility.presets.changeCount": "Ändrar {count} inställningar · allt återställbart",

  "settings.accessibility.presets.low-vision.label": "Nedsatt syn",
  "settings.accessibility.presets.low-vision.desc":
    "Större text, paletter med högre kontrast, större markör, tydligare fokusring.",
  "settings.accessibility.presets.dyslexia-friendly.label": "Dyslexi-vänlig",
  "settings.accessibility.presets.dyslexia-friendly.desc":
    "Atkinson-typsnitt, läsguide på, stavningskontroll av — färre röda markeringar medan du skriver.",
  "settings.accessibility.presets.reduced-motion.label": "Reducerad rörelse",
  "settings.accessibility.presets.reduced-motion.desc":
    "Stänger av animationer, autoplay och transparens. Användbart vid vestibulär känslighet.",
  "settings.accessibility.presets.motor-friendly.label": "Motoriskt vänlig",
  "settings.accessibility.presets.motor-friendly.desc":
    "Större tryckytor, sekvensvänliga genvägar och inga håll-in-gester.",

  "settings.accessibility.vision.title": "Syn",
  "settings.accessibility.vision.textScale.label": "Textstorlek",
  "settings.accessibility.vision.textScale.hint":
    "Skalar all text i gränssnittet och redigerarens brödtext samtidigt. Redigerarens egen teckenstorlek fungerar fortfarande ovanpå detta.",
  "settings.accessibility.vision.contrast.label": "Kontrast",
  "settings.accessibility.vision.contrast.hint":
    "Standard = den levererade paletten. Hög = AAA-version av temat. Maximal = riktig svart-vit oavsett tema.",
  "settings.accessibility.vision.contrast.option.default": "Standard",
  "settings.accessibility.vision.contrast.option.high": "Hög (AAA)",
  "settings.accessibility.vision.contrast.option.maximum": "Maximal",
  "settings.accessibility.vision.reduceTransparency.label": "Minska transparens",
  "settings.accessibility.vision.reduceTransparency.hint":
    "Stänger av suddighet och genomskinlighet på modal-bakgrunder och popovers — skarpare kanter, lättare att läsa.",
  "settings.accessibility.vision.largerCursor.label": "Större markör",
  "settings.accessibility.vision.largerCursor.hint":
    "Större markör i redigeraren och tjockare fokusindikator vid markering.",
  "settings.accessibility.vision.dyslexiaFont.label": "Dyslexi-vänligt typsnitt",
  "settings.accessibility.vision.dyslexiaFont.hint":
    "Byter redigerarens text till Atkinson Hyperlegible. Påverkar inte gränssnittet — det behåller sitt vanliga typsnitt.",

  "settings.accessibility.motion.title": "Rörelse",
  "settings.accessibility.motion.reduceMotion.label": "Minska rörelse",
  "settings.accessibility.motion.reduceMotion.hint":
    "Auto följer ditt OS-val. På tvingar bort alla animationer; Av behåller dem oavsett.",
  "settings.accessibility.motion.reduceMotion.option.auto": "Auto (system)",
  "settings.accessibility.motion.reduceMotion.option.on": "På",
  "settings.accessibility.motion.reduceMotion.option.off": "Av",
  "settings.accessibility.motion.disableAutoplay.label": "Avaktivera autoplay",
  "settings.accessibility.motion.disableAutoplay.hint":
    "Stoppar anslutningsgrafen och liknande visualiseringar från att animera tills du själv frågar.",

  "settings.accessibility.motor.title": "Motorisk",
  "settings.accessibility.motor.largeTargets.label": "Större tryckytor",
  "settings.accessibility.motor.largeTargets.hint":
    "Höjer alla interaktiva element till minst 44×44 pt — lättare med trackpad eller tryck.",
  "settings.accessibility.motor.stickyKeys.label": "Sticky-keys-medvetet",
  "settings.accessibility.motor.stickyKeys.hint":
    "Visar genvägar i sekvens (⌘ följt av K) istället för ackord (⌘K) — användbart med OS-funktionen för fästknappar.",
  "settings.accessibility.motor.plainContextMenu.label":
    "Använd standardmenyn för högerklick istället för den radiella",
  "settings.accessibility.motor.plainContextMenu.hint":
    "Ersätter den tryck-och-håll-radiella menyn med en vanlig vertikal kontextmeny — vänligare för darrningar, RSI, artrit eller alla som tycker att tryck-och-håll-gester är smärtsamma.",
  "settings.gestures.disabled.title":
    "Gester är avaktiverade i Tillgänglighet",
  "settings.gestures.disabled.body":
    "Du har stängt av den radiella högerklicksmenyn under Tillgänglighet → Motorisk. Aktivera den där så börjar dessa gestbindningar att fungera igen.",
  "settings.gestures.disabled.openA11y": "Öppna Tillgänglighet →",
  "settings.accessibility.viz.title": "Visualiseringar",
  "settings.accessibility.viz.animateGraph.label": "Animera anslutningsgrafen",
  "settings.accessibility.viz.animateGraph.hint":
    "Låter den kraftriktade simuleringen lägga sig när grafen öppnas. Stäng av om subtil rörelse är obekväm; grafen renderas fortfarande, bara statiskt.",
  "settings.accessibility.viz.diffPatterns.label": "Diff-mönster vid sidan av färg",
  "settings.accessibility.viz.diffPatterns.hint":
    "Lägger till understrykning + genomstrykning på tillägg/borttagningar så diffen är läsbar utan färg. Rekommenderas för alla — hjälper också i starkt ljus.",
  "settings.accessibility.viz.graphTableAlt.label": "Visa graf som lista",
  "settings.accessibility.viz.graphTableAlt.hint":
    "Ersätter den rumsliga grafen med en chip-grupperad lista över anslutningar per relationstyp. Lättare för skärmläsare och alla som föredrar att läsa.",

  "settings.accessibility.cognitive.title": "Kognitivt",
  "settings.accessibility.cognitive.readingGuide.label": "Läsguide",
  "settings.accessibility.cognitive.readingGuide.hint":
    "En valfri horisontell stapel som följer markörraden — hjälper med att inte tappa platsen.",
  "settings.accessibility.cognitive.spellTone.label": "Stavningskontrollens ton",
  "settings.accessibility.cognitive.spellTone.hint":
    "Välj hur felstavningar markeras. Av om ihärdigt röda streck känns stressande.",
  "settings.accessibility.cognitive.spellTone.option.underline": "Understruket (standard)",
  "settings.accessibility.cognitive.spellTone.option.highlight": "Markerat",
  "settings.accessibility.cognitive.spellTone.option.off": "Av",

  "settings.accessibility.reader.title": "Skärmläsare och tangentbord",
  "settings.accessibility.reader.verbose.label": "Utförliga meddelanden",
  "settings.accessibility.reader.verbose.hint":
    "Annonsera synkroniseringsstatus, autosparhändelser och kontrollpunkter till skärmläsare när de inträffar.",
  "settings.accessibility.reader.focusRing.label": "Fokusringens stil",
  "settings.accessibility.reader.focusRing.hint":
    "Hur synlig tangentbordsfokusindikatorn är. Subtil för att matcha paletten, Hög för tydlighet före estetik.",
  "settings.accessibility.reader.focusRing.option.subtle": "Subtil",
  "settings.accessibility.reader.focusRing.option.default": "Standard",
  "settings.accessibility.reader.focusRing.option.high": "Hög synlighet",

  "settings.accessibility.reset.title": "Återställ",
  "settings.accessibility.color.title": "Färg",
  "settings.accessibility.color.colorBlindType.label":
    "Palett för färgblindhet",
  "settings.accessibility.color.colorBlindType.hint":
    "Skiftar accent- och persona-färger till en nyansuppsättning som är urskiljbar under den valda formen av färgblindhet. Lager ovanpå ditt tema — ljusa/mörka ytor är samma.",
  "settings.accessibility.color.colorBlindType.option.off": "Av",
  "settings.accessibility.color.colorBlindType.option.deuteranopia":
    "Deuteranopi (röd/grön)",
  "settings.accessibility.color.colorBlindType.option.protanopia":
    "Protanopi (röd/grön)",
  "settings.accessibility.color.colorBlindType.option.tritanopia":
    "Tritanopi (blå/gul)",
  "settings.accessibility.color.colorBlindType.option.achromatopsia":
    "Akromatopsi (gråskala)",
  "settings.accessibility.color.colorBlindSafe.label": "Färgblind-säkert läge",
  "settings.accessibility.color.colorBlindSafe.hint":
    "Lägger till form- eller etikett-ledtrådar utöver färgsignaler — den gula urvalsaccenten får en bock, synkstatus får ikoner.",

  // ── writing pane ──
  "settings.writing.title": "Skrivande",
  "settings.writing.hint":
    "Hur Yarrow uppför sig medan du skriver anteckningar.",
  "settings.writing.autosave.label":
    "Kontrollpunkt i historiken efter",
  "settings.writing.autosave.hint":
    "Hur länge Yarrow väntar efter ditt senaste tangenttryck innan ändringen läggs till i historiken. .md-filen på disken skrivs alltid inom ~300 ms av din skrivning — detta styr bara hur ofta Yarrow tar en ögonblicksbild i git.",
  "settings.writing.autosave.seconds": "{value} s",
  "settings.writing.autosave.minutes": "{value} min",
  "settings.writing.autosave.preset2m": "2 min",
  "settings.writing.autosave.preset2mTitle": "Ögonblicksbild högst varannan minut",
  "settings.writing.autosave.preset5m": "5 min",
  "settings.writing.autosave.preset5mTitle": "Ögonblicksbild högst var 5:e minut",
  "settings.writing.autosave.preset10m": "10 min",
  "settings.writing.autosave.preset10mTitle": "Ögonblicksbild högst var 10:e minut",
  "settings.writing.autosave.preset15m": "15 min",
  "settings.writing.autosave.preset15mTitle": "Ögonblicksbild högst var 15:e minut",
  "settings.writing.askThinking.label":
    "Fråga vad jag tänkte vid stängning",
  "settings.writing.askThinking.hint":
    "En icke-modal fråga när du stänger en anteckning — valfritt.",
  "settings.writing.fade.label":
    "Tona ner anteckningar som inte besökts på",
  "settings.writing.fade.hint":
    "Anteckningar som inte rörts under längre tid än så här tonas ner — en mild knuff, ingen radering.",
  "settings.writing.fade.days": "{value} d",
  "settings.writing.editorSize.label":
    "Typsnittsstorlek i editorn",
  "settings.writing.editorSize.hint":
    "Gäller anteckningens brödtext. Träder i kraft direkt.",
  "settings.writing.editorSize.small": "Liten (13)",
  "settings.writing.editorSize.snug": "Tät (14)",
  "settings.writing.editorSize.comfortable": "Bekväm (15)",
  "settings.writing.editorSize.standard": "Standard (16)",
  "settings.writing.editorSize.roomy": "Luftig (17)",
  "settings.writing.editorSize.large": "Stor (19)",
  "settings.writing.editorSize.xl": "Extra stor (22)",
  "settings.writing.editorSize.huge": "Enorm (26)",
  "settings.writing.focusDefault.label":
    "Öppna arbetsytor i fokusläge",
  "settings.writing.fastSearch.label":
    "Snabb sökindexering",
  "settings.writing.fastSearch.hint":
    "Behåller en lokal SQLite/FTS5-cache för omedelbar sökning. Dina anteckningar är fortfarande kanoniska — cachen kan återskapas och är säker att radera.",
  "settings.writing.clearSearch.label":
    "Töm sökcachen",
  "settings.writing.clearSearch.hint":
    "Tar bort .yarrow/index.db. Dina anteckningar berörs inte — cachen byggs om vid nästa sökning om indexering fortfarande är på.",
  "settings.writing.clearSearch.button": "Töm",
  "settings.writing.clearSearch.working": "Tömmer…",
  "settings.writing.clearSearch.done":
    "Cachen tömd — nästa sökning bygger om den.",
  "settings.writing.typewriter.label": "Skrivmaskinsläge",
  "settings.writing.typewriter.hint":
    "Den aktiva raden ligger kvar i mitten av editorn — sidan rullar under. Mindre nackbelastning under långa pass.",
  "settings.writing.editorial.label": "Redaktionell läsning",
  "settings.writing.editorial.hint":
    "Läsläget använder anfangsbokstäver, lyfta citat och generös radhöjd — så färdiga anteckningar läses som ett magasin. Använd > pull: för att markera ett lyft citat.",
  "settings.writing.pathCaret.label":
    "Stigfärgad markör",
  "settings.writing.pathCaret.hint":
    "Markören får färgen av scenariot du skriver i, så du alltid vet vilket utkast du redigerar. Stäng av för standardkontrast.",
  "settings.writing.cookMode.label": "Matlagningsläge",
  "settings.writing.cookMode.hint":
    "Förstorar renderad text och ber systemet hålla skärmen vaken — för att läsa recept med fulla händer. Påverkar bara läsaren och direktförhandsvisningen; editorn behåller sin vanliga storlek.",
  "settings.writing.rawMarkdown.label":
    "Visa rå markdown-syntax",
  "settings.writing.rawMarkdown.hint":
    "Visa ## i rubriker, **fet** och [[ ]] runt länkar medan du skriver. När det är av faller tecken samman på rader du inte redigerar.",
  "settings.writing.editorFont.title": "Editorns typsnitt",
  "settings.writing.editorFont.tag":
    "Gäller bara anteckningens brödtext",
  "settings.writing.editorFont.hint":
    "Välj ett typsnitt för längre skrivande. Gränssnittet, taggar och metadata behåller sina egna.",
  "settings.writing.editorFont.serif": "Serif",
  "settings.writing.editorFont.sans": "Sans-serif",
  "settings.writing.editorFont.mono": "Mono",
  "settings.writing.savingNow": "sparar…",
  "settings.writing.autosaveNote":
    "ändringar sparas automatiskt",

  // ── extras ──
  "settings.extras.title": "Skrivextras",
  "settings.extras.hint":
    "Frivilliga funktioner som lat-laddar sin kod först när de aktiveras — editorn hålls slank som standard och plockar upp dem i samma stund du slår på dem.",

  // ── guidance ──
  "settings.guidance.title": "Guidat läge",
  "settings.guidance.hint":
    "Yarrow har en handfull begrepp som inte är självklara — scenarier, kontrollpunkter, wikilänkar, jämförelse, synkar. Guidat läge går igenom var och en varje gång du använder det och lämnar en stillsam påminnelse synlig när du befinner dig i ett provscenario.",
  "settings.guidance.on": "Guidat läge är på",
  "settings.guidance.off": "Guidat läge är av",
  "settings.guidance.onHint":
    "Undervisningsdialoger visas varje gång du gör något icke uppenbart — skapa ett scenario, infoga en wikilänk, återvända till huvudet och så vidare. Bandet ovanför editorn syns alltid när du är på ett scenario som inte är main. Om en specifik dialog börjar irritera har var och en sin egen 'Sluta visa den här'.",
  "settings.guidance.offHint":
    "Du klarar dig själv. Inga undervisningsdialoger, inga band. Verktygstips dyker upp vid hovring, och destruktiva åtgärder ber fortfarande om bekräftelse.",
  "settings.guidance.optouts.title":
    "Avstå per dialog",
  "settings.guidance.optouts.hint":
    "Om du tystat en enskild dialog via dess 'Sluta visa den här' återställer det här de valen. Själva guidade läget förblir på.",
  "settings.guidance.optouts.label":
    "Visa varje dialog igen",
  "settings.guidance.optouts.subhint":
    "rensar alla nyckelvisa avståenden; varje undervisningsögonblick visas igen",
  "settings.guidance.optouts.button":
    "Återställ avståenden",

  // ── sync ──
  "settings.sync.title": "Synkronisering",
  "settings.sync.hint":
    "Säkerhetskopiera din arbetsyta till en git-fjärr du själv äger. Dina anteckningar stannar på din maskin — det här håller bara en kopia synkroniserad.",
  "settings.sync.kind": "Typ",
  "settings.sync.repoUrl": "Synk-URL",
  "settings.sync.repoUrlPlaceholder":
    "https://github.com/du/dina-anteckningar.git",
  "settings.sync.token.label": "Åtkomsttoken",
  "settings.sync.token.optional":
    "(valfritt — privata HTTPS-repon)",
  "settings.sync.token.placeholder": "ghp_… / gitea-token",
  "settings.sync.token.note":
    "Sparas bara på den här maskinen — pushas aldrig till fjärren.",
  "settings.sync.save": "Spara",
  "settings.sync.saving": "sparar…",
  "settings.sync.saved":
    "sparat — prova att synkronisera från verktygsraden",
  "settings.sync.syncNow": "Synkronisera nu",
  "settings.sync.autoSync.label":
    "Automatisk synkronisering var",
  "settings.sync.autoSync.off": "Av",
  "settings.sync.autoSync.note":
    "Synkronisering körs i bakgrunden i den här takten när en fjärr är ansluten. Pausas när fönstret är dolt. En direktsynk körs också vid fönsterfokus, så du hinner ikapp när du kommer tillbaka från en annan app.",

  // ── server ──
  "settings.server.title": "Yarrow-server",
  "settings.server.tagSelfOrConnect":
    "egen drift eller Connect",
  "settings.server.intro":
    "Synkronisera den här arbetsytan via en Yarrow-server du (eller en vän) kör, eller genom det hostade Yarrow Connect-erbjudandet. Helt mellan dig och servern, ingen tredjeparts git-värd behövs — peka bara på servern och logga in en gång.",
  "settings.server.connect": "Anslut till en Yarrow-server",
  "settings.server.url.label": "Server-URL",
  "settings.server.url.placeholder":
    "https://yarrow.exempel.com",
  "settings.server.method.label": "Inloggningsmetod",
  "settings.server.method.password":
    "E-post + lösenord",
  "settings.server.method.token":
    "Klistra in en åtkomsttoken",
  "settings.server.email.label": "E-post",
  "settings.server.email.placeholder":
    "du@exempel.com",
  "settings.server.password.label": "Lösenord",
  "settings.server.password.note":
    "Vi använder det en gång för att skapa en åtkomsttoken för den här arbetsytan, sedan glömmer vi lösenordet. Token ligger i ditt OS-nyckelvalv.",
  "settings.server.token.label": "Åtkomsttoken",
  "settings.server.token.placeholder": "yrw_…",
  "settings.server.token.note":
    "Klistra in en token du genererat i serverns webbgränssnitt. Lagras i ditt OS-nyckelvalv, aldrig i arbetsytemappen.",
  "settings.server.passwordForEnc.label": "Lösenord",
  "settings.server.passwordForEnc.optional":
    "(behövs för krypterad synk)",
  "settings.server.passwordForEnc.note":
    "Används en gång lokalt för att låsa upp arbetsytans krypteringsnyckel — skickas aldrig till servern. Utan det autentiseras token men synk misslyckas vid upplåsningssteget. Lämna tomt bara när du ansluter mot en server före kryptering.",
  "settings.server.workspaceName.label":
    "Arbetsytans namn på servern",
  "settings.server.workspaceName.optional": "(valfritt)",
  "settings.server.workspaceName.placeholder": "arbetsyta",
  "settings.server.workspaceName.note":
    "Används första gången du synkroniserar. Standard är denna arbetsytas namn.",
  "settings.server.skipTls.label":
    "Hoppa över TLS-verifiering (endast utveckling)",
  "settings.server.skipTls.note.before":
    "Använd för servrar på ",
  "settings.server.skipTls.note.localhost": "localhost",
  "settings.server.skipTls.note.middle":
    " med självsignerade certifikat. ",
  "settings.server.skipTls.note.warn":
    "Lämna av för riktiga servrar",
  "settings.server.skipTls.note.after":
    " — då litar du på vilken man-i-mitten som helst mellan dig och den.",
  "settings.server.test": "Testa anslutning",
  "settings.server.testing": "testar…",
  "settings.server.testOk": "ser bra ut ✓",
  "settings.server.connectButton": "Anslut",
  "settings.server.connecting": "ansluter…",
  "settings.server.cancel": "Avbryt",

  "settings.server.connected": "ansluten",
  "settings.server.tlsInsecure": "TLS: osäker",
  "settings.server.tlsInsecureTitle":
    "TLS-verifiering är inaktiverad för den här anslutningen. Avsedd för lokal utveckling.",
  "settings.server.connected.serverLabel": "Server:",
  "settings.server.connected.signedInAs": "Inloggad som:",
  "settings.server.connected.tokenLabel": "Token:",
  "settings.server.connected.tokenDefault":
    "åtkomsttoken",
  "settings.server.connected.tokenIdSuffix": " · id {id}…",
  "settings.server.connected.tokenPasted": " · inklistrad",
  "settings.server.connected.workspaceLabel":
    "Arbetsyta på servern:",
  "settings.server.connected.workspaceFmt":
    "arbetsyta {id}…",
  "settings.server.connected.workspaceNone":
    "ingen arbetsyta än — första synken skapar en",
  "settings.server.connected.syncNow":
    "Synkronisera nu",
  "settings.server.connected.syncing":
    "synkroniserar…",
  "settings.server.connected.disconnect":
    "Koppla från",
  "settings.server.connected.disconnecting":
    "kopplar från…",
  "settings.server.connected.revoke":
    "Återkalla och koppla från",
  "settings.server.connected.revoking":
    "återkallar…",
  "settings.server.connected.firstSyncNote.before":
    "Vid din nästa synk skapar Yarrow en arbetsyta som heter ",
  "settings.server.connected.firstSyncNote.after":
    " på servern och pushar upp dina anteckningar för första gången.",
  "settings.server.connected.syncedFmt":
    "synkat — {message}",
  "settings.server.connected.syncFailedFmt":
    "synk misslyckades — {message}",
  "settings.server.connected.conflict.title":
    "{count} konflikt löstes automatiskt",
  "settings.server.connected.conflict.titlePlural":
    "{count} konflikter löstes automatiskt",
  "settings.server.connected.conflict.body":
    "Serverns version vann i varje sökväg. Dina lokala ändringar sparas som syskonfiler — öppna båda och slå samman för hand, ta sedan bort konfliktkopian.",
  "settings.server.connected.conflict.savedAs":
    "→ sparades som",

  // ── templates ──
  "settings.templates.title": "Mallar",
  "settings.templates.hint":
    "Återanvändbara stommar för återkommande anteckningsformer. Filerna ligger i .yarrow/templates/ som vanlig .md — redigera dem här eller i valfri extern editor.",
  "settings.templates.empty": "Inga mallar än.",
  "settings.templates.daily": "daglig",
  "settings.templates.new": "+ ny",
  "settings.templates.delete": "ta bort",
  "settings.templates.placeholders": "Platshållare:",
  "settings.templates.save": "Spara",
  "settings.templates.saved": "sparat",
  "settings.templates.empty.editor":
    "Välj en mall att redigera, eller skapa en ny.",
  "settings.templates.newModal.title": "Ny mall",
  "settings.templates.newModal.body":
    "Ett kort namn räcker — stommen går att redigera direkt efter. Filnamnet härleds från det du skriver.",
  "settings.templates.newModal.placeholder":
    "t.ex. 1:1-anteckningar",
  "settings.templates.newModal.cancel": "avbryt",
  "settings.templates.newModal.create": "skapa mall",
  "settings.templates.deleteModal.title":
    'Ta bort mallen "{label}"?',
  "settings.templates.deleteModal.body.before":
    "Filen tas bort från ",
  "settings.templates.deleteModal.body.after":
    ". Anteckningar som redan skapats från den påverkas inte.",
  "settings.templates.deleteModal.keep": "behåll den",
  "settings.templates.deleteModal.confirm":
    "ja, ta bort",

  // ── security ──
  "settings.security.title": "Säkerhet",
  "settings.security.hint":
    "Frivilligt skydd för anteckningar du helst inte vill ha i klartext. Av som standard.",
  "settings.security.localEnc.title": "Lokal kryptering",
  "settings.security.tag.unlocked": "upplåst",
  "settings.security.tag.lockedEnabled":
    "aktiverad · låst",
  "settings.security.tag.off": "av",
  "settings.security.localEnc.body":
    "Frivillig kryptering per anteckning med ChaCha20-Poly1305 och ett Argon2id-lösenord. Frontmatter (titel, taggar, länkar) ligger kvar i klartext så grafen och taggfiltret fortsätter fungera; bara kroppen försluts. En återställningsfras med 12 ord ger dig in igen om du glömmer lösenordet.",
  "settings.security.enable": "Aktivera kryptering…",
  "settings.security.idle.label":
    "Automatlås vid inaktivitet",
  "settings.security.idle.hint":
    "Sessionen låses om du är inaktiv så länge. 0 = aldrig.",
  "settings.security.idle.never": "aldrig",
  "settings.security.idle.minutes": "{value} min",
  "settings.security.unlock": "Lås upp…",
  "settings.security.lockNow": "Lås nu",
  "settings.security.changePw": "Byt lösenord…",
  "settings.security.newRecovery":
    "Ny återställningsfras…",
  "settings.security.turnOff": "Stäng av kryptering…",
  "settings.security.toast.afterPhrase":
    "Krypteringen är på. Anteckningar är fortfarande läsbara — öppna en anteckning och välj 🔒-menyn i verktygsraden → Kryptera den här anteckningen.",

  "settings.security.enableModal.title":
    "Aktivera kryptering",
  "settings.security.enableModal.intro":
    "Att slå på det här låter dig kryptera enskilda anteckningar. Frontmatter (titel, taggar, länkar) ligger kvar i klartext så grafen, taggfiltret och bakåtlänkarna fortsätter fungera även för krypterade anteckningar.",
  "settings.security.enableModal.warn.title":
    "Medan en anteckning är krypterad:",
  "settings.security.enableModal.warn.diffs":
    "Skillnader i kroppen i historik-skjutreglaget är chiffertextbrus.",
  "settings.security.enableModal.warn.search":
    "Fulltextsökning matchar bara titlar och taggar.",
  "settings.security.enableModal.warn.external":
    "Att öppna .md-filen i en annan editor visar chiffertext.",
  "settings.security.enableModal.warn.export":
    "Statisk webbplatsexport hoppar över anteckningen helt.",
  "settings.security.enableModal.warn.lost":
    "Förlorar du både lösenordet och återställningsfrasen är anteckningen borta.",
  "settings.security.enableModal.notNow": "inte nu",
  "settings.security.enableModal.continue":
    "jag förstår, fortsätt",
  "settings.security.enableModal.passwordIntro":
    "Välj ett arbetsytelösenord. Du skriver det varje gång sessionen låses (eller aldrig om du stänger av automatlåset).",
  "settings.security.enableModal.password": "Lösenord",
  "settings.security.enableModal.confirmPassword":
    "Bekräfta lösenord",
  "settings.security.enableModal.cancel": "avbryt",
  "settings.security.enableModal.settingUp":
    "ställer in…",
  "settings.security.enableModal.enableButton":
    "aktivera kryptering",
  "settings.security.error.mismatch":
    "lösenorden matchar inte",
  "settings.security.error.tooShort":
    "lösenordet måste vara minst 8 tecken",

  "settings.security.recoveryModal.title":
    "Din återställningsfras",
  "settings.security.recoveryModal.body.before":
    "Skriv ner dessa 12 ord på ett säkert ställe — ",
  "settings.security.recoveryModal.body.bold":
    "det här är enda gången du ser dem.",
  "settings.security.recoveryModal.body.after":
    " De återställer ditt lösenord om du glömmer det och låter vem som helst dekryptera dina anteckningar, så håll dem offline.",
  "settings.security.recoveryModal.copy":
    "Kopiera till urklipp",
  "settings.security.recoveryModal.copyHint":
    "rensa det innan du sparar någonstans online",
  "settings.security.recoveryModal.confirm":
    "Jag har skrivit ner det på ett säkert ställe",
  "settings.security.recoveryModal.done": "klart",

  "settings.security.disableModal.title":
    "Stäng av kryptering",
  "settings.security.disableModal.body":
    "Varje krypterad anteckning i den här arbetsytan skrivs om i klartext och en kontrollpunkt skapas. Säkerhetsinställningsfilen tas bort.",
  "settings.security.disableModal.password.label":
    "Lösenord (för att bekräfta)",
  "settings.security.disableModal.keep":
    "behåll det på",
  "settings.security.disableModal.decrypting":
    "dekrypterar allt…",
  "settings.security.disableModal.confirm":
    "stäng av det",

  "settings.security.changePwModal.title":
    "Byt krypteringslösenord",
  "settings.security.changePwModal.current":
    "nuvarande lösenord",
  "settings.security.changePwModal.new":
    "nytt lösenord",
  "settings.security.changePwModal.confirm":
    "bekräfta nytt lösenord",
  "settings.security.changePwModal.cancel": "avbryt",
  "settings.security.changePwModal.saving": "sparar…",
  "settings.security.changePwModal.submit":
    "byt lösenord",
  "settings.security.changePwModal.error.mismatch":
    "de nya lösenorden matchar inte",

  "settings.security.regenModal.title":
    "Ny återställningsfras",
  "settings.security.regenModal.body":
    "Genererar en ny fras på 12 ord och ogiltigförklarar den gamla. Ditt lösenord är detsamma.",
  "settings.security.regenModal.current":
    "nuvarande lösenord",
  "settings.security.regenModal.cancel": "avbryt",
  "settings.security.regenModal.working": "arbetar…",
  "settings.security.regenModal.submit":
    "generera ny fras",

  // ── workspace ──
  "settings.workspace.title": "Arbetsyta",
  "settings.workspace.hint":
    "Mappen där dina anteckningar bor.",
  "settings.workspace.name.label": "Namn",
  "settings.workspace.name.hint":
    "Visas uppe till vänster i sidofältet.",
  "settings.workspace.startingNote.label":
    "Startanteckning",
  "settings.workspace.startingNote.hint":
    "Ankaret för beslut framåt — där din karta börjar.",
  "settings.workspace.startingNote.notSet": "Inte satt",
  "settings.workspace.startingNote.change": "Ändra…",
  "settings.workspace.folder.label": "Mapp",
  "settings.workspace.folder.hint":
    "Där dina anteckningar sparas som .md-filer.",
  "settings.workspace.folder.showFull": "Visa hela sökvägen",
  "settings.workspace.folder.hideFull": "Dölj hela sökvägen",
  "settings.workspace.created.label": "Skapad",
  "settings.workspace.import.title":
    "Importera anteckningar från en annan app",
  "settings.workspace.import.body.before":
    "Hämta in anteckningar från Obsidian, Bear, Logseq, Notion eller en BibTeX-export (",
  "settings.workspace.import.body.bib": ".bib",
  "settings.workspace.import.body.middle":
    "). Varje post från en ",
  "settings.workspace.import.body.middle2":
    "-fil blir ett papperskort taggat ",
  "settings.workspace.import.body.tag": "#paper",
  "settings.workspace.import.body.after":
    ", redo för @cite-väljaren.",
  "settings.workspace.import.button":
    "Importera anteckningar…",
  "settings.workspace.export.title":
    "Exportera som statisk webbplats",
  "settings.workspace.export.body":
    "Spara din arbetsyta som en självständig HTML-mapp du kan dela eller hosta var som helst. Bilagor och kopplingsgrafen följer med.",
  "settings.workspace.trim.title":
    "Trimma kontrollpunkthistorik",
  "settings.workspace.trim.body":
    "Dina nuvarande anteckningar berörs aldrig. Det här glömmer äldre ögonblicksbilder så historik-skjutreglaget inte trängs. Varje åtgärd är en enkelriktad omskrivning — om du synkar mot en fjärr behöver du köra force-push efteråt.",
  "settings.workspace.trash.title": "Papperskorgens varaktighet",
  "settings.workspace.trash.body":
    "Hur länge en raderad anteckning ligger kvar i Papperskorgen innan den rensas. Rensningen sker nästa gång arbetsytan öppnas. Välj För alltid om du föredrar att tömma manuellt.",
  "settings.workspace.trash.note":
    "Raderade anteckningar rensas efter {days} dagar nästa gång arbetsytan öppnas.",
  "settings.workspace.trash.foreverNote":
    "Raderade anteckningar stannar i Papperskorgen tills du tömmer den själv.",
  "settings.workspace.trash.forever": "För alltid",
  "settings.workspace.clearCache.title":
    "Töm alla härledda cacher",
  "settings.workspace.clearCache.body.before":
    "Suddar ut ",
  "settings.workspace.clearCache.body.indexJson":
    ".yarrow/index.json",
  "settings.workspace.clearCache.body.middle":
    " (graf) och",
  "settings.workspace.clearCache.body.indexDb":
    ".yarrow/index.db",
  "settings.workspace.clearCache.body.after":
    " (sökning). Dina anteckningar ligger kvar exakt som de är — båda cacherna byggs om vid behov.",
  "settings.workspace.close.button":
    "Stäng den här arbetsytan",
  "settings.workspace.close.note":
    "Inget tas bort — du kan öppna den här mappen igen när du vill.",

  "settings.export.dialogTitle":
    "Välj en mapp för exporten",
  "settings.export.go":
    "Exportera som statisk webbplats…",
  "settings.export.exporting": "exporterar…",
  "settings.export.report.note": "anteckning",
  "settings.export.report.notes": "anteckningar",
  "settings.export.report.attachment": "bilaga",
  "settings.export.report.attachments": "bilagor",
  "settings.export.report.skipped":
    "hoppade över {count} krypterade",
  "settings.export.report.summary":
    "Exporterade {notes} {noteWord}{attachBit}{skipBit} → {dest}",
  "settings.export.failed":
    "Exporten misslyckades: {error}",
  "settings.export.attachBit": " + {count} {word}",

  "settings.export.modal.title": "Exportera som statisk webbplats",
  "settings.export.modal.body":
    "Yarrow skriver en publicerbar kopia av detta arbetsområde som statisk HTML — en sida per anteckning, med länkar mellan dem bevarade. Krypterade anteckningar och allt du har hållit privat hoppas över automatiskt.",
  "settings.export.modal.dest.label": "Målmapp",
  "settings.export.modal.dest.choose": "Välj en mapp…",
  "settings.export.modal.dest.change": "Byt mapp",
  "settings.export.modal.cancel": "Avbryt",
  "settings.export.modal.close": "Stäng",
  "settings.export.modal.confirm": "Exportera",
  "settings.export.modal.again": "Exportera igen",

  "settings.trim.olderBtn":
    "Glöm gamla kontrollpunkter…",
  "settings.trim.emptyBtn":
    "Glöm tomma kontrollpunkter",
  "settings.trim.unifiedBtn": "Beskär kontrollpunkter…",
  "settings.trim.unifiedPicker.title": "Beskär kontrollpunkter",
  "settings.trim.unifiedPicker.body":
    "Båda valen släpper sparade ögonblicksbilder — dina nuvarande anteckningar förblir exakt som de är. Välj vilken sort som ska glömmas, så visar vi vad som är på väg att försvinna.",
  "settings.trim.unifiedPicker.modeAge.label": "Äldre än…",
  "settings.trim.unifiedPicker.modeAge.hint":
    "Släpper ögonblicksbilder bortom en gräns. Bra för att beskära en lång historik.",
  "settings.trim.unifiedPicker.modeEmpty.label": "Tomma kontrollpunkter",
  "settings.trim.unifiedPicker.modeEmpty.hint":
    'Släpper "ny anteckning"-ögonblicksbilder innan något innehåll landat. De flesta hittar inget värdefullt här.',
  "settings.trim.unifiedPicker.cutoffLabel": "Hur långt tillbaka behåller vi?",
  "settings.trim.nothing":
    "Inget att trimma — inga kontrollpunkter {label}.",
  "settings.trim.label.older":
    "äldre än {days} dagar",
  "settings.trim.label.empty": "utan innehåll",
  "settings.trim.removed.singular":
    "Glömde {count} kontrollpunkt {label}. {kept} behållna.",
  "settings.trim.removed.plural":
    "Glömde {count} kontrollpunkter {label}. {kept} behållna.",
  "settings.trim.failed":
    "Kunde inte trimma: {error}",
  "settings.trim.picker.title":
    "Glöm kontrollpunkter äldre än…",
  "settings.trim.picker.body":
    "Välj hur långt tillbaka du vill behålla din historik. Allt äldre släpps på varje scenario — nuvarande anteckningar ligger kvar exakt som de är.",
  "settings.trim.picker.daysFmt": "{days} dagar",
  "settings.trim.picker.keep180":
    "behåll ~ett halvår",
  "settings.trim.picker.keep90":
    "behåll ~ett kvartal",
  "settings.trim.picker.keep60":
    "behåll ~två månader",
  "settings.trim.picker.keep30":
    "behåll ~en månad",
  "settings.trim.picker.cancel": "avbryt",
  "settings.trim.picker.continue": "fortsätt",
  "settings.trim.confirmAge.title":
    "Glömma kontrollpunkter äldre än {days} dagar?",
  "settings.trim.confirmAge.body":
    "Varje sparad ögonblicksbild äldre än {days} dagar släpps på varje scenario. Dina nuvarande anteckningar ligger kvar exakt som de är — bara de gamla raderna i historik-skjutreglaget försvinner.",
  "settings.trim.confirm.warnTitle":
    "Det här går inte att ångra:",
  "settings.trim.confirmAge.warn.thinking":
    'Gamla "vad tänkte du?"-anteckningar suddas ut.',
  "settings.trim.confirmAge.warn.blame":
    "Blame-hover-historiken före brytpunkten går förlorad.",
  "settings.trim.confirm.warn.forcePush":
    "Om du synkar mot en fjärr behöver din nästa synk en force-push.",
  "settings.trim.keep": "behåll allt",
  "settings.trim.trimming": "trimmar…",
  "settings.trim.confirmDoit": "ja, glöm dem",
  "settings.trim.confirmEmpty.title":
    "Glömma tomma kontrollpunkter?",
  "settings.trim.confirmEmpty.body":
    'Släpper varje sparad ögonblicksbild där alla dina anteckningar fortfarande var tomma — mest "ny anteckning"-stunder innan du började skriva. Ögonblicksbilder med riktigt innehåll behålls.',
  "settings.trim.confirmEmpty.warn.scrub":
    "Du kan inte längre rulla tillbaka till en anteckning i sitt tomma stom-läge.",

  "settings.clearCache.button": "Töm all cache",
  "settings.clearCache.done":
    "Alla härledda cacher tömda. Båda byggs om vid behov.",
  "settings.clearCache.failed":
    "Kunde inte tömma cacherna: {error}",
  "settings.clearCache.modal.title":
    "Tömma alla härledda cacher?",
  "settings.clearCache.modal.body":
    "Tar bort grafindexet och sökdatabasen. Dina anteckningar och git-historiken är orörda. Båda cacherna byggs om automatiskt — men nästa sökning på ett stort valv kan pausa kort medan FTS5 indexerar om varje anteckning.",
  "settings.clearCache.modal.does": "Tömmer:",
  "settings.clearCache.modal.does.json": "— länkgraf",
  "settings.clearCache.modal.does.db":
    "+ WAL — sökcache",
  "settings.clearCache.modal.doesnt": "Berör inte:",
  "settings.clearCache.modal.doesnt.md.before":
    "Dina ",
  "settings.clearCache.modal.doesnt.md.after":
    "-anteckningsfiler.",
  "settings.clearCache.modal.doesnt.git":
    "Git-kontrollpunktshistorik.",
  "settings.clearCache.modal.doesnt.workspace":
    "Arbetsyteinställningar, mallar eller bilagor.",
  "settings.clearCache.modal.cancel": "avbryt",
  "settings.clearCache.modal.clearing": "tömmer…",
  "settings.clearCache.modal.confirm":
    "ja, töm allt",

  // ── storage ──
  "settings.storage.title":
    "Hantera serverlagring",
  "settings.storage.intro.bold":
    "Den här sidan tar bort filer från servern",
  "settings.storage.intro.body":
    ", inte från din enhet. Använd den när du behöver frigöra utrymme på servern eftersom en stor fil äter din kvot.",
  "settings.storage.body":
    "Nedan visas varje anteckning som fortfarande finns på servern, rangordnad efter hur mycket plats den tar i arbetsytans hela historik (inklusive tidigare versioner av anteckningar du redigerat och anteckningar du tagit bort lokalt men som fortfarande finns kvar i historiken). Att markera en fil och bekräfta tar bort den från servern för alltid och tvingar varje annan enhet att släppa sin kopia vid nästa synk. Lokala kopior på den här enheten skrivs om för att stämma.",
  "settings.storage.loadFailed":
    "Kunde inte ladda stora filer: {error}",
  "settings.storage.loading": "Laddar…",
  "settings.storage.empty":
    "Inget sticker ut. Servern är nöjd med den här arbetsytan.",
  "settings.storage.col.file": "Fil",
  "settings.storage.col.size": "Storlek",
  "settings.storage.dangling.path":
    "(hängande blob — ingen sökväg)",
  "settings.storage.collapseAria": "Fäll ihop historik",
  "settings.storage.expandAria": "Fäll ut historik",
  "settings.storage.collapseTitle":
    "Dölj tidigare versioner",
  "settings.storage.expandTitle":
    "Visa tidigare versioner",
  "settings.storage.versionsCount":
    "{count} versioner i historiken",
  "settings.storage.version.col":
    "Version (objekt-id · äldsta först)",
  "settings.storage.version.note":
    "Markering tar bort varje version ovanför — en envägs-omskrivning av historiken.",
  "settings.storage.selected.singular":
    "{count} markerad · {bytes} att frigöra",
  "settings.storage.selected.plural":
    "{count} markerade · {bytes} att frigöra",
  "settings.storage.selected.empty":
    "Markera filer som ska tas bort permanent.",
  "settings.storage.deleteSelected":
    "Ta bort markerade från servern…",

  "settings.storage.confirm.title":
    "Ta bort permanent från servern?",
  "settings.storage.confirm.body.before":
    "Du är på väg att ta bort ",
  "settings.storage.confirm.body.fileSingular": "fil",
  "settings.storage.confirm.body.filePlural": "filer",
  "settings.storage.confirm.body.middle":
    " från servern",
  "settings.storage.confirm.body.after":
    " och från varje tidigare version av arbetsytan. Filerna försvinner också från den här enheten och varje annan enhet som synkar — överallt, för alltid.",
  "settings.storage.confirm.cantUndo":
    "Det här går inte att ångra.",
  "settings.storage.confirm.done":
    "Klart. Frigjorde {bytes}. Andra enheter laddar ner en ren kopia vid sin nästa synk.",
  "settings.storage.confirm.typeToConfirm.before":
    "Skriv ",
  "settings.storage.confirm.typeToConfirm.after":
    " för att bekräfta",
  "settings.storage.confirm.placeholder": "DELETE",
  "settings.storage.confirm.cancel": "Avbryt",
  "settings.storage.confirm.deleting":
    "Tar bort från servern…",
  "settings.storage.confirm.confirmButton":
    "Ja, ta bort permanent från servern",
  "settings.storage.confirm.doneButton": "Klart",

  "settings.align.title":
    "Fast efter att ha frigjort utrymme?",
  "settings.align.body":
    "Om du (eller en annan enhet) just tagit bort filer från servern men den här enheten fortfarande tror att den ligger över kvoten hämtar den här knappen serverns nya tillstånd och släpper alla lokala osynkade ändringar som hänvisar till de borttagna filerna. Använd det om synken inte återhämtar sig av sig själv.",
  "settings.align.button":
    "Synkronisera servertillstånd nu",
  "settings.align.syncing": "Synkroniserar…",
  "settings.align.alreadyInSync":
    "Redan i synk med servern.",
  "settings.align.dropped.singular":
    "Släppte {count} lokal ändring och rättade in mot servern.",
  "settings.align.dropped.plural":
    "Släppte {count} lokala ändringar och rättade in mot servern.",

  // ── shortcuts ──
  "settings.shortcuts.title": "Kortkommandon",
  "settings.shortcuts.hint":
    "Visas i {platform}-stil. De är inte konfigurerbara än.",
  "settings.shortcuts.platform.mac": "macOS",
  "settings.shortcuts.platform.other": "Windows / Linux",
  "settings.shortcuts.group.gettingAround":
    "Att hitta runt",
  "settings.shortcuts.group.writing": "Skrivande",
  "settings.shortcuts.palette":
    "Kommandopalett — sök, hoppa, kör",
  "settings.shortcuts.quickSwitch":
    "Snabb anteckningsväxlare (luddig titel)",
  "settings.shortcuts.switchWorkspace": "Byt arbetsyta",
  "settings.shortcuts.jumpToday":
    "Hoppa till dagens journal",
  "settings.shortcuts.openSettings":
    "Öppna inställningar",
  "settings.shortcuts.newNote": "Ny anteckning",
  "settings.shortcuts.newDirection":
    "Utforska en ny riktning (nytt scenario)",
  "settings.shortcuts.branchFromHere":
    "Förgrena från nuvarande anteckning",
  "settings.shortcuts.focusToggle":
    "Växla fokusläge (dölj sidofält)",
  "settings.shortcuts.scratchpad":
    "Växla skissblock",
  "settings.shortcuts.editorHint.before":
    "Högerklicka i editorn för att infoga en ",
  "settings.shortcuts.editorHint.or": " eller ",
  "settings.shortcuts.editorHint.middle":
    " — välj en anteckning från listan, växla inline om du vill transkludera den. Skriv ",
  "settings.shortcuts.editorHint.after":
    " i början av en rad för att markera en öppen fråga.",

  // ── help (3.1) ──
  "settings.help.title": "Hjälp och feedback",
  "settings.help.hint":
    "Läs dokumentationen, se vad som ändrats i den här versionen och nå dem som gör Yarrow. Inget här ringer hem förrän du klickar.",
  "settings.help.docs.title": "Dokumentation",
  "settings.help.docs.body":
    "Hela dokumentationen finns online men följer också med appen för offline-läsning.",
  "settings.help.docs.openOnline": "Öppna dokumentationen (online)",
  "settings.help.docs.shortcutsCheatsheet": "Snabbkortsguide",
  "settings.help.whatsNew.title": "Nyheter",
  "settings.help.whatsNew.body":
    "Du kör version {version}. Läs versionsanteckningarna för allt som ändrats sedan din senaste uppgradering.",
  "settings.help.whatsNew.viewChangelog": "Visa changelog",
  "settings.help.support.title": "Skicka feedback eller rapportera en bugg",
  "settings.help.support.body":
    "Mejl funkar för en snabb tanke; GitHub-issues är bäst för buggar du vill spåra. Vi samlar aldrig in något som du inte själv väljer att dela.",
  "settings.help.support.sendFeedback": "Skicka feedback…",
  "settings.help.support.openIssue": "Öppna en GitHub-issue…",
  "settings.help.support.copyDiagnostics": "Kopiera diagnostik",
  "settings.help.feedback.subject": "Feedback om Yarrow",
  "settings.help.feedback.bodyTemplate":
    "(Skriv dina tankar här. Raden nedan är valfri — Yarrow delar inget om du inte själv lämnar den i meddelandet.)\n\n— {diagnostics}",

  // ── about ──
  "settings.about.title": "Om Yarrow",
  "settings.about.body1":
    "Yarrow är ett anteckningsverktyg för icke-linjärt tänkande. Dina anteckningar är vanliga markdown-filer i en mapp — öppna dem i valfri editor, säkerhetskopiera dem var som helst. Yarrow håller bara reda på kopplingar och versioner åt dig.",
  "settings.about.body2":
    'Varje sparande är en kontrollpunkt. Varje "ny riktning" är ett scenario du kan byta tillbaka till. Inget du skriver går förlorat.',
  "settings.about.versionLine":
    "version {version} · lokalt först · vanlig markdown",
  "settings.about.links.title": "Länkar",
  "settings.about.links.docs": "Användarhandbok",
  "settings.about.links.changelog": "Ändringslogg",
  "settings.about.links.github": "GitHub",
  "settings.about.links.website": "Webbplats",

  // ── export / import settings (3.1) ──
  "settings.about.exportImport.title": "Exportera och importera inställningar",
  "settings.about.exportImport.body":
    "Spara en JSON-snapshot av varje Yarrow-inställning på den här maskinen, eller återställ en på en annan. Anteckningarna själva exporteras inte — bara kontrollerna i den här panelen. Användbart när du ställer in en andra maskin och vill att den ska kännas likadan.",
  "settings.about.exportImport.exportBtn": "Exportera inställningar…",
  "settings.about.exportImport.importBtn": "Importera inställningar…",
  "settings.about.exportImport.savePromptTitle":
    "Spara dina Yarrow-inställningar",
  "settings.about.exportImport.exporting": "Exporterar…",
  "settings.about.exportImport.importing": "Importerar…",
  "settings.about.exportImport.exportDone":
    "Exporterade {count} inställningar.",
  "settings.about.exportImport.exportFailed":
    "Kunde inte exportera: {error}",
  "settings.about.exportImport.importDone":
    "Importerade {count} inställningar. Laddar om…",
  "settings.about.exportImport.importFailed":
    "Kunde inte importera: {error}",
  "settings.about.exportImport.notASnapshot":
    "Den filen är inte en snapshot av Yarrow-inställningar.",

  // ── reset to defaults (3.1) ──
  "settings.about.reset.title": "Återställ alla inställningar",
  "settings.about.reset.body":
    "Glöm alla inställningar och börja om med de levererade standardvärdena. Dina anteckningar, scenarier och historik berörs inte — bara kontrollerna i den här panelen. Detta är kärnvapenalternativet.",
  "settings.about.reset.button": "Återställ alla inställningar…",
  "settings.about.reset.confirmTitle": "Återställa alla Yarrow-inställningar?",
  "settings.about.reset.confirmBody":
    "Teman, typsnitt, gestbindningar, lägesval, hjälp- och guidningstillstånd, tillgänglighet — allt återgår till fabriksinställningar. Dina anteckningar förblir precis som de är.",
  "settings.about.reset.cancel": "Avbryt",
  "settings.about.reset.confirmBtn": "Återställ allt",
  "settings.about.resetA11y.title": "Återställ tillgänglighet",
  "settings.about.resetA11y.body":
    "Glöm bara tillgänglighetsinställningarna (syn, rörelse, motorik, kognitivt, läsare, färg). Övrigt — teman, typsnitt, gester, lägen — förblir oförändrat.",
  "settings.about.resetA11y.button": "Återställ tillgänglighet…",
  "settings.about.resetA11y.confirmTitle":
    "Återställa tillgänglighetsinställningarna?",
  "settings.about.resetA11y.confirmBody":
    "Textstorlek, kontrast, rörelse, träffytestorlek, dyslexityp, läsguide, palett för färgblindhet, fokusring — allt återgår till standard. Inget annat ändras.",
  "settings.about.resetA11y.confirmBtn": "Återställ tillgänglighet",
  "settings.about.resetA11y.done": "Klart — alla standardvärden återställda.",
  "settings.about.resetWorkspace.title": "Återställ arbetsytans inställningar",
  "settings.about.resetWorkspace.body":
    "Glöm de inställningar som ligger i arbetsytans config.toml — autocheckpoint-debounce, decay-dagar, redigerarens teckenstorlek, idle-lås, synktakt, papperskorgens retention. Synk-URL och serveranslutning lämnas orörda. Dina anteckningar berörs inte.",
  "settings.about.resetWorkspace.button": "Återställ arbetsytans inställningar…",
  "settings.about.resetWorkspace.confirmTitle":
    "Återställa arbetsytans inställningar till standard?",
  "settings.about.resetWorkspace.confirmBody":
    "Autocheckpoint-debounce till 8 s, decay till 60 dagar, teckenstorlek till 16, idle-lås till 15 min, synk till 5 min, papperskorgsretention till 30 dagar. Synk-fjärr och servertoken förblir intakta. Anteckningarna berörs inte.",
  "settings.about.resetWorkspace.confirmBtn": "Återställ arbetsytan",

  // ── gestures (2.2.0) ──
  "settings.gestures.title": "Den Stilla Punkten",
  "settings.gestures.hint":
    "Centrumpricken i radialmenyn lyssnar på tre konfigurerbara gester. Var och en utlöser en namngiven åtgärd — välj dina nedan. Drag-ut och scrollhjul är strukturella och går inte att binda.",
  "settings.gestures.slot.tap.label": "Enkeltryck",
  "settings.gestures.slot.tap.meta": "tryck",
  "settings.gestures.slot.longPress.label": "Tryck & håll",
  "settings.gestures.slot.longPress.meta": "långt tryck · 380 ms",
  "settings.gestures.slot.doubleTap.label": "Dubbeltryck",
  "settings.gestures.slot.doubleTap.meta": "dubbeltryck · 280 ms",
  "settings.gestures.group.core": "Kärna",
  "settings.gestures.group.navigation": "Navigation",
  "settings.gestures.group.writing": "Skrivande",
  "settings.gestures.group.system": "System",

  "settings.gestures.action.palette.label": "Öppna kommandopaletten",
  "settings.gestures.action.palette.blurb": "sök anteckningar, kör kommandon, hoppa var som helst — samma som ⌘K.",
  "settings.gestures.action.quickHand.label": "Öppna Snabbhanden",
  "settings.gestures.action.quickHand.blurb": "en liten modal med nio knappar för det du oftast sträcker dig efter.",
  "settings.gestures.action.constellationModal.label": "Öppna Konstellationen",
  "settings.gestures.action.constellationModal.blurb": "åtta knappar kretsar runt klickpunkten i en liten paj av åtgärder.",
  "settings.gestures.action.constellation.label": "Öppna kopplingsgrafen",
  "settings.gestures.action.constellation.blurb": "kart-vyn i höger sidopanel — länkar mellan denna anteckning och dess grannar.",
  "settings.gestures.action.outline.label": "Visa översikt",
  "settings.gestures.action.outline.blurb": "rubriker och toppnivåpunkter som ett klickbart träd.",
  "settings.gestures.action.todayJournal.label": "Öppna dagens journal",
  "settings.gestures.action.todayJournal.blurb": "skapar dagsanteckningen från din mall om den inte finns — samma som ⌘T.",
  "settings.gestures.action.newNote.label": "Skapa ny anteckning",
  "settings.gestures.action.newNote.blurb": "öppnar dialogen för ny anteckning — samma som ⌘N.",
  "settings.gestures.action.newPath.label": "Utforska en ny riktning",
  "settings.gestures.action.newPath.blurb": "förgrena ett scenario från där du är — samma som ⌘⇧N.",
  "settings.gestures.action.livePreview.label": "Växla direktförhandsvisning",
  "settings.gestures.action.livePreview.blurb": "delar skrivpanelen och renderar höger sida medan du skriver.",
  "settings.gestures.action.cookMode.label": "Växla matlagningsläge",
  "settings.gestures.action.cookMode.blurb": "läsvy med stor text och vaken skärm — för recept med fulla händer.",
  "settings.gestures.action.focus.label": "Växla fokusläge",
  "settings.gestures.action.focus.blurb": "döljer ramen — bara anteckningen kvarstår. Samma som ⌘\\.",
  "settings.gestures.action.scratchpad.label": "Växla skissblock",
  "settings.gestures.action.scratchpad.blurb": "ett dockat block som sparar allt men aldrig commitar till git.",
  "settings.gestures.action.settings.label": "Öppna inställningar",
  "settings.gestures.action.settings.blurb": "landar i denna panel — användbar som paranoid genväg medan du finjusterar.",

  "settings.gestures.structural.title": "Strukturella gester",
  "settings.gestures.structural.hint":
    "Två gester till bor på centrumdisken men är inte bindbara — de är hur radialen fungerar som radial.",
  "settings.gestures.structural.dragOut.tag": "drag-ut",
  "settings.gestures.structural.dragOut.desc":
    "Tryck i mitten och dra pekaren mot valfri kil — kilen utlöses utan separat klick.",
  "settings.gestures.structural.scroll.tag": "scrollhjul",
  "settings.gestures.structural.scroll.desc":
    "Snurra hjulet med menyn öppen för att stega markeringen utan att flytta pekaren.",

  "settings.gestures.reset.atDefaults": "Bindningarna är på de rekommenderade standardvärdena.",
  "settings.gestures.reset.modified": "Bindningarna har ändrats från standard.",
  "settings.gestures.reset.btn": "Återställ till standard",
  "settings.gestures.reset.confirmTitle": "Återställ rekommenderade gester?",
  "settings.gestures.reset.confirmBody":
    "Alla tre bindningarna återställs till det Yarrow levereras med. Det här påverkar bara centrumpricken — inga andra inställningar berörs.",
  "settings.gestures.reset.cancel": "Avbryt",
  "settings.gestures.reset.confirm": "Återställ",
};
