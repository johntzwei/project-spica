// Recolor fitted sky tiles, never move their geometry. Only the selection moves
// with the heading; the raster's joints, chipped edges, and moon palette remain.
// NOTE: [thought process] Spica is drawn from the mosaic's own tesserae rather
// than as an overlay shape, so the star always sits on the tile grid no matter
// how the background image is cropped.
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearest = (tiles, point) => tiles.reduce((best, tile) => distance(tile.center, point) < distance(best.center, point) ? tile : best);

// At night only the five daytime tesserae are lifted from their ceramic glaze
// toward warm white. This is the brightest thing in the sky.
export const coreGlow = 0.85;

// NOTE: [thought process] Everything outside the lit core is *dimmed*, not
// lifted less. The moon glaze the raster already uses is pale, so a small lift
// still lands brighter than an ordinary star; the only way down is to pull a
// tile back toward its own patch of night sky. At 1 a tile would vanish into
// the background, so each tier stops short of that.
//
// The order of these three is the whole design: the arms carry the cross out
// from the core, the spikes flare off it, and the field sits behind both. Each
// step has to stay visible as a step, so they are spaced rather than crowded.
export const nightDimming = { arm: 0.1, diagonal: 0.42, star: 0.45 };

// How many of the raster's 21 baked stars survive the night pass. The rest are
// painted back to their own sky color, which removes them without touching the
// image: a quieter field reads as deeper sky and leaves Spica more room.
export const visibleStarCount = 13;

// The rough width of one tessera, used to say how far along an arm the next
// tile should sit. Taken from Spica itself so the cross scales with the mosaic.
function tileSize(tile) {
  const spread = axis => Math.max(...tile.points.map(point => point[axis]))
    - Math.min(...tile.points.map(point => point[axis]));
  return (spread(0) + spread(1)) / 2;
}

// NOTE: [thought process] Two earlier approaches failed here, and both failures
// are worth keeping in view.
//
// Walking the Spica tile's own edges, one arm per edge, produced crooked
// stars: a hand-cut tessera's edge normals are not a clean cross, so two arms
// could face nearly the same way and the star grew two arms up and none down.
//
// Firing rays along the mosaic's local grid fixed the spacing but lost
// adjacency. Where no tile happened to sit on a ray, the search reached past
// the gap and took one off to the side, which bent the arm worse than before.
//
// What follows keeps both guarantees at once. The four directions are fixed to
// the screen, so a vertical arm is vertical and its opposite always points
// back; and each arm is filled by the tile that best matches that direction,
// scored so that straightness outweighs reach.
const armDirections = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// NOTE: [pedagogical] The gate below compares sideways offset to reach, which
// is the tangent of the angle between the tile and the arm. Testing the ratio
// rather than the offset alone is what makes the tolerance mean the same thing
// close in and far out: a fixed offset would allow a nearly sideways tile at
// short range while rejecting a well-aligned one further along the arm.
// Measured against this mosaic: the tile best aligned with an axis sits within
// 27 degrees of it in the worst case, so a tolerance below that starves arms
// rather than straightening them. The outer ring is held tighter because it is
// matched to its own inner arm, not to the axis.
const armTolerance = Math.tan(30 * Math.PI / 180);
const outerArmTolerance = Math.tan(20 * Math.PI / 180);
const diagonalDirections = [[1, 1], [-1, 1], [-1, -1], [1, -1]]
  .map(([x, y]) => [x / Math.SQRT2, y / Math.SQRT2]);

function tileAlongDirection(tiles, origin, direction, reach, used, tolerance = armTolerance) {
  let best = null;
  let bestCost = Infinity;
  for (const tile of tiles) {
    if (used.includes(tile)) continue;
    const dx = tile.center[0] - origin[0], dy = tile.center[1] - origin[1];
    const along = dx * direction[0] + dy * direction[1];
    // Only tiles genuinely out in this direction, never behind or beside Spica.
    if (along < reach * 0.4 || along > reach * 1.8) continue;
    const across = Math.abs(dx * -direction[1] + dy * direction[0]);
    // NOTE: [thought process] This gate is the whole fix. Scoring alone still
    // returns the least-bad tile when every candidate is bad, and beside the
    // sun and moon discs there are no sky tesserae at all in some directions.
    // That is where the bent arms came from: the search reached past the gap
    // and took a tile far off to the side because nothing better existed.
    // Refusing it outright is what keeps every arm straight.
    if (across > along * tolerance) continue;
    // Among tiles that pass, sideways error still outweighs reach error: a
    // tile a little short or long reads as a straight arm, one offset does not.
    const cost = across * 4 + Math.abs(along - reach);
    if (cost < bestCost) {
      bestCost = cost;
      best = tile;
    }
  }
  // NOTE: [edge case callout] Returns null when the gate rejects everything,
  // so the cross gives up an arm near the sun rather than growing a bent one.
  return best;
}

