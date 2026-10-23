import { buildPersonelExport, xlsxResponse, safeFileName } from "@/lib/server/export";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const data = await buildPersonelExport({
      dept: url.searchParams.get("dept") ?? "ALL",
      type: url.searchParams.get("type") ?? "ALL",
      status: url.searchParams.get("status") ?? "ALL",
      q: url.searchParams.get("q") ?? "",
    });
    return xlsxResponse([{ name: "Personel", rows: data.rows }], safeFileName("personel_listesi") + ".xlsx");
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Dışa aktarma hatası" }, { status: 500 });
  }
}
