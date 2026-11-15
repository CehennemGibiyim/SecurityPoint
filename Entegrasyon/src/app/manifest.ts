import type { MetadataRoute } from "next";

/**
 * PWA manifesti (`/manifest.webmanifest`).
 *
 * Hem sunuculu (standalone) hem GitHub Pages (statik dışa aktarım) derlemesinde
 * aynı dosya üretilir. Yollar NEXT_PUBLIC_P26_BASE_PATH ile alt dizine uyarlanır;
 * böylece kurulum kapsamı (scope) doğru olur ve mevcut davranış değişmez.
 */
const BASE = (process.env.NEXT_PUBLIC_P26_BASE_PATH ?? "").replace(/\/$/, "");

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE}/`,
    name: "SecurityPoint — ORION FaceGate × Puantaj26",
    short_name: "SecurityPoint",
    description:
      "Biyometrik kapı geçişi, puantaj, nöbet, bordro ve izin yönetimi. Kurum içi kullanım.",
    lang: "tr",
    dir: "ltr",
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#06080f",
    theme_color: "#06080f",
    categories: ["business", "productivity"],
    icons: [
      { src: `${BASE}/brand/pwa-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE}/brand/pwa-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: `${BASE}/brand/pwa-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
