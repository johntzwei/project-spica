// Keep the quieter night star field, but make Spica itself a rasterized
// ceramic mosaic asset rather than an SVG/vector construction.
export function selectHiddenStars(tiles) {
  return tiles
    .filter(tile => tile.star)
    .sort((a, b) => a.center[0] - b.center[0] || a.center[1] - b.center[1])
    .filter((_, index) => index % 4 === 1);
}

export function skyTileMarkup(tile) {
  const point = p => p.map(n => n.toFixed(2)).join(" ");
  return `<path data-tile="sky-mask" fill="#${tile.sky}" d="M${tile.points.map(point).join("L")}Z"/>`;
}

async function attachSpica() {
  const scene = document.querySelector(".mosaic-scene");
  const letter = document.querySelector(".spica-letter");
  const dot = document.querySelector(".spica-dot");
  const heading = document.querySelector(".title-group");

  const response = await fetch("/images/sky-tiles.json");
  if (!response.ok) throw new Error("Sky tiles unavailable");
  const tiles = await response.json();
  if (!tiles.length) throw new Error("Empty sky tiles");
  await document.fonts.ready;

  // Only the background-star reduction still uses fitted SVG tile outlines.
  // Spica itself is a transparent WebP made from irregular ceramic tesserae.
  const mask = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mask.setAttribute("viewBox", "0 0 1400 350");
  mask.setAttribute("class", "mosaic-tile-colors");
  mask.setAttribute("aria-hidden", "true");
  mask.setAttribute("focusable", "false");
  mask.innerHTML = `<g class="night-sky-adjustments">${selectHiddenStars(tiles).map(skyTileMarkup).join("")}</g>`;
  scene.append(mask);

  const star = document.createElement("img");
  star.className = "spica-raster";
  star.src = "/images/spica-star-mosaic.webp";
  star.alt = "";
  star.setAttribute("aria-hidden", "true");
  star.decoding = "async";
  scene.append(star);

  function update() {
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width) return;

    // The mosaic star replaces the ordinary i-dot.
    letter.firstChild.nodeValue = "ı";
    const anchor = dot.getBoundingClientRect();
    const x = anchor.left + anchor.width / 2 - bounds.left;
    const y = anchor.top + anchor.height / 2 - bounds.top;
    const fontSize = parseFloat(getComputedStyle(heading).fontSize);
    const size = fontSize * 1.15;

    star.style.left = `${x}px`;
    star.style.top = `${y}px`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
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
    document.querySelector(".spica-raster")?.remove();
    document.querySelector(".spica-letter").firstChild.nodeValue = "i";
  });
}
