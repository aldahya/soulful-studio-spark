-- 1) Prevent duplicate daily attendance
ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_student_date_unique UNIQUE (student_id, date);

-- 2) Permissions table (استذان)
CREATE TYPE public.permission_status AS ENUM ('pending', 'used', 'returned');

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  issued_by UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL DEFAULT 'خروج من المدرسة',
  notes TEXT,
  status public.permission_status NOT NULL DEFAULT 'pending',
  used_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX idx_permissions_date ON public.permissions(date);
CREATE INDEX idx_permissions_student ON public.permissions(student_id);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff insert permissions"
  ON public.permissions FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
    AND issued_by = auth.uid()
  );

CREATE POLICY "Staff update permissions"
  ON public.permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins delete permissions"
  ON public.permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Permission logs
CREATE TABLE public.permission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_permission_logs_permission ON public.permission_logs(permission_id);

ALTER TABLE public.permission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read permission logs"
  ON public.permission_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert permission logs"
  ON public.permission_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Admins delete permission logs"
  ON public.permission_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));