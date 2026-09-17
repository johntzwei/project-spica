import { describe, expect, test } from "bun:test";
import { layoutConstellation, tileMarkup } from "./public/constellation.js";

const tiles = await Bun.file(new URL("./public/images/sky-tiles.json", import.meta.url)).json();
const artwork = await Bun.file(new URL("./public/images/spica-mosaic-night.svg", import.meta.url)).text();
const geometry = new Set([...artwork.matchAll(/ d="([^"]+)"/g)].map(match => match[1]));

describe("title-anchored mosaic constellation", () => {
  test("favicon retains the five tile outlines with the approved satin finish and spacing", async () => {
    const favicon = await Bun.file(new URL("./public/favicon.svg", import.meta.url)).text();
    // The title's dot in mosaic coordinates at a 1400px desktop viewport.
    const { spicaTiles } = layoutConstellation(tiles, [286.42, 104.01], 0.91);
    expect(favicon.match(/data-tile="spica"/g)).toHaveLength(5);
    for (const tile of spicaTiles) {
      expect(favicon).toContain(tileMarkup(tile, "spica").match(/d="[^"]+"/)![0]);
    }
    expect(favicon.match(/<g filter="url\(#ceramic\)">/g)).toHaveLength(5);
    expect(favicon).toContain('specularConstant="0.35"');
    expect(favicon).toContain('stop-color="#f3e8d3"');
    expect(favicon).not.toContain("feTurbulence");
    for (const shift of ["0.0 -0.1505859375", "0.1505859375 0.0", "0.0 0.1505859375", "-0.1505859375 0.0"]) {
      expect(favicon).toContain(`data-tile="spica" transform="translate(${shift})"`);
    }
    expect(favicon).not.toContain('id="i-body"');
    expect(favicon).not.toContain('id="clip5"');
    expect(favicon).toContain('<g id="spica-dot" transform="translate(-0.125 4.18)">');
    expect(favicon).not.toContain("<text"); // No platform-dependent font in the icon.
    // Keep the square backdrop while centering only the five-tile dot.
    expect(favicon).toContain('viewBox="267.69 88.5 38 38"');
    expect(favicon).toContain('<rect x="267.69" y="88.5" width="38" height="38"');
    expect(favicon.match(/<rect[^>]+>/g)).toHaveLength(1);
    expect(favicon).toMatch(/<rect[^>]+fill="#102344"\/>/);
  });

  test("exports the original fitted tile outlines, not a new constellation shape", () => {
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
    expect(layout.spicaTiles).toHaveLength(5);
    expect(new Set(layout.spicaTiles).size).toBe(5);
    expect(layout.spicaTiles[0]).toBe(layout.spica);
    for (const tile of layout.spicaTiles) {
      expect(tiles.includes(tile)).toBe(true);
      expect(layout.selected.has(tile)).toBe(false);
    }
    // Each arm sits across a different long edge, not diagonally at a corner.
    layout.spicaTiles.slice(1).forEach((tile: any, index: number) => {
      const a = layout.spica.points[index * 2 + 1];
      const b = layout.spica.points[(index * 2 + 2) % layout.spica.points.length];
      const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      expect(Math.hypot(tile.center[0] - midpoint[0], tile.center[1] - midpoint[1])).toBeLessThan(7);
      expect(Math.hypot(tile.center[0] - layout.spica.center[0], tile.center[1] - layout.spica.center[1])).toBeLessThan(12);
    });
    expect([...layout.selected.values()].filter(kind => kind === "star")).toHaveLength(10);
    expect([...layout.selected.values()].filter(kind => kind === "line").length).toBeGreaterThan(20);
    for (const [tile] of layout.selected) expect(tiles.includes(tile)).toBe(true);
    // Pure selection is stable, so resize does not drift or change tile geometry.
    expect(layoutConstellation(tiles, dot, scale)).toEqual(layout);
  });

  test("preserves the remaining left-half stars while spacing out the right half", () => {
    const left = tiles.filter((tile: any) => tile.star && tile.center[0] < 700);
    expect(left.map((tile: any) => tile.center).sort((a: number[], b: number[]) => a[0] - b[0])).toEqual([
      [96.33, 28.06], [102.91, 70.51], [140.69, 22.02], [167.79, 177.92],
      [225.49, 69.3], [277.47, 87.63], [409.35, 119.92], [479.92, 62.98],
      [527.72, 169.12], [543.79, 35.94], [654.2, 82.7], [664.47, 186.8],
    ]);
    const right = tiles.filter((tile: any) => tile.star && tile.center[0] >= 700);
    expect(right).toHaveLength(9);
    // Spread through the sky instead of collecting in two horizontal rows.
    expect(new Set(right.map((tile: any) => Math.floor(tile.center[1] / 30))).size).toBeGreaterThanOrEqual(5);
    expect(tiles.find((tile: any) => tile.center[0] === 981.09 && tile.center[1] === 137.56).star).toBe(false);
    for (let i = 0; i < right.length; i++) {
      expect(Math.hypot(right[i].center[0] - 1045, right[i].center[1] - 96)).toBeGreaterThanOrEqual(113);
      for (let j = i + 1; j < right.length; j++) {
        expect(Math.hypot(right[i].center[0] - right[j].center[0], right[i].center[1] - right[j].center[1])).toBeGreaterThanOrEqual(90);
      }
    }
    expect(artwork.match(/data-sky="star"/g)).toHaveLength(left.length + right.length);
  });

  test("moves the central middle star above the trio and halfway toward its right neighbor", () => {
    const old = tiles.find((tile: any) => tile.center[0] === 681.15 && tile.center[1] === 121.41);
    expect(old.star).toBe(false);
    const moved = tiles.find((tile: any) => tile.center[0] === 744.54 && tile.center[1] === 52.08);
    expect(moved.star).toBe(true);
    expect(moved.center[1]).toBeLessThan(82.7);
    // The midpoint snaps to an existing tile, within half a tile width.
    expect(Math.abs(moved.center[0] - (681.15 + 801.67) / 2)).toBeLessThan(4.375);
  });

  test("keeps the three stray stars around the title dark", () => {
    for (const center of [[147.1, 130.41], [287.24, 129.97], [348.37, 123.5]]) {
      const tile = tiles.find((tile: any) => tile.center[0] === center[0] && tile.center[1] === center[1]);
      expect(tile.star).toBe(false);
      const outline = `M${tile.points.map((p: number[]) => p.map(n => n.toFixed(2)).join(" ")).join("L")}Z`;
      expect(artwork).toContain(`<path fill="#${tile.sky}" d="${outline}"/>`);
    }
    // The next star farther to the right remains part of the star field.
    expect(tiles.find((tile: any) => tile.center[0] === 409.35 && tile.center[1] === 119.92).star).toBe(true);
  });

  test("all five Spica tiles outshine ordinary stars and retain their fitted edges", () => {
    const luminance = (hex: string) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
      const channel = parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
      return sum + weight * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    }, 0);
    const brightestOrdinaryStar = Math.max(...tiles.map((tile: any) => luminance(tile.moon)));
    const { spicaTiles } = layoutConstellation(tiles, [290, 100], 0.91);
    for (const tile of spicaTiles) {
      const markup = tileMarkup(tile, "spica");
      const color = markup.match(/fill="#([a-f0-9]+)"/)![1];
      expect(luminance(color)).toBeGreaterThan(brightestOrdinaryStar);
      expect(geometry.has(markup.match(/ d="([^"]+)"/)![1])).toBe(true);
      expect(markup).toContain('stroke="#fff2cf"');
      expect(markup).toContain('stroke="#291710"');
      expect(markup).not.toContain("<circle");
      expect(markup).not.toContain("transform=");
      expect(tileMarkup(tile, "star")).toContain(`fill="#${tile.moon}"`);
    }
  });
});
