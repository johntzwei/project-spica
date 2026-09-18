// Optional real-browser regression check. No browser dependency is needed to
// build/test/publish the site; supply an installed Playwright module for this
// visual check (see README.md). Screenshots stay outside the repository.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ORIGIN || "http://localhost:3000";
const output = process.env.SCREENSHOTS || await mkdtemp(join(tmpdir(), "spica-mosaic-check-"));
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "spica-zoom-profile-"));
const options = { executablePath: process.env.CHROMIUM || "/usr/bin/chromium", headless: true };
const errors = [];
const results = [];
const watch = page => page.on("pageerror", error => errors.push(error.message));
const settle = async page => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll(".mosaic-art")].map(image => image.decode()));
  });
  await page.waitForFunction(() => document.querySelector(".mosaic-tile-colors")?.dataset.mosaic
    === getComputedStyle(document.querySelector(".mosaic-hero")).getPropertyValue("--mosaic-id").trim());
  await page.locator(".theme-toggle").waitFor({ state: "visible" });
  // A resize within one composition doesn't change data-mosaic. Allow its
  // ResizeObserver/requestAnimationFrame pass to realign the title before
  // measuring the star (including cached, immediately decoded images).
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
async function check(page, name) {
  const metrics = await page.evaluate(() => {
    const rect = selector => {
      const { x, y, width, height, right, bottom } = document.querySelector(selector).getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const hero = rect(".mosaic-hero");
    const scene = rect(".mosaic-scene");
    const image = document.querySelector(".mosaic-night");
    const star = document.querySelector('.spica-night-mark [data-tile="spica"]');
    const box = star.getBBox();
    const center = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(star.getScreenCTM());
    const anchor = document.querySelector(".spica-dot").getBoundingClientRect();
    const starError = Math.hypot(center.x - anchor.x, center.y - anchor.y);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Regression for the original bug: sample what is actually visible near
    // the banner's bottom, not just the bottom of the uncropped source image.
    const field = [0.05, 0.25, 0.5, 0.75, 0.95].map(fraction => {
      const x = (Math.min(hero.width, scene.width) * fraction - scene.x) / scene.width * canvas.width;
      const y = (hero.height * 0.92 - scene.y) / scene.height * canvas.height;
      return [...ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data];
    });
    return { innerWidth, innerHeight, devicePixelRatio, hero, scene, field, starError,
      toggle: rect(".theme-toggle"), title: rect(".site-title"),
      composition: document.querySelector(".mosaic-tile-colors").dataset.mosaic,
      source: image.currentSrc, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert(Math.abs(metrics.hero.height - metrics.scene.height) < 0.1, `${name}: vertical crop`);
  assert(metrics.toggle.y >= 0 && metrics.toggle.bottom <= metrics.hero.bottom, `${name}: sun/moon clipped vertically`);
  assert(metrics.toggle.x >= 0 && metrics.toggle.right <= metrics.hero.right, `${name}: sun/moon clipped horizontally`);
  assert(metrics.title.right < metrics.toggle.x, `${name}: title overlaps sun/moon: ${JSON.stringify(metrics)}`);
  assert(metrics.field.every(([r, , b, a]) => r > b && a === 255), `${name}: field missing`);
  assert(!metrics.overflow, `${name}: horizontal overflow`);
  assert(metrics.starError < 2, `${name}: Spica is ${metrics.starError}px from the title's dot`);
  for (const theme of ["night", "day"]) {
    if (theme === "day") {
      await page.locator(".theme-toggle").click();
      assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    }
    await page.screenshot({ path: join(output, `${name}-${theme}.png`) });
  }
  await page.locator(".theme-toggle").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  results.push({ name, ...metrics });
  console.log(`${name}: ${metrics.composition}, field visible, toggle and title in bounds`);
}

let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    ...options, viewport: null, args: ["--window-size=1440,1020"],
  });
  const settings = await context.newPage();
  await settings.goto("chrome://settings/appearance");
  const page = await context.newPage();
  watch(page);
  for (const [percent, zoom] of [[100, 1], [80, 0.8], [67, 2 / 3], [50, 0.5], [33, 1 / 3], [25, 0.25], [125, 1.25], [150, 1.5], [200, 2]]) {
    // Browser zoom, not CSS zoom, device emulation, or pinch zoom. The profile
    // is isolated and deleted afterwards; no personal browser is touched.
    await settings.evaluate(value => new Promise(resolve => chrome.settingsPrivate.setDefaultZoom(value, resolve)), zoom);
    if (percent === 100) await page.goto(origin, { waitUntil: "networkidle" });
    await page.waitForFunction(width => Math.abs(innerWidth - width) <= 1, 1440 / zoom);
    await settle(page);
    await check(page, `zoom-${percent}`);
  }
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}

const browser = await chromium.launch(options);
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  watch(page);
  await page.goto(origin, { waitUntil: "networkidle" });
  for (const width of [320, 390, 768, 1280, 1281, 1920, 1921, 2560, 2561, 3840, 3841, 5760, 5761, 7680, 12000, 1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await settle(page);
    await check(page, `width-${width}`);
  }
  for (const link of ["Roadmap", "Research", "People", "Mission"]) {
    await page.getByRole("link", { name: link, exact: true }).first().click();
    await settle(page);
    assert.equal(await page.locator(".mosaic-tile-colors").getAttribute("data-mosaic"), "standard");
  }
  await context.close();

  for (const width of [390, 1440, 2880, 7680]) {
    const noJS = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
    const page = await noJS.newPage();
    await page.goto(origin, { waitUntil: "networkidle" });
    assert(await page.locator(".mosaic-night").evaluate(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator(".theme-toggle").isVisible(), false);
    await page.screenshot({ path: join(output, `nojs-${width}.png`) });
    await noJS.close();
  }
  for (const width of [390, 1440, 2880]) {
    const retina = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    const page = await retina.newPage();
    watch(page);
    await page.goto(origin, { waitUntil: "networkidle" });
    await settle(page);
    await check(page, `retina-${width}`);
    await retina.close();
  }

  // Only the chosen composition should be fetched on a cold navigation.
  const cold = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const coldPage = await cold.newPage();
  const requested = [];
  coldPage.on("request", request => requested.push(new URL(request.url()).pathname));
  await coldPage.goto(origin, { waitUntil: "networkidle" });
  await settle(coldPage);
  assert(requested.filter(path => path.includes("spica-mosaic")).every(path => path.includes("-wide")));
  assert.deepEqual(requested.filter(path => path.includes("sky-tiles")), ["/images/sky-tiles-wide.json"]);
  await cold.close();

  // A slow old tile response must not repaint a newer composition.
  const race = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const racePage = await race.newPage();
  watch(racePage);
  const pending = new Map();
  await racePage.route("**/images/sky-tiles-*.json", route => {
    pending.set(new URL(route.request().url()).pathname, route);
  });
  await racePage.goto(origin, { waitUntil: "domcontentloaded" });
  const until = async predicate => {
    for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 50));
    assert(predicate(), "Timed out waiting for a tile request");
  };
  await until(() => pending.has("/images/sky-tiles-wide.json"));
  await racePage.setViewportSize({ width: 2880, height: 900 });
  await until(() => pending.has("/images/sky-tiles-panoramic.json"));
  await pending.get("/images/sky-tiles-panoramic.json").continue();
  await settle(racePage);
  await pending.get("/images/sky-tiles-wide.json").continue();
  await racePage.waitForTimeout(200);
  assert.equal(await racePage.locator(".mosaic-tile-colors").getAttribute("data-mosaic"), "panoramic");
  await race.close();

  for (const failure of ["tiles", "night"]) {
    const failed = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await failed.newPage();
    watch(page);
    await page.route(failure === "tiles" ? "**/images/sky-tiles-*.json" : "**/images/spica-mosaic-night-*.webp", route => route.abort());
    await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".spica-letter").evaluate(letter => letter.firstChild.nodeValue), "i");
    assert.equal(await page.locator(".mosaic-tile-colors").isVisible(), false);
    if (failure === "night") {
      assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
      assert.equal(await page.locator(".theme-toggle").isVisible(), false);
    }
    await failed.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
await writeFile(join(output, "measurements.json"), JSON.stringify(results, null, 2));
console.log(`Browser checks passed. Screenshots: ${output}`);
