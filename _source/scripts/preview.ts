import { join } from "node:path";
import { filesIn, output } from "./build";

// Serve only exported files, with the directory redirects used by GitHub Pages.
export async function staticHandler(directory: string) {
  const files = new Set(await filesIn(directory));
  return (request: Request): Response => {
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const url = new URL(request.url);
    let path = url.pathname.slice(1);
    if (path && !path.endsWith("/") && files.has(`${path}/index.html`)) {
      url.pathname += "/";
      return Response.redirect(url.href, 301);
    }
    if (!path || path.endsWith("/")) path += "index.html";
    const status = files.has(path) ? 200 : 404;
    const file = Bun.file(join(directory, status === 404 ? "404.html" : path));
    return new Response(request.method === "HEAD" ? null : file, {
      status,
      headers: { "Content-Type": file.type, "Cache-Control": "no-cache" },
    });
  };
}

if (import.meta.main) {
  if (!await Bun.file(join(output, "index.html")).exists()) throw new Error("Run bun run build first.");
  const server = Bun.serve({ port: Number(Bun.env.PORT ?? 3000), fetch: await staticHandler(output) });
  console.log(`Static preview: ${server.url}`);
}
