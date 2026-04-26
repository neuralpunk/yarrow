// Settings → Appearance pane.

export const appearanceEN = {
  "settings.appearance.title": "Appearance",
  "settings.appearance.hint":
    "How Yarrow looks on your screen. Your choice is saved on this machine.",
  "settings.appearance.theme": "Theme",
  "settings.appearance.themeHint":
    "Auto follows your system light/dark preference.",
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
  "settings.appearance.macFudge.small.sub": "80 px",
  "settings.appearance.macFudge.medium.label": "Medium",
  "settings.appearance.macFudge.medium.sub": "150 px · default",
  "settings.appearance.macFudge.large.label": "Large",
  "settings.appearance.macFudge.large.sub": "220 px",
  "settings.appearance.macFudge.xlarge.label": "X-Large",
  "settings.appearance.macFudge.xlarge.sub": "300 px",
} as const;

export type AppearanceKey = keyof typeof appearanceEN;

export const appearanceES: Record<AppearanceKey, string> = {
  "settings.appearance.title": "Apariencia",
  "settings.appearance.hint":
    "Cómo se ve Yarrow en tu pantalla. Tu elección se guarda en este equipo.",
  "settings.appearance.theme": "Tema",
  "settings.appearance.themeHint":
    "Auto sigue la preferencia de claro/oscuro de tu sistema.",
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
  "settings.appearance.macFudge.small.sub": "80 px",
  "settings.appearance.macFudge.medium.label": "Mediano",
  "settings.appearance.macFudge.medium.sub": "150 px · predeterminado",
  "settings.appearance.macFudge.large.label": "Grande",
  "settings.appearance.macFudge.large.sub": "220 px",
  "settings.appearance.macFudge.xlarge.label": "Extra grande",
  "settings.appearance.macFudge.xlarge.sub": "300 px",
};

export const appearanceSV: Record<AppearanceKey, string> = {
  "settings.appearance.title": "Utseende",
  "settings.appearance.hint":
    "Hur Yarrow ser ut på din skärm. Ditt val sparas på den här datorn.",
  "settings.appearance.theme": "Tema",
  "settings.appearance.themeHint":
    "Auto följer ditt systems ljus/mörker-inställning.",
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
  "settings.appearance.macFudge.small.sub": "80 px",
  "settings.appearance.macFudge.medium.label": "Mellan",
  "settings.appearance.macFudge.medium.sub": "150 px · standard",
  "settings.appearance.macFudge.large.label": "Stor",
  "settings.appearance.macFudge.large.sub": "220 px",
  "settings.appearance.macFudge.xlarge.label": "Extra stor",
  "settings.appearance.macFudge.xlarge.sub": "300 px",
};
