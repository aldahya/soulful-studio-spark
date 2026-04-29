import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { STATUS_LABELS, STATUS_COLORS, formatDate, todayISO, type AttendanceStatus } from '@/lib/i18n';
import { Loader2 } from 'lucide-react';

interface Row {
  id: string; status: AttendanceStatus; date: string; recorded_at: string;
  students: { full_name: string; student_number: string } | null;
  teachers: { full_name: string } | null;
}

export default function Attendance() {
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'سجل الحضور | نظام الضاحية'; }, []);
  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('attendance_records')
      .select('id, status, date, recorded_at, students(full_name, student_number), teachers(full_name)')
      .eq('date', date)
      .order('recorded_at', { ascending: false });
    setRows((data ?? []) as any);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">سجل الحضور</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatDate(date)} — {rows.length} سجل</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="d" className="text-xs">التاريخ</Label>
          <Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </header>

      <Card className="shadow-soft">
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الرقم</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>المعلم</TableHead>
                <TableHead>الوقت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.students?.full_name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.students?.student_number ?? '—'}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[r.status]} variant="outline">{STATUS_LABELS[r.status]}</Badge></TableCell>
                  <TableCell>{r.teachers?.full_name ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground" dir="ltr">{new Date(r.recorded_at).toLocaleTimeString('ar-SA')}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">لا توجد سجلات لهذا اليوم</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
