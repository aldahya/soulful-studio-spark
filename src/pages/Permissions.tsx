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
import { ScanLine, FileSignature, Loader2, Printer, RotateCcw, Search, Check } from 'lucide-react';
import { todayISO, formatDate } from '@/lib/i18n';
import { toast } from 'sonner';
import { useSchoolSettings } from '@/lib/school';
import CameraScanner from '@/components/CameraScanner';
import { createAdminPermissionRequest } from '@/lib/adminPermissionRequests';

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

interface StudentSuggestion {
  id: string;
  full_name: string;
  student_number: string;
  barcode: string;
}

export default function Permissions() {
  const { user, isAdmin, isTeacher, teacherStage, schoolId, school } = useAuth();
  const settings = useSchoolSettings();
  const canIssue = isAdmin || isTeacher;
  const [code, setCode] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSuggestions, setStudentSuggestions] = useState<StudentSuggestion[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSuggestion | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'الاستذانات | نظام الضاحية';
    nameInputRef.current?.focus();
  }, [user]);

  useEffect(() => { load(); }, [date]);

  useEffect(() => {
    const searchTerm = studentSearch.trim().replace(/\s+/g, ' ');
    if (!schoolId || selectedStudent || searchTerm.length < 2 || /[0-9٠-٩۰-۹]/.test(searchTerm)) {
      setStudentSuggestions([]);
      setSuggestionLoading(false);
      setSuggestionError(false);
      setActiveSuggestion(-1);
      return;
    }

    let cancelled = false;
    setStudentSuggestions([]);
    setActiveSuggestion(-1);
    setSuggestionLoading(true);
    setSuggestionError(false);
    const timer = window.setTimeout(async () => {
      const safeTerm = searchTerm.replace(/[%_]/g, '');
      if (safeTerm.length < 2) {
        if (!cancelled) setSuggestionLoading(false);
        return;
      }
      let query = (supabase as any)
        .from('students')
        .select('id, full_name, student_number, barcode')
        .eq('school_id', schoolId)
        .ilike('full_name', `${safeTerm}%`);

      if (!isAdmin && teacherStage) query = query.eq('stage', teacherStage);

      const { data, error } = await query.order('full_name', { ascending: true }).limit(8);
      if (cancelled) return;
      setStudentSuggestions((data ?? []) as StudentSuggestion[]);
      setSuggestionError(Boolean(error));
      setSuggestionLoading(false);
      setSuggestionsOpen(true);
      setActiveSuggestion(-1);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [studentSearch, selectedStudent, schoolId, isAdmin, teacherStage]);

  function selectStudentSuggestion(student: StudentSuggestion) {
    setSelectedStudent(student);
    setStudentSearch(student.full_name);
    setStudentSuggestions([]);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    setCode('');
  }

  async function load() {
    if (!schoolId) return;
    setLoading(true);
    const { data } = await supabase
      .from('permissions')
      .select('id, status, reason, notes, issued_at, used_at, returned_at, date, students(full_name, student_number, parent_phone)')
      .eq('school_id', schoolId)
      .eq('date', date)
      .order('issued_at', { ascending: false });
    setRows((data ?? []) as any);
    setLoading(false);
  }

  async function submitRequest(student: StudentSuggestion | null, rawCode: string) {
    if (!user) return;
    const trimmed = rawCode.trim();
    if (!student && !trimmed) return;
    setIssuing(true);
    try {
      if (!schoolId || !school?.slug) {
        toast.error('تعذر تحديد المدرسة المرتبطة بهذا الحساب');
        return;
      }
      let targetStudent = student;
      if (!targetStudent) {
        const { data, error } = await supabase
          .from('students').select('id, full_name, student_number, barcode')
          .eq('barcode', trimmed).maybeSingle();
        if (error) { toast.error(error.message); return; }
        if (!data) { toast.error('باركود غير معروف'); return; }
        targetStudent = data;
      }

      const { error } = await createAdminPermissionRequest({
        studentId: targetStudent.id,
        schoolSlug: school.slug,
        reason,
        notes,
      });
      if (error) {
        if (error.message.includes('parent_requests_one_pending_admin_per_student') || error.message.includes('duplicate key')) {
          toast.error('يوجد استئذان إداري قيد المراجعة لهذا الطالب بالفعل');
        }
        else toast.error(error.message);
        return;
      }
      toast.success(`تم إرسال استئذان ${targetStudent.full_name} إلى قسم «استئذان الإدارة»`);
      setCode('');
      setStudentSearch('');
      setStudentSuggestions([]);
      setSelectedStudent(null);
      setSuggestionsOpen(false);
      setNotes('');
      setTimeout(() => nameInputRef.current?.focus(), 50);
    } finally {
      setIssuing(false);
    }
  }

  async function issueWithCode(rawCode: string) {
    await submitRequest(null, rawCode);
  }

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    if (selectedStudent) {
      await submitRequest(selectedStudent, '');
      return;
    }
    if (studentSearch.trim()) {
      toast.error('اختر اسم الطالبة أو الطالب من قائمة الاقتراحات أولاً');
      setSuggestionsOpen(true);
      return;
    }
    await issueWithCode(code);
  }

  function handleStudentSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && studentSuggestions.length > 0) {
      e.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => (current + 1) % studentSuggestions.length);
    } else if (e.key === 'ArrowUp' && studentSuggestions.length > 0) {
      e.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => (current <= 0 ? studentSuggestions.length - 1 : current - 1));
    } else if (e.key === 'Enter' && suggestionsOpen && studentSuggestions.length > 0) {
      e.preventDefault();
      const choice = studentSuggestions[activeSuggestion >= 0 ? activeSuggestion : 0];
      selectStudentSuggestion(choice);
    } else if (e.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
  }

  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  function onCameraDetected(text: string) {
    const now = Date.now();
    if (lastScanRef.current.code === text && now - lastScanRef.current.at < 5000) return;
    lastScanRef.current = { code: text, at: now };
    setCode(text);
    issueWithCode(text);
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
        <p className="mt-1 text-sm text-muted-foreground">ترسل الطلبات إلى «استئذان الإدارة» ولا يُسجل الخروج إلا بعد موافقة الإدارة.</p>
      </header>

      {canIssue && (
        <Card className="p-6 shadow-soft">
          <h2 className="mb-4 text-lg font-bold">إرسال استئذان للإدارة</h2>
          <form onSubmit={issue} className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="permission-student-search">البحث باسم الطالب أو الطالبة</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="permission-student-search"
                  ref={nameInputRef}
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setSelectedStudent(null);
                    setCode('');
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => studentSuggestions.length > 0 && setSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                  onKeyDown={handleStudentSearchKeyDown}
                  placeholder="اكتب أول حرفين من الاسم"
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen && studentSearch.trim().length >= 2 && !selectedStudent}
                  aria-controls="permission-student-suggestions"
                  className="pr-10"
                />
                {suggestionLoading && (
                  <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                )}
                {suggestionsOpen && studentSearch.trim().length >= 2 && !selectedStudent && (
                  <div
                    id="permission-student-suggestions"
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
                  >
                    {suggestionError ? (
                      <p className="px-3 py-2 text-sm text-destructive">تعذر البحث عن الطلاب. حاول مرة أخرى.</p>
                    ) : suggestionLoading ? null : studentSuggestions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">لا توجد أسماء مطابقة في هذه المدرسة.</p>
                    ) : (
                      studentSuggestions.map((student, index) => (
                        <button
                          key={student.id}
                          type="button"
                          role="option"
                          aria-selected={index === activeSuggestion}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectStudentSuggestion(student)}
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-right text-sm hover:bg-accent ${index === activeSuggestion ? 'bg-accent' : ''}`}
                        >
                          <span className="font-medium">{student.full_name}</span>
                          <span className="mr-3 shrink-0 text-xs text-muted-foreground">رقم {student.student_number}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedStudent && (
                <p className="flex items-center gap-1 text-xs text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  تم اختيار {selectedStudent.full_name} — {selectedStudent.student_number}
                </p>
              )}
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>أو أدخل باركود الطالب</Label>
              <div className="relative">
                <ScanLine className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setStudentSearch('');
                    setSelectedStudent(null);
                    setStudentSuggestions([]);
                    setSuggestionsOpen(false);
                  }}
                  placeholder="ALD-..."
                  dir="ltr"
                  className="pr-10 font-mono"
                />
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
              <Button type="submit" disabled={issuing || (!selectedStudent && !code.trim() && !studentSearch.trim())} className="bg-gradient-primary">
                {issuing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إرسال الطلب
              </Button>
            </div>
          </form>
          <div className="mt-6 border-t pt-4">
            <h3 className="mb-2 text-sm font-bold">المسح بالكاميرا</h3>
            <CameraScanner onDetected={onCameraDetected} />
          </div>
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
