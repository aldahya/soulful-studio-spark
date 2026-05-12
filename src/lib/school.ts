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

  /** لوجو مجموعة المالكي */
  export const GROUP_LOGO = '/logos/malki-group.png';

  /** للتوافق مع الاستخدام القديم */
  export const SCHOOL_LOGO = '/logos/malki-group.png';
  