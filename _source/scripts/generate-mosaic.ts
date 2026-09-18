// Deterministic compositions: extend the landscape, never stretch its tiles.
import { mosaics, mosaicName, sunPosition, tileFile } from "../public/mosaic-layout.js";

export function generateMosaic(composition = mosaics[0]) {
  const { width, height } = composition;
  const tileSize = 8.75;
  const sun = { x: width * sunPosition.x, y: sunPosition.y, radius: sunPosition.radius };
  let seed = 73921;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const choose = (colors: string[]) => colors[Math.floor(random() * colors.length)];
  type Point = [number, number];
  const point = ([x, y]: Point) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  const reds = ["#9e0f2a", "#b41429", "#c31f28", "#920d28", "#c62628", "#ae1229"];
  const golds = ["#ffc82b", "#f1ad1a", "#ffd53d", "#f8bc21"];
  const bands = [
    ["#dd7c12", "#eb8a14", "#cd6911"],
    ["#f3a917", "#f9b71e", "#ed9f14"],
    ["#ffc72b", "#f2b11f", "#ffd137"],
    ["#b44815", "#c45c14", "#d16f16"],
  ];
  // Keep the same broad hills and vertical field proportions on every canvas.
  // Only the contours widen; the tesserae are generated at their original size.
  const landscapeX = (x: number) => x * (1400 / width);
  const horizon = (x: number) => 211 - 30 * Math.sin(landscapeX(x) / 240) + 9 * Math.cos(landscapeX(x) / 113);
  const fieldY = (x: number, row: number) => horizon(x) + row * (17 + 7 * Math.sin(landscapeX(x) / 320 + 1) ** 2);
  const nightReds = ["#102344", "#172e50", "#1b3659", "#10213e", "#203d60", "#142a4b"];
  const moon = ["#dfdfbd", "#c9d2c3", "#eee9ce", "#d5dccb"];
  const nightBands = [
    ["#694516", "#78521c", "#583a16"],
    ["#8b6728", "#987532", "#7a5822"],
    ["#aa8740", "#957231", "#b39249"],
    ["#49301d", "#563b20", "#654723"],
  ];
  const tiles: string[] = [];
  const nightTiles: string[] = [];
  const highlights: string[] = [];
  const shadows: string[] = [];
  const skyTiles: { index: number; center: Point; points: Point[]; moonFill: string; skyFill: string }[] = [];
  function tile(corners: Point[], palette: string[]) {
    const cx = corners.reduce((sum, p) => sum + p[0], 0) / corners.length;
    const cy = corners.reduce((sum, p) => sum + p[1], 0) / corners.length;
    if (cx < -15 || cx > width + 15 || cy < -15 || cy > height + 15) return;
    const gap = 0.45 + random() * 0.35;
    // Inset fitted joints to expose fine grout rather than scattering the tiles.
    const inset = corners.map(([x, y]): Point => {
      const distance = Math.hypot(cx - x, cy - y);
      const shrink = Math.min(0.3, gap * Math.SQRT2 / distance);
      return [x + (cx - x) * shrink, y + (cy - y) * shrink];
    });
    const points: Point[] = [];
    for (let i = 0; i < inset.length; i++) {
      const prev = inset[(i + inset.length - 1) % inset.length];
      const curr = inset[i];
      const next = inset[(i + 1) % inset.length];
      const chip = 0.025 + random() * 0.10;
      points.push([curr[0] + (prev[0] - curr[0]) * chip, curr[1] + (prev[1] - curr[1]) * chip]);
      points.push([curr[0] + (next[0] - curr[0]) * chip, curr[1] + (next[1] - curr[1]) * chip]);
    }
    const base = choose(palette);
    // Recolor the same fitted tesserae; the moon's cutout becomes sky tiles.
    const cutout = Math.hypot(cx - (sun.x + 26), cy - (sun.y - 14)) < sun.radius * 0.92;
    const nightPalette = palette === reds || (palette === golds && cutout)
      ? nightReds : palette === golds ? moon : nightBands[bands.indexOf(palette)];
    const nightBase = nightPalette[palette.indexOf(base) % nightPalette.length];
    const tone = (random() - 0.5) * 23;
    const variations = [0, 1, 2].map(i => tone + (random() - 0.5) * (i === 2 ? 9 : 5));
    const shade = (hex: string, strength = 1) => [1, 3, 5].map((offset, i) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) + variations[i] * strength;
      return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
    }).join("");
    const outline = `d="M${points.map(point).join("L")}Z"`;
    tiles.push(`<path fill="#${shade(base)}" ${outline}/>`);
    nightTiles.push(`<path fill="#${shade(nightBase, 0.6)}" ${outline}/>`);
    if (palette === reds && cx > 8 && cx < width - 8 && cy > 8 && cy < horizon(cx) - 12
      && Math.hypot(cx - sun.x, cy - sun.y) > sun.radius + 12) {
      skyTiles.push({
        index: nightTiles.length - 1, center: [cx, cy], points,
        moonFill: shade(moon[palette.indexOf(base) % moon.length], 0.6),
        skyFill: shade(nightBase, 0.6),
      });
    }
    // Light stays at the upper left even as tiles turn around the sun.
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const edges = 0.8 * (b[0] - a[0]) - 0.6 * (b[1] - a[1]) > 0 ? highlights : shadows;
      edges.push(`M${point(a)}L${point(b)}`);
    }
  }

  // Small, nearly square tesserae still radiate around the original sun.
  // The first seven rows end at exactly r=63, preserving its silhouette.
  let radius = 0;
  const reach = width === 1400 ? 1140 : Math.hypot(Math.max(sun.x, width - sun.x), height) + tileSize * 2;
  for (let ring = 0; radius < reach; ring++) {
    const outer = radius + (ring < 7 ? sun.radius / 7 : tileSize);
    const count = Math.max(6, Math.round(2 * Math.PI * (radius + outer) / 2 / tileSize));
    const phase = ring * 0.17;
    const angles = Array.from({ length: count }, (_, i) => phase + (i + (random() - 0.5) * 0.15) * Math.PI * 2 / count);
    angles.push(angles[0] + Math.PI * 2);
    const polar = (r: number, a: number): Point => {
      // Shared gently wandering ring edges; never disturb the sun boundary.
      const wander = r === 0 || r === sun.radius ? 0 : Math.sin(a * Math.round(r / 5) + r) * 0.45;
      return [sun.x + (r + wander) * Math.cos(a), sun.y + (r + wander) * Math.sin(a)];
    };
    for (let i = 0; i < count; i++) {
      const a = angles[i];
      const b = angles[i + 1];
      const corners = radius === 0
        ? [[sun.x, sun.y] as Point, polar(outer, a), polar(outer, b)]
        : [polar(radius, a), polar(outer, a), polar(outer, b), polar(radius, b)];
      tile(corners, ring < 7 ? golds : reds);
    }
    radius = outer;
  }
  const skyTileCount = tiles.length;
  const skyHighlightCount = highlights.length;
  const skyShadowCount = shadows.length;

  // Leave the three stray title stars dark, plus the old position of the
  // central star moved above and to the right of its former vertical trio.
  const omittedStars: Point[] = [[147.1, 130.41], [287.24, 129.97], [348.37, 123.5], [681.15, 121.41]];
  const rightStars: Point[] = [];
  // Recolor existing sky tesserae only, preserving joints and surface texture.
  const lightStar = (position: Point) => {
    const nearest = skyTiles.reduce((best, tile) =>
      Math.hypot(tile.center[0] - position[0], tile.center[1] - position[1])
        < Math.hypot(best.center[0] - position[0], best.center[1] - position[1]) ? tile : best);
    if (Math.hypot(nearest.center[0] - position[0], nearest.center[1] - position[1]) > tileSize) return;
    if (omittedStars.some(p => Math.hypot(nearest.center[0] - p[0], nearest.center[1] - p[1]) < 1)) return;
    // Keep the right side sparse, with clear breathing room around the moon.
    if (nearest.center[0] >= width / 2) {
      if (Math.hypot(nearest.center[0] - sun.x, nearest.center[1] - sun.y) < sun.radius + 50) return;
      if (rightStars.some(p => Math.hypot(nearest.center[0] - p[0], nearest.center[1] - p[1]) < 90)) return;
      rightStars.push(nearest.center);
    }
    nightTiles[nearest.index] = nightTiles[nearest.index]
      .replace(/fill="#[a-f0-9]+"/, `data-sky="star" fill="#${nearest.moonFill}"`);
  };
  // Jittered, widely spaced stars, using a separate seed so the day artwork and
  // all tile geometry remain byte-for-byte unchanged when the sky is decorated.
  let starSeed = 1948;
  const starRandom = () => {
    starSeed = (Math.imul(starSeed, 1664525) + 1013904223) >>> 0;
    return starSeed / 4294967296;
  };
  for (let y = 25; y < 200; y += 52) {
    for (let x = 25; x < width; x += 64) {
      const position: Point = [x + (starRandom() - 0.5) * 30, y + (starRandom() - 0.5) * 22];
      // Consume the original random sequence to preserve every left-half star.
      if (starRandom() < 0.6 && position[0] < width / 2) lightStar(position);
    }
  }
  // Continuous random positions instead of jittered rows on the right. Snap to
  // existing tiles, rejecting close neighbors rather than imposing a grid.
  for (let attempt = 0; attempt < 1000 && rightStars.length < Math.round(8 * width / 1400); attempt++) {
    lightStar([width / 2 + 25 + starRandom() * (width / 2 - 50), 18 + starRandom() * 180]);
  }

  // Move the middle star of the central trio above its top star (y=82.7),
  // halfway toward the next star on the right. Add it after the random field
  // so every other star stays put; snap to the nearest fitted tessera.
  lightStar([(681.15 + 801.67) / 2, 52]);

  // Bake the quiet background field into the artwork, so its first paint is also
  // its final state. Preserve the former browser pass's selection and glaze mix.
  const visibleStarCount = Math.round(13 * width / 1400);
  const starDimming = 0.45;
  const stars = skyTiles.filter(tile => nightTiles[tile.index].includes('data-sky="star"'))
    .sort((a, b) => a.center[0] - b.center[0] || a.center[1] - b.center[1]);
  const removeCount = stars.length - visibleStarCount;
  const removedStars = new Set<typeof stars[number]>();
  // Evenly spaced cuts in position order avoid clearing one region of the sky.
  for (let step = 0; step < removeCount; step++) {
    removedStars.add(stars[Math.round(step * stars.length / removeCount)]);
  }
  for (const tile of stars) {
    const removed = removedStars.has(tile);
    const color = removed ? tile.skyFill : [0, 2, 4].map(offset => {
      const moon = parseInt(tile.moonFill.slice(offset, offset + 2), 16);
      const sky = parseInt(tile.skyFill.slice(offset, offset + 2), 16);
      return Math.round(moon + (sky - moon) * starDimming).toString(16).padStart(2, "0");
    }).join("");
    nightTiles[tile.index] = nightTiles[tile.index].replace(
      /data-sky="star" fill="#[a-f0-9]+"/,
      `${removed ? "" : 'data-sky="star" '}fill="#${color}"`,
    );
  }

  // Subdivide each existing colored ribbon into three rows, without changing
  // its height, color sequence, or contour. Shared joints keep the cuts fitted.
  for (let band = 0; band < 11; band++) {
    const columns = Math.ceil(width / tileSize) + 4;
    const phase = random() * tileSize;
    const joints = Array.from({ length: 4 }, (_, row) =>
      Array.from({ length: columns + 1 }, (_, col): Point => {
        const x = (col - 2) * tileSize + phase + (random() - 0.5) * 1.6;
        const y = fieldY(x, band + row / 3) + (row === 0 || row === 3 ? 0 : (random() - 0.5) * 1.0);
        return [x, y];
      }));
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < columns; col++) {
        tile([joints[row][col], joints[row][col + 1], joints[row + 1][col + 1], joints[row + 1][col]], bands[band % bands.length]);
      }
    }
  }
  // The field's grout follows the same horizon and masks the sky underneath.
  const fieldOutline = `M-20 ${horizon(-20)} ${Array.from({ length: Math.ceil(width / 10) + 5 }, (_, i) => {
    const x = -20 + i * 10;
    return `L${x} ${horizon(x).toFixed(2)}`;
  }).join(" ")} V370 H-20Z`;
  function surface(start: number, end: number, lightStart: number, lightEnd: number, darkStart: number, darkEnd: number, night: boolean) {
    return `${(night ? nightTiles : tiles).slice(start, end).join("\n")}
    <path d="${highlights.slice(lightStart, lightEnd).join("")}" fill="none" stroke="#fff2cf" stroke-opacity="${night ? 0.12 : 0.23}" stroke-width="0.55" stroke-linejoin="round"/>
    <path d="${shadows.slice(darkStart, darkEnd).join("")}" fill="none" stroke="#291710" stroke-opacity="0.36" stroke-width="0.65" stroke-linejoin="round"/>`;
  }
  const render = (night: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${night ? "Moonlit earth" : "Sun-fired earth"} — a flowing ceramic mosaic</title>
  <desc id="desc">${night ? "Small hand-cut dark blue ceramic tiles surround a pale crescent moon and scattered moon-colored star tiles above darkened amber fields." : "Small hand-cut crimson ceramic tiles radiate around a golden sun above rolling ribbons of amber fields. Chipped edges, recessed terracotta grout, and mottled glaze give the tiles a natural texture."}</desc>
  <defs>
    <clipPath id="frame"><rect width="${width}" height="${height}"/></clipPath>
    <clipPath id="field"><path d="${fieldOutline}"/></clipPath>
    <filter id="stone" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" seed="17" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0.15 0 0 0 0.42  0 0.15 0 0 0.42  0 0 0.15 0 0.42  0 0 0 1 0"/>
      <feBlend in="SourceGraphic" mode="soft-light"/>
    </filter>
    <linearGradient id="light" x2="0.35" y2="1">
      <stop stop-color="#fff4d5" stop-opacity="0.09"/>
      <stop offset="0.5" stop-color="#fff4d5" stop-opacity="0"/>
      <stop offset="1" stop-color="#25151a" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#frame)" filter="url(#stone)">
    <path fill="${night ? "#0a142b" : "#702333"}" d="M0 0H${width}V${height}H0Z"/>
    ${surface(0, skyTileCount, 0, skyHighlightCount, 0, skyShadowCount, night)}
    <g clip-path="url(#field)">
      <path fill="${night ? "#302719" : "#88431c"}" d="${fieldOutline}"/>
      ${surface(skyTileCount, tiles.length, skyHighlightCount, highlights.length, skyShadowCount, shadows.length, night)}
    </g>
    <rect width="${width}" height="${height}" fill="url(#light)"/>
  </g>
</svg>\n`;
  return {
    day: render(false), night: render(true),
    // On the wider, fixed-height canvases, the title can only cross this sky
    // corridor. Ship its exact tiles and halo margin, not megabytes of geometry
    // from the far-right sky that the heading can never reach. Keep the original
    // full tile file unchanged for compatibility with its mobile crop and tests.
    tiles: skyTiles.filter(tile => composition.id === "standard"
      || (tile.center[0] < width / 2 && tile.center[1] >= 48 && tile.center[1] <= 176)).map(tile => ({
      center: tile.center.map(n => Number(n.toFixed(2))),
      points: tile.points.map(p => p.map(n => Number(n.toFixed(2)))),
      moon: tile.moonFill,
      sky: tile.skyFill,
      star: nightTiles[tile.index].includes('data-sky="star"'),
    })),
  };
}

// The original editable vectors stay checked in. Wider vectors are reproducible
// from this generator and are rasterized in a temporary directory by the exporter.
if (import.meta.main) {
  const mosaic = mosaics[0];
  const generated = generateMosaic(mosaic);
  for (const night of [false, true]) {
    await Bun.write(new URL(`../public/images/${mosaicName(mosaic, night)}.svg`, import.meta.url), generated[night ? "night" : "day"]);
  }
  await Bun.write(new URL(`../public/images/${tileFile(mosaic)}`, import.meta.url), JSON.stringify(generated.tiles));
}
