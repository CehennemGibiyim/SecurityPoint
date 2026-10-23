import {
  pgTable,
  uuid,
  text,
  boolean,
  real,
  integer,
  date,
  timestamp,
  jsonb,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────
// 1. Personel26 — Resmi PostgreSQL Şeması (100% Orijinal Tablolar)
// ─────────────────────────────────────────────────────────────

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  sorumluHemsire: text("sorumlu_hemsire"),
  hemsireUnvan: text("hemsire_unvan"),
  saglikBakimMuduru: text("saglik_bakim_muduru"),
  saglikBakimUnvan: text("saglik_bakim_unvan"),
  bashekim: text("bashekim"),
  bashekimUnvan: text("bashekim_unvan"),
  managerName: text("manager_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const personnel = pgTable("personnel", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  fullName: text("full_name"),
  tcNo: text("tc_no"),
  personnelType: text("personnel_type").notNull().default("MEMUR"),
  staffGroup: text("staff_group").notNull().default("SAGLIK"),
  isActive: boolean("is_active").notNull().default(true),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  title: text("title"),
  phone: text("phone"),
  email: text("email"),
  emergencyContact: text("emergency_contact"),
  address: text("address"),
  startDate: date("start_date", { mode: "string" }),
  notes: text("notes"),
  annualLeaveBalance: real("annual_leave_balance").default(20),
  sickLeaveBalance: real("sick_leave_balance").default(30),
  unpaidLeaveBalance: real("unpaid_leave_balance").default(0),
  avatarData: text("avatar_data"),
  avatarMime: text("avatar_mime"),
  avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const personnelDepartments = pgTable(
  "personnel_departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personnelId: uuid("personnel_id")
      .notNull()
      .references(() => personnel.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("pd_personnel_dept_uniq").on(t.personnelId, t.departmentId)],
);

export const holidays = pgTable("holidays", {
  id: uuid("id").defaultRandom().primaryKey(),
  holidayDate: date("holiday_date", { mode: "string" }).notNull().unique(),
  name: text("name").notNull(),
});

export const timesheetEntries = pgTable(
  "timesheet_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personnelId: uuid("personnel_id")
      .notNull()
      .references(() => personnel.id, { onDelete: "cascade" }),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    shiftType: text("shift_type").notNull().default("MANUAL"),
    hoursWorked: real("hours_worked").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("ts_personnel_date_uniq").on(t.personnelId, t.entryDate)],
);

export const shiftSchedules = pgTable("shift_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "cascade" }),
  scheduleDate: date("schedule_date", { mode: "string" }).notNull(),
  personnelId: uuid("personnel_id")
    .notNull()
    .references(() => personnel.id, { onDelete: "cascade" }),
  shiftSlot: text("shift_slot").notNull().default("CUSTOM"),
  shiftLabel: text("shift_label"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  columnKey: text("column_key"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const dutyColumns = pgTable(
  "duty_columns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    staffGroup: text("staff_group").notNull().default("SAGLIK"),
    key: text("key").notNull(),
    service: text("service").notNull(),
    shiftLabel: text("shift_label").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("dc_dept_period_key_uniq").on(t.departmentId, t.periodYear, t.periodMonth, t.key)],
);

export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  personnelId: uuid("personnel_id")
    .notNull()
    .references(() => personnel.id, { onDelete: "cascade" }),
  leaveType: text("leave_type").notNull().default("YILLIK"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  daysCount: real("days_count").notNull().default(1),
  reason: text("reason"),
  status: text("status").notNull().default("PENDING"),
  requestedBy: text("requested_by"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note"),
  approvalStage: text("approval_stage").notNull().default("HEMSIRE"),
  stageHemsireBy: text("stage_hemsire_by"),
  stageHemsireAt: timestamp("stage_hemsire_at", { withTimezone: true }),
  stageHemsireNote: text("stage_hemsire_note"),
  stageMudurBy: text("stage_mudur_by"),
  stageMudurAt: timestamp("stage_mudur_at", { withTimezone: true }),
  stageMudurNote: text("stage_mudur_note"),
  stageBashekimBy: text("stage_bashekim_by"),
  stageBashekimAt: timestamp("stage_bashekim_at", { withTimezone: true }),
  stageBashekimNote: text("stage_bashekim_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const shiftSwapRequests = pgTable("shift_swap_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => personnel.id, { onDelete: "cascade" }),
  requesterShiftId: uuid("requester_shift_id").references(() => shiftSchedules.id, { onDelete: "set null" }),
  targetPersonnelId: uuid("target_personnel_id").references(() => personnel.id, { onDelete: "set null" }),
  targetShiftId: uuid("target_shift_id").references(() => shiftSchedules.id, { onDelete: "set null" }),
  swapDate: date("swap_date", { mode: "string" }).notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("PENDING"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const shiftTemplates = pgTable("shift_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  shiftCount: integer("shift_count").notNull().default(2),
  slots: jsonb("slots")
    .notNull()
    .$type<{ service: string; shiftLabel: string; startTime: string; endTime: string }[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const weeklyOverrides = pgTable(
  "weekly_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    personnelId: uuid("personnel_id")
      .notNull()
      .references(() => personnel.id, { onDelete: "cascade" }),
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    weekIndex: integer("week_index").notNull(),
    worked: real("worked"),
    night: real("night"),
    extra: real("extra"),
    holiday: real("holiday"),
  },
  (t) => [uniqueIndex("wo_uniq").on(t.personnelId, t.periodYear, t.periodMonth, t.weekIndex)],
);

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("INFO"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("global"),
  data: jsonb("data").notNull().$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schemaVersions = pgTable("schema_versions", {
  id: text("id").primaryKey(),
  installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dbBackups = pgTable("db_backups", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  kind: text("kind").notNull().default("MANUAL"),
  recordCounts: jsonb("record_counts").$type<Record<string, number>>(),
  data: jsonb("data").$type<Record<string, unknown[]>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// 2. ORION FaceGate (Face) — Biyometrik PDKS & Kapı Kontrol Şeması
// ─────────────────────────────────────────────────────────────

export const faceDepartments = pgTable(
  "face_departments",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    color: text("color").notNull().default("#22d3ee"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("face_departments_code_idx").on(t.code)],
);

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  breakAllowanceMinutes: integer("break_allowance_minutes").notNull().default(60),
  lateToleranceMinutes: integer("late_tolerance_minutes").notNull().default(10),
  color: text("color").notNull().default("#818cf8"),
});

export const employees = pgTable(
  "employees",
  {
    id: serial("id").primaryKey(),
    employeeNo: text("employee_no").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    departmentId: integer("department_id").references(() => faceDepartments.id, {
      onDelete: "set null",
    }),
    shiftId: integer("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    title: text("title"),
    photoUrl: text("photo_url"),
    faceDescriptor: jsonb("face_descriptor").$type<number[]>(),
    faceEnrolledAt: timestamp("face_enrolled_at", { withTimezone: true }),
    faceEnrollmentMetadata: jsonb("face_enrollment_metadata").$type<{
      livenessScore?: number;
      sampleCount?: number;
      posesCaptured?: string[];
      earBlinkDetected?: boolean;
      smileDetected?: boolean;
      antiSpoofVerified?: boolean;
      enrolledAt?: string;
    }>(),
    status: text("status").notNull().default("active"),
    hireDate: text("hire_date"),
    cardNo: text("card_no"),
    qrToken: text("qr_token"),
    pinCode: text("pin_code"),
    kvkkConsentAt: timestamp("kvkk_consent_at", { withTimezone: true }),
    kvkkConsentVersion: text("kvkk_consent_version"),
    isBlacklisted: boolean("is_blacklisted").notNull().default(false),
    blacklistReason: text("blacklist_reason"),
    insideZone: text("inside_zone"),
    annualLeaveQuota: integer("annual_leave_quota").notNull().default(14),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("employees_no_idx").on(t.employeeNo),
    index("employees_dept_idx").on(t.departmentId),
  ],
);

export const doors = pgTable(
  "doors",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    location: text("location").notNull(),
    type: text("type").notNull().default("both"),
    accessPolicy: text("access_policy").notNull().default("permission"),
    isActive: boolean("is_active").notNull().default(true),
    isLocked: boolean("is_locked").notNull().default(true),
    imageUrl: text("image_url"),
    description: text("description"),
    zone: text("zone").notNull().default("genel"),
    antiPassbackEnabled: boolean("anti_passback_enabled").notNull().default(false),
    maxOccupancy: integer("max_occupancy"),
    twoPersonRule: boolean("two_person_rule").notNull().default(false),
  },
  (t) => [uniqueIndex("doors_code_idx").on(t.code)],
);

export const doorPermissions = pgTable(
  "door_permissions",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    doorId: integer("door_id")
      .notNull()
      .references(() => doors.id, { onDelete: "cascade" }),
    daysOfWeek: jsonb("days_of_week").$type<number[]>().notNull(),
    startTime: text("start_time").notNull().default("00:00"),
    endTime: text("end_time").notNull().default("23:59"),
    validFrom: text("valid_from"),
    validTo: text("valid_to"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    index("perm_employee_idx").on(t.employeeId),
    index("perm_door_idx").on(t.doorId),
  ],
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    workDate: text("work_date").notNull(),
    clockIn: timestamp("clock_in", { withTimezone: true }),
    clockOut: timestamp("clock_out", { withTimezone: true }),
    status: text("status").notNull().default("absent"),
    workMinutes: integer("work_minutes").notNull().default(0),
    breakMinutes: integer("break_minutes").notNull().default(0),
    overtimeMinutes: integer("overtime_minutes").notNull().default(0),
    lateMinutes: integer("late_minutes").notNull().default(0),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("attendance_emp_date_idx").on(t.employeeId, t.workDate),
    index("attendance_date_idx").on(t.workDate),
  ],
);

export const breaks = pgTable(
  "breaks",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    attendanceId: integer("attendance_id").references(() => attendanceRecords.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull().default("yemek"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes").notNull().default(0),
  },
  (t) => [index("breaks_employee_idx").on(t.employeeId)],
);

export const accessLogs = pgTable(
  "access_logs",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    doorId: integer("door_id").references(() => doors.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    result: text("result").notNull(),
    reason: text("reason"),
    confidence: real("confidence"),
    livenessScore: real("liveness_score"),
    snapshot: text("snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("logs_created_idx").on(t.createdAt),
    index("logs_employee_idx").on(t.employeeId),
  ],
);

export const faceLeaveRequests = pgTable("face_leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("yillik"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: integer("days").notNull().default(1),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  company: text("company"),
  phone: text("phone"),
  tcLast4: text("tc_last4"),
  hostEmployeeId: integer("host_employee_id").references(() => employees.id, { onDelete: "set null" }),
  purpose: text("purpose"),
  qrToken: text("qr_token").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("expected"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
  allowedDoorIds: jsonb("allowed_door_ids").$type<number[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const faceHolidays = pgTable("face_holidays", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  name: text("name").notNull(),
  isHalfDay: boolean("is_half_day").notNull().default(false),
});

export const cafeteriaLogs = pgTable("cafeteria_logs", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  mealType: text("meal_type").notNull().default("ogle"),
  workDate: text("work_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const securityAlarms = pgTable("security_alarms", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("medium"),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "set null" }),
  doorId: integer("door_id").references(() => doors.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rollCalls = pgTable("roll_calls", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("Acil Durum Yoklaması"),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const rollCallMarks = pgTable("roll_call_marks", {
  id: serial("id").primaryKey(),
  rollCallId: integer("roll_call_id")
    .notNull()
    .references(() => rollCalls.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  markedSafe: boolean("marked_safe").notNull().default(false),
  markedAt: timestamp("marked_at", { withTimezone: true }),
});

export const timesheetApprovals = pgTable("timesheet_approvals", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  status: text("status").notNull().default("draft"),
  totalWorkMinutes: integer("total_work_minutes").notNull().default(0),
  overtimeMinutes: integer("overtime_minutes").notNull().default(0),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const offlineQueue = pgTable("offline_queue", {
  id: serial("id").primaryKey(),
  doorId: integer("door_id"),
  payload: jsonb("payload").notNull(),
  synced: boolean("synced").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
