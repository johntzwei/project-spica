import { describe, expect, test } from "bun:test";
import { daySkyTileMarkup, selectHiddenStars, selectSpicaUnderlayTiles, skyTileMarkup, spicaMarkup } from "./public/constellation.js";

const tiles = await Bun.file(new URL("./public/images/sky-tiles.json", import.meta.url)).json();
const artwork = await Bun.file(new URL("./public/images/spica-mosaic-night.svg", import.meta.url)).text();

describe("title-anchored Spica overlay", () => {
  test("uses a dedicated nine-piece mosaic star in both themes", () => {
    const markup = spicaMarkup();
    expect(markup).toContain('class="spica-day-mark"');
    expect(markup).toContain('class="spica-night-mark"');
    expect(markup.match(/spica-piece spica-piece-/g)).toHaveLength(18);
    for (let i = 0; i < 9; i++) {
      expect(markup.match(new RegExp(`spica-piece-${i}`, "g"))).toHaveLength(2);
    }
  });

  test("uses visibly elongated cardinal arms", () => {
    const markup = spicaMarkup();
    expect(markup).toContain("L21 -10");
    expect(markup).toContain("L59 21");
    expect(markup).toContain("L27 59");
    expect(markup).toContain("L-10 27");
  });

  test("does not rely on background tile geometry for Spica", () => {
    const markup = spicaMarkup();
    expect(markup).not.toContain("data-tile");
    expect(markup).not.toContain("moon");
    expect(markup).not.toContain("sky");
  });

  test("replaces the fitted background tiles beneath Spica", () => {
    const underlay = selectSpicaUnderlayTiles(tiles, [290, 100], 0.56);
    expect(underlay.length).toBeGreaterThan(10);
    expect(underlay.length).toBeLessThan(60);
    expect(new Set(underlay).size).toBe(underlay.length);
    for (const tile of underlay) {
      expect(skyTileMarkup(tile)).toContain(`fill="#${tile.sky}"`);
      expect(daySkyTileMarkup(tile)).toContain('data-tile="day-sky-mask"');
    }
  });

  test("keeps the night background quieter by masking several baked stars", () => {
    const rawStars = tiles.filter((tile: any) => tile.star);
    expect(rawStars).toHaveLength(21);
    const hidden = selectHiddenStars(tiles);
    expect(hidden).toHaveLength(5);
    expect(new Set(hidden).size).toBe(hidden.length);
    for (const tile of hidden) {
      expect(tile.star).toBe(true);
      expect(skyTileMarkup(tile)).toContain(`fill="#${tile.sky}"`);
    }
    expect(artwork.match(/data-sky="star"/g)).toHaveLength(21);
  });

  test("Virgo is no longer drawn by the enhancement layer", async () => {
    const script = await Bun.file(new URL("./public/constellation.js", import.meta.url)).text();
    expect(script).not.toContain("const virgo");
    expect(script).not.toContain("edges =");
    expect(script).not.toContain("segmentDistance");
    expect(script).not.toContain("spica-night-tiles");
  });
});
