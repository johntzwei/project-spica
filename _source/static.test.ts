import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import { buildSite, filesIn } from "./scripts/build";
import { staticHandler } from "./scripts/preview";

let directory: string;
let fetch: (request: Request) => Response;
const request = (path: string, method = "GET") => fetch(new Request(`https://projectspica.org${path}`, { method }));
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "spica-static-"));
  await buildSite(directory);
  fetch = await staticHandler(directory);
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

const pages = ["mission", "roadmap", "research", "people"];
describe("exported GitHub Pages site", () => {
  test.each(["/", ...pages.map(page => `/${page}/`)])("renders %s without JavaScript", async path => {
    const response = request(path);
    expect(response.status).toBe(200);
    const html = await response.text();
    const active = path === "/" ? "mission" : path.split("/")[1];
    for (const page of pages) {
      const section = html.match(new RegExp(`<section[^>]*id="${page}"[^>]*>`))![0];
      expect(section.includes(" hidden")).toBe(page !== active);
      expect(html).toContain(`href="/${page}/"`);
    }
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain(`<link rel="canonical" href="https://projectspica.org/${active}/"`);
    expect(html).toContain('content="https://projectspica.org/og.png"');
    expect(html).toContain('content="1200"');
    expect(html).not.toContain("googletagmanager");
    expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf('<script src='));
    expect(await request(path, "HEAD").text()).toBe("");
  });

  test("research entries include dates in newest-first order", async () => {
    const html = await request("/research/").text();
    const list = html.match(/<ul class="research-links">([\s\S]*?)<\/ul>/)![1];
    const entries = [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1]);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toContain('href="/research/localizing-memorization/"');
    expect(entries[0]).toContain('<time datetime="2026-09">September 2026</time>');
    expect(entries[1]).toContain('href="/research/phd-thesis.pdf"');
    expect(entries[1]).toContain('<time datetime="2026-05">May 2026</time>');
    expect(entries[2]).toContain('<a href="https://huggingface.co/collections/allegrolab/hubble-core">Model organisms for memorization (Hubble)</a>');
    expect(entries[2]).toContain('<time datetime="2025-10">October 2025</time>');
  });

  test("exports the full standalone article with its own metadata and shared shell", async () => {
    const path = "/research/localizing-memorization/";
    const response = request(path);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<article class="research-article"');
    expect(html).toContain('href="/research/" aria-current="location"');
    expect(html).not.toContain('Back to Research');
    expect(html).toContain('<a href="/research/localizing-memorization.pdf">Download PDF</a>');
    expect(html).toContain('<link rel="canonical" href="https://projectspica.org/research/localizing-memorization/"');
    expect(html).toContain('<meta property="og:type" content="article"');
    expect(html).toContain('<meta property="og:title" content="Localizing latent mechanisms in weight space by spiking the training data — Project Spica"');
    expect(html).toContain('<meta name="twitter:description" content="Localizing latent mechanisms');
    expect(html).toContain('src="/navigation.js"');
    expect(html).toContain('data-page="/research/localizing-memorization"');
    expect(html).not.toContain('id="mission"');
    expect(html.match(/display="block"/g)).toHaveLength(12);
    expect(html.match(/<table /g)).toHaveLength(5);
    expect(html.match(/<li id="reference-/g)).toHaveLength(22);
    expect(await request(path, "HEAD").text()).toBe("");
    expect(await request(`${path}index.html`).text()).toBe(html);
    expect(await request("/sitemap.xml").text()).toContain(`https://projectspica.org${path}`);
    for (const page of pages) {
      expect(await request(`/${page}/`).text()).not.toContain('class="research-article"');
    }
  });

  test.each([...pages, "about", "research/localizing-memorization"])("redirects /%s to its directory URL", page => {
    const response = request(`/${page}?ref=test`);
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(`https://projectspica.org/${page}/?ref=test`);
  });

  test("all local HTML links, images, scripts and responsive sources exist", async () => {
    for (const file of (await filesIn(directory)).filter(path => path.endsWith(".html"))) {
      const html = await Bun.file(join(directory, file)).text();
      const links = [...html.matchAll(/(?:href|src)="(\/[^"\s]*)"/g)].map(match => match[1]);
      for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
        links.push(...match[1].split(",").map(entry => entry.trim().split(" ")[0]));
      }
      for (const link of links) expect(request(link).status, `${file}: ${link}`).toBe(200);
    }
    expect((await request("/images/sky-tiles.json").json()).length).toBeGreaterThan(0);
    const font = Buffer.from(await request("/fonts/stix-two-math.woff2").arrayBuffer());
    expect(font.toString("ascii", 0, 4)).toBe("wOF2");
    expect(await request("/fonts/stix-two-OFL.txt").text()).toContain("SIL OPEN FONT LICENSE Version 1.1");
    for (const path of ["/research/phd-thesis.pdf", "/research/localizing-memorization.pdf"]) {
      const pdf = await request(path).text();
      expect(pdf.startsWith("%PDF-"), path).toBe(true);
    }
  });

  test("publishes the domain, sitemap, social image and no implementation files", async () => {
    expect(await request("/CNAME").text()).toBe("projectspica.org\n");
    expect(await request("/robots.txt").text()).toContain("https://projectspica.org/sitemap.xml");
    const sitemap = await request("/sitemap.xml").text();
    for (const page of pages) expect(sitemap).toContain(`https://projectspica.org/${page}/`);
    const image = new DataView(await request("/og.png").arrayBuffer());
    expect(image.getUint32(16)).toBe(1200);
    expect(image.getUint32(20)).toBe(630);
    for (const path of ["/_source/server.ts", "/_source/articles/localizing-memorization.html", "/package.json", "/.git/config", "/missing", "/missing/"]) {
      expect(request(path).status).toBe(404);
      expect(await request(path).text()).toContain("Page not found");
    }
    expect(request("/", "POST").status).toBe(405);
  });

  test("about has a no-JavaScript redirect and explicit fallback link", async () => {
    const html = await request("/about/").text();
    expect(html).toContain('http-equiv="refresh" content="0; url=/mission/"');
    expect(html).toContain('<a href="/mission/">Mission</a>');
  });

  test("builds deterministically", async () => {
    const second = await mkdtemp(join(tmpdir(), "spica-repeat-"));
    try {
      await buildSite(second);
      const files = await filesIn(directory);
      expect(await filesIn(second)).toEqual(files);
      for (const path of files) {
        expect(Buffer.from(await Bun.file(join(second, path)).arrayBuffer()).equals(
          Buffer.from(await Bun.file(join(directory, path)).arrayBuffer()),
        ), path).toBe(true);
      }
    } finally { await rm(second, { recursive: true, force: true }); }
  });
});

