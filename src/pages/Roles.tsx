import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Shield, UserCog, Trash2, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { STAGE_LABELS, type Stage } from '@/lib/i18n';
import { toast } from 'sonner';

interface RoleRow {
  id: string;
  user_id: string;
  role: 'admin' | 'teacher';
  email: string;
  full_name: string;
  stage: Stage | null;
  teacher_id: string | null;
}

export default function Roles() {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'teacher'>('teacher');

  useEffect(() => { document.title = 'الأدوار والصلاحيات | نظام الضاحية'; load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: roles }, { data: profiles }, { data: teachers }] = await Promise.all([
      supabase.from('user_roles').select('id, user_id, role'),
      supabase.from('profiles').select('user_id, full_name'),
      supabase.from('teachers').select('id, user_id, email, full_name, stage'),
    ]);
    const teacherByUser = new Map<string, any>();
    (teachers ?? []).forEach((t: any) => { if (t.user_id) teacherByUser.set(t.user_id, t); });
    const profileByUser = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => profileByUser.set(p.user_id, p));

    const data: RoleRow[] = (roles ?? []).map((r: any) => {
      const t = teacherByUser.get(r.user_id);
      const p = profileByUser.get(r.user_id);
      return {
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        email: t?.email ?? '—',
        full_name: t?.full_name ?? p?.full_name ?? '—',
        stage: (t?.stage as Stage) ?? null,
        teacher_id: t?.id ?? null,
      };
    });
    setRows(data);
    setLoading(false);
  }

  async function updateStage(row: RoleRow, stage: Stage) {
    if (!row.teacher_id) {
      toast.error('هذا الحساب غير مرتبط بسجل معلم — أنشئ المعلم من صفحة المعلمين أولاً.');
      return;
    }
    setSavingId(row.id);
    const { error } = await supabase.from('teachers').update({ stage }).eq('id', row.teacher_id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success('تم تحديث المرحلة');
    setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, stage } : r));
  }

  async function removeRole(row: RoleRow) {
    if (row.user_id === user?.id && row.role === 'admin') {
      toast.error('لا يمكنك إزالة دور المدير عن حسابك الحالي.');
      return;
    }
    if (!confirm(`إزالة دور ${row.role === 'admin' ? 'المدير' : 'المعلم'} عن ${row.full_name}؟`)) return;
    const { error } = await supabase.from('user_roles').delete().eq('id', row.id);
    if (error) return toast.error(error.message);
    toast.success('تم الحذف');
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  }

  async function grantRole() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return toast.error('أدخل بريداً إلكترونياً');
    const { data: t } = await supabase.from('teachers').select('user_id, full_name').eq('email', email).maybeSingle();
    if (!t?.user_id) {
      toast.error('لم يُعثر على مستخدم بهذا البريد ضمن المعلمين. أنشئ سجلًا للمعلم أو اطلب منه تسجيل الدخول أولاً.');
      return;
    }
    const { error } = await supabase.from('user_roles').insert({ user_id: t.user_id, role: newRole });
    if (error) return toast.error(error.message);
    toast.success(`تم منح ${newRole === 'admin' ? 'المدير' : 'المعلم'} لـ ${t.full_name}`);
    setNewEmail('');
    load();
  }

  if (!isAdmin) {
    return <div className="p-6 text-center text-muted-foreground">هذه الصفحة للمدير فقط.</div>;
  }

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">الأدوار والصلاحيات</h1>
        <p className="mt-1 text-sm text-muted-foreground">إدارة المديرين والمعلمين والمراحل المرتبطة بدالة has_role.</p>
      </header>

      <Card className="space-y-4 p-6 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Shield className="h-5 w-5 text-primary" /> منح دور جديد</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="space-y-1">
            <Label>البريد الإلكتروني للمستخدم</Label>
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} dir="ltr" placeholder="user@example.com" />
          </div>
          <div className="space-y-1">
            <Label>الدور</Label>
            <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">معلم</SelectItem>
                <SelectItem value="admin">مدير</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={grantRole} className="bg-gradient-primary"><Save className="ml-2 h-4 w-4" /> منح الدور</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">يجب أن يكون للمستخدم سجل في جدول المعلمين (نفس البريد) لربطه بالنظام قبل منح الدور.</p>
      </Card>

      <Card className="p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><UserCog className="h-5 w-5 text-primary" /> الحسابات والأدوار الحالية</h2>
        <div className="space-y-2">
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أدوار بعد.</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{r.full_name}</p>
                  <Badge variant={r.role === 'admin' ? 'default' : 'outline'} className={r.role === 'admin' ? 'bg-primary text-primary-foreground' : ''}>
                    {r.role === 'admin' ? 'مدير' : 'معلم'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground" dir="ltr">{r.email}</p>
              </div>
              {r.role === 'teacher' && (
                <Select
                  value={r.stage ?? undefined}
                  onValueChange={(v: any) => updateStage(r, v)}
                  disabled={savingId === r.id || !r.teacher_id}
                >
                  <SelectTrigger className="w-44"><SelectValue placeholder="المرحلة" /></SelectTrigger>
                  <SelectContent>
                    {(['primary','intermediate','secondary'] as Stage[]).map((s) => (
                      <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="icon" onClick={() => removeRole(r)} className="text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
