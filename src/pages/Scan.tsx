import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScanLine, CheckCircle2, AlertCircle, Clock, XCircle, LogOut, ArrowLeftRight, Keyboard, Camera } from 'lucide-react';
import { STATUS_LABELS, todayISO, type AttendanceStatus } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import CameraScanner from '@/components/CameraScanner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LogEntry { time: string; ok: boolean; text: string; tag?: string }

export default function Scan() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [log, setLog] = useState<LogEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'مسح الباركود | نظام الضاحية';
    inputRef.current?.focus();
    if (user) {
      supabase.from('teachers').select('id').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setTeacherId(data?.id ?? null));
    }
  }, [user]);

  function pushLog(ok: boolean, text: string, tag?: string) {
    setLog((l) => [{ time: new Date().toLocaleTimeString('ar-SA'), ok, text, tag }, ...l].slice(0, 30));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setCode('');
    await processCode(trimmed);
    focusInput();
  }

  async function processCode(trimmed: string) {
    const { data: student, error } = await supabase
      .from('students').select('id, full_name, student_number')
      .eq('barcode', trimmed).maybeSingle();

    if (error || !student) {
      pushLog(false, `باركود غير معروف: ${trimmed}`);
      toast.error('باركود غير معروف');
      return;
    }

    const today = todayISO();
    const { data: existing } = await supabase
      .from('attendance_records').select('id, status')
      .eq('student_id', student.id).eq('date', today).maybeSingle();

    if (existing) {
      const { data: perm } = await supabase
        .from('permissions').select('id, status, reason')
        .eq('student_id', student.id).eq('date', today).eq('status', 'pending').maybeSingle();

      if (perm) {
        const nowIso = new Date().toISOString();
        const { error: updErr } = await supabase
          .from('permissions').update({ status: 'used', used_at: nowIso }).eq('id', perm.id);
        if (updErr) {
          pushLog(false, `تعذّر استهلاك الاستذان: ${updErr.message}`);
          toast.error(updErr.message);
        } else {
          await supabase.from('permission_logs').insert({
            permission_id: perm.id, action: 'used', actor_id: user!.id,
          });
          pushLog(true, `${student.full_name} (${student.student_number}) — تم تسجيل الخروج`, 'استذان');
          toast.success(`تم استهلاك الاستذان: ${student.full_name}`);
        }
      } else {
        pushLog(false, `${student.full_name} مسجَّل حضوره مسبقاً اليوم — لا يوجد استذان`, 'مكرر');
        toast.error(`${student.full_name}: مسجَّل بالفعل اليوم`);
      }
      return;
    }

    const { error: insErr } = await supabase
      .from('attendance_records')
      .insert({ student_id: student.id, teacher_id: teacherId, status, date: today });

    if (insErr) {
      pushLog(false, `فشل تسجيل ${student.full_name}: ${insErr.message}`);
      toast.error(insErr.message);
    } else {
      pushLog(true, `${student.full_name} (${student.student_number})`, STATUS_LABELS[status]);
      toast.success(`${STATUS_LABELS[status]}: ${student.full_name}`);
    }
  }

  function focusInput() {
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const statusButtons: { value: AttendanceStatus; icon: typeof CheckCircle2; cls: string }[] = [
    { value: 'present', icon: CheckCircle2, cls: 'bg-success text-success-foreground' },
    { value: 'late', icon: Clock, cls: 'bg-warning text-warning-foreground' },
    { value: 'absent', icon: XCircle, cls: 'bg-destructive text-destructive-foreground' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">مسح الباركود</h1>
        <p className="mt-1 text-sm text-muted-foreground">المسح الأول يسجّل الحضور، والمسح الثاني يستهلك استذان الخروج إن وُجد</p>
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
            <p className="mt-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              مسح أول = حضور · مسح ثانٍ = استهلاك استذان الخروج
            </p>
          </form>
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
                    {e.tag === 'استذان' && <LogOut className="h-3 w-3" />}
                    {e.tag}
                  </Badge>}
                </div>
                <p className="mt-1 font-medium">{e.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
