import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface FormState {
  id: string;
  school_name: string;
  subtitle: string;
  address: string;
  phone: string;
  late_after_time: string; // HH:MM
  duplicate_window_seconds: number;
  duplicate_protection_enabled: boolean;
  permission_window_minutes: number;
}

export default function Settings() {
  const { isAdmin, user } = useAuth();
  const [form, setForm] = useState<FormState>({
    id: '', school_name: '', subtitle: '', address: '', phone: '',
    late_after_time: '07:30', duplicate_window_seconds: 20,
    duplicate_protection_enabled: true, permission_window_minutes: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => { document.title = 'الإعدادات | نظام الضاحية'; load(); }, []);

  async function load() {
    const { data } = await supabase.from('school_settings').select('*').limit(1).maybeSingle();
    if (data) {
      const d: any = data;
      setForm({
        id: d.id,
        school_name: d.school_name,
        subtitle: d.subtitle,
        address: d.address ?? '',
        phone: d.phone ?? '',
        late_after_time: (d.late_after_time ?? '07:30:00').slice(0, 5),
        duplicate_window_seconds: d.duplicate_window_seconds ?? 20,
        duplicate_protection_enabled: d.duplicate_protection_enabled ?? true,
        permission_window_minutes: d.permission_window_minutes ?? 5,
      });
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('school_settings').update({
      school_name: form.school_name,
      subtitle: form.subtitle,
      address: form.address || null,
      phone: form.phone || null,
      late_after_time: form.late_after_time.length === 5 ? form.late_after_time + ':00' : form.late_after_time,
      duplicate_window_seconds: Number(form.duplicate_window_seconds) || 20,
      duplicate_protection_enabled: form.duplicate_protection_enabled,
      permission_window_minutes: Number(form.permission_window_minutes) || 5,
    } as any).eq('id', form.id);
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
        <p className="mt-1 text-sm text-muted-foreground">إعدادات المدرسة ونظام الحضور</p>
      </header>

      <Card className="space-y-5 p-6 shadow-soft">
        <h2 className="text-lg font-bold">معلومات المدرسة</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>اسم المدرسة</Label><Input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} disabled={!isAdmin} /></div>
          <div className="space-y-2"><Label>العنوان الفرعي</Label><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} disabled={!isAdmin} /></div>
          <div className="space-y-2"><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!isAdmin} /></div>
          <div className="space-y-2"><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" disabled={!isAdmin} /></div>
        </div>
      </Card>

      <Card className="space-y-5 p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">إعدادات الحضور</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          هذه الإعدادات تتحكم بمنطق تسجيل الحضور والاستئذان عبر الباركود. أي تعديل ينعكس فوراً على شاشة المسح.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>وقت اعتبار الطالب متأخراً بعد</Label>
            <Input
              type="time"
              value={form.late_after_time}
              onChange={(e) => setForm({ ...form, late_after_time: e.target.value })}
              dir="ltr"
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground">أي مسح بعد هذا الوقت يُسجَّل تلقائياً كـ "متأخر".</p>
          </div>
          <div className="space-y-2">
            <Label>مدة منع تكرار المسح (بالثواني)</Label>
            <Input
              type="number" min={5} max={120}
              value={form.duplicate_window_seconds}
              onChange={(e) => setForm({ ...form, duplicate_window_seconds: Number(e.target.value) })}
              dir="ltr"
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground">إذا تكرر مسح نفس الباركود خلال هذه المدة يُعتبر تكرار بالخطأ.</p>
          </div>
          <div className="space-y-2">
            <Label>السماح بفتح نافذة الاستئذان بعد (بالدقائق)</Label>
            <Input
              type="number" min={1} max={240}
              value={form.permission_window_minutes}
              onChange={(e) => setForm({ ...form, permission_window_minutes: Number(e.target.value) })}
              dir="ltr"
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground">قبل هذه المدة من بداية الحضور يُعتبر المسح تكرار، وليس استئذان.</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> الحماية ضد التكرار</Label>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
              <Switch
                checked={form.duplicate_protection_enabled}
                onCheckedChange={(v) => setForm({ ...form, duplicate_protection_enabled: v })}
                disabled={!isAdmin}
              />
              <span className="text-sm">{form.duplicate_protection_enabled ? 'مفعّل' : 'معطّل'}</span>
            </div>
            <p className="text-xs text-muted-foreground">عند التعطيل يفتح كل مسح ثانٍ نافذة الاستئذان مباشرة.</p>
          </div>
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
