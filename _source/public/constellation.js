// Keep the quieter night star field, but render Spica as its own small mosaic
// object instead of trying to form it from arbitrary background tesserae.
export function selectHiddenStars(tiles) {
  return tiles
    .filter(tile => tile.star)
    .sort((a, b) => a.center[0] - b.center[0] || a.center[1] - b.center[1])
    .filter((_, index) => index % 4 === 1);
}

function tilePath(points) {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join("") + "Z";
}

const spicaTiles = [
  // Center.
  [[24, 17], [31, 24], [24, 31], [17, 24]],
  // Long cross arms.
  [[20, 17], [21, -10], [27, -11], [28, 17], [24, 21]],
  [[31, 20], [59, 21], [60, 27], [31, 28], [27, 24]],
  [[28, 31], [27, 59], [21, 60], [20, 31], [24, 27]],
  [[17, 28], [-10, 27], [-11, 21], [17, 20], [21, 24]],
  // Four small ceramic shards make the star feel cut from the same mosaic
  // without turning the cross into a generic vector sparkle.
  [[28, 16], [34, 11], [37, 14], [31, 20]],
  [[32, 28], [37, 34], [34, 37], [28, 31]],
  [[20, 32], [14, 37], [11, 34], [16, 28]],
  [[16, 20], [11, 14], [14, 11], [20, 16]],
];

export function spicaMarkup() {
  const paths = spicaTiles.map((points, index) =>
    `<path class="spica-piece spica-piece-${index}" d="${tilePath(points)}"/>`).join("");
  return `<g class="spica-day-mark">${paths}</g><g class="spica-night-mark">${paths}</g>`;
}

const daySkyPalette = ["9e0f2a", "b41429", "c31f28", "920d28", "c62628", "ae1229"];

function tileOutline(tile) {
  const point = p => p.map(n => n.toFixed(2)).join(" ");
  return `M${tile.points.map(point).join("L")}Z`;
}

export function skyTileMarkup(tile) {
  return `<path data-tile="sky-mask" fill="#${tile.sky}" d="${tileOutline(tile)}"/>`;
}

export function daySkyTileMarkup(tile) {
  // Use the same red family as the generated day mosaic, with deterministic
  // variation so the replacement tiles do not read as a flat painted patch.
  const index = Math.abs(Math.round(tile.center[0] * 7 + tile.center[1] * 11)) % daySkyPalette.length;
  return `<path data-tile="day-sky-mask" fill="#${daySkyPalette[index]}" d="${tileOutline(tile)}"/>`;
}

export function selectSpicaUnderlayTiles(tiles, center, scale) {
  // Transform fitted sky-tile centers into the custom star's 48-unit local
  // coordinate system. Select a padded cross/diamond footprint so the original
  // colored tesserae beneath Spica are replaced while nearby grout remains.
  return tiles.filter(tile => {
    const x = (tile.center[0] - center[0]) / scale + 24;
    const y = (tile.center[1] - center[1]) / scale + 24;
    const dx = Math.abs(x - 24);
    const dy = Math.abs(y - 24);
    const cardinal = (dx <= 8 && dy <= 38) || (dy <= 8 && dx <= 38);
    const centerDiamond = dx + dy <= 23;
    return cardinal || centerDiamond;
  });
}

async function attachSpica() {
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
  svg.innerHTML = `<defs>
    <filter id="spica-ceramic" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="2" seed="23" result="texture"/>
      <feColorMatrix in="texture" type="matrix"
        values="0.16 0 0 0 0.42  0 0.16 0 0 0.42  0 0 0.16 0 0.42  0 0 0 0.32 0" result="softTexture"/>
      <feBlend in="SourceGraphic" in2="softTexture" mode="soft-light"/>
    </filter>
  </defs>
  <g class="night-sky-adjustments"></g>
  <g class="spica-underlay-day"></g>
  <g class="spica-underlay-night"></g>
  <g class="spica-overlay" filter="url(#spica-ceramic)">
    ${spicaMarkup()}
  </g>`;

  scene.append(svg);
  const adjustments = svg.querySelector(".night-sky-adjustments");
  const dayUnderlay = svg.querySelector(".spica-underlay-day");
  const nightUnderlay = svg.querySelector(".spica-underlay-night");
  const overlay = svg.querySelector(".spica-overlay");

  // Dim a handful of the baked night stars; Spica is now the only prominent
  // star around the title.
  adjustments.innerHTML = selectHiddenStars(tiles).map(skyTileMarkup).join("");

  function update() {
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width) return;

    // The custom star becomes the i-dot.
    letter.firstChild.nodeValue = "ı";
    const anchor = dot.getBoundingClientRect();
    const pixelScale = bounds.width / 1400;
    const x = (anchor.left + anchor.width / 2 - bounds.left) / pixelScale;
    const y = (anchor.top + anchor.height / 2 - bounds.top) / pixelScale;
    const fontSize = parseFloat(getComputedStyle(heading).fontSize);

    // The cross now extends farther than the original compact mark while keeping
    // its center anchored precisely over the i-dot.
    const scale = (fontSize * 0.48 / 48) / pixelScale;
    const underlayTiles = selectSpicaUnderlayTiles(tiles, [x, y], scale);
    dayUnderlay.innerHTML = underlayTiles.map(daySkyTileMarkup).join("");
    nightUnderlay.innerHTML = underlayTiles.map(skyTileMarkup).join("");
    overlay.setAttribute("transform", `translate(${x} ${y}) scale(${scale}) translate(-24 -24)`);
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
  attachSpica().catch(() => {
    document.querySelector(".mosaic-tile-colors")?.remove();
    document.querySelector(".spica-letter").firstChild.nodeValue = "i";
  });
}
