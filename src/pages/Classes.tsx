import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { STAGE_LABELS, type Stage } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ClassRow { id: string; name: string; stage: Stage; grade: string; student_count?: number }

export default function Classes() {
  const { isAdmin } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState({ name: '', stage: 'primary' as Stage, grade: '' });

  useEffect(() => { document.title = 'الفصول | نظام الضاحية'; load(); }, []);

  async function load() {
    const { data: cs } = await supabase.from('classes').select('*').order('stage').order('name');
    const { data: counts } = await supabase.from('students').select('class_id');
    const map = new Map<string, number>();
    (counts ?? []).forEach((r: any) => { if (r.class_id) map.set(r.class_id, (map.get(r.class_id) ?? 0) + 1); });
    setClasses(((cs ?? []) as ClassRow[]).map((c) => ({ ...c, student_count: map.get(c.id) ?? 0 })));
  }

  function openNew() { setEditing(null); setForm({ name: '', stage: 'primary', grade: '' }); setOpen(true); }
  function openEdit(c: ClassRow) { setEditing(c); setForm({ name: c.name, stage: c.stage, grade: c.grade }); setOpen(true); }

  async function save() {
    if (!form.name || !form.grade) { toast.error('الاسم والصف مطلوبان'); return; }
    const { error } = editing
      ? await supabase.from('classes').update(form).eq('id', editing.id)
      : await supabase.from('classes').insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'تم التحديث' : 'تمت الإضافة');
    setOpen(false); load();
  }

  async function remove(c: ClassRow) {
    if (!confirm(`حذف فصل ${c.name}؟`)) return;
    const { error } = await supabase.from('classes').delete().eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    toast.success('تم الحذف'); load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">الفصول</h1>
          <p className="mt-1 text-sm text-muted-foreground">{classes.length} فصل</p>
        </div>
        {isAdmin && <Button onClick={openNew} className="bg-gradient-primary shadow-soft"><Plus className="ml-2 h-4 w-4" /> إضافة فصل</Button>}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <Card key={c.id} className="group p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="secondary">{STAGE_LABELS[c.stage]}</Badge>
                <h3 className="mt-3 text-lg font-bold">{c.name}</h3>
                <p className="text-sm text-muted-foreground">{c.grade}</p>
              </div>
              {isAdmin && (
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {c.student_count ?? 0} طالب
            </div>
          </Card>
        ))}
        {classes.length === 0 && <Card className="col-span-full p-12 text-center text-muted-foreground">لا توجد فصول بعد</Card>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing ? 'تعديل فصل' : 'فصل جديد'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>اسم الفصل</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: 1/أ" /></div>
            <div className="space-y-2"><Label>الصف</Label><Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="مثال: الأول" /></div>
            <div className="space-y-2">
              <Label>المرحلة</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as Stage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
