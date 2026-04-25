# Yarrow Connect — Teaser Page Handoff

A coming-soon page for **Yarrow Connect**, designed to match the existing
Yarrow editorial aesthetic (Fraunces serif, JetBrains Mono, warm cream paper
with gold rules, quill feather motif).

## Files

```
connect/
├── index.html      — the page
├── connect.css     — all styles (class-prefixed .yc-*)
├── feather.png     — transparent PNG, 612×491, warm-ink tinted
└── README.md       — this file
```

## Integration notes

- **Drop-in ready.** No build step, no framework. Vanilla HTML + CSS + ~20
  lines of inline JS for the mouse parallax on the feather.
- **Class prefix.** All styles are scoped under the `.yc` body class and use
  `yc-*` class names, so they won't collide with existing site CSS. If the
  host page already has a `<body>`, either mount this as a standalone route
  or nest `<main class="yc">` inside an existing container and adjust
  `min-height` from `100svh` to `auto`.
- **Fonts.** Loaded from Google Fonts via `<link>` in `<head>`. If the host
  site already preloads these families, remove the duplicate `<link>`.
  Families used:
  - Fraunces (display serif, variable axes: SOFT, WONK, opsz, wght, italic)
  - Figtree (body sans)
  - JetBrains Mono (small caps / labels)
- **Image.** `feather.png` is a transparent, warm-ink-tinted quill derived
  from the original `feather.jpg` (white background keyed out, ink recolored
  to `#262214`). It sits naturally on the cream paper background.
- **Responsive.** Single breakpoint at 640px (mobile). On narrow screens the
  right-side masthead label collapses to `MMXXVI`, the ticker drops its last
  bullet, and everything tightens up.
- **A11y.** The page has a single `<h1>` (`Yarrow Connect`), the feather is
  decorative (`aria-hidden`, empty alt), and animation respects
  `prefers-reduced-motion`.
- **No tracking.** No email capture, no analytics. Add as needed.

## Copy

Copy is frozen in `index.html`. Key strings:

- **Masthead (L):** `Yarrow · est. 2024`
- **Masthead (R):** `A dispatch to subscribers` (mobile: `MMXXVI`)
- **Wordmark:** `Yarrow Connect`
- **Meta:** `Vol. II · № I · Arriving July MMXXVI`
- **Lead:** *A companion service for your notes — not a replacement for them.*
- **Blurb:** Sync across your devices. Edit from anywhere. Publish a path
  when it's ready to be read. All of it behind end-to-end encryption, so the
  only person reading your drafts is still you.
- **Promise card:** *Yarrow, the app, is free · open source · forever.
  Connect is an optional paid add-on.*
- **Ticker:** Sync · E2E Encrypted · Publish & Edit · Optional · Paid

## Palette

```
--yc-paper:     #f4efe2   warm cream paper
--yc-paper-hi:  #fbf6e6   upper-right glow
--yc-paper-lo:  #ede5ca   lower-left glow
--yc-ink:       #16140a   deep ink (wordmark)
--yc-ink-soft:  #5a5230   body copy
--yc-gold:      #afa464   gold rules & accents
--yc-gold-d:    #8f8553   gold deep (small caps)
```

## Suggested deploy path

```
yarrow.software/connect/       → this page
```

or, if nested:

```
yarrow.software/connect/index.html
yarrow.software/connect/connect.css
yarrow.software/connect/feather.png
```

Relative URLs already assume co-located files.
