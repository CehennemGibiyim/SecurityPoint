import { db } from "@/db";
import { shiftTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { replaceColumns } from "@/lib/server/roster";
import { normalizeTemplateColumns, parseStaffGroup } from "@/lib/shared";

export const dynamic = "force-dynamic";

/**
 * Şablon uygulama (referans: duty-template-state apply):
 * şablonun sütun düzeni servisin nöbet sütunları olarak kurulur.
 * clearAssignments=true + year/month verilirse yalnızca o ayın atamaları
 * temizlenir; geçmiş aylar korunur.
 */
export async function POST(req: Request) {
  try {
    const { templateId, departmentId, clearAssignments, year, month, staffGroup } = await req.json();
    if (!templateId || !departmentId) {
      return Response.json({ error: "Eksik alan" }, { status: 400 });
    }
    const template = (await db.select().from(shiftTemplates).where(eq(shiftTemplates.id, templateId)))[0];
    if (!template) return Response.json({ error: "Şablon bulunamadı" }, { status: 404 });
    const cols = normalizeTemplateColumns(template.slots);
    if (!cols.length) return Response.json({ error: "Şablonda sütun yok" }, { status: 400 });
    const now = new Date();
    const scope = {
      year: Number.isFinite(year) ? year : now.getFullYear(),
      month: Number.isFinite(month) ? month : now.getMonth(),
    };
    const created = await replaceColumns(departmentId, cols, clearAssignments !== false, scope, parseStaffGroup(staffGroup));
    return Response.json({ columns: created.length, scope });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
