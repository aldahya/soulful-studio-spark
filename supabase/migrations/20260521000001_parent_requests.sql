-- جدول طلبات الاستئذان من أولياء الأمور (عبر QR Code)
-- ملاحظة: يستخدم school_slug بدلاً من school_id لأن جدول schools قد لا يكون موجوداً
CREATE TABLE IF NOT EXISTS public.parent_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_slug text NOT NULL DEFAULT 'dahya-boys',
  student_name text NOT NULL,
  student_number text NOT NULL,
  reason text NOT NULL,
  requested_exit_time text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approver_name text,
  announced boolean NOT NULL DEFAULT false,
  announced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parent_requests_school_slug_idx ON public.parent_requests (school_slug);
CREATE INDEX IF NOT EXISTS parent_requests_status_idx ON public.parent_requests (status);
CREATE INDEX IF NOT EXISTS parent_requests_created_at_idx ON public.parent_requests (created_at DESC);

ALTER TABLE public.parent_requests ENABLE ROW LEVEL SECURITY;

-- السماح لأي شخص (بما فيهم anon) بإدراج طلب — ولي الأمر لا يحتاج حساب
CREATE POLICY "Anyone can insert parent_requests"
ON public.parent_requests FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- الموظفون المسجلون فقط يمكنهم رؤية الطلبات
CREATE POLICY "Staff can select parent_requests"
ON public.parent_requests FOR SELECT TO authenticated
USING (true);

-- الموظفون فقط يمكنهم تحديث الطلبات
CREATE POLICY "Staff can update parent_requests"
ON public.parent_requests FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- trigger لتحديث updated_at تلقائياً
CREATE TRIGGER parent_requests_updated_at
  BEFORE UPDATE ON public.parent_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
