// Onboarding screen + Open-Folder guide modal copy. The endonyms used
// in OnboardingLanguageSwitcher live on `LANGUAGE_ORDER` itself, not
// here, since they intentionally never translate.

export const onboardingEN = {
  "onboarding.tagline":
    "Notes that branch, evolve, and connect. Nothing is ever lost — every direction you explore stays in an archive, not the trash.",
  "onboarding.recent": "Recent workspaces",
  "onboarding.removeRecent": "Remove from recents",
  "onboarding.openLabel": "Open {name}",
  "onboarding.create": "Create a new workspace",
  "onboarding.createSub":
    "Start blank, or import from Obsidian, Bear, Logseq, or Notion. We'll guide you through it.",
  "onboarding.openOther": "Open a different folder",
  "onboarding.openOtherSub":
    "Locate a Yarrow workspace that isn't in your recents. We'll show you what to look for.",
  "onboarding.sample": "Try a sample vault",
  "onboarding.sampleSub":
    "Eight connected notes and a second path — see Yarrow populated before you start writing your own.",
  "onboarding.notesAreFiles": "Notes are just files.",
  "onboarding.notesAreFilesBody":
    "They live in your chosen folder as `.md`. You can open them in any editor — Yarrow only tracks changes and connections for you.",
  "onboarding.everyChange": "Every change is kept.",
  "onboarding.everyChangeBody":
    "Save is automatic and silent. You can scrub back through any version.",
  "onboarding.exploreParallel": "Explore in parallel.",
  "onboarding.exploreParallelBody":
    "When you want to try a different angle, open a new direction. The original stays exactly as it was.",
  "onboarding.tip":
    "Tip: press {palette} inside Yarrow to jump anywhere; {quickSwitch} for a quick note switcher.",
  "onboarding.languagePicker": "Language",

  "openGuide.title": "Open an existing Yarrow workspace",
  "openGuide.subtitle":
    "A workspace is just a folder on disk — one you (or Yarrow) made before.",
  "openGuide.lookingFor": "What you're looking for",
  "openGuide.configHint": "Yarrow's config + index (hidden)",
  "openGuide.notesHint": "your .md notes live here",
  "openGuide.gitBookkeeping": "(and the usual git bookkeeping)",
  "openGuide.outerFolderBody":
    "Pick the {outer} — the one that contains {dotyarrow}. If you drill in too far (e.g. into {notes}), Yarrow won't recognize it and will offer to open it as a new workspace instead.",
  "openGuide.outerWord": "outer folder",
  "openGuide.hiddenHint":
    "Your OS might hide the {dotyarrow} folder (macOS & Linux hide anything that starts with a dot). That's fine — you don't need to see it, just pick the folder that contains it.",
  "openGuide.cancel": "Cancel",
  "openGuide.browse": "Browse for a folder…",
} as const;

export type OnboardingKey = keyof typeof onboardingEN;

export const onboardingES: Record<OnboardingKey, string> = {
  "onboarding.tagline":
    "Notas que se ramifican, evolucionan y se conectan. Nada se pierde: cada dirección que explores queda guardada en un archivo, no en la papelera.",
  "onboarding.recent": "Espacios de trabajo recientes",
  "onboarding.removeRecent": "Quitar de recientes",
  "onboarding.openLabel": "Abrir {name}",
  "onboarding.create": "Crear un nuevo espacio de trabajo",
  "onboarding.createSub":
    "Empieza en blanco o importa desde Obsidian, Bear, Logseq o Notion. Te guiamos paso a paso.",
  "onboarding.openOther": "Abrir otra carpeta",
  "onboarding.openOtherSub":
    "Localiza un espacio de trabajo de Yarrow que no esté en tus recientes. Te mostramos qué buscar.",
  "onboarding.sample": "Probar un espacio de muestra",
  "onboarding.sampleSub":
    "Ocho notas conectadas y una segunda ruta: ve cómo luce Yarrow con contenido antes de escribir el tuyo.",
  "onboarding.notesAreFiles": "Las notas son solo archivos.",
  "onboarding.notesAreFilesBody":
    "Viven en la carpeta que elijas como archivos `.md`. Puedes abrirlas con cualquier editor; Yarrow solo se encarga de seguir los cambios y las conexiones.",
  "onboarding.everyChange": "Cada cambio se conserva.",
  "onboarding.everyChangeBody":
    "El guardado es automático y silencioso. Puedes retroceder a cualquier versión cuando quieras.",
  "onboarding.exploreParallel": "Explora en paralelo.",
  "onboarding.exploreParallelBody":
    "Cuando quieras probar un enfoque distinto, abre una nueva dirección. La original se queda tal cual.",
  "onboarding.tip":
    "Consejo: presiona {palette} dentro de Yarrow para saltar a cualquier parte; {quickSwitch} para un cambio rápido de nota.",
  "onboarding.languagePicker": "Idioma",

  "openGuide.title": "Abrir un espacio de trabajo de Yarrow existente",
  "openGuide.subtitle":
    "Un espacio de trabajo es solo una carpeta en tu disco que tú (o Yarrow) creó antes.",
  "openGuide.lookingFor": "Lo que estás buscando",
  "openGuide.configHint": "configuración e índice de Yarrow (oculto)",
  "openGuide.notesHint": "aquí viven tus notas .md",
  "openGuide.gitBookkeeping": "(y los archivos habituales de git)",
  "openGuide.outerFolderBody":
    "Elige la {outer}: la que contiene {dotyarrow}. Si entras demasiado (por ejemplo, dentro de {notes}), Yarrow no la reconocerá y ofrecerá abrirla como un espacio nuevo.",
  "openGuide.outerWord": "carpeta superior",
  "openGuide.hiddenHint":
    "Es posible que tu sistema oculte la carpeta {dotyarrow} (macOS y Linux ocultan todo lo que empieza con un punto). No es problema: no necesitas verla, basta con elegir la carpeta que la contiene.",
  "openGuide.cancel": "Cancelar",
  "openGuide.browse": "Buscar una carpeta…",
};

