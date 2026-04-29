import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, GraduationCap, UserCog, ClipboardCheck, TrendingUp, ScanLine,
  FileSignature, FileBarChart, ArrowLeft, Sparkles, CalendarDays, Loader2,
} from 'lucide-react';
import { useSchoolSettings } from '@/lib/school';
import { todayISO, formatDate, STATUS_LABELS } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Stats {
  students: number;
  classes: number;
  teachers: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  permissionsToday: number;
}

interface DayPoint { day: string; حاضر: number; متأخر: number; غائب: number }
interface RecentRow { id: string; name: string; status: string; time: string }

export default function Dashboard() {
  const settings = useSchoolSettings();
  const { isAdmin, user } = useAuth();
  const [stats, setStats] = useState<Stats>({ students: 0, classes: 0, teachers: 0, presentToday: 0, absentToday: 0, lateToday: 0, permissionsToday: 0 });
  const [trend, setTrend] = useState<DayPoint[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    document.title = 'لوحة التحكم | نظام الضاحية الذكي';
    loadAll();
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  async function loadAll() {
    setLoading(true);
    const today = todayISO();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startISO = start.toISOString().slice(0, 10);

    const [s, c, t, todayAtt, weekAtt, perms, recentAtt] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('teachers').select('id', { count: 'exact', head: true }),
      supabase.from('attendance_records').select('status').eq('date', today),
      supabase.from('attendance_records').select('status, date').gte('date', startISO).lte('date', today),
      supabase.from('permissions').select('id', { count: 'exact', head: true }).eq('date', today),
      supabase
        .from('attendance_records')
        .select('id, status, recorded_at, students(full_name)')
        .eq('date', today)
        .order('recorded_at', { ascending: false })
        .limit(8),
    ]);

    const tRecords = todayAtt.data ?? [];
    setStats({
      students: s.count ?? 0,
      classes: c.count ?? 0,
      teachers: t.count ?? 0,
      presentToday: tRecords.filter((r: any) => r.status === 'present').length,
      lateToday: tRecords.filter((r: any) => r.status === 'late').length,
      absentToday: tRecords.filter((r: any) => r.status === 'absent').length,
      permissionsToday: perms.count ?? 0,
    });

    // Build 7-day trend
    const map = new Map<string, DayPoint>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { weekday: 'short' }).format(d);
      map.set(key, { day: label, حاضر: 0, متأخر: 0, غائب: 0 });
    }
    (weekAtt.data ?? []).forEach((r: any) => {
      const point = map.get(r.date);
      if (!point) return;
      if (r.status === 'present') point['حاضر']++;
      else if (r.status === 'late') point['متأخر']++;
      else if (r.status === 'absent') point['غائب']++;
    });
    setTrend(Array.from(map.values()));

    setRecent(
      (recentAtt.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.students?.full_name ?? '—',
        status: r.status,
        time: new Date(r.recorded_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      })),
    );
    setLoading(false);
  }

  const totalToday = stats.presentToday + stats.lateToday + stats.absentToday;
  const attendanceRate = stats.students ? Math.round(((stats.presentToday + stats.lateToday) / stats.students) * 100) : 0;

  const pieData = useMemo(() => ([
    { name: 'حاضر', value: stats.presentToday, color: 'hsl(var(--success))' },
    { name: 'متأخر', value: stats.lateToday, color: 'hsl(var(--warning))' },
    { name: 'غائب', value: stats.absentToday, color: 'hsl(var(--destructive))' },
  ]), [stats]);

  const cards = [
    { label: 'إجمالي الطلاب', value: stats.students, icon: Users, tone: 'from-brand to-primary', sub: `${stats.classes} فصل` },
    { label: 'حضور اليوم', value: stats.presentToday, icon: ClipboardCheck, tone: 'from-success to-brand', sub: `${attendanceRate}% من إجمالي الطلاب` },
    { label: 'استذانات اليوم', value: stats.permissionsToday, icon: FileSignature, tone: 'from-accent to-warning', sub: 'خروج مُصرَّح' },
    { label: 'الكادر التعليمي', value: stats.teachers, icon: UserCog, tone: 'from-primary to-brand', sub: 'معلم نشط' },
  ];

  const greet = (() => {
    const h = now.getHours();
    if (h < 12) return 'صباح الخير';
    if (h < 18) return 'مساء الخير';
    return 'مساء النور';
  })();

  const quickActions = isAdmin
    ? [
        { to: '/scan', icon: ScanLine, label: 'مسح حضور', tone: 'bg-brand/15 text-primary ring-brand/30' },
        { to: '/permissions', icon: FileSignature, label: 'إصدار استذان', tone: 'bg-accent/15 text-accent-foreground ring-accent/30' },
        { to: '/students', icon: Users, label: 'الطلاب', tone: 'bg-primary/10 text-primary ring-primary/20' },
        { to: '/reports', icon: FileBarChart, label: 'التقارير', tone: 'bg-success/10 text-success ring-success/20' },
      ]
    : [
        { to: '/scan', icon: ScanLine, label: 'مسح حضور', tone: 'bg-brand/15 text-primary ring-brand/30' },
        { to: '/permissions', icon: FileSignature, label: 'إصدار استذان', tone: 'bg-accent/15 text-accent-foreground ring-accent/30' },
        { to: '/reports', icon: FileBarChart, label: 'التقارير', tone: 'bg-success/10 text-success ring-success/20' },
      ];

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-hero p-6 text-white shadow-elevated sm:p-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl animate-blob" />
        <div className="absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-brand/30 blur-3xl animate-blob" style={{ animationDelay: '4s' }} />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> {greet}
            </span>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              {greet}، <span className="text-gradient-brand">{user?.user_metadata?.full_name || user?.email?.split('@')[0]}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              نظرة شاملة على حضور وأنشطة <strong>{settings?.school_name ?? 'مدرستك'}</strong> ليوم {formatDate(new Date())}.
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-2">
            <div className="rounded-2xl glass-dark px-5 py-3 text-right shadow-soft">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(new Date())}
              </div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums">
                {now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        {/* Attendance rate bar */}
        <div className="relative mt-6 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">نسبة الحضور اليوم</span>
            <span className="text-2xl font-extrabold tabular-nums">{attendanceRate}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
            <div
              className="relative h-full rounded-full bg-gradient-to-l from-brand to-success transition-all duration-1000"
              style={{ width: `${attendanceRate}%` }}
            >
              <div className="absolute inset-0 animate-shimmer rounded-full" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/70">
            <span>✅ {stats.presentToday} حاضر</span>
            <span>⏱ {stats.lateToday} متأخر</span>
            <span>❌ {stats.absentToday} غائب</span>
            <span>📋 {totalToday} مُسجَّل من {stats.students}</span>
          </div>
        </div>
      </header>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card
            key={c.label}
            className="group relative overflow-hidden border-border/40 p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-brand"
          >
            <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${c.tone} opacity-15 blur-2xl transition-all group-hover:opacity-30`} />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
                <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight">
                  {loading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : c.value.toLocaleString('ar-SA')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
              </div>
              <div className={`rounded-xl bg-gradient-to-br ${c.tone} p-3 text-white shadow-soft transition-transform group-hover:scale-110`}>
                <c.icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        ))}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-muted-foreground">إجراءات سريعة</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => (
            <Link key={a.to} to={a.to}>
              <Card className={`group flex items-center gap-3 border-border/40 p-4 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-soft ${a.tone}`}>
                <div className="rounded-lg bg-card p-2.5 shadow-sm">
                  <a.icon className="h-5 w-5" />
                </div>
                <span className="flex-1 font-bold">{a.label}</span>
                <ArrowLeft className="h-4 w-4 opacity-50 transition-transform group-hover:-translate-x-1 group-hover:opacity-100" />
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 shadow-soft lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold">اتجاه الحضور — آخر 7 أيام</h3>
              <p className="text-xs text-muted-foreground">عدد الطلاب حسب الحالة لكل يوم</p>
            </div>
            <Badge variant="outline" className="bg-brand/10 text-primary border-brand/30">
              <TrendingUp className="ml-1 h-3 w-3" /> أسبوعي
            </Badge>
          </div>
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    fontFamily: 'Cairo',
                  }}
                />
                <Area type="monotone" dataKey="حاضر" stroke="hsl(var(--success))" strokeWidth={2.5} fill="url(#gPresent)" />
                <Area type="monotone" dataKey="متأخر" stroke="hsl(var(--warning))" strokeWidth={2.5} fill="url(#gLate)" />
                <Area type="monotone" dataKey="غائب" stroke="hsl(var(--destructive))" strokeWidth={2.5} fill="url(#gAbsent)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 shadow-soft">
          <h3 className="mb-1 font-bold">توزيع حضور اليوم</h3>
          <p className="text-xs text-muted-foreground">إجمالي {totalToday} مُسجَّل</p>
          {totalToday === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">لا توجد بيانات بعد</div>
          ) : (
            <div className="mt-2 h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontFamily: 'Cairo',
                    }}
                  />
                  <Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </section>

      {/* Recent activity */}
      <section>
        <Card className="p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold">آخر عمليات الحضور</h3>
              <p className="text-xs text-muted-foreground">أحدث 8 سجلات لهذا اليوم</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/attendance">عرض الكل</Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recent.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">لا توجد سجلات لهذا اليوم بعد</div>
            )}
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-primary text-xs font-bold">
                    {r.name.charAt(0)}
                  </div>
                  <span className="truncate font-medium">{r.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={
                      r.status === 'present'
                        ? 'bg-success/10 text-success border-success/20'
                        : r.status === 'late'
                          ? 'bg-warning/10 text-warning border-warning/20'
                          : 'bg-destructive/10 text-destructive border-destructive/20'
                    }
                  >
                    {STATUS_LABELS[r.status as keyof typeof STATUS_LABELS]}
                  </Badge>
                  <span className="tabular-nums text-xs text-muted-foreground">{r.time}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
