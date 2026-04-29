// Intro page (3.0 "Frontispiece") + import-wizard onboarding copy.
// The endonyms used in the language picker live on `LANGUAGE_ORDER`
// itself, not here, since they intentionally never translate.

export const onboardingEN = {
  // ─── 3.0 Frontispiece (Intro page) ──────────────────────────
  "intro.welcomeBack": "Welcome back, {name}",
  "intro.welcomeBackAnon": "Welcome back",
  // 3.2 — replaces the "Welcome back" eyebrow as the always-visible
  // tagline above the wordmark on the intro page.
  "intro.tagline": "Notes that think like you do",
  "intro.recentEyebrow": "Recent · select to open",
  "intro.actions.new": "New workspace",
  "intro.actions.open": "Open existing folder",
  "intro.actions.clone": "Clone from URL",
  "intro.empty.title": "No workspaces yet.",
  "intro.recents.showAll": "Show all ({count})…",
  "intro.kbd.navigate": "navigate",
  "intro.kbd.open": "open",
  "intro.kbd.new": "new",
  "intro.kbd.aria":
    "keyboard shortcuts: arrow keys to navigate, enter to open, command N to create",
  "intro.recent.openAria": "Open {name}, last opened {when}",
  "intro.recent.menuAria": "More actions for {name}",
  "intro.recent.contextOpenInNewWindow": "Open in new window",
  "intro.recent.contextCopyPath": "Copy workspace folder path",
  "intro.recent.contextRename": "Rename workspace…",
  "intro.recent.contextReveal": "Reveal in file manager",
  "intro.recent.contextRemove": "Remove from list",
  "intro.recent.copied": "Folder path copied to clipboard.",
  "intro.recent.renamePromptTitle": "Rename {name}",
  "intro.recent.renamePromptHelp":
    "The folder on disk stays where it is — only the display name changes.",
  "intro.recent.renamePromptSave": "Save",
  "intro.recent.renamePromptCancel": "Cancel",
  "intro.recent.renameError": "Couldn't rename: {error}",
  "intro.search.placeholder": "Search workspaces  (/ to focus)",
  "intro.search.aria": "Search recent workspaces",
  "intro.search.noMatches": "Nothing matches “{query}”.",
  "intro.sort.aria": "Sort recent workspaces",
  "intro.sort.recency": "Recently opened",
  "intro.sort.alphabetical": "Alphabetical",
  "intro.clone.title": "Clone from URL",
  "intro.clone.body":
    "Cloning a Yarrow workspace from a Git URL ships in a 3.x point release. Until then, clone with the git CLI and use \"Open existing folder\" to point Yarrow at the result.",
  "intro.clone.dismiss": "Got it",
  "intro.lang.picker": "Language",
  "intro.lang.aria": "Change language",
  "intro.time.justNow": "just now",
  "intro.time.yesterday": "yesterday",
  "intro.time.daysAgo": "{n} days ago",
  "intro.time.lastWeek": "last week",
  "intro.time.weeksAgo": "{n} weeks ago",
  // Five rotational dedications, picked at random per launch. None
  // should read like marketing copy — these are writer's-notebook
  // dedications.
  "intro.dedications.0":
    "A place to gather the things you keep almost saying.",
  "intro.dedications.1": "For the half-thoughts and the second drafts.",
  "intro.dedications.2": "The notebook that remembers where you left off.",
  "intro.dedications.3": "A quiet place for unfinished sentences.",
  "intro.dedications.4": "What you wrote yesterday is still here.",

  // ─── Welcome stats + Continue line ─────────────────────────
  // Three quiet figures rendered below the tagline. Singular/plural
  // labels are computed at render time from the count itself, so we
  // ship both forms here. Hidden when every figure is zero.
  "intro.stats.notesThisMonthSingular": "note this month",
  "intro.stats.notesThisMonthPlural": "notes this month",
  "intro.stats.dayStreakSingular": "day streak",
  "intro.stats.dayStreakPlural": "day streak",
  "intro.stats.wordsThisMonthSingular": "word this month",
  "intro.stats.wordsThisMonthPlural": "words this month",
  // Continue line surfacing the most recently modified note across
  // all recent workspaces. Renders as: "Continuing → Note title · 2 hr ago"
  "intro.continue.verb": "Continuing",
  "intro.continue.aria": "Continue with {title} in {workspace}",

  // ─── First-launch mode picker ───────────────────────────────
  "intro.modePicker.title": "How do you want to work?",
  "intro.modePicker.subtitle":
    "Yarrow can be a quiet place for notes, or a full toolkit with scenarios and connections. You can change this any time from the status bar.",
  "intro.modePicker.quietTitle": "Basic",
  "intro.modePicker.quietBody":
    "Just notes and ideas. Scenario tools stay out of the way.",
  "intro.modePicker.fullTitle": "Scenario-based, no persona",
  "intro.modePicker.fullBody":
    "The full Yarrow surface — scenarios, connections, the lot.",
  "intro.modePicker.skip": "Decide later",
  "intro.modePicker.changeHint":
    "You can switch any time — the mode pill in the status bar opens this back up.",

  // ─── Wizard / import flow (still used by NewWorkspaceWizard) ──
} as const;

