import { describe, expect, test } from "bun:test";
import { selectHiddenStars, skyTileMarkup } from "./public/constellation.js";

const tiles = await Bun.file(new URL("./public/images/sky-tiles.json", import.meta.url)).json();
const script = await Bun.file(new URL("./public/constellation.js", import.meta.url)).text();

describe("title-anchored Spica mosaic", () => {
  test("uses a rasterized ceramic mosaic asset for Spica", async () => {
    const star = Bun.file(new URL("./public/images/spica-star-mosaic.webp", import.meta.url));
    expect(await star.exists()).toBe(true);
    expect(star.size).toBeGreaterThan(5000);
    expect(script).toContain("/images/spica-star-mosaic.webp");
    expect(script).toContain('className = "spica-raster"');
    expect(script).not.toContain("spicaMarkup");
    expect(script).not.toContain("spica-piece");
  });

  test("keeps the night background quieter by masking several baked stars", () => {
    const rawStars = tiles.filter((tile: any) => tile.star);
    expect(rawStars).toHaveLength(21);
    const hidden = selectHiddenStars(tiles);
    expect(hidden).toHaveLength(5);
    for (const tile of hidden) {
      expect(skyTileMarkup(tile)).toContain(`fill="#${tile.sky}"`);
    }
  });

  test("Virgo remains removed", () => {
    expect(script).not.toContain("const virgo");
    expect(script).not.toContain("segmentDistance");
  });
});
