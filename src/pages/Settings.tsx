import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function Settings() {
  const { isAdmin, user } = useAuth();
  const [form, setForm] = useState({ id: '', school_name: '', subtitle: '', address: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => { document.title = 'الإعدادات | نظام الضاحية'; load(); }, []);

  async function load() {
    const { data } = await supabase.from('school_settings').select('*').limit(1).maybeSingle();
    if (data) setForm({ id: data.id, school_name: data.school_name, subtitle: data.subtitle, address: data.address ?? '', phone: data.phone ?? '' });
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('school_settings').update({
      school_name: form.school_name, subtitle: form.subtitle,
      address: form.address || null, phone: form.phone || null,
    }).eq('id', form.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('تم الحفظ');
  }

  async function makeMyselfAdmin() {
    if (!user) return;
    setLinking(true);
    const { error } = await supabase.from('user_roles').insert({ user_id: user.id, role: 'admin' });
    setLinking(false);
    if (error) { toast.error(error.message); return; }
    toast.success('تم منحك دور المدير. أعد تحميل الصفحة.');
    setTimeout(() => window.location.reload(), 1000);
  }

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted-foreground">إعدادات المدرسة والحساب</p>
      </header>

      <Card className="space-y-5 p-6 shadow-soft">
        <h2 className="text-lg font-bold">معلومات المدرسة</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>اسم المدرسة</Label><Input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} disabled={!isAdmin} /></div>
          <div className="space-y-2"><Label>العنوان الفرعي</Label><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} disabled={!isAdmin} /></div>
          <div className="space-y-2"><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!isAdmin} /></div>
          <div className="space-y-2"><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" disabled={!isAdmin} /></div>
        </div>
        {isAdmin && (
          <Button onClick={save} disabled={saving} className="bg-gradient-primary">
            {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            حفظ التغييرات
          </Button>
        )}
      </Card>

      {!isAdmin && (
        <Card className="space-y-4 border-accent/30 bg-accent/5 p-6 shadow-soft">
          <h2 className="text-lg font-bold">إعداد أولي</h2>
          <p className="text-sm text-muted-foreground">
            إذا كنت أول من يسجل في النظام (المدير المؤسس)، اضغط الزر أدناه لمنح حسابك صلاحيات المدير.
            بعدها يمكنك إنشاء حسابات أخرى ومنحها الأدوار من خلال إدارة الأدوار.
          </p>
          <Button onClick={makeMyselfAdmin} disabled={linking} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {linking && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            امنحني صلاحيات المدير
          </Button>
        </Card>
      )}
    </div>
  );
}
