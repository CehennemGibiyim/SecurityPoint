CREATE TABLE "access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"door_id" integer,
	"event_type" text NOT NULL,
	"result" text NOT NULL,
	"reason" text,
	"confidence" real,
	"liveness_score" real,
	"snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"kind" text DEFAULT 'INFO' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" text NOT NULL,
	"clock_in" timestamp with time zone,
	"clock_out" timestamp with time zone,
	"status" text DEFAULT 'absent' NOT NULL,
	"work_minutes" integer DEFAULT 0 NOT NULL,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_minutes" integer DEFAULT 0 NOT NULL,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"notes" text
);


CREATE TABLE "breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"attendance_id" integer,
	"type" text DEFAULT 'yemek' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_minutes" integer DEFAULT 0 NOT NULL
);


CREATE TABLE "cafeteria_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"meal_type" text DEFAULT 'ogle' NOT NULL,
	"work_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "db_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"kind" text DEFAULT 'MANUAL' NOT NULL,
	"record_counts" jsonb,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sorumlu_hemsire" text,
	"hemsire_unvan" text,
	"saglik_bakim_muduru" text,
	"saglik_bakim_unvan" text,
	"bashekim" text,
	"bashekim_unvan" text,
	"manager_name" text,
	"created_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "door_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"door_id" integer NOT NULL,
	"days_of_week" jsonb NOT NULL,
	"start_time" text DEFAULT '00:00' NOT NULL,
	"end_time" text DEFAULT '23:59' NOT NULL,
	"valid_from" text,
	"valid_to" text,
	"is_active" boolean DEFAULT true NOT NULL
);


CREATE TABLE "doors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"location" text NOT NULL,
	"type" text DEFAULT 'both' NOT NULL,
	"access_policy" text DEFAULT 'permission' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"description" text,
	"zone" text DEFAULT 'genel' NOT NULL,
	"anti_passback_enabled" boolean DEFAULT false NOT NULL,
	"max_occupancy" integer,
	"two_person_rule" boolean DEFAULT false NOT NULL
);


CREATE TABLE "duty_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"staff_group" text DEFAULT 'SAGLIK' NOT NULL,
	"key" text NOT NULL,
	"service" text NOT NULL,
	"shift_label" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_no" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"department_id" integer,
	"shift_id" integer,
	"title" text,
	"photo_url" text,
	"face_descriptor" jsonb,
	"face_enrolled_at" timestamp with time zone,
	"face_enrollment_metadata" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"hire_date" text,
	"card_no" text,
	"qr_token" text,
	"pin_code" text,
	"kvkk_consent_at" timestamp with time zone,
	"kvkk_consent_version" text,
	"is_blacklisted" boolean DEFAULT false NOT NULL,
	"blacklist_reason" text,
	"inside_zone" text,
	"annual_leave_quota" integer DEFAULT 14 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "face_departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"color" text DEFAULT '#22d3ee' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "face_holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"name" text NOT NULL,
	"is_half_day" boolean DEFAULT false NOT NULL
);


CREATE TABLE "face_leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"type" text DEFAULT 'yillik' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"days" integer DEFAULT 1 NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holiday_date" date NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "holidays_holiday_date_unique" UNIQUE("holiday_date")
);


CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personnel_id" uuid NOT NULL,
	"leave_type" text DEFAULT 'YILLIK' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_count" real DEFAULT 1 NOT NULL,
	"reason" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"requested_by" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"approval_stage" text DEFAULT 'HEMSIRE' NOT NULL,
	"stage_hemsire_by" text,
	"stage_hemsire_at" timestamp with time zone,
	"stage_hemsire_note" text,
	"stage_mudur_by" text,
	"stage_mudur_at" timestamp with time zone,
	"stage_mudur_note" text,
	"stage_bashekim_by" text,
	"stage_bashekim_at" timestamp with time zone,
	"stage_bashekim_note" text,
	"created_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "offline_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"door_id" integer,
	"payload" jsonb NOT NULL,
	"synced" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "personnel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"full_name" text,
	"tc_no" text,
	"personnel_type" text DEFAULT 'MEMUR' NOT NULL,
	"staff_group" text DEFAULT 'SAGLIK' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"department_id" uuid,
	"title" text,
	"phone" text,
	"email" text,
	"emergency_contact" text,
	"address" text,
	"start_date" date,
	"notes" text,
	"annual_leave_balance" real DEFAULT 20,
	"sick_leave_balance" real DEFAULT 30,
	"unpaid_leave_balance" real DEFAULT 0,
	"avatar_data" text,
	"avatar_mime" text,
	"avatar_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "personnel_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personnel_id" uuid NOT NULL,
	"department_id" uuid NOT NULL
);


CREATE TABLE "roll_call_marks" (
	"id" serial PRIMARY KEY NOT NULL,
	"roll_call_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"marked_safe" boolean DEFAULT false NOT NULL,
	"marked_at" timestamp with time zone
);


CREATE TABLE "roll_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'Acil Durum Yoklaması' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);


