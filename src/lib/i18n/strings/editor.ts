// Editor surfaces — NoteEditor, Toolbar, HistorySlider, RadialMenu,
// LinearContextMenu, NoteReader, AnnotationsGutter,
// ForkSuggestion, TagBouquet, TagChips.

export const editorEN = {
  // ── NoteEditor ─────────────────────────────────────────────────
  "editor.note.placeholder": "Start writing…",
  "editor.note.titlePlaceholder": "Untitled",
  "editor.note.writtenInThe": "written in the",
  "editor.note.saved": "saved",
  "editor.note.edited": "edited",
  "editor.note.connectsTo": "This note connects to",
  "editor.note.blame": "Written {when} · scenario {path}",

  // ── Toolbar ────────────────────────────────────────────────────
  "editor.toolbar.editing": "editing…",
  "editor.toolbar.savedJustNow": "saved just now",
  "editor.toolbar.saved": "saved",
  "editor.toolbar.checkpoints": "{count} checkpoints",
  "editor.toolbar.switchPath": "Switch scenario",
  "editor.toolbar.back": "Back",
  "editor.toolbar.backAria": "Go back to the previously open note",
  "editor.toolbar.backTitle": "Back to “{title}” ({shortcut})",
  "editor.toolbar.backTitleEmpty": "Back to the previous note ({shortcut})",
  "editor.toolbar.namePathPrompt": "+ name this scenario",
  "editor.toolbar.namePathTitle": "What question is this scenario asking?",
  "editor.toolbar.onlyPath": "your only scenario",
  "editor.toolbar.backToRoot": "Go back to {root} — the trunk of your thinking",
  "editor.toolbar.backArrow": "← {root}",
  "editor.toolbar.branchThis": "Start a scenario",
  "editor.toolbar.branchThisTitle": "Start a scenario from this note ({shortcut})",
  "editor.toolbar.connectionsMap": "Connections Map",
  "editor.toolbar.connectionsMapTitle": "Open the connections map",
  "editor.toolbar.paths": "Scenarios",
  "editor.toolbar.pathsTitle": "Open the scenarios graph",
  "editor.toolbar.compare": "Compare",
  "editor.toolbar.compareTitle": "Compare two scenarios side by side",
  "editor.toolbar.openPathsGraph": "Open the scenarios graph",
  "editor.toolbar.journalJump": "Jump to another day — creates the entry if it doesn't exist yet",

  // Zen / focus chip
  "editor.toolbar.zenLabel": "Zen mode",
  "editor.toolbar.zenTitle": "Zen mode is on — distraction-free writing",
  "editor.toolbar.zenExit": "exit",
  "editor.toolbar.zenExitTitle": "Exit zen mode ({shortcut})",

  // Path switcher dropdown
  "editor.pathSwitcher.placeholder": "Switch scenario · {count} available",
  "editor.pathSwitcher.backToRoot": "← Back to {root}",
  "editor.pathSwitcher.backToRootTitle": "Jump back to the trunk",
  "editor.pathSwitcher.noMatches": "No scenarios match.",
  "editor.pathSwitcher.you": "YOU",
  "editor.pathSwitcher.main": "MAIN",
  "editor.pathSwitcher.unnamedPath": "unnamed scenario",
  "editor.pathSwitcher.notesCountOne": "{count} note",
  "editor.pathSwitcher.notesCountOther": "{count} notes",
  "editor.pathSwitcher.ghostsHeader": "ghosts · past eras",
  "editor.pathSwitcher.wasMain": "WAS MAIN",
  "editor.pathSwitcher.ghostNotesOne": "ghost · {count} note",
  "editor.pathSwitcher.ghostNotesOther": "ghost · {count} notes",

  // ── HistorySlider ──────────────────────────────────────────────
  "editor.history.bucket.today": "Today",
  "editor.history.bucket.yesterday": "Yesterday",
  "editor.history.bucket.earlierThisWeek": "Earlier this week",
  "editor.history.bucket.thisMonth": "This month",
  "editor.history.checkpointsOne": "{count} checkpoint on this scenario · ↑/↓ to scrub · esc to close",
  "editor.history.checkpointsOther": "{count} checkpoints on this scenario · ↑/↓ to scrub · esc to close",
  "editor.history.showDiffOnly": "show differences only",
  "editor.history.close": "Close",
  "editor.history.now": "Now",
  "editor.history.latest": "latest",
  "editor.history.kept": "kept",
  "editor.history.pinnedAs": "pinned: {label}",
  "editor.history.previewing": "Previewing",
  "editor.history.addedSince": "+{count} since",
  "editor.history.addedSinceTitle": "Lines that exist now but didn't then",
  "editor.history.removedGone": "−{count} gone",
  "editor.history.removedGoneTitle": "Lines that existed then but not now",
  "editor.history.identical": "identical to now",
  "editor.history.pickFromTimeline": "Pick a checkpoint from the timeline",
  "editor.history.noDifferences": "No differences from the current version.",
  "editor.history.empty": "(empty)",
  "editor.history.thinkingPrefix": "what you were thinking: “{thinking}”",
  "editor.history.currentVersion": "This is the current version.",
  "editor.history.goingBack": "Going back {when}",
  "editor.history.noSelection": "No checkpoint selected",
  "editor.history.unpin": "★ unpin",
  "editor.history.unpinTitle": "Unpin \"{label}\". The checkpoint can be pruned again after this.",
  "editor.history.pinThis": "☆ pin this",
  "editor.history.pinThisTitle": "Pin this checkpoint — history pruning will never remove it.",
  "editor.history.cancel": "cancel",
  "editor.history.restore": "Restore this version",
  "editor.history.restoreTitle": "Restore this version",
  "editor.history.alreadyCurrentTitle": "Already the current version",
  "editor.history.pinDialog.title": "Pin this checkpoint",
  "editor.history.pinDialog.body":
    "It'll survive any future pruning — older-than, empty-content, anything. Give it a short name so future-you remembers why.",
  "editor.history.pinDialog.labelPlaceholder": "e.g. before I cut the prologue",
  "editor.history.pinDialog.notePlaceholder": "Optional: what made this version worth keeping?",
  "editor.history.pinDialog.confirm": "pin it",
  "editor.history.confirm.title": "Go back to this version?",
  "editor.history.confirm.bodyLead":
    "Your current note will be replaced with the version from",
  "editor.history.confirm.bodyTail":
    "Nothing is lost — the current version stays in history, and you can always scrub forward to it again.",
  "editor.history.confirm.yesRestore": "yes, restore",

  // ── RadialMenu ────────────────────────────────────────────────
  "editor.radial.stillPointTitle":
    "The Still Point · tap for palette · hold for the Quick Hand · double-click for zen mode",

  // Radial / linear menu — submenu / modal parents
  "editor.radial.parent.inserts": "Inserts…",
  "editor.radial.parent.insertsSub": "task, table, callout…",
  "editor.radial.parent.format": "Format…",
  "editor.radial.parent.formatSub": "heading, code, bold…",

  // Radial / linear menu — clipboard + structural verbs
  "editor.radial.action.cut": "Cut",
  "editor.radial.action.cutSub": "⌘X",
  "editor.radial.action.copy": "Copy",
  "editor.radial.action.copySub": "⌘C",
  "editor.radial.action.paste": "Paste",
  "editor.radial.action.pasteSub": "⌘V",
  "editor.radial.action.selectAll": "Select All",
  "editor.radial.action.selectAllSub": "⌘A",
  "editor.radial.action.scratchpad": "Scratch Pad",
  "editor.radial.action.scratchpadSub": "send to",
  "editor.radial.action.annotate": "Annotate",
  "editor.radial.action.annotateSub": "margin ink",

  // Submenu items inside Inserts… (linear) / shared with the Inserts modal
  "editor.radial.insert.wikilink": "Wikilink",
  "editor.radial.insert.wikilinkSub": "[[ … ]]",
  "editor.radial.insert.task": "Task",
  "editor.radial.insert.taskSub": "- [ ]",
  "editor.radial.insert.table": "Table",
  "editor.radial.insert.tableSub": "rows × cols",
  "editor.radial.insert.callout": "Callout",
  "editor.radial.insert.calloutSub": "note, tip, warning…",
  "editor.radial.insert.timer": "Timer",
  "editor.radial.insert.timerSub": "10m, 15m, 1h…",
  "editor.radial.insert.clipRecipe": "Clip recipe",
  "editor.radial.insert.clipRecipeSub": "from a URL",
  "editor.radial.insert.shoppingList": "To shopping list",
  "editor.radial.insert.shoppingListSub": "this note's ingredients",

  // Submenu items inside Format… (linear) / shared with the Format modal
  "editor.radial.insert.heading": "Heading",
  "editor.radial.insert.headingSub": "#",
  "editor.radial.insert.code": "Code Block",
  "editor.radial.insert.codeSub": "``` block",
  "editor.radial.format.bold": "Bold",
  "editor.radial.format.boldSub": "**…**",
  "editor.radial.format.italic": "Italic",
  "editor.radial.format.italicSub": "*…*",
  "editor.radial.format.strikethrough": "Strikethrough",
  "editor.radial.format.strikethroughSub": "~~…~~",
  "editor.radial.format.math": "Math",
  "editor.radial.format.mathSub": "$ … $",

  // ── NoteReader ────────────────────────────────────────────────
  "editor.reader.editorialPlain": "plain",
  "editor.reader.editorial": "editorial",
  "editor.reader.editorialOnTitle": "Switch to plain reading",
  "editor.reader.editorialOffTitle":
    "Switch to editorial reading — drop caps, pull quotes, generous leading",
  "editor.reader.switchToWriting": "switch to writing",
  "editor.reader.couldNotRender": "Couldn't render: {error}",
  "editor.reader.showingSaved":
    "Showing the saved version — switch to writing to see your unsaved edits.",

  // ── AnnotationsGutter ─────────────────────────────────────────
  "editor.annotations.note": "note",
  "editor.annotations.removeTitle": "Remove this annotation",
  "editor.annotations.removeAria": "Remove annotation",
  "editor.annotations.empty": "empty — click to write",

  // ── ForkSuggestion ────────────────────────────────────────────
  "editor.forkSuggestion.title": "Explore a different direction?",
  "editor.forkSuggestion.body":
    "This paragraph sounds like it's pulling against what came before. You can open a new scenario to try it out without losing the current take.",
  "editor.forkSuggestion.accept": "Yes, explore it",
  "editor.forkSuggestion.dismiss": "Not now",

  // ── TagBouquet ────────────────────────────────────────────────
  "editor.tagBouquet.suggested": "Suggested",
  "editor.tagBouquet.addTitle": "Add #{tag}",
  "editor.tagBouquet.dismiss": "not now",
  "editor.tagBouquet.dismissTitle": "Hide suggestions for this note",
  "editor.tagBouquet.more": "+{count} more",
  "editor.tagBouquet.moreTitle": "Show {count} more suggestions",

  // ── TagChips ──────────────────────────────────────────────────
  "editor.tagChips.addTags": "+ add tags",
  "editor.tagChips.addTagsTitle": "Click to add tags",
  "editor.tagChips.addTagPlaceholder": "+ tag",
  "editor.tagChips.removeTitle": "Remove #{tag}",
  "editor.tagChips.removeAria": "Remove tag {tag}",

  // ── Drafts (Pillar 2) ─────────────────────────────────────────
  // Drafts are alternative bodies for one note — sketchpad versions
  // the user can hold alongside the canonical text without inventing
  // a whole new note. Tab strip sits above the editor.
  "editor.drafts.main": "main",
  "editor.drafts.mainTitle": "The canonical version of this note",
  "editor.drafts.newDraft": "+ draft",
  "editor.drafts.newDraftTitle": "Start a new draft from the current text",
  "editor.drafts.newDraftPrompt": "Name this draft",
  "editor.drafts.newDraftDefault": "rough",
  "editor.drafts.tabTitle": "Switch to draft “{name}”",
  "editor.drafts.activeBadge": "DRAFT",
  "editor.drafts.activeNotice": "Editing a draft. Saves stay here until you keep it.",
  "editor.drafts.keep": "Keep this draft",
  "editor.drafts.keepTitle": "Replace the main note with this draft",
  "editor.drafts.keepConfirm": "Replace the main note with this draft? The current main version will be in history.",
  "editor.drafts.discard": "Discard this draft",
  "editor.drafts.discardTitle": "Throw this draft away — there's no undo",
  "editor.drafts.discardConfirm": "Discard draft “{name}”? This can't be undone.",
  "editor.drafts.rename": "Rename",
  "editor.drafts.renameTitle": "Rename this draft",
  "editor.drafts.renamePrompt": "New name for this draft",
  "editor.drafts.menuAria": "Draft actions",
  "editor.drafts.newDraftModalTitle": "Name this draft",
  "editor.drafts.newDraftModalLead":
    "A draft is a private parallel pass at this note. Saves stay in the draft until you keep it. Give it a short name so you can tell drafts apart later.",
  "editor.drafts.renameModalTitle": "Rename this draft",
  "editor.drafts.renameModalLead":
    "Pick a name that tells you what this draft is for at a glance.",
  "editor.drafts.namePlaceholder": "rough",
  "editor.drafts.modalCancel": "cancel",
  "editor.drafts.modalCreate": "start draft",
  "editor.drafts.modalSave": "save name",
} as const;

