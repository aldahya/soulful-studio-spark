import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings, SCHOOL_LOGOS, GROUP_LOGO } from '@/lib/school';
import {
  LayoutDashboard, Users, GraduationCap, UserCog, ClipboardList,
  ScanLine, FileBarChart, Settings, LogOut, Menu, X, FileSignature,
  Shield, HelpCircle, Bell, QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GeminiChat } from '@/components/GeminiChat';

// جميع صفحات المدير
const adminNav = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'لوحة التحكم',           key: 'dashboard',       end: true },
  { to: '/scan',            icon: ScanLine,        label: 'مسح الباركود',           key: 'scan'                     },
  { to: '/permissions',     icon: FileSignature,   label: 'الاستذانات',              key: 'permissions'              },
  { to: '/parent-requests', icon: Bell,            label: 'طلبات أولياء الأمور',    key: 'parent-requests'          },
  { to: '/school-qr',       icon: QrCode,          label: 'QR Code المدرسة',        key: 'school-qr'                },
  { to: '/students',        icon: Users,           label: 'الطلاب',                  key: 'students'                 },
  { to: '/classes',         icon: GraduationCap,   label: 'الفصول',                  key: 'classes'                  },
  { to: '/teachers',        icon: UserCog,         label: 'المعلمون',                key: 'teachers'                 },
  { to: '/attendance',      icon: ClipboardList,   label: 'سجل الحضور',             key: 'attendance'               },
  { to: '/reports',         icon: FileBarChart,    label: 'التقارير',                key: 'reports'                  },
  { to: '/roles',           icon: Shield,          label: 'الأدوار والصلاحيات',     key: 'roles'                    },
  { to: '/settings',        icon: Settings,        label: 'الإعدادات',               key: 'settings'                 },
  { to: '/how-it-works',    icon: HelpCircle,      label: 'كيف يعمل النظام؟',       key: 'how-it-works'             },
];

// الصفحات الافتراضية للمعلمين (بدون صلاحيات مخصصة)
const defaultTeacherPages = new Set([
  'dashboard', 'scan', 'permissions', 'parent-requests', 'attendance', 'reports', 'how-it-works',
]);

