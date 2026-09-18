import { describe, expect, test } from "bun:test";
import { mosaics, mosaicName, mosaicForSource, mosaicForWidth, resolutions, sunPosition, tileFile } from "./public/mosaic-layout.js";
import { layoutConstellation } from "./public/constellation.js";
import { generateMosaic } from "./scripts/generate-mosaic";
import { handleRequest } from "./server";

const request = (path: string) => handleRequest(new Request(`http://localhost${path}`));
const css = await request("/styles.css").text();
const html = await request("/mission").text();

describe("responsive mosaic compositions", () => {
  test("selects art direction independently of raster resolution", () => {
    expect(mosaicForWidth(320).id).toBe("standard");
    expect(mosaicForWidth(12000).id).toBe("extreme");
    for (const [index, mosaic] of mosaics.entries()) {
      if (index) {
        expect(mosaicForWidth(mosaic.minWidth).id).toBe(mosaics[index - 1].id);
        expect(mosaicForWidth(mosaic.minWidth + 0.01).id).toBe(mosaic.id);
      }
      for (const night of [false, true]) {
        for (const { suffix } of resolutions(mosaic)) {
          expect(mosaicForSource(`https://projectspica.org/images/${mosaicName(mosaic, night)}${suffix}.webp`)).toBe(mosaic);
        }
      }
    }
    expect(mosaicForSource("/images/missing.webp")).toBeUndefined();
  });

  test("keeps CSS, picture sources, sizes and geometry on the same breakpoints", () => {
    const pictures = [...html.matchAll(/<picture[^>]*>([\s\S]*?)<\/picture>/g)].map(match => match[1]);
    expect(pictures).toHaveLength(2);
    expect(css).toContain("--hero-height: clamp(220px, 25vw, 320px)");
    expect(css).toContain("width: calc(var(--hero-height) * var(--mosaic-ratio))");
    for (const [index, mosaic] of mosaics.entries()) {
      if (!index) continue;
      const ratio = mosaic.width / mosaic.height;
      expect(css).toContain(`@media (width > ${mosaic.minWidth}px) {\n  .mosaic-hero { --mosaic-id: ${mosaic.id}; --mosaic-ratio: ${ratio}; }`);
      for (const [theme, picture] of pictures.entries()) {
        const sources = [...picture.matchAll(/<source(?:[^">]|"[^"]*")*>/g)].map(match => match[0]);
        const source = sources[mosaics.length - 1 - index];
        expect(source).toContain(`media="(width > ${mosaic.minWidth}px)"`);
        expect(source).toContain(`sizes="${ratio * 320}px"`);
        expect(source).toContain(`width="${mosaic.width}" height="${mosaic.height}"`);
        for (const { width, suffix } of resolutions(mosaic)) {
          expect(source).toContain(`/images/${mosaicName(mosaic, Boolean(theme))}${suffix}.webp ${width}w`);
        }
      }
    }
  });

  test.each(mosaics)("exports $id raster dimensions, matched sky tiles and fitted geometry", async mosaic => {
    for (const night of [false, true]) {
      for (const { width, suffix } of resolutions(mosaic)) {
        const response = request(`/images/${mosaicName(mosaic, night)}${suffix}.webp`);
        expect(response.status).toBe(200);
        const bytes = Buffer.from(await response.arrayBuffer());
        expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
        expect(bytes.toString("ascii", 8, 16)).toBe("WEBPVP8 ");
        expect(bytes.readUInt16LE(26) & 0x3fff).toBe(width);
        expect(bytes.readUInt16LE(28) & 0x3fff).toBe(width * mosaic.height / mosaic.width);
      }
    }
    const tiles = await request(`/images/${tileFile(mosaic)}`).json();
    const generated = generateMosaic(mosaic);
    expect(tiles).toEqual(generated.tiles);
    for (const svg of [generated.day, generated.night]) {
      expect(svg).toContain(`viewBox="0 0 ${mosaic.width} ${mosaic.height}"`);
      // The field mask reaches the far edge, not the old hard-coded x=1420.
      expect(svg).toContain(`L${mosaic.width + 20} `);
    }
    const paths = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map(match => match[1]);
    expect(paths(generated.day)).toEqual(paths(generated.night));
    expect(generated.night.match(/data-sky="star"/g)).toHaveLength(Math.round(13 * mosaic.width / 1400));
    // Added canvas means more tiles, not horizontally stretched old tiles.
    for (const tile of tiles) {
      for (const axis of [0, 1]) {
        const coordinates = tile.points.map((point: number[]) => point[axis]);
        expect(Math.max(...coordinates) - Math.min(...coordinates)).toBeLessThan(17);
      }
    }
    if (mosaic.id !== "standard") {
      // Test the title corridor at both ends of the crop range and intermediate
      // widths, including a generous scrollbar allowance at low browser zoom.
      const sceneWidth = mosaic.width * 320 / mosaic.height;
      for (const width of [mosaic.minWidth + 1, (mosaic.minWidth + sceneWidth) / 2, sceneWidth, 12000]) {
        const left = width > 5760 ? 0 : sunPosition.x * (width - 60 - sceneWidth);
        const dot = [(300 - left) * mosaic.height / 320, 108];
        const layout = layoutConstellation(tiles, dot);
        expect(Math.hypot(...layout.shift)).toBeLessThan(8);
        expect(layout.halo.length).toBeGreaterThan(3);
      }
    }
  });

  test("generates wider compositions deterministically", () => {
    const first = generateMosaic(mosaics[1]);
    const second = generateMosaic(mosaics[1]);
    expect(second).toEqual(first);
  });

  test("caps extreme scaling and extends only the sky/field", async () => {
    expect(css).toContain("@media (width > 5760px)");
    expect(css).toContain(".mosaic-scene { left: 0; transform: none; }");
    expect(css).toContain("inset: 0 0 0 calc(var(--hero-height) * 18)");
    for (const theme of ["", "-night"]) {
      const path = `/images/spica-extension${theme}.webp`;
      expect(css).toContain(path);
      const bytes = Buffer.from(await request(path).arrayBuffer());
      expect(bytes.readUInt16LE(26) & 0x3fff).toBe(1400);
      expect(bytes.readUInt16LE(28) & 0x3fff).toBe(700);
    }
  });
});
