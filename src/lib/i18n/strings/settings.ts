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
  "settings.tabs.appearance": "Appearance",
  "settings.tabs.writing": "Writing",
  "settings.tabs.gestures": "Gestures",
  "settings.tabs.guidance": "Guidance",
  "settings.tabs.templates": "Templates",
  "settings.tabs.sync": "Sync",
  "settings.tabs.storage": "Storage",
  "settings.tabs.security": "Security",
  "settings.tabs.workspace": "Workspace",
  "settings.tabs.shortcuts": "Shortcuts",
  "settings.tabs.about": "About",

  // ── search ──
  "settings.search.empty":
    'Nothing matches "{query}". Try a word like "font", "sync", or "password".',
  "settings.search.resultsCount": "{count} result for \"{query}\"",
  "settings.search.resultsCountPlural": "{count} results for \"{query}\"",

  // search index entries (label / sublabel)
  "settings.search.appearance.theme.label": "Theme",
  "settings.search.appearance.theme.sublabel":
    "light · dark · auto · ashrose",
  "settings.search.appearance.size.label": "Interface size",
  "settings.search.appearance.size.sublabel": "compact · cozy · roomy",
  "settings.search.appearance.font.label": "Interface font",
  "settings.search.appearance.font.sublabel": "Inter · serif options",

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

  "settings.search.sync.repo.label": "Repository URL",
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

  // ── writing pane ──
  "settings.writing.title": "Writing",
  "settings.writing.hint": "How Yarrow behaves while you're writing notes.",
  "settings.writing.autosave.label": "Save every change after",
  "settings.writing.autosave.hint":
    "How long Yarrow waits after you stop typing before saving silently.",
  "settings.writing.autosave.seconds": "{value}s",
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
  "settings.writing.pathCaret.label": "Path-tinted caret",
  "settings.writing.pathCaret.hint":
    "The caret takes the colour of the path you're writing on, so you always know which draft you're editing. Turn off for high-contrast defaults.",
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
  "settings.writing.savingNow": "saving…",
  "settings.writing.autosaveNote": "changes save automatically",

  // ── extras section ──
  "settings.extras.title": "Writing extras",
  "settings.extras.hint":
    "Opt-in features that lazy-load their code only when enabled — the editor stays lean by default and picks these up the moment you flip them on.",

  // ── guidance ──
  "settings.guidance.title": "Guided mode",
  "settings.guidance.hint":
    "Yarrow has a handful of concepts that aren't obvious from looking at them — paths, checkpoints, wikilinks, comparison, syncs. Guided mode walks you through each one every time you use it, and keeps a quiet reminder visible when you're on a try path.",
  "settings.guidance.on": "Guided mode is on",
  "settings.guidance.off": "Guided mode is off",
  "settings.guidance.onHint":
    "Teaching modals fire every time you do a non-obvious thing — creating a path, inserting a wikilink, returning to main, and so on. The ribbon above the editor is always visible when you're on a non-main path. If one specific modal starts to annoy you, each one has its own 'Stop showing this one' opt-out.",
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
  "settings.sync.repoUrl": "Repository URL",
  "settings.sync.repoUrlPlaceholder":
    "https://github.com/you/your-notes.git",
  "settings.sync.token.label": "Access token",
  "settings.sync.token.optional":
    "(optional — HTTPS private repos)",
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
    "The server version won at each path. Your local edits are saved as sibling files — open both and merge by hand, then delete the conflict copy.",
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
  "settings.workspace.mode.label": "Mode",
  "settings.workspace.mode.hint":
    "Branch path mapping turns this workspace into a connected map. Basic notes is just plain note-taking.",
  "settings.workspace.mode.mapped": "Branch path mapping",
  "settings.workspace.mode.basic": "Basic notes",
  "settings.workspace.startingNote.label": "Starting note",
  "settings.workspace.startingNote.hint":
    "The anchor for decisions going forward — where your map begins.",
  "settings.workspace.startingNote.notSet": "Not set",
  "settings.workspace.startingNote.change": "Change…",
  "settings.workspace.folder.label": "Folder",
  "settings.workspace.folder.hint":
    "Where your notes are saved as .md files.",
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
    "Pick how far back to keep your history. Anything older will be dropped on every path — current notes stay exactly as they are.",
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
    "Every saved snapshot older than {days} days will be dropped on every path. Your current notes stay exactly as they are — only the old history slider entries disappear.",
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
    "(dangling blob — no path)",
  "settings.storage.collapseAria": "Collapse history",
  "settings.storage.expandAria": "Expand history",
  "settings.storage.collapseTitle": "Hide past versions",
  "settings.storage.expandTitle": "Show past versions",
  "settings.storage.versionsCount": "{count} versions in history",
  "settings.storage.version.col": "Version (object id · oldest first)",
  "settings.storage.version.note":
    "Selecting removes every version above — that's how filter-repo works.",
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
    "Explore a new direction (new path)",
  "settings.shortcuts.branchFromHere":
    "Branch from the current note",
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

  // ── about ──
  "settings.about.title": "About Yarrow",
  "settings.about.body1":
    "Yarrow is a note-taking tool for non-linear thinking. Your notes are plain markdown files in a folder — open them in any editor, back them up anywhere. Yarrow only keeps track of connections and versions for you.",
  "settings.about.body2":
    'Every save is a checkpoint. Every "new direction" is a path you can switch back to. Nothing you write is ever lost.',
  "settings.about.versionLine":
    "version {version} · local-first · plain markdown",

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
  "settings.gestures.action.outline.label": "Show this note's outline",
  "settings.gestures.action.outline.blurb": "headings and top-level bullets as a click-to-jump tree.",
  "settings.gestures.action.todayJournal.label": "Open today's journal",
  "settings.gestures.action.todayJournal.blurb": "creates the daily note from your template if it doesn't exist yet — same as ⌘T.",
  "settings.gestures.action.newNote.label": "Create a new note",
  "settings.gestures.action.newNote.blurb": "drop into the new-note dialog — same as ⌘N.",
  "settings.gestures.action.newPath.label": "Explore a new direction",
  "settings.gestures.action.newPath.blurb": "fork a path from where you are — same as ⌘⇧N.",
  "settings.gestures.action.livePreview.label": "Toggle live preview",
  "settings.gestures.action.livePreview.blurb": "split the writing pane and render the right side live as you type.",
  "settings.gestures.action.cookMode.label": "Toggle cook mode",
  "settings.gestures.action.cookMode.blurb": "big-text reading view with screen wake-lock — for hands-free recipes.",
  "settings.gestures.action.focus.label": "Toggle focus mode",
  "settings.gestures.action.focus.blurb": "hide the chrome — only the note remains. Same as ⌘\\.",
  "settings.gestures.action.scratchpad.label": "Toggle the scratchpad",
  "settings.gestures.action.scratchpad.blurb": "a docked notepad that saves everything but never commits to git.",
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
  "settings.tabs.appearance": "Apariencia",
  "settings.tabs.writing": "Escritura",
  "settings.tabs.gestures": "Gestos",
  "settings.tabs.guidance": "Guía",
  "settings.tabs.templates": "Plantillas",
  "settings.tabs.sync": "Sincronización",
  "settings.tabs.storage": "Almacenamiento",
  "settings.tabs.security": "Seguridad",
  "settings.tabs.workspace": "Espacio de trabajo",
  "settings.tabs.shortcuts": "Atajos",
  "settings.tabs.about": "Acerca de",

  // ── search ──
  "settings.search.empty":
    'Nada coincide con "{query}". Prueba una palabra como "fuente", "sincronización" o "contraseña".',
  "settings.search.resultsCount": "{count} resultado para \"{query}\"",
  "settings.search.resultsCountPlural":
    "{count} resultados para \"{query}\"",

  "settings.search.appearance.theme.label": "Tema",
  "settings.search.appearance.theme.sublabel":
    "claro · oscuro · auto · ashrose",
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

  // ── writing pane ──
  "settings.writing.title": "Escritura",
  "settings.writing.hint":
    "Cómo se comporta Yarrow mientras escribes notas.",
  "settings.writing.autosave.label":
    "Guardar cada cambio después de",
  "settings.writing.autosave.hint":
    "Cuánto espera Yarrow después de que dejas de escribir antes de guardar en silencio.",
  "settings.writing.autosave.seconds": "{value}s",
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
  "settings.writing.pathCaret.label": "Cursor con tinte de la ruta",
  "settings.writing.pathCaret.hint":
    "El cursor toma el color de la ruta en la que escribes, así siempre sabes qué borrador estás editando. Desactívalo para un contraste alto por defecto.",
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
    "Yarrow tiene varias ideas que no se ven a simple vista: rutas, puntos de control, wikienlaces, comparación, sincronizaciones. El modo guiado te acompaña en cada una cada vez que la usas y deja un recordatorio discreto cuando estás en una ruta de prueba.",
  "settings.guidance.on": "El modo guiado está activado",
  "settings.guidance.off": "El modo guiado está desactivado",
  "settings.guidance.onHint":
    "Los modales de enseñanza aparecen cada vez que haces algo poco evidente: crear una ruta, insertar un wikienlace, regresar a la principal, etcétera. La cinta sobre el editor siempre se ve cuando estás en una ruta que no es la principal. Si un modal específico te molesta, cada uno tiene su propia opción «Dejar de mostrar este».",
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
    "(opcional — repos privados HTTPS)",
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
    "La versión del servidor ganó en cada ruta. Tus ediciones locales se guardaron como archivos hermanos: ábrelos y combínalos a mano, luego elimina la copia del conflicto.",
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
  "settings.workspace.mode.label": "Modo",
  "settings.workspace.mode.hint":
    "El mapeo de rutas convierte este espacio de trabajo en un mapa conectado. «Notas básicas» es solo escritura simple.",
  "settings.workspace.mode.mapped":
    "Mapeo de rutas",
  "settings.workspace.mode.basic": "Notas básicas",
  "settings.workspace.startingNote.label": "Nota inicial",
  "settings.workspace.startingNote.hint":
    "El ancla para las decisiones que vienen: donde empieza tu mapa.",
  "settings.workspace.startingNote.notSet": "Sin definir",
  "settings.workspace.startingNote.change": "Cambiar…",
  "settings.workspace.folder.label": "Carpeta",
  "settings.workspace.folder.hint":
    "Donde se guardan tus notas como archivos .md.",
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
    "Elige cuánto historial conservar. Cualquier cosa más antigua se descarta en cada ruta: las notas actuales quedan exactamente igual.",
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
    "Cada instantánea guardada con más de {days} días de antigüedad se descartará en cada ruta. Tus notas actuales quedan exactamente igual: solo desaparecen las entradas antiguas del deslizador del historial.",
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
    "(blob colgante: sin ruta)",
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
    "Seleccionar elimina cada versión de arriba: así funciona filter-repo.",
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
    "Explorar una nueva dirección (nueva ruta)",
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

  // ── about ──
  "settings.about.title": "Acerca de Yarrow",
  "settings.about.body1":
    "Yarrow es una herramienta de notas para el pensamiento no lineal. Tus notas son archivos markdown planos en una carpeta: ábrelos en cualquier editor, respáldalos donde quieras. Yarrow solo lleva el seguimiento de las conexiones y las versiones por ti.",
  "settings.about.body2":
    'Cada guardado es un punto de control. Cada «nueva dirección» es una ruta a la que puedes volver. Nada de lo que escribas se pierde.',
  "settings.about.versionLine":
    "versión {version} · primero local · markdown plano",

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
  "settings.gestures.action.newPath.blurb": "bifurca una ruta desde donde estás — igual que ⌘⇧N.",
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
  "settings.tabs.appearance": "Utseende",
  "settings.tabs.writing": "Skrivande",
  "settings.tabs.gestures": "Gester",
  "settings.tabs.guidance": "Vägledning",
  "settings.tabs.templates": "Mallar",
  "settings.tabs.sync": "Synkronisering",
  "settings.tabs.storage": "Lagring",
  "settings.tabs.security": "Säkerhet",
  "settings.tabs.workspace": "Arbetsyta",
  "settings.tabs.shortcuts": "Kortkommandon",
  "settings.tabs.about": "Om",

  // ── search ──
  "settings.search.empty":
    'Inget matchar "{query}". Prova ett ord som "typsnitt", "synk" eller "lösenord".',
  "settings.search.resultsCount":
    "{count} träff för \"{query}\"",
  "settings.search.resultsCountPlural":
    "{count} träffar för \"{query}\"",

  "settings.search.appearance.theme.label": "Tema",
  "settings.search.appearance.theme.sublabel":
    "ljus · mörk · auto · ashrose",
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

  "settings.search.sync.repo.label": "Repo-URL",
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

  // ── writing pane ──
  "settings.writing.title": "Skrivande",
  "settings.writing.hint":
    "Hur Yarrow uppför sig medan du skriver anteckningar.",
  "settings.writing.autosave.label":
    "Spara varje ändring efter",
  "settings.writing.autosave.hint":
    "Hur länge Yarrow väntar efter att du slutat skriva innan tyst sparande.",
  "settings.writing.autosave.seconds": "{value} s",
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
    "Markören får färgen av den stig du skriver på, så du alltid vet vilket utkast du redigerar. Stäng av för standardkontrast.",
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
    "Yarrow har en handfull begrepp som inte är självklara — stigar, kontrollpunkter, wikilänkar, jämförelse, synkar. Guidat läge går igenom var och en varje gång du använder det och lämnar en stillsam påminnelse synlig när du befinner dig på en provstig.",
  "settings.guidance.on": "Guidat läge är på",
  "settings.guidance.off": "Guidat läge är av",
  "settings.guidance.onHint":
    "Undervisningsdialoger visas varje gång du gör något icke uppenbart — skapa en stig, infoga en wikilänk, återvända till huvudet och så vidare. Bandet ovanför editorn syns alltid när du är på en stig som inte är main. Om en specifik dialog börjar irritera har var och en sin egen 'Sluta visa den här'.",
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
  "settings.sync.repoUrl": "Repo-URL",
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
  "settings.workspace.mode.label": "Läge",
  "settings.workspace.mode.hint":
    "Stigkartläggning gör arbetsytan till en sammankopplad karta. Grundanteckningar är bara vanligt anteckningsskrivande.",
  "settings.workspace.mode.mapped": "Stigkartläggning",
  "settings.workspace.mode.basic": "Grundanteckningar",
  "settings.workspace.startingNote.label":
    "Startanteckning",
  "settings.workspace.startingNote.hint":
    "Ankaret för beslut framåt — där din karta börjar.",
  "settings.workspace.startingNote.notSet": "Inte satt",
  "settings.workspace.startingNote.change": "Ändra…",
  "settings.workspace.folder.label": "Mapp",
  "settings.workspace.folder.hint":
    "Där dina anteckningar sparas som .md-filer.",
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
    "Välj hur långt tillbaka du vill behålla din historik. Allt äldre släpps på varje stig — nuvarande anteckningar ligger kvar exakt som de är.",
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
    "Varje sparad ögonblicksbild äldre än {days} dagar släpps på varje stig. Dina nuvarande anteckningar ligger kvar exakt som de är — bara de gamla raderna i historik-skjutreglaget försvinner.",
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
    "Markering tar bort varje version ovanför — så fungerar filter-repo.",
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
    "Utforska en ny riktning (ny stig)",
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

  // ── about ──
  "settings.about.title": "Om Yarrow",
  "settings.about.body1":
    "Yarrow är ett anteckningsverktyg för icke-linjärt tänkande. Dina anteckningar är vanliga markdown-filer i en mapp — öppna dem i valfri editor, säkerhetskopiera dem var som helst. Yarrow håller bara reda på kopplingar och versioner åt dig.",
  "settings.about.body2":
    'Varje sparande är en kontrollpunkt. Varje "ny riktning" är en stig du kan byta tillbaka till. Inget du skriver går förlorat.',
  "settings.about.versionLine":
    "version {version} · lokalt först · vanlig markdown",

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
  "settings.gestures.action.newPath.blurb": "förgrena en stig från där du är — samma som ⌘⇧N.",
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
