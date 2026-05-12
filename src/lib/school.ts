// src/lib/school.ts — أدوات مساعدة للتعامل مع متعدد المدارس
import { useAuth } from '@/hooks/useAuth';

/** جلب school_id من سياق المصادقة */
export function useSchoolId(): string | null {
  const { schoolId } = useAuth();
  return schoolId ?? null;
}

/** خريطة لوجوهات المدارس */
export const SCHOOL_LOGOS: Record<string, string> = {
  'dahya-boys':  '/logos/dahya-boys.png',
  'dahya-girls': '/logos/dahya-girls.png',
  'ajyal':       '/logos/ajyal.png',
  'qanadeel':    '/logos/qanadeel.png',
};

/** لوجو مجموعة المالكي (افتراضي) */
export const GROUP_LOGO = '/logos/malki-group.png';

/** للتوافق مع الاستخدام القديم */
export const SCHOOL_LOGO = '/logos/malki-group.png';

/** بيانات ثابتة للمدارس */
const SCHOOL_META: Record<string, { school_name: string; subtitle: string; logo: string }> = {
  'dahya-boys': {
    school_name: 'مدارس الضاحية الأهلية',
    subtitle: 'للبنين',
    logo: '/logos/dahya-boys.png',
  },
  'dahya-girls': {
    school_name: 'مدارس الضاحية الأهلية',
    subtitle: 'للبنات',
    logo: '/logos/dahya-girls.png',
  },
  'ajyal': {
    school_name: 'مدارس أجيال المعالي الأهلية',
    subtitle: 'للبنين والبنات',
    logo: '/logos/ajyal.png',
  },
  'qanadeel': {
    school_name: 'مدارس قناديل الشرق الأهلية',
    subtitle: 'للبنين والبنات',
    logo: '/logos/qanadeel.png',
  },
};

/** Hook يرجع بيانات المدرسة بناءً على المستخدم الحالي */
export function useSchoolSettings() {
  const { school } = useAuth();
  const slug = school?.slug ?? localStorage.getItem('school_slug') ?? 'dahya-boys';
  return SCHOOL_META[slug] ?? SCHOOL_META['dahya-boys'];
}
