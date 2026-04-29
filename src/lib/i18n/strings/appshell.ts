// AppShell surface — toolbar, sidebar utility row, status bar, top
// bar, sync pill, locked-note hero, empty-workspace hero, modal copy
// for new-path / new-note / connect / rename / find-replace, and all
// toast and error-message strings rendered from AppShell.tsx.

export const appshellEN = {
  // Sidebar workspace chip
  "appshell.workspace.switchTitle": "Switch workspace · {shortcut}",
  "appshell.workspace.switchAria": "Switch workspace",
  "appshell.workspace.fallbackName": "Workspace",
  "appshell.workspace.notesPathsSingleSingle":
    "{notes} note · {scenarios} scenario",
  "appshell.workspace.notesPathsSinglePlural":
    "{notes} note · {scenarios} scenarios",
  "appshell.workspace.notesPathsPluralSingle":
    "{notes} notes · {scenarios} scenario",
  "appshell.workspace.notesPathsPluralPlural":
    "{notes} notes · {scenarios} scenarios",

  // Sidebar search trigger + utility row
  "appshell.sidebar.findAnything": "Find anything",
  "appshell.sidebar.journalLabel": "Journal",
  "appshell.sidebar.journalTitle": "Today's journal entry",
  "appshell.sidebar.activityLabel": "Activity",
  "appshell.sidebar.activityTitle": "Writing activity heatmap",
  "appshell.sidebar.trashLabel": "Trash",
  "appshell.sidebar.trashTitle": "Restore or permanently remove deleted notes",
  "appshell.sidebar.trashTitleWithCount":
    "{count} note(s) in Trash — open to restore or purge",
  "appshell.sidebar.resizeTitle": "Drag to resize the sidebar",
  "appshell.sidebar.resizeAria": "Resize sidebar",

  // Status bar
  "appshell.status.modePillTitle": "Active mode: {mode} — click to change",
  "appshell.status.notes": "{count} notes",
  "appshell.status.paths": "{count} scenarios",
  "appshell.status.onPath": "on scenario: {path}",
  "appshell.status.onPathNone": "on scenario: —",
  "appshell.status.selected": "{count} selected",
  "appshell.status.selectedTitle": "{count} chars selected",
  "appshell.status.wordCountSingle": "{count} word",
  "appshell.status.wordCountPlural": "{count} words",
  "appshell.status.wordCountTitle": "~{minutes} min read",
  "appshell.status.overStorage": "Over storage",
  "appshell.status.overStorageTitle": "Over storage — click to resolve",
  "appshell.status.offServerCount": "{count} off-server",
  "appshell.status.offServerSingleTitle":
    "{count} note is kept off the server — registered in .git/info/exclude and never sync.",
  "appshell.status.offServerPluralTitle":
    "{count} notes are kept off the server — registered in .git/info/exclude and never sync.",
  "appshell.status.syncedAgo": "synced {time}",
  "appshell.status.syncTimestampTitle": "Last sync: {datetime}",

  // Sync pill labels
  "appshell.sync.synced": "synced",
  "appshell.sync.localChanges": "local changes",
  "appshell.sync.syncing": "syncing…",
  "appshell.sync.failed": "sync failed",
  "appshell.sync.notAnywhere": "not synced anywhere",

  // Skip-to-content + verbose-announcer
  "appshell.skipToContent": "Skip to editor",
  "appshell.announce.syncStarted": "Sync started.",
  "appshell.announce.syncFinished": "Sync finished. Everything's up to date.",
  "appshell.announce.syncFailed": "Sync failed: {message}",
  "appshell.announce.saved": "Note saved.",
  "appshell.announce.checkpointSaved": "Checkpoint saved.",
  "appshell.announce.pathCreated": "New direction created: {name}.",
  "appshell.announce.pathSwitched": "Switched to {name}.",
  "appshell.announce.checkpointPinned": "Checkpoint pinned.",
  "appshell.announce.checkpointUnpinned": "Checkpoint unpinned.",
  "appshell.announce.checkpointRestored": "Restored to checkpoint.",
  "appshell.announce.noteCreated": "Note created: {title}.",
  "appshell.announce.noteDeleted": "Note moved to trash: {title}.",

  // Sync status-bar popover
  "appshell.sync.popover.openAria": "Sync status: {status}. Click for details.",
  "appshell.sync.popover.title": "Sync details",
  "appshell.sync.popover.lastSynced": "Last synced {time}.",
  "appshell.sync.popover.retry": "Retry now",
  "appshell.sync.popover.openSettings": "Sync settings…",
  "appshell.sync.popover.body.synced":
    "Everything's up to date. Auto-sync runs again in the background.",
  "appshell.sync.popover.body.pending":
    "There are local changes that haven't been pushed yet — Yarrow will sync them on the next interval.",
  "appshell.sync.popover.body.syncing":
    "Sync is running now.",
  "appshell.sync.popover.body.error":
    "The last sync didn't complete. Yarrow will keep trying — Retry now to attempt it immediately.",
  "appshell.sync.popover.body.no-remote":
    "This workspace isn't connected anywhere yet. Open Sync settings to add a remote.",

  // Toast / dismiss
  "appshell.toast.dismiss": "Dismiss",

  // Print / locked / clipboard / dictionary toasts and errors
  "appshell.toast.printError": "Couldn't prepare print preview: {error}",
  "appshell.toast.copied": "Copied to clipboard",
  "appshell.toast.shoppingListAdded":
    "Added {added} ingredient(s) from {source} to Shopping List{dupes}",
  "appshell.toast.shoppingListDupes": " · skipped {skipped} duplicate(s)",
  "appshell.toast.shoppingListEmpty":
    "No ingredients found — add a `## Ingredients` section with bullets first.",
  "appshell.toast.encryptedSession":
    "Session locked — encrypted notes need your password.",
  "appshell.toast.lockedAfterIdle": "Locked after idle — unlock to keep going.",
  "appshell.toast.enableEncryptionFirst":
    "Enable encryption first in Settings → Security.",
  "appshell.toast.unlockToEncrypt": "Unlock to encrypt this note.",
  "appshell.toast.unlockToDecrypt": "Unlock to decrypt this note.",
  "appshell.toast.encrypted":
    "Encrypted \"{title}\" — every past version in history was re-sealed with the same key.",
  "appshell.toast.encryptError":
    "Couldn't encrypt — your note is unchanged on disk. {error}",
  "appshell.toast.decrypted": "Decrypted \"{title}\".",
  "appshell.toast.decryptError":
    "Couldn't decrypt — the note stays sealed and intact. {error}",
  "appshell.toast.movedToFolder": "Moved to “{folder}”",
  "appshell.toast.movedOutOfFolder": "Moved out of folder",
  "appshell.toast.moveError":
    "Couldn't move the note — it's still in its original folder. {error}",
  "appshell.toast.deleted": "Deleted \"{title}.\"",
  "appshell.toast.undoLabel": "Undo",
  "appshell.toast.undoError": "Couldn't undo delete: {error}",
  "appshell.toast.revealError": "Couldn't reveal file: {error}",
  "appshell.toast.sentToScratchpad": "Sent {count} words to scratchpad.",
  "appshell.toast.scratchpadError": "Couldn't send to scratchpad: {error}",
  "appshell.toast.unlockToCopy": "Unlock the note first to copy its contents.",
  "appshell.toast.copiedAsMarkdown": "Copied \"{title}\" as markdown.",
  "appshell.toast.copyError": "Couldn't copy: {error}",
  "appshell.toast.renameError":
    "Couldn't rename — the note kept its original title. {error}",
  "appshell.toast.tagsError":
    "Couldn't save tags — the note's current tags are unchanged. {error}",
  "appshell.toast.annotationSaveError": "Couldn't save annotation: {error}",
  "appshell.toast.annotationAddError": "Couldn't add annotation: {error}",
  "appshell.toast.kept": "Kept — \"{label}\" will survive future pruning.",
  "appshell.toast.pinError":
    "Couldn't pin — the note's pin state is unchanged. {error}",
  "appshell.toast.unpinned":
    "Unpinned — this checkpoint is no longer protected from pruning.",
  "appshell.toast.unpinError":
    "Couldn't unpin — the note's pin state is unchanged. {error}",
  "appshell.toast.restored":
    "Restored — the previous version stays safely in history.",
  "appshell.toast.promoteError": "Couldn't promote: {error}",
  "appshell.toast.discardError": "Couldn't discard: {error}",
  "appshell.toast.openWindowError": "Couldn't open window: {error}",
  "appshell.toast.createFromTemplateError":
    "Couldn't create note from template: {error}",
  "appshell.toast.createFromKitError": "Couldn't open the kit: {error}",
  "appshell.toast.createFromTemplateGenericError":
    "Couldn't create note: {error}",
  "appshell.toast.createdTitle": "Created “{title}”",
  "appshell.toast.startedKit": "Started \"{title}\" — your page is waiting.",
  "appshell.toast.keptAsNote": "Kept as a note.",
  "appshell.toast.journalSwitched":
    "Journal lives on main — jumped there from \"{from}\".",
  "appshell.toast.autoSyncConflictsSingle":
    "Auto-sync: {count} conflict — server version kept; your local version saved as a .conflict-*.md sibling.",
  "appshell.toast.autoSyncConflictsPlural":
    "Auto-sync: {count} conflicts — server version kept; your local version saved as a .conflict-*.md sibling.",
  "appshell.toast.syncConflictsSingle":
    "Sync: {count} conflict — server version kept; your local version saved as a .conflict-*.md sibling.",
  "appshell.toast.syncConflictsPlural":
    "Sync: {count} conflicts — server version kept; your local version saved as a .conflict-*.md sibling.",
  "appshell.toast.syncIssue":
    "Sync didn't finish — {message}. Yarrow will retry automatically.",
  "appshell.toast.conflictResolved":
    "Brought together. Both original versions are still in History — scrub back any time to recover what you didn't keep.",
  "appshell.toast.workspacePurged":
    "Another device permanently deleted files from this workspace. Re-aligning…",
  "appshell.toast.workspacePurgedFailed":
    "Couldn't re-align with the server automatically — open Settings → Storage and click 'Sync server state now'.",
  "appshell.toast.discardSyncingSingle": "Undid {count} recent change. Syncing…",
  "appshell.toast.discardSyncingPlural": "Undid {count} recent changes. Syncing…",

  // Map / connections rail
  "appshell.map.title": "Connections",
  "appshell.map.titleFiltered": "Map · {pathName}",
  "appshell.map.notesInPathSingle": "{count} note in this scenario",
  "appshell.map.notesInPathPlural": "{count} notes in this scenario",
  "appshell.map.thisNote": "this note",
  "appshell.map.neighborsSingle": "{count} neighbor",
  "appshell.map.neighborsPlural": "{count} neighbors",

  // Links from this note rail
  "appshell.links.title": "Links from this note",

  // Outline rail (2.2.0)
  "appshell.outline.title": "Outline",

  // Tab bar (3.1.0)
  "appshell.tabs.label": "Open notes",
  "appshell.tabs.close": "Close tab",
  "appshell.tabs.newTab": "New tab",
  "appshell.tabs.untitled": "Untitled",
  "appshell.tabs.openInNewTab": "Open in new tab",

  // Locked note hero
  "appshell.locked.title": "This note is locked",
  "appshell.locked.body":
    "Encrypted locally with ChaCha20-Poly1305.\nEnter your passphrase to read it.",
  "appshell.locked.passphrasePlaceholder": "passphrase",
  "appshell.locked.unlock": "unlock",
  "appshell.locked.unlockBusy": "…",
  "appshell.locked.localLocks": "local locks",
  "appshell.locked.noNetwork": "no network",
  "appshell.locked.noAccounts": "no accounts",
  "appshell.locked.forgotPassphrase": "I forgot my passphrase",

  // Empty workspace hero
  "appshell.empty.title": "A blank page, and everything ahead of it",
  "appshell.empty.body":
    "Yarrow saves every word automatically. Every time you start a new scenario, the original stays safe. Nothing you write here can get lost.",
  "appshell.empty.startFirstNote": "Start your first note",
  "appshell.empty.findNote": "Find a note",

  // Rename modal
  "appshell.rename.title": "Rename note",
  "appshell.rename.refsBodySingle":
    "{count} other note links to this one with a [[wikilink]]. Updating it rewrites its body — recorded as one checkpoint, so it's easy to roll back from History.",
  "appshell.rename.refsBodyPlural":
    "{count} other notes link to this one with a [[wikilink]]. Updating them rewrites their bodies — recorded as one checkpoint, so it's easy to roll back from History.",
  "appshell.rename.confirmQuestion": "Rename to \"{title}\"?",
  "appshell.rename.cancel": "Cancel",
  "appshell.rename.onlyThis": "Rename only this note",
  "appshell.rename.andUpdate": "Rename and update wikilinks",

  // Find/Replace result modal
  "appshell.findReplaceResult.title": "Replacements done",
  "appshell.findReplaceResult.bodySingle":
    "Replaced {total} occurrence across {changed} note.",
  "appshell.findReplaceResult.bodyPlural":
    "Replaced {total} occurrences across {changed} notes.",
  "appshell.findReplaceResult.bodyMixed1":
    "Replaced {total} occurrences across {changed} note.",
  "appshell.findReplaceResult.bodyMixed2":
    "Replaced {total} occurrence across {changed} notes.",
  "appshell.findReplaceResult.checkpointHint":
    "One checkpoint records the whole change — undo via History on any affected note.",
  "appshell.findReplaceResult.done": "Done",

  // Delete-this-note (locked) confirm
  "appshell.deleteLocked.title": "Delete this note?",
  "appshell.deleteLocked.body":
    "Can't show an undo for this note (it's locked). Delete anyway? Past versions remain in history.",

  // Delete many confirm
  "appshell.deleteMany.titleSingle": "Delete {count} note?",
  "appshell.deleteMany.titlePlural": "Delete {count} notes?",
  "appshell.deleteMany.body":
    "They disappear from the list. Past versions on this scenario remain in history.",

  // Promote path confirm
  "appshell.promote.title": "Promote “{path}” to main?",
  "appshell.promote.bodyEmpty":
    "This scenario has no edits yet, so promoting it just archives it. Continue?",
  "appshell.promote.bodyEditsSingle":
    "{count} note edited on this scenario will be applied to main. The scenario itself will be archived. This cannot be undone automatically (older versions stay in history).",
  "appshell.promote.bodyEditsPlural":
    "{count} notes edited on this scenario will be applied to main. The scenario itself will be archived. This cannot be undone automatically (older versions stay in history).",

  // Throw away path confirm
  "appshell.throwAway.title": "Throw away “{path}”?",
  "appshell.throwAway.bodyEmpty":
    "This scenario has no edits yet. Discarding just removes the scenario entry.",
  "appshell.throwAway.bodyEditsSingle":
    "{count} edited note on this scenario will be lost. Main is unaffected. Continue?",
  "appshell.throwAway.bodyEditsPlural":
    "{count} edited notes on this scenario will be lost. Main is unaffected. Continue?",

  // Confirm-state generic buttons
  "appshell.confirm.keepIt": "keep it",
  "appshell.confirm.yesDelete": "yes, delete",

  // New path modal
  "appshell.newPath.title": "Start a new scenario",
  "appshell.newPath.intro":
    "A scenario is an if…. Write the question — that's all. The version you have now stays safely on {root}.",
  "appshell.newPath.trunkHint":
    "Every scenario opens off {root}. One trunk, many scenarios.",
  "appshell.newPath.questionLabel": "the question this scenario asks",
  "appshell.newPath.placeholder": "If the Seattle job comes through…",
  "appshell.newPath.suggestion1": "If it rains on the day",
  "appshell.newPath.suggestion2": "If the project gets denied",
  "appshell.newPath.suggestion3": "If I quit to write",
  "appshell.newPath.suggestion4": "If we have a kid this year",
  "appshell.newPath.nameYourselfSummary": "name it yourself (optional)",
  "appshell.newPath.namePlaceholderAuto": "auto: derived from your question",
  "appshell.newPath.namePlaceholderEmpty": "the-seattle-job",
  "appshell.newPath.notNow": "not now",
  "appshell.newPath.startExploring": "start exploring",
  "appshell.newPath.tipShortcut": "tip: ⌘⇧B works from anywhere",

  // Connect modal
  "appshell.connect.title": "Connect this note",
  "appshell.connect.toLabel": "to",
  "appshell.connect.asLabel": "as",
  "appshell.connect.choosePlaceholder": "— choose a note —",
  "appshell.connect.typeSupports": "supports",
  "appshell.connect.typeChallenges": "challenges",
  "appshell.connect.typeCameFrom": "came from",
  "appshell.connect.typeOpenQuestion": "open question",
  "appshell.connect.reverseHint":
    "A reverse link is added to the other note automatically.",
  "appshell.connect.cancel": "cancel",
  "appshell.connect.connect": "connect",

  // New-note modal
  "appshell.newNote.title": "Start a new note",
  "appshell.newNote.subtitle": "Pick a starting shape, or just type a title.",
  "appshell.newNote.tileBlankTitle": "Blank note",
  "appshell.newNote.tileBlankSub": "Nothing to get in the way.",
  "appshell.newNote.tileKitsTitle": "Kits",
  "appshell.newNote.tileKitsSub":
    "Curated shapes — journal, research, clinical, work, more.",
  "appshell.newNote.tileTemplatesTitle": "Your templates",
  "appshell.newNote.tileTemplatesSubSingle": "{count} you've authored.",
  "appshell.newNote.tileTemplatesSubPlural": "{count} you've authored.",
  "appshell.newNote.tileRecipeUrlTitle": "From recipe URL",
  "appshell.newNote.tileRecipeUrlSub":
    "Paste a recipe link — Yarrow fills the note in.",
  "appshell.newNote.titleLabel": "Title · lands on {path}",
  "appshell.newNote.titlePlaceholder": "e.g. notes on attention",
  "appshell.newNote.cancel": "cancel",
  "appshell.newNote.createBlank": "create blank note",

  // Template-name modal
  "appshell.templateName.title": "New note from \"{label}\"",
  "appshell.templateName.body":
    "Give it a title. The template's scaffolding fills in from there.",
  "appshell.templateName.placeholder": "e.g. project kickoff",
  "appshell.templateName.cancel": "cancel",
  "appshell.templateName.create": "create",

  // Template picker modal
  "appshell.templatePicker.title": "New note from template",
  "appshell.templatePicker.empty":
    "No templates yet. Add one in Settings → Templates.",
  "appshell.templatePicker.dailyBadge": "daily",
} as const;

