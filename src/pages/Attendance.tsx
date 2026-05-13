import { useEffect, useMemo, useState } from 'react';
  import { supabase } from '@/integrations/supabase/client';
  import { Card } from '@/components/ui/card';
  import { Button } from '@/components/ui/button';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
  import { Badge } from '@/components/ui/badge';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { STATUS_LABELS, STATUS_COLORS, STAGE_LABELS, formatDate, todayISO, type AttendanceStatus, type Stage } from '@/lib/i18n';
  import { Loader2, Download, LogOut, MessageCircle, CheckCircle2, Send } from 'lucide-react';
  import * as XLSX from 'xlsx';
  import { useAuth } from '@/hooks/useAuth';
  import { useToast } from '@/hooks/use-toast';

  type Filter = 'all' | AttendanceStatus | 'permission';

  interface AttRow {
    kind: 'attendance'; id: string; status: AttendanceStatus; date: string; recorded_at: string;
    student_name: string; student_number: string; stage: Stage; class_name: string | null; teacher_name: string | null;
  }
  interface PermRow {
    kind: 'permission'; id: string; status: 'pending' | 'used' | 'returned'; date: string; recorded_at: string;
    student_name: string; student_number: string; stage: Stage; class_name: string | null; teacher_name: string | null; reason: string;
  }
  type Row = AttRow | PermRow;

  const PERM_STATUS_LABELS = { pending: 'استذان معلَّق', used: 'استذان (خرج)', returned: 'استذان (عاد)' } as const;

  export default function Attendance() {
    const { isAdmin, teacherStage, schoolId } = useAuth();
    const { toast } = useToast();
    const [rows, setRows] = useState<Row[]>([]);
    const [date, setDate] = useState(todayISO());
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<Filter>('all');
    const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
    const [sending, setSending] = useState<Record<string, boolean>>({});
    const [sent, setSent] = useState<Record<string, boolean>>({});
    const [bulkSending, setBulkSending] = useState(false);

    useEffect(() => { document.title = 'سجل الحضور | نظام الضاحية'; }, []);
    useEffect(() => { if (schoolId) load(); }, [date, schoolId]);
    useEffect(() => {
      if (!isAdmin && teacherStage) setStageFilter(teacherStage);
    }, [isAdmin, teacherStage]);

    async function load() {
      if (!schoolId) return;
      setLoading(true);

      const [att, perms] = await Promise.all([
        supabase
          .from('attendance_full_view')
          .select('id, status, date, recorded_at, student_name, student_number, stage, class_name, teacher_name')
          .eq('date', date)
          .eq('school_id', schoolId)
          .order('recorded_at', { ascending: false }),
        supabase
          .from('permissions')
          .select('id, status, date, issued_at, reason, students(full_name, student_number, stage, school_id, classes(name)), teachers(full_name)')
          .eq('date', date)
          .order('issued_at', { ascending: false }),
      ]);

      const a: Row[] = ((att.data ?? []) as any[]).map((r) => ({
        kind: 'attendance' as const,
        id: r.id, status: r.status, date: r.date, recorded_at: r.recorded_at,
        student_name: r.student_name ?? '—', student_number: r.student_number ?? '',
        stage: r.stage, class_name: r.class_name ?? null, teacher_name: r.teacher_name ?? null,
      }));

      const p: Row[] = ((perms.data ?? []) as any[])
        .filter((r) => r.students?.school_id === schoolId)
        .map((r) => ({
          kind: 'permission' as const,
          id: r.id, status: r.status, date: r.date, recorded_at: r.issued_at,
          student_name: r.students?.full_name ?? '—', student_number: r.students?.student_number ?? '',
          stage: r.students?.stage, class_name: r.students?.classes?.name ?? null,
          teacher_name: r.teachers?.full_name ?? null, reason: r.reason,
        }));

      setRows([...a, ...p].sort((x, y) => y.recorded_at.localeCompare(x.recorded_at)));
      setSent({});
      setLoading(false);
    }

    async function getStudentAndSchool(studentNumber: string) {
      const [{ data: student }, { data: settings }] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, parent_phone')
          .eq('student_number', studentNumber)
          .eq('school_id', schoolId!)
          .maybeSingle(),
        supabase
          .from('school_settings')
          .select('school_name')
          .eq('school_id', schoolId!)
          .maybeSingle(),
      ]);
      return { student, schoolName: (settings as any)?.school_name ?? 'المدرسة' };
    }

    function buildMessage(studentName: string, schoolName: string) {
      const formattedDate = new Date(date).toLocaleDateString('ar-SA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      return `🏫 ${schoolName}
  ━━━━━━━━━━━━━━━━━━
  السلام عليكم ورحمة الله وبركاته،

  نحيطكم علماً بأن الطالب:
  👤 ${studentName}

  لم يتم تسجيل حضوره لهذا اليوم ❌
  يرجى تزويد المدرسة بسبب الغياب.

  📅 التاريخ: ${formattedDate}
  ━━━━━━━━━━━━━━━━━━
  نأمل منكم متابعة انتظام الطالب الدراسي 📚`;
    }

    async function sendWhatsApp(row: AttRow) {
      if (!row.student_number) return;
      setSending((s) => ({ ...s, [row.id]: true }));
      try {
        const { student, schoolName } = await getStudentAndSchool(row.student_number);
        if (!student?.parent_phone) {
          toast({ title: 'لا يوجد رقم', description: 'لم يُسجَّل رقم ولي الأمر لهذا الطالب', variant: 'destructive' });
          return;
        }
        const message = buildMessage(student.full_name, schoolName);
        const { error } = await supabase.from('whatsapp_queue').insert({
          student_id: student.id,
          phone: student.parent_phone, message,
          scheduled_at: new Date(Date.now() - 60000).toISOString(),
          status: 'pending',
        });
        if (error) throw error;
        setSent((s) => ({ ...s, [row.id]: true }));
        toast({ title: 'تم جدولة الرسالة ✅', description: 'ستُرسل خلال دقائق' });
      } catch (e: any) {
        toast({ title: 'خطأ', description: e.message ?? 'فشل الإرسال', variant: 'destructive' });
      } finally {
        setSending((s) => ({ ...s, [row.id]: false }));
      }
    }

    async function sendBulk() {
      const absentRows = filtered.filter(
        (r) => r.kind === 'attendance' && (r as AttRow).status === 'absent' && !sent[r.id]
      ) as AttRow[];
      if (absentRows.length === 0) {
        toast({ title: 'لا يوجد غائبون', description: 'لا توجد سجلات غياب في القائمة الحالية' });
        return;
      }
      setBulkSending(true);
      try {
        const studentNumbers = absentRows.map((r) => r.student_number).filter(Boolean);
        const [{ data: students }, { data: settings }] = await Promise.all([
          supabase.from('students').select('id, full_name, student_number, parent_phone')
            .in('student_number', studentNumbers).eq('school_id', schoolId!),
          supabase.from('school_settings').select('school_name').eq('school_id', schoolId!).maybeSingle(),
        ]);
        const schoolName = (settings as any)?.school_name ?? 'المدرسة';
        const studentsMap = Object.fromEntries((students ?? []).map((s) => [s.student_number, s]));
        let queued = 0;
        const newSent: Record<string, boolean> = {};
        for (const row of absentRows) {
          const student = studentsMap[row.student_number];
          if (!student?.parent_phone) continue;
          const message = buildMessage(student.full_name, schoolName);
          const { error } = await supabase.from('whatsapp_queue').insert({
            student_id: student.id,
            phone: student.parent_phone, message,
            scheduled_at: new Date(Date.now() - 60000).toISOString(),
            status: 'pending',
          });
          if (!error) { queued++; newSent[row.id] = true; }
        }
        setSent((s) => ({ ...s, ...newSent }));
        toast({ title: `تم جدولة ${queued} رسالة ✅`, description: `من أصل ${absentRows.length} غائب` });
      } catch (e: any) {
        toast({ title: 'خطأ', description: e.message ?? 'فشل الإرسال الجماعي', variant: 'destructive' });
      } finally {
        setBulkSending(false);
      }
    }

    const filtered = useMemo(() => rows.filter((r) => {
      if (!isAdmin && teacherStage && r.stage !== teacherStage) return false;
      if (stageFilter !== 'all' && r.stage !== stageFilter) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'permission') return r.kind === 'permission';
      return r.kind === 'attendance' && r.status === statusFilter;
    }), [rows, statusFilter, stageFilter, isAdmin, teacherStage]);

    const absentCount = useMemo(
      () => filtered.filter((r) => r.kind === 'attendance' && (r as AttRow).status === 'absent' && !sent[r.id]).length,
      [filtered, sent]
    );

    function exportExcel() {
      const data = filtered.map((r) => ({
        'الوقت': new Date(r.recorded_at).toLocaleTimeString('ar-SA'),
        'التاريخ': r.date, 'الطالب': r.student_name, 'رقم الطالب': r.student_number,
        'المرحلة': STAGE_LABELS[r.stage] ?? '', 'الفصل': r.class_name ?? '',
        'الحالة': r.kind === 'attendance' ? STATUS_LABELS[(r as AttRow).status] : PERM_STATUS_LABELS[(r as PermRow).status],
        'سبب الاستذان': r.kind === 'permission' ? (r as PermRow).reason : '',
        'المعلم': r.teacher_name ?? '',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      (ws as any)['!views'] = [{ RTL: true }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
      XLSX.writeFile(wb, `الحضور_${date}.xlsx`);
    }

    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">سجل الحضور</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(date)} — {filtered.length} سجل</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المرحلة</Label>
              <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as any)} disabled={!isAdmin && !!teacherStage}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="all">الكل</SelectItem>}
                  {Object.entries(STAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الحالة</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Filter)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="late">متأخر</SelectItem>
                  <SelectItem value="absent">غائب</SelectItem>
                  <SelectItem value="permission">استذان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={exportExcel} variant="outline" className="gap-2" disabled={!filtered.length}>
              <Download className="h-4 w-4" /> تصدير Excel
            </Button>
            <Button
              onClick={sendBulk}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              disabled={bulkSending || absentCount === 0}
            >
              {bulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              إشعار جماعي {absentCount > 0 && `(${absentCount})`}
            </Button>
          </div>
        </header>

        <Card className="shadow-soft">
          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead><TableHead>الرقم</TableHead><TableHead>المرحلة</TableHead>
                  <TableHead>الفصل</TableHead><TableHead>الحالة</TableHead><TableHead>تفاصيل</TableHead>
                  <TableHead>المعلم</TableHead><TableHead>الوقت</TableHead><TableHead>إشعار</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.kind + r.id}>
                    <TableCell className="font-medium">{r.student_name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.student_number}</TableCell>
                    <TableCell><Badge variant="secondary">{STAGE_LABELS[r.stage] ?? '—'}</Badge></TableCell>
                    <TableCell>{r.class_name ?? '—'}</TableCell>
                    <TableCell>
                      {r.kind === 'attendance'
                        ? <Badge className={STATUS_COLORS[(r as AttRow).status]} variant="outline">{STATUS_LABELS[(r as AttRow).status]}</Badge>
                        : <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20"><LogOut className="h-3 w-3 ml-1 inline" />{PERM_STATUS_LABELS[(r as PermRow).status]}</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.kind === 'permission' ? (r as PermRow).reason : '—'}</TableCell>
                    <TableCell>{r.teacher_name ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground" dir="ltr">{new Date(r.recorded_at).toLocaleTimeString('ar-SA')}</TableCell>
                    <TableCell>
                      {r.kind === 'attendance' && (r as AttRow).status === 'absent' ? (
                        sent[r.id] ? (
                          <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-4 w-4" /> تم</span>
                        ) : (
                          <Button size="sm" variant="outline"
                            className="h-7 gap-1 text-xs text-green-700 border-green-300 hover:bg-green-50"
                            disabled={sending[r.id]} onClick={() => sendWhatsApp(r as AttRow)}>
                            {sending[r.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                            إشعار
                          </Button>
                        )
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">لا توجد سجلات</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    );
  }
  