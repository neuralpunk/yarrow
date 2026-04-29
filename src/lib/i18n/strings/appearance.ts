// Settings → Appearance pane.

export const appearanceEN = {
  "settings.appearance.title": "Appearance",
  "settings.appearance.hint":
    "How Yarrow looks on your screen. Your choice is saved on this machine.",
  "settings.appearance.theme": "Theme",
  "settings.appearance.themeHint":
    "Auto follows your system light/dark preference.",
  "settings.appearance.modeLabel": "Theme mode",
  "settings.appearance.modeAuto": "Auto",
  "settings.appearance.modeLight": "Light",
  "settings.appearance.modeDark": "Dark",
  "settings.appearance.lightLabel": "Light theme",
  "settings.appearance.lightLabelAuto": "Light theme (when system is light)",
  "settings.appearance.darkLabel": "Dark theme",
  "settings.appearance.darkLabelAuto": "Dark theme (when system is dark)",
  "settings.appearance.theme.vellum.name": "Vellum",
  "settings.appearance.theme.vellum.desc":
    "Cool bone and slate — the default.",
  "settings.appearance.theme.linen.name": "Linen",
  "settings.appearance.theme.linen.desc":
    "Warm cream and olive — soft and domestic.",
  "settings.appearance.theme.ashrose.name": "Ashrose",
  "settings.appearance.theme.ashrose.desc":
    "Rose and pink — gentle warmth.",
  "settings.appearance.theme.workshop.name": "Workshop",
  "settings.appearance.theme.workshop.desc":
    "Deep ink and bronze — the default.",
  "settings.appearance.theme.graphite.name": "Graphite",
  "settings.appearance.theme.graphite.desc":
    "Quiet neutral grays — restrained.",
  "settings.appearance.theme.dracula.name": "Dracula",
  "settings.appearance.theme.dracula.desc":
    "Purple on navy — the cult classic.",
  "settings.appearance.language": "Language",
  "settings.appearance.languageHint":
    "The language Yarrow's interface is shown in. Notes themselves aren't translated.",
  "settings.appearance.macFudge.title": "macOS bottom-edge correction",
  "settings.appearance.macFudge.aside": "macOS only · live update",
  "settings.appearance.macFudge.hint":
    "If the bottom of the app feels cut off — the status bar, Activity, or Trash sit just below the visible window — pick a larger correction. macOS reports its window size in a way Yarrow can't always trust, so this trims a fixed number of pixels off the bottom. Most people don't need to touch this.",
  "settings.appearance.macFudge.custom":
    "A custom value is currently active. Pick a preset to override it.",
  "settings.appearance.macFudge.none.label": "None",
  "settings.appearance.macFudge.none.sub": "0 px",
  "settings.appearance.macFudge.small.label": "Small",
  "settings.appearance.macFudge.small.sub": "90 px",
  "settings.appearance.macFudge.medium.label": "Medium",
  "settings.appearance.macFudge.medium.sub": "100 px · default",
  "settings.appearance.macFudge.large.label": "Large",
  "settings.appearance.macFudge.large.sub": "150 px",
  "settings.appearance.macFudge.xlarge.label": "X-Large",
  "settings.appearance.macFudge.xlarge.sub": "220 px",
} as const;

export type AppearanceKey = keyof typeof appearanceEN;

export const appearanceES: Record<AppearanceKey, string> = {
  "settings.appearance.title": "Apariencia",
  "settings.appearance.hint":
    "Cómo se ve Yarrow en tu pantalla. Tu elección se guarda en este equipo.",
  "settings.appearance.theme": "Tema",
  "settings.appearance.themeHint":
    "Auto sigue la preferencia de claro/oscuro de tu sistema.",
  "settings.appearance.modeLabel": "Modo de tema",
  "settings.appearance.modeAuto": "Auto",
  "settings.appearance.modeLight": "Claro",
  "settings.appearance.modeDark": "Oscuro",
  "settings.appearance.lightLabel": "Tema claro",
  "settings.appearance.lightLabelAuto":
    "Tema claro (cuando el sistema está en claro)",
  "settings.appearance.darkLabel": "Tema oscuro",
  "settings.appearance.darkLabelAuto":
    "Tema oscuro (cuando el sistema está en oscuro)",
  "settings.appearance.theme.vellum.name": "Vellum",
  "settings.appearance.theme.vellum.desc":
    "Hueso frío y pizarra — el predeterminado.",
  "settings.appearance.theme.linen.name": "Linen",
  "settings.appearance.theme.linen.desc":
    "Crema cálida y olivo — suave y hogareño.",
  "settings.appearance.theme.ashrose.name": "Ashrose",
  "settings.appearance.theme.ashrose.desc":
    "Rosa y rosado — calidez suave.",
  "settings.appearance.theme.workshop.name": "Workshop",
  "settings.appearance.theme.workshop.desc":
    "Tinta profunda y bronce — el predeterminado.",
  "settings.appearance.theme.graphite.name": "Graphite",
  "settings.appearance.theme.graphite.desc":
    "Grises neutros sobrios — discretos.",
  "settings.appearance.theme.dracula.name": "Dracula",
  "settings.appearance.theme.dracula.desc":
    "Púrpura sobre azul marino — el clásico de culto.",
  "settings.appearance.language": "Idioma",
  "settings.appearance.languageHint":
    "El idioma en el que se muestra la interfaz de Yarrow. Las notas en sí no se traducen.",
  "settings.appearance.macFudge.title": "Corrección del borde inferior en macOS",
  "settings.appearance.macFudge.aside": "solo macOS · actualización en vivo",
  "settings.appearance.macFudge.hint":
    "Si la parte inferior de la app se ve recortada — la barra de estado, Actividad o Papelera quedan justo debajo de la ventana visible — elige una corrección mayor. macOS informa el tamaño de su ventana de forma en la que Yarrow no siempre puede confiar, así que esto recorta un número fijo de píxeles del borde inferior. La mayoría no necesita tocar esto.",
  "settings.appearance.macFudge.custom":
    "Hay un valor personalizado activo. Elige un preset para reemplazarlo.",
  "settings.appearance.macFudge.none.label": "Ninguno",
  "settings.appearance.macFudge.none.sub": "0 px",
  "settings.appearance.macFudge.small.label": "Pequeño",
  "settings.appearance.macFudge.small.sub": "90 px",
  "settings.appearance.macFudge.medium.label": "Mediano",
  "settings.appearance.macFudge.medium.sub": "100 px · predeterminado",
  "settings.appearance.macFudge.large.label": "Grande",
  "settings.appearance.macFudge.large.sub": "150 px",
  "settings.appearance.macFudge.xlarge.label": "Extra grande",
  "settings.appearance.macFudge.xlarge.sub": "220 px",
};

