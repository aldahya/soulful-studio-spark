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
import { Download, MessageCircle, Loader2, Send, LogOut, FileText, User as UserIcon, UserX } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useSchoolSettings } from '@/lib/school';
import { useAuth } from '@/hooks/useAuth';
import { openReportPdf, type ReportRow } from '@/lib/reportPdf';
import { nowTimeLabel } from '@/lib/feedback';

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
  check_in_time?: string | null;
  exit_time?: string | null;
  return_time?: string | null;
}

interface ClassRow { id: string; name: string; stage: Stage }
interface StudentRow { id: string; full_name: string; stage: Stage; class_id: string | null; parent_phone: string | null }

export default function Reports() {
  const settings = useSchoolSettings();
  const { isAdmin, teacherStage } = useAuth();
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
  const [monthlyStudent, setMonthlyStudent] = useState<string>('all');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = 'التقارير | نظام الضاحية';
    Promise.all([
      supabase.from('classes').select('id, name, stage').order('name'),
      supabase.from('students').select('id, full_name, stage, class_id, parent_phone').order('full_name').limit(2000),
    ]).then(([c, s]) => {
      setClasses((c.data ?? []) as ClassRow[]);
      setStudents((s.data ?? []) as StudentRow[]);
    });
    load();
  }, []);

  // قفل المعلم على مرحلته
  useEffect(() => {
    if (!isAdmin && teacherStage) setStageFilter(teacherStage);
  }, [isAdmin, teacherStage]);

  async function load() {
    setLoading(true);
    const [att, perms] = await Promise.all([
      supabase.from('attendance_records')
        .select('id, status, date, check_in_time, students(id, full_name, student_number, parent_phone, stage, class_id, classes(name))')
        .gte('date', from).lte('date', to).order('date', { ascending: false }),
      supabase.from('permissions')
        .select('id, status, date, reason, used_at, returned_at, students(id, full_name, student_number, parent_phone, stage, class_id, classes(name))')
        .gte('date', from).lte('date', to).order('date', { ascending: false }),
    ]);

    const a: Entry[] = ((att.data ?? []) as any[]).map((r) => ({
      id: 'a:' + r.id, date: r.date, status: r.status,
      student_id: r.students?.id, student_name: r.students?.full_name ?? '—',
      student_number: r.students?.student_number ?? '', parent_phone: r.students?.parent_phone ?? null,
      stage: r.students?.stage, class_id: r.students?.class_id ?? null,
      class_name: r.students?.classes?.name ?? null,
      check_in_time: r.check_in_time ?? null,
    }));
    const p: Entry[] = ((perms.data ?? []) as any[]).map((r) => ({
      id: 'p:' + r.id, date: r.date, status: 'permission',
      student_id: r.students?.id, student_name: r.students?.full_name ?? '—',
      student_number: r.students?.student_number ?? '', parent_phone: r.students?.parent_phone ?? null,
      stage: r.students?.stage, class_id: r.students?.class_id ?? null,
      class_name: r.students?.classes?.name ?? null,
      reason: r.reason,
      exit_time: r.used_at ?? null,
      return_time: r.returned_at ?? null,
    }));
    setEntries([...a, ...p].sort((x, y) => y.date.localeCompare(x.date)));
    setLoading(false);
  }

  const filtered = useMemo(() => entries.filter((e) => {
    if (!isAdmin && teacherStage && e.stage !== teacherStage) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (stageFilter !== 'all' && e.stage !== stageFilter) return false;
    if (classFilter !== 'all' && (e.class_id ?? '') !== classFilter) return false;
    if (studentFilter !== 'all' && e.student_id !== studentFilter) return false;
    return true;
  }), [entries, statusFilter, stageFilter, classFilter, studentFilter, isAdmin, teacherStage]);

  function exportExcel() {
    const data = filtered.map((r) => ({
      'التاريخ': r.date,
      'اسم الطالب': r.student_name,
      'رقم الطالب': r.student_number,
      'المرحلة': STAGE_LABELS[r.stage] ?? '',
      'الفصل': r.class_name ?? '',
      'الحالة': ENTRY_LABELS[r.status],
      'وقت الحضور': nowTimeLabel(r.check_in_time),
      'وقت الخروج': nowTimeLabel(r.exit_time),
      'وقت العودة': nowTimeLabel(r.return_time),
      'سبب الاستذان': r.reason ?? '',
      'هاتف ولي الأمر': r.parent_phone ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    (ws as any)['!views'] = [{ RTL: true }];
    // أعرض أعمدة معقولة
    (ws as any)['!cols'] = [
      { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
      { wch: 10 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 22 }, { wch: 16 },
    ];

    const meta = [
      [settings?.school_name ?? 'مدارس الضاحية'],
      [settings?.subtitle ?? ''],
      [settings?.address ?? ''],
      [settings?.phone ?? ''],
      [`الفترة: من ${from} إلى ${to}`],
      [`عدد السجلات: ${data.length}`],
      [`تاريخ الإصدار: ${new Date().toLocaleString('ar-SA')}`],
    ];
    const wsMeta = XLSX.utils.aoa_to_sheet(meta);
    (wsMeta as any)['!views'] = [{ RTL: true }];
    (wsMeta as any)['!cols'] = [{ wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMeta, 'بيانات المدرسة');
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير');
    XLSX.writeFile(wb, `تقرير_${from}_${to}.xlsx`);
    toast.success('تم تصدير الملف');
  }

  async function markMissingAsAbsent() {
    const target = todayISO();
    if (target < from || target > to) {
      toast.error('اضبط نطاق التاريخ ليشمل اليوم لاستخدام الغياب التلقائي');
      return;
    }
    if (!confirm(`سيتم تسجيل جميع الطلاب${(!isAdmin && teacherStage) ? ` لمرحلة ${STAGE_LABELS[teacherStage]}` : ''} الذين لم يُمسح باركودهم اليوم كـ "غائب". متابعة؟`)) return;

    let q = supabase.from('students').select('id, stage');
    if (!isAdmin && teacherStage) q = q.eq('stage', teacherStage);
    const { data: studs } = await q;
    if (!studs?.length) { toast.error('لا يوجد طلاب'); return; }

    const { data: marked } = await supabase.from('attendance_records')
      .select('student_id').eq('date', target);
    const markedIds = new Set((marked ?? []).map((m: any) => m.student_id));
    const missing = studs.filter((s: any) => !markedIds.has(s.id));
    if (!missing.length) { toast.success('لا يوجد غائبين — جميع الطلاب مسجَّلين'); return; }

    const rows = missing.map((s: any) => ({
      student_id: s.id, status: 'absent' as const, date: target,
      teacher_id: null,
    }));
    const { error } = await supabase.from('attendance_records').insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم تسجيل ${missing.length} طالب كـ "غائب"`);
    load();
  }

  function exportPdf() {
    if (!filtered.length) { toast.error('لا توجد بيانات'); return; }
    const rows: ReportRow[] = filtered.map((e) => ({
      date: e.date, student_name: e.student_name, student_number: e.student_number,
      stage: e.stage, class_name: e.class_name, status: e.status, reason: e.reason ?? null,
      check_in_time: e.check_in_time ?? null, exit_time: e.exit_time ?? null, return_time: e.return_time ?? null,
    }));
    const filtersText = [
      stageFilter !== 'all' ? `المرحلة: ${STAGE_LABELS[stageFilter as Stage]}` : '',
      classFilter !== 'all' ? `الفصل: ${classes.find((c) => c.id === classFilter)?.name ?? ''}` : '',
      studentFilter !== 'all' ? `الطالب: ${students.find((s) => s.id === studentFilter)?.full_name ?? ''}` : '',
      statusFilter !== 'all' ? `الحالة: ${ENTRY_LABELS[statusFilter as EntryStatus]}` : '',
    ].filter(Boolean).join(' • ');
    openReportPdf(rows, {
      school_name: settings?.school_name ?? 'مدارس الضاحية',
      subtitle: settings?.subtitle, address: settings?.address, phone: settings?.phone,
    }, {
      title: 'تقرير الحضور والاستذان',
      range: `${formatDate(from)} — ${formatDate(to)}`,
      filtersText: filtersText || undefined,
    });
  }

  async function generateMonthlyForStudent() {
    if (monthlyStudent === 'all') { toast.error('اختر طالباً محدداً'); return; }
    const stu = students.find((s) => s.id === monthlyStudent);
    if (!stu) return;
    const start = `${monthlyMonth}-01`;
    const endDate = new Date(start); endDate.setMonth(endDate.getMonth() + 1);
    const end = endDate.toISOString().slice(0, 10);

    const [att, perms] = await Promise.all([
      supabase.from('attendance_records').select('id, status, date, check_in_time, students(full_name, student_number, stage, class_id, classes(name))')
        .eq('student_id', monthlyStudent).gte('date', start).lt('date', end).order('date'),
      supabase.from('permissions').select('id, date, reason, used_at, returned_at, students(full_name, student_number, stage, class_id, classes(name))')
        .eq('student_id', monthlyStudent).gte('date', start).lt('date', end).order('date'),
    ]);
    const rows: ReportRow[] = [
      ...((att.data ?? []) as any[]).map((r) => ({
        date: r.date, student_name: r.students?.full_name ?? stu.full_name,
        student_number: r.students?.student_number ?? '', stage: r.students?.stage ?? stu.stage,
        class_name: r.students?.classes?.name ?? null, status: r.status as AttendanceStatus, reason: null,
        check_in_time: r.check_in_time ?? null,
      })),
      ...((perms.data ?? []) as any[]).map((r) => ({
        date: r.date, student_name: r.students?.full_name ?? stu.full_name,
        student_number: r.students?.student_number ?? '', stage: r.students?.stage ?? stu.stage,
        class_name: r.students?.classes?.name ?? null, status: 'permission' as const, reason: r.reason,
        exit_time: r.used_at ?? null, return_time: r.returned_at ?? null,
      })),
    ].sort((x, y) => x.date.localeCompare(y.date));

    const monthLabel = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' }).format(new Date(start));
    openReportPdf(rows, {
      school_name: settings?.school_name ?? 'مدارس الضاحية',
      subtitle: settings?.subtitle, address: settings?.address, phone: settings?.phone,
    }, {
      title: `تقرير شهري — ${monthLabel}`,
      studentName: stu.full_name,
      range: monthLabel,
    });
  }

  async function sendMonthlyReports() {
    setSending(true);
    try {
      const start = `${monthlyMonth}-01`;
      const endDate = new Date(start); endDate.setMonth(endDate.getMonth() + 1);
      const end = endDate.toISOString().slice(0, 10);

      let studentQuery = supabase.from('students').select('id, full_name, student_number, parent_phone, stage').order('full_name').limit(2000);
      if (!isAdmin && teacherStage) studentQuery = studentQuery.eq('stage', teacherStage);
      // فلترة لطالب محدد إن اختير
      if (monthlyStudent !== 'all') studentQuery = studentQuery.eq('id', monthlyStudent);

      const { data: studs } = await studentQuery;
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
      if (!targets.length) {
        toast.error('لا يوجد أرقام أولياء أمور صالحة. تأكد من أن الأرقام السعودية تبدأ بـ 05 أو 5 أو 966');
        return;
      }

      const monthLabel = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' }).format(new Date(start));
      toast.info(`سيتم فتح ${targets.length} رابط واتساب — اسمح للنوافذ المنبثقة في المتصفح`);

      let opened = 0;
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
        if (link) {
          const w = window.open(link, '_blank', 'noopener,noreferrer');
          if (w) opened++;
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      if (opened === 0) {
        toast.error('فشل فتح روابط واتساب. فعّل النوافذ المنبثقة لهذا الموقع ثم أعد المحاولة');
      } else {
        toast.success(`تم فتح ${opened} رسالة واتساب من ${targets.length}`);
      }
    } finally { setSending(false); }
  }

  const visibleStudents = students
    .filter((s) => isAdmin || !teacherStage || s.stage === teacherStage)
    .filter((s) => stageFilter === 'all' || s.stage === stageFilter)
    .filter((s) => classFilter === 'all' || (s.class_id ?? '') === classFilter);
  const visibleClasses = classes
    .filter((c) => isAdmin || !teacherStage || c.stage === teacherStage)
    .filter((c) => stageFilter === 'all' || c.stage === stageFilter);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">التقارير</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {(!isAdmin && teacherStage)
            ? `تعرض فقط طلاب مرحلة ${STAGE_LABELS[teacherStage]}`
            : 'تقارير الحضور والاستذان حسب المرحلة، الفصل، أو الطالب'}
        </p>
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
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v as any); setClassFilter('all'); setStudentFilter('all'); }} disabled={!isAdmin && !!teacherStage}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {isAdmin && <SelectItem value="all">الكل</SelectItem>}
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
          <Button onClick={exportPdf} variant="outline" disabled={!filtered.length} className="gap-2">
            <FileText className="h-4 w-4" /> تصدير PDF
          </Button>
          <Button onClick={markMissingAsAbsent} variant="outline" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10">
            <UserX className="h-4 w-4" /> تسجيل الغائبين تلقائياً (اليوم)
          </Button>
        </div>
      </Card>

      <Card className="p-5 shadow-soft border-accent/30 bg-accent/5">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Send className="h-5 w-5 text-accent" /> التقارير الشهرية</h2>
        <p className="text-xs text-muted-foreground mb-4">
          أصدر تقريراً شهرياً لطالب محدد كـ PDF، أو افتح روابط واتساب جاهزة لأولياء الأمور.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">الشهر</Label>
            <Input type="month" value={monthlyMonth} onChange={(e) => setMonthlyMonth(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">الطالب</Label>
            <Select value={monthlyStudent} onValueChange={setMonthlyStudent}>
              <SelectTrigger className="w-60"><SelectValue placeholder="جميع الطلاب" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الطلاب (واتساب)</SelectItem>
                {visibleStudents.slice(0, 500).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generateMonthlyForStudent} disabled={monthlyStudent === 'all'} className="gap-2 bg-gradient-primary">
            <UserIcon className="h-4 w-4" /> تقرير شهري للطالب (PDF)
          </Button>
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
                <TableHead className="text-center">حضور</TableHead>
                <TableHead className="text-center">خروج</TableHead>
                <TableHead className="text-center">عودة</TableHead>
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
                    <TableCell className="text-center text-xs font-mono">{nowTimeLabel(r.check_in_time)}</TableCell>
                    <TableCell className="text-center text-xs font-mono">{nowTimeLabel(r.exit_time)}</TableCell>
                    <TableCell className="text-center text-xs font-mono">{nowTimeLabel(r.return_time)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.reason ?? '—'}</TableCell>
                    <TableCell>
                      {wa
                        ? <Button asChild variant="ghost" size="icon"><a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 text-success" /></a></Button>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && <TableRow><TableCell colSpan={10} className="py-12 text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
