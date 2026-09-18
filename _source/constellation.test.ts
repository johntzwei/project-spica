import { describe, expect, test } from "bun:test";
import { coreGlow, dayDim, dayWash, haloDayTileMarkup, haloGlow, haloTileMarkup, layoutConstellation, spicaDayTileMarkup, spicaTileMarkup } from "./public/constellation.js";

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

  test("bakes the same 13 retained background stars into the artwork", () => {
    const stars = tiles.filter((tile: any) => tile.star)
      .sort((a: any, b: any) => a.center[0] - b.center[0]);
    // Snapshot of the former browser pass: baking must not reshuffle the sky.
    expect(stars.map((tile: any) => tile.center)).toEqual([
      [102.91, 70.51], [140.69, 22.02], [225.49, 69.3],
      [409.35, 119.92], [479.92, 62.98], [543.79, 35.94],
      [654.2, 82.7], [744.54, 52.08], [872.97, 85.07],
      [954.21, 17.68], [1138.57, 21.18], [1255.12, 44.99],
      [1362.62, 143.33],
    ]);
    expect(artwork.match(/data-sky="star"/g)).toHaveLength(13);
  });

  test("bakes dimmed star colors and leaves all other sky tiles unlit", () => {
    const painted = new Map([...artwork.matchAll(/<path (data-sky="star" )?fill="#([a-f0-9]+)" d="([^"]+)"\/>/g)]
      .map(([, star, color, outline]) => [outline, { star: Boolean(star), color }]));
    for (const tile of tiles) {
      const outline = `M${tile.points.map((point: number[]) => point.map(n => n.toFixed(2)).join(" ")).join("L")}Z`;
      const actual = painted.get(outline)!;
      expect(actual).toBeDefined();
      expect(actual.star).toBe(tile.star);
      if (tile.star) {
        const expected = [0, 2, 4].map(offset => {
          const moon = parseInt(tile.moon.slice(offset, offset + 2), 16);
          const sky = parseInt(tile.sky.slice(offset, offset + 2), 16);
          return Math.round(moon * 0.55 + sky * 0.45).toString(16).padStart(2, "0");
        }).join("");
        expect(actual.color).toBe(expected);
        expect(luminance(actual.color)).toBeLessThan(luminance(tile.moon));
        expect(luminance(actual.color)).toBeGreaterThan(luminance(tile.sky));
      } else {
        // Includes the eight formerly bright tiles: no correction layer needed.
        expect(actual.color).toBe(tile.sky);
      }
    }
  });

  test("leaves background stars and retired overlays out of the browser pass", () => {
    for (const retired of ["night-star-dimming", "dimmedTileMarkup", "starField", "nightDimming", "visibleStarCount",
      "virgo", "spica-raster", "night-sky-adjustments", "diagonals", "armDirections"]) {
      expect(script).not.toContain(retired);
    }
  });
});