export const appearanceSV: Record<AppearanceKey, string> = {
  "settings.appearance.title": "Utseende",
  "settings.appearance.hint":
    "Hur Yarrow ser ut på din skärm. Ditt val sparas på den här datorn.",
  "settings.appearance.theme": "Tema",
  "settings.appearance.themeHint":
    "Auto följer ditt systems ljus/mörker-inställning.",
  "settings.appearance.modeLabel": "Temaläge",
  "settings.appearance.modeAuto": "Auto",
  "settings.appearance.modeLight": "Ljust",
  "settings.appearance.modeDark": "Mörkt",
  "settings.appearance.lightLabel": "Ljust tema",
  "settings.appearance.lightLabelAuto":
    "Ljust tema (när systemet är ljust)",
  "settings.appearance.darkLabel": "Mörkt tema",
  "settings.appearance.darkLabelAuto":
    "Mörkt tema (när systemet är mörkt)",
  "settings.appearance.theme.vellum.name": "Vellum",
  "settings.appearance.theme.vellum.desc":
    "Sval ben och skiffer — standard.",
  "settings.appearance.theme.linen.name": "Linen",
  "settings.appearance.theme.linen.desc":
    "Varm grädde och olivgrönt — mjukt och hemtrevligt.",
  "settings.appearance.theme.ashrose.name": "Ashrose",
  "settings.appearance.theme.ashrose.desc":
    "Ros och rosa — mild värme.",
  "settings.appearance.theme.workshop.name": "Workshop",
  "settings.appearance.theme.workshop.desc":
    "Djupt bläck och brons — standard.",
  "settings.appearance.theme.graphite.name": "Graphite",
  "settings.appearance.theme.graphite.desc":
    "Lugna neutrala gråtoner — återhållsamt.",
  "settings.appearance.theme.dracula.name": "Dracula",
  "settings.appearance.theme.dracula.desc":
    "Lila på marinblått — kultklassikern.",
  "settings.appearance.language": "Språk",
  "settings.appearance.languageHint":
    "Språket Yarrows gränssnitt visas på. Själva anteckningarna översätts inte.",
  "settings.appearance.macFudge.title": "Korrigering av nederkant på macOS",
  "settings.appearance.macFudge.aside": "endast macOS · uppdateras direkt",
  "settings.appearance.macFudge.hint":
    "Om appens nederkant ser avskuren ut — om statusraden, Aktivitet eller Papperskorg hamnar precis under det synliga fönstret — välj en större korrigering. macOS rapporterar fönsterstorleken på ett sätt som Yarrow inte alltid kan lita på, så det här skär bort ett fast antal pixlar från nederkanten. De flesta behöver inte röra det här.",
  "settings.appearance.macFudge.custom":
    "Ett anpassat värde är aktivt nu. Välj en förinställning för att ersätta det.",
  "settings.appearance.macFudge.none.label": "Ingen",
  "settings.appearance.macFudge.none.sub": "0 px",
  "settings.appearance.macFudge.small.label": "Liten",
  "settings.appearance.macFudge.small.sub": "90 px",
  "settings.appearance.macFudge.medium.label": "Mellan",
  "settings.appearance.macFudge.medium.sub": "100 px · standard",
  "settings.appearance.macFudge.large.label": "Stor",
  "settings.appearance.macFudge.large.sub": "150 px",
  "settings.appearance.macFudge.xlarge.label": "Extra stor",
  "settings.appearance.macFudge.xlarge.sub": "220 px",
};
