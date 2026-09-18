import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { articles, assets, handleRequest, pages } from "../server";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const output = join(root, "_build");
const origin = "https://projectspica.org";
const description = "Project Spica develops spiking as a standard AI safety practice: localizing, detecting, and suppressing latent mechanisms in model weights.";
const policy = "default-src 'self'; media-src 'self' https://resources.download.minecraft.net; base-uri 'none'; object-src 'none'";

function metadata(title: string, path: string, pageDescription = description, type = "website") {
  return `<meta http-equiv="Content-Security-Policy" content="${policy}" />
    <link rel="canonical" href="${origin}${path}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:site_name" content="Project Spica" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${pageDescription}" />
    <meta property="og:url" content="${origin}${path}" />
    <meta property="og:image" content="${origin}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Project Spica beneath a ceramic mosaic night sky" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${pageDescription}" />
    <meta name="twitter:image" content="${origin}/og.png" />`;
}

export async function buildSite(directory = output) {
  // Only clear the dedicated staging directory, never the repository root.
  if (directory === root) throw new Error("Build into a staging directory, not the repository root.");
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });

  const routes = new Map([...pages, ...[...articles].map(([path, article]) => [path, article.title] as const)]);
  for (const [route, asset] of assets) {
    if (route === "/" || routes.has(route)) continue;
    await Bun.write(join(directory, route.slice(1)), Bun.file(asset.name!));
  }

  for (const route of ["/", ...routes.keys()]) {
    const page = route === "/" ? "/mission" : route;
    const article = articles.get(page);
    const canonical = `${page}/`;
    const response = new HTMLRewriter()
      .on("meta[charset]", {
        element(element) {
          // Keep charset first, then CSP before the resources it protects.
          element.after(metadata(`${routes.get(page)} — Project Spica`, canonical, article?.description, article ? "article" : "website"), { html: true });
        },
      })
      .on("a[href]", {
        element(element) {
          const href = element.getAttribute("href")!;
          if (routes.has(href)) element.setAttribute("href", `${href}/`);
        },
      })
      .transform(handleRequest(new Request(`${origin}${route}`)));
    const path = route === "/" ? "index.html" : `${route.slice(1)}/index.html`;
    await Bun.write(join(directory, path), await response.text());
  }

  // Pages serves /about -> /about/. Unlike the former Bun route, this is an
  // HTML redirect (not an HTTP 301); the script preserves query parameters.
  await Bun.write(join(directory, "about/index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mission — Project Spica</title>
<link rel="canonical" href="${origin}/mission/" />
<meta http-equiv="refresh" content="0; url=/mission/" />
<script src="/legacy.js"></script></head>
<body><p>This page has moved to <a href="/mission/">Mission</a>.</p></body></html>\n`);

  await Bun.write(join(directory, "404.html"), `<!doctype html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Page not found — Project Spica</title>
<link rel="icon" href="/favicon.ico" /><link rel="stylesheet" href="/styles.css" />
</head><body><main class="prose"><h1>Page not found</h1>
<p>The page you requested does not exist.</p><p><a href="/mission/">Return to Project Spica</a>.</p>
</main></body></html>\n`);
  await Bun.write(join(directory, "CNAME"), `${new URL(origin).hostname}\n`);
  await Bun.write(join(directory, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  await Bun.write(join(directory, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...routes.keys()].map(path => `  <url><loc>${origin}${path}/</loc></url>`).join("\n")}
</urlset>\n`);
}

export async function filesIn(directory: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(directory, path));
    else files.push(path);
  }
  return files.sort();
}

export async function checkPublished() {
  for (const path of await filesIn(output)) {
    const published = Bun.file(join(root, path));
    if (!await published.exists() || !Buffer.from(await published.arrayBuffer()).equals(Buffer.from(await Bun.file(join(output, path)).arrayBuffer()))) {
      throw new Error(`Published ${path} is stale. Run bun run publish:prepare and commit the output.`);
    }
  }
}

if (import.meta.main) {
  await buildSite();
  if (Bun.argv.includes("--publish")) {
    for (const path of await filesIn(output)) {
      await mkdir(join(root, path, ".."), { recursive: true });
      await cp(join(output, path), join(root, path));
    }
    console.log("Prepared generated pages/assets in the repository root for GitHub Pages.");
  }
  if (Bun.argv.includes("--check")) await checkPublished();
  console.log(`Static site built in ${output}`);
}
