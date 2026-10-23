import type { NextConfig } from "next";

const staticPages = process.env.P26_STATIC_EXPORT === "1";
const basePath = (process.env.P26_BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = staticPages
  ? {
      output: "export",
      distDir: ".next-pages",
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
      output: "standalone",
      images: { unoptimized: true },
    };

export default nextConfig;
