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

/** Tabloların var olup olmadığını kontrol eder. */
export async function schemaExists(pg: PGlite): Promise<boolean> {
  const res = await pg.query<{ t: string | null }>(
    "select to_regclass('public.timesheet_entries') as t",
  );
  return Boolean(res.rows[0]?.t);
}

/** Tabloları + indeksleri + kısıtları oluşturur (tek işlem içinde). */
export async function createSchema(pg: PGlite): Promise<void> {
  const body = schemaStatements().join(";\n");
  await pg.exec(`begin;\n${body};\ncommit;`);
}

/** Tüm veriyi ve tabloları siler (demo sıfırlama / şema yenileme). */
export async function dropSchema(pg: PGlite): Promise<void> {
  await pg.exec("drop schema public cascade; create schema public;");
}
