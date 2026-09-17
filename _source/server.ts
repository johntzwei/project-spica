export const pages = new Map([
  ["/mission", "Mission"],
  ["/roadmap", "Roadmap"],
  ["/research", "Research"],
  ["/people", "People"],
]);
const index = Bun.file(new URL("./public/index.html", import.meta.url));
export const assets = new Map([
  ["/", index],
  ...[...pages.keys()].map(path => [path, index] as const),
  ["/styles.css", Bun.file(new URL("./public/styles.css", import.meta.url))],
  ["/theme.js", Bun.file(new URL("./public/theme.js", import.meta.url))],
  ["/constellation.js", Bun.file(new URL("./public/constellation.js", import.meta.url))],
  ["/images/sky-tiles.json", Bun.file(new URL("./public/images/sky-tiles.json", import.meta.url))],
  ["/navigation.js", Bun.file(new URL("./public/navigation.js", import.meta.url))],
  ["/legacy.js", Bun.file(new URL("./public/legacy.js", import.meta.url))],
  ["/research/localizing-memorization.pdf", Bun.file(new URL("./public/research/localizing-memorization.pdf", import.meta.url))],
  ["/images/spica-mosaic-night.svg", Bun.file(new URL("./public/images/spica-mosaic-night.svg", import.meta.url))],
  ["/images/spica-mosaic.svg", Bun.file(new URL("./public/images/spica-mosaic.svg", import.meta.url))],
  ["/images/spica-mosaic.webp", Bun.file(new URL("./public/images/spica-mosaic.webp", import.meta.url))],
  ["/images/spica-mosaic@2x.webp", Bun.file(new URL("./public/images/spica-mosaic@2x.webp", import.meta.url))],
  ["/images/spica-mosaic-night.webp", Bun.file(new URL("./public/images/spica-mosaic-night.webp", import.meta.url))],
  ["/images/spica-mosaic-night@2x.webp", Bun.file(new URL("./public/images/spica-mosaic-night@2x.webp", import.meta.url))],
  ["/favicon.svg", Bun.file(new URL("./public/favicon.svg", import.meta.url))],
  ["/favicon.ico", Bun.file(new URL("./public/favicon.ico", import.meta.url))],
  ["/og.png", Bun.file(new URL("./public/og.png", import.meta.url))],
]);

export function handleRequest(request: Request): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const url = new URL(request.url);
  // Keep old bookmarks working while moving them to the clean page URLs.
  if (url.pathname === "/about") {
    url.pathname = "/mission";
    return Response.redirect(url.href, 301);
  }
  const requestedLegacyPage = url.searchParams.get("page");
  const legacyPage = requestedLegacyPage === "about" ? "mission" : requestedLegacyPage;
  if (url.pathname === "/" && legacyPage && pages.has(`/${legacyPage}`)) {
    url.pathname = `/${legacyPage}`;
    url.searchParams.delete("page");
    return Response.redirect(url.href, 301);
  }

  const asset = assets.get(url.pathname);
  if (!asset) {
    return new Response(request.method === "HEAD" ? null : "Not found", { status: 404 });
  }

  // BunFile caches its size after reading. Reopen it so edits cannot truncate responses.
  const file = Bun.file(asset.name!);
  const response = new Response(request.method === "HEAD" ? null : file, {
    headers: {
      "Content-Type": asset.type,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });

  if (request.method === "HEAD" || asset !== index) return response;

  // Render the requested page immediately, including without JavaScript.
  const pagePath = url.pathname === "/" ? "/mission" : url.pathname;
  return new HTMLRewriter()
    .on("title", {
      element(element) {
        element.setInnerContent(`${pages.get(pagePath)} — Project Spica`);
      },
    })
    .on(".section-nav a", {
      element(element) {
        if (element.getAttribute("href") === pagePath) element.setAttribute("aria-current", "page");
        else element.removeAttribute("aria-current");
      },
    })
    .on("#main > section", {
      element(element) {
        if (`/${element.getAttribute("id")}` === pagePath) element.removeAttribute("hidden");
        else element.setAttribute("hidden", "");
      },
    })
    .transform(response);
}

if (import.meta.main) {
  const port = Number(Bun.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535.");
  }
  const server = Bun.serve({ port, fetch: handleRequest });
  console.log(`Project Spica is running at ${server.url}`);
}
