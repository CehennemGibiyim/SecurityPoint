import { db } from "@/db";
import { departments, personnel, personnelDepartments, activityLogs } from "@/db/schema";
import { sql } from "drizzle-orm";
import { parseImportInput, previewImport } from "@/lib/server/personnel-import";
import { requireSameOrigin } from "@/lib/server/settings";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const text = await request.text();
    if (text.length > 8 * 1024 * 1024) return Response.json({ error: "Dosya çok büyük." }, { status: 413 });
    const input = parseImportInput(JSON.parse(text));
    if (input.mode === "preview") {
      const [services, people] = await Promise.all([db.select({ id: departments.id, name: departments.name }).from(departments), db.select({ name: personnel.name, tcNo: personnel.tcNo }).from(personnel)]);
      return Response.json(previewImport(input, services, people));
    }
    if (!input.confirmed) return Response.json({ error: "Önizlemeyi kontrol ederek aktarımı onaylayın." }, { status: 400 });
    const result = await db.transaction(async tx => {
      await tx.execute(sql`LOCK TABLE personnel IN SHARE ROW EXCLUSIVE MODE`);
      const services = await tx.select({ id: departments.id, name: departments.name }).from(departments);
      const people = await tx.select({ name: personnel.name, tcNo: personnel.tcNo }).from(personnel);
      const preview = previewImport(input, services, people);
      if (!input.skipInvalid && (preview.summary.error || preview.summary.duplicate)) throw new Error("Hatalı veya mükerrer satırlar var. Düzeltin ya da yalnızca geçerli satırları aktarmayı seçin.");
      const eligible = preview.rows.filter(row => row.status === "valid" || (row.status === "warning" && input.acceptNames));
      if (!eligible.length) throw new Error("Aktarılabilecek geçerli satır yok.");
      for (const row of eligible) {
        const { departmentIds, ...record } = row.record;
        const [person] = await tx.insert(personnel).values({ ...record, fullName: record.name, departmentId: departmentIds[0], sickLeaveBalance: 30, unpaidLeaveBalance: 0 }).returning({ id: personnel.id });
        await tx.insert(personnelDepartments).values(departmentIds.map(departmentId => ({ personnelId: person.id, departmentId })));
      }
      await tx.insert(activityLogs).values({ action: "IMPORT", description: `${input.fileName}: ${eligible.length} personel aktarıldı, ${preview.rows.length - eligible.length} satır atlandı.` });
      return { imported: eligible.length, skipped: preview.rows.length - eligible.length, summary: preview.summary };
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Aktarım tamamlanamadı." }, { status: 400 });
  }
}
