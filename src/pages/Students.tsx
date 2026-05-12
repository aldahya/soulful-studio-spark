import { useEffect, useRef, useState } from 'react';
  import { supabase } from '@/integrations/supabase/client';
  import { Card } from '@/components/ui/card';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
  import { Badge } from '@/components/ui/badge';
  import { Plus, Search, Pencil, Trash2, ExternalLink, Loader2, Upload, Download, Printer, FileDown, AlertTriangle } from 'lucide-react';
  import { STAGE_LABELS, type Stage } from '@/lib/i18n';
  import { useAuth } from '@/hooks/useAuth';
  import { Link } from 'react-router-dom';
  import { toast } from 'sonner';
  import * as XLSX from 'xlsx';
  import { downloadBarcodeSVG, printBarcodes, stageLabel } from '@/lib/barcode';
  import { useSchoolSettings } from '@/lib/school';

  interface Student {
    id: string;
    student_number: string;
    full_name: string;
    stage: Stage;
    class_id: string | null;
    parent_phone: string | null;
    notes: string | null;
    barcode: string;
    classes?: { name: string } | null;
  }
  interface ClassRow { id: string; name: string; stage: Stage }
  interface AttSummary { present: number; late: number; absent: number; total: number; rate: number | null }

  const ABSENCE_ALERT_THRESHOLD = 25; // % absence triggers warning

  export default function Students() {
    const { isAdmin } = useAuth();
    const settings = useSchoolSettings();
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<ClassRow[]>([]);
    const [attSummary, setAttSummary] = useState<Map<string, AttSummary>>(new Map());
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState<string>('all');
    const [classFilter, setClassFilter] = useState<string>('all');
    const [alertOnly, setAlertOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Student | null>(null);
    const [form, setForm] = useState({ student_number: '', full_name: '', stage: 'primary' as Stage, class_id: '', parent_phone: '', notes: '' });
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const fileRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    useEffect(() => { document.title = 'الطلاب | نظام الضاحية'; load(); }, []);

    async function load() {
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartISO = monthStart.toISOString().slice(0, 10);
      const todayISO = new Date().toISOString().slice(0, 10);

      const [s, c, monthAtt] = await Promise.all([
        supabase.from('students').select('*, classes(name)').order('full_name').limit(2000),
        supabase.from('classes').select('id, name, stage').order('name'),
        supabase.from('attendance_records').select('student_id, status').gte('date', monthStartISO).lte('date', todayISO),
      ]);
      setStudents((s.data ?? []) as Student[]);
      setClasses((c.data ?? []) as ClassRow[]);

      // Build per-student attendance summary for current month
      const summaryMap = new Map<string, AttSummary>();
      (monthAtt.data ?? []).forEach((r: any) => {
        const entry = summaryMap.get(r.student_id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: null };
        entry.total++;
        if (r.status === 'present') entry.present++;
        else if (r.status === 'late') entry.late++;
        else if (r.status === 'absent') entry.absent++;
        summaryMap.set(r.student_id, entry);
      });
      summaryMap.forEach((v, k) => {
        v.rate = v.total > 0 ? Math.round(((v.present + v.late) / v.total) * 100) : null;
        summaryMap.set(k, v);
      });
      setAttSummary(summaryMap);
      setLoading(false);
    }

    function nextStudentNumber(): string {
      const nums = students.map((s) => parseInt(s.student_number, 10)).filter((n) => !isNaN(n));
      const max = nums.length ? Math.max(...nums) : 1000;
      return String(max + 1);
    }

    function openNew() {
      setEditing(null);
      setForm({ student_number: nextStudentNumber(), full_name: '', stage: 'primary', class_id: '', parent_phone: '', notes: '' });
      setOpen(true);
    }
    function openEdit(s: Student) {
      setEditing(s);
      setForm({
        student_number: s.student_number, full_name: s.full_name, stage: s.stage,
        class_id: s.class_id ?? '', parent_phone: s.parent_phone ?? '', notes: s.notes ?? '',
      });
      setOpen(true);
    }

    async function save() {
      if (!form.full_name) { toast.error('الاسم مطلوب'); return; }
      const studentNumber = form.student_number || nextStudentNumber();
      const payload = {
        student_number: studentNumber,
        full_name: form.full_name,
        stage: form.stage,
        class_id: form.class_id || null,
        parent_phone: form.parent_phone || null,
        notes: form.notes || null,
        barcode: `ALD-${studentNumber}`,
      };
      const { error } = editing
        ? await supabase.from('students').update(payload).eq('id', editing.id)
        : await supabase.from('students').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(editing ? 'تم تحديث الطالب' : 'تمت إضافة الطالب');
      setOpen(false); load();
    }

    async function remove(s: Student) {
      if (!confirm(`حذف الطالب ${s.full_name}؟`)) return;
      const { error } = await supabase.from('students').delete().eq('id', s.id);
      if (error) { toast.error(error.message); return; }
      toast.success('تم الحذف'); load();
    }

    function downloadTemplate() {
      const ws = XLSX.utils.json_to_sheet([
        { 'الاسم الكامل': 'أحمد محمد', 'رقم الطالب': '1001', 'المرحلة': 'ابتدائي', 'الفصل': '', 'هاتف ولي الأمر': '0555555555', 'ملاحظات': '' },
      ]);
      (ws as any)['!views'] = [{ RTL: true }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
      XLSX.writeFile(wb, 'قالب_استيراد_الطلاب.xlsx');
    }

    function exportExcel() {
      const data = students.map((s) => {
        const sum = attSummary.get(s.id);
        return {
          'رقم الطالب': s.student_number,
          'الاسم الكامل': s.full_name,
          'المرحلة': STAGE_LABELS[s.stage],
          'الفصل': s.classes?.name ?? '',
          'هاتف ولي الأمر': s.parent_phone ?? '',
          'الباركود': s.barcode,
          'نسبة الحضور (الشهر الحالي)': sum?.rate != null ? `${sum.rate}%` : '—',
          'أيام حاضر': sum?.present ?? 0,
          'أيام غائب': sum?.absent ?? 0,
          'ملاحظات': s.notes ?? '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      (ws as any)['!views'] = [{ RTL: true }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
      XLSX.writeFile(wb, `الطلاب_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    const stageReverse: Record<string, Stage> = { 'ابتدائي': 'primary', 'متوسط': 'intermediate', 'ثانوي': 'secondary', primary: 'primary', intermediate: 'intermediate', secondary: 'secondary' };

    async function handleImport(file: File) {
      setImporting(true);
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
        if (!rows.length) { toast.error('الملف فارغ'); return; }

        const classByName = new Map(classes.map((c) => [c.name.trim(), c]));
        let baseNum = parseInt(nextStudentNumber(), 10);
        const payloads: any[] = [];
        const errors: string[] = [];

        rows.forEach((r, i) => {
          const name = String(r['الاسم الكامل'] ?? r['الاسم'] ?? r['name'] ?? '').trim();
          if (!name) { errors.push(`السطر ${i + 2}: لا يوجد اسم`); return; }
          const stageRaw = String(r['المرحلة'] ?? r['stage'] ?? 'ابتدائي').trim();
          const stage = stageReverse[stageRaw] ?? 'primary';
          const numRaw = String(r['رقم الطالب'] ?? r['number'] ?? '').trim();
          const studentNumber = numRaw || String(baseNum++);
          const className = String(r['الفصل'] ?? r['class'] ?? '').trim();
          const cls = className ? classByName.get(className) : null;
          payloads.push({
            student_number: studentNumber,
            full_name: name,
            stage,
            class_id: cls?.id ?? null,
            parent_phone: String(r['هاتف ولي الأمر'] ?? r['phone'] ?? '').trim() || null,
            notes: String(r['ملاحظات'] ?? r['notes'] ?? '').trim() || null,
            barcode: `ALD-${studentNumber}`,
          });
        });

        if (!payloads.length) { toast.error('لا توجد صفوف صالحة'); return; }

        const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
        const existingNames = new Set(students.map((s) => normalize(s.full_name)));
        const names = Array.from(new Set(payloads.map((p) => normalize(p.full_name))));
        const { data: existingRows } = await supabase.from('students').select('full_name').in('full_name', names);
        (existingRows ?? []).forEach((r: any) => existingNames.add(normalize(r.full_name)));

        const seenInBatch = new Set<string>();
        const fresh = payloads.filter((p) => {
          const n = normalize(p.full_name);
          if (existingNames.has(n) || seenInBatch.has(n)) return false;
          seenInBatch.add(n);
          return true;
        });
        const skipped = payloads.length - fresh.length;

        let inserted = 0;
        for (let i = 0; i < fresh.length; i += 200) {
          const chunk = fresh.slice(i, i + 200);
          const { error } = await supabase.from('students').insert(chunk);
          if (error) { errors.push(error.message); break; }
          inserted += chunk.length;
        }
        if (errors.length) toast.error(`أُدخل ${inserted}. تم تخطي ${skipped}. أخطاء: ${errors.slice(0, 2).join(' | ')}`);
        else toast.success(`تم استيراد ${inserted} طالب${skipped ? ` — تم تخطي ${skipped} موجود مسبقاً` : ''}`);
        load();
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    }

    function toggleSelect(id: string) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
    function toggleAll(visible: Student[]) {
      setSelected((prev) => {
        const allChecked = visible.every((s) => prev.has(s.id));
        if (allChecked) return new Set();
        return new Set(visible.map((s) => s.id));
      });
    }

    function printSelected() {
      const items = students.filter((s) => selected.has(s.id));
      if (!items.length) { toast.error('لم يتم اختيار طلاب'); return; }
      printBarcodes(items.map((s) => ({
        name: s.full_name, number: s.student_number, barcode: s.barcode,
        class_name: s.classes?.name ?? null, stage_label: stageLabel(s.stage),
        parent_phone: s.parent_phone,
      })), settings?.school_name, settings?.subtitle ?? '');
    }

    const filtered = students.filter((s) => {
      if (stageFilter !== 'all' && s.stage !== stageFilter) return false;
      if (classFilter !== 'all' && (s.class_id ?? '') !== classFilter) return false;
      if (search && !(s.full_name.includes(search) || s.student_number.includes(search) || s.barcode.includes(search))) return false;
      if (alertOnly) {
        const sum = attSummary.get(s.id);
        if (!sum || sum.rate === null) return false;
        const absenceRate = sum.total > 0 ? Math.round((sum.absent / sum.total) * 100) : 0;
        if (absenceRate < ABSENCE_ALERT_THRESHOLD) return false;
      }
      return true;
    });

    const alertCount = students.filter((s) => {
      const sum = attSummary.get(s.id);
      if (!sum || sum.total === 0) return false;
      return Math.round((sum.absent / sum.total) * 100) >= ABSENCE_ALERT_THRESHOLD;
    }).length;

    function rateColor(rate: number | null) {
      if (rate === null) return 'text-muted-foreground';
      if (rate >= 80) return 'text-success font-bold';
      if (rate >= 65) return 'text-warning font-bold';
      return 'text-destructive font-bold';
    }

    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">الطلاب</h1>
            <p className="mt-1 text-sm text-muted-foreground">{students.length} طالب مسجَّل</p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} استيراد Excel
              </Button>
              <Button variant="outline" onClick={downloadTemplate} className="gap-2"><FileDown className="h-4 w-4" /> قالب</Button>
              <Button variant="outline" onClick={exportExcel} className="gap-2"><Download className="h-4 w-4" /> تصدير Excel</Button>
              <Button onClick={openNew} className="bg-gradient-primary shadow-soft"><Plus className="ml-2 h-4 w-4" /> إضافة طالب</Button>
            </div>
          )}
        </header>

        {alertCount > 0 && (
          <button
            onClick={() => setAlertOnly((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-right transition-colors ${alertOnly ? 'border-destructive bg-destructive/10 text-destructive' : 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10'}`}
          >
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-sm font-medium">
              {alertCount} طالب {alertOnly ? '(معروض الآن)' : ''} — نسبة غيابهم تجاوزت {ABSENCE_ALERT_THRESHOLD}% هذا الشهر
            </span>
            <span className="text-xs underline">{alertOnly ? 'عرض الكل' : 'عرض فقط'}</span>
          </button>
        )}

        <Card className="shadow-soft">
          <div className="border-b border-border/40 p-4 flex flex-wrap gap-3 items-end">
            <div className="relative max-w-md flex-1 min-w-[220px]">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم أو الباركود..." className="pr-10" />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="المرحلة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المراحل</SelectItem>
                {Object.entries(STAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="الفصل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفصول</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selected.size > 0 && (
              <Button onClick={printSelected} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <Printer className="h-4 w-4" /> طباعة {selected.size} باركود
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))} onCheckedChange={() => toggleAll(filtered)} />
                  </TableHead>
                  <TableHead>رقم الطالب</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>المرحلة</TableHead>
                  <TableHead>الفصل</TableHead>
                  <TableHead>حضور الشهر</TableHead>
                  <TableHead>الباركود</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const sum = attSummary.get(s.id);
                  const absenceRate = sum && sum.total > 0 ? Math.round((sum.absent / sum.total) * 100) : 0;
                  const hasAlert = sum && sum.total > 0 && absenceRate >= ABSENCE_ALERT_THRESHOLD;
                  return (
                    <TableRow key={s.id} data-state={selected.has(s.id) ? 'selected' : undefined} className={hasAlert ? 'bg-destructive/5' : undefined}>
                      <TableCell><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} /></TableCell>
                      <TableCell className="font-mono text-xs">{s.student_number}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {hasAlert && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" title={`غياب ${absenceRate}%`} />}
                          {s.full_name}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{STAGE_LABELS[s.stage]}</Badge></TableCell>
                      <TableCell>{s.classes?.name ?? '—'}</TableCell>
                      <TableCell>
                        {sum && sum.total > 0 ? (
                          <div className="flex flex-col gap-1 min-w-[80px]">
                            <span className={`text-sm ${rateColor(sum.rate)}`}>{sum.rate}%</span>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${sum.rate ?? 0}%`,
                                  background: sum.rate !== null && sum.rate >= 80
                                    ? 'hsl(var(--success))'
                                    : sum.rate !== null && sum.rate >= 65
                                    ? 'hsl(var(--warning))'
                                    : 'hsl(var(--destructive))',
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{sum.present + sum.late}/{sum.total} يوم</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">لا سجلات</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.barcode}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="تحميل الباركود" onClick={() => downloadBarcodeSVG(s.barcode, `${s.barcode}.svg`)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="طباعة الباركود" onClick={() => printBarcodes([{ name: s.full_name, number: s.student_number, barcode: s.barcode, class_name: s.classes?.name ?? null, stage_label: stageLabel(s.stage), parent_phone: s.parent_phone }], settings?.school_name, settings?.subtitle ?? '')}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button asChild variant="ghost" size="icon"><Link to={`/students/${s.id}`}><ExternalLink className="h-4 w-4" /></Link></Button>
                          {isAdmin && <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">لا توجد نتائج</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>{editing ? 'تعديل طالب' : 'إضافة طالب'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>رقم الطالب <span className="text-xs text-muted-foreground">(تلقائي إذا تُرك فارغاً)</span></Label>
                <Input value={form.student_number} onChange={(e) => setForm({ ...form, student_number: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>الاسم الكامل</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>المرحلة</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as Stage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الفصل</Label>
                <Select value={form.class_id || 'none'} onValueChange={(v) => setForm({ ...form, class_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="اختر فصلاً" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون فصل —</SelectItem>
                    {classes.filter((c) => c.stage === form.stage).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>هاتف ولي الأمر</Label><Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} dir="ltr" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={save} className="bg-gradient-primary">{editing ? 'حفظ التعديلات' : 'إضافة الطالب'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  