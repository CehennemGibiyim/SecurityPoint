import { setRosterCell } from "@/lib/server/roster";

export const dynamic = "force-dynamic";

/** Izgara hücresi ataması: (tarih, sütun) → personel. personnelId=null hücreyi boşaltır. */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { departmentId, date, columnKey, personnelId } = body;
    if (!departmentId || !date || !columnKey) {
      return Response.json({ error: "Eksik alan" }, { status: 400 });
    }
    const res = await setRosterCell(departmentId, date, columnKey, personnelId || null);
    return Response.json(res);
  } catch (e) {
    const status = (e as { status?: number })?.status ?? 500;
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status });
  }
}
