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
};
