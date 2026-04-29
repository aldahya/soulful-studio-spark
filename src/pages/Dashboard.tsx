import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Users, GraduationCap, UserCog, ClipboardCheck, TrendingUp } from 'lucide-react';
import { useSchoolSettings } from '@/lib/school';
import { todayISO, formatDate } from '@/lib/i18n';

interface Stats {
  students: number;
  classes: number;
  teachers: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
}

export default function Dashboard() {
  const settings = useSchoolSettings();
  const [stats, setStats] = useState<Stats>({ students: 0, classes: 0, teachers: 0, presentToday: 0, absentToday: 0, lateToday: 0 });

  useEffect(() => {
    document.title = 'لوحة التحكم | نظام الضاحية الذكي';
    loadStats();
  }, []);

  async function loadStats() {
    const today = todayISO();
    const [s, c, t, att] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('teachers').select('id', { count: 'exact', head: true }),
      supabase.from('attendance_records').select('status').eq('date', today),
    ]);
    const records = att.data ?? [];
    setStats({
      students: s.count ?? 0,
      classes: c.count ?? 0,
      teachers: t.count ?? 0,
      presentToday: records.filter((r: any) => r.status === 'present').length,
      lateToday: records.filter((r: any) => r.status === 'late').length,
      absentToday: records.filter((r: any) => r.status === 'absent').length,
    });
  }

  const cards = [
    { label: 'الطلاب', value: stats.students, icon: Users, gradient: 'from-primary to-primary-glow' },
    { label: 'الفصول', value: stats.classes, icon: GraduationCap, gradient: 'from-accent to-warning' },
    { label: 'المعلمون', value: stats.teachers, icon: UserCog, gradient: 'from-primary-glow to-success' },
    { label: 'الحضور اليوم', value: stats.presentToday, icon: ClipboardCheck, gradient: 'from-success to-primary-glow' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">{formatDate(new Date())}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          أهلاً بك في <span className="text-gradient-primary">{settings?.school_name ?? 'لوحة التحكم'}</span>
        </h1>
        <p className="mt-2 text-muted-foreground">نظرة عامة على إحصائيات المدرسة لهذا اليوم.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="overflow-hidden border-border/40 p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
                <p className="mt-2 text-4xl font-extrabold tracking-tight">{c.value}</p>
              </div>
              <div className={`rounded-xl bg-gradient-to-br ${c.gradient} p-3 text-primary-foreground shadow-soft`}>
                <c.icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2 text-success">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold">حاضر اليوم</h3>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-success">{stats.presentToday}</p>
        </Card>
        <Card className="p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2 text-warning">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="font-bold">متأخر اليوم</h3>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-warning">{stats.lateToday}</p>
        </Card>
        <Card className="p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="font-bold">غائب اليوم</h3>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-destructive">{stats.absentToday}</p>
        </Card>
      </section>
    </div>
  );
}
