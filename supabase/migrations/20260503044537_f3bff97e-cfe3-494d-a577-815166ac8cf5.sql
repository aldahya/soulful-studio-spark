
-- 1) Students: restrict SELECT to admins + teachers of matching stage
DROP POLICY IF EXISTS "Authenticated read students" ON public.students;
CREATE POLICY "Staff read students"
ON public.students FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR stage = public.current_user_teacher_stage()
);

-- 2) Teachers: restrict SELECT to admins + own record
DROP POLICY IF EXISTS "Authenticated read teachers" ON public.teachers;
CREATE POLICY "Admins or self read teachers"
ON public.teachers FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR user_id = auth.uid()
);

-- 3) Attendance records: restrict SELECT to admins + teachers of student's stage
DROP POLICY IF EXISTS "Authenticated read attendance" ON public.attendance_records;
CREATE POLICY "Staff read attendance"
ON public.attendance_records FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = attendance_records.student_id
      AND s.stage = public.current_user_teacher_stage()
  )
);

-- 4) Permissions: restrict SELECT to admins + teachers of student's stage
DROP POLICY IF EXISTS "Authenticated read permissions" ON public.permissions;
CREATE POLICY "Staff read permissions"
ON public.permissions FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = permissions.student_id
      AND s.stage = public.current_user_teacher_stage()
  )
);

-- 5) Permissions UPDATE: add stage ownership check
DROP POLICY IF EXISTS "Staff update permissions" ON public.permissions;
CREATE POLICY "Staff update permissions"
ON public.permissions FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'teacher'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = permissions.student_id
        AND s.stage = public.current_user_teacher_stage()
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'teacher'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = permissions.student_id
        AND s.stage = public.current_user_teacher_stage()
    )
  )
);

-- 6) Permission logs: restrict SELECT to admins + teachers of student's stage
DROP POLICY IF EXISTS "Authenticated read permission logs" ON public.permission_logs;
CREATE POLICY "Staff read permission logs"
ON public.permission_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.permissions p
    JOIN public.students s ON s.id = p.student_id
    WHERE p.id = permission_logs.permission_id
      AND s.stage = public.current_user_teacher_stage()
  )
);

-- 7) Tighten EXECUTE on internal trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.students_set_barcode() FROM PUBLIC, anon, authenticated;
