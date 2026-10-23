import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  departments as p26Departments,
  employees,
  faceDepartments,
  personnel,
  personnelDepartments,
} from "@/db/schema";

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
}

function makeDeptCode(name: string): string {
  const ascii = name
    .toLocaleUpperCase("tr-TR")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18);
  return ascii || "BIRIM";
}

function parseDataUrl(url?: string | null): { mime: string; data: string } | null {
  if (!url || !url.startsWith("data:image/")) return null;
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(url);
  if (!match) return null;
  return { mime: match[1], data: match[2] };
}

export type ExtraSyncFields = {
  tcNo?: string | null;
  personnelType?: string | null;
  staffGroup?: string | null;
};

/**
 * Syncs a single ORION FaceGate employee into Personel26's `personnel` +
 * `departments` + `personnel_departments` without overwriting any existing
 * official shift schedules, timesheet entries, or overrides.
 */
export async function syncFaceEmployeeToP26(
  employeeId: number,
  extra?: ExtraSyncFields,
): Promise<void> {
  const emp = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .then((rows) => rows[0] ?? null);
  if (!emp) return;

  let targetP26DeptId: string | null = null;
  const allP26Depts = await db.select().from(p26Departments);

  if (emp.departmentId) {
    const faceDept = await db
      .select()
      .from(faceDepartments)
      .where(eq(faceDepartments.id, emp.departmentId))
      .then((rows) => rows[0] ?? null);
    if (faceDept) {
      const targetKey = normalizeName(faceDept.name);
      let existingDept = allP26Depts.find((d) => normalizeName(d.name) === targetKey);
      if (!existingDept) {
        const [createdDept] = await db
          .insert(p26Departments)
          .values({ name: faceDept.name })
          .returning();
        existingDept = createdDept;
      }
      targetP26DeptId = existingDept?.id ?? null;
    }
  }
  if (!targetP26DeptId && allP26Depts.length > 0) {
    targetP26DeptId = allP26Depts[0].id;
  }

  const fullUpper = normalizeName(`${emp.firstName} ${emp.lastName}`);
  const allP26People = await db.select().from(personnel);
  const tag = `[SICIL:${emp.employeeNo}]`;

  const match = allP26People.find(
    (p) =>
      (p.notes && p.notes.includes(tag)) ||
      (extra?.tcNo && p.tcNo === extra.tcNo.trim()) ||
      (emp.email && p.email && p.email.toLowerCase() === emp.email.toLowerCase()) ||
      normalizeName(p.fullName || p.name) === fullUpper,
  );

  const parsedAvatar = parseDataUrl(emp.photoUrl);
  const resolvedType = extra?.personnelType || match?.personnelType || "MEMUR";
  const resolvedGroup =
    extra?.staffGroup ||
    match?.staffGroup ||
    (emp.title?.toLocaleLowerCase("tr-TR").includes("temizlik") ||
    emp.title?.toLocaleLowerCase("tr-TR").includes("destek")
      ? "DESTEK"
      : "SAGLIK");

  let personId: string;
  if (match) {
    personId = match.id;
    await db
      .update(personnel)
      .set({
        name: fullUpper,
        fullName: fullUpper,
        tcNo: extra?.tcNo?.trim() || match.tcNo || null,
        personnelType: resolvedType,
        staffGroup: resolvedGroup,
        isActive: emp.status === "active",
        departmentId: targetP26DeptId ?? match.departmentId,
        title: emp.title ?? match.title,
        phone: emp.phone ?? match.phone,
        email: emp.email ?? match.email,
        startDate: emp.hireDate ?? match.startDate,
        ...(parsedAvatar
          ? {
              avatarData: parsedAvatar.data,
              avatarMime: parsedAvatar.mime,
              avatarUpdatedAt: new Date(),
            }
          : {}),
      })
      .where(eq(personnel.id, match.id));
  } else {
    const [inserted] = await db
      .insert(personnel)
      .values({
        name: fullUpper,
        fullName: fullUpper,
        tcNo: extra?.tcNo?.trim() || null,
        personnelType: resolvedType,
        staffGroup: resolvedGroup,
        isActive: emp.status === "active",
        departmentId: targetP26DeptId,
        title: emp.title ?? null,
        phone: emp.phone ?? null,
        email: emp.email ?? null,
        startDate: emp.hireDate ?? null,
        notes: tag,
        annualLeaveBalance: resolvedType === "ISCI" ? 14 : 20,
        sickLeaveBalance: 30,
        unpaidLeaveBalance: 0,
        ...(parsedAvatar
          ? {
              avatarData: parsedAvatar.data,
              avatarMime: parsedAvatar.mime,
              avatarUpdatedAt: new Date(),
            }
          : {}),
      })
      .returning();
    personId = inserted.id;
  }

  if (targetP26DeptId) {
    await db
      .insert(personnelDepartments)
      .values({ personnelId: personId, departmentId: targetP26DeptId })
      .onConflictDoNothing();
  }
}

