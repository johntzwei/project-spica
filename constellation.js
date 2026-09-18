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
  [[20, 17], [22, 2], [26, 1], [28, 17], [24, 21]],
  [[31, 20], [47, 22], [48, 26], [31, 28], [27, 24]],
  [[28, 31], [26, 47], [22, 48], [20, 31], [24, 27]],
  [[17, 28], [2, 26], [1, 22], [17, 20], [21, 24]],
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

export function skyTileMarkup(tile) {
  const point = p => p.map(n => n.toFixed(2)).join(" ");
  return `<path data-tile="sky-mask" fill="#${tile.sky}" d="M${tile.points.map(point).join("L")}Z"/>`;
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
  <g class="spica-overlay" filter="url(#spica-ceramic)">
    ${spicaMarkup()}
  </g>`;

  scene.append(svg);
  const adjustments = svg.querySelector(".night-sky-adjustments");
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

    // 48 SVG units render at about 0.46em: noticeable, but still part of the
    // title rather than a second logo floating over it.
    const scale = (fontSize * 0.46 / 48) / pixelScale;
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
