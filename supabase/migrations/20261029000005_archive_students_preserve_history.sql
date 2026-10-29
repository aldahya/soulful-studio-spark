-- Archive students instead of physically deleting them, preserving their history.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS students_school_active_name_idx
  ON public.students (school_id, full_name)
  WHERE archived_at IS NULL;

-- Refuse hard deletion while historical records reference the student.
-- The UI archives students; these constraints protect history from direct deletes too.
ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_student_id_fkey;
ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;

ALTER TABLE public.permissions
  DROP CONSTRAINT IF EXISTS permissions_student_id_fkey;
ALTER TABLE public.permissions
  ADD CONSTRAINT permissions_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;

ALTER TABLE public.scan_events
  DROP CONSTRAINT IF EXISTS scan_events_student_id_fkey;
ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;
