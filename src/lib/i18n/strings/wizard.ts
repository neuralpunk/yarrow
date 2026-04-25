// NewWorkspaceWizard surface — multi-step blank/import/sample flow.
//
// The wizard has two pages ("shape" then "details"), four import
// sources (Obsidian / Bear / Logseq / Notion), and a small handful of
// inline status/error strings. Brand names stay verbatim.

export const wizardEN = {
  // Header
  "wizard.title": "Create a workspace",
  "wizard.subtitle.shape":
    "Start from scratch, or bring notes you already have.",
  "wizard.subtitle.details":
    "Name it, place it, and choose how it should behave.",
  "wizard.stepIndicator": "Step {current} of {total}",

  // Step 1 — shape
  "wizard.shape.blank.title": "Start with a blank notebook",
  "wizard.shape.blank.body":
    "A fresh workspace. You'll seed it with a starting note, then branch from there.",
  "wizard.shape.import.title": "Import from another app",
  "wizard.shape.import.statusPickSource": "pick a source",
  "wizard.shape.import.statusFolderSelected": "{source} folder selected",
  "wizard.shape.import.body":
    "Copy your notes in. {wikilinks} and {tags} are preserved; per-app config folders are skipped.",
  "wizard.shape.import.pickFolder": "Browse for folder…",
  "wizard.shape.import.pickAnotherFolder": "Pick a different folder…",
  "wizard.shape.import.folderSelectedHint":
    "folder selected — you can also re-pick",
  "wizard.shape.alreadyMarkdown":
    "Already have plain markdown? It drops in fine — point Yarrow at that folder after creating the workspace.",

  // Import source taglines + pick-help (shown beneath the buttons)
  "wizard.import.obsidian.tagline":
    "a folder of .md files, often with a hidden .obsidian/ sibling",
  "wizard.import.obsidian.pickHelp": "Pick the folder that IS your vault.",
  "wizard.import.bear.tagline":
    "an exported folder of .md files — no frontmatter, tags live inline",
  "wizard.import.bear.pickHelp":
    "Pick the folder Bear's Markdown export created.",
  "wizard.import.logseq.tagline":
    "a graph folder containing pages/ and journals/ subfolders",
  "wizard.import.logseq.pickHelp":
    "Pick the top-level graph folder (with pages/).",
  "wizard.import.notion.tagline":
    "the extracted Markdown & CSV export — Notion IDs get stripped",
  "wizard.import.notion.pickHelp":
    "Pick the folder you extracted from Notion's export zip.",

  // Step 2 — details
  "wizard.details.nameLabel": "Workspace name",
  "wizard.details.namePlaceholder": "e.g. Garden plan, Research, Personal",
  "wizard.details.locationLabel": "Where it lives",
  "wizard.details.locationBrowse": "Browse…",
  "wizard.details.willCreate": "Will create:",
  "wizard.details.modeLabel": "How will you use it?",
  "wizard.details.mode.mapped.title": "Branch path mapping",
  "wizard.details.mode.mapped.body":
    "Notes connect, paths fork, your map grows.",
  "wizard.details.mode.basic.title": "Basic notes",
  "wizard.details.mode.basic.body":
    "Plain markdown jotter. No paths, no graph.",
  "wizard.details.startingNoteLabel": "Starting note",
  "wizard.details.startingNotePlaceholder":
    "The first note everything else will branch from",
  "wizard.details.importBanner":
    "Importing from {source}: {path}. A single checkpoint will record the import so you can roll back if it doesn't look right.",

  // Errors
  "wizard.error.pickSourceFolder": "Pick the source folder to continue.",
  "wizard.error.pickLocation": "Pick a location for the new workspace.",
  "wizard.error.giveName": "Give the workspace a name.",
  "wizard.error.nameStartingNote":
    "Name the starting note — it's the seed of your map.",

  // Progress (live status during creation/import)
  "wizard.progress.creatingFolder": "Creating folder…",
  "wizard.progress.initializing": "Initializing workspace…",
  "wizard.progress.importing": "Importing your {source} vault…",
  "wizard.progress.importedOne": "Imported 1 note from {source}.",
  "wizard.progress.importedMany": "Imported {count} notes from {source}.",

  // Buttons (shared)
  "wizard.button.cancel": "Cancel",
  "wizard.button.next": "Next →",
  "wizard.button.back": "← Back",
  "wizard.button.create": "Create workspace",
  "wizard.button.creating": "Creating…",
} as const;

export type WizardKey = keyof typeof wizardEN;

