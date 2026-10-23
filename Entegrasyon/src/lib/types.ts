export type AccessAction =
  | "auto"
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end"
  | "door_only";

export type BreakType = "yemek" | "cay" | "namaz" | "sigara" | "diger";

export type PresenceStatus = "present" | "break" | "left" | "absent" | "inactive";

export type FaceEnrollmentMeta = {
  livenessScore?: number;
  sampleCount?: number;
  posesCaptured?: string[];
  earBlinkDetected?: boolean;
  smileDetected?: boolean;
  antiSpoofVerified?: boolean;
  enrolledAt?: string;
};

export type EmployeePublic = {
  id: number;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  departmentId: number | null;
  shiftId: number | null;
  title: string | null;
  photoUrl: string | null;
  hasFace: boolean;
  faceEnrolledAt: string | null;
  faceEnrollmentMetadata?: FaceEnrollmentMeta | null;
  status: string;
  hireDate: string | null;
  cardNo?: string | null;
  qrToken?: string | null;
  kvkkConsentAt?: string | null;
  isBlacklisted?: boolean;
  insideZone?: string | null;
  annualLeaveQuota?: number;
  departmentName?: string | null;
  departmentColor?: string | null;
  shiftName?: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
};

export type DoorPublic = {
  id: number;
  name: string;
  code: string;
  location: string;
  type: string;
  accessPolicy: string;
  isActive: boolean;
  isLocked: boolean;
  imageUrl: string | null;
  description: string | null;
};

export const BREAK_LABELS: Record<BreakType, string> = {
  yemek: "Yemek",
  cay: "Çay / Kahve",
  namaz: "Namaz",
  sigara: "Kısa mola",
  diger: "Diğer",
};

export const ACTION_LABELS: Record<AccessAction, string> = {
  auto: "Otomatik",
  clock_in: "Giriş imzası",
  clock_out: "Çıkış imzası",
  break_start: "İstirahat başlat",
  break_end: "İstirahat bitir",
  door_only: "Sadece kapı",
};

export type AccessResponse = {
  ok: boolean;
  result: "granted" | "denied" | "cooldown";
  eventType: string;
  reason: string;
  message: string;
  doorUnlocked: boolean;
  confidence: number | null;
  matchDistance: number | null;
  livenessScore?: number | null;
  isSpoof?: boolean;
  employee: EmployeePublic | null;
  door: {
    id: number;
    name: string;
    code: string;
    location: string;
    type: string;
  } | null;
  attendance: {
    workDate: string;
    clockIn: string | null;
    clockOut: string | null;
    status: string;
    breakMinutes: number;
  } | null;
  at: string;
};

export const WEEKDAYS = [
  { id: 1, label: "Pzt" },
  { id: 2, label: "Sal" },
  { id: 3, label: "Çar" },
  { id: 4, label: "Per" },
  { id: 5, label: "Cum" },
  { id: 6, label: "Cmt" },
  { id: 7, label: "Paz" },
];
