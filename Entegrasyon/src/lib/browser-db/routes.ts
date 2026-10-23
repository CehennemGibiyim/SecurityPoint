type RouteModule = Record<string, unknown>;
type RouteHandler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

export type ApiRoute = {
  path: string;
  load: () => Promise<RouteModule>;
};

export const API_ROUTES: ApiRoute[] = [
  // ── Personel26 / Puantaj26 Resmi Uçları ──
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

  // ── ORION FaceGate Biyometrik PDKS & Kapı Kontrol Uçları ──
  { path: "/api/attendance", load: () => import("@/app/api/attendance/route") },
  { path: "/api/breaks", load: () => import("@/app/api/breaks/route") },
  { path: "/api/cafeteria", load: () => import("@/app/api/cafeteria/route") },
  { path: "/api/dashboard", load: () => import("@/app/api/dashboard/route") },
  { path: "/api/doors", load: () => import("@/app/api/doors/route") },
  { path: "/api/doors/[id]", load: () => import("@/app/api/doors/[id]/route") },
  { path: "/api/employees", load: () => import("@/app/api/employees/route") },
  { path: "/api/employees/[id]", load: () => import("@/app/api/employees/[id]/route") },
  { path: "/api/employees/[id]/enroll", load: () => import("@/app/api/employees/[id]/enroll/route") },
  { path: "/api/face/departments", load: () => import("@/app/api/face/departments/route") },
  { path: "/api/face/leaves", load: () => import("@/app/api/face/leaves/route") },
  { path: "/api/face/leaves/[id]", load: () => import("@/app/api/face/leaves/[id]/route") },
  { path: "/api/holidays", load: () => import("@/app/api/holidays/route") },
  { path: "/api/logs", load: () => import("@/app/api/logs/route") },
  { path: "/api/offline-queue", load: () => import("@/app/api/offline-queue/route") },
  { path: "/api/payroll", load: () => import("@/app/api/payroll/route") },
  { path: "/api/permissions", load: () => import("@/app/api/permissions/route") },
  { path: "/api/permissions/[id]", load: () => import("@/app/api/permissions/[id]/route") },
  { path: "/api/recognize", load: () => import("@/app/api/recognize/route") },
  { path: "/api/reports", load: () => import("@/app/api/reports/route") },
  { path: "/api/security", load: () => import("@/app/api/security/route") },
  { path: "/api/seed", load: () => import("@/app/api/seed/route") },
  { path: "/api/shifts", load: () => import("@/app/api/shifts/route") },
  { path: "/api/sync-personnel", load: () => import("@/app/api/sync-personnel/route") },
  { path: "/api/visitors", load: () => import("@/app/api/visitors/route") },
  { path: "/api/visitors/[id]", load: () => import("@/app/api/visitors/[id]/route") },
];

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

export function apiPathOf(pathname: string): string | null {
  if (pathname.startsWith("/api/")) return pathname;
  const idx = pathname.lastIndexOf("/api/");
  if (idx >= 0) return pathname.slice(idx);
  return null;
}

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
