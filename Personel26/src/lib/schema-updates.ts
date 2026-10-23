export const SCHEMA_VERSION = "2026.01";
export function schemaUpdateStatements() {
  // Sabit DDL içinde SQL fonksiyon gövdeleri veya noktalı virgüllü değerler yoktur.
  return SCHEMA_UPDATE_SQL.split(";").map(statement => statement.trim()).filter(Boolean);
}
// Sabit ve idempotent DDL. Kullanıcı tarafından yüklenen SQL asla çalıştırılmaz.
export const SCHEMA_UPDATE_SQL = `
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
`;
