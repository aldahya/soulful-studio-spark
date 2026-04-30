import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_COLORS, STAGE_LABELS, formatDate, todayISO, type AttendanceStatus, type Stage, whatsAppLink, toWhatsAppNumber } from '@/lib/i18n';
import { Download, MessageCircle, Loader2, Send, LogOut } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useSchoolSettings } from '@/lib/school';

type EntryStatus = AttendanceStatus | 'permission';
const ENTRY_LABELS: Record<EntryStatus, string> = { ...STATUS_LABELS, permission: 'استذان' };

interface Entry {
  id: string;
  date: string;
  status: EntryStatus;
  student_id: string;
  student_name: string;
  student_number: string;
  parent_phone: string | null;
  stage: Stage;
  class_id: string | null;
  class_name: string | null;
  reason?: string | null;
  perm_status?: string | null;
}

interface ClassRow { id: string; name: string; stage: Stage }
interface StudentRow { id: string; full_name: string; stage: Stage; class_id: string | null }

export default function Reports() {
  const settings = useSchoolSettings();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | EntryStatus>('all');
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [monthlyMonth, setMonthlyMonth] = useState(todayISO().slice(0, 7));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = 'التقارير | نظام الضاحية';
    Promise.all([
      supabase.from('classes').select('id, name, stage').order('name'),
      supabase.from('students').select('id, full_name, stage, class_id').order('full_name').limit(2000),
    ]).then(([c, s]) => {
      setClasses((c.data ?? []) as ClassRow[]);
      setStudents((s.data ?? []) as StudentRow[]);
    });
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [att, perms] = await Promise.all([
      supabase.from('attendance_records')
        .select('id, status, date, students(id, full_name, student_number, parent_phone, stage, class_id, classes(name))')
        .gte('date', from).lte('date', to).order('date', { ascending: false }),
      supabase.from('permissions')
        .select('id, status, date, reason, students(id, full_name, student_number, parent_phone, stage, class_id, classes(name))')
        .gte('date', from).lte('date', to).order('date', { ascending: false }),
    ]);

    const a: Entry[] = ((att.data ?? []) as any[]).map((r) => ({
      id: 'a:' + r.id, date: r.date, status: r.status,
      student_id: r.students?.id, student_name: r.students?.full_name ?? '—',
      student_number: r.students?.student_number ?? '', parent_phone: r.students?.parent_phone ?? null,
      stage: r.students?.stage, class_id: r.students?.class_id ?? null,
      class_name: r.students?.classes?.name ?? null,
    }));
    const p: Entry[] = ((perms.data ?? []) as any[]).map((r) => ({
      id: 'p:' + r.id, date: r.date, status: 'permission',
      student_id: r.students?.id, student_name: r.students?.full_name ?? '—',
      student_number: r.students?.student_number ?? '', parent_phone: r.students?.parent_phone ?? null,
      stage: r.students?.stage, class_id: r.students?.class_id ?? null,
      class_name: r.students?.classes?.name ?? null,
      reason: r.reason, perm_status: r.status,
    }));
    setEntries([...a, ...p].sort((x, y) => y.date.localeCompare(x.date)));
    setLoading(false);
  }

  const filtered = useMemo(() => entries.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (stageFilter !== 'all' && e.stage !== stageFilter) return false;
    if (classFilter !== 'all' && (e.class_id ?? '') !== classFilter) return false;
    if (studentFilter !== 'all' && e.student_id !== studentFilter) return false;
    return true;
  }), [entries, statusFilter, stageFilter, classFilter, studentFilter]);

  function exportExcel() {
    const data = filtered.map((r) => ({
      'التاريخ': r.date,
      'الطالب': r.student_name,
      'رقم الطالب': r.student_number,
      'المرحلة': STAGE_LABELS[r.stage] ?? '',
      'الفصل': r.class_name ?? '',
      'الحالة': ENTRY_LABELS[r.status],
      'سبب الاستذان': r.reason ?? '',
      'هاتف ولي الأمر': r.parent_phone ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    (ws as any)['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير');
    XLSX.writeFile(wb, `تقرير_${from}_${to}.xlsx`);
    toast.success('تم تصدير الملف');
  }

  async function sendMonthlyReports() {
    setSending(true);
    try {
      const start = `${monthlyMonth}-01`;
      const endDate = new Date(start);
      endDate.setMonth(endDate.getMonth() + 1);
      const end = endDate.toISOString().slice(0, 10);

      const { data: studs } = await supabase.from('students').select('id, full_name, student_number, parent_phone').order('full_name').limit(2000);
      if (!studs || !studs.length) { toast.error('لا يوجد طلاب'); return; }

      const [{ data: records }, { data: perms }] = await Promise.all([
        supabase.from('attendance_records').select('student_id, status, date').gte('date', start).lt('date', end),
        supabase.from('permissions').select('student_id, date').gte('date', start).lt('date', end),
      ]);

      const stats = new Map<string, { present: number; late: number; absent: number; permission: number }>();
      (records ?? []).forEach((r: any) => {
        const s = stats.get(r.student_id) ?? { present: 0, late: 0, absent: 0, permission: 0 };
        s[r.status as AttendanceStatus]++; stats.set(r.student_id, s);
      });
      (perms ?? []).forEach((r: any) => {
        const s = stats.get(r.student_id) ?? { present: 0, late: 0, absent: 0, permission: 0 };
        s.permission++; stats.set(r.student_id, s);
      });

      const targets = studs.filter((s) => toWhatsAppNumber(s.parent_phone));
      if (!targets.length) { toast.error('لا يوجد أرقام أولياء أمور صالحة'); return; }

      const monthLabel = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' }).format(new Date(start));
      toast.info(`سيتم فتح ${targets.length} رابط واتساب`);

      for (const s of targets) {
        const st = stats.get(s.id) ?? { present: 0, late: 0, absent: 0, permission: 0 };
        const total = st.present + st.late + st.absent;
        const rate = total ? Math.round((st.present / total) * 100) : 0;
        const msg = [
          `السلام عليكم ولي أمر الطالب: ${s.full_name}`,
          `${settings?.school_name ?? 'مدارسنا'} — تقرير الحضور لشهر ${monthLabel}`,
          ``,
          `✅ حاضر: ${st.present}`,
          `⏱ متأخر: ${st.late}`,
          `❌ غائب: ${st.absent}`,
          `📝 استذان: ${st.permission}`,
          `📊 نسبة الحضور: ${rate}%`,
          ``, `شاكرين تعاونكم.`,
        ].join('\n');
        const link = whatsAppLink(s.parent_phone, msg);
        if (link) window.open(link, '_blank');
        await new Promise((r) => setTimeout(r, 400));
      }
      toast.success(`تم فتح ${targets.length} رسالة واتساب`);
    } finally { setSending(false); }
  }

  const visibleStudents = students.filter((s) => stageFilter === 'all' || s.stage === stageFilter)
    .filter((s) => classFilter === 'all' || (s.class_id ?? '') === classFilter);
  const visibleClasses = classes.filter((c) => stageFilter === 'all' || c.stage === stageFilter);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">التقارير</h1>
        <p className="mt-1 text-sm text-muted-foreground">تقارير الحضور والاستذان حسب المرحلة، الفصل، أو الطالب</p>
      </header>

      <Card className="p-5 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label className="text-xs">من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div className="space-y-1"><Label className="text-xs">إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <div className="space-y-1">
            <Label className="text-xs">الحالة</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="present">حاضر</SelectItem>
                <SelectItem value="late">متأخر</SelectItem>
                <SelectItem value="absent">غائب</SelectItem>
                <SelectItem value="permission">استذان</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">المرحلة</Label>
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v as any); setClassFilter('all'); setStudentFilter('all'); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {Object.entries(STAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">الفصل</Label>
            <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setStudentFilter('all'); }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {visibleClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">الطالب</Label>
            <Select value={studentFilter} onValueChange={setStudentFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {visibleStudents.slice(0, 500).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={load} className="bg-gradient-primary">تحديث</Button>
          <Button onClick={exportExcel} variant="outline" disabled={!filtered.length} className="gap-2">
            <Download className="h-4 w-4" /> تصدير Excel
          </Button>
        </div>
      </Card>

      <Card className="p-5 shadow-soft border-accent/30 bg-accent/5">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Send className="h-5 w-5 text-accent" /> التقارير الشهرية لأولياء الأمور</h2>
        <p className="text-xs text-muted-foreground mb-4">يفتح روابط واتساب جاهزة (wa.me) لكل ولي أمر برسالة مُلخَّصة لإحصائيات الشهر.</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">الشهر</Label>
            <Input type="month" value={monthlyMonth} onChange={(e) => setMonthlyMonth(e.target.value)} className="w-44" />
          </div>
          <Button onClick={sendMonthlyReports} disabled={sending} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            تجهيز روابط واتساب
          </Button>
        </div>
      </Card>

      <Card className="shadow-soft">
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>المرحلة</TableHead>
                <TableHead>الفصل</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تفاصيل</TableHead>
                <TableHead className="text-left">واتساب</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const wa = whatsAppLink(r.parent_phone, `إشعار: ${r.student_name} - ${ENTRY_LABELS[r.status]} بتاريخ ${formatDate(r.date)}`);
                const cls = r.status === 'permission'
                  ? 'bg-accent/10 text-accent border-accent/20'
                  : STATUS_COLORS[r.status as AttendanceStatus];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium">{r.student_name} <span className="font-mono text-xs text-muted-foreground">({r.student_number})</span></TableCell>
                    <TableCell>{STAGE_LABELS[r.stage] ?? '—'}</TableCell>
                    <TableCell>{r.class_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={cls} variant="outline">
                        {r.status === 'permission' && <LogOut className="h-3 w-3 ml-1 inline" />}
                        {ENTRY_LABELS[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.reason ?? '—'}</TableCell>
                    <TableCell>
                      {wa
                        ? <Button asChild variant="ghost" size="icon"><a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 text-success" /></a></Button>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