export type OnboardingKey = keyof typeof onboardingEN;

export const onboardingES: Record<OnboardingKey, string> = {
  "intro.welcomeBack": "Bienvenido de nuevo, {name}",
  "intro.welcomeBackAnon": "Bienvenido de nuevo",
  "intro.tagline": "Notas que piensan como tú",
  "intro.recentEyebrow": "Recientes · selecciona para abrir",
  "intro.actions.new": "Nuevo espacio de trabajo",
  "intro.actions.open": "Abrir carpeta existente",
  "intro.actions.clone": "Clonar desde URL",
  "intro.empty.title": "Aún no hay espacios de trabajo.",
  "intro.recents.showAll": "Ver todo ({count})…",
  "intro.kbd.navigate": "navegar",
  "intro.kbd.open": "abrir",
  "intro.kbd.new": "nuevo",
  "intro.kbd.aria":
    "atajos de teclado: flechas para navegar, intro para abrir, comando N para crear",
  "intro.recent.openAria": "Abrir {name}, abierto por última vez {when}",
  "intro.recent.menuAria": "Más acciones para {name}",
  "intro.recent.contextOpenInNewWindow": "Abrir en una ventana nueva",
  "intro.recent.contextCopyPath": "Copiar la ruta del espacio",
  "intro.recent.contextRename": "Renombrar el espacio…",
  "intro.recent.contextReveal": "Mostrar en el explorador de archivos",
  "intro.recent.contextRemove": "Quitar de la lista",
  "intro.recent.copied": "Ruta copiada al portapapeles.",
  "intro.recent.renamePromptTitle": "Renombrar {name}",
  "intro.recent.renamePromptHelp":
    "La carpeta en el disco no se mueve — solo cambia el nombre que ves aquí.",
  "intro.recent.renamePromptSave": "Guardar",
  "intro.recent.renamePromptCancel": "Cancelar",
  "intro.recent.renameError": "No se pudo renombrar: {error}",
  "intro.search.placeholder": "Buscar espacios de trabajo  (/ para enfocar)",
  "intro.search.aria": "Buscar espacios de trabajo recientes",
  "intro.search.noMatches": "Nada coincide con «{query}».",
  "intro.sort.aria": "Ordenar espacios de trabajo recientes",
  "intro.sort.recency": "Abiertos recientemente",
  "intro.sort.alphabetical": "Alfabético",
  "intro.clone.title": "Clonar desde URL",
  "intro.clone.body":
    "La clonación de un espacio de trabajo de Yarrow desde una URL de Git llegará en una versión 3.x posterior. Mientras tanto, clona con la CLI de git y usa \"Abrir carpeta existente\" para apuntar Yarrow al resultado.",
  "intro.clone.dismiss": "Entendido",
  "intro.lang.picker": "Idioma",
  "intro.lang.aria": "Cambiar idioma",
  "intro.time.justNow": "ahora mismo",
  "intro.time.yesterday": "ayer",
  "intro.time.daysAgo": "hace {n} días",
  "intro.time.lastWeek": "la semana pasada",
  "intro.time.weeksAgo": "hace {n} semanas",
  "intro.dedications.0":
    "Un lugar para reunir las cosas que casi llegas a decir.",
  "intro.dedications.1": "Para los pensamientos a medias y los segundos borradores.",
  "intro.dedications.2": "El cuaderno que recuerda dónde lo dejaste.",
  "intro.dedications.3": "Un lugar tranquilo para frases sin terminar.",
  "intro.dedications.4": "Lo que escribiste ayer sigue aquí.",
  "intro.stats.notesThisMonthSingular": "nota este mes",
  "intro.stats.notesThisMonthPlural": "notas este mes",
  "intro.stats.dayStreakSingular": "día seguido",
  "intro.stats.dayStreakPlural": "días seguidos",
  "intro.stats.wordsThisMonthSingular": "palabra este mes",
  "intro.stats.wordsThisMonthPlural": "palabras este mes",
  "intro.continue.verb": "Continuando",
  "intro.continue.aria": "Continuar con {title} en {workspace}",
  "intro.modePicker.title": "¿Cómo quieres trabajar?",
  "intro.modePicker.subtitle":
    "Yarrow puede ser un lugar tranquilo para notas, o un kit completo con escenarios, ramas y conexiones. Puedes cambiarlo cuando quieras desde la barra de estado.",
  "intro.modePicker.quietTitle": "Básico",
  "intro.modePicker.quietBody":
    "Solo notas e ideas. Las herramientas de escenarios y ramas se mantienen fuera.",
  "intro.modePicker.fullTitle": "Por escenarios, sin perfil",
  "intro.modePicker.fullBody":
    "Toda la superficie de Yarrow — escenarios, ramas, conexiones, todo.",
  "intro.modePicker.skip": "Decidir luego",
  "intro.modePicker.changeHint":
    "Puedes cambiar cuando quieras — el pill de modo en la barra de estado vuelve a abrir esto.",
};

