// Recolor fitted sky tiles without moving the mosaic geometry. Spica stays
// anchored to the i in the title; the rest of Virgo is intentionally omitted.
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearest = (tiles, p) => tiles.reduce((best, tile) =>
  distance(tile.center, p) < distance(best.center, p) ? tile : best);

function nextArmTile(tiles, center, arm, used) {
  const direction = [arm.center[0] - center.center[0], arm.center[1] - center.center[1]];
  const target = [arm.center[0] + direction[0], arm.center[1] + direction[1]];
  const available = tiles.filter(tile => !used.includes(tile));
  const forward = available.filter(tile =>
    (tile.center[0] - arm.center[0]) * direction[0]
      + (tile.center[1] - arm.center[1]) * direction[1] > 0);
  return nearest(forward.length ? forward : available, target);
}

export function layoutConstellation(tiles, dot, _scale) {
  const spica = nearest(tiles, dot);
  const spicaCore = [spica];

  // The four long sides alternate with chipped corners. The first ring makes a
  // compact cross from the fitted tesserae surrounding the title's i-dot.
  for (let i = 1; i < spica.points.length; i += 2) {
    const a = spica.points[i];
    const b = spica.points[(i + 1) % spica.points.length];
    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const outward = [midpoint[0] - spica.center[0], midpoint[1] - spica.center[1]];
    const neighbors = tiles.filter(tile => !spicaCore.includes(tile)
      && (tile.center[0] - midpoint[0]) * outward[0]
        + (tile.center[1] - midpoint[1]) * outward[1] > 0);
    spicaCore.push(nearest(neighbors, midpoint));
  }

  // Extend each arm by one more tessera at night, making Spica read as a
  // distinct cross rather than another single-tile background star.
  const outerArms = spicaCore.slice(1).map(arm =>
    nextArmTile(tiles, spica, arm, [...spicaCore]));
  const spicaTiles = [...spicaCore, ...outerArms];

  // Snap the heading by at most half a tessera so the i points exactly at Spica.
  const shift = [spica.center[0] - dot[0], spica.center[1] - dot[1]];

  // The night raster has 21 baked stars. Mask roughly one quarter of them with
  // their original sky glaze to make the field a little quieter.
  const ordinaryStars = tiles
    .filter(tile => tile.star && !spicaTiles.includes(tile))
    .sort((a, b) => a.center[0] - b.center[0] || a.center[1] - b.center[1]);
  const hiddenStars = ordinaryStars.filter((_, index) => index % 4 === 1);

  return { spica, spicaCore, spicaTiles, shift, hiddenStars };
}

function brighten(hex, amount) {
  return [0, 2, 4].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, "0");
  }).join("");
}

export function tileMarkup(tile, kind) {
  const color = kind === "sky" ? tile.sky
    : kind === "spica-night-center" ? brighten(tile.moon, 0.98)
    : kind === "spica-night" || kind === "spica" ? brighten(tile.moon, 0.94)
    : kind === "spica-night-outer" ? brighten(tile.moon, 0.88)
    : tile.moon;
  const point = p => p.map(n => n.toFixed(2)).join(" ");
  const light = [], dark = [];
  tile.points.forEach((a, i) => {
    const b = tile.points[(i + 1) % tile.points.length];
    (0.8 * (b[0] - a[0]) - 0.6 * (b[1] - a[1]) > 0 ? light : dark)
      .push(`M${point(a)}L${point(b)}`);
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
  svg.innerHTML = `<defs><filter id="tile-glaze" filterUnits="userSpaceOnUse" x="0" y="0" width="1400" height="350" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" seed="17"/>
    <feColorMatrix type="matrix" values="0.15 0 0 0 0.42  0 0.15 0 0 0.42  0 0 0.15 0 0.42  0 0 0 1 0"/>
    <feBlend in="SourceGraphic" mode="soft-light"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter></defs><g filter="url(#tile-glaze)">
    <g class="night-sky-adjustments"></g>
    <g class="spica-day-tiles"></g>
    <g class="spica-night-tiles"></g>
  </g>`;
  scene.append(svg);

  const adjustments = svg.querySelector(".night-sky-adjustments");
  const daySpica = svg.querySelector(".spica-day-tiles");
  const nightSpica = svg.querySelector(".spica-night-tiles");
  let shift = [0, 0];

  function update() {
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width) return;
    letter.firstChild.nodeValue = "ı";
    const anchor = dot.getBoundingClientRect();
    const pixelScale = bounds.width / 1400;
    const target = [
      (anchor.left - shift[0] - bounds.left) / pixelScale,
      (anchor.top - shift[1] - bounds.top) / pixelScale,
    ];
    const fontSize = parseFloat(getComputedStyle(heading).fontSize);
    const layout = layoutConstellation(tiles, target, 1);

    const bottom = Math.max(...layout.spicaTiles.flatMap(tile => tile.points.map(p => p[1])));
    const drop = Math.max(0, (bottom - layout.spica.center[1]) * pixelScale - fontSize * 0.1);
    heading.style.setProperty("--title-drop", `${drop}px`);
    shift = layout.shift.map(n => n * pixelScale);
    heading.style.translate = `${shift[0]}px ${shift[1]}px`;

    adjustments.innerHTML = layout.hiddenStars.map(tile => tileMarkup(tile, "sky")).join("");
    daySpica.innerHTML = layout.spicaCore.map(tile => tileMarkup(tile, "spica-day")).join("");
    nightSpica.innerHTML = [
      tileMarkup(layout.spicaTiles[0], "spica-night-center"),
      ...layout.spicaTiles.slice(1, 5).map(tile => tileMarkup(tile, "spica-night")),
      ...layout.spicaTiles.slice(5).map(tile => tileMarkup(tile, "spica-night-outer")),
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
    document.querySelector(".mosaic-tile-colors")?.remove();
    document.querySelector(".spica-letter").firstChild.nodeValue = "i";
    document.querySelector(".title-group").style.translate = "";
    document.querySelector(".title-group").style.removeProperty("--title-drop");
  });
}
