const toggle = document.querySelector(".theme-toggle");
const artwork = document.querySelector(".mosaic-day");
const nightArtwork = document.querySelector(".mosaic-night");
const themeColor = document.querySelector('meta[name="theme-color"]');

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

toggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme !== "dark");
});
