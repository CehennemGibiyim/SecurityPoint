/**
 * Panelin tarayıcı içi arka ucu (API köprüsü).
 *
 * GitHub Pages statik bir site barındırdığı için sunucu yoktur. Bu katman:
 *   1. `window.fetch` çağrılarını yakalar ve `/api/...` isteklerini
 *      tarayıcıdaki gerçek PostgreSQL (PGlite) üzerinde çalıştırır,
 *   2. veritabanını ilk açılışta kurar ve örnek verileri yükler,
 *   3. profil fotoğrafları gibi görsel uçları için yardımcılar sunar.
 *
 * Böylece panel kodu (fetch + JSON sözleşmesi) hiç değişmeden hem sunuculu
 * kurulumda hem de GitHub Pages'te çalışır.
 */
import { pg, BROWSER_DB_NAME } from "./pglite-client";
import { createSchema, dropSchema, schemaExists, schemaStamp } from "./schema";
import { dispatchApi } from "./routes";

export const BRIDGE_VERSION = "1.0.0";

const STAMP_KEY = "p26:db-schema-stamp";

export type StatusFn = (message: string) => void;

let bootPromise: Promise<void> | null = null;
let lastStatus = "";

function report(message: string) {
  lastStatus = message;
  const w = window as unknown as Record<string, unknown>;
  if (typeof w.__p26Status === "function") {
    (w.__p26Status as StatusFn)(message);
  }
}

function readStamp(): string | null {
  try {
    return window.localStorage.getItem(STAMP_KEY);
  } catch {
    return null;
  }
}

function writeStamp(value: string) {
  try {
    window.localStorage.setItem(STAMP_KEY, value);
  } catch {
    /* gizli sekmede localStorage kapalı olabilir — önemsiz */
  }
}

/**
 * Veritabanını hazırlar: şema + örnek veriler.
 * Aynı sayfa içinde birden çok kez çağrılsa bile tek kez çalışır.
 */
export function bootBrowserDb(): Promise<void> {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    report("PostgreSQL motoru başlatılıyor…");
    await pg.waitReady;

    const stamp = schemaStamp();
    const previous = readStamp();

    if (!(await schemaExists(pg))) {
      report("Tablolar oluşturuluyor…");
      await createSchema(pg);
    }
    // Şema parmak izi değişse bile kullanıcı verileri ASLA otomatik silinmez.
    report(previous && previous !== stamp ? "Veriler korunarak şema güncelleniyor…" : "Şema kontrol ediliyor…");
    const { db } = await import("./pglite-client");
    const { sql } = await import("drizzle-orm");
    const { schemaUpdateStatements } = await import("@/lib/schema-updates");
    await db.transaction(async tx => {
      for (const statement of schemaUpdateStatements()) await tx.execute(sql.raw(statement));
    });
    writeStamp(stamp);

    report("Örnek veriler yükleniyor…");
    // Sunuculu sürümdekiyle aynı çekirdek: senkron + yedek + örnek veri.
    const core = await import("@/lib/server/core");
    await core.ensureSeeded();
    core.ensureDailyBackup().catch(() => {});

    report("Hazır");
  })().catch((err: unknown) => {
    bootPromise = null; // tekrar denenebilsin
    throw err instanceof Error ? err : new Error(String(err));
  });
  return bootPromise;
}

/** Tarayıcı veritabanını siler ve örnek verilerle yeniden kurar. */
export async function resetBrowserDb(): Promise<void> {
  report("Veritabanı sıfırlanıyor…");
  await pg.waitReady;
  await dropSchema(pg);
  writeStamp(schemaStamp());
  window.localStorage.removeItem("p26:db-schema-stamp");
  window.location.reload();
}

