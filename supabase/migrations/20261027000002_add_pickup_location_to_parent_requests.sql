-- إضافة مكان الخروج لطلبات الاستلام السريع
ALTER TABLE public.parent_requests
  ADD COLUMN IF NOT EXISTS pickup_location text;
