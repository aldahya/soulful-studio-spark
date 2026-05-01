-- Add precise check-in time to attendance_records (permissions table already has used_at/returned_at)
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ;

-- Backfill from recorded_at for existing rows
UPDATE public.attendance_records SET check_in_time = recorded_at WHERE check_in_time IS NULL;

-- Helpful index for daily lookups
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance_records(student_id, date);
CREATE INDEX IF NOT EXISTS idx_permissions_student_date ON public.permissions(student_id, date);