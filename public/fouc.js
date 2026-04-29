// FOUC blocker. Reads the persisted theme config and stamps `data-theme`
// on <html> *before* the bundle parses, so the first paint already matches
// the resolved palette. Mirrors the runtime resolver in
// src/lib/theme.svelte.ts; keep them in sync.
//
// Lives in `public/` (served as-is at `/fouc.js`) instead of inline in
// index.html so the production CSP can use `script-src 'self'` without
// `'unsafe-inline'` — inline scripts are the primary XSS vehicle when
// markdown rendering misbehaves.
(function () {
  try {
    var html = document.documentElement;
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var defaultLight = "vellum";
    var defaultDark = "workshop";
    var lightSet = { vellum: 1, linen: 1, ashrose: 1 };
    var darkSet = { workshop: 1, graphite: 1, dracula: 1 };
    var palette = null;

    var rawCfg = null;
    try {
      rawCfg = localStorage.getItem("yarrow.theme.config");
    } catch (e) {}
    if (rawCfg) {
      try {
        var cfg = JSON.parse(rawCfg);
        var lt = lightSet[cfg.lightTheme] ? cfg.lightTheme : defaultLight;
        var dt = darkSet[cfg.darkTheme] ? cfg.darkTheme : defaultDark;
        if (cfg.mode === "auto") palette = prefersDark ? dt : lt;
        else if (cfg.mode === "light") palette = lt;
        else if (cfg.mode === "dark") palette = dt;
        else if (lightSet[cfg.mode] || darkSet[cfg.mode]) palette = cfg.mode;
      } catch (e) {}
    }

    if (!palette) {
      var legacy = null;
      try {
        legacy = localStorage.getItem("yarrow.theme");
      } catch (e) {}
      if (legacy === "light") palette = "linen";
      else if (legacy === "dark") palette = "graphite";
      else if (legacy === "auto") palette = prefersDark ? "graphite" : "linen";
      else if (lightSet[legacy] || darkSet[legacy]) palette = legacy;
    }

    if (!palette) palette = prefersDark ? defaultDark : defaultLight;

    html.setAttribute("data-theme", palette);
    if (darkSet[palette]) html.classList.add("dark");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "vellum");
  }
})();