export const wizardES: Record<WizardKey, string> = {
  // Header
  "wizard.title": "Crear un espacio de trabajo",
  "wizard.subtitle.shape":
    "Empieza desde cero o trae notas que ya tienes.",
  "wizard.subtitle.details":
    "Ponle nombre, elige dónde vive y decide cómo debe comportarse.",
  "wizard.stepIndicator": "Paso {current} de {total}",

  // Step 1 — shape
  "wizard.shape.blank.title": "Empezar con un cuaderno en blanco",
  "wizard.shape.blank.body":
    "Un espacio de trabajo nuevo. Lo siembras con una nota inicial y luego ramificas desde ahí.",
  "wizard.shape.import.title": "Importar desde otra aplicación",
  "wizard.shape.import.statusPickSource": "elige una fuente",
  "wizard.shape.import.statusFolderSelected":
    "carpeta de {source} seleccionada",
  "wizard.shape.import.body":
    "Copia tus notas. Se conservan {wikilinks} y {tags}; las carpetas de configuración propias de cada aplicación se omiten.",
  "wizard.shape.import.pickFolder": "Examinar una carpeta…",
  "wizard.shape.import.pickAnotherFolder": "Elegir otra carpeta…",
  "wizard.shape.import.folderSelectedHint":
    "carpeta seleccionada — también puede volver a elegir",
  "wizard.shape.alreadyMarkdown":
    "¿Ya tiene markdown plano? Funciona sin problema: indique a Yarrow esa carpeta después de crear el espacio de trabajo.",

  // Import source taglines + pick-help
  "wizard.import.obsidian.tagline":
    "una carpeta con archivos .md, a menudo con una carpeta hermana oculta .obsidian/",
  "wizard.import.obsidian.pickHelp":
    "Elija la carpeta que ES su bóveda.",
  "wizard.import.bear.tagline":
    "una carpeta exportada de archivos .md: sin frontmatter, las etiquetas están en línea",
  "wizard.import.bear.pickHelp":
    "Elija la carpeta que creó la exportación Markdown de Bear.",
  "wizard.import.logseq.tagline":
    "una carpeta de grafo que contiene subcarpetas pages/ y journals/",
  "wizard.import.logseq.pickHelp":
    "Elija la carpeta de grafo de nivel superior (la que tiene pages/).",
  "wizard.import.notion.tagline":
    "la exportación extraída de Markdown y CSV: los IDs de Notion se eliminan",
  "wizard.import.notion.pickHelp":
    "Elija la carpeta que extrajo del zip de exportación de Notion.",

  // Step 2 — details
  "wizard.details.nameLabel": "Nombre del espacio de trabajo",
  "wizard.details.namePlaceholder":
    "p. ej. Plan del jardín, Investigación, Personal",
  "wizard.details.locationLabel": "Dónde vive",
  "wizard.details.locationBrowse": "Examinar…",
  "wizard.details.willCreate": "Se creará:",
  "wizard.details.modeLabel": "¿Cómo lo va a usar?",
  "wizard.details.mode.mapped.title": "Mapeo con rutas que se ramifican",
  "wizard.details.mode.mapped.body":
    "Las notas se conectan, las rutas se ramifican, su mapa crece.",
  "wizard.details.mode.basic.title": "Notas básicas",
  "wizard.details.mode.basic.body":
    "Bloc de markdown plano. Sin rutas, sin grafo.",
  "wizard.details.startingNoteLabel": "Nota inicial",
  "wizard.details.startingNotePlaceholder":
    "La primera nota de la que ramificará todo lo demás",
  "wizard.details.importBanner":
    "Importando desde {source}: {path}. Un único checkpoint registrará la importación para que pueda revertirla si no se ve bien.",

  // Errors
  "wizard.error.pickSourceFolder":
    "Elija la carpeta de origen para continuar.",
  "wizard.error.pickLocation":
    "Elija una ubicación para el nuevo espacio de trabajo.",
  "wizard.error.giveName": "Ponga un nombre al espacio de trabajo.",
  "wizard.error.nameStartingNote":
    "Ponga un nombre a la nota inicial — es la semilla de su mapa.",

  // Progress
  "wizard.progress.creatingFolder": "Creando carpeta…",
  "wizard.progress.initializing": "Inicializando espacio de trabajo…",
  "wizard.progress.importing": "Importando su bóveda de {source}…",
  "wizard.progress.importedOne": "Se importó 1 nota desde {source}.",
  "wizard.progress.importedMany": "Se importaron {count} notas desde {source}.",

  // Buttons
  "wizard.button.cancel": "Cancelar",
  "wizard.button.next": "Siguiente →",
  "wizard.button.back": "← Atrás",
  "wizard.button.create": "Crear espacio de trabajo",
  "wizard.button.creating": "Creando…",
};

