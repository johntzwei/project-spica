import { describe, expect, test } from "bun:test";
import { coreGlow, dayDim, dayWash, dimmedTileMarkup, haloDayTileMarkup, haloGlow, haloTileMarkup, layoutConstellation, nightDimming, spicaDayTileMarkup, spicaTileMarkup, starField, visibleStarCount } from "./public/constellation.js";

const tiles = await Bun.file(new URL("./public/images/sky-tiles.json", import.meta.url)).json();
const artwork = await Bun.file(new URL("./public/images/spica-mosaic-night.svg", import.meta.url)).text();
const script = await Bun.file(new URL("./public/constellation.js", import.meta.url)).text();
const geometry = new Set([...artwork.matchAll(/ d="([^"]+)"/g)].map(match => match[1]));

const fill = (markup: string) => markup.match(/fill="#([a-f0-9]+)"/)![1];
// Relative luminance, so "dimmer" means dimmer to the eye rather than a smaller
// number in some channel: a pale blue and a pale yellow can share a red value.
const luminance = (hex: string) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
  const channel = parseInt(hex.slice(index * 2, index * 2 + 2), 16) / 255;
  return sum + weight * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
}, 0);

describe("Spica: one bright tessera with a halo", () => {
  test.each([
    ["desktop", [290, 100]],
    ["tablet", [450, 108]],
    ["mobile", [850, 97]],
  ])("sits on the tile nearest the i's dot on %s", (_name, dot) => {
    const layout = layoutConstellation(tiles, dot);
    // The heading never moves more than half a tessera to meet the mosaic.
    expect(Math.hypot(...layout.shift)).toBeLessThan(7);
    expect(layout.spica.center).toEqual([dot[0] + layout.shift[0], dot[1] + layout.shift[1]]);
    expect(tiles.includes(layout.spica)).toBe(true);
    // Pure selection is stable, so resize does not drift or change the star.
    expect(layoutConstellation(tiles, dot)).toEqual(layout);
  });

  test.each([
    ["desktop", [290, 100]],
    ["tablet", [450, 108]],
    ["mobile", [850, 97]],
  ])("rings the star with a halo that fades outward on %s", (_name, dot) => {
    const { spica, halo } = layoutConstellation(tiles, dot);
    expect(halo.length).toBeGreaterThan(3);
    expect(halo.map(entry => entry.tile)).not.toContain(spica);
    expect(new Set(halo.map(entry => entry.tile)).size).toBe(halo.length);
    // NOTE: [thought process] The halo is taken by radius with no regard for
    // direction, which is the whole reason it replaced the cross: a selection
    // that cannot prefer one direction over another cannot come out crooked.
    // So what is asserted is the falloff, not any shape.
    for (const [index, entry] of halo.entries()) {
      expect(entry.falloff).toBeGreaterThan(0);
      expect(entry.falloff).toBeLessThanOrEqual(1);
      if (index) expect(entry.falloff).toBeLessThanOrEqual(halo[index - 1].falloff);
      // Every halo tile keeps its own fitted outline and ceramic joints.
      const markup = haloTileMarkup(entry.tile, entry.falloff * haloGlow);
      expect(geometry.has(markup.match(/ d="([^"]+)"/)![1])).toBe(true);
      // By day the halo darkens rather than lights, so the washed centre tile
      // is the only thing catching light against the red raster.
      const daylight = haloDayTileMarkup(entry.tile, entry.falloff * dayDim);
      expect(daylight).toContain('fill="#291710"');
      expect(daylight).not.toContain('fill="#fff2cf"');
    }

    // NOTE: [thought process] Brightness is checked against each tile's own
    // sky rather than a shared number. Blending from the moon glaze instead
    // made every halo tile land near white whatever its distance, turning the
    // glow into a flat blob -- the failure this assertion exists to catch.
    const brightness = (entry: any) =>
      luminance(fill(haloTileMarkup(entry.tile, entry.falloff * haloGlow)));
    for (const entry of halo) {
      expect(brightness(entry)).toBeGreaterThanOrEqual(luminance(entry.tile.sky) - 1e-9);
      expect(brightness(entry)).toBeLessThan(luminance(fill(spicaTileMarkup(spica, coreGlow))));
    }
    // The innermost tile clearly outshines the outermost, so it reads as a glow.
    expect(brightness(halo[0])).toBeGreaterThan(brightness(halo[halo.length - 1]));
  });

  test("lights Spica brighter than any ordinary star, on its fitted outline", () => {
    const brightestOrdinaryStar = Math.max(...tiles.map((tile: any) => luminance(tile.moon)));
    const { spica } = layoutConstellation(tiles, [290, 100]);
    const markup = spicaTileMarkup(spica, coreGlow);
    expect(luminance(fill(markup))).toBeGreaterThan(brightestOrdinaryStar);
    // The lit tile reuses the generated outline instead of a drawn star shape.
    expect(geometry.has(markup.match(/ d="([^"]+)"/)![1])).toBe(true);
    expect(markup).toContain('stroke="#fff2cf"');
    expect(markup).not.toContain("<circle");
    expect(markup).not.toContain("transform=");
  });

  test("daylight only tints Spica, dimly and without a solid fill", () => {
    const { spica } = layoutConstellation(tiles, [290, 100]);
    const markup = spicaDayTileMarkup(spica);
    // A translucent wash lightens the red day raster instead of replacing it.
    // Staying under 1 is the property that matters; the exact value is a design
    // choice, so the test follows the source instead of fixing it.
    expect(dayWash).toBeGreaterThan(0);
    expect(dayWash).toBeLessThan(1);
    expect(dayDim).toBeGreaterThan(0);
    expect(dayDim).toBeLessThan(1);
    expect(markup).toContain(`fill-opacity="${dayWash}"`);
    expect(geometry.has(markup.match(/ d="([^"]+)"/)![1])).toBe(true);
  });

  test("dims the surviving stars without erasing them into the sky", () => {
    expect(tiles.filter((tile: any) => tile.star)).toHaveLength(21);
    const { kept } = starField(tiles);
    for (const tile of kept) {
      const dimmed = luminance(fill(dimmedTileMarkup(tile, nightDimming.star, "dimmed-star")));
      expect(dimmed).toBeLessThan(luminance(tile.moon));
      // A star pulled all the way to its sky color would leave a hole.
      expect(dimmed).toBeGreaterThan(luminance(tile.sky));
    }
    expect(nightDimming.star).toBeGreaterThan(0);
    expect(nightDimming.star).toBeLessThan(1);
  });

  test("thins the field to the visible count, spread across the sky", () => {
    const { kept, removed } = starField(tiles);
    expect(kept).toHaveLength(visibleStarCount);
    expect(removed).toHaveLength(21 - visibleStarCount);
    expect(new Set([...kept, ...removed]).size).toBe(21);
    // A removed star is repainted in its own sky color, leaving no bright patch.
    for (const tile of removed) {
      expect(fill(dimmedTileMarkup(tile, 1, "removed-star"))).toBe(tile.sky);
    }
    // NOTE: [thought process] Counting per third is what distinguishes an even
    // thinning from one that happens to total 13 while clearing a whole region.
    const third = (tile: any) => Math.min(2, Math.floor(tile.center[0] / (1400 / 3)));
    const perThird = [0, 1, 2].map(index => removed.filter((tile: any) => third(tile) === index).length);
    expect(Math.max(...perThird) - Math.min(...perThird)).toBeLessThanOrEqual(2);
    for (const index of [0, 1, 2]) {
      expect(kept.filter((tile: any) => third(tile) === index).length).toBeGreaterThan(0);
    }
    // Selection is pure, so the field does not reshuffle between renders.
    expect(starField(tiles)).toEqual({ kept, removed });
  });

  test("leaves the generated star field and the retired overlays alone", () => {
    expect(artwork.match(/data-sky="star"/g)).toHaveLength(21);
    // NOTE: [thought process] The cross is gone deliberately, not by accident.
    // These names are listed so that reintroducing arms, spikes or a Virgo
    // overlay has to be a decision someone makes against a failing test.
    for (const retired of ["virgo", "spica-raster", "night-sky-adjustments", "diagonals", "armDirections"]) {
      expect(script).not.toContain(retired);
    }
  });
});
