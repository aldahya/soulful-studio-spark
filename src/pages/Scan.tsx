import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScanLine, CheckCircle2, AlertCircle, Clock, XCircle, LogOut, ArrowLeftRight, Keyboard, Camera, ShieldAlert, Search, Loader2 } from 'lucide-react';
import { STATUS_LABELS, STAGE_LABELS, todayISO, type AttendanceStatus } from '@/lib/i18n';
import { buildNotifyMessage } from '@/lib/whatsappTemplates';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import CameraScanner from '@/components/CameraScanner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { beepSuccess, beepError, beepDuplicate, autoStatusByTime } from '@/lib/feedback';
import { DEFAULT_SETTINGS, type SchoolSettings } from '@/lib/school';
import { createAdminPermissionRequest } from '@/lib/adminPermissionRequests';
import { withActiveStudentFilter } from '@/lib/student-archive';

interface LogEntry { time: string; ok: boolean; text: string; tag?: string }
interface DupContext {
  studentId: string; studentName: string; studentNumber: string; existingStatus: AttendanceStatus;
}
interface StudentSuggestion {
  id: string;
  full_name: string;
  student_number: string;
  stage: string;
  classes: { name: string } | null;
}
interface ScanStudent extends StudentSuggestion {
  parent_phone: string | null;
}

