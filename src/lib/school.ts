import logo from '@/assets/school-logo.png';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const SCHOOL_LOGO = logo;

export interface SchoolSettings {
  id: string;
  school_name: string;
  subtitle: string;
  address: string | null;
  phone: string | null;
}

export function useSchoolSettings() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  useEffect(() => {
    supabase.from('school_settings').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) setSettings(data as SchoolSettings);
    });
  }, []);

  return settings;
}
