# Project Spica

The website at **https://projectspica.org**, based on the ceramic mosaic design from
[`CtrlVGustavo/spica-website`](https://github.com/CtrlVGustavo/spica-website), revision
`1d26186`. Mission, Roadmap, Research and People render independently, including
without JavaScript. The mosaic theme toggle and client-side navigation progressively
enhance these static pages.

## Development

Install Bun 1.4.0, then:

```sh
bun run dev             # Original Bun development server, http://localhost:3000
bun test _source        # Rendering, navigation, constellation and export tests
bun run build           # Static export to _build/
bun run preview         # Preview the actual export, http://localhost:3000
PORT=3003 bun run preview
```

No dependencies or asset-generation tools are needed to build or run the site.

- `_source/public/index.html`: content template.
- `_source/public/styles.css`: responsive styling.
- `_source/public/{theme,constellation,navigation,legacy}.js`: browser behavior.
- `_source/public/images/`: checked-in mosaic assets.
- `_source/public/research/`: original research PDFs.
- `_source/articles/`: standalone research article bodies and [transcription notes](_source/articles/README.md).
- `_source/public/og.png`: 1200 × 630 social-sharing image using the new night mosaic.
- `_source/server.ts`: development rendering and explicit asset allowlist.
- `_source/scripts/build.ts`: static export and production metadata.
- `_source/DESIGN.md`: upstream design/artwork notes.

The exported site uses `/mission/`, `/roadmap/`, `/research/` and `/people/`.
GitHub Pages redirects their slashless equivalents to the directory URLs.
`/` also displays Mission; its canonical URL is `/mission/`.
The Research list links to the full HTML report at
`/research/localizing-memorization/`, using the same shell and native MathML.
Its PDF remains available at `/research/localizing-memorization.pdf`.

## Publishing

GitHub Pages still publishes **`main`, repository root**, using Jekyll. The domain,
DNS, HTTPS enforcement and `www` redirect are unchanged. No Pages administration
access or new hosting account is required.

After editing source files:

```sh
bun test _source
bun run publish:prepare # Build and copy the static export into the repository root
bun run build:check     # Ensure checked-in output matches the source
# Review and commit both source and generated files, then push main.
```

**Do not edit generated root HTML, CSS, JS, images or PDFs directly.** They are
copied from `_source/` or rendered by the exporter. If retiring a generated file,
remove its old published copy as well; the preparation command does not delete
unrelated repository files.

Jekyll excludes `_source/`, `_build/`, dotfiles and the development files listed
in `_config.yml`. **Do not add `.nojekyll`**: it would disable those exclusions.
The published files contain no application server, tests, or tooling. The
`Check website` workflow tests the source and checks the generated output; the
existing Pages workflow handles deployment independently. Run checks locally
before pushing because branch protection does not enforce this workflow.

The static preview models directory redirects and 404s, but is not Jekyll itself.
Production verification should check `/`, all four pages, the research article,
both PDFs, `/about/`,
unknown paths, and that `/_source/server.ts` and `/package.json` return 404.

## Compatibility and deliberate changes

- `/#about` → `/mission/`; `/#approach` and `/#usecaseCarousel` → `/roadmap/`;
  `/#people` → `/people/`.
- `/#activities` → the existing Substack publication;
  `/#subscribe` → its subscription page.
- `/?page=about`, `mission`, `roadmap`, `research` and `people` are mapped to the
  new page URLs. Unrelated query parameters are preserved for local destinations.
- `/about/` includes an HTML refresh redirect and a normal fallback link to Mission.
  Query/hash compatibility uses `legacy.js`; fragments and query redirects cannot
  be HTTP 301s on GitHub Pages. Without JavaScript, the normal navigation works,
  but homepage legacy hashes/query strings leave visitors on Mission.
- Google Analytics is intentionally not carried forward. The replacement remains
  free of tracking scripts and third-party font/image requests. The old X footer
  and subscription form are not part of the new design; legacy Substack links work.
- Social-sharing metadata and the image are updated; `/og.png` remains valid.
- The old Bun server's custom response headers are not configurable on Pages.
  Exported pages include a meta CSP. This cannot enforce `frame-ancestors`, unlike
  a response header, and Pages controls caching and other response headers.

## Rollback

The pre-migration production commit is `66d5f26`, tagged
`pre-mosaic-migration-66d5f26`. To undo deployment, revert the migration commit on
`main` and push it (do not force-push or replace repository history). Pages will
rebuild the previous website at the same domain. Domain/DNS changes are not needed.

## Artwork

Generated artwork is committed. The original night image retains its 13 dimmed
background stars; wider compositions keep a similar sparse star density.
`constellation.js` only adds the heading-aligned Spica star and halo, using exact
sky tiles for the selected composition. It leaves an ordinary dotted i while
images/geometry load or if they fail.

### Responsive mosaic

The banner shows the artwork's **full height**, cropping horizontally around the
sun/moon when necessary. `<picture>` selects composition; `srcset` independently
selects resolution. Browser zoom naturally changes the CSS viewport and triggers
the same selection as a window resize. No zoom detection is used.

| Composition | Artwork dimensions | CSS viewport width |
| --- | --- | --- |
| Standard | 1400 × 350 | ≤1280px (including mobile) |
| Wide | 2100 × 350 | >1280–1920px |
| Ultrawide | 2800 × 350 | >1920–2560px |
| Panoramic | 4200 × 350 | >2560–3840px |
| Extreme | 6300 × 350 | >3840px |

Above 5760px, the main canvas stops growing and its mirrored right-edge sky/field
continues across the remaining width—never another sun or moon. The title stays
on the main canvas. All compositions retain square-scale tiles, full celestial
bodies and continuous fields. Both selected theme images load, not every variant.

- `_source/public/mosaic-layout.js`: shared composition, sun and export metadata.
- `_source/public/styles.css`: matching media queries and full-height geometry.
- `_source/server.ts`: injects static picture sources and allowlists new assets.
- `_source/scripts/generate-mosaic.ts`: deterministic landscape/tile generator.
- `_source/scripts/export-mosaics.ts`: WebPs and matched sky-tile JSON. Wider JSON
  contains only the title's sky corridor and halo margin to avoid shipping unused
  tile geometry. Wider SVGs are generated temporarily, not published or committed.

Only regenerating artwork needs `rsvg-convert` and ImageMagick:

```sh
bun run images:export   # Keep original SVGs; regenerate/export wider compositions
bun run images:generate # Regenerate all artwork, including original SVGs
```

`bun test _source` checks breakpoint consistency, raster dimensions, deterministic
artwork and tile alignment. For optional screenshots and real Chromium zoom
checks, start `bun run preview` after building and supply an installed Playwright
module (a package name or absolute path; no browser tooling is needed to publish):

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
CHROMIUM=/usr/bin/chromium ORIGIN=http://localhost:3000 \
node _source/scripts/check-mosaics.mjs
```

The browser check uses an isolated temporary profile, tests 25–200% actual zoom,
320–12000px widths, both themes, DPR 2, breakpoint transitions, no JavaScript,
failed resources and out-of-order geometry responses. It saves screenshots and
measurements under `/tmp` (override with `SCREENSHOTS=/path`).
