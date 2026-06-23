# Project Spica — Design Notes

Design record for the website hero (and the thinking behind it). Living document:
implemented features, the rationale, and the open ideas we've discussed.

## Concept

- **Metaphor:** Spica as a *standard candle* — a source of known luminosity used
  to measure distance. This is the visual analog of **spiking**: a known input
  lets you infer a hidden quantity. The hero is built entirely around this idea.
- **Name tie-in:** Spica is the brightest star in Virgo; the project is named for
  it (Latin *spīca*, "spike"). The hero literally renders the real sky around it.

## Reference & differentiation

- Reference site we liked: **constellation.org** — clean, institutional, credible.
- We deliberately diverge from it:
  | Lever        | Constellation        | Spica                                  |
  |--------------|----------------------|----------------------------------------|
  | Background   | White, bright        | Luminous dawn palette (inverted night) |
  | Hero graphic | Node/network         | A single anchor star + real starfield  |
  | Imagery      | Stock people photos  | Generative, data-driven visualization  |
  | Type         | Neutral sans         | Editorial serif headline + clean sans  |

## Tech

- Plain **HTML / CSS / JS**, single `index.html`, canvas-based animation.
- Star data in `stars.js` (`window.STARS`), loaded via `<script src>` so it works
  offline from `file://` (avoids `fetch`/CORS issues).

## Implemented features

### Starfield (real data)
- **815 real stars** from the HYG catalogue, carved to a region around Spica
  (RA half-width 36°, Dec half-width 22°, magnitude ≤ 7.0).
- **Real positions:** RA/Dec projected relative to Spica (east-left, north-up,
  with a cos(Dec) correction).
- **Real brightness:** apparent magnitude → on-screen size and opacity (magnitude
  is logarithmic and inverted, so Spica's mag 0.98 dominance is inherent).
- **Real distance:** catalogue parsecs drive the parallax speed.
- **Real color:** each star's B-V color index (`ci`) tints it by temperature
  (hot blue ↔ cool red), mapped through `bvToColor`.

### Spica, the standard candle
- The lone **pulsing** star (artistic license — real bright stars aren't variable),
  beating on an asymmetric Cepheid light curve (fast brighten, slow dim).
- Clean near-white anchor color; **labeled** "Spica".
- Sheds faint expanding **measurement ripples** at each pulse peak.

### Diffraction spikes
- Cross-shaped glints on Spica and the brightest stars, scaled by brightness —
  the glint real bright stars show in imaging.

### Virgo figure
- Faint lines connecting the real Virgo stars (Zavijava → Zaniah → Porrima →
  Auva; Porrima → Heze → Spica; Heze → Syrma → Khambalia; Spica → Kang).
- Honest: the northern arc ends at Auva because Vindemiatrix falls outside region.
- **Assembles** during the intro, then **fades out** (~7–10s) as parallax pulls
  it apart. Faded on the left for headline readability; segments skipped if a
  star has wrapped to the far edge.

### Motion — true one-directional parallax
- Every star drifts left-to-right at `PARALLAX_BASE + PARALLAX_RANGE · near`, so
  near stars sweep past while distant ones crawl — endless flythrough, each star
  wrapping individually. Depth comes from the *speed difference*.
- (Earlier iterations: a constant rigid drift, then a sinusoidal sway. Replaced
  because the sway oscillated rather than reading as one-directional depth.)

### Entrance animation
- Stars **light up radiating outward from Spica** (a wavefront, `REVEAL_SPEED`),
  each fading *and* growing into place over `REVEAL_FADE`, after `REVEAL_DELAY`.
- Text **jumps in, staggered** (eyebrow → headline → tagline → button → caption)
  via the `riseIn` keyframe with a slight overshoot easing.

### Palette — authored night, inverted to day
- The scene is drawn in **night space** (dark sky, additive `'lighter'` starlight
  — the only domain where additive blending pools into soft glows), then the
  whole hero is **inverted** (`filter: invert(1)`).
- Result: deep-purple dawn gradient → **pale mint daybreak**, white stars →
  ink-dark points, blue accent → warm amber. All dark color literals in the code
  are therefore *pre-inversion* (documented inline).
- **Dawn horizon glow:** a dark, cool radial bloom at the bottom (authored) that
  inverts into warm first light rising from the horizon — a focal light source.
- **Film grain:** a static, desaturated SVG noise overlay (`.grain`) that dithers
  the gradient (kills banding) and adds texture, with no per-frame cost.

### Typography
- Headline: **Fraunces** (editorial serif, optical sizing), lighter weight; the
  phrase "*standard candle*" set in italic for flourish.
- Eyebrow / tagline / CTA / body: **Inter**.

### Layout / content
- Full-viewport hero: eyebrow "Project Spica", headline "A *standard candle* for
  AI.", spiking tagline, "Subscribe →" CTA (placeholder → Substack), and an
  explanatory caption (bottom-right).

## Key tunable parameters (in `index.html`)

| Parameter         | Controls                                            |
|-------------------|-----------------------------------------------------|
| `PARALLAX_BASE`   | overall one-directional drift floor                 |
| `PARALLAX_RANGE`  | extra speed for near stars (depth drama)            |
| `REVEAL_SPEED`    | how fast the entrance wavefront expands from Spica  |
| `REVEAL_FADE`     | per-star fade-in duration                           |
| `REVEAL_DELAY`    | pause before the sky begins lighting up             |
| `SPICA_PERIOD`    | Spica's pulse period                                |
| `bvToColor` ends  | hot/cool star tint range                            |
| `.grain` opacity  | film-grain intensity                                |
| horizon `0.55`    | dawn glow strength                                  |
| Bayer gradient    | dawn sky colors (pre-inversion)                     |

## Open ideas — toward "really beautiful"

Discussed; the top-three (typography, star color, grain + glow) are **done**.
Remaining, roughly by impact:

- **Intentional accent color.** The amber is currently *accidental* (whatever
  `invert` maps `#9fc4ff` to). Choose a deliberate accent (keep blue, or pick a
  green/teal to harmonize with the mint) by setting the pre-inversion value.
- **Depth of field.** Softly blur the most distant (or nearest) stars so the
  parallax feels cinematic rather than flat dots at different speeds.
- **Motion finishing.** Varied twinkle, an occasional brighter shimmer or rare
  shooting star, eased (not perfectly linear) drift.
- **Composition.** Compose Spica's placement (thirds, never colliding with the
  headline); more generous negative space and a tighter text measure.
- **Scroll cue.** A quiet indicator / sliver of the next section so the
  full-screen hero doesn't feel like a dead end.
- **`prefers-reduced-motion`.** Graceful static fallback (polish + accessibility).
- **Responsive pass.** Verify type scale and star density on small screens.

## Notes / honest caveats

- Google Fonts load over the network; offline the headline falls back to Georgia.
- The global `invert(1)` flips *everything* in the hero — fine now, but any future
  image/logo placed inside `.hero` would be inverted too.
- Spica's pulsing is deliberate artistic license, not real astronomy.
