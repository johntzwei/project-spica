// Recolor fitted sky tiles, never move their geometry. Only the selection moves
// with the heading; the raster's joints, chipped edges, and moon palette remain.
const virgo = [
  [358, 45], [309, 55], [273, 58], [249, 38], [238, 8],
  [226, 74], [200, 96], [184, 55], [139, 46], [115, 76], [70, 75],
];
const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 3], [7, 8], [8, 9], [9, 10]];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearest = (tiles, p) => tiles.reduce((best, tile) => distance(tile.center, p) < distance(best.center, p) ? tile : best);
const segmentDistance = ([x, y], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};

export function layoutConstellation(tiles, dot, scale) {
  const spica = nearest(tiles, dot);
  const spicaTiles = [spica];
  // The four long sides alternate with chipped corners. Pick the tile just
  // across each side, following the mosaic's local orientation, not screen axes.
  for (let i = 1; i < spica.points.length; i += 2) {
    const a = spica.points[i], b = spica.points[(i + 1) % spica.points.length];
    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const outward = [midpoint[0] - spica.center[0], midpoint[1] - spica.center[1]];
    const neighbors = tiles.filter(tile => !spicaTiles.includes(tile)
      && (tile.center[0] - midpoint[0]) * outward[0] + (tile.center[1] - midpoint[1]) * outward[1] > 0);
    spicaTiles.push(nearest(neighbors, midpoint));
  }
  // Snap the heading by at most half a tessera so its i points exactly at Spica.
  const shift = [spica.center[0] - dot[0], spica.center[1] - dot[1]];
  const stars = virgo.map(([x, y]) => [spica.center[0] + (x - 200) * scale, spica.center[1] + (y - 96) * scale]);
  const selected = new Map();
  for (const tile of tiles) {
    const d = Math.min(...edges.map(([a, b]) => segmentDistance(tile.center, stars[a], stars[b])));
    if (d < 5.1) selected.set(tile, "line");
    // Clear unrelated baked stars immediately beside the constellation.
    else if (d < 24 && tile.star) selected.set(tile, "sky");
  }
  for (const star of stars) selected.set(nearest(tiles, star), "star");
  for (const tile of spicaTiles) selected.delete(tile);
  return { spica, spicaTiles, shift, selected };
}

export function tileMarkup(tile, kind) {
  // Lift the moon glaze toward warm white so all five Spica tiles outshine
  // ordinary stars, while retaining a little of their ceramic color variation.
  const color = kind === "spica"
    ? [0, 2, 4].map(offset => {
      const moon = parseInt(tile.moon.slice(offset, offset + 2), 16);
      return Math.round(moon + (255 - moon) * 0.85).toString(16).padStart(2, "0");
    }).join("") : kind === "sky" ? tile.sky : kind === "line"
    ? [0, 2, 4].map(offset => {
      const sky = parseInt(tile.sky.slice(offset, offset + 2), 16);
      const moon = parseInt(tile.moon.slice(offset, offset + 2), 16);
      return Math.round(sky + (moon - sky) * 0.38).toString(16).padStart(2, "0");
    }).join("") : tile.moon;
  const point = p => p.map(n => n.toFixed(2)).join(" ");
  const light = [], dark = [];
  tile.points.forEach((a, i) => {
    const b = tile.points[(i + 1) % tile.points.length];
    (0.8 * (b[0] - a[0]) - 0.6 * (b[1] - a[1]) > 0 ? light : dark).push(`M${point(a)}L${point(b)}`);
  });
  return `<g data-tile="${kind}"><path fill="#${color}" d="M${tile.points.map(point).join("L")}Z"/>
    <path d="${light.join("")}" fill="none" stroke="#fff2cf" stroke-opacity="0.12" stroke-width="0.55" stroke-linejoin="round"/>
    <path d="${dark.join("")}" fill="none" stroke="#291710" stroke-opacity="0.36" stroke-width="0.65" stroke-linejoin="round"/></g>`;
}

async function attachConstellation() {
  const scene = document.querySelector(".mosaic-scene");
  const heading = document.querySelector(".title-group");
  const letter = document.querySelector(".spica-letter");
  const dot = document.querySelector(".spica-dot");
  const response = await fetch("/images/sky-tiles.json");
  if (!response.ok) throw new Error("Sky tiles unavailable");
  const tiles = await response.json();
  if (!tiles.length) throw new Error("Empty sky tiles");
  await document.fonts.ready;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 1400 350");
  svg.setAttribute("class", "mosaic-tile-colors");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  // Same glaze recipe as the generator; limit the noise to the selected tiles.
  svg.innerHTML = `<defs><filter id="tile-glaze" filterUnits="userSpaceOnUse" x="0" y="0" width="1400" height="350" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" seed="17"/>
    <feColorMatrix type="matrix" values="0.15 0 0 0 0.42  0 0.15 0 0 0.42  0 0 0.15 0 0.42  0 0 0 1 0"/>
    <feBlend in="SourceGraphic" mode="soft-light"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter></defs><g filter="url(#tile-glaze)"><g class="virgo-night-tiles"></g><g class="spica-tile"></g></g>`;
  scene.append(svg);
  const night = svg.querySelector(".virgo-night-tiles");
  const spica = svg.querySelector(".spica-tile");
  let shift = [0, 0];
  function update() {
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width) return;
    letter.firstChild.nodeValue = "ı";
    const anchor = dot.getBoundingClientRect();
    const pixelScale = bounds.width / 1400;
    const target = [(anchor.left - shift[0] - bounds.left) / pixelScale, (anchor.top - shift[1] - bounds.top) / pixelScale];
    // Original 400 × 150 constellation was 6.5em wide with Spica at (200, 96).
    const fontSize = parseFloat(getComputedStyle(heading).fontSize);
    const scale = fontSize * 6.5 / 400 / pixelScale;
    const layout = layoutConstellation(tiles, target, scale);
    // Lower only the lettering to clear the bottom arm. The dot anchor's
    // inverse CSS offset keeps the constellation fixed, including on resize.
    const bottom = Math.max(...layout.spicaTiles.flatMap(tile => tile.points.map(p => p[1])));
    const drop = Math.max(0, (bottom - layout.spica.center[1]) * pixelScale - fontSize * 0.1);
    heading.style.setProperty("--title-drop", `${drop}px`);
    shift = layout.shift.map(n => n * pixelScale);
    heading.style.translate = `${shift[0]}px ${shift[1]}px`;
    night.innerHTML = [...layout.selected].map(([tile, kind]) => tileMarkup(tile, kind)).join("");
    spica.innerHTML = layout.spicaTiles.map(tile => tileMarkup(tile, "spica")).join("");
  }
  update();
  let frame;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  new ResizeObserver(schedule).observe(document.querySelector(".mosaic-hero"));
  window.addEventListener("resize", schedule);
  document.fonts.addEventListener("loadingdone", schedule);
}

if (typeof document !== "undefined") {
  attachConstellation().catch(() => {
    // Keep a readable heading and the static starry mosaic if enhancement fails.
    document.querySelector(".mosaic-tile-colors")?.remove();
    document.querySelector(".spica-letter").firstChild.nodeValue = "i";
    document.querySelector(".title-group").style.translate = "";
    document.querySelector(".title-group").style.removeProperty("--title-drop");
  });
}
