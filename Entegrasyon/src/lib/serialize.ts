import { employees } from "@/db/face-schema";
import type { EmployeePublic } from "@/lib/types";

type EmployeeRow = typeof employees.$inferSelect;

export function publicEmployee(
  row: EmployeeRow,
  extras?: {
    departmentName?: string | null;
    departmentColor?: string | null;
    shiftName?: string | null;
    shiftStart?: string | null;
    shiftEnd?: string | null;
  },
): EmployeePublic {
  return {
    id: row.id,
    employeeNo: row.employeeNo,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    departmentId: row.departmentId,
    shiftId: row.shiftId,
    title: row.title,
    photoUrl: row.photoUrl,
    hasFace: Array.isArray(row.faceDescriptor) && row.faceDescriptor.length >= 128,
    faceEnrolledAt: row.faceEnrolledAt ? row.faceEnrolledAt.toISOString() : null,
    faceEnrollmentMetadata: row.faceEnrollmentMetadata ?? null,
    status: row.status,
    hireDate: row.hireDate,
    cardNo: row.cardNo ?? null,
    qrToken: row.qrToken ?? null,
    kvkkConsentAt: row.kvkkConsentAt ? row.kvkkConsentAt.toISOString() : null,
    isBlacklisted: row.isBlacklisted ?? false,
    insideZone: row.insideZone ?? null,
    annualLeaveQuota: row.annualLeaveQuota ?? 14,
    departmentName: extras?.departmentName ?? null,
    departmentColor: extras?.departmentColor ?? null,
    shiftName: extras?.shiftName ?? null,
    shiftStart: extras?.shiftStart ?? null,
    shiftEnd: extras?.shiftEnd ?? null,
  };
}

export function fullName(row: { firstName: string; lastName: string }): string {
  return `${row.firstName} ${row.lastName}`;
}