/** Panel uçlarını tarayıcıda çalıştırır. */
export async function handleApiRequest(req: Request): Promise<Response> {
  await bootBrowserDb();
  const res = await dispatchApi(req);
  if (res) return res;
  return new Response(
    JSON.stringify({ error: `Bu uç statik sürümde tanımlı değil: ${new URL(req.url).pathname}` }),
    { status: 404, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

/** Site kök adresi (pglite/app.js'in bulunduğu klasörün bir üstü). */
const siteBase = new URL("../", import.meta.url);

export function assetUrl(relativePath: string): string {
  return new URL(relativePath.replace(/^\//, ""), siteBase).href;
}

/** Varlık sorguları için: <img> yerine blob adresi üretir. */
const avatarCache = new Map<string, string>();

export async function avatarObjectUrl(id: string, version?: string | null): Promise<string | null> {
  const key = `${id}|${version ?? ""}`;
  const cached = avatarCache.get(key);
  if (cached) return cached;
  const res = await handleApiRequest(
    new Request(new URL(`/api/personnel/avatar/${id}${version ? `?v=${version}` : ""}`, siteBase).href, { method: "GET" }),
  );
  if (!res.ok) return null;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  avatarCache.set(key, url);
  return url;
}

/** Veritabanı özeti (arayüzdeki demo rozetinde gösterilir). */
export async function browserDbInfo(): Promise<Record<string, number | string>> {
  await bootBrowserDb();
  const { db } = await import("./pglite-client");
  const { departments, personnel, shiftSchedules, timesheetEntries, leaveRequests, dutyColumns } = await import("@/db/schema");
  const [d, p, s, t, l, c] = await Promise.all([
    db.select({ id: departments.id }).from(departments),
    db.select({ id: personnel.id }).from(personnel),
    db.select({ id: shiftSchedules.id }).from(shiftSchedules),
    db.select({ id: timesheetEntries.id }).from(timesheetEntries),
    db.select({ id: leaveRequests.id }).from(leaveRequests),
    db.select({ id: dutyColumns.id }).from(dutyColumns),
  ]);
  return {
    mode: "browser-pglite",
    database: BROWSER_DB_NAME,
    version: BRIDGE_VERSION,
    departments: d.length,
    personnel: p.length,
    schedules: s.length,
    timesheet: t.length,
    leaves: l.length,
    dutyColumns: c.length,
  };
}

/**
 * `window.fetch`'i sarar: aynı kaynaklı `/api/...` istekleri tarayıcıdaki
 * veritabanına yönlenir, diğer tüm istekler (Next.js varlıkları vb.) normal
 * şekilde ağa gider.
 */
export function installFetchBridge() {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let isApi = false;
    let target: Request | null = null;
    try {
      const href =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(href, window.location.href);
      isApi = url.origin === window.location.origin && url.pathname.includes("/api/");
      if (isApi && !(typeof input === "string" || input instanceof URL) && !init) {
        target = input as Request;
      }
    } catch {
      isApi = false;
    }
    if (!isApi) return original(input as RequestInfo, init);
    try {
      if (!target) {
        const href =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        target = new Request(new URL(href, window.location.href).href, init as RequestInit);
      }
      return await handleApiRequest(target);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Tarayıcı veritabanı hatası" }),
        { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
      );
    }
  };
}

/** Uygulamanın geri kalanının kullandığı köprü arayüzü. */
export function exposeBridgeApi() {
  const w = window as unknown as Record<string, unknown>;
  w.__p26 = {
    version: BRIDGE_VERSION,
    mode: "browser-pglite",
    boot: bootBrowserDb,
    reset: resetBrowserDb,
    info: browserDbInfo,
    assetUrl,
    avatarUrl: avatarObjectUrl,
    api: (path: string, init?: RequestInit) =>
      handleApiRequest(new Request(new URL(path, siteBase).href, init)),
    status: () => lastStatus,
  };
  if (lastStatus) w.__p26LastStatus = lastStatus;
}

/** Giriş noktası: köprüyü kurar ve veritabanını arka planda başlatır. */
export function bootstrapBrowserApp() {
  installFetchBridge();
  exposeBridgeApi();
  bootBrowserDb().then(
    () => {
      const w = window as unknown as Record<string, unknown>;
      if (typeof w.__p26Resolve === "function") (w.__p26Resolve as () => void)();
    },
    (err: unknown) => {
      const w = window as unknown as Record<string, unknown>;
      if (typeof w.__p26Reject === "function") {
        (w.__p26Reject as (e: unknown) => void)(err);
      } else {
        console.error("[Personel26] Tarayıcı veritabanı başlatılamadı:", err);
      }
    },
  );
}
