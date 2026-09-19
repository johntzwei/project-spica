// Enhance only routes rendered by our static exporter. The header (including
// decoded mosaics, theme controls and constellation) lives for the whole visit.
const main = document.querySelector("#main");
const navigationLinks = [...document.querySelectorAll(".section-nav a")];
const routeFor = url => url.pathname.replace(/\/index\.html$/, "/").replace(/\/$/, "") || "/mission";
const routes = new Set(JSON.parse(main.dataset.routes));
const cache = new Map();
let revision = 0;
let pending;

function remember(doc) {
  const content = doc.querySelector("#main");
  const nodes = [...content.childNodes];
  const description = doc.querySelector('meta[name="description"]').content;
  const sections = [...content.querySelectorAll(":scope > section")];
  if (sections.length) {
    for (const section of sections) {
      const route = `/${section.id}`;
      const link = navigationLinks.find(link => routeFor(new URL(link.href)) === route);
      if (link && routes.has(route)) {
        cache.set(route, { nodes, sections, title: `${link.textContent.trim()} — Project Spica`, description, article: false });
      }
    }
  } else {
    cache.set(content.dataset.page, { nodes, sections, title: doc.title, description, article: true });
  }
}

function setMeta(selector, attribute, name, value) {
  let meta = document.querySelector(selector);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, name);
    document.head.append(meta);
  }
  meta.content = value;
}

function render(route, page) {
  // Cached section pages share these nodes, so switching among them stays instant.
  if (main.firstChild !== page.nodes[0]) main.replaceChildren(...page.nodes);
  main.dataset.page = route;
  for (const section of page.sections) section.hidden = `/${section.id}` !== route;
  for (const link of navigationLinks) {
    const path = routeFor(new URL(link.href));
    if (path === route) link.setAttribute("aria-current", "page");
    else if (page.article && route.startsWith(`${path}/`)) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }

  // Keep a single h1 on article pages. Move, rather than recreate, the title's
  // children: constellation.js retains references to the letter and dot.
  const title = document.querySelector(".site-title");
  const tag = page.article ? "DIV" : "H1";
  if (title.tagName !== tag) {
    const replacement = document.createElement(tag);
    replacement.className = title.className;
    replacement.setAttribute("aria-label", title.getAttribute("aria-label"));
    if (page.article) replacement.setAttribute("role", "img");
    replacement.append(...title.childNodes);
    title.replaceWith(replacement);
  }

  document.title = page.title;
  const canonicalURL = `https://projectspica.org${route}/`;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = canonicalURL;
  for (const [attribute, name, value] of [
    ["name", "description", page.description],
    ["property", "og:title", page.title],
    ["property", "og:description", page.description],
    ["property", "og:url", canonicalURL],
    ["property", "og:type", page.article ? "article" : "website"],
    ["name", "twitter:title", page.title],
    ["name", "twitter:description", page.description],
  ]) setMeta(`meta[${attribute}="${name}"]`, attribute, name, value);
}

function moveToContent(url, scrollTop) {
  main.focus({ preventScroll: true });
  let target;
  try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { /* Invalid fragment. */ }
  if (url.hash && target) target.scrollIntoView({ behavior: "instant" });
  else window.scrollTo({ top: scrollTop, behavior: "instant" });
}

function cancelPending() {
  revision++;
  pending?.abort();
  pending = undefined;
  main.removeAttribute("aria-busy");
}

async function navigate(url, push, scrollTop = 0) {
  cancelPending();
  const request = revision;
  const route = routeFor(url);
  try {
    if (!routes.has(route)) throw new Error("Unknown page");
    if (!cache.has(route)) {
      pending = new AbortController();
      main.setAttribute("aria-busy", "true");
      const response = await fetch(url.href, { signal: pending.signal });
      const destination = new URL(response.url);
      if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html")
        || destination.origin !== url.origin || routeFor(destination) !== route) throw new Error("Page unavailable");
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      if (request !== revision) return;
      // Never transplant an error page or unrelated document into our shell.
      if (doc.querySelector("#main")?.dataset.page !== route
        || !doc.querySelector(".site-header")
        || !doc.querySelector('meta[name="description"]')
        || !doc.querySelector("#main > section, #main > article")) throw new Error("Invalid page");
      remember(doc);
    }
    if (request !== revision) return;
    const page = cache.get(route);
    if (!page) throw new Error("Missing page");
    if (push) window.history.pushState(null, "", url.href);
    render(route, page);
    moveToContent(url, scrollTop);
  } catch {
    // Progressive enhancement: a failed fetch/parser still leaves a real URL.
    if (request === revision) window.location.assign(url.href);
  } finally {
    if (request === revision) {
      pending = undefined;
      main.removeAttribute("aria-busy");
    }
  }
}

remember(document);

document.addEventListener("click", event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest("a[href]");
  if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin || !routes.has(routeFor(url))) return;
  // Leave citation/equation links and other same-page fragments fully native.
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
    cancelPending();
    return;
  }
  event.preventDefault();
  if (url.href === window.location.href) {
    cancelPending();
    return;
  }
  // Retain the existing scroll behavior between section pages. Opening an
  // article (or leaving one) starts at the top, unless the URL has a fragment.
  const sectionsOnly = cache.get(main.dataset.page)?.article === false && cache.get(routeFor(url))?.article === false;
  void navigate(url, true, sectionsOnly ? window.scrollY : 0);
});

window.addEventListener("popstate", () => {
  const url = new URL(window.location.href);
  if (routeFor(url) === main.dataset.page) {
    cancelPending(); // Native same-document fragment history owns its scrolling.
    return;
  }
  void navigate(url, false);
});
