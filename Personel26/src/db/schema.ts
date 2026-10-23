import {
  pgTable, uuid, text, boolean, real, integer, date, timestamp, jsonb, uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────
// Personel26 — PostgreSQL şeması (Supabase modeli bire bir taşındı)
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
  personnelType: text("personnel_type").notNull().default("MEMUR"), // ISCI | MEMUR | HEMSIRE
  // Personel grubu: SAGLIK (hemşire/sağlık) | DESTEK (temizlik/destek) — ayrı çizelge + puantaj
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
  // Profil fotoğrafı: istemcide 256px JPEG'e küçültülüp base64 olarak saklanır.
  avatarData: text("avatar_data"),
  avatarMime: text("avatar_mime"),
  avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const personnelDepartments = pgTable("personnel_departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  personnelId: uuid("personnel_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
}, (t) => [uniqueIndex("pd_personnel_dept_uniq").on(t.personnelId, t.departmentId)]);

export const holidays = pgTable("holidays", {
  id: uuid("id").defaultRandom().primaryKey(),
  holidayDate: date("holiday_date", { mode: "string" }).notNull().unique(),
  name: text("name").notNull(),
});

export const timesheetEntries = pgTable("timesheet_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  personnelId: uuid("personnel_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  shiftType: text("shift_type").notNull().default("MANUAL"),
  hoursWorked: real("hours_worked").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [uniqueIndex("ts_personnel_date_uniq").on(t.personnelId, t.entryDate)]);

export const shiftSchedules = pgTable("shift_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  scheduleDate: date("schedule_date", { mode: "string" }).notNull(),
  personnelId: uuid("personnel_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
  shiftSlot: text("shift_slot").notNull().default("CUSTOM"),
  shiftLabel: text("shift_label"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  // Nöbet çizelgesi ızgarası: kaydın ait olduğu sütunun kararlı anahtarı.
  columnKey: text("column_key"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Nöbet sütunları: servisin çizelge ızgarasındaki "Hizmet (Saat)" sütunları.
// key, yeniden adlandırma sonrası bile kayıtlarla bağı koruyan kararlı kimliktir.
export const dutyColumns = pgTable("duty_columns", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  // Dönem: her servisin her ay için ayrı sütun düzeni vardır (geçmiş aylar korunur).
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  // Sütunun ait olduğu personel grubu (her grubun kendi nöbet çizelgesi vardır)
  staffGroup: text("staff_group").notNull().default("SAGLIK"),
  key: text("key").notNull(),
  service: text("service").notNull(),
  shiftLabel: text("shift_label").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [uniqueIndex("dc_dept_period_key_uniq").on(t.departmentId, t.periodYear, t.periodMonth, t.key)]);

export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  personnelId: uuid("personnel_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
  leaveType: text("leave_type").notNull().default("YILLIK"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  daysCount: real("days_count").notNull().default(1),
  reason: text("reason"),
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED | CANCELLED
  requestedBy: text("requested_by"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note"),
  approvalStage: text("approval_stage").notNull().default("HEMSIRE"), // HEMSIRE | MUDUR | BASHEKIM | DONE
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
  requesterId: uuid("requester_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
  requesterShiftId: uuid("requester_shift_id").references(() => shiftSchedules.id, { onDelete: "set null" }),
  targetPersonnelId: uuid("target_personnel_id").references(() => personnel.id, { onDelete: "set null" }),
  targetShiftId: uuid("target_shift_id").references(() => shiftSchedules.id, { onDelete: "set null" }),
  swapDate: date("swap_date", { mode: "string" }).notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED | CANCELLED
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const shiftTemplates = pgTable("shift_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  shiftCount: integer("shift_count").notNull().default(2),
  // Vardiya şablonu = kaydedilmiş sütun düzeni: [{service, shiftLabel, startTime, endTime}]
  slots: jsonb("slots").notNull().$type<{ service: string; shiftLabel: string; startTime: string; endTime: string }[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const weeklyOverrides = pgTable("weekly_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  personnelId: uuid("personnel_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  weekIndex: integer("week_index").notNull(),
  worked: real("worked"),
  night: real("night"),
  extra: real("extra"),
  holiday: real("holiday"),
}, (t) => [uniqueIndex("wo_uniq").on(t.personnelId, t.periodYear, t.periodMonth, t.weekIndex)]);

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("INFO"), // INFO | WARNING | URGENT
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
  kind: text("kind").notNull().default("MANUAL"), // AUTO | MANUAL | SAFETY
  recordCounts: jsonb("record_counts").$type<Record<string, number>>(),
  data: jsonb("data").$type<Record<string, unknown[]>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
