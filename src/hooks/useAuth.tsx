import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Stage } from '@/lib/i18n';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isAdmin: boolean;
  isTeacher: boolean;
  teacherId: string | null;
  teacherStage: Stage | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherStage, setTeacherStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setTimeout(() => fetchProfile(newSession.user.id), 0);
      } else {
        setRoles([]); setTeacherId(null); setTeacherStage(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) fetchProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const [r, t] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('teachers').select('id, stage').eq('user_id', userId).maybeSingle(),
    ]);
    setRoles((r.data ?? []).map((x) => x.role as AppRole));
    setTeacherId(t.data?.id ?? null);
    setTeacherStage((t.data?.stage as Stage) ?? null);
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRoles([]); setTeacherId(null); setTeacherStage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        isAdmin: roles.includes('admin'),
        isTeacher: roles.includes('teacher'),
        teacherId,
        teacherStage,
        loading,
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
