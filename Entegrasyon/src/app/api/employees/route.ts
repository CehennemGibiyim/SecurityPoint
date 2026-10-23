import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/face-schema";
import { ensureSeeded as ensureP26Seeded } from "@/lib/server/core";
import { syncFaceEmployeeToP26 } from "@/lib/personnel-sync";
import { listEmployeesDetailed } from "@/lib/queries";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const items = await listEmployeesDetailed();
  return Response.json({ items });
}

export async function POST(request: Request) {
  await ensureSeed();
  await ensureP26Seeded().catch(() => {});
  const body = (await request.json()) as {
    employeeNo?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    departmentId?: number | null;
    shiftId?: number | null;
    title?: string;
    photoUrl?: string;
    status?: string;
    hireDate?: string;
    tcNo?: string;
    personnelType?: string;
    staffGroup?: string;
  };

  if (!body.employeeNo || !body.firstName || !body.lastName) {
    return Response.json(
      { error: "Sicil, ad ve soyad zorunludur." },
      { status: 400 },
    );
  }

  const exists = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.employeeNo, body.employeeNo.trim()))
    .then((rows) => rows[0]);

  if (exists) {
    return Response.json({ error: "Bu sicil numarası zaten kayıtlı." }, { status: 409 });
  }

  const [created] = await db
    .insert(employees)
    .values({
      employeeNo: body.employeeNo.trim(),
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      departmentId: body.departmentId ?? null,
      shiftId: body.shiftId ?? null,
      title: body.title?.trim() || null,
      photoUrl: body.photoUrl?.trim() || null,
      status: body.status === "inactive" ? "inactive" : "active",
      hireDate: body.hireDate || new Date().toISOString().slice(0, 10),
    })
    .returning();

  await syncFaceEmployeeToP26(created.id, {
    tcNo: body.tcNo,
    personnelType: body.personnelType,
    staffGroup: body.staffGroup,
  }).catch(() => {});

  return Response.json({ item: created }, { status: 201 });
}
