const RAW_BASE = (process.env.NEXT_PUBLIC_P26_BASE_PATH ?? "").replace(/\/$/, "");

/**
 * Resolves static asset URLs (`/brand/...`, `/scenes/...`, `/portraits/...`,
 * `/models`, `/vendor/face-api.min.js`) cleanly on BOTH root hosting ("/")
 * and GitHub Pages subpath hosting (e.g. "/Entegrasyon").
 */
export function withBasePath(assetPath: string): string {
  if (!assetPath) return assetPath;
  if (
    assetPath.startsWith("data:") ||
    assetPath.startsWith("blob:") ||
    assetPath.startsWith("http://") ||
    assetPath.startsWith("https://")
  ) {
    return assetPath;
  }
  const normalized = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  if (!RAW_BASE) return normalized;
  if (normalized === RAW_BASE || normalized.startsWith(`${RAW_BASE}/`)) {
    return normalized;
  }
  return `${RAW_BASE}${normalized}`;
}
