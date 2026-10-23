import type { NextConfig } from "next";

/**
 * İki derleme modu vardır:
 *
 * 1. Varsayılan (sunuculu) — `npm run build`
 *    `output: "standalone"`: Windows taşınabilir paketi için node_modules
 *    olmadan çalışan bağımsız sunucu çıktısı üretir. Vercel/Neon kurulumu da
 *    bu modu kullanır (PostgreSQL sunucu tarafındadır).
 *
 * 2. GitHub Pages (statik) — `npm run pages:build`
 *    `output: "export"`: sunucusuz statik site üretir. Bu modda API rotaları
 *    (`route.ts`) devre dışı bırakılır (pageExtensions) ve panel, veritabanını
 *    tarayıcıda çalıştırır (PGlite + IndexedDB) — bkz. src/lib/browser-db/.
 */
const staticPages = process.env.P26_STATIC_EXPORT === "1";
const basePath = (process.env.P26_BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = staticPages
  ? {
      output: "export",
      distDir: ".next-pages",
      // Sunucu taraflı API rotaları statik dışa aktarımda kullanılamaz; panel
      // bu uçları tarayıcı içindeki köprüden çalıştırır.
      pageExtensions: ["tsx"],
      basePath: basePath || undefined,
      trailingSlash: true,
      images: { unoptimized: true },
      env: {
        NEXT_PUBLIC_P26_BROWSER_DB: "1",
        NEXT_PUBLIC_P26_BASE_PATH: basePath,
      },
    }
  : {
      // Windows taşınabilir paket için: node_modules olmadan çalışan
      // bağımsız sunucu çıktısı (.next/standalone) üretir.
      output: "standalone",
    };

export default nextConfig;
