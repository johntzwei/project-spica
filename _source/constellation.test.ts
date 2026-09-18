import { describe, expect, test } from "bun:test";

const tiles = await Bun.file(new URL("./public/images/sky-tiles.json", import.meta.url)).json();
const artwork = await Bun.file(new URL("./public/images/spica-mosaic-night.svg", import.meta.url)).text();
const script = await Bun.file(new URL("./public/constellation.js", import.meta.url)).text();

describe("plain mosaic night sky", () => {
  test("keeps the generated star field unchanged", () => {
    const stars = tiles.filter((tile: any) => tile.star);
    expect(stars).toHaveLength(21);
    expect(artwork.match(/data-sky="star"/g)).toHaveLength(21);
  });

  test("does not draw Virgo or a custom Spica overlay", () => {
    expect(script).not.toContain("virgo");
    expect(script).not.toContain("spica-raster");
    expect(script).not.toContain("spicaMarkup");
    expect(script).not.toContain("night-sky-adjustments");
    expect(script).not.toContain("querySelector");
  });
});
