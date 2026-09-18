import { describe, expect, test } from "bun:test";
import { coreGlow, dayWash, dimmedTileMarkup, layoutConstellation, nightDimming, spicaDayTileMarkup, spicaTileMarkup, starField, visibleStarCount } from "./public/constellation.js";

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

describe("Spica: a dim day core and a night cross", () => {
  test.each([
    ["desktop", [290, 100]],
    ["tablet", [450, 108]],
    ["mobile", [850, 97]],
  ])("keeps Spica at the i's dot on %s", (_name, dot) => {
    const layout = layoutConstellation(tiles, dot);
    // The heading never moves more than half a tessera to meet the mosaic.
    expect(Math.hypot(...layout.shift)).toBeLessThan(7);
    expect(layout.spica.center).toEqual([dot[0] + layout.shift[0], dot[1] + layout.shift[1]]);
    expect(layout.core).toHaveLength(5);
    expect(layout.arms).toHaveLength(4);
    expect(layout.diagonals).toHaveLength(4);
    const all = [...layout.core, ...layout.arms, ...layout.diagonals];
    // No tessera is lit twice, so the rings never overlap or cancel out.
    expect(new Set(all).size).toBe(13);
    expect(layout.core[0]).toBe(layout.spica);
    for (const tile of all) expect(tiles.includes(tile)).toBe(true);

    // NOTE: [thought process] These four assertions are the shape of the star.
    // An earlier version picked one arm per edge of the Spica tile, which let
    // two arms face nearly the same way and left the cross with two arms up
    // and none down. Naming the axes here is what stops that returning.
    const angle = (tile: any) => Math.atan2(
      tile.center[1] - layout.spica.center[1], tile.center[0] - layout.spica.center[0]) * 180 / Math.PI;
    const off = (tile: any, axis: number) => {
      const difference = Math.abs(angle(tile) - axis);
      return difference > 180 ? 360 - difference : difference;
    };
    const along = (ring: any[], axis: number) => ring.filter((tile: any) => off(tile, axis) < 50);

    // Exactly one arm per screen axis: one up, one down, one left, one right.
    for (const axis of [0, 90, 180, -90]) expect(along(layout.core.slice(1), axis)).toHaveLength(1);
    // The vertical arms are the ones the eye checks, so they are held tightest.
    for (const axis of [90, -90]) expect(off(along(layout.core.slice(1), axis)[0], axis)).toBeLessThan(10);
    // Each outer arm continues its own inner arm, rather than kinking off it.
    for (const outer of layout.arms) {
      const inner = along(layout.core.slice(1), angle(outer));
      expect(inner).toHaveLength(1);
      expect(off(outer, angle(inner[0]))).toBeLessThan(16);
      // ...and sits beyond it, so the arm runs outward rather than doubling back.
      const reach = (tile: any) => Math.hypot(
        tile.center[0] - layout.spica.center[0], tile.center[1] - layout.spica.center[1]);
      expect(reach(outer)).toBeGreaterThan(reach(inner[0]));
    }
    // The cross reaches five tesserae across: centre plus two along each arm.
    const width = Math.max(...layout.core[0].points.map((p: number[]) => p[0]))
      - Math.min(...layout.core[0].points.map((p: number[]) => p[0]));
    const horizontal = [...layout.core, ...layout.arms].flatMap((tile: any) => tile.points.map((p: number[]) => p[0]));
    expect((Math.max(...horizontal) - Math.min(...horizontal)) / width).toBeGreaterThan(4.5);
    // Spikes stay shorter than the arms, so they read as refraction off a
    // bright star instead of turning the cross into a second, rotated one.
    const reach = (ring: any[]) => ring.map((tile: any) =>
      Math.hypot(tile.center[0] - layout.spica.center[0], tile.center[1] - layout.spica.center[1]));
    expect(Math.max(...reach(layout.diagonals))).toBeLessThan(Math.min(...reach(layout.arms)));
    // Pure selection is stable, so resize does not drift or change tile geometry.
    expect(layoutConstellation(tiles, dot)).toEqual(layout);
  });

  test("steps the night down from the core through the arms to the field", () => {
    const { core, arms, diagonals } = layoutConstellation(tiles, [290, 100]);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const lit = mean(core.map((tile: any) => luminance(fill(spicaTileMarkup(tile, coreGlow)))));
    const dimmed = (ring: any[], amount: number) =>
      mean(ring.map((tile: any) => luminance(fill(dimmedTileMarkup(tile, amount, "x")))));
    const arm = dimmed(arms, nightDimming.arm);
    const spike = dimmed(diagonals, nightDimming.diagonal);
    const field = dimmed(starField(tiles).kept, nightDimming.star);

    // The cross reads by brightness order, not by shape alone.
    expect(lit).toBeGreaterThan(arm);
    expect(arm).toBeGreaterThan(spike);
    expect(spike).toBeGreaterThan(field);
    // NOTE: [thought process] Ordering alone would pass with the tiers a
    // hairsbreadth apart, which is exactly the failure that loses a tier to the
    // eye. Requiring real separation is what the design actually depends on.
    expect(arm - spike).toBeGreaterThan(0.1);
    expect(lit - arm).toBeGreaterThan(0.1);

    // NOTE: [thought process] The undimmed moon glaze is the reference. Lifting
    // a tile less would still land above it, so every dimmed tier must sit
    // below it to count as actually dimmed.
    const rawGlaze = mean(tiles.map((tile: any) => luminance(tile.moon)));
    for (const tier of [arm, spike, field]) expect(tier).toBeLessThan(rawGlaze);
    expect(lit).toBeGreaterThan(Math.max(...tiles.map((tile: any) => luminance(tile.moon))));
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
    for (const amount of Object.values(nightDimming)) {
      expect(amount).toBeGreaterThan(0);
      expect(amount).toBeLessThan(1);
    }
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

  test("daylight only tints the core, dimly and without a solid fill", () => {
    const { core } = layoutConstellation(tiles, [290, 100]);
    for (const tile of core) {
      const markup = spicaDayTileMarkup(tile);
      // A translucent wash lightens the red day raster instead of replacing it.
      // Staying under 1 is the property that matters; the exact value is a
      // design choice, so the test follows the source instead of fixing it.
      expect(dayWash).toBeGreaterThan(0);
      expect(dayWash).toBeLessThan(1);
      expect(markup).toContain(`fill-opacity="${dayWash}"`);
      expect(geometry.has(markup.match(/ d="([^"]+)"/)![1])).toBe(true);
      expect(markup).not.toContain("<circle");
    }
  });

  test("all five core tiles outshine ordinary stars and retain their fitted edges", () => {
    const brightestOrdinaryStar = Math.max(...tiles.map((tile: any) => luminance(tile.moon)));
    const { core } = layoutConstellation(tiles, [290, 100]);
    for (const tile of core) {
      const markup = spicaTileMarkup(tile, coreGlow);
      expect(luminance(fill(markup))).toBeGreaterThan(brightestOrdinaryStar);
      // The lit tile reuses the generated outline instead of a drawn star shape.
      expect(geometry.has(markup.match(/ d="([^"]+)"/)![1])).toBe(true);
      expect(markup).toContain('stroke="#fff2cf"');
      expect(markup).toContain('stroke="#291710"');
      expect(markup).not.toContain("<circle");
      expect(markup).not.toContain("transform=");
    }
  });

  test("favicon shows the same five tile outlines as the heading", async () => {
    const favicon = await Bun.file(new URL("./public/favicon.svg", import.meta.url)).text();
    // The title's dot in mosaic coordinates at a 1400px desktop viewport.
    const { core } = layoutConstellation(tiles, [286.42, 104.01]);
    expect(favicon.match(/data-tile="spica"/g)).toHaveLength(5);
    for (const tile of core) {
      expect(favicon).toContain(spicaTileMarkup(tile, coreGlow).match(/d="[^"]+"/)![0]);
    }
  });

  test("leaves the generated star field and the retired overlays alone", () => {
    expect(artwork.match(/data-sky="star"/g)).toHaveLength(21);
    expect(script).not.toContain("virgo");
    expect(script).not.toContain("spica-raster");
    expect(script).not.toContain("night-sky-adjustments");
  });
});
