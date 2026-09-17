// Requires rsvg-convert (librsvg) and magick (ImageMagick with WebP support).
// Rasterize the original vectors at each resolution, baking in the stone filter.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

for (const tool of ["rsvg-convert", "magick"]) {
  if (!Bun.which(tool)) throw new Error(`Install ${tool} before exporting the mosaics.`);
}

const images = fileURLToPath(new URL("../public/images/", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "spica-mosaics-"));
async function run(command: string[]) {
  const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0) throw new Error(`${command[0]} failed`);
}

try {
  for (const name of ["spica-mosaic", "spica-mosaic-night"]) {
    for (const width of [1400, 2800]) {
      const png = join(temporary, `${name}-${width}.png`);
      const output = join(images, `${name}${width === 1400 ? "" : "@2x"}.webp`);
      await run(["rsvg-convert", "--width", String(width), "--height", String(width / 4),
        "--output", png, join(images, `${name}.svg`)]);
      await run(["magick", png, "-strip", "-quality", "90", "-define", "webp:method=6", output]);
      console.log(`${output}: ${(Bun.file(output).size / 1024).toFixed(0)} KiB`);
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