export type EditorKey = keyof typeof editorEN;

export const editorES: Record<EditorKey, string> = {
  // NoteEditor
  "editor.note.placeholder": "Comienza a escribir…",
  "editor.note.titlePlaceholder": "Sin título",
  "editor.note.writtenInThe": "escrito en la",
  "editor.note.saved": "guardado",
  "editor.note.edited": "editado",
  "editor.note.connectsTo": "Esta nota conecta con",
  "editor.note.blame": "Escrito {when} · escenario {path}",

  // Toolbar
  "editor.toolbar.editing": "editando…",
  "editor.toolbar.savedJustNow": "guardado justo ahora",
  "editor.toolbar.saved": "guardado",
  "editor.toolbar.checkpoints": "{count} puntos de control",
  "editor.toolbar.switchPath": "Cambiar de escenario",
  "editor.toolbar.back": "Atrás",
  "editor.toolbar.backAria": "Volver a la nota abierta anteriormente",
  "editor.toolbar.backTitle": "Volver a «{title}» ({shortcut})",
  "editor.toolbar.backTitleEmpty": "Volver a la nota anterior ({shortcut})",
  "editor.toolbar.namePathPrompt": "+ nombrar este escenario",
  "editor.toolbar.namePathTitle": "¿Qué pregunta plantea este escenario?",
  "editor.toolbar.onlyPath": "tu único escenario",
  "editor.toolbar.backToRoot": "Volver a {root} — el tronco de tu pensamiento",
  "editor.toolbar.backArrow": "← {root}",
  "editor.toolbar.branchThis": "Iniciar un escenario",
  "editor.toolbar.branchThisTitle": "Iniciar un escenario desde esta nota ({shortcut})",
  "editor.toolbar.connectionsMap": "Mapa de conexiones",
  "editor.toolbar.connectionsMapTitle": "Abrir el mapa de conexiones",
  "editor.toolbar.paths": "Escenarios",
  "editor.toolbar.pathsTitle": "Abrir el grafo de escenarios",
  "editor.toolbar.compare": "Comparar",
  "editor.toolbar.compareTitle": "Comparar dos escenarios lado a lado",
  "editor.toolbar.openPathsGraph": "Abrir el grafo de escenarios",
  "editor.toolbar.journalJump":
    "Saltar a otro día — crea la entrada si aún no existe",

  // Zen / focus chip
  "editor.toolbar.zenLabel": "Modo zen",
  "editor.toolbar.zenTitle": "El modo zen está activo — escritura sin distracciones",
  "editor.toolbar.zenExit": "salir",
  "editor.toolbar.zenExitTitle": "Salir del modo zen ({shortcut})",

  // Path switcher
  "editor.pathSwitcher.placeholder": "Cambiar de escenario · {count} disponibles",
  "editor.pathSwitcher.backToRoot": "← Volver a {root}",
  "editor.pathSwitcher.backToRootTitle": "Volver al tronco",
  "editor.pathSwitcher.noMatches": "Ningún escenario coincide.",
  "editor.pathSwitcher.you": "TÚ",
  "editor.pathSwitcher.main": "PRINCIPAL",
  "editor.pathSwitcher.unnamedPath": "escenario sin nombre",
  "editor.pathSwitcher.notesCountOne": "{count} nota",
  "editor.pathSwitcher.notesCountOther": "{count} notas",
  "editor.pathSwitcher.ghostsHeader": "fantasmas · épocas pasadas",
  "editor.pathSwitcher.wasMain": "FUE PRINCIPAL",
  "editor.pathSwitcher.ghostNotesOne": "fantasma · {count} nota",
  "editor.pathSwitcher.ghostNotesOther": "fantasma · {count} notas",

  // HistorySlider
  "editor.history.bucket.today": "Hoy",
  "editor.history.bucket.yesterday": "Ayer",
  "editor.history.bucket.earlierThisWeek": "Antes esta semana",
  "editor.history.bucket.thisMonth": "Este mes",
  "editor.history.checkpointsOne":
    "{count} punto de control en este escenario · ↑/↓ para recorrer · esc para cerrar",
  "editor.history.checkpointsOther":
    "{count} puntos de control en este escenario · ↑/↓ para recorrer · esc para cerrar",
  "editor.history.showDiffOnly": "mostrar solo las diferencias",
  "editor.history.close": "Cerrar",
  "editor.history.now": "Ahora",
  "editor.history.latest": "más reciente",
  "editor.history.kept": "guardado",
  "editor.history.pinnedAs": "fijado: {label}",
  "editor.history.previewing": "Vista previa",
  "editor.history.addedSince": "+{count} desde entonces",
  "editor.history.addedSinceTitle": "Líneas que existen ahora pero antes no",
  "editor.history.removedGone": "−{count} desaparecidas",
  "editor.history.removedGoneTitle": "Líneas que existían entonces pero ya no",
  "editor.history.identical": "idéntico al actual",
  "editor.history.pickFromTimeline": "Elige un punto de control de la línea de tiempo",
  "editor.history.noDifferences": "No hay diferencias con la versión actual.",
  "editor.history.empty": "(vacío)",
  "editor.history.thinkingPrefix": "lo que estabas pensando: “{thinking}”",
  "editor.history.currentVersion": "Esta es la versión actual.",
  "editor.history.goingBack": "Volviendo {when}",
  "editor.history.noSelection": "Ningún punto de control seleccionado",
  "editor.history.unpin": "★ desfijar",
  "editor.history.unpinTitle":
    "Desfijar \"{label}\". El punto de control podrá podarse de nuevo después.",
  "editor.history.pinThis": "☆ fijar este",
  "editor.history.pinThisTitle":
    "Fijar este punto de control — la poda del historial nunca lo eliminará.",
  "editor.history.cancel": "cancelar",
  "editor.history.restore": "Restaurar esta versión",
  "editor.history.restoreTitle": "Restaurar esta versión",
  "editor.history.alreadyCurrentTitle": "Ya es la versión actual",
  "editor.history.pinDialog.title": "Fijar este punto de control",
  "editor.history.pinDialog.body":
    "Sobrevivirá a cualquier poda futura — antigüedad, contenido vacío, lo que sea. Dale un nombre corto para que el yo del futuro recuerde por qué.",
  "editor.history.pinDialog.labelPlaceholder": "p. ej. antes de cortar el prólogo",
  "editor.history.pinDialog.notePlaceholder":
    "Opcional: ¿qué hizo que esta versión valiera la pena conservar?",
  "editor.history.pinDialog.confirm": "fijarlo",
  "editor.history.confirm.title": "¿Volver a esta versión?",
  "editor.history.confirm.bodyLead":
    "Tu nota actual será reemplazada por la versión del",
  "editor.history.confirm.bodyTail":
    "Nada se pierde — la versión actual queda en el historial y siempre puedes avanzar de nuevo hasta ella.",
  "editor.history.confirm.yesRestore": "sí, restaurar",

  // RadialMenu
  "editor.radial.stillPointTitle":
    "El Punto Quieto · toca para la paleta · mantén para la Mano Rápida · doble clic para modo zen",

  "editor.radial.parent.inserts": "Insertar…",
  "editor.radial.parent.insertsSub": "tarea, tabla, destacado…",
  "editor.radial.parent.format": "Formato…",
  "editor.radial.parent.formatSub": "encabezado, código, negrita…",

  "editor.radial.action.cut": "Cortar",
  "editor.radial.action.cutSub": "⌘X",
  "editor.radial.action.copy": "Copiar",
  "editor.radial.action.copySub": "⌘C",
  "editor.radial.action.paste": "Pegar",
  "editor.radial.action.pasteSub": "⌘V",
  "editor.radial.action.selectAll": "Seleccionar todo",
  "editor.radial.action.selectAllSub": "⌘A",
  "editor.radial.action.scratchpad": "Borrador",
  "editor.radial.action.scratchpadSub": "enviar al",
  "editor.radial.action.annotate": "Anotar",
  "editor.radial.action.annotateSub": "tinta al margen",

  "editor.radial.insert.wikilink": "Wikilink",
  "editor.radial.insert.wikilinkSub": "[[ … ]]",
  "editor.radial.insert.task": "Tarea",
  "editor.radial.insert.taskSub": "- [ ]",
  "editor.radial.insert.table": "Tabla",
  "editor.radial.insert.tableSub": "filas × columnas",
  "editor.radial.insert.callout": "Destacado",
  "editor.radial.insert.calloutSub": "nota, consejo, advertencia…",
  "editor.radial.insert.timer": "Temporizador",
  "editor.radial.insert.timerSub": "10m, 15m, 1h…",
  "editor.radial.insert.clipRecipe": "Importar receta",
  "editor.radial.insert.clipRecipeSub": "desde una URL",
  "editor.radial.insert.shoppingList": "A la lista",
  "editor.radial.insert.shoppingListSub": "ingredientes de la nota",

  "editor.radial.insert.heading": "Encabezado",
  "editor.radial.insert.headingSub": "#",
  "editor.radial.insert.code": "Bloque de código",
  "editor.radial.insert.codeSub": "``` bloque",
  "editor.radial.format.bold": "Negrita",
  "editor.radial.format.boldSub": "**…**",
  "editor.radial.format.italic": "Cursiva",
  "editor.radial.format.italicSub": "*…*",
  "editor.radial.format.strikethrough": "Tachado",
  "editor.radial.format.strikethroughSub": "~~…~~",
  "editor.radial.format.math": "Matemáticas",
  "editor.radial.format.mathSub": "$ … $",

  // NoteReader
  "editor.reader.editorialPlain": "simple",
  "editor.reader.editorial": "editorial",
  "editor.reader.editorialOnTitle": "Cambiar a lectura simple",
  "editor.reader.editorialOffTitle":
    "Cambiar a lectura editorial — capitulares, citas destacadas, interlineado generoso",
  "editor.reader.switchToWriting": "cambiar a escritura",
  "editor.reader.couldNotRender": "No se pudo mostrar: {error}",
  "editor.reader.showingSaved":
    "Mostrando la versión guardada — cambia a escritura para ver tus ediciones sin guardar.",

  // AnnotationsGutter
  "editor.annotations.note": "nota",
  "editor.annotations.removeTitle": "Eliminar esta anotación",
  "editor.annotations.removeAria": "Eliminar anotación",
  "editor.annotations.empty": "vacío — haz clic para escribir",

  // ForkSuggestion
  "editor.forkSuggestion.title": "¿Explorar una dirección distinta?",
  "editor.forkSuggestion.body":
    "Este párrafo parece tirar contra lo que vino antes. Puedes abrir una nuevo escenario para probarlo sin perder la versión actual.",
  "editor.forkSuggestion.accept": "Sí, explorar",
  "editor.forkSuggestion.dismiss": "Ahora no",

  // TagBouquet
  "editor.tagBouquet.suggested": "Sugeridas",
  "editor.tagBouquet.addTitle": "Añadir #{tag}",
  "editor.tagBouquet.dismiss": "ahora no",
  "editor.tagBouquet.dismissTitle": "Ocultar sugerencias para esta nota",
  "editor.tagBouquet.more": "+{count} más",
  "editor.tagBouquet.moreTitle": "Mostrar {count} sugerencias más",

  // TagChips
  "editor.tagChips.addTags": "+ añadir etiquetas",
  "editor.tagChips.addTagsTitle": "Haz clic para añadir etiquetas",
  "editor.tagChips.addTagPlaceholder": "+ etiqueta",
  "editor.tagChips.removeTitle": "Quitar #{tag}",
  "editor.tagChips.removeAria": "Quitar etiqueta {tag}",

  // Drafts
  "editor.drafts.main": "principal",
  "editor.drafts.mainTitle": "La versión canónica de esta nota",
  "editor.drafts.newDraft": "+ borrador",
  "editor.drafts.newDraftTitle": "Empieza un borrador nuevo desde el texto actual",
  "editor.drafts.newDraftPrompt": "Nombra este borrador",
  "editor.drafts.newDraftDefault": "borrador",
  "editor.drafts.tabTitle": "Cambia al borrador «{name}»",
  "editor.drafts.activeBadge": "BORRADOR",
  "editor.drafts.activeNotice": "Editando un borrador. Lo que guardes se queda aquí hasta que lo conserves.",
  "editor.drafts.keep": "Conservar este borrador",
  "editor.drafts.keepTitle": "Reemplaza la nota principal con este borrador",
  "editor.drafts.keepConfirm": "¿Reemplazar la nota principal con este borrador? La versión actual seguirá en el historial.",
  "editor.drafts.discard": "Descartar este borrador",
  "editor.drafts.discardTitle": "Tira este borrador — no hay deshacer",
  "editor.drafts.discardConfirm": "¿Descartar el borrador «{name}»? No se puede deshacer.",
  "editor.drafts.rename": "Renombrar",
  "editor.drafts.renameTitle": "Renombrar este borrador",
  "editor.drafts.renamePrompt": "Nuevo nombre para este borrador",
  "editor.drafts.menuAria": "Acciones del borrador",
  "editor.drafts.newDraftModalTitle": "Nombra este borrador",
  "editor.drafts.newDraftModalLead":
    "Un borrador es una pasada paralela y privada de esta nota. Lo que guardes se queda en el borrador hasta que lo conserves. Dale un nombre corto para distinguir borradores luego.",
  "editor.drafts.renameModalTitle": "Renombrar este borrador",
  "editor.drafts.renameModalLead":
    "Elige un nombre que te diga de un vistazo para qué es este borrador.",
  "editor.drafts.namePlaceholder": "rápido",
  "editor.drafts.modalCancel": "cancelar",
  "editor.drafts.modalCreate": "iniciar borrador",
  "editor.drafts.modalSave": "guardar nombre",
};

