-- إضافة حقول المستلم وصلة القرابة ونوع الطلب لجدول parent_requests
ALTER TABLE public.parent_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'permission' CHECK (request_type IN ('permission','pickup')),
  ADD COLUMN IF NOT EXISTS receiver_id_number text,
  ADD COLUMN IF NOT EXISTS receiver_relationship text;