const legacy = await Bun.file(new URL("./public/legacy.js", import.meta.url)).text();
function redirect(path: string) {
  const redirects: string[] = [];
  const handlers = new Map<string, () => void>();
  const location = { href: `https://projectspica.org${path}`, replace: (target: string) => redirects.push(target) };
  runInNewContext(legacy, { URL, window: {
    location,
    addEventListener: (event: string, handler: () => void) => handlers.set(event, handler),
  } });
  return { redirects, handlers, location };
}

describe("legacy bookmarks", () => {
  test.each([
    ["/#about", "/mission/"],
    ["/#approach", "/roadmap/"],
    ["/#usecaseCarousel", "/roadmap/"],
    ["/#people", "/people/"],
    ["/?page=about&ref=test", "/mission/?ref=test"],
    ["/?page=people&ref=test", "/people/?ref=test"],
    ["/about/?ref=test", "/mission/?ref=test"],
    ["/about?ref=test", "/mission/?ref=test"],
    ["/index.html#people", "/people/"],
    ["/?ref=test#people", "/people/?ref=test"],
    ["/#activities", "https://projectspica.substack.com/"],
    ["/?ref=private#subscribe", "https://projectspica.substack.com/subscribe"],
  ])("maps %s to its replacement", (path, destination) => {
    expect(redirect(path).redirects).toEqual([new URL(destination, "https://projectspica.org").href]);
  });

  test.each(["/?page=https://evil.example", "/#unknown", "/#main", "/#constructor", "/#toString", "/people/", "/research/#people"])("does not redirect %s", path => {
    expect(redirect(path).redirects).toEqual([]);
  });

  test("handles a legacy hash added after initial load", () => {
    const browser = redirect("/");
    browser.location.href += "#people";
    browser.handlers.get("hashchange")!();
    expect(browser.redirects).toEqual(["https://projectspica.org/people/"]);
  });
});
