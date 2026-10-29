-- Administrative permission requests are parent-request records until approved.
-- Existing parent requests retain their parent-origin classification.
ALTER TABLE public.parent_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'parent',
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS permission_id uuid REFERENCES public.permissions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parent_requests_source_check'
      AND conrelid = 'public.parent_requests'::regclass
  ) THEN
    ALTER TABLE public.parent_requests
      ADD CONSTRAINT parent_requests_source_check
      CHECK (source IN ('parent', 'administration'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS parent_requests_student_id_idx
  ON public.parent_requests (student_id);

CREATE UNIQUE INDEX IF NOT EXISTS parent_requests_one_pending_admin_per_student
  ON public.parent_requests (school_slug, student_id)
  WHERE source = 'administration' AND status = 'pending' AND student_id IS NOT NULL;

COMMENT ON COLUMN public.parent_requests.source IS
  'Identifies whether the request was created by a parent or school administration.';
COMMENT ON COLUMN public.parent_requests.student_id IS
  'Links a request to a known student when the student was selected in the app.';
COMMENT ON COLUMN public.parent_requests.permission_id IS
  'The permission record created or completed when an administrative request is approved.';

CREATE OR REPLACE FUNCTION public.create_admin_permission_request(
  p_student_id uuid,
  p_school_slug text,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_school_id uuid;
  v_student public.students%ROWTYPE;
  v_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لإرسال استئذان الإدارة'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.id
    INTO v_school_id
  FROM public.schools s
  JOIN public.user_roles ur ON ur.school_id = s.id
  WHERE s.slug = p_school_slug
    AND ur.user_id = auth.uid()
    AND ur.role IN ('admin'::public.app_role, 'teacher'::public.app_role)
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'الحساب غير مخول لإرسال طلبات لهذه المدرسة'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id
    AND s.school_id = v_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطالب غير موجود في المدرسة المرتبطة بالحساب'
      USING ERRCODE = '42501';
  END IF;

  IF public.has_role(auth.uid(), 'teacher'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT EXISTS (
       SELECT 1
       FROM public.teachers t
       WHERE t.user_id = auth.uid()
         AND (t.all_stages IS TRUE OR t.stage = v_student.stage)
     ) THEN
    RAISE EXCEPTION 'الطالب خارج المرحلة المسموح بها لهذا الحساب'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.parent_requests (
    school_slug,
    student_name,
    student_number,
    parent_phone,
    reason,
    requested_exit_time,
    notes,
    status,
    request_type,
    source,
    student_id
  )
  VALUES (
    p_school_slug,
    v_student.full_name,
    v_student.student_number,
    v_student.parent_phone,
    COALESCE(NULLIF(BTRIM(p_reason), ''), 'خروج من المدرسة'),
    TO_CHAR(now() AT TIME ZONE 'Asia/Riyadh', 'HH24:MI'),
    NULLIF(BTRIM(p_notes), ''),
    'pending',
    'permission',
    'administration',
    v_student.id
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_admin_permission_request(
  p_request_id uuid
)
RETURNS SETOF public.parent_requests
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.parent_requests%ROWTYPE;
  v_school_id uuid;
  v_teacher_id uuid;
  v_permission_id uuid;
  v_permission_status public.permission_status;
  v_exit_at timestamptz := now();
  v_permission_date date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لاعتماد الطلب'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_request
  FROM public.parent_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.source <> 'administration' OR v_request.status <> 'pending'
     OR v_request.student_id IS NULL THEN
    RAISE EXCEPTION 'طلب الإدارة غير موجود أو لم يعد قيد المراجعة';
  END IF;

  SELECT s.id
    INTO v_school_id
  FROM public.schools s
  JOIN public.user_roles ur ON ur.school_id = s.id
  WHERE s.slug = v_request.school_slug
    AND ur.user_id = auth.uid()
    AND ur.role IN ('admin'::public.app_role, 'teacher'::public.app_role)
  LIMIT 1;

  IF v_school_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = v_request.student_id
      AND s.school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'الحساب غير مخول لاعتماد طلبات هذه المدرسة'
      USING ERRCODE = '42501';
  END IF;

  IF public.has_role(auth.uid(), 'teacher'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT EXISTS (
       SELECT 1
       FROM public.students s
       JOIN public.teachers t ON t.user_id = auth.uid()
       WHERE s.id = v_request.student_id
         AND (t.all_stages IS TRUE OR t.stage = s.stage)
     ) THEN
    RAISE EXCEPTION 'الطالب خارج المرحلة المسموح بها لهذا الحساب'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, status
    INTO v_permission_id, v_permission_status
  FROM public.permissions
  WHERE student_id = v_request.student_id
    AND date = v_permission_date
  FOR UPDATE;

  SELECT id INTO v_teacher_id
  FROM public.teachers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_permission_id IS NULL THEN
    INSERT INTO public.permissions (
      student_id, teacher_id, issued_by, date, reason, notes, status, used_at
    )
    VALUES (
      v_request.student_id,
      v_teacher_id,
      auth.uid(),
      v_permission_date,
      v_request.reason,
      v_request.notes,
      'used',
      v_exit_at
    )
    RETURNING id INTO v_permission_id;

    INSERT INTO public.permission_logs (permission_id, action, actor_id)
    VALUES (v_permission_id, 'used', auth.uid());
  ELSIF v_permission_status = 'pending' THEN
    UPDATE public.permissions
    SET status = 'used',
        used_at = v_exit_at,
        reason = v_request.reason,
        notes = COALESCE(v_request.notes, notes)
    WHERE id = v_permission_id;

    INSERT INTO public.permission_logs (permission_id, action, actor_id)
    VALUES (v_permission_id, 'used', auth.uid());
  ELSIF v_permission_status = 'used' THEN
    RAISE EXCEPTION 'تم تسجيل خروج الطالب بالفعل اليوم';
  ELSE
    RAISE EXCEPTION 'يوجد استئذان منتهٍ للطالب اليوم ولا يمكن اعتماد طلب خروج آخر';
  END IF;

  UPDATE public.parent_requests
  SET status = 'approved',
      permission_id = v_permission_id,
      approved_by = auth.uid(),
      approved_at = v_exit_at,
      approver_name = COALESCE(auth.jwt() ->> 'email', 'موظف')
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN NEXT v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_admin_permission_request(
  p_request_id uuid
)
RETURNS SETOF public.parent_requests
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.parent_requests%ROWTYPE;
  v_school_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لرفض الطلب'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_request
  FROM public.parent_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.source <> 'administration' OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'طلب الإدارة غير موجود أو لم يعد قيد المراجعة';
  END IF;

  SELECT s.id
    INTO v_school_id
  FROM public.schools s
  JOIN public.user_roles ur ON ur.school_id = s.id
  WHERE s.slug = v_request.school_slug
    AND ur.user_id = auth.uid()
    AND ur.role IN ('admin'::public.app_role, 'teacher'::public.app_role)
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'الحساب غير مخول لرفض طلبات هذه المدرسة'
      USING ERRCODE = '42501';
  END IF;

  IF public.has_role(auth.uid(), 'teacher'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT EXISTS (
       SELECT 1
       FROM public.students s
       JOIN public.teachers t ON t.user_id = auth.uid()
       WHERE s.id = v_request.student_id
         AND s.school_id = v_school_id
         AND (t.all_stages IS TRUE OR t.stage = s.stage)
     ) THEN
    RAISE EXCEPTION 'الطالب خارج المرحلة المسموح بها لهذا الحساب'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.parent_requests
  SET status = 'rejected'
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN NEXT v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_permission_request(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_admin_permission_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_admin_permission_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_permission_request(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_admin_permission_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_admin_permission_request(uuid) TO authenticated;
