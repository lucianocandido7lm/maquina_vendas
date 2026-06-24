import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.join(process.cwd(), "find-homepage-local");
const port = Number(process.env.PORT || 4173);
const assetsDir = path.join(rootDir, "assets");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".avif", "image/avif"],
  [".woff2", "font/woff2"],
  [".mp4", "video/mp4"],
]);

function resolvePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = cleanPath === "/" ? "/index.html" : cleanPath;
  const absolutePath = path.normalize(path.join(rootDir, relativePath));
  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }
  return absolutePath;
}

function stripNextHash(fileName) {
  return fileName.replace(/\.[a-f0-9]{6,}(?=\.[^.]+$)/i, "");
}

async function resolveSpecialPath(requestUrl) {
  const request = new URL(requestUrl, `http://127.0.0.1:${port}`);
  const pathname = request.pathname;

  if (pathname.startsWith("/_next/static/css/")) {
    const cssName = path.basename(pathname);
    return path.join(assetsDir, cssName);
  }

  if (pathname.startsWith("/_next/static/chunks/")) {
    const chunkName = path.basename(pathname);
    return path.join(assetsDir, chunkName);
  }

  if (pathname.startsWith("/assets/") && pathname.endsWith(".download")) {
    const assetName = path.basename(pathname, ".download");
    return path.join(assetsDir, assetName);
  }

  if (pathname === "/_next/image") {
    const originalUrl = request.searchParams.get("url");
    if (!originalUrl) return null;

    const normalized = decodeURIComponent(originalUrl);
    const nextMediaName = path.basename(normalized);
    const directNextPath = path.join(rootDir, normalized.replace(/^\/+/, ""));
    try {
      await fs.access(directNextPath);
      return directNextPath;
    } catch {
      // Fall through to asset alias lookup.
    }

    const aliasName = stripNextHash(nextMediaName);
    return path.join(assetsDir, aliasName);
  }

  return null;
}

const server = http.createServer(async (request, response) => {
  const specialPath = await resolveSpecialPath(request.url || "/");
  const absolutePath = specialPath ?? resolvePath(request.url || "/");
  if (!absolutePath) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(absolutePath);
    const contentType =
      mimeTypes.get(path.extname(absolutePath).toLowerCase()) ?? "application/octet-stream";
    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-cache",
    });
    response.end(data);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
});

server.listen(port, () => {
  console.log(`Serving local FIND homepage at http://127.0.0.1:${port}`);
});
