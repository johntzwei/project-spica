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

// A wooden clack in the spirit of a Minecraft lever, synthesized here because
// Mojang's own sample is not ours to redistribute: a filtered noise burst over
// a short pitched thock. Minecraft pitches the lever down when it switches off
// and up when it switches on, so the sun does the same.
let audio;
let noise;

function leverClick(dark) {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) return;
  try {
    audio ??= new Context();
    // The first click is the gesture that unblocks playback.
    audio.resume?.();
    if (!noise) {
      noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.08), audio.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }

    const now = audio.currentTime;
    const pitch = dark ? 1 : 1.2;
    const output = audio.createGain();
    output.gain.value = 0.3;
    output.connect(audio.destination);

    const clack = audio.createBufferSource();
    clack.buffer = noise;
    const body = audio.createBiquadFilter();
    body.type = "bandpass";
    body.frequency.value = 1800 * pitch;
    body.Q.value = 1.2;
    const clackLevel = audio.createGain();
    clackLevel.gain.setValueAtTime(0.9, now);
    clackLevel.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    clack.connect(body).connect(clackLevel).connect(output);
    clack.start(now);
    clack.stop(now + 0.08);

    const thock = audio.createOscillator();
    thock.type = "triangle";
    thock.frequency.setValueAtTime(420 * pitch, now);
    thock.frequency.exponentialRampToValueAtTime(180 * pitch, now + 0.05);
    const thockLevel = audio.createGain();
    thockLevel.gain.setValueAtTime(0.5, now);
    thockLevel.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    thock.connect(thockLevel).connect(output);
    thock.start(now);
    thock.stop(now + 0.06);
  } catch {
    // A blocked or missing audio device must never break the toggle.
  }
}

toggle.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  setTheme(dark);
  leverClick(dark);
});