export function layoutConstellation(tiles, dot) {
  const spica = nearest(tiles, dot);
  const size = tileSize(spica);

  // The compact five-tile core that daylight shows. Kept aligned to
  // armDirections, holes and all, so each outer arm can find its own inner one.
  const inner = armDirections.map(direction =>
    tileAlongDirection(tiles, spica.center, direction, size, [spica]));
  const core = [spica, ...inner.filter(Boolean)];

  // At night each arm runs one tessera further, so the cross measures five
  // tiles across and reads as Spica rather than another background star.
  // NOTE: [thought process] The outer tile continues the line the inner tile
  // actually made, rather than the screen axis. Where the tiling runs a little
  // off-axis the whole arm leans together, which still reads as straight; held
  // to the axis instead, the two tiles would lean opposite ways and kink.
  // An outer tile is only taken where the inner one exists, so a gap beside
  // the star cannot leave a lone tessera floating two widths out.
  const arms = [];
  for (const innerTile of inner) {
    if (!innerTile) continue;
    const reach = [innerTile.center[0] - spica.center[0], innerTile.center[1] - spica.center[1]];
    const length = Math.hypot(...reach);
    const direction = [reach[0] / length, reach[1] / length];
    const outer = tileAlongDirection(tiles, spica.center, direction, size * 2,
      [...core, ...arms], outerArmTolerance);
    if (outer) arms.push(outer);
  }

  // The diagonals carry the short refraction spikes. Kept to a single tessera
  // each: spikes read as brief flares off a bright star, so diagonals as long
  // as the arms would look like a second cross rotated inside the first.
  const diagonals = diagonalDirections
    .map(direction => tileAlongDirection(tiles, spica.center, direction, size * 1.35, [...core, ...arms]))
    .filter(Boolean);

  // Snap the heading by at most half a tessera so its i points exactly at Spica.
  const shift = [spica.center[0] - dot[0], spica.center[1] - dot[1]];
  return { spica, core, arms, diagonals, shift };
}

// NOTE: [thought process] Daylight needs a different technique than night. The
// night mark can use solid colors because sky-tiles.json carries each tile's
// moon glaze, which is exactly what the night raster painted. The day raster
// paints this same sky red, and no day color is stored, so a solid pale fill
// would read as a bright cross on red rather than a dim one. Washing the tiles
// with translucent warm white instead lightens whatever is actually beneath.
// Tune the daytime brightness here; the test reads this value rather than
// pinning its own copy, so adjusting the star does not break the suite.
export const dayWash = 0.9;

export function spicaDayTileMarkup(tile) {
  const point = p => p.map(n => n.toFixed(2)).join(" ");
  return `<path data-tile="spica-day" fill="#fff2cf" fill-opacity="${dayWash}" d="M${tile.points.map(point).join("L")}Z"/>`;
}

// Thin the baked star field down to `visibleStarCount`, spreading the removals
// evenly across the sky instead of clearing one region of it.
// NOTE: [thought process] Sorting by position first is what makes this spatial
// rather than arbitrary: the stars arrive in the JSON in generation order, so
// striding over that list would have clustered the gaps.
export function starField(tiles) {
  const stars = tiles
    .filter(tile => tile.star)
    .sort((a, b) => a.center[0] - b.center[0] || a.center[1] - b.center[1]);
  const removeCount = stars.length - visibleStarCount;
  // NOTE: [pedagogical] Scaling the index by removeCount/length lands the cuts
  // at even intervals for any pair of counts, so changing either constant needs
  // no new spacing rule here.
  const removed = new Set();
  for (let step = 0; step < removeCount; step++) {
    removed.add(stars[Math.round(step * stars.length / removeCount)]);
  }
  return { kept: stars.filter(star => !removed.has(star)), removed: [...removed] };
}

// Mix two glazes channel by channel. `amount` is how far to travel from the
// first color to the second, so 0 keeps `from` and 1 arrives at `to`.
function blend(from, to, amount) {
  return [0, 2, 4].map(offset => {
    const start = parseInt(from.slice(offset, offset + 2), 16);
    const end = parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * amount).toString(16).padStart(2, "0");
  }).join("");
}

