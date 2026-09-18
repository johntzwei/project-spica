// Recolor fitted sky tiles for the heading's Spica star and halo, never move
// their geometry. The background star field is already baked into the raster.
//
// NOTE: [thought process] Spica is one tessera with a halo, not a cross. A
// cross was tried at length and the mosaic would not hold one: the tiles are
// hand-cut and laid in columns that step half a tile between neighbours, so no
// straight bar of five exists near the heading. Every attempt to find one bent,
// sheared, or doubled back on itself. The deeper problem is that a four-point
// star is a photographic artifact -- diffraction spikes thrown by a camera's
// aperture blades -- and has no business in ceramic. A mosaicist renders a
// bright star as one brilliant tile with the glaze lifting around it, which is
// what this draws. Nothing here depends on the lattice, so nothing can bend.
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearest = (tiles, point) => tiles.reduce((best, tile) => distance(tile.center, point) < distance(best.center, point) ? tile : best);

// How far Spica's own tessera is lifted from its glaze toward warm white.
export const coreGlow = 0.95;

// The halo reaches this many tile widths out, fading to nothing at the edge,
// and this is how strongly its innermost ring catches the light.
export const haloReach = 2.9;
export const haloGlow = 0.7;

// By day the surrounding tesserae are pushed down into shadow instead of being
// lifted, so the one washed tile is the only thing catching light.
export const dayDim = 0.45;

// Daylight only tints Spica, and only faintly.
// NOTE: [thought process] Daylight needs a different technique than night. The
// night mark can use solid colors because sky-tiles.json carries each tile's
// moon glaze and sky color. The day raster
// paints this same sky red, and no day color is stored, so a solid pale fill
// would read as a bright mark on red rather than a dim one. Washing the tile
// with translucent warm white instead lightens whatever is actually beneath.
export const dayWash = 0.9;

// The rough width of one tessera, taken from Spica so the halo scales with the
// mosaic wherever the heading lands.
function tileSize(tile) {
  const spread = axis => Math.max(...tile.points.map(point => point[axis]))
    - Math.min(...tile.points.map(point => point[axis]));
  return (spread(0) + spread(1)) / 2;
}

export function layoutConstellation(tiles, dot) {
  const spica = nearest(tiles, dot);
  const radius = tileSize(spica) * haloReach;

  // NOTE: [pedagogical] The halo is every tessera within a radius, with no
  // regard for direction. That is the whole point: a selection that cannot
  // prefer one direction over another cannot come out crooked, which is
  // exactly what defeated the cross. Brightness falls off with distance, so
  // the shape the eye reads is a glow rather than an outline.
  const halo = tiles
    .filter(tile => tile !== spica && distance(tile.center, spica.center) < radius)
    .map(tile => ({ tile, falloff: 1 - distance(tile.center, spica.center) / radius }))
    .sort((a, b) => b.falloff - a.falloff);

  // Snap the heading by at most half a tessera so its i points exactly at Spica.
  const shift = [spica.center[0] - dot[0], spica.center[1] - dot[1]];
  return { spica, halo, shift };
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

// NOTE: [thought process] The halo is repainted glaze at night, not a wash.
// Drawn as translucent white it was almost invisible: one tessera plus a faint
// tint has nowhere near the visual mass of the nine-tile cross it replaced,
// and the star simply disappeared. Lifting each tile's own glaze toward warm
// white the way Spica's is lifted gives the halo real presence while keeping
// every tile's ceramic variation, so it still reads as mosaic rather than a
// spotlight laid over one. Daylight keeps the wash, because the day raster
// paints this sky red and no day color is stored to lift.
export function haloTileMarkup(tile, strength) {
  // NOTE: [thought process] The blend starts at the tile's own sky, not its
  // moon glaze. Moon is the pale color the raster paints stars with, already
  // near white, so lifting from there made every halo tile as bright as the
  // next and the glow came out a flat blob. From sky, strength 0 leaves the
  // tile exactly as the night raster painted it and the falloff actually
  // reads as a falloff.
  return ceramicTileMarkup(tile, blend(tile.sky, "ffffff", strength), "halo");
}

// NOTE: [thought process] Day and night make the star stand out by opposite
// means. At night the halo is lit, because the sky around it is dark and light
// is what reads. By day the sky is a bright red raster, so lifting the halo
// would only crowd the star with more brightness; the surrounding tiles are
// darkened instead and the contrast comes from the shadow around the tile
// rather than the glow. The wash is the terracotta of the joints, so the
// shadow belongs to the same ceramic rather than greying the artwork.
export function haloDayTileMarkup(tile, strength) {
  const point = p => p.map(n => n.toFixed(2)).join(" ");
  return `<path data-tile="halo-day" fill="#291710" fill-opacity="${strength.toFixed(3)}" d="M${tile.points.map(point).join("L")}Z"/>`;
}

export function spicaDayTileMarkup(tile) {
  const point = p => p.map(n => n.toFixed(2)).join(" ");
  return `<path data-tile="spica-day" fill="#fff2cf" fill-opacity="${dayWash}" d="M${tile.points.map(point).join("L")}Z"/>`;
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
  </filter></defs><g filter="url(#tile-glaze)"><g class="spica-day-mark"></g><g class="spica-night-mark"></g></g>`;
  scene.append(svg);
  const dayMark = svg.querySelector(".spica-day-mark");
  const nightMark = svg.querySelector(".spica-night-mark");
  let shift = [0, 0];

  function update() {
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width) return;
    // The lit tile replaces the ordinary i-dot.
    letter.firstChild.nodeValue = "ı";
    const anchor = dot.getBoundingClientRect();
    // NOTE: [thought process] Undo the current shift before measuring, so the
    // layout solves against the heading's unshifted position and cannot drift
    // a little further on every resize.
    const pixelScale = bounds.width / 1400;
    const target = [(anchor.left - shift[0] - bounds.left) / pixelScale, (anchor.top - shift[1] - bounds.top) / pixelScale];
    const layout = layoutConstellation(tiles, target);
    shift = layout.shift.map(n => n * pixelScale);
    heading.style.translate = `${shift[0]}px ${shift[1]}px`;

    // NOTE: [thought process] The heading no longer drops to clear an arm.
    // A single tessera sits inside the i-dot's own footprint, so the lettering
    // can stay where the type designer put it.
    dayMark.innerHTML = layout.halo
      .map(({ tile, falloff }) => haloDayTileMarkup(tile, falloff * dayDim))
      .join("") + spicaDayTileMarkup(layout.spica);
    nightMark.innerHTML = layout.halo
      .map(({ tile, falloff }) => haloTileMarkup(tile, falloff * haloGlow))
      .join("") + spicaTileMarkup(layout.spica, coreGlow);
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
  });
}
