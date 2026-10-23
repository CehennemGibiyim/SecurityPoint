import { buildPuantajExport, xlsxResponse, csvResponse, safeFileName } from "@/lib/server/export";
import { MONTHS, parseStaffGroup, staffGroupMeta } from "@/lib/shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dept = url.searchParams.get("dept") ?? "";
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    const format = url.searchParams.get("format") ?? "xlsx";
    if (!dept || !year || Number.isNaN(month)) {
      return Response.json({ error: "dept, year, month gerekli" }, { status: 400 });
    }
    const group = parseStaffGroup(url.searchParams.get("group"));
    const data = await buildPuantajExport(dept, year, month, group);
    const base = safeFileName("puantaj", data.deptName, staffGroupMeta(group).file, MONTHS[month] ?? "", year);
    return format === "csv" ? csvResponse(data.csvRows, `${base}.csv`) : xlsxResponse(data.sheets, `${base}.xlsx`);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Dışa aktarma hatası" }, { status: 500 });
  }
}
