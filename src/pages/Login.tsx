import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings, SCHOOL_LOGO } from '@/lib/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ShieldCheck, UserPlus } from 'lucide-react';
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center text-primary-foreground">
          <div className="mb-4 rounded-2xl bg-white/10 p-3 backdrop-blur-md">
            <img src={SCHOOL_LOGO} alt="شعار" className="h-20 w-20 object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold">{settings?.school_name ?? 'مدارس الضاحية الأهلية'}</h1>
          <p className="mt-1 text-sm text-primary-foreground/80">{settings?.subtitle ?? 'نظام إدارة الحضور والانصراف'}</p>
        </div>

        <Card className="border-border/40 p-6 shadow-elevated">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'signin' | 'signup')}>
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="signin" className="gap-2">
                <ShieldCheck className="h-4 w-4" /> دخول
              </TabsTrigger>
              <TabsTrigger value="signup" className="gap-2">
                <UserPlus className="h-4 w-4" /> حساب جديد
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary text-base font-bold shadow-glow" disabled={submitting}>
                {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
              </Button>
            </form>

            <TabsContent value="signup">
              <p className="mt-4 text-center text-xs text-muted-foreground">
                بعد إنشاء حسابك سيقوم المدير بمنحك دور المعلم أو الإداري.
              </p>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="mt-6 text-center text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} {settings?.school_name ?? 'مدارس الضاحية'}
        </p>
      </div>
    </div>
  );
}
