-- Surface legacy staff-issued pending permissions in the administration queue.
-- Approved, used, and returned permissions are intentionally left unchanged.
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
  student_id,
  permission_id,
  created_at
)
SELECT
  sch.slug,
  st.full_name,
  st.student_number,
  st.parent_phone,
  p.reason,
  TO_CHAR(p.issued_at AT TIME ZONE 'Asia/Riyadh', 'HH24:MI'),
  p.notes,
  'pending',
  'permission',
  'administration',
  st.id,
  p.id,
  p.issued_at
FROM public.permissions p
JOIN public.students st ON st.id = p.student_id
JOIN public.schools sch ON sch.id = st.school_id
WHERE p.status = 'pending'
  AND NOT EXISTS (
    SELECT 1
    FROM public.parent_requests existing
    WHERE existing.permission_id = p.id
       OR (
         existing.source = 'administration'
         AND existing.student_id = st.id
         AND existing.school_slug = sch.slug
         AND existing.status = 'pending'
       )
  )
ON CONFLICT DO NOTHING;
