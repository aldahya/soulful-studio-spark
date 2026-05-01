import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { session, loading, isAdmin, isTeacher, profileLoaded } = useAuth();
  const location = useLocation();

  if (loading || (session && !profileLoaded)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-soft">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  if (!isAdmin && !isTeacher) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">لا توجد صلاحيات</h1>
        <p className="text-muted-foreground">حسابك لم يُمنح بعد دور المدير أو المعلم. يرجى التواصل مع الإدارة.</p>
      </div>
    );
  }

  return <>{children}</>;
}
