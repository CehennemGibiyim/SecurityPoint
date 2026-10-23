/**
 * API rotalarını tarayıcı içinde çalıştıran yönlendirici (router).
 *
 * Sunucu tarafındaki Next.js route dosyaları (`src/app/api/**\/route.ts`)
 * buraya olduğu gibi bağlanır: her rota `Request` alır, `Response` döner.
 * Bu sayede panelin istemci kodu (`fetch("/api/...")`) sunuculu sürümle
 * birebir aynı sözleşmeyi kullanır — iki sürüm arasında kod kopyası yoktur.
 */

/** Next.js rota dosyası: HTTP metodu adıyla dışa aktarılan işleyiciler (+ `dynamic` vb.). */
type RouteModule = Record<string, unknown>;

/** Rota işleyici imzası (Next.js route handler). */
type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export type ApiRoute = {
  /** Şablon: dinamik segmentler [param] biçiminde yazılır. */
  path: string;
  load: () => Promise<RouteModule>;
};

/** Tüm panel uçları. Yeni bir API rotası eklenirse buraya da bir satır eklenir. */
export const API_ROUTES: ApiRoute[] = [
  { path: "/api/announcements", load: () => import("@/app/api/announcements/route") },
  { path: "/api/backup", load: () => import("@/app/api/backup/route") },
  { path: "/api/backup/[id]", load: () => import("@/app/api/backup/[id]/route") },
  { path: "/api/bootstrap", load: () => import("@/app/api/bootstrap/route") },
  { path: "/api/settings", load: () => import("@/app/api/settings/route") },
  { path: "/api/database", load: () => import("@/app/api/database/route") },
  { path: "/api/personnel/import", load: () => import("@/app/api/personnel/import/route") },
  { path: "/api/departments", load: () => import("@/app/api/departments/route") },
  { path: "/api/download/panel-onizleme", load: () => import("@/app/api/download/panel-onizleme/route") },
  { path: "/api/export/izinler", load: () => import("@/app/api/export/izinler/route") },
  { path: "/api/export/nobet", load: () => import("@/app/api/export/nobet/route") },
  { path: "/api/export/personel", load: () => import("@/app/api/export/personel/route") },
  { path: "/api/export/puantaj", load: () => import("@/app/api/export/puantaj/route") },
  { path: "/api/custom-groups", load: () => import("@/app/api/custom-groups/route") },
  { path: "/api/health", load: () => import("@/app/api/health/route") },
  { path: "/api/leaves", load: () => import("@/app/api/leaves/route") },
  { path: "/api/overrides", load: () => import("@/app/api/overrides/route") },
  { path: "/api/personel-lookup", load: () => import("@/app/api/personel-lookup/route") },
  { path: "/api/personnel", load: () => import("@/app/api/personnel/route") },
  { path: "/api/personnel/avatar/[id]", load: () => import("@/app/api/personnel/avatar/[id]/route") },
  { path: "/api/roster", load: () => import("@/app/api/roster/route") },
  { path: "/api/roster/cell", load: () => import("@/app/api/roster/cell/route") },
  { path: "/api/roster/columns", load: () => import("@/app/api/roster/columns/route") },
  { path: "/api/roster/draft", load: () => import("@/app/api/roster/draft/route") },
  { path: "/api/schedules", load: () => import("@/app/api/schedules/route") },
  { path: "/api/swaps", load: () => import("@/app/api/swaps/route") },
  { path: "/api/templates", load: () => import("@/app/api/templates/route") },
  { path: "/api/templates/apply", load: () => import("@/app/api/templates/apply/route") },
  { path: "/api/templates/process", load: () => import("@/app/api/templates/process/route") },
  { path: "/api/timesheet", load: () => import("@/app/api/timesheet/route") },
];

/**
 * İstenen yolu bir rota şablonuyla eşleştirir.
 * Eşleşme varsa yol parametrelerini, yoksa null döner.
 */
export function matchPath(template: string, pathname: string): Record<string, string> | null {
  const t = template.split("/").filter(Boolean);
  const p = pathname.split("/").filter(Boolean);
  if (t.length !== p.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < t.length; i++) {
    const seg = t[i];
    if (seg.startsWith("[") && seg.endsWith("]")) {
      if (!p[i]) return null;
      params[seg.slice(1, -1)] = decodeURIComponent(p[i]);
      continue;
    }
    if (seg !== decodeURIComponent(p[i])) return null;
  }
  return params;
}

/** URL yolundan "/api/..." kısmını ayıklar (alt dizin yayınlarında da çalışır). */
export function apiPathOf(pathname: string): string | null {
  if (pathname.startsWith("/api/")) return pathname;
  const idx = pathname.lastIndexOf("/api/");
  if (idx >= 0) return pathname.slice(idx);
  return null;
}

/**
 * İsteği ilgili rota dosyasına yönlendirir.
 * Eşleşen rota yoksa `null` döner (çağıran taraf 404 üretir).
 */
export async function dispatchApi(req: Request): Promise<Response | null> {
  const path = apiPathOf(new URL(req.url).pathname);
  if (!path) return null;
  const method = req.method.toUpperCase();
  for (const route of API_ROUTES) {
    const params = matchPath(route.path, path);
    if (!params) continue;
    const mod = await route.load();
    const handler = mod[method];
    if (typeof handler !== "function") continue;
    return (handler as RouteHandler)(req, { params: Promise.resolve(params) });
  }
  return null;
}
