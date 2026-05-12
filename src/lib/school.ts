// src/lib/school.ts — النسخة المحدّثة لدعم متعدد المدارس
// انسخ هذا الملف وضعه في: src/lib/school.ts

import logo from '@/assets/school-logo.png';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const SCHOOL_LOGO = logo;

export interface SchoolSettings {
  id: string;
  school_id: string;
  school_name: string;
  subtitle: string;
  address: string | null;
  phone: string | null;
  late_after_time: string;
  duplicate_window_seconds: number;
  duplicate_protection_enabled: boolean;
  permission_window_minutes: number;
}

export const DEFAULT_SETTINGS: Pick<
  SchoolSettings,
  'late_after_time' | 'duplicate_window_seconds' | 'duplicate_protection_enabled' | 'permission_window_minutes'
> = {
  late_after_time: '07:30:00',
  duplicate_window_seconds: 20,
  duplicate_protection_enabled: true,
  permission_window_minutes: 5,
};

/**
 * يجلب إعدادات المدرسة الخاصة بالمستخدم الحالي عبر RLS
 * لا يحتاج تمرير school_id — الـ RLS يفلتر تلقائياً
 */
export function useSchoolSettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('school_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as SchoolSettings);
      });
  }, [session]);

  return settings;
}

/**
 * مساعد لإضافة school_id عند إدراج سجلات جديدة
 * استخدمه في جميع insert() calls
 */
export function useSchoolId() {
  const { schoolId } = useAuth();
  return schoolId;
}
