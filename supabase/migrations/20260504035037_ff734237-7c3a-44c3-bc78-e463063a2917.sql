-- 1) Lock down sensitive helper functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_teacher_stage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_teacher_stage() TO authenticated;

-- 2) Scan events log table
CREATE TABLE IF NOT EXISTS public.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('duplicate','permission_issued','permission_used','permission_returned')),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  actor_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_events_created_at_idx ON public.scan_events (created_at DESC);
CREATE INDEX IF NOT EXISTS scan_events_kind_idx ON public.scan_events (kind);

ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff insert scan events"
ON public.scan_events FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Staff read scan events"
ON public.scan_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    student_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = scan_events.student_id
        AND s.stage = public.current_user_teacher_stage()
    )
  )
);
