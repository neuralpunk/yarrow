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
    "A fresh workspace. You'll seed it with a starting note, then open scenarios from there.",
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
  "wizard.details.mode.mapped.title": "Scenario mapping",
  "wizard.details.mode.mapped.body":
    "Notes connect, scenarios open, your map grows.",
  "wizard.details.mode.basic.title": "Basic notes",
  "wizard.details.mode.basic.body":
    "Plain markdown jotter. No scenarios, no graph.",
  "wizard.details.startingNoteLabel": "Starting note",
  "wizard.details.startingNotePlaceholder":
    "The first note every scenario will open from",
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

  // ─── 3.0 redesign — guided 4-step + polished 2-step ───────
  // Modal eyebrow + breadcrumbs.
  "wizard.eyebrow.firstRun": "Welcome to Yarrow",
  "wizard.eyebrow.return": "New workspace",
  "wizard.crumb.start": "Start",
  "wizard.crumb.name": "Name",
  "wizard.crumb.location": "Location",
  "wizard.crumb.shape": "Shape",
  "wizard.crumb.details": "Details",
  "wizard.button.begin": "Begin",
  "wizard.button.skip": "Skip the tour",

  // Step 1 (guided) — Starting point
  "wizard.guide.start.title": "Where would you like to begin?",
  "wizard.guide.start.body":
    "Yarrow notebooks are folders on disk. You can start with a blank one, or bring notes you already keep somewhere else — Yarrow will copy them in and leave the original alone.",
  "wizard.guide.start.blank.title": "A fresh notebook",
  "wizard.guide.start.blank.body":
    "Begin with one starting note. Every scenario will open from there.",
  "wizard.guide.start.import.title": "Bring notes I already have",
  "wizard.guide.start.import.body":
    "Copy from Obsidian, Bear, Logseq, or Notion. Wikilinks and tags carry over; the originals stay untouched.",
  "wizard.guide.start.clone.title": "Clone from a git URL",
  "wizard.guide.start.clone.body":
    "Already have a Yarrow notebook synced to GitHub, GitLab, or another git host? Paste the URL — we'll pull it down and verify it's a real Yarrow workspace before opening.",
  "wizard.clone.urlLabel": "Git URL",
  "wizard.clone.urlPlaceholder": "git@github.com:you/my-notebook.git",
  "wizard.clone.help":
    "SSH URLs use your local ssh-agent. Public HTTPS URLs work too. Token-protected HTTPS isn't supported in the wizard yet — use SSH for private notebooks.",
  "wizard.clone.gateNote":
    "Yarrow only opens notebooks with a valid .yarrow/config.toml — unrelated remotes will be rejected and removed.",
  "wizard.error.giveUrl": "Paste the git URL of an existing Yarrow workspace.",
  "wizard.progress.cloning": "Cloning workspace…",
  "wizard.progress.cloned": "Cloned and validated.",

  // Step 2 (guided) — Name
  "wizard.guide.name.title": "What should we call it?",
  "wizard.guide.name.body":
    "Give the notebook a name you'll recognise on the Recent list. You can rename it later — this is only a label.",
  "wizard.guide.name.previewLabel": "It will appear as",

  // Step 3 (guided) — Location
  "wizard.guide.location.title": "Where should it live on disk?",
  "wizard.guide.location.body":
    "Pick the parent folder. Yarrow will create a fresh folder inside with the notebook's name. Anywhere your file backups reach is a fine place to put it.",
  "wizard.guide.location.willCreate": "Final folder path",

  // Step 4 (guided) — Shape
  "wizard.guide.shape.title": "How will you use it?",
  "wizard.guide.shape.body":
    "Yarrow can either map every direction your thinking takes, or stay quiet and out of the way. Either is fine — you can change your mind from Settings any time.",
  "wizard.guide.shape.startingNoteHint":
    "We'll seed the notebook with this first note so you have somewhere to start.",
  "wizard.guide.shape.personaIntro":
    "Optional. Pick a craft and the right rail and command palette will lean into the tools that fit it. You can change this any time from Settings → Modes & Personas.",
  "wizard.guide.shape.personaNone.label": "No persona",
  "wizard.guide.shape.personaNone.desc":
    "Just Scenario-Based — the full Yarrow surface, nothing biased.",

  // Quick (2-step) flavor — used by returning users.
  "wizard.quick.step1.title": "What kind of notebook?",
  "wizard.quick.step1.body":
    "Start blank or copy from another app. Pick a name now or after — both are fine.",
  "wizard.quick.step2.title": "Place it and shape it",
  "wizard.quick.step2.body":
    "Pick where it lives on disk and how Yarrow should behave inside it. Scenario mapping is the default; Basic stays out of the way.",

  // Friendly inline cues (used in both flows)
  "wizard.tip.iconLetter": "i",
  "wizard.tip.preserved": "Wikilinks and tags carry over",
  "wizard.tip.skippedConfig":
    "Per-app config folders (.obsidian/, .logseq/, etc.) are skipped",
  "wizard.tip.checkpointed":
    "The whole import is one checkpoint — undo it any time",

  // Empty / progress / error wrappers (re-use the existing keys above
  // for the actual messages; this is just the framing copy that wraps
  // them in the redesigned chrome).
  "wizard.progress.title": "Setting things up",
  "wizard.error.label": "Something didn't work",
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
  "wizard.details.mode.mapped.title": "Mapeo con escenarios que se ramifican",
  "wizard.details.mode.mapped.body":
    "Las notas se conectan, las escenarios se ramifican, su mapa crece.",
  "wizard.details.mode.basic.title": "Notas básicas",
  "wizard.details.mode.basic.body":
    "Bloc de markdown plano. Sin escenarios, sin grafo.",
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

  // 3.0 redesign — guided 4-step + polished 2-step
  "wizard.eyebrow.firstRun": "Bienvenido a Yarrow",
  "wizard.eyebrow.return": "Nuevo espacio de trabajo",
  "wizard.crumb.start": "Inicio",
  "wizard.crumb.name": "Nombre",
  "wizard.crumb.location": "Ubicación",
  "wizard.crumb.shape": "Forma",
  "wizard.crumb.details": "Detalles",
  "wizard.button.begin": "Comenzar",
  "wizard.button.skip": "Saltar la guía",

  "wizard.guide.start.title": "¿Por dónde te gustaría empezar?",
  "wizard.guide.start.body":
    "Los cuadernos de Yarrow son carpetas en disco. Puedes empezar con una en blanco o traer notas que ya guardes en otro sitio — Yarrow las copia y deja las originales intactas.",
  "wizard.guide.start.blank.title": "Un cuaderno nuevo",
  "wizard.guide.start.blank.body":
    "Empieza con una sola nota inicial. Todo lo demás se ramificará desde ahí.",
  "wizard.guide.start.import.title": "Traer notas que ya tengo",
  "wizard.guide.start.import.body":
    "Copia desde Obsidian, Bear, Logseq o Notion. Los wikilinks y las etiquetas se conservan; los originales no se tocan.",

  "wizard.guide.name.title": "¿Cómo lo llamamos?",
  "wizard.guide.name.body":
    "Dale un nombre que reconozcas en la lista de Recientes. Puedes cambiarlo más tarde — es solo una etiqueta.",
  "wizard.guide.name.previewLabel": "Aparecerá como",

  "wizard.guide.location.title": "¿Dónde vivirá en el disco?",
  "wizard.guide.location.body":
    "Elige la carpeta superior. Yarrow creará dentro una carpeta nueva con el nombre del cuaderno. Cualquier sitio donde lleguen tus copias de seguridad es un buen lugar.",
  "wizard.guide.location.willCreate": "Ruta final",

  "wizard.guide.shape.title": "¿Cómo lo vas a usar?",
  "wizard.guide.shape.body":
    "Yarrow puede mapear todas las direcciones que toma tu pensamiento o quedarse callado y apartarse del camino. Cualquiera de las dos está bien — puedes cambiar de idea desde los Ajustes en cualquier momento.",
  "wizard.guide.shape.startingNoteHint":
    "Sembraremos el cuaderno con esta primera nota para que tengas un punto de partida.",
  "wizard.guide.shape.personaIntro":
    "Opcional. Elige un oficio y la barra derecha y la paleta de comandos se inclinarán hacia las herramientas que le encajan. Puedes cambiarlo en cualquier momento desde Ajustes → Modos y personas.",
  "wizard.guide.shape.personaNone.label": "Sin persona",
  "wizard.guide.shape.personaNone.desc":
    "Solo Por escenarios — toda la superficie de Yarrow, sin sesgos.",
  "wizard.guide.start.clone.title": "Clonar desde una URL de git",
  "wizard.guide.start.clone.body":
    "¿Ya tienes un cuaderno de Yarrow sincronizado en GitHub, GitLab u otro servidor git? Pega la URL — lo descargaremos y verificaremos que sea un espacio de trabajo válido antes de abrirlo.",
  "wizard.clone.urlLabel": "URL de git",
  "wizard.clone.urlPlaceholder": "git@github.com:tu-usuario/mi-cuaderno.git",
  "wizard.clone.help":
    "Las URLs SSH usan tu ssh-agent local. Las URLs HTTPS públicas también funcionan. HTTPS con token aún no se admite en el asistente — usa SSH para cuadernos privados.",
  "wizard.clone.gateNote":
    "Yarrow solo abre cuadernos con un .yarrow/config.toml válido — los remotos no relacionados se rechazan y eliminan.",
  "wizard.error.giveUrl": "Pega la URL de git de un espacio de trabajo Yarrow existente.",
  "wizard.progress.cloning": "Clonando espacio de trabajo…",
  "wizard.progress.cloned": "Clonado y validado.",

  "wizard.quick.step1.title": "¿Qué tipo de cuaderno?",
  "wizard.quick.step1.body":
    "Empieza en blanco o copia desde otra aplicación. Elige un nombre ahora o después — ambas opciones están bien.",
  "wizard.quick.step2.title": "Ubícalo y dale forma",
  "wizard.quick.step2.body":
    "Elige dónde vive en disco y cómo debe comportarse Yarrow dentro de él. El mapeo por escenarios es lo predeterminado; Básico se aparta del camino.",

  "wizard.tip.iconLetter": "i",
  "wizard.tip.preserved": "Wikilinks y etiquetas se conservan",
  "wizard.tip.skippedConfig":
    "Las carpetas de configuración propias de cada app (.obsidian/, .logseq/, etc.) se omiten",
  "wizard.tip.checkpointed":
    "Toda la importación es un único checkpoint — puedes deshacerla en cualquier momento",

  "wizard.progress.title": "Preparando todo",
  "wizard.error.label": "Algo no funcionó",
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
  "wizard.details.mode.mapped.title": "Förgrenande scenariokartläggning",
  "wizard.details.mode.mapped.body":
    "Anteckningar kopplas, scenarier förgrenas, din karta växer.",
  "wizard.details.mode.basic.title": "Grundläggande anteckningar",
  "wizard.details.mode.basic.body":
    "En vanlig markdown-anteckningsbok. Inga scenarier, ingen graf.",
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

  // 3.0 redesign — guided 4-step + polished 2-step
  "wizard.eyebrow.firstRun": "Välkommen till Yarrow",
  "wizard.eyebrow.return": "Ny arbetsyta",
  "wizard.crumb.start": "Start",
  "wizard.crumb.name": "Namn",
  "wizard.crumb.location": "Plats",
  "wizard.crumb.shape": "Form",
  "wizard.crumb.details": "Detaljer",
  "wizard.button.begin": "Börja",
  "wizard.button.skip": "Hoppa över guiden",

  "wizard.guide.start.title": "Var vill du börja?",
  "wizard.guide.start.body":
    "Yarrow-anteckningsböcker är mappar på disk. Du kan börja med en tom mapp eller ta med anteckningar du redan har någon annanstans — Yarrow kopierar in dem och låter originalen vara.",
  "wizard.guide.start.blank.title": "En tom anteckningsbok",
  "wizard.guide.start.blank.body":
    "Börja med en enda startanteckning. Allt annat förgrenas därifrån.",
  "wizard.guide.start.import.title": "Ta med anteckningar jag redan har",
  "wizard.guide.start.import.body":
    "Kopiera från Obsidian, Bear, Logseq eller Notion. Wikilinks och taggar följer med; originalen rörs inte.",

  "wizard.guide.name.title": "Vad ska vi kalla den?",
  "wizard.guide.name.body":
    "Ge anteckningsboken ett namn du känner igen i listan Senaste. Du kan byta namn senare — det här är bara en etikett.",
  "wizard.guide.name.previewLabel": "Visas som",

  "wizard.guide.location.title": "Var ska den ligga på disk?",
  "wizard.guide.location.body":
    "Välj föräldramappen. Yarrow skapar en ny mapp inuti med anteckningsbokens namn. Var som helst dit dina filsäkerhetskopior når är en bra plats.",
  "wizard.guide.location.willCreate": "Slutlig sökväg",

  "wizard.guide.shape.title": "Hur ska du använda den?",
  "wizard.guide.shape.body":
    "Yarrow kan antingen kartlägga varje riktning ditt tänkande tar, eller hålla sig tyst och ur vägen. Båda är okej — du kan ändra dig från Inställningar när som helst.",
  "wizard.guide.shape.startingNoteHint":
    "Vi sår anteckningsboken med den här första anteckningen så du har någonstans att börja.",
  "wizard.guide.shape.personaIntro":
    "Frivilligt. Välj ett hantverk så lutar högerlisten och kommandopaletten åt verktygen som passar. Du kan byta när som helst från Inställningar → Lägen och personor.",
  "wizard.guide.shape.personaNone.label": "Ingen persona",
  "wizard.guide.shape.personaNone.desc":
    "Bara Stigbaserat — hela Yarrow-ytan, utan slagsida.",
  "wizard.guide.start.clone.title": "Klona från en git-URL",
  "wizard.guide.start.clone.body":
    "Har du redan en Yarrow-anteckningsbok synkad mot GitHub, GitLab eller en annan git-värd? Klistra in URL:en — vi hämtar ner den och verifierar att det är en riktig Yarrow-arbetsyta innan vi öppnar.",
  "wizard.clone.urlLabel": "Git-URL",
  "wizard.clone.urlPlaceholder": "git@github.com:du/min-anteckningsbok.git",
  "wizard.clone.help":
    "SSH-URL:er använder din lokala ssh-agent. Publika HTTPS-URL:er fungerar också. Token-skyddade HTTPS stöds inte i guiden ännu — använd SSH för privata repon.",
  "wizard.clone.gateNote":
    "Yarrow öppnar bara repon med en giltig .yarrow/config.toml — orelaterade repon avvisas och tas bort.",
  "wizard.error.giveUrl": "Klistra in git-URL:en till en befintlig Yarrow-arbetsyta.",
  "wizard.progress.cloning": "Klonar arbetsyta…",
  "wizard.progress.cloned": "Klonad och verifierad.",

  "wizard.quick.step1.title": "Vilken sorts anteckningsbok?",
  "wizard.quick.step1.body":
    "Börja tom eller kopiera från en annan app. Välj ett namn nu eller senare — båda går bra.",
  "wizard.quick.step2.title": "Placera den och ge den form",
  "wizard.quick.step2.body":
    "Välj var den ligger på disk och hur Yarrow ska bete sig inuti. Stigkartläggning är standard; Grundläggande håller sig ur vägen.",

  "wizard.tip.iconLetter": "i",
  "wizard.tip.preserved": "Wikilinks och taggar följer med",
  "wizard.tip.skippedConfig":
    "Appspecifika konfigurationsmappar (.obsidian/, .logseq/, etc.) hoppas över",
  "wizard.tip.checkpointed":
    "Hela importen är en enda checkpoint — du kan ångra den när som helst",

  "wizard.progress.title": "Förbereder allt",
  "wizard.error.label": "Något gick inte vägen",
};
