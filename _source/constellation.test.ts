import { describe, expect, test } from "bun:test";
import { layoutConstellation, tileMarkup } from "./public/constellation.js";

const tiles = await Bun.file(new URL("./public/images/sky-tiles.json", import.meta.url)).json();
const artwork = await Bun.file(new URL("./public/images/spica-mosaic-night.svg", import.meta.url)).text();
const geometry = new Set([...artwork.matchAll(/ d="([^"]+)"/g)].map(match => match[1]));

describe("title-anchored Spica mosaic", () => {
  test("favicon retains the compact five-tile Spica mark", async () => {
    const favicon = await Bun.file(new URL("./public/favicon.svg", import.meta.url)).text();
    const { spicaCore } = layoutConstellation(tiles, [286.42, 104.01], 0.91);
    expect(favicon.match(/data-tile="spica"/g)).toHaveLength(5);
    for (const tile of spicaCore) {
      expect(favicon).toContain(tileMarkup(tile, "spica").match(/d="[^"]+"/)![0]);
    }
  });

  test("exports the original fitted tile outlines", () => {
    for (const tile of tiles) {
      const outline = `M${tile.points.map((p: number[]) => p.map(n => n.toFixed(2)).join(" ")).join("L")}Z`;
      expect(geometry.has(outline)).toBe(true);
    }
  });

  test.each([
    ["desktop", [290, 100], 0.91],
    ["tablet", [450, 108], 0.83],
    ["mobile", [850, 97], 0.83],
  ])("keeps Spica at the i's dot on %s", (_name, dot, scale) => {
    const layout = layoutConstellation(tiles, dot, scale);
    expect(Math.hypot(...layout.shift)).toBeLessThan(7);
    expect(layout.spica.center).toEqual([dot[0] + layout.shift[0], dot[1] + layout.shift[1]]);
    expect(layout.spicaCore).toHaveLength(5);
    expect(layout.spicaTiles).toHaveLength(9);
    expect(new Set(layout.spicaTiles).size).toBe(9);
    expect(layout.spicaTiles[0]).toBe(layout.spica);
    for (const tile of layout.spicaTiles) expect(tiles.includes(tile)).toBe(true);
    expect(layout.hiddenStars.length).toBeGreaterThanOrEqual(4);
    expect(layout.hiddenStars.length).toBeLessThanOrEqual(6);
    expect(layoutConstellation(tiles, dot, scale)).toEqual(layout);
  });

  test("the raw night mosaic still uses the fitted star tiles", () => {
    const rawStars = tiles.filter((tile: any) => tile.star);
    expect(rawStars).toHaveLength(21);
    expect(artwork.match(/data-sky="star"/g)).toHaveLength(21);
  });

  test("Spica is brighter than ordinary stars at night", () => {
    const luminance = (hex: string) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
      const channel = parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
      return sum + weight * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    }, 0);
    const brightestOrdinaryStar = Math.max(...tiles.map((tile: any) => luminance(tile.moon)));
    const { spicaTiles } = layoutConstellation(tiles, [290, 100], 0.91);
    const kinds = ["spica-night-center", ...Array(4).fill("spica-night"), ...Array(4).fill("spica-night-outer")];
    spicaTiles.forEach((tile: any, index: number) => {
      const markup = tileMarkup(tile, kinds[index]);
      const color = markup.match(/fill="#([a-f0-9]+)"/)![1];
      expect(luminance(color)).toBeGreaterThan(brightestOrdinaryStar);
      expect(geometry.has(markup.match(/ d="([^"]+)"/)![1])).toBe(true);
    });
  });
});