export type AppshellKey = keyof typeof appshellEN;

export const appshellES: Record<AppshellKey, string> = {
  // Sidebar workspace chip
  "appshell.workspace.switchTitle": "Cambiar de espacio de trabajo · {shortcut}",
  "appshell.workspace.switchAria": "Cambiar de espacio de trabajo",
  "appshell.workspace.fallbackName": "Espacio de trabajo",
  "appshell.workspace.notesPathsSingleSingle":
    "{notes} nota · {scenarios} escenario",
  "appshell.workspace.notesPathsSinglePlural":
    "{notes} nota · {scenarios} escenarios",
  "appshell.workspace.notesPathsPluralSingle":
    "{notes} notas · {scenarios} escenario",
  "appshell.workspace.notesPathsPluralPlural":
    "{notes} notas · {scenarios} escenarios",

  // Sidebar search trigger + utility row
  "appshell.sidebar.findAnything": "Buscar lo que sea",
  "appshell.sidebar.journalLabel": "Diario",
  "appshell.sidebar.journalTitle": "Entrada del diario de hoy",
  "appshell.sidebar.activityLabel": "Actividad",
  "appshell.sidebar.activityTitle": "Mapa de calor de actividad de escritura",
  "appshell.sidebar.trashLabel": "Papelera",
  "appshell.sidebar.trashTitle":
    "Restaurar o eliminar permanentemente notas eliminadas",
  "appshell.sidebar.trashTitleWithCount":
    "{count} nota(s) en la papelera — abrir para restaurar o purgar",
  "appshell.sidebar.resizeTitle": "Arrastra para cambiar el tamaño de la barra lateral",
  "appshell.sidebar.resizeAria": "Cambiar tamaño de la barra lateral",

  // Status bar
  "appshell.status.modePillTitle": "Modo activo: {mode} — clic para cambiar",
  "appshell.status.notes": "{count} notas",
  "appshell.status.paths": "{count} escenarios",
  "appshell.status.onPath": "en el escenario: {path}",
  "appshell.status.onPathNone": "en el escenario: —",
  "appshell.status.selected": "{count} seleccionado",
  "appshell.status.selectedTitle": "{count} caracteres seleccionados",
  "appshell.status.wordCountSingle": "{count} palabra",
  "appshell.status.wordCountPlural": "{count} palabras",
  "appshell.status.wordCountTitle": "~{minutes} min de lectura",
  "appshell.status.overStorage": "Almacenamiento excedido",
  "appshell.status.overStorageTitle":
    "Almacenamiento excedido — haz clic para resolver",
  "appshell.status.offServerCount": "{count} fuera del servidor",
  "appshell.status.offServerSingleTitle":
    "{count} nota se mantiene fuera del servidor — registrada en .git/info/exclude y nunca se sincroniza.",
  "appshell.status.offServerPluralTitle":
    "{count} notas se mantienen fuera del servidor — registradas en .git/info/exclude y nunca se sincronizan.",
  "appshell.status.syncedAgo": "sincronizado {time}",
  "appshell.status.syncTimestampTitle": "Última sincronización: {datetime}",

  // Sync pill labels
  "appshell.sync.synced": "sincronizado",
  "appshell.sync.localChanges": "cambios locales",
  "appshell.sync.syncing": "sincronizando…",
  "appshell.sync.failed": "sincronización fallida",
  "appshell.sync.notAnywhere": "sin sincronización en ningún lado",

  // Skip-to-content + verbose-announcer
  "appshell.skipToContent": "Saltar al editor",
  "appshell.announce.syncStarted": "Sincronización iniciada.",
  "appshell.announce.syncFinished": "Sincronización terminada. Todo está al día.",
  "appshell.announce.syncFailed": "Sincronización fallida: {message}",
  "appshell.announce.saved": "Nota guardada.",
  "appshell.announce.checkpointSaved": "Punto de control guardado.",
  "appshell.announce.pathCreated": "Nueva dirección creada: {name}.",
  "appshell.announce.pathSwitched": "Cambiado a {name}.",
  "appshell.announce.checkpointPinned": "Punto de control fijado.",
  "appshell.announce.checkpointUnpinned": "Punto de control liberado.",
  "appshell.announce.checkpointRestored": "Restaurado al punto de control.",
  "appshell.announce.noteCreated": "Nota creada: {title}.",
  "appshell.announce.noteDeleted": "Nota movida a la papelera: {title}.",

  // Sync status-bar popover
  "appshell.sync.popover.openAria":
    "Estado de sincronización: {status}. Haz clic para ver detalles.",
  "appshell.sync.popover.title": "Detalles de sincronización",
  "appshell.sync.popover.lastSynced": "Última sincronización {time}.",
  "appshell.sync.popover.retry": "Reintentar",
  "appshell.sync.popover.openSettings": "Ajustes de sincronización…",
  "appshell.sync.popover.body.synced":
    "Todo está al día. La sincronización automática se ejecuta de nuevo en segundo plano.",
  "appshell.sync.popover.body.pending":
    "Hay cambios locales que aún no se han enviado — Yarrow los sincronizará en el próximo intervalo.",
  "appshell.sync.popover.body.syncing":
    "La sincronización está en curso.",
  "appshell.sync.popover.body.error":
    "La última sincronización no se completó. Yarrow seguirá intentándolo — pulsa Reintentar para hacerlo ahora.",
  "appshell.sync.popover.body.no-remote":
    "Este espacio de trabajo aún no está conectado en ningún sitio. Abre los ajustes de sincronización para añadir un remoto.",

  // Toast / dismiss
  "appshell.toast.dismiss": "Descartar",

  // Print / locked / clipboard / dictionary toasts and errors
  "appshell.toast.printError":
    "No se pudo preparar la vista previa de impresión: {error}",
  "appshell.toast.copied": "Copiado al portapapeles",
  "appshell.toast.shoppingListAdded":
    "Añadido(s) {added} ingrediente(s) de {source} a la Lista de la compra{dupes}",
  "appshell.toast.shoppingListDupes": " · {skipped} duplicado(s) omitido(s)",
  "appshell.toast.shoppingListEmpty":
    "No se encontraron ingredientes — añade una sección `## Ingredients` con viñetas primero.",
  "appshell.toast.encryptedSession":
    "Sesión bloqueada — las notas cifradas necesitan tu contraseña.",
  "appshell.toast.lockedAfterIdle":
    "Bloqueado por inactividad — desbloquea para continuar.",
  "appshell.toast.enableEncryptionFirst":
    "Habilita primero el cifrado en Configuración → Seguridad.",
  "appshell.toast.unlockToEncrypt": "Desbloquea para cifrar esta nota.",
  "appshell.toast.unlockToDecrypt": "Desbloquea para descifrar esta nota.",
  "appshell.toast.encrypted":
    "Cifrada \"{title}\" — todas las versiones anteriores del historial se resellaron con la misma clave.",
  "appshell.toast.encryptError":
    "No se pudo cifrar — la nota permanece intacta en disco. {error}",
  "appshell.toast.decrypted": "Descifrada \"{title}\".",
  "appshell.toast.decryptError":
    "No se pudo descifrar — la nota sigue sellada e intacta. {error}",
  "appshell.toast.movedToFolder": "Movida a “{folder}”",
  "appshell.toast.movedOutOfFolder": "Movida fuera de la carpeta",
  "appshell.toast.moveError":
    "No se pudo mover la nota — sigue en su carpeta original. {error}",
  "appshell.toast.deleted": "Eliminada \"{title}.\"",
  "appshell.toast.undoLabel": "Deshacer",
  "appshell.toast.undoError": "No se pudo deshacer la eliminación: {error}",
  "appshell.toast.revealError": "No se pudo mostrar el archivo: {error}",
  "appshell.toast.sentToScratchpad":
    "Se enviaron {count} palabras al borrador.",
  "appshell.toast.scratchpadError": "No se pudo enviar al borrador: {error}",
  "appshell.toast.unlockToCopy":
    "Desbloquea la nota primero para copiar su contenido.",
  "appshell.toast.copiedAsMarkdown": "Copiada \"{title}\" como markdown.",
  "appshell.toast.copyError": "No se pudo copiar: {error}",
  "appshell.toast.renameError":
    "No se pudo renombrar — la nota mantiene su título original. {error}",
  "appshell.toast.tagsError":
    "No se pudieron guardar las etiquetas — las etiquetas actuales de la nota no han cambiado. {error}",
  "appshell.toast.annotationSaveError":
    "No se pudo guardar la anotación: {error}",
  "appshell.toast.annotationAddError":
    "No se pudo añadir la anotación: {error}",
  "appshell.toast.kept":
    "Conservado — \"{label}\" sobrevivirá a futuras limpiezas.",
  "appshell.toast.pinError":
    "No se pudo fijar — el estado de fijado de la nota no ha cambiado. {error}",
  "appshell.toast.unpinned":
    "Desfijado — este punto de control ya no está protegido contra limpiezas.",
  "appshell.toast.unpinError":
    "No se pudo desfijar — el estado de fijado de la nota no ha cambiado. {error}",
  "appshell.toast.restored":
    "Restaurado — la versión anterior queda a salvo en el historial.",
  "appshell.toast.promoteError": "No se pudo promover: {error}",
  "appshell.toast.discardError": "No se pudo descartar: {error}",
  "appshell.toast.openWindowError": "No se pudo abrir la ventana: {error}",
  "appshell.toast.createFromTemplateError":
    "No se pudo crear la nota desde la plantilla: {error}",
  "appshell.toast.createFromKitError": "No se pudo abrir el kit: {error}",
  "appshell.toast.createFromTemplateGenericError":
    "No se pudo crear la nota: {error}",
  "appshell.toast.createdTitle": "Creada “{title}”",
  "appshell.toast.startedKit":
    "Comenzaste \"{title}\" — tu página está esperando.",
  "appshell.toast.keptAsNote": "Conservado como nota.",
  "appshell.toast.journalSwitched":
    "El diario vive en main — saltamos allí desde \"{from}\".",
  "appshell.toast.autoSyncConflictsSingle":
    "Sincronización automática: {count} conflicto — se conservó la versión del servidor; tu versión local se guardó como un archivo hermano .conflict-*.md.",
  "appshell.toast.autoSyncConflictsPlural":
    "Sincronización automática: {count} conflictos — se conservó la versión del servidor; tu versión local se guardó como un archivo hermano .conflict-*.md.",
  "appshell.toast.syncConflictsSingle":
    "Sincronización: {count} conflicto — se conservó la versión del servidor; tu versión local se guardó como un archivo hermano .conflict-*.md.",
  "appshell.toast.syncConflictsPlural":
    "Sincronización: {count} conflictos — se conservó la versión del servidor; tu versión local se guardó como un archivo hermano .conflict-*.md.",
  "appshell.toast.syncIssue":
    "La sincronización no se completó — {message}. Yarrow lo reintentará automáticamente.",
  "appshell.toast.conflictResolved":
    "Versiones unidas. Ambas versiones originales siguen en el Historial — desplázate hacia atrás cuando quieras para recuperar lo que no conservaste.",
  "appshell.toast.workspacePurged":
    "Otro dispositivo eliminó archivos permanentemente de este espacio de trabajo. Realineando…",
  "appshell.toast.workspacePurgedFailed":
    "No se pudo realinear automáticamente con el servidor — abre Configuración → Almacenamiento y haz clic en 'Sincronizar estado del servidor ahora'.",
  "appshell.toast.discardSyncingSingle":
    "Se deshizo {count} cambio reciente. Sincronizando…",
  "appshell.toast.discardSyncingPlural":
    "Se deshicieron {count} cambios recientes. Sincronizando…",

  // Map / connections rail
  "appshell.map.title": "Conexiones",
  "appshell.map.titleFiltered": "Mapa · {pathName}",
  "appshell.map.notesInPathSingle": "{count} nota en este escenario",
  "appshell.map.notesInPathPlural": "{count} notas en este escenario",
  "appshell.map.thisNote": "esta nota",
  "appshell.map.neighborsSingle": "{count} vecino",
  "appshell.map.neighborsPlural": "{count} vecinos",

  // Links from this note rail
  "appshell.links.title": "Enlaces desde esta nota",

  "appshell.outline.title": "Esquema",

  "appshell.tabs.label": "Notas abiertas",
  "appshell.tabs.close": "Cerrar pestaña",
  "appshell.tabs.newTab": "Nueva pestaña",
  "appshell.tabs.untitled": "Sin título",
  "appshell.tabs.openInNewTab": "Abrir en nueva pestaña",

  // Locked note hero
  "appshell.locked.title": "Esta nota está bloqueada",
  "appshell.locked.body":
    "Cifrada localmente con ChaCha20-Poly1305.\nIntroduce tu frase de acceso para leerla.",
  "appshell.locked.passphrasePlaceholder": "frase de acceso",
  "appshell.locked.unlock": "desbloquear",
  "appshell.locked.unlockBusy": "…",
  "appshell.locked.localLocks": "candados locales",
  "appshell.locked.noNetwork": "sin red",
  "appshell.locked.noAccounts": "sin cuentas",
  "appshell.locked.forgotPassphrase": "Olvidé mi frase de acceso",

  // Empty workspace hero
  "appshell.empty.title": "Una página en blanco, y todo lo que viene después",
  "appshell.empty.body":
    "Yarrow guarda cada palabra automáticamente. Cada vez que te ramificas, la original queda a salvo. Nada de lo que escribas aquí se puede perder.",
  "appshell.empty.startFirstNote": "Empieza tu primera nota",
  "appshell.empty.findNote": "Buscar una nota",

  // Rename modal
  "appshell.rename.title": "Renombrar nota",
  "appshell.rename.refsBodySingle":
    "{count} otra nota enlaza a esta con un [[wikilink]]. Actualizarla reescribe su cuerpo — se registra como un punto de control, así que es fácil revertir desde el Historial.",
  "appshell.rename.refsBodyPlural":
    "{count} otras notas enlazan a esta con un [[wikilink]]. Actualizarlas reescribe sus cuerpos — se registra como un punto de control, así que es fácil revertir desde el Historial.",
  "appshell.rename.confirmQuestion": "¿Renombrar a \"{title}\"?",
  "appshell.rename.cancel": "Cancelar",
  "appshell.rename.onlyThis": "Renombrar solo esta nota",
  "appshell.rename.andUpdate": "Renombrar y actualizar wikilinks",

  // Find/Replace result modal
  "appshell.findReplaceResult.title": "Reemplazos completados",
  "appshell.findReplaceResult.bodySingle":
    "Se reemplazó {total} aparición en {changed} nota.",
  "appshell.findReplaceResult.bodyPlural":
    "Se reemplazaron {total} apariciones en {changed} notas.",
  "appshell.findReplaceResult.bodyMixed1":
    "Se reemplazaron {total} apariciones en {changed} nota.",
  "appshell.findReplaceResult.bodyMixed2":
    "Se reemplazó {total} aparición en {changed} notas.",
  "appshell.findReplaceResult.checkpointHint":
    "Un punto de control registra todo el cambio — deshazlo desde el Historial en cualquier nota afectada.",
  "appshell.findReplaceResult.done": "Listo",

  // Delete-this-note (locked) confirm
  "appshell.deleteLocked.title": "¿Eliminar esta nota?",
  "appshell.deleteLocked.body":
    "No se puede mostrar un deshacer para esta nota (está bloqueada). ¿Eliminar de todas formas? Las versiones anteriores quedan en el historial.",

  // Delete many confirm
  "appshell.deleteMany.titleSingle": "¿Eliminar {count} nota?",
  "appshell.deleteMany.titlePlural": "¿Eliminar {count} notas?",
  "appshell.deleteMany.body":
    "Desaparecen de la lista. Las versiones anteriores en este escenario quedan en el historial.",

  // Promote path confirm
  "appshell.promote.title": "¿Promover “{path}” a main?",
  "appshell.promote.bodyEmpty":
    "Este escenario aún no tiene cambios, así que promoverlo solo lo archiva. ¿Continuar?",
  "appshell.promote.bodyEditsSingle":
    "{count} nota editada en este escenario se aplicará a main. El escenario mismo será archivado. Esto no se puede deshacer automáticamente (las versiones anteriores quedan en el historial).",
  "appshell.promote.bodyEditsPlural":
    "{count} notas editadas en este escenario se aplicarán a main. El escenario mismo será archivado. Esto no se puede deshacer automáticamente (las versiones anteriores quedan en el historial).",

  // Throw away path confirm
  "appshell.throwAway.title": "¿Descartar “{path}”?",
  "appshell.throwAway.bodyEmpty":
    "Este escenario aún no tiene cambios. Descartar solo elimina la entrada del escenario.",
  "appshell.throwAway.bodyEditsSingle":
    "{count} nota editada en este escenario se perderá. Main no se ve afectada. ¿Continuar?",
  "appshell.throwAway.bodyEditsPlural":
    "{count} notas editadas en este escenario se perderán. Main no se ve afectada. ¿Continuar?",

  // Confirm-state generic buttons
  "appshell.confirm.keepIt": "conservarla",
  "appshell.confirm.yesDelete": "sí, eliminar",

  // New path modal
  "appshell.newPath.title": "Empezar un nuevo escenario",
  "appshell.newPath.intro":
    "Un escenario es un si…. Escribe la pregunta — eso es todo. La versión que tienes ahora queda a salvo en {root}.",
  "appshell.newPath.trunkHint":
    "Cada escenario se ramifica desde {root}. Un tronco, muchas ramas.",
  "appshell.newPath.questionLabel": "la pregunta que hace este escenario",
  "appshell.newPath.placeholder": "Si sale el trabajo de Seattle…",
  "appshell.newPath.suggestion1": "Si llueve ese día",
  "appshell.newPath.suggestion2": "Si rechazan el proyecto",
  "appshell.newPath.suggestion3": "Si renuncio para escribir",
  "appshell.newPath.suggestion4": "Si tenemos un hijo este año",
  "appshell.newPath.nameYourselfSummary": "ponle nombre tú (opcional)",
  "appshell.newPath.namePlaceholderAuto": "auto: derivado de tu pregunta",
  "appshell.newPath.namePlaceholderEmpty": "el-trabajo-en-seattle",
  "appshell.newPath.notNow": "ahora no",
  "appshell.newPath.startExploring": "empezar a explorar",
  "appshell.newPath.tipShortcut":
    "consejo: ⌘⇧B funciona desde cualquier lado",

  // Connect modal
  "appshell.connect.title": "Conectar esta nota",
  "appshell.connect.toLabel": "con",
  "appshell.connect.asLabel": "como",
  "appshell.connect.choosePlaceholder": "— elige una nota —",
  "appshell.connect.typeSupports": "apoya",
  "appshell.connect.typeChallenges": "desafía",
  "appshell.connect.typeCameFrom": "viene de",
  "appshell.connect.typeOpenQuestion": "pregunta abierta",
  "appshell.connect.reverseHint":
    "Se añade un enlace inverso a la otra nota automáticamente.",
  "appshell.connect.cancel": "cancelar",
  "appshell.connect.connect": "conectar",

  // New-note modal
  "appshell.newNote.title": "Empezar una nueva nota",
  "appshell.newNote.subtitle":
    "Elige una forma de partida o solo escribe un título.",
  "appshell.newNote.tileBlankTitle": "Nota en blanco",
  "appshell.newNote.tileBlankSub": "Nada que se interponga.",
  "appshell.newNote.tileKitsTitle": "Kits",
  "appshell.newNote.tileKitsSub":
    "Formas curadas — diario, investigación, clínica, trabajo, más.",
  "appshell.newNote.tileTemplatesTitle": "Tus plantillas",
  "appshell.newNote.tileTemplatesSubSingle": "{count} que tú creaste.",
  "appshell.newNote.tileTemplatesSubPlural": "{count} que tú creaste.",
  "appshell.newNote.tileRecipeUrlTitle": "Desde URL de receta",
  "appshell.newNote.tileRecipeUrlSub":
    "Pega un enlace de receta — Yarrow rellena la nota.",
  "appshell.newNote.titleLabel": "Título · va a {path}",
  "appshell.newNote.titlePlaceholder": "p. ej. notas sobre la atención",
  "appshell.newNote.cancel": "cancelar",
  "appshell.newNote.createBlank": "crear nota en blanco",

  // Template-name modal
  "appshell.templateName.title": "Nueva nota desde \"{label}\"",
  "appshell.templateName.body":
    "Ponle un título. El andamiaje de la plantilla rellena el resto.",
  "appshell.templateName.placeholder": "p. ej. inicio del proyecto",
  "appshell.templateName.cancel": "cancelar",
  "appshell.templateName.create": "crear",

  // Template picker modal
  "appshell.templatePicker.title": "Nueva nota desde plantilla",
  "appshell.templatePicker.empty":
    "Aún no hay plantillas. Añade una en Configuración → Plantillas.",
  "appshell.templatePicker.dailyBadge": "diaria",
};

