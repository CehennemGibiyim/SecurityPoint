import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/face-schema";
import { syncFaceEmployeeToP26 } from "@/lib/personnel-sync";
import { getEmployeeDetailed } from "@/lib/queries";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  await ensureSeed();
  const { id } = await ctx.params;
  const item = await getEmployeeDetailed(Number(id));
  if (!item) return Response.json({ error: "Personel bulunamadı." }, { status: 404 });
  return Response.json({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  await ensureSeed();
  const { id } = await ctx.params;
  const employeeId = Number(id);
  const existing = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .then((rows) => rows[0]);
  if (!existing) return Response.json({ error: "Personel bulunamadı." }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;
  await db
    .update(employees)
    .set({
      employeeNo:
        typeof body.employeeNo === "string" ? body.employeeNo.trim() : existing.employeeNo,
      firstName:
        typeof body.firstName === "string" ? body.firstName.trim() : existing.firstName,
      lastName: typeof body.lastName === "string" ? body.lastName.trim() : existing.lastName,
      email: typeof body.email === "string" ? body.email.trim() || null : existing.email,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : existing.phone,
      departmentId:
        body.departmentId === null
          ? null
          : typeof body.departmentId === "number"
            ? body.departmentId
            : existing.departmentId,
      shiftId:
        body.shiftId === null
          ? null
          : typeof body.shiftId === "number"
            ? body.shiftId
            : existing.shiftId,
      title: typeof body.title === "string" ? body.title.trim() || null : existing.title,
      photoUrl:
        typeof body.photoUrl === "string" ? body.photoUrl.trim() || null : existing.photoUrl,
      status: body.status === "inactive" || body.status === "active" ? body.status : existing.status,
      hireDate: typeof body.hireDate === "string" ? body.hireDate : existing.hireDate,
      cardNo: body.generateCard
        ? `RFID-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : typeof body.cardNo === "string"
          ? body.cardNo.trim() || null
          : existing.cardNo,
      qrToken: body.generateQr
        ? `QR-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
        : typeof body.qrToken === "string"
          ? body.qrToken.trim() || null
          : existing.qrToken,
      pinCode: body.generatePin
        ? String(Math.floor(1000 + Math.random() * 9000))
        : typeof body.pinCode === "string"
          ? body.pinCode.trim() || null
          : existing.pinCode,
      kvkkConsentAt:
        body.kvkkConsent === true
          ? new Date()
          : body.kvkkConsent === false
            ? null
            : existing.kvkkConsentAt,
      kvkkConsentVersion: body.kvkkConsent === true ? "v2026.1" : existing.kvkkConsentVersion,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));

  await syncFaceEmployeeToP26(employeeId).catch(() => {});

  const item = await getEmployeeDetailed(employeeId);
  return Response.json({ item });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  await ensureSeed();
  const { id } = await ctx.params;
  await db.delete(employees).where(eq(employees.id, Number(id)));
  return Response.json({ ok: true });
}