export function Layout() {
  const { isAdmin, signOut, user, school, allowedPages } = useAuth();
  const settings = useSchoolSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const schoolSlug = school?.slug ?? localStorage.getItem('school_slug') ?? 'dahya-boys';
  const schoolLogo = SCHOOL_LOGOS[schoolSlug] ?? GROUP_LOGO;
  const [pendingRequestCounts, setPendingRequestCounts] = useState({ permission: 0, administration: 0, pickup: 0 });
  const knownRequestIds = useRef(new Set<string>());
  const notifiedRequestIds = useRef(new Set<string>());
  const notificationBaselineReady = useRef(false);
  const notificationBaselineSchool = useRef<string | null>(null);
  const pendingRequestTotal = pendingRequestCounts.permission + pendingRequestCounts.administration + pendingRequestCounts.pickup;

  useEffect(() => {
    let active = true;
    if (notificationBaselineSchool.current !== schoolSlug) {
      notificationBaselineSchool.current = schoolSlug;
      notificationBaselineReady.current = false;
    }
    const notifyNewRequest = (request: {
      id: string;
      student_name: string;
      request_type: string | null;
      source: string | null;
      status: string;
    }) => {
      if (!isAdmin || request.status !== 'pending' || notifiedRequestIds.current.has(request.id)) return;
      knownRequestIds.current.add(request.id);
      notifiedRequestIds.current.add(request.id);
      const isPickup = request.request_type === 'pickup';
      const title = request.source === 'administration'
        ? 'استئذان الإدارة الجديد'
        : isPickup ? 'طلب استلام سريع جديد' : 'طلب استئذان جديد';
      toast.info(`${title}: ${request.student_name}`, {
        duration: 10000,
        action: {
          label: 'عرض الطلب',
          onClick: () => navigate(request.source === 'administration'
            ? '/parent-requests?source=administration'
            : '/parent-requests'),
        },
      });
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.type = 'sine';
        oscillator.frequency.value = isPickup ? 1100 : 880;
        gain.gain.setValueAtTime(0.35, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.45);
        window.setTimeout(() => { void context.close(); }, 600);
      } catch {
        // Some browsers block audio until the admin interacts with the page.
      }
    };

    const refreshCounts = async () => {
      const [permissionResult, administrationResult, pickupResult, requestsResult] = await Promise.all([
        (supabase as any).from('parent_requests')
          .select('id', { count: 'exact', head: true })
          .eq('school_slug', schoolSlug)
          .eq('status', 'pending')
          .neq('source', 'administration')
          .or('request_type.eq.permission,request_type.is.null'),
        (supabase as any).from('parent_requests')
          .select('id', { count: 'exact', head: true })
          .eq('school_slug', schoolSlug)
          .eq('status', 'pending')
          .eq('source', 'administration'),
        (supabase as any).from('parent_requests')
          .select('id', { count: 'exact', head: true })
          .eq('school_slug', schoolSlug)
          .eq('status', 'pending')
          .eq('request_type', 'pickup'),
        (supabase as any).from('parent_requests')
          .select('id, student_name, request_type, source, status')
          .eq('school_slug', schoolSlug)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (!active) return;
      if (!permissionResult.error && !administrationResult.error && !pickupResult.error) {
        setPendingRequestCounts({
          permission: permissionResult.count ?? 0,
          administration: administrationResult.count ?? 0,
          pickup: pickupResult.count ?? 0,
        });
      }
      if (requestsResult.error) {
        console.error('Could not refresh parent request notifications:', requestsResult.error);
        return;
      }

      const pendingRequests = (requestsResult.data ?? []) as Array<{
        id: string;
        student_name: string;
        request_type: string | null;
        source: string | null;
        status: string;
      }>;
      if (!notificationBaselineReady.current) {
        pendingRequests.forEach((request) => knownRequestIds.current.add(request.id));
        notificationBaselineReady.current = true;
        return;
      }

      pendingRequests.reverse().forEach((request) => {
        if (knownRequestIds.current.has(request.id)) return;
        knownRequestIds.current.add(request.id);
        notifyNewRequest(request);
      });
    };

    void refreshCounts();
    const channel = (supabase as any)
      .channel(`admin-parent-requests-${schoolSlug}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'parent_requests',
        filter: `school_slug=eq.${schoolSlug}`,
      }, (payload: any) => {
        void refreshCounts();
        if (payload.eventType !== 'INSERT' || !isAdmin) return;
        notifyNewRequest(payload.new as {
          id: string;
          student_name: string;
          request_type: string | null;
          source: string | null;
          status: string;
        });
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') void refreshCounts();
      });
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshCounts();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const refreshTimer = window.setInterval(() => void refreshCounts(), 15_000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void (supabase as any).removeChannel(channel);
    };
  }, [isAdmin, navigate, schoolSlug]);

  // حساب الصفحات المرئية
  const nav = isAdmin
    ? adminNav
    : adminNav.filter((item) => {
        if (allowedPages !== null) {
          // صلاحيات مخصصة — عرض ما في القائمة فقط + لوحة التحكم دائماً
          return item.key === 'dashboard' || allowedPages.includes(item.key);
        }
        // الافتراضي للمعلم
        return defaultTeacherPages.has(item.key);
      });

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-gradient-soft">
      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border/40 bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <img src={schoolLogo} alt="شعار المدرسة" className="h-9 w-9 object-contain" />
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
          <img src={schoolLogo} alt="شعار المدرسة" className="h-12 w-12 object-contain" />
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
              end={(item as any).end}
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
              {item.key === 'parent-requests' && pendingRequestTotal > 0 && (
                <span
                  className="mr-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold leading-none text-white"
                  aria-label={`${pendingRequestTotal} طلبات معلقة`}
                >
                  {pendingRequestTotal > 99 ? '99+' : pendingRequestTotal}
                </span>
              )}
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

      {/* Gemini AI floating chat */}
      <GeminiChat />
    </div>
  );
}
