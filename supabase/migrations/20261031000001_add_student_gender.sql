-- Store student gender for accurate Arabic voice announcements.
-- Existing students remain NULL until their gender is explicitly recorded.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS gender text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_gender_check'
      AND conrelid = 'public.students'::regclass
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female'));
  END IF;
END
$$;

COMMENT ON COLUMN public.students.gender IS
  'Student gender used to generate grammatically correct voice announcements; NULL means unknown.';
