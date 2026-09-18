const toggle = document.querySelector(".theme-toggle");
const artwork = document.querySelector(".mosaic-day");
const nightArtwork = document.querySelector(".mosaic-night");
const themeColor = document.querySelector('meta[name="theme-color"]');

const leverSound = new Audio("/audio/minecraft-lever.ogg");
leverSound.preload = "auto";

// Keep the daytime artwork usable if the night image cannot be loaded.
nightArtwork.decode().then(() => {
  toggle.hidden = false;
}).catch(() => {
  setTheme(false);
});

function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  toggle.setAttribute("aria-label", label);
  toggle.setAttribute("aria-pressed", String(dark));
  artwork.setAttribute("aria-hidden", String(dark));
  nightArtwork.setAttribute("aria-hidden", String(!dark));
  themeColor.content = dark ? "#050914" : "#730f24";
}

function playLeverClick(powered) {
  const audio = leverSound.cloneNode(true);
  audio.volume = 0.3;
  audio.playbackRate = powered ? 0.6 : 0.5;
  if ("preservesPitch" in audio) audio.preservesPitch = false;
  if ("mozPreservesPitch" in audio) audio.mozPreservesPitch = false;
  if ("webkitPreservesPitch" in audio) audio.webkitPreservesPitch = false;
  void audio.play().catch(() => {});
}

toggle.addEventListener("click", () => {
  const nextDark = document.documentElement.dataset.theme !== "dark";
  playLeverClick(!nextDark);
  setTheme(nextDark);
});
