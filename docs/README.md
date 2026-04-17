# Yarrow — GitHub Pages site

Static HTML landing page for Yarrow. No build step, no framework.

## Publishing

1. Push this repo to GitHub.
2. **Settings → Pages**:
   - Source: *Deploy from a branch*
   - Branch: `main` / folder: `/docs`
3. Your site goes live at `https://<user>.github.io/<repo>/` (or the custom
   domain you've set up) within a minute.

## Files

- `index.html` — the page
- `style.css` — all styles; brand palette matches the app
- `screenshot.png` — hero image
- `favicon.svg` — Yarrow mark

## Local preview

```bash
cd docs && python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## When the app releases

Once binaries are hosted, replace the two disabled CTAs near the bottom of
`index.html` (`<a class="btn ... disabled" aria-disabled="true">`) with real
links to the release assets and the GitHub repo.