export const appshellSV: Record<AppshellKey, string> = {
  // Sidebar workspace chip
  "appshell.workspace.switchTitle": "Byt arbetsyta · {shortcut}",
  "appshell.workspace.switchAria": "Byt arbetsyta",
  "appshell.workspace.fallbackName": "Arbetsyta",
  "appshell.workspace.notesPathsSingleSingle":
    "{notes} anteckning · {scenarios} scenario",
  "appshell.workspace.notesPathsSinglePlural":
    "{notes} anteckning · {scenarios} scenarier",
  "appshell.workspace.notesPathsPluralSingle":
    "{notes} anteckningar · {scenarios} scenario",
  "appshell.workspace.notesPathsPluralPlural":
    "{notes} anteckningar · {scenarios} scenarier",

  // Sidebar search trigger + utility row
  "appshell.sidebar.findAnything": "Sök vad som helst",
  "appshell.sidebar.journalLabel": "Journal",
  "appshell.sidebar.journalTitle": "Dagens journalanteckning",
  "appshell.sidebar.activityLabel": "Aktivitet",
  "appshell.sidebar.activityTitle": "Värmekarta för skrivaktivitet",
  "appshell.sidebar.trashLabel": "Papperskorg",
  "appshell.sidebar.trashTitle":
    "Återställ eller ta bort raderade anteckningar permanent",
  "appshell.sidebar.trashTitleWithCount":
    "{count} anteckning(ar) i papperskorgen — öppna för att återställa eller rensa",
  "appshell.sidebar.resizeTitle": "Dra för att ändra sidofältets storlek",
  "appshell.sidebar.resizeAria": "Ändra sidofältets storlek",

  // Status bar
  "appshell.status.modePillTitle": "Aktivt läge: {mode} — klicka för att byta",
  "appshell.status.notes": "{count} anteckningar",
  "appshell.status.paths": "{count} scenarier",
  "appshell.status.onPath": "på scenario: {path}",
  "appshell.status.onPathNone": "på scenario: —",
  "appshell.status.selected": "{count} markerade",
  "appshell.status.selectedTitle": "{count} tecken markerade",
  "appshell.status.wordCountSingle": "{count} ord",
  "appshell.status.wordCountPlural": "{count} ord",
  "appshell.status.wordCountTitle": "~{minutes} min läsning",
  "appshell.status.overStorage": "Lagring överskriden",
  "appshell.status.overStorageTitle":
    "Lagring överskriden — klicka för att lösa",
  "appshell.status.offServerCount": "{count} utanför servern",
  "appshell.status.offServerSingleTitle":
    "{count} anteckning hålls utanför servern — registrerad i .git/info/exclude och synkroniseras aldrig.",
  "appshell.status.offServerPluralTitle":
    "{count} anteckningar hålls utanför servern — registrerade i .git/info/exclude och synkroniseras aldrig.",
  "appshell.status.syncedAgo": "synkad {time}",
  "appshell.status.syncTimestampTitle": "Senast synk: {datetime}",

  // Sync pill labels
  "appshell.sync.synced": "synkroniserat",
  "appshell.sync.localChanges": "lokala ändringar",
  "appshell.sync.syncing": "synkroniserar…",
  "appshell.sync.failed": "synkronisering misslyckades",
  "appshell.sync.notAnywhere": "synkroniseras inte någonstans",

  // Skip-to-content + verbose-announcer
  "appshell.skipToContent": "Hoppa till redigeraren",
  "appshell.announce.syncStarted": "Synkronisering startade.",
  "appshell.announce.syncFinished": "Synkroniseringen klar. Allt är uppdaterat.",
  "appshell.announce.syncFailed": "Synkroniseringen misslyckades: {message}",
  "appshell.announce.saved": "Anteckning sparad.",
  "appshell.announce.checkpointSaved": "Kontrollpunkt sparad.",
  "appshell.announce.pathCreated": "Ny riktning skapad: {name}.",
  "appshell.announce.pathSwitched": "Bytte till {name}.",
  "appshell.announce.checkpointPinned": "Kontrollpunkt fäst.",
  "appshell.announce.checkpointUnpinned": "Kontrollpunkt avfäst.",
  "appshell.announce.checkpointRestored": "Återställd till kontrollpunkt.",
  "appshell.announce.noteCreated": "Anteckning skapad: {title}.",
  "appshell.announce.noteDeleted": "Anteckning flyttad till papperskorgen: {title}.",

  // Sync status-bar popover
  "appshell.sync.popover.openAria":
    "Synkroniseringsstatus: {status}. Klicka för detaljer.",
  "appshell.sync.popover.title": "Synkroniseringsdetaljer",
  "appshell.sync.popover.lastSynced": "Senaste synk {time}.",
  "appshell.sync.popover.retry": "Försök igen",
  "appshell.sync.popover.openSettings": "Synkroniseringsinställningar…",
  "appshell.sync.popover.body.synced":
    "Allt är uppdaterat. Auto-synk körs igen i bakgrunden.",
  "appshell.sync.popover.body.pending":
    "Det finns lokala ändringar som inte har skickats än — Yarrow synkar dem vid nästa intervall.",
  "appshell.sync.popover.body.syncing":
    "Synkroniseringen pågår nu.",
  "appshell.sync.popover.body.error":
    "Senaste synk slutfördes inte. Yarrow fortsätter försöka — Försök igen för att köra direkt.",
  "appshell.sync.popover.body.no-remote":
    "Den här arbetsytan är inte ansluten någonstans än. Öppna synkroniseringsinställningarna för att lägga till en fjärransluten.",

  // Toast / dismiss
  "appshell.toast.dismiss": "Avfärda",

  // Print / locked / clipboard / dictionary toasts and errors
  "appshell.toast.printError":
    "Det gick inte att förbereda förhandsvisningen för utskrift: {error}",
  "appshell.toast.copied": "Kopierat till urklipp",
  "appshell.toast.shoppingListAdded":
    "Lade till {added} ingrediens(er) från {source} i Inköpslistan{dupes}",
  "appshell.toast.shoppingListDupes": " · hoppade över {skipped} duplikat",
  "appshell.toast.shoppingListEmpty":
    "Inga ingredienser hittades — lägg till en `## Ingredients`-sektion med punktlista först.",
  "appshell.toast.encryptedSession":
    "Sessionen är låst — krypterade anteckningar behöver ditt lösenord.",
  "appshell.toast.lockedAfterIdle":
    "Låst efter inaktivitet — lås upp för att fortsätta.",
  "appshell.toast.enableEncryptionFirst":
    "Aktivera kryptering först i Inställningar → Säkerhet.",
  "appshell.toast.unlockToEncrypt":
    "Lås upp för att kryptera den här anteckningen.",
  "appshell.toast.unlockToDecrypt":
    "Lås upp för att dekryptera den här anteckningen.",
  "appshell.toast.encrypted":
    "Krypterade \"{title}\" — varje tidigare version i historiken förseglades om med samma nyckel.",
  "appshell.toast.encryptError": "Det gick inte att kryptera: {error}",
  "appshell.toast.decrypted": "Dekrypterade \"{title}\".",
  "appshell.toast.decryptError": "Det gick inte att dekryptera: {error}",
  "appshell.toast.movedToFolder": "Flyttad till “{folder}”",
  "appshell.toast.movedOutOfFolder": "Flyttad ut ur mappen",
  "appshell.toast.moveError":
    "Det gick inte att flytta anteckningen: {error}",
  "appshell.toast.deleted": "Tog bort \"{title}.\"",
  "appshell.toast.undoLabel": "Ångra",
  "appshell.toast.undoError":
    "Det gick inte att ångra borttagningen: {error}",
  "appshell.toast.revealError": "Det gick inte att visa filen: {error}",
  "appshell.toast.sentToScratchpad":
    "Skickade {count} ord till klotterblocket.",
  "appshell.toast.scratchpadError":
    "Det gick inte att skicka till klotterblocket: {error}",
  "appshell.toast.unlockToCopy":
    "Lås upp anteckningen först för att kopiera dess innehåll.",
  "appshell.toast.copiedAsMarkdown": "Kopierade \"{title}\" som markdown.",
  "appshell.toast.copyError": "Det gick inte att kopiera: {error}",
  "appshell.toast.renameError":
    "Det gick inte att byta namn — anteckningen behåller sin ursprungliga titel. {error}",
  "appshell.toast.tagsError":
    "Det gick inte att spara taggarna — anteckningens nuvarande taggar är oförändrade. {error}",
  "appshell.toast.annotationSaveError":
    "Det gick inte att spara anteckningen: {error}",
  "appshell.toast.annotationAddError":
    "Det gick inte att lägga till anteckningen: {error}",
  "appshell.toast.kept":
    "Sparat — \"{label}\" kommer att överleva framtida rensning.",
  "appshell.toast.pinError":
    "Det gick inte att fästa — anteckningens fäst-status är oförändrad. {error}",
  "appshell.toast.unpinned":
    "Lossad — den här kontrollpunkten är inte längre skyddad mot rensning.",
  "appshell.toast.unpinError":
    "Det gick inte att lossa — anteckningens fäst-status är oförändrad. {error}",
  "appshell.toast.restored":
    "Återställd — den tidigare versionen ligger tryggt kvar i historiken.",
  "appshell.toast.promoteError": "Det gick inte att befordra: {error}",
  "appshell.toast.discardError": "Det gick inte att kasta: {error}",
  "appshell.toast.openWindowError":
    "Det gick inte att öppna fönstret: {error}",
  "appshell.toast.createFromTemplateError":
    "Det gick inte att skapa anteckning från mallen: {error}",
  "appshell.toast.createFromKitError":
    "Det gick inte att öppna kitet: {error}",
  "appshell.toast.createFromTemplateGenericError":
    "Det gick inte att skapa anteckning: {error}",
  "appshell.toast.createdTitle": "Skapade “{title}”",
  "appshell.toast.startedKit":
    "Startade \"{title}\" — din sida väntar.",
  "appshell.toast.keptAsNote": "Sparad som anteckning.",
  "appshell.toast.journalSwitched":
    "Journalen ligger på main — hoppade dit från \"{from}\".",
  "appshell.toast.autoSyncConflictsSingle":
    "Autosynkronisering: {count} konflikt — serverversionen behölls; din lokala version sparades som en .conflict-*.md-syskonfil.",
  "appshell.toast.autoSyncConflictsPlural":
    "Autosynkronisering: {count} konflikter — serverversionen behölls; din lokala version sparades som en .conflict-*.md-syskonfil.",
  "appshell.toast.syncConflictsSingle":
    "Synkronisering: {count} konflikt — serverversionen behölls; din lokala version sparades som en .conflict-*.md-syskonfil.",
  "appshell.toast.syncConflictsPlural":
    "Synkronisering: {count} konflikter — serverversionen behölls; din lokala version sparades som en .conflict-*.md-syskonfil.",
  "appshell.toast.syncIssue":
    "Synkroniseringen blev inte klar — {message}. Yarrow försöker igen automatiskt.",
  "appshell.toast.conflictResolved":
    "Sammanförda. Båda ursprungsversionerna finns kvar i Historiken — bläddra bakåt när som helst för att återställa det du inte behöll.",
  "appshell.toast.workspacePurged":
    "En annan enhet raderade filer permanent från denna arbetsyta. Anpassar om…",
  "appshell.toast.workspacePurgedFailed":
    "Det gick inte att anpassa om automatiskt mot servern — öppna Inställningar → Lagring och klicka på 'Synka serverstatus nu'.",
  "appshell.toast.discardSyncingSingle":
    "Ångrade {count} senaste ändring. Synkroniserar…",
  "appshell.toast.discardSyncingPlural":
    "Ångrade {count} senaste ändringar. Synkroniserar…",

  // Map / connections rail
  "appshell.map.title": "Kopplingar",
  "appshell.map.titleFiltered": "Karta · {pathName}",
  "appshell.map.notesInPathSingle": "{count} anteckning i det här scenariot",
  "appshell.map.notesInPathPlural": "{count} anteckningar i det här scenariot",
  "appshell.map.thisNote": "den här anteckningen",
  "appshell.map.neighborsSingle": "{count} granne",
  "appshell.map.neighborsPlural": "{count} grannar",

  // Links from this note rail
  "appshell.links.title": "Länkar från den här anteckningen",

  "appshell.outline.title": "Översikt",

  "appshell.tabs.label": "Öppna anteckningar",
  "appshell.tabs.close": "Stäng flik",
  "appshell.tabs.newTab": "Ny flik",
  "appshell.tabs.untitled": "Namnlös",
  "appshell.tabs.openInNewTab": "Öppna i ny flik",

  // Locked note hero
  "appshell.locked.title": "Den här anteckningen är låst",
  "appshell.locked.body":
    "Krypterad lokalt med ChaCha20-Poly1305.\nAnge din lösenfras för att läsa den.",
  "appshell.locked.passphrasePlaceholder": "lösenfras",
  "appshell.locked.unlock": "lås upp",
  "appshell.locked.unlockBusy": "…",
  "appshell.locked.localLocks": "lokala lås",
  "appshell.locked.noNetwork": "inget nätverk",
  "appshell.locked.noAccounts": "inga konton",
  "appshell.locked.forgotPassphrase": "Jag har glömt min lösenfras",

  // Empty workspace hero
  "appshell.empty.title": "Ett tomt blad, och allt som väntar framför",
  "appshell.empty.body":
    "Yarrow sparar varje ord automatiskt. Varje gång du förgrenar dig ligger originalet kvar tryggt. Inget du skriver här kan gå förlorat.",
  "appshell.empty.startFirstNote": "Börja din första anteckning",
  "appshell.empty.findNote": "Hitta en anteckning",

  // Rename modal
  "appshell.rename.title": "Byt namn på anteckning",
  "appshell.rename.refsBodySingle":
    "{count} annan anteckning länkar till den här med en [[wikilink]]. Att uppdatera den skriver om dess kropp — registreras som en kontrollpunkt, så det är lätt att rulla tillbaka från Historiken.",
  "appshell.rename.refsBodyPlural":
    "{count} andra anteckningar länkar till den här med en [[wikilink]]. Att uppdatera dem skriver om deras kroppar — registreras som en kontrollpunkt, så det är lätt att rulla tillbaka från Historiken.",
  "appshell.rename.confirmQuestion": "Byt namn till \"{title}\"?",
  "appshell.rename.cancel": "Avbryt",
  "appshell.rename.onlyThis": "Byt namn på endast den här anteckningen",
  "appshell.rename.andUpdate": "Byt namn och uppdatera wikilinks",

  // Find/Replace result modal
  "appshell.findReplaceResult.title": "Ersättningar klara",
  "appshell.findReplaceResult.bodySingle":
    "Ersatte {total} förekomst i {changed} anteckning.",
  "appshell.findReplaceResult.bodyPlural":
    "Ersatte {total} förekomster i {changed} anteckningar.",
  "appshell.findReplaceResult.bodyMixed1":
    "Ersatte {total} förekomster i {changed} anteckning.",
  "appshell.findReplaceResult.bodyMixed2":
    "Ersatte {total} förekomst i {changed} anteckningar.",
  "appshell.findReplaceResult.checkpointHint":
    "En kontrollpunkt registrerar hela ändringen — ångra via Historiken på vilken som helst påverkad anteckning.",
  "appshell.findReplaceResult.done": "Klar",

  // Delete-this-note (locked) confirm
  "appshell.deleteLocked.title": "Ta bort den här anteckningen?",
  "appshell.deleteLocked.body":
    "Det går inte att visa en ångra-knapp för den här anteckningen (den är låst). Ta bort ändå? Tidigare versioner ligger kvar i historiken.",

  // Delete many confirm
  "appshell.deleteMany.titleSingle": "Ta bort {count} anteckning?",
  "appshell.deleteMany.titlePlural": "Ta bort {count} anteckningar?",
  "appshell.deleteMany.body":
    "De försvinner från listan. Tidigare versioner i det här scenariot ligger kvar i historiken.",

  // Promote path confirm
  "appshell.promote.title": "Befordra “{path}” till main?",
  "appshell.promote.bodyEmpty":
    "Det här scenariot har inga ändringar än, så att befordra det arkiverar bara det. Fortsätt?",
  "appshell.promote.bodyEditsSingle":
    "{count} anteckning som redigerats i det här scenariot kommer att tillämpas på main. Scenariot självt arkiveras. Detta kan inte ångras automatiskt (äldre versioner ligger kvar i historiken).",
  "appshell.promote.bodyEditsPlural":
    "{count} anteckningar som redigerats i det här scenariot kommer att tillämpas på main. Scenariot självt arkiveras. Detta kan inte ångras automatiskt (äldre versioner ligger kvar i historiken).",

  // Throw away path confirm
  "appshell.throwAway.title": "Kasta “{path}”?",
  "appshell.throwAway.bodyEmpty":
    "Det här scenariot har inga ändringar än. Att kasta det tar bara bort scenarioposten.",
  "appshell.throwAway.bodyEditsSingle":
    "{count} redigerad anteckning i det här scenariot kommer att gå förlorad. Main påverkas inte. Fortsätt?",
  "appshell.throwAway.bodyEditsPlural":
    "{count} redigerade anteckningar i det här scenariot kommer att gå förlorade. Main påverkas inte. Fortsätt?",

  // Confirm-state generic buttons
  "appshell.confirm.keepIt": "behåll",
  "appshell.confirm.yesDelete": "ja, ta bort",

  // New path modal
  "appshell.newPath.title": "Starta ett nytt scenario",
  "appshell.newPath.intro":
    "Ett scenario är ett om…. Skriv frågan — det är allt. Versionen du har nu ligger tryggt kvar på {root}.",
  "appshell.newPath.trunkHint":
    "Varje scenario förgrenar sig från {root}. En stam, många grenar.",
  "appshell.newPath.questionLabel": "frågan det här scenariot ställer",
  "appshell.newPath.placeholder": "Om jobbet i Seattle blir av…",
  "appshell.newPath.suggestion1": "Om det regnar den dagen",
  "appshell.newPath.suggestion2": "Om projektet får avslag",
  "appshell.newPath.suggestion3": "Om jag säger upp mig för att skriva",
  "appshell.newPath.suggestion4": "Om vi får barn i år",
  "appshell.newPath.nameYourselfSummary": "namnge själv (valfritt)",
  "appshell.newPath.namePlaceholderAuto": "auto: härleds från din fråga",
  "appshell.newPath.namePlaceholderEmpty": "jobbet-i-seattle",
  "appshell.newPath.notNow": "inte nu",
  "appshell.newPath.startExploring": "börja utforska",
  "appshell.newPath.tipShortcut": "tips: ⌘⇧B fungerar varifrån som helst",

  // Connect modal
  "appshell.connect.title": "Koppla den här anteckningen",
  "appshell.connect.toLabel": "till",
  "appshell.connect.asLabel": "som",
  "appshell.connect.choosePlaceholder": "— välj en anteckning —",
  "appshell.connect.typeSupports": "stödjer",
  "appshell.connect.typeChallenges": "utmanar",
  "appshell.connect.typeCameFrom": "kommer från",
  "appshell.connect.typeOpenQuestion": "öppen fråga",
  "appshell.connect.reverseHint":
    "En omvänd länk läggs automatiskt till på den andra anteckningen.",
  "appshell.connect.cancel": "avbryt",
  "appshell.connect.connect": "koppla",

  // New-note modal
  "appshell.newNote.title": "Starta en ny anteckning",
  "appshell.newNote.subtitle": "Välj en utgångsform eller skriv bara en titel.",
  "appshell.newNote.tileBlankTitle": "Tom anteckning",
  "appshell.newNote.tileBlankSub": "Inget som står i vägen.",
  "appshell.newNote.tileKitsTitle": "Kit",
  "appshell.newNote.tileKitsSub":
    "Kurerade former — journal, forskning, kliniskt, jobb, mer.",
  "appshell.newNote.tileTemplatesTitle": "Dina mallar",
  "appshell.newNote.tileTemplatesSubSingle": "{count} du har skapat.",
  "appshell.newNote.tileTemplatesSubPlural": "{count} du har skapat.",
  "appshell.newNote.tileRecipeUrlTitle": "Från recept-URL",
  "appshell.newNote.tileRecipeUrlSub":
    "Klistra in en receptlänk — Yarrow fyller i anteckningen.",
  "appshell.newNote.titleLabel": "Titel · landar på {path}",
  "appshell.newNote.titlePlaceholder": "t.ex. anteckningar om uppmärksamhet",
  "appshell.newNote.cancel": "avbryt",
  "appshell.newNote.createBlank": "skapa tom anteckning",

  // Template-name modal
  "appshell.templateName.title": "Ny anteckning från \"{label}\"",
  "appshell.templateName.body":
    "Ge den en titel. Mallens stomme fyller i resten.",
  "appshell.templateName.placeholder": "t.ex. projektstart",
  "appshell.templateName.cancel": "avbryt",
  "appshell.templateName.create": "skapa",

  // Template picker modal
  "appshell.templatePicker.title": "Ny anteckning från mall",
  "appshell.templatePicker.empty":
    "Inga mallar än. Lägg till en i Inställningar → Mallar.",
  "appshell.templatePicker.dailyBadge": "daglig",
};
