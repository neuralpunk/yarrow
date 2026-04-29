# Yarrow — Third-Party Notices

This file lists third-party assets bundled with Yarrow and the licenses
under which they are used. The Yarrow source code itself is licensed
under MIT (see `LICENSE`).

## Doodle Icons (Kits illustrations)

The hand-drawn marks rendered in the Kits picker (`public/kits/*.svg`)
are taken from **Doodle Icons** by **Khushmeen Sidhu**.

- Source: <https://doodleicons.com>
- License: free for personal and commercial use per the publisher's
  stated terms; attribution preserved here as a courtesy.

Yarrow uses ~75 of the ~450 icons from this set, one per Kit slug.
Each SVG is rendered through CSS `mask-image` so the kit's own
stroke color tints the doodle — the SVG file content itself is
unmodified from the upstream release.

## Phosphor Icons (chrome glyphs)

The chrome icons (right rail, sidebar, settings nav, toolbar,
status bar) come from the **Phosphor Icons** family, weight Light.

- Authors: Helena Zhang and Tobias Fried
- Source: <https://phosphoricons.com>
- License: MIT
- Package: `@phosphor-icons/react`

## Fonts

Newsreader, Inter Tight, Fraunces, JetBrains Mono, Figtree, and
Oranienbaum are loaded via Google Fonts at runtime under their
respective licenses (SIL Open Font License). No font binaries are
redistributed in this repository.
