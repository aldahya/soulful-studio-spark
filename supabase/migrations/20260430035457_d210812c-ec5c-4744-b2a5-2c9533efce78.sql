-- Helper: current authenticated user's teacher stage
CREATE OR REPLACE FUNCTION public.current_user_teacher_stage()
RETURNS public.school_stage
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT stage FROM public.teachers WHERE user_id = auth.uid() LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_teacher_stage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_teacher_stage() TO authenticated;

-- Restrict attendance INSERT for teachers to their own stage
DROP POLICY IF EXISTS "Staff insert attendance" ON public.attendance_records;
CREATE POLICY "Staff insert attendance"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'teacher')
      AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_id AND s.stage = public.current_user_teacher_stage()
      )
    )
  );

-- Restrict permission INSERT similarly
DROP POLICY IF EXISTS "Staff insert permissions" ON public.permissions;
CREATE POLICY "Staff insert permissions"
  ON public.permissions FOR INSERT TO authenticated
  WITH CHECK (
    issued_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        public.has_role(auth.uid(), 'teacher')
        AND EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.id = student_id AND s.stage = public.current_user_teacher_stage()
        )
      )
    )
  );

-- Auto-generate barcode if missing on insert
CREATE OR REPLACE FUNCTION public.students_set_barcode()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := 'ALD-' || COALESCE(NEW.student_number, replace(gen_random_uuid()::text, '-', ''));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.students_set_barcode() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_students_set_barcode ON public.students;
CREATE TRIGGER trg_students_set_barcode
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_set_barcode();

-- Ensure barcode unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_barcode_unique'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_barcode_unique UNIQUE (barcode);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_number_unique'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_number_unique UNIQUE (student_number);
  END IF;
END $$;