// Repaint one tessera in `color`, keeping the fitted outline and the ceramic
// joints that make it sit in the mosaic rather than on top of it.
function ceramicTileMarkup(tile, color, kind) {
  const point = p => p.map(n => n.toFixed(2)).join(" ");
  // Edges facing the light get a pale highlight, the rest a dark grout line.
  const light = [], dark = [];
  tile.points.forEach((start, index) => {
    const end = tile.points[(index + 1) % tile.points.length];
    (0.8 * (end[0] - start[0]) - 0.6 * (end[1] - start[1]) > 0 ? light : dark).push(`M${point(start)}L${point(end)}`);
  });
  return `<g data-tile="${kind}"><path fill="#${color}" d="M${tile.points.map(point).join("L")}Z"/>
    <path d="${light.join("")}" fill="none" stroke="#fff2cf" stroke-opacity="0.12" stroke-width="0.55" stroke-linejoin="round"/>
    <path d="${dark.join("")}" fill="none" stroke="#291710" stroke-opacity="0.36" stroke-width="0.65" stroke-linejoin="round"/></g>`;
}

export function spicaTileMarkup(tile, lift) {
  // Lift the moon glaze toward warm white, keeping a little of each tile's
  // ceramic color variation so the star still belongs to the mosaic.
  return ceramicTileMarkup(tile, blend(tile.moon, "ffffff", lift), "spica");
}

// NOTE: [thought process] Each tile is pulled toward its own sky color rather
// than a single flat night color. The raster's sky is not uniform, so a shared
// color would leave visible patches wherever a dimmed tile sat.
export function dimmedTileMarkup(tile, amount, kind) {
  return ceramicTileMarkup(tile, blend(tile.moon, tile.sky, amount), kind);
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
  </filter></defs><g filter="url(#tile-glaze)"><g class="spica-day-mark"></g><g class="night-star-dimming"></g><g class="spica-night-mark"></g></g>`;
  scene.append(svg);
  const dayMark = svg.querySelector(".spica-day-mark");
  const starDimmer = svg.querySelector(".night-star-dimming");
  const nightMark = svg.querySelector(".spica-night-mark");

  // The baked star field never moves, so it is painted once instead of on every
  // resize. Only the Spica selection depends on where the heading landed.
  const field = starField(tiles);
  starDimmer.innerHTML = [
    ...field.removed.map(tile => dimmedTileMarkup(tile, 1, "removed-star")),
    ...field.kept.map(tile => dimmedTileMarkup(tile, nightDimming.star, "dimmed-star")),
  ].join("");
  let shift = [0, 0];

  function update() {
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width) return;
    // The lit tiles replace the ordinary i-dot.
    letter.firstChild.nodeValue = "ı";
    const anchor = dot.getBoundingClientRect();
    // NOTE: [thought process] Undo the current shift before measuring, so the
    // layout solves against the heading's unshifted position and cannot drift
    // a little further on every resize.
    const pixelScale = bounds.width / 1400;
    const target = [(anchor.left - shift[0] - bounds.left) / pixelScale, (anchor.top - shift[1] - bounds.top) / pixelScale];
    const layout = layoutConstellation(tiles, target);

    // Lower only the lettering to clear the bottom arm. The dot anchor's
    // inverse CSS offset keeps the star fixed, including on resize.
    // NOTE: [thought process] Measure against the night cross even in daylight.
    // The drop is the same in both themes, so flipping the toggle never nudges
    // the heading; a few extra pixels of daytime clearance is the cheaper cost.
    const fontSize = parseFloat(getComputedStyle(heading).fontSize);
    const bottom = Math.max(...[...layout.core, ...layout.arms, ...layout.diagonals]
      .flatMap(tile => tile.points.map(point => point[1])));
    const drop = Math.max(0, (bottom - layout.spica.center[1]) * pixelScale - fontSize * 0.1);
    heading.style.setProperty("--title-drop", `${drop}px`);
    shift = layout.shift.map(n => n * pixelScale);
    heading.style.translate = `${shift[0]}px ${shift[1]}px`;

    dayMark.innerHTML = layout.core.map(spicaDayTileMarkup).join("");
    // Any star caught inside the cross is relit by the Spica pass drawn above,
    // so the dimming layer does not need to skip it.
    // Painted dimmest first, so wherever two tiers meet the brighter one keeps
    // its edge: spikes, then arms, then the core on top.
    nightMark.innerHTML = [
      ...layout.diagonals.map(tile => dimmedTileMarkup(tile, nightDimming.diagonal, "spica-spike")),
      ...layout.arms.map(tile => dimmedTileMarkup(tile, nightDimming.arm, "spica-arm")),
      ...layout.core.map(tile => spicaTileMarkup(tile, coreGlow)),
    ].join("");
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
