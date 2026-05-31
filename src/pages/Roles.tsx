// صفحة الأدوار والصلاحيات — إنشاء حسابات + تعيين المراحل + إدارة الأقسام
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Shield, UserCog, Trash2, UserPlus, RefreshCw,
  Eye, EyeOff, ChevronDown, ChevronUp, RotateCcw, Save,
  LayoutDashboard, ScanLine, FileSignature, Bell, QrCode,
  Users, GraduationCap, ClipboardList, FileBarChart, Settings, HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { STAGE_LABELS, type Stage } from '@/lib/i18n';
import { toast } from 'sonner';

// ── تعريف جميع الصفحات القابلة للتفعيل/التعطيل ─────────────────────────────
const ALL_PAGES = [
  // الأساسية (افتراضية للمعلمين)
  { key: 'scan',            label: 'مسح الباركود',        icon: ScanLine,       group: 'basic' },
  { key: 'permissions',     label: 'الاستذانات',           icon: FileSignature,  group: 'basic' },
  { key: 'parent-requests', label: 'طلبات أولياء الأمور', icon: Bell,           group: 'basic' },
  { key: 'attendance',      label: 'سجل الحضور',          icon: ClipboardList,  group: 'basic' },
  { key: 'reports',         label: 'التقارير',             icon: FileBarChart,   group: 'basic' },
  { key: 'how-it-works',    label: 'كيف يعمل النظام؟',   icon: HelpCircle,     group: 'basic' },
  // إضافية (للمدير فقط بالافتراضي)
  { key: 'students',        label: 'الطلاب',               icon: Users,          group: 'extra' },
  { key: 'classes',         label: 'الفصول',               icon: GraduationCap,  group: 'extra' },
  { key: 'teachers',        label: 'المعلمون',             icon: UserCog,        group: 'extra' },
  { key: 'school-qr',       label: 'QR Code المدرسة',     icon: QrCode,         group: 'extra' },
  { key: 'settings',        label: 'الإعدادات',            icon: Settings,       group: 'extra' },
  { key: 'roles',           label: 'الأدوار والصلاحيات',  icon: Shield,         group: 'extra' },
];

const DEFAULT_TEACHER_PAGES = new Set([
  'scan', 'permissions', 'parent-requests', 'attendance', 'reports', 'how-it-works',
]);

function generatePassword(length = 10): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface RoleRow {
  id: string;
  user_id: string;
  role: 'admin' | 'teacher';
  email: string;
  full_name: string;
  stage: Stage | null;
  all_stages: boolean;
  allowed_pages: string[] | null;
  teacher_id: string | null;
}

