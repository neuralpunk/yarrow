// Editor surfaces — NoteEditor, Toolbar, HistorySlider, RadialMenu,
// LinearContextMenu, NoteReader, AnnotationsGutter,
// FloatingDirectionCTA, ForkSuggestion, TagBouquet, TagChips.

export const editorEN = {
  // ── NoteEditor ─────────────────────────────────────────────────
  "editor.note.placeholder": "Start writing…",
  "editor.note.titlePlaceholder": "Untitled",
  "editor.note.writtenInThe": "written in the",
  "editor.note.saved": "saved",
  "editor.note.edited": "edited",
  "editor.note.connectsTo": "This note connects to",
  "editor.note.blame": "Written {when} · path {path}",

  // ── Toolbar ────────────────────────────────────────────────────
  "editor.toolbar.editing": "editing…",
  "editor.toolbar.savedJustNow": "saved just now",
  "editor.toolbar.saved": "saved",
  "editor.toolbar.checkpoints": "{count} checkpoints",
  "editor.toolbar.switchPath": "Switch path",
  "editor.toolbar.namePathPrompt": "+ name this path",
  "editor.toolbar.namePathTitle": "What question is this path asking?",
  "editor.toolbar.onlyPath": "your only path",
  "editor.toolbar.backToRoot": "Go back to {root} — the trunk of your thinking",
  "editor.toolbar.backArrow": "← {root}",
  "editor.toolbar.branchThis": "Branch this",
  "editor.toolbar.branchThisTitle": "Start a path from this note ({shortcut})",
  "editor.toolbar.connectionsMap": "Connections Map",
  "editor.toolbar.connectionsMapTitle": "Open the connections map",
  "editor.toolbar.paths": "Paths",
  "editor.toolbar.pathsTitle": "Open the paths graph",
  "editor.toolbar.compare": "Compare",
  "editor.toolbar.compareTitle": "Compare two paths side by side",
  "editor.toolbar.openPathsGraph": "Open the paths graph",
  "editor.toolbar.journalJump": "Jump to another day — creates the entry if it doesn't exist yet",

  // Zen / focus chip
  "editor.toolbar.zenLabel": "Zen mode",
  "editor.toolbar.zenTitle": "Zen mode is on — distraction-free writing",
  "editor.toolbar.zenExit": "exit",
  "editor.toolbar.zenExitTitle": "Exit zen mode ({shortcut})",

  // Path switcher dropdown
  "editor.pathSwitcher.placeholder": "Switch path · {count} available",
  "editor.pathSwitcher.backToRoot": "← Back to {root}",
  "editor.pathSwitcher.backToRootTitle": "Jump back to the trunk",
  "editor.pathSwitcher.noMatches": "No paths match.",
  "editor.pathSwitcher.you": "YOU",
  "editor.pathSwitcher.main": "MAIN",
  "editor.pathSwitcher.unnamedPath": "unnamed path",
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
  "editor.history.checkpointsOne": "{count} checkpoint on this path · ↑/↓ to scrub · esc to close",
  "editor.history.checkpointsOther": "{count} checkpoints on this path · ↑/↓ to scrub · esc to close",
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
    "The Still Point · tap for palette · hold for constellation · double-click for zen mode",

  // Radial items (insert variant — no selection)
  "editor.radial.insert.wikilink": "Wikilink",
  "editor.radial.insert.wikilinkSub": "[[ … ]]",
  "editor.radial.insert.table": "Table",
  "editor.radial.insert.tableSub": "rows × cols",
  "editor.radial.insert.task": "Task",
  "editor.radial.insert.taskSub": "- [ ]",
  "editor.radial.insert.code": "Code",
  "editor.radial.insert.codeSub": "``` block",
  "editor.radial.insert.callout": "Callout",
  "editor.radial.insert.calloutSub": "note, tip, warning…",
  "editor.radial.insert.heading": "Heading",
  "editor.radial.insert.headingSub": "#",

  // Radial items (selection variant)
  "editor.radial.selection.wikilink": "Wikilink",
  "editor.radial.selection.wikilinkSub": "replace",
  "editor.radial.selection.newPath": "New path",
  "editor.radial.selection.newPathSub": "from this",
  "editor.radial.selection.bold": "Bold",
  "editor.radial.selection.boldSub": "**…**",
  "editor.radial.selection.italic": "Italic",
  "editor.radial.selection.italicSub": "*…*",
  "editor.radial.selection.annotate": "Annotate",
  "editor.radial.selection.annotateSub": "margin ink",
  "editor.radial.selection.scratchpad": "Scratchpad",
  "editor.radial.selection.scratchpadSub": "send to",
  "editor.radial.selection.copy": "Copy",
  "editor.radial.selection.copySub": "⌘C",

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

  // ── FloatingDirectionCTA ──────────────────────────────────────
  "editor.directionCta.label": "Try another version",
  "editor.directionCta.title": "Try another version ({shortcut})",

  // ── ForkSuggestion ────────────────────────────────────────────
  "editor.forkSuggestion.title": "Explore a different direction?",
  "editor.forkSuggestion.body":
    "This paragraph sounds like it's pulling against what came before. You can branch off to try it out without losing the current take.",
  "editor.forkSuggestion.accept": "Yes, explore it",
  "editor.forkSuggestion.dismiss": "Not now",

  // ── TagBouquet ────────────────────────────────────────────────
  "editor.tagBouquet.suggested": "Suggested",
  "editor.tagBouquet.addTitle": "Add #{tag}",
  "editor.tagBouquet.dismiss": "not now",
  "editor.tagBouquet.dismissTitle": "Hide suggestions for this note",

  // ── TagChips ──────────────────────────────────────────────────
  "editor.tagChips.addTags": "+ add tags",
  "editor.tagChips.addTagsTitle": "Click to add tags",
  "editor.tagChips.addTagPlaceholder": "+ tag",
  "editor.tagChips.removeTitle": "Remove #{tag}",
  "editor.tagChips.removeAria": "Remove tag {tag}",
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
  "editor.note.blame": "Escrito {when} · ruta {path}",

  // Toolbar
  "editor.toolbar.editing": "editando…",
  "editor.toolbar.savedJustNow": "guardado justo ahora",
  "editor.toolbar.saved": "guardado",
  "editor.toolbar.checkpoints": "{count} puntos de control",
  "editor.toolbar.switchPath": "Cambiar de ruta",
  "editor.toolbar.namePathPrompt": "+ nombrar esta ruta",
  "editor.toolbar.namePathTitle": "¿Qué pregunta plantea esta ruta?",
  "editor.toolbar.onlyPath": "tu única ruta",
  "editor.toolbar.backToRoot": "Volver a {root} — el tronco de tu pensamiento",
  "editor.toolbar.backArrow": "← {root}",
  "editor.toolbar.branchThis": "Ramificar esto",
  "editor.toolbar.branchThisTitle": "Iniciar una ruta desde esta nota ({shortcut})",
  "editor.toolbar.connectionsMap": "Mapa de conexiones",
  "editor.toolbar.connectionsMapTitle": "Abrir el mapa de conexiones",
  "editor.toolbar.paths": "Rutas",
  "editor.toolbar.pathsTitle": "Abrir el grafo de rutas",
  "editor.toolbar.compare": "Comparar",
  "editor.toolbar.compareTitle": "Comparar dos rutas lado a lado",
  "editor.toolbar.openPathsGraph": "Abrir el grafo de rutas",
  "editor.toolbar.journalJump":
    "Saltar a otro día — crea la entrada si aún no existe",

  // Zen / focus chip
  "editor.toolbar.zenLabel": "Modo zen",
  "editor.toolbar.zenTitle": "El modo zen está activo — escritura sin distracciones",
  "editor.toolbar.zenExit": "salir",
  "editor.toolbar.zenExitTitle": "Salir del modo zen ({shortcut})",

  // Path switcher
  "editor.pathSwitcher.placeholder": "Cambiar de ruta · {count} disponibles",
  "editor.pathSwitcher.backToRoot": "← Volver a {root}",
  "editor.pathSwitcher.backToRootTitle": "Volver al tronco",
  "editor.pathSwitcher.noMatches": "Ninguna ruta coincide.",
  "editor.pathSwitcher.you": "TÚ",
  "editor.pathSwitcher.main": "PRINCIPAL",
  "editor.pathSwitcher.unnamedPath": "ruta sin nombre",
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
    "{count} punto de control en esta ruta · ↑/↓ para recorrer · esc para cerrar",
  "editor.history.checkpointsOther":
    "{count} puntos de control en esta ruta · ↑/↓ para recorrer · esc para cerrar",
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
    "El Punto Quieto · toca para abrir la paleta · mantén para constelación · doble clic para modo zen",

  // Radial items — insertar
  "editor.radial.insert.wikilink": "Wikilink",
  "editor.radial.insert.wikilinkSub": "[[ … ]]",
  "editor.radial.insert.table": "Tabla",
  "editor.radial.insert.tableSub": "filas × columnas",
  "editor.radial.insert.task": "Tarea",
  "editor.radial.insert.taskSub": "- [ ]",
  "editor.radial.insert.code": "Código",
  "editor.radial.insert.codeSub": "``` bloque",
  "editor.radial.insert.callout": "Destacado",
  "editor.radial.insert.calloutSub": "nota, consejo, advertencia…",
  "editor.radial.insert.heading": "Encabezado",
  "editor.radial.insert.headingSub": "#",

  // Radial items — selección
  "editor.radial.selection.wikilink": "Wikilink",
  "editor.radial.selection.wikilinkSub": "reemplazar",
  "editor.radial.selection.newPath": "Nueva ruta",
  "editor.radial.selection.newPathSub": "desde esto",
  "editor.radial.selection.bold": "Negrita",
  "editor.radial.selection.boldSub": "**…**",
  "editor.radial.selection.italic": "Cursiva",
  "editor.radial.selection.italicSub": "*…*",
  "editor.radial.selection.annotate": "Anotar",
  "editor.radial.selection.annotateSub": "tinta al margen",
  "editor.radial.selection.scratchpad": "Bloc",
  "editor.radial.selection.scratchpadSub": "enviar al",
  "editor.radial.selection.copy": "Copiar",
  "editor.radial.selection.copySub": "⌘C",

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

  // FloatingDirectionCTA
  "editor.directionCta.label": "Probar otra versión",
  "editor.directionCta.title": "Probar otra versión ({shortcut})",

  // ForkSuggestion
  "editor.forkSuggestion.title": "¿Explorar una dirección distinta?",
  "editor.forkSuggestion.body":
    "Este párrafo parece tirar contra lo que vino antes. Puedes ramificarlo y probarlo sin perder la versión actual.",
  "editor.forkSuggestion.accept": "Sí, explorar",
  "editor.forkSuggestion.dismiss": "Ahora no",

  // TagBouquet
  "editor.tagBouquet.suggested": "Sugeridas",
  "editor.tagBouquet.addTitle": "Añadir #{tag}",
  "editor.tagBouquet.dismiss": "ahora no",
  "editor.tagBouquet.dismissTitle": "Ocultar sugerencias para esta nota",

  // TagChips
  "editor.tagChips.addTags": "+ añadir etiquetas",
  "editor.tagChips.addTagsTitle": "Haz clic para añadir etiquetas",
  "editor.tagChips.addTagPlaceholder": "+ etiqueta",
  "editor.tagChips.removeTitle": "Quitar #{tag}",
  "editor.tagChips.removeAria": "Quitar etiqueta {tag}",
};