/**
 * Syncs a Personel26 staff member into ORION FaceGate `employees` + `face_departments`
 * so staff added or imported via Puantaj26 also appear in FaceGate for biometric enrollment.
 */
export async function syncP26PersonToFace(personId: string): Promise<void> {
  const person = await db
    .select()
    .from(personnel)
    .where(eq(personnel.id, personId))
    .then((rows) => rows[0] ?? null);
  if (!person) return;

  let targetFaceDeptId: number | null = null;
  if (person.departmentId) {
    const pDept = await db
      .select()
      .from(p26Departments)
      .where(eq(p26Departments.id, person.departmentId))
      .then((rows) => rows[0] ?? null);
    if (pDept) {
      const allFaceDepts = await db.select().from(faceDepartments);
      let existingFaceDept = allFaceDepts.find(
        (d) => normalizeName(d.name) === normalizeName(pDept.name),
      );
      if (!existingFaceDept) {
        let code = makeDeptCode(pDept.name);
        let suffix = 1;
        while (allFaceDepts.some((d) => d.code === code)) {
          suffix += 1;
          code = `${makeDeptCode(pDept.name).slice(0, 14)}-${suffix}`;
        }
        const [created] = await db
          .insert(faceDepartments)
          .values({ name: pDept.name, code, color: "#2ee9d0" })
          .returning();
        existingFaceDept = created;
      }
      targetFaceDeptId = existingFaceDept?.id ?? null;
    }
  }

  const displayName = (person.fullName || person.name).trim();
  const parts = displayName.split(/\s+/);
  const firstName = parts.slice(0, -1).join(" ") || parts[0] || "Personel";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "-";

  const allFacePeople = await db.select().from(employees);
  const fullUpper = normalizeName(displayName);
  const match = allFacePeople.find(
    (e) =>
      (person.notes && person.notes.includes(`[SICIL:${e.employeeNo}]`)) ||
      (person.email && e.email && e.email.toLowerCase() === person.email.toLowerCase()) ||
      normalizeName(`${e.firstName} ${e.lastName}`) === fullUpper,
  );

  const photoDataUrl =
    person.avatarData && person.avatarMime
      ? `data:${person.avatarMime};base64,${person.avatarData}`
      : null;

  if (match) {
    await db
      .update(employees)
      .set({
        firstName,
        lastName,
        title: person.title ?? match.title,
        phone: person.phone ?? match.phone,
        email: person.email ?? match.email,
        departmentId: targetFaceDeptId ?? match.departmentId,
        status: person.isActive ? "active" : "inactive",
        photoUrl: photoDataUrl ?? match.photoUrl,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, match.id));
  } else {
    const maxNum = allFacePeople.reduce((m, e) => {
      const n = Number(e.employeeNo.replace(/\D/g, ""));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 1000);
    let sicil = `ORN-${maxNum + 1}`;
    let bump = 1;
    while (allFacePeople.some((e) => e.employeeNo === sicil)) {
      bump += 1;
      sicil = `ORN-${maxNum + bump}`;
    }
    await db.insert(employees).values({
      employeeNo: sicil,
      firstName,
      lastName,
      title: person.title ?? null,
      phone: person.phone ?? null,
      email: person.email ?? null,
      departmentId: targetFaceDeptId,
      status: person.isActive ? "active" : "inactive",
      hireDate: person.startDate ?? null,
      photoUrl: photoDataUrl,
    });
  }
}

/**
 * Full two-way synchronization on demand between ORION FaceGate & Puantaj26.
 */
export async function syncAllPersonnelBothWays(): Promise<{
  faceCount: number;
  p26Count: number;
}> {
  const faceList = await db.select({ id: employees.id }).from(employees);
  for (const e of faceList) {
    await syncFaceEmployeeToP26(e.id);
  }
  const p26List = await db.select({ id: personnel.id }).from(personnel);
  for (const p of p26List) {
    await syncP26PersonToFace(p.id);
  }
  const [finalFace, finalP26] = await Promise.all([
    db.select({ id: employees.id }).from(employees),
    db.select({ id: personnel.id }).from(personnel),
  ]);
  return { faceCount: finalFace.length, p26Count: finalP26.length };
}
