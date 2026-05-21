-- إضافة حقل رقم جوال ولي الأمر لجدول parent_requests
ALTER TABLE public.parent_requests
  ADD COLUMN IF NOT EXISTS parent_phone text;
