import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { STAGE_LABELS, type Stage } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

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

export default function Students() {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({ student_number: '', full_name: '', stage: 'primary' as Stage, class_id: '', parent_phone: '', notes: '' });

  useEffect(() => {
    document.title = 'الطلاب | نظام الضاحية';
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [s, c] = await Promise.all([
      supabase.from('students').select('*, classes(name)').order('full_name'),
      supabase.from('classes').select('id, name, stage').order('name'),
    ]);
    setStudents((s.data ?? []) as Student[]);
    setClasses((c.data ?? []) as ClassRow[]);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ student_number: '', full_name: '', stage: 'primary', class_id: '', parent_phone: '', notes: '' });
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
    if (!form.student_number || !form.full_name) { toast.error('الاسم ورقم الطالب مطلوبان'); return; }
    const payload = {
      student_number: form.student_number,
      full_name: form.full_name,
      stage: form.stage,
      class_id: form.class_id || null,
      parent_phone: form.parent_phone || null,
      notes: form.notes || null,
      barcode: `ALD-${form.student_number}`,
    };
    const { error } = editing
      ? await supabase.from('students').update(payload).eq('id', editing.id)
      : await supabase.from('students').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'تم تحديث الطالب' : 'تمت إضافة الطالب');
    setOpen(false);
    load();
  }

  async function remove(s: Student) {
    if (!confirm(`حذف الطالب ${s.full_name}؟`)) return;
    const { error } = await supabase.from('students').delete().eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    toast.success('تم الحذف');
    load();
  }

  const filtered = students.filter((s) =>
    !search || s.full_name.includes(search) || s.student_number.includes(search) || s.barcode.includes(search),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">الطلاب</h1>
          <p className="mt-1 text-sm text-muted-foreground">{students.length} طالب مسجَّل</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="bg-gradient-primary shadow-soft">
            <Plus className="ml-2 h-4 w-4" /> إضافة طالب
          </Button>
        )}
      </header>

      <Card className="shadow-soft">
        <div className="border-b border-border/40 p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم أو الباركود..." className="pr-10" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطالب</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>المرحلة</TableHead>
                <TableHead>الفصل</TableHead>
                <TableHead>هاتف ولي الأمر</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.student_number}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell><Badge variant="secondary">{STAGE_LABELS[s.stage]}</Badge></TableCell>
                  <TableCell>{s.classes?.name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{s.parent_phone ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon"><Link to={`/students/${s.id}`}><ExternalLink className="h-4 w-4" /></Link></Button>
                      {isAdmin && <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">لا توجد نتائج</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing ? 'تعديل طالب' : 'إضافة طالب'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>رقم الطالب</Label><Input value={form.student_number} onChange={(e) => setForm({ ...form, student_number: e.target.value })} /></div>
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save} className="bg-gradient-primary">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
