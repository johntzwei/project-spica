import { describe, expect, test } from "bun:test";
import { handleRequest } from "./server";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const request = (path: string, method = "GET") =>
  handleRequest(new Request(`http://localhost${path}`, { method }));

describe("Project Spica server", () => {
  test("serves the home page", async () => {
    const response = request("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).not.toContain("Room to grow.");
    expect(html).not.toContain("space for curiosity");
    const text = html.replace(/<[^>]*>/g, "");
    expect(text).toContain("The worst case scenarios of AI involve the use of latent mechanisms.");
    expect(text).toContain("The goal of the Project is to develop spiking into standard safety practice.");
    expect(text).toContain("Our initial results on localizing memorization are promising.");
    expect(text).toContain("We set out a roadmap to advance the science of spiking and prevent incidents like the OpenAI hack on Hugging Face from ever happening again.");
    expect(html).toContain('<h1 class="site-title" aria-label="Project Spica">');
  });

  test("serves the complete research list after HTML grows without a server restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "spica-server-"));
    try {
      await mkdir(join(directory, "public"));
      await Bun.write(join(directory, "server.ts"), Bun.file(new URL("./server.ts", import.meta.url)));
      const indexPath = join(directory, "public/index.html");
      const html = await Bun.file(new URL("./public/index.html", import.meta.url)).text();
      await Bun.write(indexPath, html);
      const { handleRequest: isolatedRequest } = await import(join(directory, "server.ts"));
      const getResearch = () => isolatedRequest(new Request("http://localhost/research"));
      await getResearch().text();
      await Bun.write(indexPath, html.replace("<main", `<!--${"Extra copy ".repeat(200)}--><main`));
      const updated = await getResearch().text();
      expect(updated).toContain('<section class="content-section" id="research" aria-label="Research">');
      expect(updated).toContain('<a href="/research/localizing-memorization.pdf">Localizing Memorization</a>');
      expect(updated).toContain("</html>");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("links the requested Mission phrases to their references", async () => {
    const html = await request("/mission").text();
    const introduction = html.split('id="mission" aria-label="Mission">')[1].split("</section>")[0];
    const links = [
      ["worst case", "https://ai-2027.com/"],
      ["spiking", "https://johntzwei.github.io/pdfs/PhD_Thesis.pdf"],
      ["auditing privacy leakage", "https://arxiv.org/abs/2305.08846"],
      ["Hubble models", "https://arxiv.org/abs/2510.19811"],
      ["influence functions to identify the weight space direction responsible for memorization", "/research/localizing-memorization.pdf"],
      ["roadmap", "/roadmap"],
      ["OpenAI hack on Hugging Face", "https://openai.com/index/hugging-face-incident-and-the-road-ahead/"],
    ];
    expect(introduction.match(/<a /g)).toHaveLength(links.length);
    for (const [text, href] of links) {
      expect(introduction).toContain(`<a href="${href}">${text}</a>`);
    }
  });

  test.each([
    ["/styles.css", "text/css"],
    ["/theme.js", "javascript"],
    ["/constellation.js", "javascript"],
    ["/images/sky-tiles.json", "application/json"],
    ["/navigation.js", "javascript"],
    ["/research/localizing-memorization.pdf", "application/pdf"],
    ["/images/spica-mosaic-night.svg", "image/svg+xml"],
    ["/images/spica-mosaic.svg", "image/svg+xml"],
    ["/images/spica-mosaic.webp", "image/webp"],
    ["/images/spica-mosaic@2x.webp", "image/webp"],
    ["/images/spica-mosaic-night.webp", "image/webp"],
    ["/images/spica-mosaic-night@2x.webp", "image/webp"],
    ["/favicon.svg", "image/svg+xml"],
    ["/favicon.ico", "image/x-icon"],
  ])("serves %s with the correct content type", async (path, type) => {
    const response = request(path);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain(type);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  test("links both satin favicon formats and serves the versioned URLs", async () => {
    const html = await request("/").text();
    for (const extension of ["svg", "ico"]) {
      const path = `/favicon.${extension}?v=satin-dot-3`;
      expect(html).toContain(`href="${path}"`);
      expect(request(path).status).toBe(200);
    }
    const ico = new DataView(await request("/favicon.ico").arrayBuffer());
    expect(ico.getUint16(0, true)).toBe(0);
    expect(ico.getUint16(2, true)).toBe(1);
    expect(ico.getUint16(4, true)).toBe(4);
    expect(Array.from({ length: 4 }, (_, i) => [ico.getUint8(6 + i * 16), ico.getUint8(7 + i * 16)])).toEqual([
      [64, 64], [48, 48], [32, 32], [16, 16],
    ]);
  });

  test("keeps the four-paragraph introduction before the roadmap", async () => {
    const html = await request("/").text();
    expect(html).toContain('id="roadmap"');
    expect(html).toContain('id="mission"');
    const introduction = html.split('id="mission" aria-label="Mission">')[1].split("</section>")[0];
    expect(introduction.match(/<p>/g)).toHaveLength(4);
    expect(html.indexOf('id="mission"')).toBeLessThan(html.indexOf('id="roadmap"'));
    for (const removed of ['id="detection"', 'id="suppression"', "results-panel", "research-note", "report-link", "site-footer"]) {
      expect(html).not.toContain(removed);
    }
  });

  test("shows only the requested roadmap headings and bullet lists", async () => {
    const html = await request("/roadmap").text();
    const roadmap = html.split('id="roadmap" aria-label="Roadmap">')[1].split("</section>")[0];
    const blocks = [...roadmap.matchAll(/<(h2|li)>([^<]*)<\/\1>/g)].map(([, tag, text]) => [tag, text]);
    expect(blocks).toEqual([
      ["h2", "Spiking Beyond Memorization"],
      ["li", "Expand localization techniques to deception, eval awareness, and more."],
      ["li", "Release model organisms for these new domains"],
      ["h2", "Detection and Suppression During Post-Training"],
      ["li", "Improve the efficiency of our latent mechanism detection and suppression techniques so they are practical to use during inference / RL."],
      ["li", "Detect deceptiveness during rollouts , down-weighting trajectories that promote the deceptiveness mechanism."],
      ["li", "Suppress the mechanism behind eval awareness and investigate how that affects model behavior on different benchmarks"],
      ["h2", "Governance and Basic Science"],
      ["li", "Reverse engineer latent mechanisms to further advance understanding of model behavior"],
      ["li", "Design and maintain a standard spiking set that provides suppression controls for frontier developers"],
    ]);
    expect(roadmap.match(/<ul>/g)).toHaveLength(3);
    expect(roadmap.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
      .toBe(blocks.map(([, text]) => text).join(" "));
  });

  test("groups navigation and content in a responsive layout after the mosaic header", async () => {
    const html = await request("/").text();
    expect(html).toMatch(/<\/header>\s*<div class="page-layout">\s*<nav class="section-nav" aria-label="Main navigation">/);
    const navigation = html.split('<nav class="section-nav"')[1].split("</nav>")[0];
    for (const [id, label] of [["mission", "Mission"], ["roadmap", "Roadmap"], ["research", "Research"], ["people", "People"]]) {
      expect(navigation).toMatch(new RegExp(`<a href="/${id}"[^>]*>${label}</a>`));
      expect(html).toContain(`id="${id}"`);
    }
    expect(html.indexOf("</nav>")).toBeLessThan(html.indexOf('<main id="main"'));
  });

  test("uses a wide-screen sidebar and an animated selected-page underline", async () => {
    const css = await request("/styles.css").text();
    expect(css).toMatch(/@media \(min-width: 900px\)\s*\{\s*\.page-layout\s*\{[^}]*grid-template-columns: 140px minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.section-nav\s*\{[^}]*position: sticky;[^}]*flex-direction: column;/);
    expect(css).toMatch(/\.section-nav a::after\s*\{[^}]*transform: scaleX\(0\);[^}]*transition: transform/);
    expect(css).toMatch(/\.section-nav a\[aria-current="page"\]::after\s*\{\s*transform: scaleX\(1\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.section-nav a::after\s*\{ transition: none;/);
  });

  test("reserves scrollbar space so switching pages does not shift the mosaic", async () => {
    const css = await request("/styles.css").text();
    expect(css).toMatch(/html\s*\{[^}]*scrollbar-gutter:\s*stable;/);
  });

  test("shows only Mission initially and loads the page switcher", async () => {
    const html = await request("/").text();
    expect(html).toContain('<script src="/navigation.js" defer></script>');
    expect(html).toContain('<title>Mission — Project Spica</title>');
    expect(html).toContain('<a href="/mission" aria-current="page">Mission</a>');
    expect(html).toMatch(/<section[^>]*id="mission"[^>]*aria-label="Mission">/);
    expect(html).toMatch(/<section[^>]*id="roadmap"[^>]* hidden(?:="")?>/);
    expect(html).toMatch(/<section[^>]*id="research"[^>]* hidden(?:="")?>/);
  });

  test.each([
    ["mission", "Mission"],
    ["roadmap", "Roadmap"],
    ["research", "Research"],
    ["people", "People"],
  ])("renders /%s correctly on direct visits and refreshes", async (page, label) => {
    const response = request(`/${page}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain(`<title>${label} — Project Spica</title>`);
    expect(html).toContain(`<a href="/${page}" aria-current="page">${label}</a>`);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    for (const id of ["mission", "roadmap", "research", "people"]) {
      const section = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`))![0];
      expect(section.includes(" hidden")).toBe(id !== page);
    }
    const head = request(`/${page}`, "HEAD");
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Type")).toContain("text/html");
    expect(await head.text()).toBe("");
  });

  test.each([
    ["/about", "/mission"],
    ["/about?ref=bookmark", "/mission?ref=bookmark"],
    ["/?page=about&ref=bookmark", "/mission?ref=bookmark"],
  ])("redirects %s to Mission", (path, destination) => {
    for (const method of ["GET", "HEAD"]) {
      const response = request(path, method);
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe(`http://localhost${destination}`);
    }
  });

  test.each(["mission", "roadmap", "research", "people"])("redirects old %s bookmarks", page => {
    for (const method of ["GET", "HEAD"]) {
      const response = request(`/?page=${page}&ref=bookmark`, method);
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe(`http://localhost/${page}?ref=bookmark`);
    }
  });

  test("lists the memorization PDF in Research after the roadmap", async () => {
    const html = await request("/").text();
    expect(html.indexOf('id="roadmap"')).toBeLessThan(html.indexOf('id="research"'));
    const research = html.split('id="research"')[1].split("</section>")[0];
    expect(research).not.toContain('<h2 id="research-title">Research</h2>');
    expect(research).toContain('<ul class="research-links">');
    expect(research.match(/<li>/g)).toHaveLength(1);
    expect(research).toContain('<a href="/research/localizing-memorization.pdf">Localizing Memorization</a>');
  });

  test("lists the original People copy and links with both cofounders first", async () => {
    const html = await request("/people").text();
    const people = html.split('id="people" aria-label="People">')[1].split("</section>")[0];
    expect(people).toContain("<p>Project Spica seeks to coordinate researchers across academia, industry, and government. If you want to contribute to our mission, please reach out.</p>");
    const entries = [...people.matchAll(/<li>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>\s*<p>([^<]+)<\/p>\s*<\/li>/g)]
      .map(([, href, name, affiliation]) => ({ href, name, affiliation }));
    expect(entries).toEqual([
      { href: "https://johntzwei.github.io/", name: "Johnny Tian-Zheng Wei", affiliation: "Cofounder" },
      { href: "mailto:gustavolucasdecarvalho@gmail.com", name: "Gustavo Lucas de Carvalho", affiliation: "Cofounder" },
      { href: "https://robinjia.github.io/", name: "Robin Jia", affiliation: "Advisor | University of Southern California" },
    ]);
    expect(people.match(/<li>/g)).toHaveLength(3);
    expect(people).not.toContain("Yanai");
  });

  test("removes the animated screen and controls while retaining the header mosaic", async () => {
    const html = await request("/").text();
    for (const removed of ["/spiking.js", "<canvas", 'id="spiking"', "spiking-steps", "data-step"]) {
      expect(html).not.toContain(removed);
    }
    expect(html).toContain('class="mosaic-hero"');
    expect(request("/spiking.js").status).toBe(404);
  });

  test("defaults to night mode with an accessible mosaic theme toggle", async () => {
    const html = await request("/").text();
    expect(html).toContain('<script src="/theme.js" defer></script>');
    expect(html).toContain('class="theme-toggle" type="button"');
    expect(html).toContain('<html lang="en" data-theme="dark">');
    expect(html).toContain('<meta name="theme-color" content="#050914" />');
    expect(html).toContain('aria-label="Switch to light mode" aria-pressed="true"');
    expect(html).toMatch(/class="mosaic-art mosaic-night"[^>]+alt="[^"]*pale crescent moon[^"]*"[^>]+fetchpriority="high"/);
    expect(html).toContain('src="/images/spica-mosaic-night.webp"');
  });

  test("anchors tiled Virgo to the dot of the title's i", async () => {
    const html = await request("/").text();
    const css = await request("/styles.css").text();
    expect(html).toContain('Project Sp<span class="spica-letter">i<span class="spica-dot"></span></span>ca');
    expect(html).toContain('<script src="/constellation.js" type="module"></script>');
    expect(html).toContain("Virgo constellation formed from tiles");
    expect(css).toContain('top: calc(0.3em - var(--title-drop, 0px));');
    expect(css).toMatch(/\.site-title\s*\{[^}]*top: var\(--title-drop, 0px\);/);
    expect(css).toContain(':root[data-theme="dark"] .virgo-night-tiles { visibility: visible; }');
    for (const removed of ["virgo-constellation", "constellation-lines", "constellation-stars", "spica-star"]) {
      expect(html).not.toContain(removed);
      expect(css).not.toContain(removed);
    }
  });

  test("makes night stars from existing moon-colored sky tiles", async () => {
    const day = await request("/images/spica-mosaic.svg").text();
    const night = await request("/images/spica-mosaic-night.svg").text();
    expect(day).not.toContain("data-sky=");
    expect(night.match(/data-sky="star"/g)!.length).toBeGreaterThan(20);
    // Virgo is selected responsively at the title, not baked at a fixed location.
    expect(night).not.toContain('data-sky="virgo-');
    const dayTiles = new Set([...day.matchAll(/<path fill="#[a-f0-9]+" d="([^"]+)"\/>/g)].map(match => match[1]));
    for (const [, kind, color, geometry] of night.matchAll(/<path data-sky="([^"]+)" fill="#([a-f0-9]+)" d="([^"]+)"\/>/g)) {
      expect(dayTiles.has(geometry)).toBe(true);
      if (kind !== "virgo-line") {
        // The pale moon palette, including the same subtle glaze variations.
        const channels = [0, 2, 4].map(offset => parseInt(color.slice(offset, offset + 2), 16));
        expect(Math.min(...channels)).toBeGreaterThan(175);
        expect(Math.max(...channels)).toBeLessThan(250);
      }
    }
    expect(night).not.toContain("<circle");
  });

  test("loads responsive WebPs rather than the SVG sources", async () => {
    const html = await request("/").text();
    for (const name of ["spica-mosaic", "spica-mosaic-night"]) {
      expect(html).toContain(`src="/images/${name}.webp"`);
      expect(html).toContain(`srcset="/images/${name}.webp 1400w, /images/${name}@2x.webp 2800w"`);
      expect(html).not.toContain(`/images/${name}.svg`);
    }
    // The cover scene is at least 880px wide, even on narrow mobile screens.
    expect(html.match(/sizes="\(max-width: 880px\) 880px, 100vw"/g)).toHaveLength(2);
    expect(html).not.toContain('loading="lazy"');
  });

  test.each([
    "/images/spica-mosaic.webp",
    "/images/spica-mosaic@2x.webp",
    "/images/spica-mosaic-night.webp",
    "/images/spica-mosaic-night@2x.webp",
  ])("serves an actual WebP at %s", async path => {
    const bytes = Buffer.from(await request(path).arrayBuffer());
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
    expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
    const head = request(path, "HEAD");
    expect(head.headers.get("Content-Type")).toContain("image/webp");
    expect(await head.text()).toBe("");
  });

  test("night artwork preserves the tile geometry", async () => {
    const day = await request("/images/spica-mosaic.svg").text();
    const night = await request("/images/spica-mosaic-night.svg").text();
    const paths = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map(match => match[1]);
    expect(paths(night)).toEqual(paths(day));
    expect(night).not.toEqual(day);
    expect(night).toContain("pale crescent moon");
    expect(night).toContain('fill="#0a142b"');
  });

  test("supports HEAD without a response body", async () => {
    const response = request("/", "HEAD");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(await response.text()).toBe("");
  });

  test("ignores query strings when resolving assets", () => {
    expect(request("/styles.css?v=1").status).toBe(200);
  });

  test("does not expose source files or unknown paths", () => {
    for (const path of ["/missing", "/server.ts", "/package.json", "/../server.ts", "/%2e%2e/server.ts"]) {
      expect(request(path).status).toBe(404);
    }
  });

  test("rejects unsupported methods", () => {
    const response = request("/", "POST");
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
  });
});