CREATE TABLE "schema_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "security_alarms" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"employee_id" integer,
	"door_id" integer,
	"message" text NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "shift_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"schedule_date" date NOT NULL,
	"personnel_id" uuid NOT NULL,
	"shift_slot" text DEFAULT 'CUSTOM' NOT NULL,
	"shift_label" text,
	"start_time" text,
	"end_time" text,
	"column_key" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "shift_swap_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"requester_shift_id" uuid,
	"target_personnel_id" uuid,
	"target_shift_id" uuid,
	"swap_date" date NOT NULL,
	"reason" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "shift_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid,
	"name" text NOT NULL,
	"shift_count" integer DEFAULT 2 NOT NULL,
	"slots" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"break_allowance_minutes" integer DEFAULT 60 NOT NULL,
	"late_tolerance_minutes" integer DEFAULT 10 NOT NULL,
	"color" text DEFAULT '#818cf8' NOT NULL
);


CREATE TABLE "timesheet_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"period" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_work_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_minutes" integer DEFAULT 0 NOT NULL,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "timesheet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personnel_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"shift_type" text DEFAULT 'MANUAL' NOT NULL,
	"hours_worked" real DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);


CREATE TABLE "visitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"company" text,
	"phone" text,
	"tc_last4" text,
	"host_employee_id" integer,
	"purpose" text,
	"qr_token" text NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'expected' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"checked_out_at" timestamp with time zone,
	"allowed_door_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE "weekly_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"personnel_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"week_index" integer NOT NULL,
	"worked" real,
	"night" real,
	"extra" real,
	"holiday" real
);


ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_door_id_doors_id_fk" FOREIGN KEY ("door_id") REFERENCES "public"."doors"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "breaks" ADD CONSTRAINT "breaks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "breaks" ADD CONSTRAINT "breaks_attendance_id_attendance_records_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance_records"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "cafeteria_logs" ADD CONSTRAINT "cafeteria_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "door_permissions" ADD CONSTRAINT "door_permissions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "door_permissions" ADD CONSTRAINT "door_permissions_door_id_doors_id_fk" FOREIGN KEY ("door_id") REFERENCES "public"."doors"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "duty_columns" ADD CONSTRAINT "duty_columns_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_face_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."face_departments"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "employees" ADD CONSTRAINT "employees_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "face_leave_requests" ADD CONSTRAINT "face_leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "personnel" ADD CONSTRAINT "personnel_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "personnel_departments" ADD CONSTRAINT "personnel_departments_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "personnel_departments" ADD CONSTRAINT "personnel_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "roll_call_marks" ADD CONSTRAINT "roll_call_marks_roll_call_id_roll_calls_id_fk" FOREIGN KEY ("roll_call_id") REFERENCES "public"."roll_calls"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "roll_call_marks" ADD CONSTRAINT "roll_call_marks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "security_alarms" ADD CONSTRAINT "security_alarms_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "security_alarms" ADD CONSTRAINT "security_alarms_door_id_doors_id_fk" FOREIGN KEY ("door_id") REFERENCES "public"."doors"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requester_id_personnel_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requester_shift_id_shift_schedules_id_fk" FOREIGN KEY ("requester_shift_id") REFERENCES "public"."shift_schedules"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_personnel_id_personnel_id_fk" FOREIGN KEY ("target_personnel_id") REFERENCES "public"."personnel"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_shift_id_shift_schedules_id_fk" FOREIGN KEY ("target_shift_id") REFERENCES "public"."shift_schedules"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "visitors" ADD CONSTRAINT "visitors_host_employee_id_employees_id_fk" FOREIGN KEY ("host_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "weekly_overrides" ADD CONSTRAINT "weekly_overrides_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "weekly_overrides" ADD CONSTRAINT "weekly_overrides_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "logs_created_idx" ON "access_logs" USING btree ("created_at");

CREATE INDEX "logs_employee_idx" ON "access_logs" USING btree ("employee_id");

CREATE UNIQUE INDEX "attendance_emp_date_idx" ON "attendance_records" USING btree ("employee_id","work_date");

CREATE INDEX "attendance_date_idx" ON "attendance_records" USING btree ("work_date");

CREATE INDEX "breaks_employee_idx" ON "breaks" USING btree ("employee_id");

CREATE INDEX "perm_employee_idx" ON "door_permissions" USING btree ("employee_id");

CREATE INDEX "perm_door_idx" ON "door_permissions" USING btree ("door_id");

CREATE UNIQUE INDEX "doors_code_idx" ON "doors" USING btree ("code");

CREATE UNIQUE INDEX "dc_dept_period_key_uniq" ON "duty_columns" USING btree ("department_id","period_year","period_month","key");

CREATE UNIQUE INDEX "employees_no_idx" ON "employees" USING btree ("employee_no");

CREATE INDEX "employees_dept_idx" ON "employees" USING btree ("department_id");

CREATE UNIQUE INDEX "face_departments_code_idx" ON "face_departments" USING btree ("code");

CREATE UNIQUE INDEX "pd_personnel_dept_uniq" ON "personnel_departments" USING btree ("personnel_id","department_id");

CREATE UNIQUE INDEX "ts_personnel_date_uniq" ON "timesheet_entries" USING btree ("personnel_id","entry_date");

CREATE UNIQUE INDEX "wo_uniq" ON "weekly_overrides" USING btree ("personnel_id","period_year","period_month","week_index");