import { db } from "@/db";
import { departments, personnel, personnelDepartments, shiftSchedules, dutyColumns } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { sortByName } from "@/lib/shared";

export const dynamic = "force-dynamic";

const trKey = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
const clean = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");

/** Aynı adda (büyük/küçük harf ve boşluk farkı gözetmeden) başka servis var mı? */
async function nameTaken(name: string, exceptId?: string) {
  const all = await db.select({ id: departments.id, name: departments.name }).from(departments);
  return all.some(d => d.id !== exceptId && trKey(d.name) === trKey(name));
}

/** Servis listesi + her servisin bağlı kayıt sayıları (silme uyarısı için). */
export async function GET() {
  try {
    const depts = sortByName(await db.select().from(departments).orderBy(departments.name));
    const [members, people, schedules, columns] = await Promise.all([
      db.select({ pid: personnelDepartments.personnelId, dep: personnelDepartments.departmentId }).from(personnelDepartments),
      db.select({ pid: personnel.id, dep: personnel.departmentId }).from(personnel),
      db.select({ dep: shiftSchedules.departmentId, n: sql<number>`count(*)::int` })
        .from(shiftSchedules).groupBy(shiftSchedules.departmentId),
      db.select({ dep: dutyColumns.departmentId, n: sql<number>`count(*)::int` })
        .from(dutyColumns).groupBy(dutyColumns.departmentId),
    ]);
    // Personel sayısı: ana servisi bu servis OLAN veya bu servise üye olan kişiler (tekil)
    const perDept = new Map<string, Set<string>>();
    for (const r of [...members, ...people]) {
      if (!r.dep) continue;
      if (!perDept.has(r.dep)) perDept.set(r.dep, new Set());
      perDept.get(r.dep)!.add(r.pid);
    }
    const get = (rows: { dep: string | null; n: number }[], id: string) => rows.find(r => r.dep === id)?.n ?? 0;
    return Response.json({
      departments: depts.map(d => ({
        ...d,
        stats: {
          personnel: perDept.get(d.id)?.size ?? 0,
          schedules: get(schedules, d.id),
          columns: get(columns, d.id),
        },
      })),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/** Ad ve imza alanlarını güncelleme. */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    const allowed = ["sorumluHemsire", "hemsireUnvan", "saglikBakimMuduru", "saglikBakimUnvan", "bashekim", "bashekimUnvan", "name", "managerName"];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in fields) patch[k] = typeof fields[k] === "string" ? clean(fields[k]) || null : fields[k];
    if ("name" in patch) {
      const name = clean(fields.name);
      if (name.length < 2) return Response.json({ error: "Servis adı en az 2 karakter olmalı." }, { status: 400 });
      if (name.length > 80) return Response.json({ error: "Servis adı en fazla 80 karakter olabilir." }, { status: 400 });
      if (await nameTaken(name, id)) return Response.json({ error: `"${name}" adında bir servis zaten var.` }, { status: 409 });
      patch.name = name;
    }
    const rows = await db.update(departments).set(patch).where(eq(departments.id, id)).returning();
    if (!rows[0]) return Response.json({ error: "Servis bulunamadı" }, { status: 404 });
    return Response.json({ department: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/** Yeni servis ekleme. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = clean(body.name);
    if (name.length < 2) return Response.json({ error: "Servis adı en az 2 karakter olmalı." }, { status: 400 });
    if (name.length > 80) return Response.json({ error: "Servis adı en fazla 80 karakter olabilir." }, { status: 400 });
    if (await nameTaken(name)) return Response.json({ error: `"${name}" adında bir servis zaten var.` }, { status: 409 });
    const rows = await db.insert(departments).values({ name }).returning();
    return Response.json({ department: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/**
 * Servis silme. Personel kayıtları SİLİNMEZ (yalnızca bu servisle bağı kalkar);
 * servise ait nöbet atamaları ve nöbet sütunları silinir. Puantaj kayıtları
 * personele bağlı olduğu için korunur.
 */
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    const dept = (await db.select().from(departments).where(eq(departments.id, id)))[0];
    if (!dept) return Response.json({ error: "Servis bulunamadı" }, { status: 404 });

    // Bu servisi ana servis olarak kullanan personel: başka bir servisi varsa oraya aktar
    const affected = await db.select({ id: personnel.id }).from(personnel).where(eq(personnel.departmentId, id));
    let moved = 0;
    for (const p of affected) {
      const others = await db.select({ dep: personnelDepartments.departmentId })
        .from(personnelDepartments).where(eq(personnelDepartments.personnelId, p.id));
      const next = others.map(o => o.dep).find(d => d !== id) ?? null;
      await db.update(personnel).set({ departmentId: next }).where(eq(personnel.id, p.id));
      if (next) moved++;
    }
    await db.delete(departments).where(eq(departments.id, id));
    return Response.json({ ok: true, name: dept.name, personnelKept: affected.length, movedToOther: moved });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
