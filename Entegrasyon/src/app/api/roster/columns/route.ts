import { addColumn, updateColumn, moveColumn, removeColumn, ensureColumns } from "@/lib/server/roster";
import { parseStaffGroup } from "@/lib/shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deptId = url.searchParams.get("dept") ?? "";
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!deptId || !year || Number.isNaN(month)) {
    return Response.json({ error: "dept, year, month gerekli" }, { status: 400 });
  }
  return Response.json({ columns: await ensureColumns(deptId, year, month, parseStaffGroup(url.searchParams.get("group"))) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "move") {
      const columns = await moveColumn(body.id, body.direction === "down" ? "down" : "up");
      return Response.json({ columns });
    }
    const column = await addColumn(body.departmentId, body.year, body.month, {
      service: body.service, shiftLabel: body.shiftLabel,
      startTime: body.startTime ?? "08:00", endTime: body.endTime ?? "16:00",
    }, parseStaffGroup(body.staffGroup));
    return Response.json({ column });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const column = await updateColumn(body.id, {
      service: body.service, shiftLabel: body.shiftLabel,
      startTime: body.startTime, endTime: body.endTime,
    });
    return Response.json({ column });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    const res = await removeColumn(id);
    return Response.json(res);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
