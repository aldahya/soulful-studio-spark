// src/hooks/useAuth.tsx — النسخة المحدّثة لدعم متعدد المدارس
// انسخ هذا الملف وضعه في: src/hooks/useAuth.tsx

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Stage } from '@/lib/i18n';

// ─── الثوابت للمدارس ──────────────────────────────────────────
export const SCHOOL_COLORS: Record<string, string> = {
  teal:   '#0d9488',
  rose:   '#e11d48',
  amber:  '#d97706',
  violet: '#7c3aed',
};

export interface SchoolInfo {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  color: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isAdmin: boolean;
  isTeacher: boolean;
  teacherId: string | null;
  teacherStage: Stage | null;
  schoolId: string | null;
  school: SchoolInfo | null;
  loading: boolean;
  profileLoaded: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherStage, setTeacherStage] = useState<Stage | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setProfileLoaded(false);
        setTimeout(() => fetchProfile(newSession.user.id).finally(() => setProfileLoaded(true)), 0);
      } else {
        resetProfile();
        setProfileLoaded(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => { setProfileLoaded(true); setLoading(false); });
      } else {
        resetProfile();
        setProfileLoaded(true);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  function resetProfile() {
    setRoles([]);
    setTeacherId(null);
    setTeacherStage(null);
    setSchoolId(null);
    setSchool(null);
  }

  async function fetchProfile(userId: string) {
    const [rolesRes, teacherRes] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role, school_id, schools(id, slug, name, subtitle, color)')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('teachers')
        .select('id, stage')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    // الأدوار
    if (rolesRes.data) {
      const roleRow = rolesRes.data as any;
      setRoles([roleRow.role as AppRole]);
      setSchoolId(roleRow.school_id ?? null);
      if (roleRow.schools) {
        setSchool({
          id:       roleRow.schools.id,
          slug:     roleRow.schools.slug,
          name:     roleRow.schools.name,
          subtitle: roleRow.schools.subtitle,
          color:    roleRow.schools.color,
        });
      }
    } else {
      setRoles([]);
      setSchoolId(null);
      setSchool(null);
    }

    // المعلم
    setTeacherId(teacherRes.data?.id ?? null);
    setTeacherStage((teacherRes.data?.stage as Stage) ?? null);
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    resetProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        isAdmin:      roles.includes('admin'),
        isTeacher:    roles.includes('teacher'),
        teacherId,
        teacherStage,
        schoolId,
        school,
        loading,
        profileLoaded,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
