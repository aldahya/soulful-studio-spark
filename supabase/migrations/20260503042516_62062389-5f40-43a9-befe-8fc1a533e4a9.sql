ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS late_after_time time NOT NULL DEFAULT '07:30:00',
  ADD COLUMN IF NOT EXISTS duplicate_window_seconds integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS duplicate_protection_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permission_window_minutes integer NOT NULL DEFAULT 5;