export const onboardingSV: Record<OnboardingKey, string> = {
  "intro.welcomeBack": "Välkommen tillbaka, {name}",
  "intro.welcomeBackAnon": "Välkommen tillbaka",
  "intro.tagline": "Anteckningar som tänker som du",
  "intro.recentEyebrow": "Senaste · välj för att öppna",
  "intro.actions.new": "Ny arbetsyta",
  "intro.actions.open": "Öppna befintlig mapp",
  "intro.actions.clone": "Klona från URL",
  "intro.empty.title": "Inga arbetsytor ännu.",
  "intro.recents.showAll": "Visa alla ({count})…",
  "intro.kbd.navigate": "navigera",
  "intro.kbd.open": "öppna",
  "intro.kbd.new": "ny",
  "intro.kbd.aria":
    "kortkommandon: piltangenter för att navigera, enter för att öppna, kommando N för att skapa",
  "intro.recent.openAria": "Öppna {name}, senast öppnad {when}",
  "intro.recent.menuAria": "Fler åtgärder för {name}",
  "intro.recent.contextOpenInNewWindow": "Öppna i nytt fönster",
  "intro.recent.contextCopyPath": "Kopiera arbetsytans sökväg",
  "intro.recent.contextRename": "Byt namn på arbetsytan…",
  "intro.recent.contextReveal": "Visa i filhanterare",
  "intro.recent.contextRemove": "Ta bort från listan",
  "intro.recent.copied": "Sökväg kopierad till urklipp.",
  "intro.recent.renamePromptTitle": "Byt namn på {name}",
  "intro.recent.renamePromptHelp":
    "Mappen på disken stannar kvar — det är bara visningsnamnet som ändras.",
  "intro.recent.renamePromptSave": "Spara",
  "intro.recent.renamePromptCancel": "Avbryt",
  "intro.recent.renameError": "Kunde inte byta namn: {error}",
  "intro.search.placeholder": "Sök arbetsytor  (/ för fokus)",
  "intro.search.aria": "Sök senaste arbetsytor",
  "intro.search.noMatches": "Inget matchar ”{query}”.",
  "intro.sort.aria": "Sortera senaste arbetsytor",
  "intro.sort.recency": "Senast öppnade",
  "intro.sort.alphabetical": "Alfabetiskt",
  "intro.clone.title": "Klona från URL",
  "intro.clone.body":
    "Att klona en Yarrow-arbetsyta från en Git-URL kommer i en kommande 3.x-utgåva. Tills dess, klona med git-CLI:t och använd \"Öppna befintlig mapp\" för att rikta Yarrow mot resultatet.",
  "intro.clone.dismiss": "Uppfattat",
  "intro.lang.picker": "Språk",
  "intro.lang.aria": "Byt språk",
  "intro.time.justNow": "just nu",
  "intro.time.yesterday": "igår",
  "intro.time.daysAgo": "för {n} dagar sedan",
  "intro.time.lastWeek": "förra veckan",
  "intro.time.weeksAgo": "för {n} veckor sedan",
  "intro.dedications.0":
    "En plats att samla det du nästan säger.",
  "intro.dedications.1": "För halva tankar och andra utkast.",
  "intro.dedications.2": "Anteckningsboken som minns var du slutade.",
  "intro.dedications.3": "En tyst plats för meningar utan slut.",
  "intro.dedications.4": "Det du skrev igår finns kvar.",
  "intro.stats.notesThisMonthSingular": "anteckning denna månad",
  "intro.stats.notesThisMonthPlural": "anteckningar denna månad",
  "intro.stats.dayStreakSingular": "dag i rad",
  "intro.stats.dayStreakPlural": "dagar i rad",
  "intro.stats.wordsThisMonthSingular": "ord denna månad",
  "intro.stats.wordsThisMonthPlural": "ord denna månad",
  "intro.continue.verb": "Fortsätter",
  "intro.continue.aria": "Fortsätt med {title} i {workspace}",
  "intro.modePicker.title": "Hur vill du arbeta?",
  "intro.modePicker.subtitle":
    "Yarrow kan vara en tyst plats för anteckningar, eller en hel verktygslåda med scenarier, grenar och kopplingar. Du kan byta när som helst från statusraden.",
  "intro.modePicker.quietTitle": "Enkel",
  "intro.modePicker.quietBody":
    "Bara anteckningar och idéer. Scenarier och grenar håller sig undan.",
  "intro.modePicker.fullTitle": "Scenariobaserad, ingen profil",
  "intro.modePicker.fullBody":
    "Hela Yarrow-ytan — scenarier, grenar, kopplingar, allt.",
  "intro.modePicker.skip": "Bestäm senare",
  "intro.modePicker.changeHint":
    "Du kan byta när som helst — lägespillen i statusraden öppnar det här igen.",
};
