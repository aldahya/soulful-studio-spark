-- إضافة حقل allowed_pages لتخصيص الأقسام المرئية لكل معلم
-- null = استخدام الصفحات الافتراضية (مسح الباركود، الاستذانات، الحضور، التقارير...)
-- array = قائمة مخصصة من مفاتيح الصفحات التي يراها هذا الحساب فقط
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS allowed_pages text[] DEFAULT NULL;
