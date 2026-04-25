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
    "{notes} note · {paths} path",
  "appshell.workspace.notesPathsSinglePlural":
    "{notes} note · {paths} paths",
  "appshell.workspace.notesPathsPluralSingle":
    "{notes} notes · {paths} path",
  "appshell.workspace.notesPathsPluralPlural":
    "{notes} notes · {paths} paths",

  // Sidebar search trigger + utility row
  "appshell.sidebar.findAnything": "Find anything",
  "appshell.sidebar.journalLabel": "Journal",
  "appshell.sidebar.journalTitle": "Today's journal entry",
  "appshell.sidebar.activityLabel": "Activity",
  "appshell.sidebar.activityTitle": "Writing activity heatmap",
  "appshell.sidebar.trashLabel": "Trash",
  "appshell.sidebar.trashTitle": "Restore or permanently remove deleted notes",

  // Status bar
  "appshell.status.notes": "{count} notes",
  "appshell.status.paths": "{count} paths",
  "appshell.status.onPath": "on path: {path}",
  "appshell.status.onPathNone": "on path: —",
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

  // Sync pill labels
  "appshell.sync.synced": "synced",
  "appshell.sync.localChanges": "local changes",
  "appshell.sync.syncing": "syncing…",
  "appshell.sync.failed": "sync failed",
  "appshell.sync.notAnywhere": "not synced anywhere",

  // Toast / dismiss
  "appshell.toast.dismiss": "Dismiss",

  // Print / locked / clipboard / dictionary toasts and errors
  "appshell.toast.printError": "Couldn't prepare print preview: {error}",
  "appshell.toast.encryptedSession":
    "Session locked — encrypted notes need your password.",
  "appshell.toast.lockedAfterIdle": "Locked after idle — unlock to keep going.",
  "appshell.toast.enableEncryptionFirst":
    "Enable encryption first in Settings → Security.",
  "appshell.toast.unlockToEncrypt": "Unlock to encrypt this note.",
  "appshell.toast.unlockToDecrypt": "Unlock to decrypt this note.",
  "appshell.toast.encrypted":
    "Encrypted \"{title}\" — every past version in history was re-sealed with the same key.",
  "appshell.toast.encryptError": "Couldn't encrypt: {error}",
  "appshell.toast.decrypted": "Decrypted \"{title}\".",
  "appshell.toast.decryptError": "Couldn't decrypt: {error}",
  "appshell.toast.movedToFolder": "Moved to “{folder}”",
  "appshell.toast.movedOutOfFolder": "Moved out of folder",
  "appshell.toast.moveError": "Couldn't move note: {error}",
  "appshell.toast.deleted": "Deleted \"{title}.\"",
  "appshell.toast.undoLabel": "Undo",
  "appshell.toast.undoError": "Couldn't undo delete: {error}",
  "appshell.toast.revealError": "Couldn't reveal file: {error}",
  "appshell.toast.sentToScratchpad": "Sent {count} words to scratchpad.",
  "appshell.toast.scratchpadError": "Couldn't send to scratchpad: {error}",
  "appshell.toast.unlockToCopy": "Unlock the note first to copy its contents.",
  "appshell.toast.copiedAsMarkdown": "Copied \"{title}\" as markdown.",
  "appshell.toast.copyError": "Couldn't copy: {error}",
  "appshell.toast.renameError": "Couldn't rename: {error}",
  "appshell.toast.tagsError": "Couldn't update tags: {error}",
  "appshell.toast.annotationSaveError": "Couldn't save annotation: {error}",
  "appshell.toast.annotationAddError": "Couldn't add annotation: {error}",
  "appshell.toast.kept": "Kept — \"{label}\" will survive future pruning.",
  "appshell.toast.pinError": "Couldn't pin: {error}",
  "appshell.toast.unpinned":
    "Unpinned — this checkpoint is no longer protected from pruning.",
  "appshell.toast.unpinError": "Couldn't unpin: {error}",
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
  "appshell.toast.syncIssue": "Sync issue: {message}",
  "appshell.toast.workspacePurged":
    "Another device permanently deleted files from this workspace. Re-aligning…",
  "appshell.toast.workspacePurgedFailed":
    "Couldn't re-align with the server automatically — open Settings → Storage and click 'Sync server state now'.",
  "appshell.toast.discardSyncingSingle": "Undid {count} recent change. Syncing…",
  "appshell.toast.discardSyncingPlural": "Undid {count} recent changes. Syncing…",

  // Map / connections rail
  "appshell.map.title": "Connections",
  "appshell.map.titleFiltered": "Map · {pathName}",
  "appshell.map.notesInPathSingle": "{count} note in this path",
  "appshell.map.notesInPathPlural": "{count} notes in this path",
  "appshell.map.thisNote": "this note",
  "appshell.map.neighborsSingle": "{count} neighbor",
  "appshell.map.neighborsPlural": "{count} neighbors",

  // Links from this note rail
  "appshell.links.title": "Links from this note",

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
    "Yarrow saves every word automatically. Every time you branch, the original stays safe. Nothing you write here can get lost.",
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
    "They disappear from the list. Past versions on this path remain in history.",

  // Promote path confirm
  "appshell.promote.title": "Promote “{path}” to main?",
  "appshell.promote.bodyEmpty":
    "This path has no edits yet, so promoting it just archives it. Continue?",
  "appshell.promote.bodyEditsSingle":
    "{count} note edited on this path will be applied to main. The path itself will be archived. This cannot be undone automatically (older versions stay in history).",
  "appshell.promote.bodyEditsPlural":
    "{count} notes edited on this path will be applied to main. The path itself will be archived. This cannot be undone automatically (older versions stay in history).",

  // Throw away path confirm
  "appshell.throwAway.title": "Throw away “{path}”?",
  "appshell.throwAway.bodyEmpty":
    "This path has no edits yet. Discarding just removes the path entry.",
  "appshell.throwAway.bodyEditsSingle":
    "{count} edited note on this path will be lost. Main is unaffected. Continue?",
  "appshell.throwAway.bodyEditsPlural":
    "{count} edited notes on this path will be lost. Main is unaffected. Continue?",

  // Confirm-state generic buttons
  "appshell.confirm.keepIt": "keep it",
  "appshell.confirm.yesDelete": "yes, delete",

  // New path modal
  "appshell.newPath.title": "Start a new path",
  "appshell.newPath.intro":
    "A path is an if…. Write the question — that's all. The version you have now stays safely on {root}.",
  "appshell.newPath.trunkHint":
    "Every path branches from {root}. One trunk, many branches.",
  "appshell.newPath.questionLabel": "the question this path asks",
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
    "{notes} nota · {paths} ruta",
  "appshell.workspace.notesPathsSinglePlural":
    "{notes} nota · {paths} rutas",
  "appshell.workspace.notesPathsPluralSingle":
    "{notes} notas · {paths} ruta",
  "appshell.workspace.notesPathsPluralPlural":
    "{notes} notas · {paths} rutas",

  // Sidebar search trigger + utility row
  "appshell.sidebar.findAnything": "Buscar lo que sea",
  "appshell.sidebar.journalLabel": "Diario",
  "appshell.sidebar.journalTitle": "Entrada del diario de hoy",
  "appshell.sidebar.activityLabel": "Actividad",
  "appshell.sidebar.activityTitle": "Mapa de calor de actividad de escritura",
  "appshell.sidebar.trashLabel": "Papelera",
  "appshell.sidebar.trashTitle":
    "Restaurar o eliminar permanentemente notas eliminadas",

  // Status bar
  "appshell.status.notes": "{count} notas",
  "appshell.status.paths": "{count} rutas",
  "appshell.status.onPath": "en la ruta: {path}",
  "appshell.status.onPathNone": "en la ruta: —",
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

  // Sync pill labels
  "appshell.sync.synced": "sincronizado",
  "appshell.sync.localChanges": "cambios locales",
  "appshell.sync.syncing": "sincronizando…",
  "appshell.sync.failed": "sincronización fallida",
  "appshell.sync.notAnywhere": "sin sincronización en ningún lado",

  // Toast / dismiss
  "appshell.toast.dismiss": "Descartar",

  // Print / locked / clipboard / dictionary toasts and errors
  "appshell.toast.printError":
    "No se pudo preparar la vista previa de impresión: {error}",
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
  "appshell.toast.encryptError": "No se pudo cifrar: {error}",
  "appshell.toast.decrypted": "Descifrada \"{title}\".",
  "appshell.toast.decryptError": "No se pudo descifrar: {error}",
  "appshell.toast.movedToFolder": "Movida a “{folder}”",
  "appshell.toast.movedOutOfFolder": "Movida fuera de la carpeta",
  "appshell.toast.moveError": "No se pudo mover la nota: {error}",
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
  "appshell.toast.renameError": "No se pudo renombrar: {error}",
  "appshell.toast.tagsError":
    "No se pudieron actualizar las etiquetas: {error}",
  "appshell.toast.annotationSaveError":
    "No se pudo guardar la anotación: {error}",
  "appshell.toast.annotationAddError":
    "No se pudo añadir la anotación: {error}",
  "appshell.toast.kept":
    "Conservado — \"{label}\" sobrevivirá a futuras limpiezas.",
  "appshell.toast.pinError": "No se pudo fijar: {error}",
  "appshell.toast.unpinned":
    "Desfijado — este punto de control ya no está protegido contra limpiezas.",
  "appshell.toast.unpinError": "No se pudo desfijar: {error}",
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
  "appshell.toast.syncIssue": "Problema de sincronización: {message}",
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
  "appshell.map.notesInPathSingle": "{count} nota en esta ruta",
  "appshell.map.notesInPathPlural": "{count} notas en esta ruta",
  "appshell.map.thisNote": "esta nota",
  "appshell.map.neighborsSingle": "{count} vecino",
  "appshell.map.neighborsPlural": "{count} vecinos",

  // Links from this note rail
  "appshell.links.title": "Enlaces desde esta nota",

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
    "Desaparecen de la lista. Las versiones anteriores en esta ruta quedan en el historial.",

  // Promote path confirm
  "appshell.promote.title": "¿Promover “{path}” a main?",
  "appshell.promote.bodyEmpty":
    "Esta ruta aún no tiene cambios, así que promoverla solo la archiva. ¿Continuar?",
  "appshell.promote.bodyEditsSingle":
    "{count} nota editada en esta ruta se aplicará a main. La ruta misma será archivada. Esto no se puede deshacer automáticamente (las versiones anteriores quedan en el historial).",
  "appshell.promote.bodyEditsPlural":
    "{count} notas editadas en esta ruta se aplicarán a main. La ruta misma será archivada. Esto no se puede deshacer automáticamente (las versiones anteriores quedan en el historial).",

  // Throw away path confirm
  "appshell.throwAway.title": "¿Descartar “{path}”?",
  "appshell.throwAway.bodyEmpty":
    "Esta ruta aún no tiene cambios. Descartar solo elimina la entrada de la ruta.",
  "appshell.throwAway.bodyEditsSingle":
    "{count} nota editada en esta ruta se perderá. Main no se ve afectada. ¿Continuar?",
  "appshell.throwAway.bodyEditsPlural":
    "{count} notas editadas en esta ruta se perderán. Main no se ve afectada. ¿Continuar?",

  // Confirm-state generic buttons
  "appshell.confirm.keepIt": "conservarla",
  "appshell.confirm.yesDelete": "sí, eliminar",

  // New path modal
  "appshell.newPath.title": "Empezar una nueva ruta",
  "appshell.newPath.intro":
    "Una ruta es un si…. Escribe la pregunta — eso es todo. La versión que tienes ahora queda a salvo en {root}.",
  "appshell.newPath.trunkHint":
    "Cada ruta se ramifica desde {root}. Un tronco, muchas ramas.",
  "appshell.newPath.questionLabel": "la pregunta que hace esta ruta",
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
    "{notes} anteckning · {paths} stig",
  "appshell.workspace.notesPathsSinglePlural":
    "{notes} anteckning · {paths} stigar",
  "appshell.workspace.notesPathsPluralSingle":
    "{notes} anteckningar · {paths} stig",
  "appshell.workspace.notesPathsPluralPlural":
    "{notes} anteckningar · {paths} stigar",

  // Sidebar search trigger + utility row
  "appshell.sidebar.findAnything": "Sök vad som helst",
  "appshell.sidebar.journalLabel": "Journal",
  "appshell.sidebar.journalTitle": "Dagens journalanteckning",
  "appshell.sidebar.activityLabel": "Aktivitet",
  "appshell.sidebar.activityTitle": "Värmekarta för skrivaktivitet",
  "appshell.sidebar.trashLabel": "Papperskorg",
  "appshell.sidebar.trashTitle":
    "Återställ eller ta bort raderade anteckningar permanent",

  // Status bar
  "appshell.status.notes": "{count} anteckningar",
  "appshell.status.paths": "{count} stigar",
  "appshell.status.onPath": "på stig: {path}",
  "appshell.status.onPathNone": "på stig: —",
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

  // Sync pill labels
  "appshell.sync.synced": "synkroniserat",
  "appshell.sync.localChanges": "lokala ändringar",
  "appshell.sync.syncing": "synkroniserar…",
  "appshell.sync.failed": "synkronisering misslyckades",
  "appshell.sync.notAnywhere": "synkroniseras inte någonstans",

  // Toast / dismiss
  "appshell.toast.dismiss": "Avfärda",

  // Print / locked / clipboard / dictionary toasts and errors
  "appshell.toast.printError":
    "Det gick inte att förbereda förhandsvisningen för utskrift: {error}",
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
    "Det gick inte att byta namn: {error}",
  "appshell.toast.tagsError":
    "Det gick inte att uppdatera taggarna: {error}",
  "appshell.toast.annotationSaveError":
    "Det gick inte att spara anteckningen: {error}",
  "appshell.toast.annotationAddError":
    "Det gick inte att lägga till anteckningen: {error}",
  "appshell.toast.kept":
    "Sparat — \"{label}\" kommer att överleva framtida rensning.",
  "appshell.toast.pinError": "Det gick inte att fästa: {error}",
  "appshell.toast.unpinned":
    "Lossad — den här kontrollpunkten är inte längre skyddad mot rensning.",
  "appshell.toast.unpinError": "Det gick inte att lossa: {error}",
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
  "appshell.toast.syncIssue": "Synkroniseringsproblem: {message}",
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
  "appshell.map.notesInPathSingle": "{count} anteckning på den här stigen",
  "appshell.map.notesInPathPlural": "{count} anteckningar på den här stigen",
  "appshell.map.thisNote": "den här anteckningen",
  "appshell.map.neighborsSingle": "{count} granne",
  "appshell.map.neighborsPlural": "{count} grannar",

  // Links from this note rail
  "appshell.links.title": "Länkar från den här anteckningen",

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
    "De försvinner från listan. Tidigare versioner på den här stigen ligger kvar i historiken.",

  // Promote path confirm
  "appshell.promote.title": "Befordra “{path}” till main?",
  "appshell.promote.bodyEmpty":
    "Den här stigen har inga ändringar än, så att befordra den arkiverar bara den. Fortsätt?",
  "appshell.promote.bodyEditsSingle":
    "{count} anteckning som redigerats på den här stigen kommer att tillämpas på main. Stigen själv arkiveras. Detta kan inte ångras automatiskt (äldre versioner ligger kvar i historiken).",
  "appshell.promote.bodyEditsPlural":
    "{count} anteckningar som redigerats på den här stigen kommer att tillämpas på main. Stigen själv arkiveras. Detta kan inte ångras automatiskt (äldre versioner ligger kvar i historiken).",

  // Throw away path confirm
  "appshell.throwAway.title": "Kasta “{path}”?",
  "appshell.throwAway.bodyEmpty":
    "Den här stigen har inga ändringar än. Att kasta den tar bara bort stigposten.",
  "appshell.throwAway.bodyEditsSingle":
    "{count} redigerad anteckning på den här stigen kommer att gå förlorad. Main påverkas inte. Fortsätt?",
  "appshell.throwAway.bodyEditsPlural":
    "{count} redigerade anteckningar på den här stigen kommer att gå förlorade. Main påverkas inte. Fortsätt?",

  // Confirm-state generic buttons
  "appshell.confirm.keepIt": "behåll",
  "appshell.confirm.yesDelete": "ja, ta bort",

  // New path modal
  "appshell.newPath.title": "Starta en ny stig",
  "appshell.newPath.intro":
    "En stig är ett om…. Skriv frågan — det är allt. Versionen du har nu ligger tryggt kvar på {root}.",
  "appshell.newPath.trunkHint":
    "Varje stig förgrenar sig från {root}. En stam, många grenar.",
  "appshell.newPath.questionLabel": "frågan den här stigen ställer",
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