export const onboardingSV: Record<OnboardingKey, string> = {
  "onboarding.tagline":
    "Anteckningar som förgrenar sig, utvecklas och hänger ihop. Inget går förlorat — varje riktning du utforskar sparas i ett arkiv, inte i papperskorgen.",
  "onboarding.recent": "Senaste arbetsytor",
  "onboarding.removeRecent": "Ta bort från senaste",
  "onboarding.openLabel": "Öppna {name}",
  "onboarding.create": "Skapa en ny arbetsyta",
  "onboarding.createSub":
    "Börja på en tom yta eller importera från Obsidian, Bear, Logseq eller Notion. Vi guidar dig genom det.",
  "onboarding.openOther": "Öppna en annan mapp",
  "onboarding.openOtherSub":
    "Hitta en Yarrow-arbetsyta som inte ligger bland dina senaste. Vi visar vad du ska leta efter.",
  "onboarding.sample": "Prova en exempelarbetsyta",
  "onboarding.sampleSub":
    "Åtta sammankopplade anteckningar och en till stig — se hur Yarrow ser ut fyllt med innehåll innan du skriver ditt eget.",
  "onboarding.notesAreFiles": "Anteckningar är bara filer.",
  "onboarding.notesAreFilesBody":
    "De ligger i den mapp du valt som `.md`-filer. Du kan öppna dem i vilken redigerare som helst — Yarrow följer bara ändringar och kopplingar åt dig.",
  "onboarding.everyChange": "Varje ändring sparas.",
  "onboarding.everyChangeBody":
    "Sparandet sker automatiskt och tyst. Du kan bläddra tillbaka till vilken version som helst.",
  "onboarding.exploreParallel": "Utforska parallellt.",
  "onboarding.exploreParallelBody":
    "När du vill testa en annan vinkel öppnar du en ny riktning. Originalet ligger kvar precis som det var.",
  "onboarding.tip":
    "Tips: tryck {palette} inuti Yarrow för att hoppa vart som helst; {quickSwitch} för snabb anteckningsväxlare.",
  "onboarding.languagePicker": "Språk",

  "openGuide.title": "Öppna en befintlig Yarrow-arbetsyta",
  "openGuide.subtitle":
    "En arbetsyta är bara en mapp på disken — en som du (eller Yarrow) skapat tidigare.",
  "openGuide.lookingFor": "Det här letar du efter",
  "openGuide.configHint": "Yarrows konfiguration och index (dold)",
  "openGuide.notesHint": "här ligger dina .md-anteckningar",
  "openGuide.gitBookkeeping": "(och git-filerna som hör till)",
  "openGuide.outerFolderBody":
    "Välj {outer} — den som innehåller {dotyarrow}. Om du går in för djupt (till exempel in i {notes}) kommer Yarrow inte känna igen den och föreslår att öppna den som en ny arbetsyta i stället.",
  "openGuide.outerWord": "yttersta mappen",
  "openGuide.hiddenHint":
    "Ditt operativsystem kan dölja {dotyarrow}-mappen (macOS och Linux döljer allt som börjar med en punkt). Det är okej — du behöver inte se den, välj bara mappen som innehåller den.",
  "openGuide.cancel": "Avbryt",
  "openGuide.browse": "Bläddra efter en mapp…",
};
