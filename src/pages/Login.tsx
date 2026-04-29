import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings, SCHOOL_LOGO } from '@/lib/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ShieldCheck, UserPlus, ScanLine, BarChart3, FileSignature, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const settings = useSchoolSettings();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'تسجيل الدخول | نظام الضاحية الذكي';
  }, []);

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success('تم إنشاء الحساب — قد تحتاج لتأكيد البريد الإلكتروني');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    { icon: ScanLine, title: 'مسح الباركود الذكي', desc: 'تسجيل حضور الطلاب فورياً بنقرة واحدة' },
    { icon: FileSignature, title: 'استذانات الخروج', desc: 'إصدار وتتبع رقمي كامل خلال اليوم' },
    { icon: BarChart3, title: 'تقارير وإحصائيات', desc: 'تواصل مباشر مع أولياء الأمور عبر واتساب' },
  ];

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-gradient-mesh">
      {/* Decorative animated blobs */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/30 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-primary/20 blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-blob" style={{ animationDelay: '8s' }} />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-10">
        {/* Brand / pitch panel */}
        <aside className="hidden lg:flex flex-col justify-between rounded-3xl glass-dark p-10 text-white shadow-elevated min-h-[640px]">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-2 backdrop-blur ring-1 ring-white/20">
                <img src={SCHOOL_LOGO} alt="شعار المدرسة" className="h-12 w-12 object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">{settings?.school_name ?? 'مدارس الضاحية الأهلية'}</h2>
                <p className="text-xs text-white/70">{settings?.subtitle ?? 'إحدى مدارس المالكي التعليمية'}</p>
              </div>
            </div>

            <div className="mt-14 space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand/30 px-3 py-1 text-xs font-medium ring-1 ring-brand/50">
                <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                نظام الحضور الذكي
              </span>
              <h1 className="text-4xl font-extrabold leading-tight">
                إدارة <span className="text-gradient-brand">حضور المدرسة</span>
                <br /> أصبحت أبسط بكثير
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-white/75">
                منصة احترافية متكاملة للحضور والاستذانات والتقارير، مصممة لمدارسنا بواجهة عربية حديثة وأمان عالٍ.
              </p>
            </div>
          </div>

          <ul className="mt-10 space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10">
                <div className="rounded-lg bg-brand/30 p-2 ring-1 ring-brand/40">
                  <f.icon className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="text-sm font-bold">{f.title}</p>
                  <p className="text-xs text-white/70">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-xs text-white/50">
            © {new Date().getFullYear()} {settings?.school_name ?? 'مدارس الضاحية'} — جميع الحقوق محفوظة
          </p>
        </aside>

        {/* Auth card */}
        <div className="mx-auto w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="rounded-2xl bg-white/70 p-3 shadow-soft ring-1 ring-border backdrop-blur">
              <img src={SCHOOL_LOGO} alt="شعار" className="h-16 w-16 object-contain" />
            </div>
            <h1 className="mt-3 text-xl font-extrabold text-foreground">{settings?.school_name ?? 'مدارس الضاحية الأهلية'}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{settings?.subtitle ?? 'نظام إدارة الحضور والانصراف'}</p>
          </div>

          <div className="rounded-3xl glass p-7 shadow-brand sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold tracking-tight">
                {mode === 'signin' ? 'مرحباً بعودتك 👋' : 'إنشاء حساب جديد'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === 'signin'
                  ? 'سجّل الدخول للوصول إلى لوحة التحكم'
                  : 'سجّل بياناتك ليتم منحك الصلاحيات لاحقاً من المدير'}
              </p>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as 'signin' | 'signup')}>
              <TabsList className="mb-6 grid w-full grid-cols-2 rounded-xl bg-muted p-1">
                <TabsTrigger value="signin" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft">
                  <ShieldCheck className="h-4 w-4" /> دخول
                </TabsTrigger>
                <TabsTrigger value="signup" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft">
                  <UserPlus className="h-4 w-4" /> حساب جديد
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-semibold">الاسم الكامل</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-11 pr-10" placeholder="مثال: أحمد محمد" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" className="h-11 pr-10 text-left" placeholder="name@school.sa" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold">كلمة المرور</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" className="h-11 pr-10 text-left" placeholder="••••••••" />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="group relative h-12 w-full overflow-hidden bg-gradient-primary text-base font-bold shadow-glow transition-all hover:shadow-brand"
                  disabled={submitting}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
                  </span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </Button>
              </form>

              <TabsContent value="signup">
                <p className="mt-4 rounded-lg bg-brand/10 p-3 text-center text-xs text-foreground/80 ring-1 ring-brand/20">
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

          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
            © {new Date().getFullYear()} {settings?.school_name ?? 'مدارس الضاحية'}
          </p>
        </div>
      </div>
    </div>
  );
}