export const editorSV: Record<EditorKey, string> = {
  // NoteEditor
  "editor.note.placeholder": "Börja skriva…",
  "editor.note.titlePlaceholder": "Namnlös",
  "editor.note.writtenInThe": "skrivet på",
  "editor.note.saved": "sparat",
  "editor.note.edited": "redigerad",
  "editor.note.connectsTo": "Den här anteckningen kopplar till",
  "editor.note.blame": "Skrivet {when} · scenario {path}",

  // Toolbar
  "editor.toolbar.editing": "redigerar…",
  "editor.toolbar.savedJustNow": "sparat just nu",
  "editor.toolbar.saved": "sparat",
  "editor.toolbar.checkpoints": "{count} kontrollpunkter",
  "editor.toolbar.switchPath": "Byt scenario",
  "editor.toolbar.back": "Tillbaka",
  "editor.toolbar.backAria": "Gå tillbaka till föregående anteckning",
  "editor.toolbar.backTitle": "Tillbaka till ”{title}” ({shortcut})",
  "editor.toolbar.backTitleEmpty": "Tillbaka till föregående anteckning ({shortcut})",
  "editor.toolbar.namePathPrompt": "+ namnge det här scenariot",
  "editor.toolbar.namePathTitle": "Vilken fråga ställer det här scenariot?",
  "editor.toolbar.onlyPath": "ditt enda scenario",
  "editor.toolbar.backToRoot": "Tillbaka till {root} — tankarnas stam",
  "editor.toolbar.backArrow": "← {root}",
  "editor.toolbar.branchThis": "Starta ett scenario",
  "editor.toolbar.branchThisTitle":
    "Starta ett scenario från den här anteckningen ({shortcut})",
  "editor.toolbar.connectionsMap": "Kopplingskarta",
  "editor.toolbar.connectionsMapTitle": "Öppna kopplingskartan",
  "editor.toolbar.paths": "Scenarier",
  "editor.toolbar.pathsTitle": "Öppna scenariografen",
  "editor.toolbar.compare": "Jämför",
  "editor.toolbar.compareTitle": "Jämför två scenarier sida vid sida",
  "editor.toolbar.openPathsGraph": "Öppna scenariografen",
  "editor.toolbar.journalJump":
    "Hoppa till en annan dag — skapar inlägget om det inte finns",

  // Zen / focus chip
  "editor.toolbar.zenLabel": "Zen-läge",
  "editor.toolbar.zenTitle": "Zen-läge är på — distraktionsfritt skrivande",
  "editor.toolbar.zenExit": "avsluta",
  "editor.toolbar.zenExitTitle": "Avsluta zen-läge ({shortcut})",

  // Path switcher
  "editor.pathSwitcher.placeholder": "Byt scenario · {count} tillgängliga",
  "editor.pathSwitcher.backToRoot": "← Tillbaka till {root}",
  "editor.pathSwitcher.backToRootTitle": "Hoppa tillbaka till stammen",
  "editor.pathSwitcher.noMatches": "Inget scenario matchar.",
  "editor.pathSwitcher.you": "DU",
  "editor.pathSwitcher.main": "HUVUD",
  "editor.pathSwitcher.unnamedPath": "namnlöst scenario",
  "editor.pathSwitcher.notesCountOne": "{count} anteckning",
  "editor.pathSwitcher.notesCountOther": "{count} anteckningar",
  "editor.pathSwitcher.ghostsHeader": "spöken · gångna epoker",
  "editor.pathSwitcher.wasMain": "VAR HUVUD",
  "editor.pathSwitcher.ghostNotesOne": "spöke · {count} anteckning",
  "editor.pathSwitcher.ghostNotesOther": "spöke · {count} anteckningar",

  // HistorySlider
  "editor.history.bucket.today": "Idag",
  "editor.history.bucket.yesterday": "Igår",
  "editor.history.bucket.earlierThisWeek": "Tidigare i veckan",
  "editor.history.bucket.thisMonth": "Den här månaden",
  "editor.history.checkpointsOne":
    "{count} kontrollpunkt i det här scenariot · ↑/↓ för att skrolla · esc för att stänga",
  "editor.history.checkpointsOther":
    "{count} kontrollpunkter i det här scenariot · ↑/↓ för att skrolla · esc för att stänga",
  "editor.history.showDiffOnly": "visa endast skillnader",
  "editor.history.close": "Stäng",
  "editor.history.now": "Nu",
  "editor.history.latest": "senaste",
  "editor.history.kept": "behållen",
  "editor.history.pinnedAs": "fäst: {label}",
  "editor.history.previewing": "Förhandsgranskar",
  "editor.history.addedSince": "+{count} sedan dess",
  "editor.history.addedSinceTitle": "Rader som finns nu men inte då",
  "editor.history.removedGone": "−{count} borta",
  "editor.history.removedGoneTitle": "Rader som fanns då men inte nu",
  "editor.history.identical": "identisk med nuvarande",
  "editor.history.pickFromTimeline": "Välj en kontrollpunkt från tidslinjen",
  "editor.history.noDifferences": "Inga skillnader mot nuvarande version.",
  "editor.history.empty": "(tom)",
  "editor.history.thinkingPrefix": "vad du tänkte: ”{thinking}”",
  "editor.history.currentVersion": "Det här är den nuvarande versionen.",
  "editor.history.goingBack": "Går tillbaka {when}",
  "editor.history.noSelection": "Ingen kontrollpunkt vald",
  "editor.history.unpin": "★ lossa",
  "editor.history.unpinTitle":
    "Lossa \"{label}\". Kontrollpunkten kan beskäras igen efter detta.",
  "editor.history.pinThis": "☆ fäst den här",
  "editor.history.pinThisTitle":
    "Fäst den här kontrollpunkten — historikens beskärning tar aldrig bort den.",
  "editor.history.cancel": "avbryt",
  "editor.history.restore": "Återställ den här versionen",
  "editor.history.restoreTitle": "Återställ den här versionen",
  "editor.history.alreadyCurrentTitle": "Redan den nuvarande versionen",
  "editor.history.pinDialog.title": "Fäst den här kontrollpunkten",
  "editor.history.pinDialog.body":
    "Den överlever all framtida beskärning — äldre-än, tomt-innehåll, vad som helst. Ge den ett kort namn så att framtida-du minns varför.",
  "editor.history.pinDialog.labelPlaceholder": "t.ex. innan jag tog bort prologen",
  "editor.history.pinDialog.notePlaceholder":
    "Valfritt: vad gjorde den här versionen värd att behålla?",
  "editor.history.pinDialog.confirm": "fäst den",
  "editor.history.confirm.title": "Gå tillbaka till den här versionen?",
  "editor.history.confirm.bodyLead":
    "Din nuvarande anteckning ersätts med versionen från",
  "editor.history.confirm.bodyTail":
    "Inget går förlorat — den nuvarande versionen finns kvar i historiken och du kan alltid skrolla framåt till den igen.",
  "editor.history.confirm.yesRestore": "ja, återställ",

  // RadialMenu
  "editor.radial.stillPointTitle":
    "Den stilla punkten · tryck för palett · håll för Snabbhanden · dubbelklicka för zen-läge",

  "editor.radial.parent.inserts": "Infoga…",
  "editor.radial.parent.insertsSub": "uppgift, tabell, framhävning…",
  "editor.radial.parent.format": "Formatera…",
  "editor.radial.parent.formatSub": "rubrik, kod, fet…",

  "editor.radial.action.cut": "Klipp ut",
  "editor.radial.action.cutSub": "⌘X",
  "editor.radial.action.copy": "Kopiera",
  "editor.radial.action.copySub": "⌘C",
  "editor.radial.action.paste": "Klistra in",
  "editor.radial.action.pasteSub": "⌘V",
  "editor.radial.action.selectAll": "Markera allt",
  "editor.radial.action.selectAllSub": "⌘A",
  "editor.radial.action.scratchpad": "Skissblock",
  "editor.radial.action.scratchpadSub": "skicka till",
  "editor.radial.action.annotate": "Annotera",
  "editor.radial.action.annotateSub": "marginalanteckning",

  "editor.radial.insert.wikilink": "Wikilink",
  "editor.radial.insert.wikilinkSub": "[[ … ]]",
  "editor.radial.insert.task": "Uppgift",
  "editor.radial.insert.taskSub": "- [ ]",
  "editor.radial.insert.table": "Tabell",
  "editor.radial.insert.tableSub": "rader × kolumner",
  "editor.radial.insert.callout": "Framhävning",
  "editor.radial.insert.calloutSub": "anteckning, tips, varning…",
  "editor.radial.insert.timer": "Timer",
  "editor.radial.insert.timerSub": "10m, 15m, 1h…",
  "editor.radial.insert.clipRecipe": "Klipp recept",
  "editor.radial.insert.clipRecipeSub": "från en URL",
  "editor.radial.insert.shoppingList": "Till listan",
  "editor.radial.insert.shoppingListSub": "anteckningens ingredienser",

  "editor.radial.insert.heading": "Rubrik",
  "editor.radial.insert.headingSub": "#",
  "editor.radial.insert.code": "Kodblock",
  "editor.radial.insert.codeSub": "``` block",
  "editor.radial.format.bold": "Fet",
  "editor.radial.format.boldSub": "**…**",
  "editor.radial.format.italic": "Kursiv",
  "editor.radial.format.italicSub": "*…*",
  "editor.radial.format.strikethrough": "Genomstruken",
  "editor.radial.format.strikethroughSub": "~~…~~",
  "editor.radial.format.math": "Matematik",
  "editor.radial.format.mathSub": "$ … $",

  // NoteReader
  "editor.reader.editorialPlain": "enkel",
  "editor.reader.editorial": "redaktionell",
  "editor.reader.editorialOnTitle": "Byt till enkel läsning",
  "editor.reader.editorialOffTitle":
    "Byt till redaktionell läsning — anfanger, framhävda citat, generös radmatning",
  "editor.reader.switchToWriting": "byt till skrivande",
  "editor.reader.couldNotRender": "Kunde inte återge: {error}",
  "editor.reader.showingSaved":
    "Visar den sparade versionen — byt till skrivande för att se dina osparade ändringar.",

  // AnnotationsGutter
  "editor.annotations.note": "anteckning",
  "editor.annotations.removeTitle": "Ta bort den här marginalanteckningen",
  "editor.annotations.removeAria": "Ta bort marginalanteckning",
  "editor.annotations.empty": "tom — klicka för att skriva",

  // ForkSuggestion
  "editor.forkSuggestion.title": "Utforska en annan riktning?",
  "editor.forkSuggestion.body":
    "Det här stycket verkar dra mot det som kom innan. Du kan öppna ett nytt scenario och pröva utan att förlora den nuvarande versionen.",
  "editor.forkSuggestion.accept": "Ja, utforska",
  "editor.forkSuggestion.dismiss": "Inte nu",

  // TagBouquet
  "editor.tagBouquet.suggested": "Föreslagna",
  "editor.tagBouquet.addTitle": "Lägg till #{tag}",
  "editor.tagBouquet.dismiss": "inte nu",
  "editor.tagBouquet.dismissTitle": "Dölj förslag för den här anteckningen",
  "editor.tagBouquet.more": "+{count} till",
  "editor.tagBouquet.moreTitle": "Visa {count} fler förslag",

  // TagChips
  "editor.tagChips.addTags": "+ lägg till taggar",
  "editor.tagChips.addTagsTitle": "Klicka för att lägga till taggar",
  "editor.tagChips.addTagPlaceholder": "+ tagg",
  "editor.tagChips.removeTitle": "Ta bort #{tag}",
  "editor.tagChips.removeAria": "Ta bort tagg {tag}",

  // Drafts
  "editor.drafts.main": "huvudversion",
  "editor.drafts.mainTitle": "Den kanoniska versionen av den här anteckningen",
  "editor.drafts.newDraft": "+ utkast",
  "editor.drafts.newDraftTitle": "Starta ett nytt utkast från den nuvarande texten",
  "editor.drafts.newDraftPrompt": "Namnge det här utkastet",
  "editor.drafts.newDraftDefault": "utkast",
  "editor.drafts.tabTitle": "Byt till utkastet ”{name}”",
  "editor.drafts.activeBadge": "UTKAST",
  "editor.drafts.activeNotice": "Redigerar ett utkast. Det du sparar stannar här tills du behåller det.",
  "editor.drafts.keep": "Behåll det här utkastet",
  "editor.drafts.keepTitle": "Ersätt huvudanteckningen med det här utkastet",
  "editor.drafts.keepConfirm": "Ersätta huvudanteckningen med det här utkastet? Den nuvarande versionen finns kvar i historiken.",
  "editor.drafts.discard": "Förkasta det här utkastet",
  "editor.drafts.discardTitle": "Släng det här utkastet — det går inte att ångra",
  "editor.drafts.discardConfirm": "Förkasta utkastet ”{name}”? Det kan inte ångras.",
  "editor.drafts.rename": "Byt namn",
  "editor.drafts.renameTitle": "Byt namn på det här utkastet",
  "editor.drafts.renamePrompt": "Nytt namn för det här utkastet",
  "editor.drafts.menuAria": "Utkaståtgärder",
  "editor.drafts.newDraftModalTitle": "Namnge det här utkastet",
  "editor.drafts.newDraftModalLead":
    "Ett utkast är en privat parallell version av den här anteckningen. Det du sparar stannar i utkastet tills du behåller det. Ge det ett kort namn så kan du skilja utkast åt senare.",
  "editor.drafts.renameModalTitle": "Byt namn på utkastet",
  "editor.drafts.renameModalLead":
    "Välj ett namn som direkt säger vad det här utkastet är till för.",
  "editor.drafts.namePlaceholder": "ung",
  "editor.drafts.modalCancel": "avbryt",
  "editor.drafts.modalCreate": "starta utkast",
  "editor.drafts.modalSave": "spara namn",
};
