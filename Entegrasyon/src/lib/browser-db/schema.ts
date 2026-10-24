/**
 * Tarayıcı veritabanı şeması.
 *
 * DDL, `drizzle-kit generate` ile src/db/schema.ts'ten üretilir ve derleme
 * sırasında pakete gömülür (`p26-schema-sql` sanal modülü — bkz.
 * scripts/pages-build.mjs). Böylece tarayıcıdaki PostgreSQL şeması, sunucu
 * tarafındaki Drizzle şemasıyla aynı kalır.
 */
import type { PGlite } from "@electric-sql/pglite";
import schemaDdl from "p26-schema-sql";

export const SCHEMA_DDL: string = schemaDdl;

/** drizzle-kit çıktısındaki ayraç. */
const BREAKPOINT = "--> statement-breakpoint";

export function schemaStatements(): string[] {
  return SCHEMA_DDL.split(BREAKPOINT)
    .map(s => s.trim())
    .filter(Boolean);
}

/** DDL'de `CREATE TABLE` ile tanımlanan tüm tablo adları. */
function ddlTableNames(): string[] {
  const names: string[] = [];
  for (const statement of schemaStatements()) {
    const match = /^CREATE TABLE(?: IF NOT EXISTS)? "(\w+)"/.exec(statement);
    if (match) names.push(match[1]);
  }
  return names;
}

/**
 * Şema parmak izi. Uygulama güncellenip şema değiştiğinde tarayıcıdaki eski
 * veritabanı otomatik yenilenir (demo verisi yeniden kurulur).
 */
export function schemaStamp(): string {
  let h = 5381;
  for (let i = 0; i < SCHEMA_DDL.length; i++) {
    h = ((h * 33) ^ SCHEMA_DDL.charCodeAt(i)) >>> 0;
  }
  return `s${h.toString(36)}-${SCHEMA_DDL.length.toString(36)}`;
}

/**
 * Şemanın kurulu olup olmadığını kontrol eder.
 *
 * DDL'deki TÜM tablolara bakılır (yalnızca birkaç tablo değil): eski bir
 * sürümün kısmi şemasıyla açılan veritabanında (ör. eskide `activity_logs`
 * var, yenideki `employees` yok) eksik tablo varsa `false` döner ve
 * `createSchema` eksikleri tamamlar.
 */
export async function schemaExists(pg: PGlite): Promise<boolean> {
  const names = ddlTableNames();
  if (!names.length) return false;
  const probes = names.map((name, i) => `to_regclass('public.${name}') as t${i}`);
  const res = await pg.query<Record<string, unknown>>(`select ${probes.join(", ")}`);
  return Object.values(res.rows[0] ?? {}).every(value => value !== null && value !== undefined);
}

/** Tekrarlı nesne hatası mı? (tablo/indeks/kısıt zaten kurulu) */
function isDuplicateObjectError(error: unknown): boolean {
  const err = error as { code?: unknown; message?: unknown };
  const code = typeof err?.code === "string" ? err.code : "";
  if (code === "42P07" || code === "42P06" || code === "42710" || code === "42701") return true;
  return typeof err?.message === "string" && /already exists/i.test(err.message);
}

/** `CREATE` ifadelerine `IF NOT EXISTS` ekler (eski şemayla çakışmasın diye). */
function makeIdempotent(statement: string): string {
  return statement
    .replace(/^CREATE TABLE "/i, 'CREATE TABLE IF NOT EXISTS "')
    .replace(/^CREATE (UNIQUE )?INDEX "/i, (_m, unique?: string) => `CREATE ${unique ?? ""}INDEX IF NOT EXISTS "`);
}

/**
 * Tabloları + indeksleri + kısıtları kurar (tek işlem içinde).
 *
 * Idempotenttir: kurulmamış nesneler oluşturulur, zaten kurulu olanlar
 * (eski sürümün kısmi şemasından kalan tablolar, aynı isimli kısıtlar)
 * atlanır — mevcut tablolar ve kullanıcı verileri değiştirilmez/silinmez.
 */
export async function createSchema(pg: PGlite): Promise<void> {
  const statements = schemaStatements().map(makeIdempotent);
  // Önceki bir açılışta yarım kalmış (aborted) işlem varsa temizle.
  await pg.exec("rollback").catch(() => undefined);
  await pg.exec("begin");
  try {
    for (const statement of statements) {
      await pg.exec("savepoint p26_ddl");
      try {
        await pg.exec(statement);
        await pg.exec("release savepoint p26_ddl");
      } catch (error) {
        await pg.exec("rollback to savepoint p26_ddl").catch(() => undefined);
        if (!isDuplicateObjectError(error)) throw error;
      }
    }
    await pg.exec("commit");
  } catch (error) {
    await pg.exec("rollback").catch(() => undefined);
    throw error;
  }
}

/** Tüm veriyi ve tabloları siler (demo sıfırlama / şema yenileme). */
export async function dropSchema(pg: PGlite): Promise<void> {
  await pg.exec("drop schema public cascade; create schema public;");
}
