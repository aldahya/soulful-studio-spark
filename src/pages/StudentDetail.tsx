import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Printer, MessageCircle, Loader2 } from 'lucide-react';
import { STAGE_LABELS, STATUS_LABELS, STATUS_COLORS, type Stage, type AttendanceStatus, whatsAppLink, formatDate, whatsAppTarget } from '@/lib/i18n';
import { buildNotifyMessage } from '@/lib/whatsappTemplates';
import JsBarcode from 'jsbarcode';
import { sanitizeBarcode } from '@/lib/barcode';
import { useSchoolSettings, SCHOOL_LOGO } from '@/lib/school';

interface Student {
  id: string; student_number: string; full_name: string; stage: Stage;
  parent_phone: string | null; notes: string | null; barcode: string;
  classes: { name: string } | null;
}
interface Att { id: string; status: AttendanceStatus; date: string }

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [att, setAtt] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const settings = useSchoolSettings();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('students').select('*, classes(name)').eq('id', id).maybeSingle(),
      supabase.from('attendance_records').select('id, status, date').eq('student_id', id).order('date', { ascending: false }).limit(60),
    ]).then(([s, a]) => {
      setStudent(s.data as any);
      setAtt((a.data ?? []) as Att[]);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (student && barcodeRef.current) {
      JsBarcode(barcodeRef.current, sanitizeBarcode(student.barcode), { format: 'CODE128', width: 2.2, height: 80, fontSize: 16, margin: 8 });
    }
  }, [student]);

  function printBarcode() {
    if (!student || !barcodeRef.current) return;
    const svg = new XMLSerializer().serializeToString(barcodeRef.current);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl"><head><title>طباعة باركود</title>
      <style>body{font-family:Cairo,sans-serif;display:flex;flex-direction:column;align-items:center;padding:32px}h1{margin:8px 0}p{color:#555}</style>
      </head><body>
      <h1>${student.full_name}</h1><p>${student.student_number}</p>${svg}<p>${student.classes?.name ?? ''}</p>
      <script>setTimeout(()=>{window.print();},250)</script>
      </body></html>`);
    w.document.close();
  }

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!student) return <Card className="p-12 text-center">الطالب غير موجود</Card>;

  const stats = {
    present: att.filter((a) => a.status === 'present').length,
    late: att.filter((a) => a.status === 'late').length,
    absent: att.filter((a) => a.status === 'absent').length,
  };
  const todayMsg = buildNotifyMessage('present', {
    schoolName: settings?.school_name ?? 'مدارس الضاحية الأهلية للبنين',
    studentName: student.full_name,
    className: student.classes?.name ?? null,
    stage: student.stage,
    date: new Date(),
    time: new Date(),
  });
  const wa = whatsAppLink(student.parent_phone, todayMsg);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="gap-2"><Link to="/students"><ArrowRight className="h-4 w-4" /> عودة للقائمة</Link></Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6 shadow-soft">
          <div className="flex items-start gap-4">
            <img src={SCHOOL_LOGO} alt="شعار" className="h-16 w-16 object-contain" />
            <div className="flex-1">
              <Badge variant="secondary">{STAGE_LABELS[student.stage]}</Badge>
              <h1 className="mt-2 text-3xl font-extrabold">{student.full_name}</h1>
              <p className="text-sm text-muted-foreground">رقم: {student.student_number} • {student.classes?.name ?? 'بدون فصل'}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">هاتف ولي الأمر</dt><dd className="font-mono" dir="ltr">{student.parent_phone ?? '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">الباركود</dt><dd className="font-mono">{student.barcode}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">ملاحظات</dt><dd>{student.notes ?? '—'}</dd></div>
          </dl>
          <div className="mt-6 flex gap-2">
            {wa && <Button asChild variant="outline" className="gap-2"><a href={wa} target={whatsAppTarget()} rel="noopener noreferrer"><MessageCircle className="h-4 w-4 text-success" /> واتساب</a></Button>}
          </div>
        </Card>

        <Card className="flex flex-col items-center p-6 shadow-soft">
          <h3 className="mb-3 font-bold">الباركود</h3>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <svg ref={barcodeRef} />
          </div>
          <Button onClick={printBarcode} className="mt-4 w-full gap-2 bg-gradient-primary"><Printer className="h-4 w-4" /> طباعة</Button>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 shadow-soft"><p className="text-xs text-muted-foreground">حاضر</p><p className="mt-2 text-3xl font-extrabold text-success">{stats.present}</p></Card>
        <Card className="p-5 shadow-soft"><p className="text-xs text-muted-foreground">متأخر</p><p className="mt-2 text-3xl font-extrabold text-warning">{stats.late}</p></Card>
        <Card className="p-5 shadow-soft"><p className="text-xs text-muted-foreground">غائب</p><p className="mt-2 text-3xl font-extrabold text-destructive">{stats.absent}</p></Card>
      </div>

      <Card className="p-5 shadow-soft">
        <h3 className="mb-4 font-bold">آخر السجلات</h3>
        <div className="space-y-2">
          {att.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
              <span className="text-sm">{formatDate(a.date)}</span>
              <Badge className={STATUS_COLORS[a.status]} variant="outline">{STATUS_LABELS[a.status]}</Badge>
            </div>
          ))}
          {att.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد سجلات</p>}
        </div>
      </Card>
    </div>
  );
}