function normalizeStudentIdentifier(value: string) {
  return value.trim().replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function isStudentNameQuery(value: string) {
  const query = value.trim();
  return query.length >= 2
    && !/[0-9٠-٩۰-۹]/.test(query)
    && !/^ALD[-\s]/i.test(query)
    && /[A-Za-z\u0600-\u06FF]/.test(query);
}

export default function Scan() {
  const { user, isAdmin, teacherId, teacherStage, schoolId, school } = useAuth();
  const [code, setCode] = useState('');
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [autoMode, setAutoMode] = useState(true); // تلقائي: متأخر بعد 7:30
  const [log, setLog] = useState<LogEntry[]>([]);
  const [flash, setFlash] = useState<null | 'ok' | 'err'>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const processing = useRef(false);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  // بطاقة معاينة سريعة عند تكرار المسح
  const [dupCard, setDupCard] = useState<{ name: string; status: AttendanceStatus } | null>(null);

  // duplicate dialog
  const [dupOpen, setDupOpen] = useState(false);
  const [dupCtx, setDupCtx] = useState<DupContext | null>(null);

  // permission dialog
  const [permOpen, setPermOpen] = useState(false);
  const [permReason, setPermReason] = useState('خروج من المدرسة');
  const [permNotes, setPermNotes] = useState('');

  useEffect(() => {
    const searchTerm = code.trim();
    if (!schoolId || !isStudentNameQuery(searchTerm)) {
      setSuggestions([]);
      setSuggestionLoading(false);
      setSuggestionError(false);
      setActiveSuggestion(-1);
      return;
    }

    let cancelled = false;
    setSuggestionLoading(true);
    setSuggestionError(false);
    const timer = window.setTimeout(async () => {
      const safeTerm = searchTerm.replace(/[%_]/g, '').replace(/\s+/g, ' ').trim();
      const { data, error } = await withActiveStudentFilter((filterArchived) => {
        let query = supabase
          .from('students')
          .select('id, full_name, student_number, stage, classes(name)')
          .eq('school_id', schoolId);
        if (filterArchived) query = query.is('archived_at', null);
        query = query.ilike('full_name', `${safeTerm}%`);
        if (!isAdmin && teacherStage) query = query.eq('stage', teacherStage);
        return query.order('full_name', { ascending: true }).limit(8);
      });
      if (cancelled) return;
      setSuggestions((data ?? []) as StudentSuggestion[]);
      setSuggestionError(Boolean(error));
      setSuggestionLoading(false);
      setActiveSuggestion(-1);
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, schoolId, isAdmin, teacherStage]);

  useEffect(() => {
    document.title = 'مسح الباركود | نظام الضاحية';
    inputRef.current?.focus();
    if (!schoolId) return;
    supabase.from('school_settings').select('*').eq('school_id', schoolId).maybeSingle()
      .then(({ data }) => { if (data) setSettings(data as SchoolSettings); });
  }, [user, schoolId]);

  function pushLog(ok: boolean, text: string, tag?: string) {
    setLog((l) => [{ time: new Date().toLocaleTimeString('ar-SA'), ok, text, tag }, ...l].slice(0, 30));
  }
  function focusInput() { setTimeout(() => inputRef.current?.focus(), 50); }
  function flashOk() { setFlash('ok'); setTimeout(() => setFlash(null), 700); }
  function flashErr() { setFlash('err'); setTimeout(() => setFlash(null), 700); }

  async function selectSuggestion(suggestion: StudentSuggestion) {
    setSuggestionsOpen(false);
    setSuggestions([]);
    setCode('');
    setActiveSuggestion(-1);
    await processCode(suggestion.student_number, suggestion.id);
    focusInput();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    if (isStudentNameQuery(trimmed)) {
      setSuggestionsOpen(true);
      toast.error(suggestions.length > 1
        ? 'اختر اسم الطالب من قائمة الاقتراحات'
        : 'انتظر ظهور اسم الطالب ثم اختره من القائمة');
      return;
    }
    setSuggestionsOpen(false);
    setCode('');
    await processCode(trimmed);
    focusInput();
  }

  function handleSuggestionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isStudentNameQuery(code)) return;

    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (e.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    } else if (e.key === 'Enter' && suggestionsOpen) {
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        e.preventDefault();
        void selectSuggestion(suggestions[activeSuggestion]);
      } else if (suggestions.length === 1) {
        e.preventDefault();
        void selectSuggestion(suggestions[0]);
      }
    }
  }

  async function processCode(trimmed: string, selectedStudentId?: string) {
    if (processing.current) return;
    const identifier = normalizeStudentIdentifier(trimmed);
    if (!schoolId) {
      pushLog(false, 'تعذر البحث: الحساب غير مرتبط بمدرسة');
      toast.error('تعذر تحديد المدرسة المرتبطة بهذا الحساب');
      beepError(); flashErr();
      return;
    }
    const cfg = settings ?? ({ ...DEFAULT_SETTINGS } as SchoolSettings);
    const dupWindowMs = (cfg.duplicate_window_seconds ?? 20) * 1000;
    const permWindowMs = (cfg.permission_window_minutes ?? 5) * 60 * 1000;
    const dupEnabled = cfg.duplicate_protection_enabled ?? true;

    // حماية فورية ضد المسح المكرر السريع لنفس الباركود
    const now = Date.now();
    if (dupEnabled && lastScan.current.code === identifier && now - lastScan.current.at < dupWindowMs) {
      pushLog(false, `تجاهل مسح مكرر سريع: ${trimmed}`, 'تكرار');
      beepDuplicate();
      return;
    }
    lastScan.current = { code: identifier, at: now };
    processing.current = true;
    try {
      const studentSelection = 'id, full_name, student_number, stage, parent_phone, classes(name)';
      let student: ScanStudent | null = null;
      if (selectedStudentId) {
        const { data, error } = await withActiveStudentFilter((filterArchived) => {
          let query = supabase.from('students').select(studentSelection).eq('school_id', schoolId);
          if (filterArchived) query = query.is('archived_at', null);
          return query.eq('id', selectedStudentId).maybeSingle();
        });

        if (error) {
          pushLog(false, `تعذر البحث عن الطالب: ${error.message}`);
          toast.error('تعذر البحث في سجلات المدرسة');
          beepError(); flashErr();
          return;
        }
        student = data as ScanStudent | null;
      } else {
        const { data: barcodeStudent, error: barcodeError } = await withActiveStudentFilter((filterArchived) => {
          let query = supabase.from('students').select(studentSelection).eq('school_id', schoolId);
          if (filterArchived) query = query.is('archived_at', null);
          return query.eq('barcode', identifier.toUpperCase()).maybeSingle();
        });

        if (barcodeError) {
          pushLog(false, `تعذر البحث عن الطالب: ${barcodeError.message}`);
          toast.error('تعذر البحث في سجلات المدرسة');
          beepError(); flashErr();
          return;
        }

        student = barcodeStudent as ScanStudent | null;
        if (!student) {
          const { data: numberStudent, error: numberError } = await withActiveStudentFilter((filterArchived) => {
            let query = supabase.from('students').select(studentSelection).eq('school_id', schoolId);
            if (filterArchived) query = query.is('archived_at', null);
            return query.eq('student_number', identifier).maybeSingle();
          });

          if (numberError) {
            pushLog(false, `تعذر البحث عن الطالب: ${numberError.message}`);
            toast.error('تعذر البحث في سجلات المدرسة');
            beepError(); flashErr();
            return;
          }
          student = numberStudent as ScanStudent | null;
        }
      }

      if (!student) {
        pushLog(false, `لم يوجد طالب بهذا الرقم في سجلات المدرسة: ${identifier}`);
        toast.error('رقم الطالب غير موجود في سجلات هذه المدرسة');
        beepError(); flashErr();
        return;
      }

      // تقييد المعلم بمرحلته
      if (!isAdmin && teacherStage && student.stage !== teacherStage) {
        pushLog(false, `${student.full_name}: من مرحلة ${STAGE_LABELS[student.stage as keyof typeof STAGE_LABELS]} — خارج صلاحياتك`, 'مرفوض');
        toast.error(`لا يمكنك مسح طالب من مرحلة أخرى (${STAGE_LABELS[student.stage as keyof typeof STAGE_LABELS]})`);
        beepError(); flashErr();
        return;
      }

      const today = todayISO();
      const { data: existing } = await supabase
        .from('attendance_records').select('id, status, check_in_time')
        .eq('student_id', student.id).eq('date', today).maybeSingle();

      if (existing) {
        // فحص استذان معلَّق — إن وُجد نستهلكه مباشرة (= تسجيل الخروج)
        const { data: perm } = await supabase
          .from('permissions').select('id, status, used_at')
          .eq('student_id', student.id).eq('date', today)
          .in('status', ['pending', 'used']).order('issued_at', { ascending: false }).limit(1).maybeSingle();

        if (perm && perm.status === 'pending') {
          const nowIso = new Date().toISOString();
          const { error: updErr } = await supabase
            .from('permissions').update({ status: 'used', used_at: nowIso }).eq('id', perm.id);
          if (updErr) {
            pushLog(false, `تعذّر استهلاك الاستذان: ${updErr.message}`);
            toast.error(updErr.message); beepError(); flashErr();
          } else {
            await supabase.from('permission_logs').insert({
              permission_id: perm.id, action: 'used', actor_id: user!.id,
            });
            await supabase.from('scan_events').insert({
              kind: 'permission_used', student_id: student.id, actor_id: user!.id,
              meta: { permission_id: perm.id },
            });
            pushLog(true, `${student.full_name} (${student.student_number}) — تم تسجيل الخروج`, 'استذان');
            toast.success(`تم استهلاك الاستذان: ${student.full_name}`);
            beepSuccess(); flashOk();
        // إضافة إشعار واتساب للطابور إذا كان الطالب غائباً وعنده رقم هاتف
        if (finalStatus === 'absent' && (student as any).parent_phone) {
          const absMsg = buildNotifyMessage('absent', {
            schoolName: settings?.school_name ?? 'المدرسة',
            studentName: student.full_name,
            className: (student as any).classes?.name ?? null,
            stage: student.stage as any,
            date: new Date(),
          });
          supabase.from('whatsapp_queue').insert({
            student_id: student.id,
            phone: (student as any).parent_phone,
            message: absMsg,
            scheduled_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            status: 'pending',
          }).then(() => {});
        }
          }
          return;
        }

        // لو الاستذان تم استخدامه (الطالب خرج) ثم رجع → نسجّل وقت العودة
        if (perm && perm.status === 'used' && !((perm as any).returned_at)) {
          const { error: retErr } = await supabase.from('permissions')
            .update({ returned_at: new Date().toISOString() }).eq('id', perm.id);
          if (!retErr) {
            await supabase.from('permission_logs').insert({
              permission_id: perm.id, action: 'returned', actor_id: user!.id,
            });
            await supabase.from('scan_events').insert({
              kind: 'permission_returned', student_id: student.id, actor_id: user!.id,
              meta: { permission_id: perm.id },
            });
            pushLog(true, `${student.full_name} — تم تسجيل العودة`, 'عودة');
            toast.success(`عودة الطالب: ${student.full_name}`);
            beepSuccess(); flashOk();
            return;
          }
        }

        // الطالب حاضر بالفعل — تحقق من نافذة منع التكرار قبل فتح حوار الاستئذان
        const checkInAt = existing.check_in_time ? new Date(existing.check_in_time).getTime() : 0;
        const sinceCheckIn = now - checkInAt;
        if (dupEnabled && sinceCheckIn < permWindowMs) {
          // ضمن النافذة → اعتبره مسح متكرر بالخطأ، لا تفتح حوار الاستئذان
          pushLog(false, `${student.full_name} — تم تسجيل حضوره مسبقاً ✅`, 'مكرر');
          toast.success(`تم تسجيل حضور ${student.full_name} مسبقاً ✅`);
          beepDuplicate();
          setDupCard({ name: student.full_name, status: existing.status as AttendanceStatus });
          setTimeout(() => setDupCard(null), 2500);
          // سجل حدث المسح المكرر للتقارير
          supabase.from('scan_events').insert({
            kind: 'duplicate', student_id: student.id, actor_id: user!.id,
            meta: { since_check_in_seconds: Math.round(sinceCheckIn / 1000) },
          }).then(() => {});
          return;
        }

        // مر وقت كافٍ — نسأل المستخدم: تجاهل أم إصدار استذان
        setDupCtx({
          studentId: student.id,
          studentName: student.full_name,
          studentNumber: student.student_number,
          existingStatus: existing.status as AttendanceStatus,
        });
        setDupOpen(true);
        return;
      }

      // تسجيل حضور جديد — تحديد الحالة وفق وقت التأخر القابل للتعديل
      const finalStatus: AttendanceStatus = autoMode
        ? autoStatusByTime(new Date(), cfg.late_after_time ?? '07:30:00')
        : status;
      const nowIso = new Date().toISOString();
      const { error: insErr } = await supabase
        .from('attendance_records')
        .insert({ student_id: student.id, teacher_id: teacherId, status: finalStatus, date: today, check_in_time: nowIso });

      if (insErr) {
        pushLog(false, `فشل تسجيل ${student.full_name}: ${insErr.message}`);
        toast.error(insErr.message); beepError(); flashErr();
      } else {
        pushLog(true, `${student.full_name} (${student.student_number})`, STATUS_LABELS[finalStatus]);
        toast.success(`${STATUS_LABELS[finalStatus]}: ${student.full_name}`);
        beepSuccess(); flashOk();
      }
    } catch {
      pushLog(false, 'تعذر الاتصال بسجلات الطلاب أو الحضور');
      toast.error('تعذر الاتصال بقاعدة البيانات؛ لم يتم تسجيل العملية');
      beepError(); flashErr();
    } finally {
      processing.current = false;
    }
  }

  function dismissDup() {
    setDupOpen(false);
    pushLog(false, `${dupCtx?.studentName} مسجَّل مسبقاً اليوم — تم التجاهل`, 'مكرر');
    setDupCtx(null);
    focusInput();
  }
  function openPermFromDup() {
    setDupOpen(false);
    setPermReason('خروج من المدرسة');
    setPermNotes('');
    setPermOpen(true);
  }
  async function createPermission() {
    if (!dupCtx || !user) return;
    if (!school?.slug) {
      toast.error('تعذر تحديد المدرسة المرتبطة بهذا الحساب');
      return;
    }
    const reason = permReason || 'خروج من المدرسة';
    const { error } = await createAdminPermissionRequest({
      studentId: dupCtx.studentId,
      schoolSlug: school.slug,
      reason,
      notes: permNotes,
    });
    if (error) {
      toast.error(error.message);
      pushLog(false, `فشل إصدار استذان لـ ${dupCtx.studentName}: ${error.message}`);
    } else {
      toast.success(`تم إرسال استئذان ${dupCtx.studentName} إلى قسم «استئذان الإدارة»`);
      pushLog(true, `${dupCtx.studentName} (${dupCtx.studentNumber}) — استذان جديد`, 'استذان جديد');
      await supabase.from('scan_events').insert({
        kind: 'permission_issued', student_id: dupCtx.studentId, actor_id: user!.id,
        meta: { reason, request_source: 'administration' },
      });
    }
    setPermOpen(false);
    setDupCtx(null);
    focusInput();
  }

  const statusButtons: { value: AttendanceStatus; icon: typeof CheckCircle2; cls: string }[] = [
    { value: 'present', icon: CheckCircle2, cls: 'bg-success text-success-foreground' },
    { value: 'late', icon: Clock, cls: 'bg-warning text-warning-foreground' },
    { value: 'absent', icon: XCircle, cls: 'bg-destructive text-destructive-foreground' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">مسح الباركود</h1>
          <p className="mt-1 text-sm text-muted-foreground">المسح الأول يسجّل الحضور، والمسح الثاني يستهلك استذان الخروج إن وُجد</p>
        </div>
        {!isAdmin && teacherStage && (
          <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary">
            <ShieldAlert className="h-3 w-3" /> مرحلتك: {STAGE_LABELS[teacherStage]}
          </Badge>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6 shadow-soft relative overflow-visible">
          {flash === 'ok' && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-success/15 animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="h-32 w-32 text-success drop-shadow-[0_0_20px_hsl(var(--success))]" strokeWidth={3} />
            </div>
          )}
          {flash === 'err' && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-destructive/15 animate-in fade-in zoom-in duration-200">
              <XCircle className="h-32 w-32 text-destructive" strokeWidth={3} />
            </div>
          )}
          {dupCard && (
            <div className="pointer-events-none absolute right-4 top-4 z-20 max-w-xs rounded-xl border border-success/30 bg-success/10 px-4 py-3 shadow-lg backdrop-blur animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-bold text-success">{dupCard.name}</p>
                  <p className="text-xs text-success/80">تم تسجيل حضوره مسبقاً</p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              {statusButtons.map((b) => (
                <Button
                  key={b.value}
                  disabled={autoMode}
                  onClick={() => setStatus(b.value)}
                  className={`gap-2 ${status === b.value ? b.cls + ' shadow-glow' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} ${autoMode ? 'opacity-50' : ''}`}
                >
                  <b.icon className="h-4 w-4" /> {STATUS_LABELS[b.value]}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer rounded-lg border bg-muted/30 px-3 py-2">
              <input type="checkbox" checked={autoMode} onChange={(e) => setAutoMode(e.target.checked)} />
              <span className="font-semibold">وضع تلقائي</span>
              <span className="text-muted-foreground">(متأخر بعد {(settings?.late_after_time ?? '07:30:00').slice(0,5)})</span>
            </label>
          </div>

          <Tabs defaultValue="keyboard">
            <TabsList className="mb-4">
              <TabsTrigger value="keyboard" className="gap-2"><Keyboard className="h-4 w-4" /> ماسح/لوحة مفاتيح</TabsTrigger>
              <TabsTrigger value="camera" className="gap-2"><Camera className="h-4 w-4" /> كاميرا الهاتف</TabsTrigger>
            </TabsList>
            <TabsContent value="keyboard">
              <form onSubmit={handleSubmit}>
                <div className="relative">
                  <ScanLine className="absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 text-primary" />
                  <Input
                    ref={inputRef}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setSuggestionsOpen(true);
                      setActiveSuggestion(-1);
                    }}
                    onFocus={() => {
                      if (isStudentNameQuery(code)) setSuggestionsOpen(true);
                    }}
                    onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                    onKeyDown={handleSuggestionKeyDown}
                    placeholder="اسم الطالب أو رقمه أو امسح الباركود"
                    className="h-16 pr-14 text-center text-xl font-mono tracking-widest shadow-soft"
                    dir="auto"
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={suggestionsOpen && isStudentNameQuery(code)}
                    aria-controls="scan-student-suggestions"
                    aria-activedescendant={activeSuggestion >= 0 ? `scan-student-option-${activeSuggestion}` : undefined}
                    autoFocus
                  />
                  {suggestionsOpen && isStudentNameQuery(code) && (
                    <div
                      id="scan-student-suggestions"
                      role="listbox"
                      aria-label="اقتراحات أسماء الطلاب"
                      className="absolute inset-x-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border bg-background p-1 shadow-xl"
                    >
                      {suggestionLoading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-4 text-sm text-muted-foreground" role="status">
                          <Loader2 className="h-4 w-4 animate-spin" /> جارٍ البحث في سجلات المدرسة...
                        </div>
                      ) : suggestionError ? (
                        <p className="px-4 py-4 text-center text-sm text-destructive">تعذر البحث عن أسماء الطلاب</p>
                      ) : suggestions.length === 0 ? (
                        <p className="px-4 py-4 text-center text-sm text-muted-foreground">لا توجد أسماء مطابقة في سجلات هذه المدرسة</p>
                      ) : (
                        suggestions.map((suggestion, index) => (
                          <button
                            key={suggestion.id}
                            id={`scan-student-option-${index}`}
                            type="button"
                            role="option"
                            aria-selected={activeSuggestion === index}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void selectSuggestion(suggestion)}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-right transition-colors ${
                              activeSuggestion === index ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">{suggestion.full_name}</span>
                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                  رقم الطالب: {suggestion.student_number}
                                  {suggestion.classes?.name ? ` · ${suggestion.classes.name}` : ''}
                                </span>
                              </span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {STAGE_LABELS[suggestion.stage as keyof typeof STAGE_LABELS] ?? suggestion.stage}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </form>
            </TabsContent>
            <TabsContent value="camera">
              <CameraScanner onDetected={(text) => processCode(text.trim())} />
            </TabsContent>
          </Tabs>
          <p className="mt-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            اكتب أول حروف الاسم واختر الطالب من الاقتراحات، أو أدخل الرقم/امسح الباركود · المسح الأول حضور
          </p>
        </Card>

        <Card className="p-4 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <AlertCircle className="h-4 w-4" /> آخر العمليات
          </h3>
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {log.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">لا توجد عمليات بعد</p>}
            {log.map((e, i) => (
              <div key={i} className={`rounded-lg border p-3 text-sm ${e.ok ? 'border-success/20 bg-success/5' : 'border-destructive/20 bg-destructive/5'}`}>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{e.time}</span>
                  {e.tag && <Badge variant="outline" className="text-xs gap-1">
                    {e.tag.includes('استذان') && <LogOut className="h-3 w-3" />}
                    {e.tag}
                  </Badge>}
                </div>
                <p className="mt-1 font-medium">{e.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Duplicate scan dialog */}
      <AlertDialog open={dupOpen} onOpenChange={(o) => { if (!o) dismissDup(); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>الطالب مسجَّل مسبقاً اليوم</AlertDialogTitle>
            <AlertDialogDescription>
              {dupCtx && (<>
                تم تسجيل حضور <b>{dupCtx.studentName}</b> ({dupCtx.studentNumber}) كـ
                <b className="px-1">{STATUS_LABELS[dupCtx.existingStatus]}</b>
                — هل تريد إصدار <b>استذان خروج</b> له، أم تجاهل المسح؟
              </>)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={dismissDup}>تجاهل المسح</AlertDialogCancel>
            <AlertDialogAction onClick={openPermFromDup} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
              <LogOut className="h-4 w-4" /> إصدار استذان
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permission form */}
      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إصدار استذان — {dupCtx?.studentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>السبب</Label>
              <Input value={permReason} onChange={(e) => setPermReason(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea value={permNotes} onChange={(e) => setPermNotes(e.target.value)} rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">سيتم استهلاك الاستذان تلقائياً عند المسح التالي للطالب اليوم.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPermOpen(false); setDupCtx(null); focusInput(); }}>إلغاء</Button>
            <Button onClick={createPermission} className="bg-gradient-primary">إرسال استئذان للإدارة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
