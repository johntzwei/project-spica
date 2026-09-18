// Only artwork generation needs librsvg and ImageMagick, never the site build.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMosaic } from "./generate-mosaic";
import { mosaics, mosaicName, resolutions, tileFile } from "../public/mosaic-layout.js";

for (const tool of ["rsvg-convert", "magick"]) {
  if (!Bun.which(tool)) throw new Error(`Install ${tool} before exporting the mosaics.`);
}
const images = fileURLToPath(new URL("../public/images/", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "spica-mosaics-"));
async function run(command: string[]) {
  const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0) throw new Error(`${command[0]} failed`);
}
async function webp(png: string, output: string) {
  await run(["magick", png, "-strip", "-quality", "90", "-define", "webp:method=6", output]);
  console.log(`${output}: ${(Bun.file(output).size / 1024).toFixed(0)} KiB`);
}
try {
  for (const mosaic of mosaics) {
    const original = mosaic.id === "standard";
    const generate = !original || Bun.argv.includes("--regenerate");
    const generated = generate ? generateMosaic(mosaic) : null;
    if (generated) {
      await Bun.write(join(images, tileFile(mosaic)), JSON.stringify(generated.tiles));
    }
    for (const night of [false, true]) {
      const name = mosaicName(mosaic, night);
      const svg = join(original ? images : temporary, `${name}.svg`);
      if (generated) await Bun.write(svg, generated[night ? "night" : "day"]);
      for (const { width, suffix } of resolutions(mosaic)) {
        const png = join(temporary, `${name}-${width}.png`);
        await run(["rsvg-convert", "--width", String(width), "--height", String(width * mosaic.height / mosaic.width), "--output", png, svg]);
        await webp(png, join(images, `${name}${suffix}.webp`));

        if (mosaic.id === "extreme" && width === mosaic.width * 2) {
          // Beyond 5760 CSS px, keep the main canvas at full height and extend
          // only its rightmost sky/field. A mirrored pair joins exactly at both
          // ends, with no extra sun/moon, stretching, or gradient seam.
          const edge = join(temporary, `edge-${night}.png`);
          const mirrored = join(temporary, `mirrored-${night}.png`);
          const strip = join(temporary, `strip-${night}.png`);
          await run(["magick", png, "-crop", `700x700+${width - 700}+0`, "+repage", edge]);
          await run(["magick", edge, "-flop", mirrored]);
          await run(["magick", mirrored, edge, "+append", strip]);
          await webp(strip, join(images, `spica-extension${night ? "-night" : ""}.webp`));
        }
      }
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
