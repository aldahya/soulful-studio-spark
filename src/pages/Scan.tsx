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
import { ScanLine, CheckCircle2, AlertCircle, Clock, XCircle, LogOut, ArrowLeftRight, Keyboard, Camera, ShieldAlert } from 'lucide-react';
import { STATUS_LABELS, STAGE_LABELS, todayISO, type AttendanceStatus } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import CameraScanner from '@/components/CameraScanner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { beepSuccess, beepError, autoStatusByTime } from '@/lib/feedback';

interface LogEntry { time: string; ok: boolean; text: string; tag?: string }
interface DupContext {
  studentId: string; studentName: string; studentNumber: string; existingStatus: AttendanceStatus;
}

const RESCAN_COOLDOWN_MS = 1500; // أسرع — منع المسح المتكرر بالخطأ

export default function Scan() {
  const { user, isAdmin, teacherId, teacherStage } = useAuth();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [autoMode, setAutoMode] = useState(true); // تلقائي: متأخر بعد 7:30
  const [log, setLog] = useState<LogEntry[]>([]);
  const [flash, setFlash] = useState<null | 'ok' | 'err'>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const processing = useRef(false);

  // duplicate dialog
  const [dupOpen, setDupOpen] = useState(false);
  const [dupCtx, setDupCtx] = useState<DupContext | null>(null);

  // permission dialog
  const [permOpen, setPermOpen] = useState(false);
  const [permReason, setPermReason] = useState('خروج من المدرسة');
  const [permNotes, setPermNotes] = useState('');

  useEffect(() => {
    document.title = 'مسح الباركود | نظام الضاحية';
    inputRef.current?.focus();
  }, [user]);

  function pushLog(ok: boolean, text: string, tag?: string) {
    setLog((l) => [{ time: new Date().toLocaleTimeString('ar-SA'), ok, text, tag }, ...l].slice(0, 30));
  }
  function focusInput() { setTimeout(() => inputRef.current?.focus(), 50); }
  function flashOk() { setFlash('ok'); setTimeout(() => setFlash(null), 700); }
  function flashErr() { setFlash('err'); setTimeout(() => setFlash(null), 700); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setCode('');
    await processCode(trimmed);
    focusInput();
  }

  async function processCode(trimmed: string) {
    if (processing.current) return;
    // منع المسح المتكرر بالخطأ خلال نافذة قصيرة
    const now = Date.now();
    if (lastScan.current.code === trimmed && now - lastScan.current.at < RESCAN_COOLDOWN_MS) {
      pushLog(false, `تجاهل مسح مكرر سريع: ${trimmed}`, 'تكرار');
      return;
    }
    lastScan.current = { code: trimmed, at: now };
    processing.current = true;
    try {
      const { data: student, error } = await supabase
        .from('students').select('id, full_name, student_number, stage')
        .eq('barcode', trimmed).maybeSingle();

      if (error || !student) {
        pushLog(false, `باركود غير معروف: ${trimmed}`);
        toast.error('باركود غير معروف');
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
            pushLog(true, `${student.full_name} (${student.student_number}) — تم تسجيل الخروج`, 'استذان');
            toast.success(`تم استهلاك الاستذان: ${student.full_name}`);
            beepSuccess(); flashOk();
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
            pushLog(true, `${student.full_name} — تم تسجيل العودة`, 'عودة');
            toast.success(`عودة الطالب: ${student.full_name}`);
            beepSuccess(); flashOk();
            return;
          }
        }

        // لا يوجد استذان — نسأل المستخدم: تجاهل أم إصدار استذان
        setDupCtx({
          studentId: student.id,
          studentName: student.full_name,
          studentNumber: student.student_number,
          existingStatus: existing.status as AttendanceStatus,
        });
        setDupOpen(true);
        return;
      }

      // تسجيل حضور جديد — تحديد الحالة تلقائياً (بعد 7:30 = متأخر)
      const finalStatus: AttendanceStatus = autoMode ? autoStatusByTime() : status;
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
    if (!dupCtx) return;
    const { error } = await supabase.from('permissions').insert({
      student_id: dupCtx.studentId,
      teacher_id: teacherId,
      issued_by: user!.id,
      reason: permReason || 'خروج من المدرسة',
      notes: permNotes || null,
      date: todayISO(),
      status: 'pending',
    });
    if (error) {
      toast.error(error.message);
      pushLog(false, `فشل إصدار استذان لـ ${dupCtx.studentName}: ${error.message}`);
    } else {
      toast.success(`تم إصدار استذان لـ ${dupCtx.studentName}`);
      pushLog(true, `${dupCtx.studentName} (${dupCtx.studentNumber}) — استذان جديد`, 'استذان جديد');
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
        <Card className="lg:col-span-2 p-6 shadow-soft">
          <div className="mb-6 flex flex-wrap gap-2">
            {statusButtons.map((b) => (
              <Button
                key={b.value}
                onClick={() => setStatus(b.value)}
                className={`gap-2 ${status === b.value ? b.cls + ' shadow-glow' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
              >
                <b.icon className="h-4 w-4" /> {STATUS_LABELS[b.value]}
              </Button>
            ))}
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
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ALD-..."
                    className="h-16 pr-14 text-center text-xl font-mono tracking-widest shadow-soft"
                    dir="ltr"
                    autoFocus
                  />
                </div>
              </form>
            </TabsContent>
            <TabsContent value="camera">
              <CameraScanner onDetected={(text) => processCode(text.trim())} />
            </TabsContent>
          </Tabs>
          <p className="mt-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            مسح أول = حضور · مسح ثانٍ = استهلاك استذان الخروج
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
            <Button onClick={createPermission} className="bg-gradient-primary">حفظ الاستذان</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
