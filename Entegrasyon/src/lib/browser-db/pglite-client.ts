/**
 * Tarayıcı içi PostgreSQL istemcisi (PGlite).
 *
 * GitHub Pages gibi "sunucusuz" statik ortamlarda panelin veri katmanını sağlar:
 * gerçek PostgreSQL (WASM) doğrudan tarayıcıda çalışır, veriler IndexedDB'de
 * kalıcı olarak saklanır. Sunucu tarafındaki (Vercel / Windows paketi) kurulumla
 * birebir aynı Drizzle şeması ve aynı API rotaları kullanılır — değişen tek şey
 * sürücüdür (`pg` yerine PGlite).
 *
 * Bu dosya yalnızca GitHub Pages derlemesinde `@/db` yerine bağlanır
 * (bkz. scripts/pages-build.mjs). Normal sunucu derlemesi bundan etkilenmez.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

/** IndexedDB içindeki veritabanı adı (tarayıcı başına kalıcıdır). */
export const BROWSER_DB_NAME = "personel26";

/**
 * Tarayıcıda IndexedDB destekli, Node.js ortamında (test amaçlı) bellek içi
 * PostgreSQL örneği. WASM çekirdeği ilk kullanımda yüklenir; PGlite hazır
 * olmadan gönderilen sorguları kuyruğa alır.
 */
/** IndexedDB yoksa (gizli mod, test ortamı) veritabanı bellekte çalışır. */
const hasIndexedDb = typeof indexedDB !== "undefined";

export const pg = new PGlite(hasIndexedDb ? `idb://${BROWSER_DB_NAME}` : undefined);

export const db = drizzle(pg);

/** Statik sürümde bağlantı her zaman "yapılandırılmış" sayılır. */
export const databaseConfigured = true;

/** Hata mesajlarında/panellerde kullanılan mod etiketi. */
export const dbMode = "browser-pglite" as const;

/**
 * Sunucu tarafındaki `pg.Pool` ile aynı arayüz (advisory lock vb. çağrılar
 * için ince bir uyumluluk katmanı).
 */
export const pool = {
  query: (text: string, values?: unknown[]) => pg.query(text, values),
  end: () => pg.close(),
};
