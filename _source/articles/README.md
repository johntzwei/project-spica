# Research articles

`localizing-memorization.html` is the article body for
`/research/localizing-memorization/`. `_source/server.ts` inserts it into the
existing site's header/navigation shell; the static exporter writes the complete
page to `research/localizing-memorization/index.html`. Client-side navigation
loads the article into the existing main content area, preserving the mosaic,
constellation and theme; direct visits and JavaScript-disabled navigation still
use complete static pages. The Research navigation item is marked
`aria-current="location"` as the article's parent section.

## Content fidelity

The source of truth is `../public/research/localizing-memorization.pdf` (September
2026, 10 pages). The HTML preserves the title, author line, five numbered sections,
12 numbered equations, five tables with their captions, and all 22 references.
Only page numbers, page breaks, line wrapping, and discretionary line-break
hyphens are removed. Wording that might appear mistaken is intentionally retained;
do not silently copyedit the report when updating its HTML version.

- Equations and inline notation use native MathML, with no JavaScript or external
  renderer. Equation 7 retains its box; equation 12 retains its underbrace labels.
  STIX Two Math is self-hosted to provide the OpenType MATH metrics needed for
  stretchy fences and braces on systems without a math font. The unmodified
  `STIXTwoMath-Regular.woff2` comes from the STIX Project's
  [v2.13b171 release](https://github.com/stipub/stixfonts/tree/v2.13b171/fonts/static_otf_woff2),
  stored as `../public/fonts/stix-two-math.woff2` with its SIL OFL 1.1 license in
  `../public/fonts/stix-two-OFL.txt`. It loads only on pages that use math.
- Tables are semantic HTML, with full captions outside the horizontal scroll
  regions so mobile readers can read captions without panning. Shaded baselines,
  summary rows, the reported edit, and bold agreement values follow the PDF.
- Citation numbers link to the numbered bibliography. Reference URLs, ISBNs,
  DOIs, and publication details are retained rather than replaced by short titles.
- The original PDF URL remains available. The Research list and Mission's
  “spiking” link open the HTML article; Mission's influence-functions link still
  opens the report PDF.

When the report changes, compare all PDF pages to the HTML, including mathematical
symbols, numeric precision, shaded/bold cells, captions, and references. Update
the PDF revision hash and corresponding content assertions in
`../article.test.ts` after that review. Check narrow and wide layouts in both
themes, with JavaScript enabled and disabled, before publishing.

Run from the repository root:

```sh
bun test _source
bun run publish:prepare
bun run build:check
```

Commit the source and generated output together. No math-rendering dependencies,
new hosting service, or Jekyll configuration changes are needed.
