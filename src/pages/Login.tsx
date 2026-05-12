// src/pages/Login.tsx — النسخة المحدّثة لدعم متعدد المدارس
// يقرأ ?school=slug من الرابط ويعرض اسم وبيانات المدرسة الصحيحة
// عند إنشاء حساب جديد يربط المستخدم بالمدرسة المختارة تلقائياً

import { useState, useEffect } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SCHOOL_LOGO } from '@/lib/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ShieldCheck, UserPlus, ScanLine, BarChart3, FileSignature, Mail, Lock, User, Building2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── بيانات ثابتة للمدارس الأربع (لصفحة اللوجن فقط) ──────────
const SCHOOLS: Record<string, { name: string; subtitle: string; color: string; gradient: string }> = {
  'dahya-boys': {
    name:     'مدارس الضاحية الأهلية',
    subtitle: 'للبنين',
    color:    'hsl(178 55% 30%)',
    gradient: 'linear-gradient(140deg, hsl(195 50% 12%), hsl(178 55% 26%), hsl(172 42% 48%))',
  },
  'dahya-girls': {
    name:     'مدارس الضاحية الأهلية',
    subtitle: 'للبنات',
    color:    'hsl(338 65% 42%)',
    gradient: 'linear-gradient(140deg, hsl(340 50% 14%), hsl(338 60% 32%), hsl(350 55% 52%))',
  },
  'ajyal': {
    name:     'مدارس أجيال المعالي الأهلية',
    subtitle: 'للبنين والبنات',
    color:    'hsl(38 85% 44%)',
    gradient: 'linear-gradient(140deg, hsl(30 50% 12%), hsl(38 80% 30%), hsl(45 88% 50%))',
  },
  'qanadeel': {
    name:     'مدارس قناديل الشرق الأهلية',
    subtitle: 'للبنين والبنات',
    color:    'hsl(258 55% 44%)',
    gradient: 'linear-gradient(140deg, hsl(255 50% 12%), hsl(258 52% 32%), hsl(272 48% 52%))',
  },
};

const DEFAULT_SCHOOL = SCHOOLS['dahya-boys'];

export default function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const schoolSlug = searchParams.get('school') ?? 'dahya-boys';
  const schoolInfo = SCHOOLS[schoolSlug] ?? DEFAULT_SCHOOL;

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = `تسجيل الدخول | ${schoolInfo.name}`;
    // احفظ slug المدرسة عشان نستخدمه بعد التسجيل
    localStorage.setItem('school_slug', schoolSlug);
  }, [schoolSlug, schoolInfo.name]);

  if (!loading && session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('مرحباً بك');
        navigate('/', { replace: true });
      } else {
        // جيب school_id من جدول schools
        const { data: schoolRow, error: schoolErr } = await supabase
          .from('schools')
          .select('id')
          .eq('slug', schoolSlug)
          .single();

        if (schoolErr || !schoolRow) throw new Error('المدرسة غير موجودة، تواصل مع الإدارة');

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (signUpErr) throw signUpErr;

        // أضف user_role مع school_id (بدون منح دور — المدير يمنحه لاحقاً)
        if (signUpData.user) {
          await supabase.from('user_roles').insert({
            user_id:   signUpData.user.id,
            role:      'teacher',          // دور مؤقت، المدير يغيره
            school_id: schoolRow.id,
          });
        }

        toast.success('تم إنشاء الحساب — قد تحتاج لتأكيد البريد الإلكتروني');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    { icon: ScanLine,       title: 'مسح الباركود الذكي',   desc: 'تسجيل حضور الطلاب فورياً بنقرة واحدة' },
    { icon: FileSignature,  title: 'استذانات الخروج',       desc: 'إصدار وتتبع رقمي كامل خلال اليوم' },
    { icon: BarChart3,      title: 'تقارير وإحصائيات',     desc: 'تواصل مباشر مع أولياء الأمور عبر واتساب' },
  ];

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-gradient-mesh">
      {/* Blobs ديكورية */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full blur-3xl animate-blob"
           style={{ background: `${schoolInfo.color}33` }} />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full blur-3xl animate-blob"
           style={{ background: `${schoolInfo.color}20`, animationDelay: '4s' }} />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-10">

        {/* لوحة البراند */}
        <aside className="hidden lg:flex flex-col justify-between rounded-3xl p-10 text-white shadow-xl min-h-[640px]"
               style={{ background: schoolInfo.gradient }}>
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-2 backdrop-blur ring-1 ring-white/20">
                <img src={SCHOOL_LOGO} alt="شعار المدرسة" className="h-12 w-12 object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">{schoolInfo.name}</h2>
                <p className="text-xs text-white/70">{schoolInfo.subtitle} — مجموعة المالكي التعليمية</p>
              </div>
            </div>

            <div className="mt-14 space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/30">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                نظام الحضور الذكي
              </span>
              <h1 className="text-4xl font-extrabold leading-tight">
                إدارة حضور المدرسة
                <br />أصبحت أبسط بكثير
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-white/75">
                منصة احترافية متكاملة للحضور والاستذانات والتقارير، مصممة لمدارسنا بواجهة عربية حديثة وأمان عالٍ.
              </p>
            </div>
          </div>

          <ul className="mt-10 space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-3 rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-white/65">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* رابط الرجوع للبوابة الرئيسية */}
          <a
            href="/"
            className="mt-6 flex items-center gap-2 text-xs text-white/60 hover:text-white/90 transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>العودة لبوابة مجموعة المالكي</span>
          </a>
        </aside>

        {/* نموذج تسجيل الدخول */}
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-3xl bg-card/95 p-8 shadow-xl ring-1 ring-border/50 backdrop-blur">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-2xl"
                   style={{ background: schoolInfo.gradient }}>
                <img src={SCHOOL_LOGO} alt="" className="h-full w-full object-contain p-2" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                {mode === 'signin' ? 'مرحباً بعودتك 👋' : 'إنشاء حساب جديد'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {schoolInfo.name} — {schoolInfo.subtitle}
              </p>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as 'signin' | 'signup')}>
              <TabsList className="mb-6 grid w-full grid-cols-2 rounded-xl bg-muted p-1">
                <TabsTrigger value="signin" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <ShieldCheck className="h-4 w-4" /> دخول
                </TabsTrigger>
                <TabsTrigger value="signup" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <UserPlus className="h-4 w-4" /> حساب جديد
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-semibold">الاسم الكامل</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)}
                             required className="h-11 pr-10" placeholder="مثال: أحمد محمد" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                           required dir="ltr" className="h-11 pr-10 text-left" placeholder="name@school.sa" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold">كلمة المرور</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                           required minLength={6} dir="ltr" className="h-11 pr-10 text-left" placeholder="••••••••" />
                  </div>
                </div>

                <Button type="submit"
                  className="h-12 w-full text-base font-bold shadow-md text-white transition-all hover:opacity-90"
                  style={{ background: schoolInfo.gradient }}
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
                </Button>
              </form>

              <TabsContent value="signup">
                <p className="mt-4 rounded-lg bg-muted p-3 text-center text-xs text-muted-foreground ring-1 ring-border">
                  بعد إنشاء حسابك سيقوم المدير بمنحك دور <strong>المعلم</strong> أو <strong>الإداري</strong>.
                </p>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>محمي بواسطة Supabase</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
