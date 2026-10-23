--
-- PostgreSQL database dump
--


-- Dumped from database version 15.16 (Debian 15.16-0+deb12u1)
-- Dumped by pg_dump version 15.16 (Debian 15.16-0+deb12u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid,
    title text NOT NULL,
    body text NOT NULL,
    kind text DEFAULT 'INFO'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: db_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.db_backups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename text NOT NULL,
    kind text DEFAULT 'MANUAL'::text NOT NULL,
    record_counts jsonb,
    data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sorumlu_hemsire text,
    hemsire_unvan text,
    saglik_bakim_muduru text,
    saglik_bakim_unvan text,
    bashekim text,
    bashekim_unvan text,
    manager_name text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: duty_columns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.duty_columns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    key text NOT NULL,
    service text NOT NULL,
    shift_label text NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    staff_group text DEFAULT 'SAGLIK'::text NOT NULL
);


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    holiday_date date NOT NULL,
    name text NOT NULL
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnel_id uuid NOT NULL,
    leave_type text DEFAULT 'YILLIK'::text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_count real DEFAULT 1 NOT NULL,
    reason text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    requested_by text,
    decided_by text,
    decided_at timestamp with time zone,
    decision_note text,
    approval_stage text DEFAULT 'HEMSIRE'::text NOT NULL,
    stage_hemsire_by text,
    stage_hemsire_at timestamp with time zone,
    stage_hemsire_note text,
    stage_mudur_by text,
    stage_mudur_at timestamp with time zone,
    stage_mudur_note text,
    stage_bashekim_by text,
    stage_bashekim_at timestamp with time zone,
    stage_bashekim_note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    full_name text,
    tc_no text,
    personnel_type text DEFAULT 'MEMUR'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    department_id uuid,
    title text,
    phone text,
    email text,
    emergency_contact text,
    address text,
    start_date date,
    notes text,
    annual_leave_balance real DEFAULT 20,
    sick_leave_balance real DEFAULT 30,
    unpaid_leave_balance real DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    avatar_data text,
    avatar_mime text,
    avatar_updated_at timestamp with time zone,
    staff_group text DEFAULT 'SAGLIK'::text NOT NULL
);


--
-- Name: personnel_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel_departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnel_id uuid NOT NULL,
    department_id uuid NOT NULL
);


--
-- Name: shift_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    schedule_date date NOT NULL,
    personnel_id uuid NOT NULL,
    shift_slot text DEFAULT 'CUSTOM'::text NOT NULL,
    shift_label text,
    start_time text,
    end_time text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    column_key text
);


--
-- Name: shift_swap_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_swap_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    requester_shift_id uuid,
    target_personnel_id uuid,
    target_shift_id uuid,
    swap_date date NOT NULL,
    reason text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: shift_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid,
    name text NOT NULL,
    shift_count integer DEFAULT 2 NOT NULL,
    slots jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: timesheet_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timesheet_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnel_id uuid NOT NULL,
    entry_date date NOT NULL,
    shift_type text DEFAULT 'MANUAL'::text NOT NULL,
    hours_worked real DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: weekly_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    personnel_id uuid NOT NULL,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    week_index integer NOT NULL,
    worked real,
    night real,
    extra real,
    holiday real
);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: db_backups db_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.db_backups
    ADD CONSTRAINT db_backups_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: duty_columns duty_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_columns
    ADD CONSTRAINT duty_columns_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_holiday_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_holiday_date_unique UNIQUE (holiday_date);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: personnel_departments personnel_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_departments
    ADD CONSTRAINT personnel_departments_pkey PRIMARY KEY (id);


--
-- Name: personnel personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_pkey PRIMARY KEY (id);


--
-- Name: shift_schedules shift_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_schedules
    ADD CONSTRAINT shift_schedules_pkey PRIMARY KEY (id);


--
-- Name: shift_swap_requests shift_swap_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_pkey PRIMARY KEY (id);


--
-- Name: shift_templates shift_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_pkey PRIMARY KEY (id);


--
-- Name: timesheet_entries timesheet_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheet_entries
    ADD CONSTRAINT timesheet_entries_pkey PRIMARY KEY (id);


--
-- Name: weekly_overrides weekly_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_overrides
    ADD CONSTRAINT weekly_overrides_pkey PRIMARY KEY (id);


--
-- Name: dc_dept_period_key_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX dc_dept_period_key_uniq ON public.duty_columns USING btree (department_id, period_year, period_month, key);


--
-- Name: pd_personnel_dept_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pd_personnel_dept_uniq ON public.personnel_departments USING btree (personnel_id, department_id);


--
-- Name: ts_personnel_date_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ts_personnel_date_uniq ON public.timesheet_entries USING btree (personnel_id, entry_date);


--
-- Name: wo_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX wo_uniq ON public.weekly_overrides USING btree (personnel_id, period_year, period_month, week_index);


--
-- Name: announcements announcements_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: duty_columns duty_columns_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_columns
    ADD CONSTRAINT duty_columns_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_personnel_id_personnel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_personnel_id_personnel_id_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: personnel personnel_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: personnel_departments personnel_departments_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_departments
    ADD CONSTRAINT personnel_departments_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: personnel_departments personnel_departments_personnel_id_personnel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_departments
    ADD CONSTRAINT personnel_departments_personnel_id_personnel_id_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: shift_schedules shift_schedules_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_schedules
    ADD CONSTRAINT shift_schedules_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: shift_schedules shift_schedules_personnel_id_personnel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_schedules
    ADD CONSTRAINT shift_schedules_personnel_id_personnel_id_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: shift_swap_requests shift_swap_requests_requester_id_personnel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_requester_id_personnel_id_fk FOREIGN KEY (requester_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: shift_swap_requests shift_swap_requests_requester_shift_id_shift_schedules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_requester_shift_id_shift_schedules_id_fk FOREIGN KEY (requester_shift_id) REFERENCES public.shift_schedules(id) ON DELETE SET NULL;


--
-- Name: shift_swap_requests shift_swap_requests_target_personnel_id_personnel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_target_personnel_id_personnel_id_fk FOREIGN KEY (target_personnel_id) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: shift_swap_requests shift_swap_requests_target_shift_id_shift_schedules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_target_shift_id_shift_schedules_id_fk FOREIGN KEY (target_shift_id) REFERENCES public.shift_schedules(id) ON DELETE SET NULL;


--
-- Name: shift_templates shift_templates_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: timesheet_entries timesheet_entries_personnel_id_personnel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheet_entries
    ADD CONSTRAINT timesheet_entries_personnel_id_personnel_id_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: weekly_overrides weekly_overrides_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_overrides
    ADD CONSTRAINT weekly_overrides_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: weekly_overrides weekly_overrides_personnel_id_personnel_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_overrides
    ADD CONSTRAINT weekly_overrides_personnel_id_personnel_id_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



-- Personel26 Ayarlar ve aktarım güncellemesi

CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY DEFAULT 'global', data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text NOT NULL,
  description text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.schema_versions (
  id text PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS staff_group text NOT NULL DEFAULT 'SAGLIK';
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS avatar_data text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS avatar_mime text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz;
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS column_key text;
ALTER TABLE public.duty_columns ADD COLUMN IF NOT EXISTS staff_group text NOT NULL DEFAULT 'SAGLIK';
INSERT INTO public.schema_versions (id) VALUES ('2026-01-settings-import') ON CONFLICT (id) DO NOTHING;
