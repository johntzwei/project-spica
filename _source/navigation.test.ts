import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

const source = await Bun.file(new URL("./public/navigation.js", import.meta.url)).text();
const ids = ["mission", "roadmap", "research", "people"];
const article = "/research/localizing-memorization";
const routes = [...ids.map(id => `/${id}`), article];
const origin = "https://projectspica.org";
const routeFor = (path: string) => new URL(path, origin).pathname.replace(/\/index\.html$/, "/").replace(/\/$/, "") || "/mission";
const label = (id: string) => id[0].toUpperCase() + id.slice(1);

// Minimal DOM contract for the actual script. Real DOM, rendering and network
// behavior are also exercised by scripts/check-navigation.mjs in Chromium.
function element(tagName: string, attributes: Record<string, string> = {}) {
  const attrs = new Map(Object.entries(attributes));
  return {
    tagName: tagName.toUpperCase(), className: "", content: "", rel: "", id: "", href: "", target: "", textContent: "", hidden: false,
    childNodes: [] as any[], dataset: {} as Record<string, string>,
    get firstChild() { return this.childNodes[0]; },
    getAttribute(name: string) { return attrs.get(name) ?? null; },
    setAttribute(name: string, value: string) { attrs.set(name, value); },
    removeAttribute(name: string) { attrs.delete(name); },
    hasAttribute(name: string) { return attrs.has(name); },
    append(...nodes: any[]) { this.childNodes.push(...nodes); },
    replaceChildren(...nodes: any[]) { this.childNodes = nodes; },
    closest() { return this; },
    replaceWith(_node: any) {}, focus(_options?: any) {}, scrollIntoView(_options?: any) {},
    querySelectorAll(_selector: string): any[] { return []; },
  };
}
function makeDocument(path: string) {
  const route = routeFor(path);
  const isArticle = route === article;
  const sections = isArticle ? [] : ids.map(id => Object.assign(element("section"), { id, hidden: `/${id}` !== route }));
  const main = element("main");
  main.dataset = { page: route, routes: JSON.stringify(routes) };
  main.childNodes = isArticle ? [element("article")] : sections;
  main.querySelectorAll = () => sections;
  const links = ids.map(id => {
    const link = element("a");
    link.href = `${origin}/${id}/`;
    link.textContent = label(id);
    if (`/${id}` === route) link.setAttribute("aria-current", "page");
    else if (isArticle && id === "research") link.setAttribute("aria-current", "location");
    return link;
  });
  const title = `${isArticle ? "Localizing memorization" : label(route.slice(1))} — Project Spica`;
  let heading = element(isArticle ? "div" : "h1", { "aria-label": "Project Spica" });
  heading.className = "site-title";
  heading.childNodes = [element("span")];
  const bindHeading = () => { heading.replaceWith = node => { heading = node; bindHeading(); }; };
  bindHeading();
  const metadata = new Map<string, any>();
  metadata.set('meta[name="description"]', Object.assign(element("meta"), { content: isArticle ? "Article description" : "Site description" }));
  const head = element("head");
  head.append = node => {
    const key = node.tagName === "LINK" ? `link[rel="${node.rel}"]`
      : node.hasAttribute("name") ? `meta[name="${node.getAttribute("name")}"]` : `meta[property="${node.getAttribute("property")}"]`;
    metadata.set(key, node);
  };
  const anchors = new Map<string, any>();
  const doc = {
    title, head, main, links, sections, metadata, anchors,
    querySelectorAll: (_selector: string) => links,
    querySelector(selector: string): any {
      if (selector === "#main") return main;
      if (selector === ".site-title") return heading;
      if (selector === ".site-header") return element("header");
      if (selector === "#main > section, #main > article") return main.firstChild;
      return metadata.get(selector) ?? null;
    },
    createElement: (tag: string) => element(tag),
    getElementById: (id: string) => anchors.get(id) ?? null,
    addEventListener(_name: string, _handler: any) {},
  };
  return doc;
}
function browser(path: string) {
  const document = makeDocument(path);
  let focusCount = 0;
  let scrollCount = 0;
  document.main.focus = () => { focusCount++; };
  const history = [new URL(path, origin).href];
  let cursor = 0;
  let popstate = () => {};
  let click = (_event: any) => {};
  const assigned: string[] = [];
  const location = (path: string) => Object.assign(new URL(path, origin), { assign: (href: string) => assigned.push(href) });
  const window = {
    location: location(path), scrollY: 0,
    history: { pushState(_state: any, _title: string, href: string) {
      window.location = location(href);
      history.splice(++cursor, history.length, href);
    } },
    scrollTo({ top }: { top: number }) { scrollCount++; window.scrollY = top; },
    addEventListener(_name: string, handler: () => void) { popstate = handler; },
  };
  document.addEventListener = (_name, handler) => { click = handler; };
  const requests: { url: string, signal: AbortSignal }[] = [];
  const docs = new Map<string, ReturnType<typeof makeDocument>>();
  const response = (path: string, status = 200, doc = makeDocument(path)) => {
    docs.set(path, doc);
    return { ok: status === 200, url: new URL(path, origin).href, headers: new Headers({ "Content-Type": "text/html" }), text: async () => path };
  };
  let fetcher = async (url: string, _options: any): Promise<any> => response(url);
  runInNewContext(source, {
    window, document, URL, AbortController,
    fetch: (url: string, options: any) => { requests.push({ url, signal: options.signal }); return fetcher(url, options); },
    DOMParser: class { parseFromString(text: string) { return docs.get(text); } },
  });
  return {
    document, window, history, assigned, requests, response,
    set fetcher(value: typeof fetcher) { fetcher = value; },
    get focusCount() { return focusCount; }, get scrollCount() { return scrollCount; },
    click(path: string | number, modifiers = {}, attributes = {}) {
      const link = typeof path === "number" ? document.links[path] : Object.assign(element("a", attributes), { href: new URL(path, window.location).href });
      let prevented = false;
      click({ button: 0, target: link, preventDefault() { prevented = true; }, ...modifiers });
      return prevented;
    },
    go(delta: number) { cursor += delta; window.location = location(history[cursor]); popstate(); },
  };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function expectPage(page: ReturnType<typeof browser>, route: string) {
  expect(page.document.main.dataset.page).toBe(route);
  if (route !== article) expect(page.document.main.childNodes.filter(node => !node.hidden).map(node => node.id)).toEqual([route.slice(1)]);
  expect(page.assigned).toEqual([]);
}

describe("persistent-shell navigation", () => {
  test.each(["/", "/mission", "/mission/", "/people/index.html", `${article}/`])("initializes %s without moving focus or scrolling", path => {
    const page = browser(path);
    expectPage(page, routeFor(path));
    expect(page.focusCount).toBe(0);
    expect(page.scrollCount).toBe(0);
    expect(page.requests).toHaveLength(0);
  });

  test.each([
    ["mission", "roadmap", 1], ["mission", "research", 2], ["mission", "people", 3],
    ["roadmap", "mission", 0], ["roadmap", "research", 2], ["research", "mission", 0],
    ["research", "roadmap", 1], ["research", "people", 3], ["people", "mission", 0],
    ["people", "roadmap", 1], ["people", "research", 2],
  ] as const)("keeps %s → %s instant and preserves scrolling", (from, to, index) => {
    const page = browser(`/${from}/`);
    const nodes = page.document.main.childNodes;
    page.window.scrollY = 240;
    expect(page.click(index)).toBe(true);
    expectPage(page, `/${to}`);
    expect(page.document.main.childNodes).toBe(nodes);
    expect(page.window.scrollY).toBe(240);
    expect(page.focusCount).toBe(1);
    expect(page.requests).toHaveLength(0);
    expect(page.document.title).toBe(`${label(to)} — Project Spica`);
  });

  test("fetches articles once, keeps title children, updates metadata and returns to cached sections", async () => {
    const page = browser("/research/");
    const letter = page.document.querySelector(".site-title").firstChild;
    page.window.scrollY = 240;
    page.click(`${article}/`);
    expect(page.document.main.getAttribute("aria-busy")).toBe("true");
    expectPage(page, "/research"); // Old content remains until the response is ready.
    await settle();
    expectPage(page, article);
    expect(page.window.scrollY).toBe(0);
    expect(page.document.querySelector(".site-title").tagName).toBe("DIV");
    expect(page.document.querySelector(".site-title").firstChild).toBe(letter);
    expect(page.document.links[2].getAttribute("aria-current")).toBe("location");
    expect(page.document.querySelector('meta[property="og:type"]').content).toBe("article");
    expect(page.document.querySelector('meta[name="description"]').content).toBe("Article description");
    expect(page.document.querySelector('link[rel="canonical"]').href).toBe(`${origin}${article}/`);
    expect(page.document.main.hasAttribute("aria-busy")).toBe(false);
    page.click(2);
    expectPage(page, "/research");
    expect(page.document.querySelector(".site-title").tagName).toBe("H1");
    expect(page.document.querySelector(".site-title").firstChild).toBe(letter);
    expect(page.document.querySelector('meta[property="og:type"]').content).toBe("website");
    expect(page.document.querySelector('meta[name="twitter:description"]').content).toBe("Site description");
    page.click(`${article}/`);
    expectPage(page, article);
    expect(page.requests).toHaveLength(1);
  });

  test("direct article visits can fetch sections and then switch them without fetching", async () => {
    const page = browser(`${article}/`);
    page.click(2);
    await settle();
    expectPage(page, "/research");
    page.click(0);
    expectPage(page, "/mission");
    page.go(-1);
    expectPage(page, "/research");
    page.go(-1);
    expectPage(page, article);
    page.go(1);
    expectPage(page, "/research");
    expect(page.requests).toHaveLength(1);
  });

  test("Back/Forward resets section scrolling and does not add history entries", () => {
    const page = browser("/mission/");
    page.window.scrollY = 240;
    page.click(1);
    page.go(-1);
    expectPage(page, "/mission");
    expect(page.window.scrollY).toBe(0);
    page.go(1);
    expectPage(page, "/roadmap");
    page.click(1);
    expect(page.history).toHaveLength(2);
  });

  test("preserves native anchors, modified clicks, downloads, external links and PDFs", () => {
    const page = browser(`${article}/`);
    for (const modifiers of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
      expect(page.click(2, modifiers)).toBe(false);
    }
    for (const path of ["#reference-1", "/research/localizing-memorization.pdf", "https://example.org/research/", "/missing/"]) expect(page.click(path)).toBe(false);
    expect(page.click("/research/", {}, { download: "" })).toBe(false);
    page.document.links[2].target = "_blank";
    expect(page.click(2)).toBe(false);
    expect(page.history).toHaveLength(1);
    expect(page.requests).toHaveLength(0);
  });

  test("cross-page fragments scroll to the target and preserve query strings", async () => {
    const page = browser("/research/");
    let scrolls = 0;
    page.document.anchors.set("reference-1", { scrollIntoView() { scrolls++; } });
    page.click(`${article}/?ref=test#reference-1`);
    await settle();
    expectPage(page, article);
    expect(page.window.location.search).toBe("?ref=test");
    expect(page.window.location.hash).toBe("#reference-1");
    expect(scrolls).toBe(1);
  });

  test("removing a fragment or changing its query keeps the article shell", () => {
    const page = browser(`${article}/#reference-12`);
    page.window.scrollY = 900;
    expect(page.click(`${article}/`)).toBe(true);
    expect(page.window.location.hash).toBe("");
    expect(page.window.scrollY).toBe(0);
    expect(page.click(`${article}/?ref=test#reference-12`)).toBe(true);
    expect(page.window.location.search).toBe("?ref=test");
    expectPage(page, article);
    expect(page.requests).toHaveLength(0);
  });

  test.each(["network", "status", "markup", "type", "redirect"])("falls back to full navigation on %s failure without pushing history", async failure => {
    const page = browser("/research/");
    page.fetcher = async url => {
      if (failure === "network") throw new Error("Offline");
      if (failure === "status") return page.response(url, 404);
      if (failure === "markup") return page.response(url, 200, makeDocument("/mission/"));
      const response = page.response(url);
      if (failure === "type") response.headers.set("Content-Type", "application/pdf");
      if (failure === "redirect") response.url = url.replace(origin, "https://example.org");
      return response;
    };
    page.click(`${article}/`);
    await settle();
    expect(page.assigned).toEqual([`${origin}${article}/`]);
    expect(page.history).toHaveLength(1);
    expect(page.document.main.dataset.page).toBe("/research");
    expect(page.document.main.hasAttribute("aria-busy")).toBe(false);
  });

  test.each(["success", "failure"])("ignores a late %s after a newer navigation", async outcome => {
    const page = browser("/research/");
    let finish!: (value?: any) => void;
    page.fetcher = () => new Promise((resolve, reject) => { finish = outcome === "success" ? resolve : reject; });
    page.click(`${article}/`);
    page.click(3);
    expect(page.requests[0].signal.aborted).toBe(true);
    finish(outcome === "success" ? page.response(`${article}/`) : new Error("Late failure"));
    await settle();
    expectPage(page, "/people");
    expect(page.window.location.pathname).toBe("/people/");
    expect(page.history).toHaveLength(2);
  });

  test("Back cancels an in-flight article request", async () => {
    const page = browser("/mission/");
    page.click(2);
    let finish!: (value: any) => void;
    page.fetcher = () => new Promise(resolve => { finish = resolve; });
    page.click(`${article}/`);
    page.go(-1);
    finish(page.response(`${article}/`));
    await settle();
    expectPage(page, "/mission");
    expect(page.requests[0].signal.aborted).toBe(true);
  });
});