// ── لوحة إدارة الأقسام لمعلم محدد ──────────────────────────────────────────
function PagesPanel({ row, onSaved }: { row: RoleRow; onSaved: (pages: string[] | null) => void }) {
  const isCustom = row.allowed_pages !== null;
  // إذا كانت null → ابدأ بالصفحات الافتراضية
  const [selected, setSelected] = useState<Set<string>>(
    new Set(isCustom ? row.allowed_pages! : Array.from(DEFAULT_TEACHER_PAGES))
  );
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!row.teacher_id) { toast.error('الحساب غير مرتبط بسجل معلم'); return; }
    setSaving(true);
    const pages = Array.from(selected);
    const { error } = await supabase
      .from('teachers')
      .update({ allowed_pages: pages } as any)
      .eq('id', row.teacher_id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('تم حفظ الصلاحيات');
    onSaved(pages);
  }

  async function resetToDefault() {
    if (!row.teacher_id) return;
    setSaving(true);
    const { error } = await supabase
      .from('teachers')
      .update({ allowed_pages: null } as any)
      .eq('id', row.teacher_id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('أُعيدت الصلاحيات للافتراضي');
    setSelected(new Set(DEFAULT_TEACHER_PAGES));
    onSaved(null);
  }

  const basic = ALL_PAGES.filter((p) => p.group === 'basic');
  const extra = ALL_PAGES.filter((p) => p.group === 'extra');

  return (
    <div className="mt-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-4" dir="rtl">
      {/* لوحة التحكم — دائماً مفعّلة */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1 border-b">
        <LayoutDashboard className="h-3.5 w-3.5" />
        <span className="font-semibold">لوحة التحكم</span>
        <Badge variant="outline" className="text-xs py-0">مفعّلة دائماً</Badge>
      </div>

      {/* الصفحات الأساسية */}
      <div>
        <p className="text-xs font-bold text-muted-foreground mb-2">الصفحات الأساسية</p>
        <div className="grid grid-cols-2 gap-2">
          {basic.map((p) => {
            const Icon = p.icon;
            return (
              <label
                key={p.key}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm ${
                  selected.has(p.key)
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <Checkbox
                  checked={selected.has(p.key)}
                  onCheckedChange={() => toggle(p.key)}
                  className="shrink-0"
                />
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{p.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* الصفحات الإضافية */}
      <div>
        <p className="text-xs font-bold text-amber-600 mb-2">صلاحيات إضافية (للمدير بالافتراضي)</p>
        <div className="grid grid-cols-2 gap-2">
          {extra.map((p) => {
            const Icon = p.icon;
            return (
              <label
                key={p.key}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm ${
                  selected.has(p.key)
                    ? 'border-amber-500 bg-amber-50 text-amber-800 font-medium'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <Checkbox
                  checked={selected.has(p.key)}
                  onCheckedChange={() => toggle(p.key)}
                  className="shrink-0"
                />
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{p.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* أزرار الحفظ */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
          حفظ الصلاحيات
        </Button>
        <Button size="sm" variant="outline" onClick={resetToDefault} disabled={saving}>
          <RotateCcw className="h-4 w-4 ml-1" />
          إعادة للافتراضي
        </Button>
      </div>
    </div>
  );
}

// ── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function Roles() {
  const { isAdmin, user, school, schoolId } = useAuth();

  const [rows, setRows]         = useState<RoleRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'teacher' as 'admin' | 'teacher',
    stage: 'primary' as Stage,
    all_stages: false,
    password: generatePassword(),
  });

  const [grantEmail, setGrantEmail] = useState('');
  const [grantRole, setGrantRole]   = useState<'admin' | 'teacher'>('teacher');

  useEffect(() => { document.title = 'الأدوار والصلاحيات | نظام الضاحية'; load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: roles }, { data: teachers }] = await Promise.all([
      supabase.from('user_roles').select('id, user_id, role, school_id'),
      supabase.from('teachers').select('id, user_id, email, full_name, stage, all_stages, allowed_pages'),
    ]);
    const teacherByUser = new Map<string, any>();
    (teachers ?? []).forEach((t: any) => { if (t.user_id) teacherByUser.set(t.user_id, t); });

    const data: RoleRow[] = (roles ?? []).map((r: any) => {
      const t = teacherByUser.get(r.user_id);
      return {
        id: r.id, user_id: r.user_id, role: r.role,
        email:         t?.email ?? '—',
        full_name:     t?.full_name ?? '—',
        stage:         (t?.stage as Stage) ?? null,
        all_stages:    t?.all_stages === true,
        allowed_pages: t?.allowed_pages ?? null,
        teacher_id:    t?.id ?? null,
      };
    });
    setRows(data);
    setLoading(false);
  }

  async function createAccount() {
    const { full_name, email, role, stage, all_stages, password } = form;
    if (!full_name.trim() || !email.trim() || !password.trim()) {
      return toast.error('يرجى تعبئة الاسم والبريد وكلمة المرور');
    }
    if (password.length < 6) return toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${(supabase as any).supabaseUrl}/functions/v1/admin-create-teacher`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            full_name: full_name.trim(),
            email: email.trim().toLowerCase(),
            password,
            stage: all_stages ? null : stage,
            all_stages,
            is_admin: role === 'admin',
            school_id: schoolId,
          }),
        }
      );
      const result = await resp.json();
      if (!resp.ok || result.error) { toast.error(result.error ?? 'فشل إنشاء الحساب'); return; }
      toast.success(`✅ تم إنشاء حساب ${full_name.trim()} بنجاح`);
      setForm({ full_name: '', email: '', role: 'teacher', stage: 'primary', all_stages: false, password: generatePassword() });
      load();
    } finally {
      setCreating(false);
    }
  }

  async function updateStage(row: RoleRow, stage: Stage) {
    if (!row.teacher_id) { toast.error('هذا الحساب غير مرتبط بسجل معلم'); return; }
    setSavingId(row.id);
    const { error } = await supabase.from('teachers').update({ stage, all_stages: false }).eq('id', row.teacher_id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success('تم تحديث المرحلة');
    setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, stage, all_stages: false } : r));
  }

  async function toggleAllStages(row: RoleRow, checked: boolean) {
    if (!row.teacher_id) return;
    setSavingId(row.id);
    const { error } = await supabase.from('teachers').update({ all_stages: checked }).eq('id', row.teacher_id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success(checked ? 'يرى جميع المراحل' : 'محدود بمرحلة واحدة');
    setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, all_stages: checked } : r));
  }

  async function doGrant() {
    const email = grantEmail.trim().toLowerCase();
    if (!email) return toast.error('أدخل بريداً إلكترونياً');
    const { data: t } = await supabase.from('teachers').select('user_id, full_name').eq('email', email).maybeSingle();
    if (!t?.user_id) { toast.error('لم يُعثر على مستخدم بهذا البريد'); return; }
    const { error } = await supabase.from('user_roles').insert({ user_id: t.user_id, role: grantRole, school_id: schoolId });
    if (error) return toast.error(error.message);
    toast.success(`تم منح الدور لـ ${t.full_name}`);
    setGrantEmail('');
    load();
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

  if (!isAdmin) return <div className="p-6 text-center text-muted-foreground">هذه الصفحة للمدير فقط.</div>;
  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">الأدوار والصلاحيات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {school?.name} — إنشاء حسابات المعلمين وتعيين المراحل والأقسام
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className="h-4 w-4 ml-1" />تحديث
        </Button>
      </header>

      {/* إنشاء حساب جديد */}
      <Card className="p-6 shadow-soft space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UserPlus className="h-5 w-5 text-primary" />
          إنشاء حساب جديد
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>الاسم الكامل <span className="text-red-500">*</span></Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="محمد عبدالله"
            />
          </div>
          <div className="space-y-1">
            <Label>البريد الإلكتروني <span className="text-red-500">*</span></Label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@school.sa"
              dir="ltr"
              type="email"
            />
          </div>
          <div className="space-y-1">
            <Label>الدور</Label>
            <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">معلم</SelectItem>
                <SelectItem value="admin">مدير</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>المرحلة الدراسية</Label>
            <Select
              value={form.stage}
              onValueChange={(v: any) => setForm({ ...form, stage: v })}
              disabled={form.all_stages}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(STAGE_LABELS) as [Stage, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="all_stages"
                checked={form.all_stages}
                onCheckedChange={(v) => setForm({ ...form, all_stages: !!v })}
              />
              <Label htmlFor="all_stages" className="cursor-pointer">
                يرى جميع المراحل (all_stages) — المعلم لن يُقيَّد بمرحلة واحدة
              </Label>
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>كلمة المرور المؤقتة <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  type={showPw ? 'text' : 'password'}
                  dir="ltr"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setForm({ ...form, password: generatePassword() })}>
                توليد
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              سيتمكن المستخدم من تغيير كلمة المرور بعد تسجيل الدخول
            </p>
          </div>
        </div>
        <Button onClick={createAccount} disabled={creating} className="w-full sm:w-auto">
          {creating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <UserPlus className="h-4 w-4 ml-2" />}
          إنشاء الحساب
        </Button>
      </Card>

      {/* منح دور لمستخدم موجود */}
      <Card className="space-y-4 p-6 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Shield className="h-5 w-5 text-primary" />
          منح دور لمستخدم موجود مسبقاً
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-[220px]">
            <Label>البريد الإلكتروني</Label>
            <Input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} dir="ltr" placeholder="user@example.com" />
          </div>
          <div className="space-y-1">
            <Label>الدور</Label>
            <Select value={grantRole} onValueChange={(v: any) => setGrantRole(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">معلم</SelectItem>
                <SelectItem value="admin">مدير</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={doGrant}>منح الدور</Button>
        </div>
      </Card>

      {/* الحسابات الحالية */}
      <Card className="p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <UserCog className="h-5 w-5 text-primary" />
          الحسابات الحالية
          <span className="text-sm font-normal text-muted-foreground mr-1">({rows.length})</span>
        </h2>
        <div className="space-y-3">
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">لا توجد حسابات بعد.</p>}
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border bg-muted/20 overflow-hidden">
              {/* صف الحساب */}
              <div className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold">{r.full_name}</p>
                    <Badge variant={r.role === 'admin' ? 'default' : 'outline'}>
                      {r.role === 'admin' ? 'مدير' : 'معلم'}
                    </Badge>
                    {r.all_stages && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        جميع المراحل
                      </Badge>
                    )}
                    {r.role === 'teacher' && r.allowed_pages !== null && (
                      <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                        صلاحيات مخصصة ({r.allowed_pages.length} قسم)
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground" dir="ltr">{r.email}</p>
                </div>

                {r.role === 'teacher' && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* تبديل all_stages */}
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id={`as-${r.id}`}
                        checked={r.all_stages}
                        disabled={savingId === r.id || !r.teacher_id}
                        onCheckedChange={(v) => toggleAllStages(r, !!v)}
                      />
                      <label htmlFor={`as-${r.id}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                        كل المراحل
                      </label>
                    </div>

                    {/* تعيين المرحلة */}
                    <Select
                      value={r.stage ?? undefined}
                      onValueChange={(v: any) => updateStage(r, v)}
                      disabled={savingId === r.id || !r.teacher_id || r.all_stages}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="اختر المرحلة" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(STAGE_LABELS) as [Stage, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {savingId === r.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}

                    {/* زر إدارة الأقسام */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="text-xs gap-1"
                    >
                      {expandedId === r.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      إدارة الأقسام
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline" size="icon"
                  onClick={() => removeRole(r)}
                  className="text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* لوحة الأقسام — تظهر عند الضغط */}
              {expandedId === r.id && r.role === 'teacher' && (
                <div className="border-t px-4 pb-4">
                  <PagesPanel
                    row={r}
                    onSaved={(pages) => {
                      setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, allowed_pages: pages } : x));
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
