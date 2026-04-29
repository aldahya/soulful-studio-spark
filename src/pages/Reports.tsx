import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_COLORS, formatDate, todayISO, type AttendanceStatus, whatsAppLink } from '@/lib/i18n';
import { Download, MessageCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface Row {
  id: string; status: AttendanceStatus; date: string;
  students: { full_name: string; student_number: string; parent_phone: string | null } | null;
}

export default function Reports() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = 'التقارير | نظام الضاحية'; load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('attendance_records')
      .select('id, status, date, students(full_name, student_number, parent_phone)')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false });
    setRows((data ?? []) as any);
    setLoading(false);
  }

  function exportExcel() {
    const data = rows.map((r) => ({
      'التاريخ': r.date,
      'الطالب': r.students?.full_name ?? '',
      'رقم الطالب': r.students?.student_number ?? '',
      'الحالة': STATUS_LABELS[r.status],
      'هاتف ولي الأمر': r.students?.parent_phone ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    (ws as any)['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير الحضور');
    XLSX.writeFile(wb, `تقرير_الحضور_${from}_${to}.xlsx`);
    toast.success('تم تصدير الملف');
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">التقارير</h1>
        <p className="mt-1 text-sm text-muted-foreground">تقارير الحضور حسب الفترة الزمنية</p>
      </header>

      <Card className="p-5 shadow-soft">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1"><Label className="text-xs">من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" /></div>
          <div className="space-y-1"><Label className="text-xs">إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" /></div>
          <Button onClick={load} className="bg-gradient-primary">عرض</Button>
          <Button onClick={exportExcel} variant="outline" disabled={rows.length === 0} className="gap-2">
            <Download className="h-4 w-4" /> تصدير Excel
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
                <TableHead>الرقم</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">واتساب</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const wa = whatsAppLink(r.students?.parent_phone, `إشعار حضور: ${r.students?.full_name} - ${STATUS_LABELS[r.status]} بتاريخ ${formatDate(r.date)}`);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium">{r.students?.full_name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{r.students?.student_number ?? '—'}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[r.status]} variant="outline">{STATUS_LABELS[r.status]}</Badge></TableCell>
                    <TableCell>
                      {wa
                        ? <Button asChild variant="ghost" size="icon"><a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 text-success" /></a></Button>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
