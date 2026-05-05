import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScanLine, FileSignature, Loader2, Printer, RotateCcw } from 'lucide-react';
import { todayISO, formatDate } from '@/lib/i18n';
import { toast } from 'sonner';
import { useSchoolSettings } from '@/lib/school';
import CameraScanner from '@/components/CameraScanner';

const REASONS = [
  'مراجعة طبية',
  'ظرف عائلي',
  'مهمة رسمية',
  'استلام من ولي الأمر',
  'سبب آخر',
];

interface PermRow {
  id: string;
  status: 'pending' | 'used' | 'returned';
  reason: string;
  notes: string | null;
  issued_at: string;
  used_at: string | null;
  returned_at: string | null;
  date: string;
  students: { full_name: string; student_number: string; parent_phone: string | null } | null;
}

export default function Permissions() {
  const { user, isAdmin, isTeacher } = useAuth();
  const settings = useSchoolSettings();
  const canIssue = isAdmin || isTeacher;
  const [code, setCode] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'الاستذانات | نظام الضاحية';
    inputRef.current?.focus();
    if (user) {
      supabase.from('teachers').select('id').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setTeacherId(data?.id ?? null));
    }
  }, [user]);

  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('permissions')
      .select('id, status, reason, notes, issued_at, used_at, returned_at, date, students(full_name, student_number, parent_phone)')
      .eq('date', date)
      .order('issued_at', { ascending: false });
    setRows((data ?? []) as any);
    setLoading(false);
  }

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const trimmed = code.trim();
    if (!trimmed) return;
    setIssuing(true);
    try {
      const { data: student } = await supabase
        .from('students').select('id, full_name')
        .eq('barcode', trimmed).maybeSingle();
      if (!student) { toast.error('باركود غير معروف'); return; }

      const { error } = await supabase.from('permissions').insert({
        student_id: student.id,
        teacher_id: teacherId,
        issued_by: user.id,
        reason,
        notes: notes || null,
        date: todayISO(),
      });
      if (error) {
        if (error.code === '23505') toast.error('يوجد استذان لهذا الطالب اليوم بالفعل');
        else toast.error(error.message);
        return;
      }
      // log
      const { data: created } = await supabase
        .from('permissions').select('id').eq('student_id', student.id).eq('date', todayISO()).maybeSingle();
      if (created) {
        await supabase.from('permission_logs').insert({
          permission_id: created.id, action: 'issued', actor_id: user.id,
        });
      }
      toast.success(`تم إصدار استذان: ${student.full_name}`);
      setCode(''); setNotes('');
      load();
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setIssuing(false);
    }
  }

  async function markReturned(p: PermRow) {
    if (!user) return;
    const { error } = await supabase
      .from('permissions')
      .update({ status: 'returned', returned_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from('permission_logs').insert({
      permission_id: p.id, action: 'returned', actor_id: user.id,
    });
    toast.success('تم تسجيل العودة');
    load();
  }

  function printPermission(p: PermRow) {
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>استذان</title>
      <style>
        body{font-family:'Cairo',sans-serif;padding:32px;color:#0f172a}
        .card{border:2px dashed #059669;border-radius:18px;padding:28px;max-width:480px;margin:auto}
        h1{color:#047857;margin:0 0 4px;font-size:22px}
        h2{margin:0 0 24px;font-weight:400;font-size:14px;color:#64748b}
        .row{display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding:8px 0;font-size:14px}
        .row b{color:#334155}
        .footer{margin-top:24px;font-size:12px;color:#64748b;text-align:center}
      </style></head><body>
      <div class="card">
        <h1>${settings?.school_name ?? 'مدارس الضاحية'}</h1>
        <h2>${settings?.subtitle ?? ''} — استذان خروج</h2>
        <div class="row"><b>الطالب</b><span>${p.students?.full_name ?? ''}</span></div>
        <div class="row"><b>رقم الطالب</b><span>${p.students?.student_number ?? ''}</span></div>
        <div class="row"><b>التاريخ</b><span>${formatDate(p.date)}</span></div>
        <div class="row"><b>وقت الإصدار</b><span>${new Date(p.issued_at).toLocaleTimeString('ar-SA')}</span></div>
        <div class="row"><b>السبب</b><span>${p.reason}</span></div>
        ${p.notes ? `<div class="row"><b>ملاحظات</b><span>${p.notes}</span></div>` : ''}
        <div class="footer">يُسلَّم لولي الأمر — يُسجَّل الخروج عبر مسح الباركود في البوابة</div>
      </div>
      <script>window.print();</script></body></html>`);
    w.document.close();
  }

  const statusBadge = (s: PermRow['status']) => {
    const map = {
      pending: { cls: 'bg-warning/10 text-warning border-warning/20', label: 'بانتظار الخروج' },
      used: { cls: 'bg-primary/10 text-primary border-primary/20', label: 'خرج' },
      returned: { cls: 'bg-success/10 text-success border-success/20', label: 'عاد' },
    } as const;
    return <Badge variant="outline" className={map[s].cls}>{map[s].label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><FileSignature className="h-7 w-7 text-primary" /> الاستذانات</h1>
        <p className="mt-1 text-sm text-muted-foreground">إصدار استذانات الخروج للطلاب — استذان واحد لكل طالب يومياً</p>
      </header>

      {canIssue && (
        <Card className="p-6 shadow-soft">
          <h2 className="mb-4 text-lg font-bold">إصدار استذان جديد</h2>
          <form onSubmit={issue} className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-1">
              <Label>باركود الطالب</Label>
              <div className="relative">
                <ScanLine className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ALD-..." dir="ltr" className="pr-10 font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>السبب</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} />
            </div>
            <div className="lg:col-span-3">
              <Button type="submit" disabled={issuing || !code.trim()} className="bg-gradient-primary">
                {issuing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إصدار الاستذان
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">عرض استذانات يوم</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Button onClick={load} variant="outline">تحديث</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الرقم</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>الإصدار</TableHead>
                <TableHead>الخروج</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.students?.full_name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{p.students?.student_number ?? '—'}</TableCell>
                  <TableCell className="text-sm">{p.reason}</TableCell>
                  <TableCell className="text-xs">{new Date(p.issued_at).toLocaleTimeString('ar-SA')}</TableCell>
                  <TableCell className="text-xs">{p.used_at ? new Date(p.used_at).toLocaleTimeString('ar-SA') : '—'}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell className="text-left">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => printPermission(p)} title="طباعة">
                        <Printer className="h-4 w-4" />
                      </Button>
                      {p.status === 'used' && (
                        <Button variant="ghost" size="icon" onClick={() => markReturned(p)} title="تسجيل العودة">
                          <RotateCcw className="h-4 w-4 text-success" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">لا توجد استذانات لهذا اليوم</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
