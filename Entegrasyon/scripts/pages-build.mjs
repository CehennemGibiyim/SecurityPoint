#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════
 * Personel26 — GitHub Pages (statik + tarayıcı içi veritabanı) derlemesi
 * ════════════════════════════════════════════════════════════════
 *
 * Ne yapar?
 *   1. Drizzle şemasından DDL üretir (drizzle-kit generate).
 *   2. Tarayıcı içi PostgreSQL (PGlite) + API köprüsünü esbuild ile paketler
 *      → `_site/pglite/app.js` (+ pglite.wasm, initdb.wasm, pglite.data).
 *   3. Next.js'i statik dışa aktarım modunda derler (output: "export").
 *   4. Hepsini `_site/` klasöründe birleştirir (GitHub Pages yayını).
 *
 * Kullanım:
 *   npm run pages:build                 → site kökü ("/") için derler
 *   P26_BASE_PATH=/Personel26 npm run pages:build
 *
 * Not: GitHub Actions ortamında alt dizin otomatik bulunur
 * (GITHUB_REPOSITORY → /repo-adı).
 */
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleBridge } from "./lib/bridge-bundle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(root, "_site");
const workDir = path.join(root, ".pages-build");
/** Next.js statik çıktısı: distDir (.next-pages) köküne yazılır. */
const exportDir = path.join(root, ".next-pages");
const pgliteDist = path.join(root, "node_modules", "@electric-sql", "pglite", "dist");
const PGLITE_ASSETS = ["pglite.wasm", "initdb.wasm", "pglite.data"];

const log = (msg) => console.log(`\u001b[36m[pages]\u001b[0m ${msg}`);

// ───────────────────────────────────────────────
// 1) Yayın alt dizini (base path)
// ───────────────────────────────────────────────
function resolveBasePath() {
  if (process.env.P26_BASE_PATH !== undefined) {
    return process.env.P26_BASE_PATH.replace(/\/$/, "");
  }
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
  if (!repo || repo.endsWith(".github.io")) return "";
  return `/${repo}`;
}

const basePath = resolveBasePath();
if (basePath) {
  log(`Yayın alt dizini: ${basePath}  (site: https://<kullanıcı>.github.io${basePath}/)`);
} else {
  log("Yayın alt dizini: /  (kullanıcı/kuruluş sayfası ya da özel alan adı)");
}

// ───────────────────────────────────────────────
// 2) Şema DDL'i (drizzle-kit)
// ───────────────────────────────────────────────
await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });

const ddlDir = path.join(workDir, "ddl");
log("Şema DDL'i üretiliyor (drizzle-kit generate)…");
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "drizzle-kit", "bin.cjs"),
    "generate",
    "--dialect=postgresql",
    `--schema=${path.join(root, "src", "db", "schema.ts")}`,
    `--out=${ddlDir}`,
  ],
  { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
);

const ddlFiles = (await readdir(ddlDir)).filter((f) => f.endsWith(".sql")).sort();
if (!ddlFiles.length) throw new Error("drizzle-kit çıktısı bulunamadı (şema DDL'i üretilemedi).");
const ddl = await readFile(path.join(ddlDir, ddlFiles[ddlFiles.length - 1]), "utf8");
log(`DDL hazır: ${ddlFiles[ddlFiles.length - 1]} (${ddl.length} karakter)`);

// ───────────────────────────────────────────────
// 3) Tarayıcı paketi (esbuild)
// ───────────────────────────────────────────────
log("Tarayıcı veritabanı paketi derleniyor (esbuild)…");
await bundleBridge({
  root,
  ddl,
  outfile: path.join(workDir, "pglite", "app.js"),
  platform: "browser",
  basePath,
});

const bundleJs = await readFile(path.join(workDir, "pglite", "app.js"), "utf8");
log(`Paket hazır: app.js (${(bundleJs.length / 1024).toFixed(0)} KB)`);

// ───────────────────────────────────────────────
// 4) Next.js statik dışa aktarımı
// ───────────────────────────────────────────────
log("Next.js statik derlemesi başlıyor (output: export)…");
await rm(exportDir, { recursive: true, force: true });

execFileSync(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    P26_STATIC_EXPORT: "1",
    P26_BASE_PATH: basePath,
    NEXT_PUBLIC_P26_BROWSER_DB: "1",
    NEXT_PUBLIC_P26_BASE_PATH: basePath,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production",
  },
});

if (!existsSync(path.join(exportDir, "index.html"))) {
  throw new Error(`Statik çıktı üretilemedi: ${path.relative(root, exportDir)}/index.html`);
}

// ───────────────────────────────────────────────
// 5) Yayın klasörünü birleştir (GitHub Pages)
// ───────────────────────────────────────────────
log("Yayın klasörü hazırlanıyor (_site)…");
await rm(siteDir, { recursive: true, force: true });
await cp(exportDir, siteDir, { recursive: true });

await mkdir(path.join(siteDir, "pglite"), { recursive: true });
await cp(path.join(workDir, "pglite", "app.js"), path.join(siteDir, "pglite", "app.js"));
for (const asset of PGLITE_ASSETS) {
  const from = path.join(pgliteDist, asset);
  if (!existsSync(from)) throw new Error(`PGlite varlığı bulunamadı: ${from}`);
  await cp(from, path.join(siteDir, "pglite", asset));
}

// Jekyll'in `_next` klasörünü yok saymaması için (Next.js alt çizgiyle başlar)
await writeFile(path.join(siteDir, ".nojekyll"), "");

// Bilinmeyen yollar için de panel açılsın (404 → index.html)
await cp(path.join(siteDir, "index.html"), path.join(siteDir, "404.html"));

// Derleme bilgisi (test/serve betikleri kullanır)
await writeFile(
  path.join(siteDir, "p26-build.json"),
  JSON.stringify(
    {
      basePath,
      builtAt: new Date().toISOString(),
      bundleBytes: bundleJs.length,
      mode: "browser-pglite",
    },
    null,
    2,
  ),
);

const assetBytes = (await Promise.all(
  PGLITE_ASSETS.map(async (a) => (await readFile(path.join(pgliteDist, a))).length),
)).reduce((a, b) => a + b, 0);

console.log("");
log("✅ Hazır: _site/");
log(`   • Arayüz        : ${path.relative(root, exportDir)}/ → _site/ (Next.js statik)`);
log(`   • Tarayıcı DB   : _site/pglite/app.js + ${(assetBytes / 1024 / 1024).toFixed(1)} MB WASM`);
log(`   • Yerel deneme  : npm run pages:serve  →  http://127.0.0.1:4173${basePath}/`);
log(`   • GitHub Pages  : https://<kullanıcı>.github.io${basePath || "/"}`);
console.log("");
