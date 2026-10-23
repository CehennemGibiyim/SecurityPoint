import { buildIzinlerExport, xlsxResponse, safeFileName } from "@/lib/server/export";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dept = url.searchParams.get("dept") ?? "";
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const status = url.searchParams.get("status") ?? "ALL";
    if (!dept) return Response.json({ error: "dept gerekli" }, { status: 400 });
    const data = await buildIzinlerExport(dept, year, status);
    const base = safeFileName("izinler", data.deptName, year);
    return xlsxResponse([{ name: "İzinler", rows: data.rows }], `${base}.xlsx`);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Dışa aktarma hatası" }, { status: 500 });
  }
}
