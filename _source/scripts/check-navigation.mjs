// Optional real-browser regression check against the static preview. Supply
// PLAYWRIGHT_MODULE and CHROMIUM as for check-mosaics.mjs; no build dependency.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ORIGIN || "http://localhost:3000";
const article = "/research/localizing-memorization/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/usr/bin/chromium", headless: true });
const errors = [];
const ready = async page => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll(".mosaic-art")].map(image => image.decode()));
  });
  await page.waitForFunction(() => document.querySelector(".mosaic-tile-colors")?.dataset.mosaic);
};
const routeIs = async (page, path) => {
  await page.waitForFunction(path => document.querySelector("#main").dataset.page === path.replace(/\/$/, ""), path);
  assert.equal(new URL(page.url()).pathname, path);
};
// Moving the wordmark's children between h1/div can slightly change text
// antialiasing. Compare decoded pixels with a small tolerance, not PNG bytes.
const stablePixels = async (page, before, after) => {
  const difference = await page.evaluate(async ({ before, after }) => {
    const pixels = async encoded => {
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const a = await pixels(before), b = await pixels(after);
    if (a.length !== b.length) return { max: 255, mean: 255 };
    let max = 0, sum = 0;
    for (let i = 0; i < a.length; i++) {
      const delta = Math.abs(a[i] - b[i]);
      max = Math.max(max, delta);
      sum += delta;
    }
    return { max, mean: sum / a.length };
  }, { before: before.toString("base64"), after: after.toString("base64") });
  assert(difference.max <= 8 && difference.mean < 0.1, `Header pixels changed: ${JSON.stringify(difference)}`);
};
const captureShell = page => page.evaluate(() => {
  window.originalShell = [...document.querySelectorAll(".site-header, .mosaic-art, .mosaic-tile-colors, .spica-letter, .spica-dot, .theme-toggle")];
});
const sameShell = async page => assert(await page.evaluate(() => {
  const current = [...document.querySelectorAll(".site-header, .mosaic-art, .mosaic-tile-colors, .spica-letter, .spica-dot, .theme-toggle")];
  return window.originalShell?.every((node, i) => node === current[i] && node.isConnected);
}), "The mosaic, overlay, title children and theme control must survive navigation");

try {
  for (const width of [1280, 390]) {
    for (const theme of ["dark", "light"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${origin}/research/`);
      await ready(page);
      if (theme === "light") await page.locator(".theme-toggle").click();
      await page.mouse.move(0, 850);
      await captureShell(page);
      const titleBounds = await page.locator(".site-title").boundingBox();
      const before = await page.locator(".site-header").screenshot();
      const documents = [];
      page.on("request", request => { if (request.isNavigationRequest()) documents.push(request.url()); });
      await page.locator(`#research a[href="${article}"]`).click();
      await routeIs(page, article);
      await sameShell(page);
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator("math[display=block]").count(), 12);
      assert.equal(await page.locator(".section-nav a[aria-current=location]").textContent(), "Research");
      assert.equal(await page.locator('meta[property="og:type"]').getAttribute("content"), "article");
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `https://projectspica.org${article}`);
      assert(await page.evaluate(() => document.activeElement.id === "main"));
      const nextBounds = await page.locator(".site-title").boundingBox();
      assert(Object.keys(titleBounds).every(key => Math.abs(nextBounds[key] - titleBounds[key]) < 0.01), "Wordmark moved");
      await stablePixels(page, before, await page.locator(".site-header").screenshot());

      // Native citation history must not reset the article to its beginning.
      await page.locator('a[href="#reference-12"]').first().click();
      await page.waitForFunction(() => window.location.hash === "#reference-12");
      await page.waitForFunction(() => window.scrollY > 500);
      await page.goBack();
      await page.waitForFunction(() => !window.location.hash);
      await routeIs(page, article);
      await page.goBack();
      await routeIs(page, "/research/");
      await page.goForward();
      await routeIs(page, article);
      await sameShell(page);
      await page.locator('.section-nav a[href="/people/"]').click();
      await routeIs(page, "/people/");
      assert.equal(await page.locator("h1.site-title").count(), 1);
      assert.equal(await page.locator('meta[property="og:type"]').getAttribute("content"), "website");
      await sameShell(page);
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert.deepEqual(documents, [], "Enhanced navigation must not request a new document");
      console.log(`${width}px / ${theme}: stable header pixels/wordmark, persistent nodes/theme, history, anchors, metadata`);
      await context.close();
    }
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}${article}#reference-12`);
  await ready(page);
  await captureShell(page);
  await page.locator('.section-nav a[href="/research/"]').click();
  await routeIs(page, "/research/");
  await sameShell(page);
  const articleLink = page.locator(`#research a[href^="${article}"]`);
  await articleLink.evaluate(link => { link.setAttribute("href", `${link.getAttribute("href")}?ref=test#equation-7`); });
  await articleLink.click();
  await routeIs(page, article);
  assert.equal(new URL(page.url()).search, "?ref=test");
  assert.equal(new URL(page.url()).hash, "#equation-7");
  assert(await page.locator("#equation-7").evaluate(node => Math.abs(node.getBoundingClientRect().top) < 100));
  await sameShell(page);
  console.log("Direct article visit: enhanced exit and cross-page fragments work");

  // Delay only the fetch, leaving ordinary document navigation available.
  await page.goto(`${origin}/research/`);
  await ready(page);
  await captureShell(page);
  let release;
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  const releasedPromise = new Promise(resolve => { release = resolve; });
  await page.route(`**${article}`, async route => {
    started();
    await releasedPromise;
    await route.continue().catch(() => {}); // It may have been aborted already.
  });
  await articleLink.click();
  await startedPromise;
  assert.equal(await page.locator("#main").getAttribute("aria-busy"), "true");
  await page.locator('.section-nav a[href="/people/"]').click();
  release();
  await routeIs(page, "/people/");
  await page.waitForTimeout(200);
  await routeIs(page, "/people/");
  await sameShell(page);
  await page.unroute(`**${article}`);
  console.log("Slow article fetch: newer navigation wins without replacing the header");

  await page.goto(`${origin}/research/`);
  await page.route(`**${article}`, route => route.request().isNavigationRequest()
    ? route.continue() : route.fulfill({ status: 503, contentType: "text/html", body: "Unavailable" }));
  await articleLink.click();
  await page.waitForURL(`${origin}${article}`);
  await page.waitForLoadState("load");
  assert.equal(await page.locator("article.research-article").count(), 1);
  console.log("Failed enhancement: normal document navigation still works");
  await context.close();

  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJS.newPage();
  await staticPage.goto(`${origin}/research/`);
  await staticPage.locator(`#research a[href="${article}"]`).click();
  assert.equal(await staticPage.locator("article.research-article").count(), 1);
  await staticPage.locator('.section-nav a[href="/people/"]').click();
  assert(await staticPage.locator("#people").isVisible());
  await noJS.close();
  console.log("No JavaScript: article and section links remain functional");
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