export const wizardSV: Record<WizardKey, string> = {
  // Header
  "wizard.title": "Skapa en arbetsyta",
  "wizard.subtitle.shape":
    "Börja från noll, eller ta med anteckningar du redan har.",
  "wizard.subtitle.details":
    "Ge den ett namn, placera den och välj hur den ska bete sig.",
  "wizard.stepIndicator": "Steg {current} av {total}",

  // Step 1 — shape
  "wizard.shape.blank.title": "Börja med en tom anteckningsbok",
  "wizard.shape.blank.body":
    "En tom arbetsyta. Du sår den med en startanteckning och förgrenar dig sedan därifrån.",
  "wizard.shape.import.title": "Importera från en annan app",
  "wizard.shape.import.statusPickSource": "välj en källa",
  "wizard.shape.import.statusFolderSelected": "{source}-mapp vald",
  "wizard.shape.import.body":
    "Kopiera in dina anteckningar. {wikilinks} och {tags} bevaras; appspecifika konfigurationsmappar hoppas över.",
  "wizard.shape.import.pickFolder": "Bläddra efter mapp…",
  "wizard.shape.import.pickAnotherFolder": "Välj en annan mapp…",
  "wizard.shape.import.folderSelectedHint":
    "mapp vald — du kan också välja om",
  "wizard.shape.alreadyMarkdown":
    "Har du redan vanlig markdown? Det fungerar fint — peka Yarrow mot den mappen när du har skapat arbetsytan.",

  // Import source taglines + pick-help
  "wizard.import.obsidian.tagline":
    "en mapp med .md-filer, ofta med en dold .obsidian/-systermapp",
  "wizard.import.obsidian.pickHelp":
    "Välj mappen som ÄR ditt valv.",
  "wizard.import.bear.tagline":
    "en exporterad mapp med .md-filer — ingen frontmatter, taggar ligger inuti texten",
  "wizard.import.bear.pickHelp":
    "Välj mappen som Bears Markdown-export skapade.",
  "wizard.import.logseq.tagline":
    "en grafmapp som innehåller undermapparna pages/ och journals/",
  "wizard.import.logseq.pickHelp":
    "Välj den översta grafmappen (den med pages/).",
  "wizard.import.notion.tagline":
    "den uppackade Markdown- och CSV-exporten — Notion-ID:n tas bort",
  "wizard.import.notion.pickHelp":
    "Välj mappen du packade upp från Notions exportzip.",

  // Step 2 — details
  "wizard.details.nameLabel": "Arbetsytans namn",
  "wizard.details.namePlaceholder":
    "t.ex. Trädgårdsplan, Forskning, Personligt",
  "wizard.details.locationLabel": "Var den ligger",
  "wizard.details.locationBrowse": "Bläddra…",
  "wizard.details.willCreate": "Kommer att skapa:",
  "wizard.details.modeLabel": "Hur ska du använda den?",
  "wizard.details.mode.mapped.title": "Förgrenande stigkartläggning",
  "wizard.details.mode.mapped.body":
    "Anteckningar kopplas, stigar förgrenas, din karta växer.",
  "wizard.details.mode.basic.title": "Grundläggande anteckningar",
  "wizard.details.mode.basic.body":
    "En vanlig markdown-anteckningsbok. Inga stigar, ingen graf.",
  "wizard.details.startingNoteLabel": "Startanteckning",
  "wizard.details.startingNotePlaceholder":
    "Den första anteckningen som allt annat förgrenas från",
  "wizard.details.importBanner":
    "Importerar från {source}: {path}. En enda checkpoint registrerar importen så att du kan rulla tillbaka om det inte ser rätt ut.",

  // Errors
  "wizard.error.pickSourceFolder": "Välj källmappen för att fortsätta.",
  "wizard.error.pickLocation":
    "Välj en plats för den nya arbetsytan.",
  "wizard.error.giveName": "Ge arbetsytan ett namn.",
  "wizard.error.nameStartingNote":
    "Namnge startanteckningen — den är fröet till din karta.",

  // Progress
  "wizard.progress.creatingFolder": "Skapar mapp…",
  "wizard.progress.initializing": "Initierar arbetsyta…",
  "wizard.progress.importing": "Importerar ditt {source}-valv…",
  "wizard.progress.importedOne": "Importerade 1 anteckning från {source}.",
  "wizard.progress.importedMany":
    "Importerade {count} anteckningar från {source}.",

  // Buttons
  "wizard.button.cancel": "Avbryt",
  "wizard.button.next": "Nästa →",
  "wizard.button.back": "← Tillbaka",
  "wizard.button.create": "Skapa arbetsyta",
  "wizard.button.creating": "Skapar…",
};
