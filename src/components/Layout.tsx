import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings, SCHOOL_LOGO } from '@/lib/school';
import {
  LayoutDashboard, Users, GraduationCap, UserCog, ClipboardList,
  ScanLine, FileBarChart, Settings, LogOut, Menu, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const adminNav = [
  { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم', end: true },
  { to: '/scan', icon: ScanLine, label: 'مسح الباركود' },
  { to: '/students', icon: Users, label: 'الطلاب' },
  { to: '/classes', icon: GraduationCap, label: 'الفصول' },
  { to: '/teachers', icon: UserCog, label: 'المعلمون' },
  { to: '/attendance', icon: ClipboardList, label: 'سجل الحضور' },
  { to: '/reports', icon: FileBarChart, label: 'التقارير' },
  { to: '/settings', icon: Settings, label: 'الإعدادات' },
];

const teacherNav = [
  { to: '/scan', icon: ScanLine, label: 'مسح الباركود' },
  { to: '/attendance', icon: ClipboardList, label: 'سجل الحضور' },
];

export function Layout() {
  const { isAdmin, signOut, user } = useAuth();
  const settings = useSchoolSettings();
  const nav = isAdmin ? adminNav : teacherNav;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-gradient-soft">
      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border/40 bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <img src={SCHOOL_LOGO} alt="شعار المدرسة" className="h-9 w-9 object-contain" />
          <span className="text-sm font-bold text-primary">{settings?.school_name ?? 'الضاحية'}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-20 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-elevated transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-6">
          <img src={SCHOOL_LOGO} alt="شعار المدرسة" className="h-12 w-12 object-contain" />
          <div className="flex-1">
            <h1 className="text-base font-bold leading-tight text-sidebar-foreground">
              {settings?.school_name ?? 'مدارس الضاحية'}
            </h1>
            <p className="text-xs text-sidebar-foreground/70">{settings?.subtitle ?? ''}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-soft'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 px-2 text-xs text-sidebar-foreground/60">
            {user?.email}
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-5 w-5" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-10 bg-foreground/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 overflow-x-hidden pt-16 lg:pt-0">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
