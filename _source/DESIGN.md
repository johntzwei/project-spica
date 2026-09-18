# Project Spica

A responsive website using Bun and TypeScript, with pages at `/mission`, `/roadmap`, and `/research` (`/` also shows Mission). No dependencies, build step, or external font/image requests. Small client-side scripts provide seamless page navigation and toggle the header mosaic's day and night themes. Each page also renders directly on the server; old `/about` and `?page=...` links redirect to the new URLs.

## Design: Ceramic

Small, hand-cut ceramic tesserae radiate around a golden sun in a crimson sky and follow ribbons of amber fields. The original sun, horizon, and field bands are preserved, without the individual wheat stalks. Main-worktree-scale tiles, chipped edges, recessed terracotta joints, and softly mottled glaze add realistic texture. Night mode is the default: blue sky tiles, a pale tiled crescent moon, sparse dimmed background stars, darker fields, a midnight background, and white paragraph text. The stars recolor existing tesserae rather than drawing independent stars or lines. Spica is the dot of the i (also retained in day mode): one bright tile with a softly glowing halo. A responsive SVG color layer uses the exact generated tile geometry and glaze for the selected composition; the heading snaps by at most half a tile to keep the dot aligned through mobile cropping, resizing and browser zoom. Click the moon (or focus it and press Enter/Space) to switch to light mode; click the sun to return to night mode. Without JavaScript (or if the tile data fails to load), the starry night artwork and a normal dotted i remain visible.

Preview alongside the other designs with `PORT=3003 bun run dev`.

## Run

Install [Bun](https://bun.sh), then:

```sh
bun run dev
```

Open http://localhost:3000. Bun watches the server; refresh the browser after editing HTML or CSS.

```sh
bun start           # Run without watch mode
PORT=8080 bun start # Use a different port
bun test           # Run the server tests
```

## Edit

- `public/index.html` — four-paragraph introduction and research roadmap.
- `public/styles.css` — responsive layout and USC-inspired burgundy, cardinal, tan, gold, and yellow palette.
- `public/theme.js` — accessible sun/moon theme toggle.
- `public/constellation.js` — title-anchored recoloring of existing sky tiles, using `public/images/sky-tiles.json` exported by the generator.
- `public/navigation.js` — path-based navigation with browser history and focus handling.
- `public/research/localizing-memorization.pdf` — retained research report, *Localizing latent mechanisms in weight space by spiking the training data*; no longer linked from the page.
- `public/images/spica-mosaic.svg` and `spica-mosaic-night.svg` — original day/night vector artwork, retained as editable sources.
- `public/images/spica-mosaic*.webp` — five full-height compositions (4:1, 6:1, 8:1, 12:1, 18:1), with separate raster-density choices. Only the selected day/night pair loads. Wider canvases add ceramic tiles instead of stretching the original image. Sky/field edge strips extend the largest canvas on extreme widths without repeating the sun/moon.
- `public/mosaic-layout.js` — shared composition dimensions, breakpoints, sun position and asset naming; keep CSS media queries synchronized (covered by tests).
- `scripts/generate-mosaic.ts` — deterministic SVG artwork generator. Original SVGs remain checked in; wider vectors are generated temporarily during export.
- `scripts/export-mosaics.ts` — exports quality-90 WebPs, edge strips and matched sky-tile JSON with the SVG texture baked in; requires `rsvg-convert` (librsvg) and `magick` (ImageMagick with WebP support), only when regenerating artwork.
- `scripts/check-mosaics.mjs` — optional real-browser zoom/screenshot checks; see the repository README for setup.
- `server.ts` — Bun HTTP server with an explicit public-asset allowlist.

```sh
bun run images:export   # Re-export WebPs from the existing SVGs
bun run images:generate # Regenerate both SVGs and their WebP versions
```

Generated images are checked in; running the website requires no image tools or build step.
