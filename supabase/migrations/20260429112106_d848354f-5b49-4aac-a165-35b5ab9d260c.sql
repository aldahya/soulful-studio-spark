-- ===== Enums =====
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');
CREATE TYPE public.school_stage AS ENUM ('primary', 'intermediate', 'secondary');
CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent');

-- ===== updated_at trigger function =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ===== profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== user_roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ===== has_role security definer =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ===== auto-create profile on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== classes =====
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stage public.school_stage NOT NULL,
  grade TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER classes_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== students =====
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  stage public.school_stage NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  parent_phone TEXT,
  notes TEXT,
  barcode TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE INDEX students_class_idx ON public.students(class_id);
CREATE INDEX students_stage_idx ON public.students(stage);
CREATE TRIGGER students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== teachers (linked to auth.users) =====
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  stage public.school_stage NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER teachers_updated_at BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== attendance_records =====
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  status public.attendance_status NOT NULL,
  date DATE NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX attendance_date_idx ON public.attendance_records(date);
CREATE INDEX attendance_teacher_idx ON public.attendance_records(teacher_id);
CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== school_settings (single row) =====
CREATE TABLE public.school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL DEFAULT 'مدارس الضاحية الأهلية للبنين',
  subtitle TEXT NOT NULL DEFAULT 'إحدى مدارس المالكي التعليمية',
  address TEXT,
  phone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER school_settings_updated_at BEFORE UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.school_settings (school_name, subtitle) VALUES (DEFAULT, DEFAULT);

-- ============================================
-- RLS POLICIES
-- ============================================

-- profiles: each user reads/updates own; admins read all
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- user_roles: users see own roles; admins manage all
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- classes: all authenticated read; admins write
CREATE POLICY "Authenticated read classes" ON public.classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert classes" ON public.classes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update classes" ON public.classes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete classes" ON public.classes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- students: all authenticated read; admins write
CREATE POLICY "Authenticated read students" ON public.students
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert students" ON public.students
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update students" ON public.students
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete students" ON public.students
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- teachers: all authenticated read; admins write
CREATE POLICY "Authenticated read teachers" ON public.teachers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert teachers" ON public.teachers
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update teachers" ON public.teachers
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete teachers" ON public.teachers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- attendance: all authenticated read; teachers/admins insert; teachers update/delete own; admins all
CREATE POLICY "Authenticated read attendance" ON public.attendance_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert attendance" ON public.attendance_records
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')
  );
CREATE POLICY "Admins or recording teacher update attendance" ON public.attendance_records
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins or recording teacher delete attendance" ON public.attendance_records
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

-- school_settings: all authenticated read; admins update
CREATE POLICY "Authenticated read settings" ON public.school_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.school_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));