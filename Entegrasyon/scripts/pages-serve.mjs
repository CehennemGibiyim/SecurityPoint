#!/usr/bin/env node
/**
 * Derlenmiş GitHub Pages sitesini (`_site/`) yerelde sunar.
 *
 *   npm run pages:build && npm run pages:serve
 *   → http://127.0.0.1:4173/<alt-dizin>/
 *
 * Alt dizin (basePath), derleme sırasında yazılan `_site/p26-build.json`
 * dosyasından okunur; böylece GitHub Pages'teki adres yapısı birebir taklit
 * edilir (WASM dosyaları ve Next.js varlıkları dahil).
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(root, "_site");
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "0.0.0.0";

if (!existsSync(path.join(siteDir, "index.html"))) {
  console.error("Önce derleyin:  npm run pages:build");
  process.exit(1);
}

const buildInfo = existsSync(path.join(siteDir, "p26-build.json"))
  ? JSON.parse(await readFile(path.join(siteDir, "p26-build.json"), "utf8"))
  : { basePath: "" };
const basePath = buildInfo.basePath ?? "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

async function sendFile(res, filePath) {
  const data = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": data.length,
    // GitHub Pages'e benzer önbellek davranışı: derleme sırasında test için kapalı
    "Cache-Control": "no-cache",
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent((req.url ?? "/").split("?")[0]);

    // Alt dizin öneki (GitHub Pages yapısı)
    if (basePath && pathname === "/") {
      res.writeHead(302, { Location: `${basePath}/` });
      res.end();
      return;
    }
    if (basePath) {
      if (!pathname.startsWith(`${basePath}/`) && pathname !== basePath) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Yalnızca ${basePath}/ altında yayın var.`);
        return;
      }
      pathname = pathname.slice(basePath.length) || "/";
    }

    // Dizin istekleri → index.html (GitHub Pages davranışı)
    if (pathname.endsWith("/")) pathname += "index.html";
    const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(siteDir, safe);

    if (!existsSync(filePath)) {
      // Uzantısız yol → .html denemesi, sonra 404 sayfası
      const alt = `${filePath}.html`;
      if (existsSync(alt)) filePath = alt;
      else if (!path.extname(filePath)) {
        const idx = path.join(filePath, "index.html");
        if (existsSync(idx)) filePath = idx;
        else filePath = path.join(siteDir, "404.html");
      } else {
        filePath = path.join(siteDir, "404.html");
      }
    }

    const info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    await sendFile(res, filePath);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(String(err));
  }
});

server.listen(port, host, () => {
  console.log(`Personel26 (statik sürüm) → http://127.0.0.1:${port}${basePath}/`);
});
