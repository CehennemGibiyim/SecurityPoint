import { db } from "@/db";
import { shiftTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { replaceColumns, createDraft } from "@/lib/server/roster";
import { normalizeTemplateColumns, parseStaffGroup } from "@/lib/shared";

export const dynamic = "force-dynamic";

/**
 * Şablonu tek adımda işle: sütun düzenini kur + seçili ayı dengeli taslakla doldur.
 * Nöbet çizelgesinde kaydedilen özel şablonlar dahil tüm şablonlarla çalışır.
 */
export async function POST(req: Request) {
  try {
    const { templateId, departmentId, year, month, staffGroup } = await req.json();
    const group = parseStaffGroup(staffGroup);
    if (!templateId || !departmentId || !year || month === undefined) {
      return Response.json({ error: "Eksik alan" }, { status: 400 });
    }
    const template = (await db.select().from(shiftTemplates).where(eq(shiftTemplates.id, templateId)))[0];
    if (!template) return Response.json({ error: "Şablon bulunamadı" }, { status: 404 });
    const cols = normalizeTemplateColumns(template.slots);
    if (!cols.length) return Response.json({ error: "Şablonda sütun yok" }, { status: 400 });

    // 1) Sütunları kur (yalnızca hedef ayın atamalarını temizle — taslak sıfırdan dolduracak)
    await replaceColumns(departmentId, cols, true, { year, month }, group);
    // 2) Dengeli taslağı doldur
    const draft = await createDraft(departmentId, year, month, false, group);
    return Response.json({
      template: template.name,
      columns: cols.length,
      placed: draft.placed,
      skipped: draft.skipped,
    });
  } catch (e) {
    const status = (e as { status?: number })?.status ?? 500;
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status });
  }
}
