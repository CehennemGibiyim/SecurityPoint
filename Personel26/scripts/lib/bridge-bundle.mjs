/**
 * Tarayıcı veritabanı köprüsünün esbuild paketleyicisi.
 *
 * Aynı kaynak kodu iki hedef için derlenebilir:
 *   • platform "browser" → GitHub Pages'te çalışan `pglite/app.js`
 *   • platform "node"    → duman testlerinde (scripts/pages-smoke-test.mjs)
 *
 * Tek fark: Node.js çekirdek modülleri tarayıcıda boş stub'a düşer.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

/** `@/...` takma adını src/ altında gerçek dosyaya çevirir. */
function resolveSource(root, spec) {
  const base = path.join(root, "src", spec.slice(2));
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    `${base}.js`,
    base,
  ];
  const hit = candidates.find((c) => existsSync(c));
  if (!hit) throw new Error(`Modül bulunamadı: ${spec}`);
  return hit;
}

export function createBridgePlugin({ root, ddl, stubNodeModules }) {
  return {
    name: "p26-browser-bridge",
    setup(esbuild) {
      // `@/db` → tarayıcı içi PGlite istemcisi (node-postgres yerine)
      esbuild.onResolve({ filter: /^@\/db$/ }, () => ({
        path: path.join(root, "src", "lib", "browser-db", "pglite-client.ts"),
      }));
      esbuild.onResolve({ filter: /^@\// }, (args) => ({ path: resolveSource(root, args.path) }));
      // SheetJS: Node'a özel `require` çağrıları ESM paketinde çalışmadığı için
      // tarayıcı/Node ortak tek dosya derlemesi kullanılır (xlsx.full.min.js).
      esbuild.onResolve({ filter: /^xlsx$/ }, () => ({
        path: path.join(root, "node_modules", "xlsx", "dist", "xlsx.full.min.js"),
      }));
      // Sanal modül: drizzle-kit'in ürettiği şema DDL'i
      esbuild.onResolve({ filter: /^p26-schema-sql$/ }, () => ({ path: "schema-ddl", namespace: "p26" }));
      if (stubNodeModules) {
        esbuild.onResolve({ filter: /^node:/ }, () => ({ path: "node-stub", namespace: "p26" }));
      }
      esbuild.onLoad({ filter: /.*/, namespace: "p26" }, (args) => {
        if (args.path === "schema-ddl") {
          return { contents: `export default ${JSON.stringify(ddl)};`, loader: "js" };
        }
        return {
          contents: [
            "const empty = {};",
            "export default empty;",
            "export const readFile = async () => { throw new Error('Bu işlem tarayıcı sürümünde kullanılmaz'); };",
            "export const writeFile = readFile;",
            "export const join = (...parts) => parts.filter(Boolean).join('/');",
            "export const resolve = join;",
            "export const dirname = (p) => String(p).split('/').slice(0, -1).join('/');",
          ].join("\n"),
          loader: "js",
        };
      });
    },
  };
}

export async function bundleBridge({ root, ddl, outfile, platform = "browser", basePath = "" }) {
  await build({
    entryPoints: [path.join(root, "src", "lib", "browser-db", "entry.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform,
    target: platform === "node" ? ["node20"] : ["es2020", "chrome100", "firefox100", "safari16"],
    minify: true,
    legalComments: "none",
    logLevel: "warning",
    tsconfig: path.join(root, "tsconfig.json"),
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.NEXT_PUBLIC_P26_BROWSER_DB": '"1"',
      "process.env.NEXT_PUBLIC_P26_BASE_PATH": JSON.stringify(basePath),
      "process.env.P26_STATIC_EXPORT": '"1"',
      "process.env.P26_BASE_PATH": JSON.stringify(basePath),
      ...(platform === "browser" ? { "process.cwd": '"/"' } : {}),
    },
    plugins: [createBridgePlugin({ root, ddl, stubNodeModules: platform === "browser" })],
  });
}
