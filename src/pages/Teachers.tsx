import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { STAGE_LABELS, type Stage } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Teacher { id: string; user_id: string | null; full_name: string; email: string; stage: Stage; is_admin?: boolean }

export default function Teachers() {
  const { isAdmin } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', stage: 'primary' as Stage, password: '', is_admin: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = 'المعلمون | نظام الضاحية'; load(); }, []);

  async function load() {
    const { data: ts } = await supabase.from('teachers').select('*').order('full_name');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').eq('role', 'admin');
    const adminSet = new Set((roles ?? []).map((r: any) => r.user_id));
    setTeachers(((ts ?? []) as Teacher[]).map((t) => ({ ...t, is_admin: t.user_id ? adminSet.has(t.user_id) : false })));
  }

  function openNew() { setEditing(null); setForm({ full_name: '', email: '', stage: 'primary', password: '', is_admin: false }); setOpen(true); }
  function openEdit(t: Teacher) { setEditing(t); setForm({ full_name: t.full_name, email: t.email, stage: t.stage, password: '', is_admin: !!t.is_admin }); setOpen(true); }

  async function save() {
    if (!form.full_name || !form.email) { toast.error('الاسم والبريد مطلوبان'); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('teachers')
          .update({ full_name: form.full_name, email: form.email, stage: form.stage })
          .eq('id', editing.id);
        if (error) { toast.error(error.message); return; }
        toast.success('تم التحديث');
      } else {
        if (!form.password || form.password.length < 6) { toast.error('كلمة المرور 6 أحرف على الأقل'); return; }
        const { data, error } = await supabase.functions.invoke('admin-create-teacher', {
          body: { email: form.email, password: form.password, full_name: form.full_name, stage: form.stage, is_admin: form.is_admin },
        });
        if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message || 'خطأ'); return; }
        toast.success('تمت إضافة المعلم وإنشاء الحساب');
      }
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  async function remove(t: Teacher) {
    if (!confirm(`حذف المعلم ${t.full_name}؟`)) return;
    const { error } = await supabase.from('teachers').delete().eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    toast.success('تم الحذف'); load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">المعلمون</h1>
          <p className="mt-1 text-sm text-muted-foreground">{teachers.length} معلم</p>
        </div>
        {isAdmin && <Button onClick={openNew} className="bg-gradient-primary shadow-soft"><Plus className="ml-2 h-4 w-4" /> إضافة معلم</Button>}
      </header>

      <Card className="shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>البريد</TableHead>
              <TableHead>المرحلة</TableHead>
              <TableHead>الحساب</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.full_name}</TableCell>
                <TableCell className="font-mono text-xs" dir="ltr">{t.email}</TableCell>
                <TableCell><Badge variant="secondary">{STAGE_LABELS[t.stage]}</Badge></TableCell>
                <TableCell>
                  {t.is_admin
                    ? <Badge className="gap-1 bg-accent text-accent-foreground"><ShieldCheck className="h-3 w-3" />إداري</Badge>
                    : t.user_id
                      ? <Badge variant="outline">معلم</Badge>
                      : <Badge variant="outline" className="text-muted-foreground">لا حساب</Badge>}
                </TableCell>
                <TableCell>
                  {isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {teachers.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">لا يوجد معلمون</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing ? 'تعديل معلم' : 'إضافة معلم'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>الاسم الكامل</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2">
              <Label>المرحلة</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as Stage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              لربط المعلم بحساب تسجيل دخول: اطلب منه إنشاء حساب بنفس البريد، ثم من صفحة الإعدادات اربط الحساب بالدور المناسب.
            </p>
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
