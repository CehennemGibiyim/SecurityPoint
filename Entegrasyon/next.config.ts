import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const staticPages = process.env.P26_STATIC_EXPORT === "1";
const basePath = (process.env.P26_BASE_PATH ?? "").replace(/\/$/, "");

// Sürüm tek kaynaktan gelir: package.json. Paketleyici gerekirse P26_APP_VERSION ile ezer.
const packageVersion = (() => {
  try {
    const parsed = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")) as { version?: string };
    return parsed.version ?? "";
  } catch {
    return "";
  }
})();
const appVersion = process.env.P26_APP_VERSION?.trim() || packageVersion;

const nextConfig: NextConfig = staticPages
  ? {
      output: "export",
      distDir: ".next-pages",
      // Yalnızca tsx: "ts" eklenirse app/api/**/route.ts dosyaları sayfa gibi
      // derlenir ve statik dışa aktarım kırılır. PWA manifesti bu modda
      // scripts/pages-build.mjs tarafından basePath'e göre üretilir.
      pageExtensions: ["tsx"],
      basePath: basePath || undefined,
      trailingSlash: true,
      images: { unoptimized: true },
      env: {
        NEXT_PUBLIC_P26_BROWSER_DB: "1",
        NEXT_PUBLIC_P26_BASE_PATH: basePath,
        NEXT_PUBLIC_P26_VERSION: appVersion,
      },
    }
  : {
      output: "standalone",
      images: { unoptimized: true },
      env: {
        NEXT_PUBLIC_P26_VERSION: appVersion,
      },
    };

export default nextConfig;