export const editorSV: Record<EditorKey, string> = {
  // NoteEditor
  "editor.note.placeholder": "Börja skriva…",
  "editor.note.titlePlaceholder": "Namnlös",
  "editor.note.writtenInThe": "skrivet på",
  "editor.note.saved": "sparat",
  "editor.note.edited": "redigerad",
  "editor.note.connectsTo": "Den här anteckningen kopplar till",
  "editor.note.blame": "Skrivet {when} · stig {path}",

  // Toolbar
  "editor.toolbar.editing": "redigerar…",
  "editor.toolbar.savedJustNow": "sparat just nu",
  "editor.toolbar.saved": "sparat",
  "editor.toolbar.checkpoints": "{count} kontrollpunkter",
  "editor.toolbar.switchPath": "Byt stig",
  "editor.toolbar.namePathPrompt": "+ namnge den här stigen",
  "editor.toolbar.namePathTitle": "Vilken fråga ställer den här stigen?",
  "editor.toolbar.onlyPath": "din enda stig",
  "editor.toolbar.backToRoot": "Tillbaka till {root} — tankarnas stam",
  "editor.toolbar.backArrow": "← {root}",
  "editor.toolbar.branchThis": "Förgrena den här",
  "editor.toolbar.branchThisTitle":
    "Starta en stig från den här anteckningen ({shortcut})",
  "editor.toolbar.connectionsMap": "Kopplingskarta",
  "editor.toolbar.connectionsMapTitle": "Öppna kopplingskartan",
  "editor.toolbar.paths": "Stigar",
  "editor.toolbar.pathsTitle": "Öppna stiggrafen",
  "editor.toolbar.compare": "Jämför",
  "editor.toolbar.compareTitle": "Jämför två stigar sida vid sida",
  "editor.toolbar.openPathsGraph": "Öppna stiggrafen",
  "editor.toolbar.journalJump":
    "Hoppa till en annan dag — skapar inlägget om det inte finns",

  // Zen / focus chip
  "editor.toolbar.zenLabel": "Zen-läge",
  "editor.toolbar.zenTitle": "Zen-läge är på — distraktionsfritt skrivande",
  "editor.toolbar.zenExit": "avsluta",
  "editor.toolbar.zenExitTitle": "Avsluta zen-läge ({shortcut})",

  // Path switcher
  "editor.pathSwitcher.placeholder": "Byt stig · {count} tillgängliga",
  "editor.pathSwitcher.backToRoot": "← Tillbaka till {root}",
  "editor.pathSwitcher.backToRootTitle": "Hoppa tillbaka till stammen",
  "editor.pathSwitcher.noMatches": "Ingen stig matchar.",
  "editor.pathSwitcher.you": "DU",
  "editor.pathSwitcher.main": "HUVUD",
  "editor.pathSwitcher.unnamedPath": "namnlös stig",
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
    "{count} kontrollpunkt på den här stigen · ↑/↓ för att skrolla · esc för att stänga",
  "editor.history.checkpointsOther":
    "{count} kontrollpunkter på den här stigen · ↑/↓ för att skrolla · esc för att stänga",
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
    "Den stilla punkten · tryck för palett · håll för konstellation · dubbelklicka för zen-läge",

  // Radial items — infoga
  "editor.radial.insert.wikilink": "Wikilink",
  "editor.radial.insert.wikilinkSub": "[[ … ]]",
  "editor.radial.insert.table": "Tabell",
  "editor.radial.insert.tableSub": "rader × kolumner",
  "editor.radial.insert.task": "Uppgift",
  "editor.radial.insert.taskSub": "- [ ]",
  "editor.radial.insert.code": "Kod",
  "editor.radial.insert.codeSub": "``` block",
  "editor.radial.insert.callout": "Framhävning",
  "editor.radial.insert.calloutSub": "anteckning, tips, varning…",
  "editor.radial.insert.heading": "Rubrik",
  "editor.radial.insert.headingSub": "#",

  // Radial items — markering
  "editor.radial.selection.wikilink": "Wikilink",
  "editor.radial.selection.wikilinkSub": "ersätt",
  "editor.radial.selection.newPath": "Ny stig",
  "editor.radial.selection.newPathSub": "från det här",
  "editor.radial.selection.bold": "Fet",
  "editor.radial.selection.boldSub": "**…**",
  "editor.radial.selection.italic": "Kursiv",
  "editor.radial.selection.italicSub": "*…*",
  "editor.radial.selection.annotate": "Annotera",
  "editor.radial.selection.annotateSub": "marginalanteckning",
  "editor.radial.selection.scratchpad": "Anteckningsblock",
  "editor.radial.selection.scratchpadSub": "skicka till",
  "editor.radial.selection.copy": "Kopiera",
  "editor.radial.selection.copySub": "⌘C",

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

  // FloatingDirectionCTA
  "editor.directionCta.label": "Pröva en annan version",
  "editor.directionCta.title": "Pröva en annan version ({shortcut})",

  // ForkSuggestion
  "editor.forkSuggestion.title": "Utforska en annan riktning?",
  "editor.forkSuggestion.body":
    "Det här stycket verkar dra mot det som kom innan. Du kan förgrena dig och pröva utan att förlora den nuvarande versionen.",
  "editor.forkSuggestion.accept": "Ja, utforska",
  "editor.forkSuggestion.dismiss": "Inte nu",

  // TagBouquet
  "editor.tagBouquet.suggested": "Föreslagna",
  "editor.tagBouquet.addTitle": "Lägg till #{tag}",
  "editor.tagBouquet.dismiss": "inte nu",
  "editor.tagBouquet.dismissTitle": "Dölj förslag för den här anteckningen",

  // TagChips
  "editor.tagChips.addTags": "+ lägg till taggar",
  "editor.tagChips.addTagsTitle": "Klicka för att lägga till taggar",
  "editor.tagChips.addTagPlaceholder": "+ tagg",
  "editor.tagChips.removeTitle": "Ta bort #{tag}",
  "editor.tagChips.removeAria": "Ta bort tagg {tag}",
};
