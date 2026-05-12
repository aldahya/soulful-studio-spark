import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, PlayCircle, GraduationCap, BookOpen, UserPlus,
  ScanLine, BarChart3, CheckCircle2, QrCode, Shield, Zap,
  Users, Smartphone, FileSpreadsheet, ArrowDown,
} from 'lucide-react';

const workflow = [
  { icon: GraduationCap, label: 'إعداد المدرسة', color: 'text-teal-600',   bg: 'bg-teal-100'   },
  { icon: BookOpen,      label: 'الفصول',        color: 'text-blue-600',   bg: 'bg-blue-100'   },
  { icon: UserPlus,      label: 'الطلاب',        color: 'text-amber-600',  bg: 'bg-amber-100'  },
  { icon: ScanLine,      label: 'المسح اليومي',  color: 'text-rose-600',   bg: 'bg-rose-100'   },
  { icon: BarChart3,     label: 'التقارير',      color: 'text-violet-600', bg: 'bg-violet-100' },
];

const steps = [
  {
    num: '01', icon: BookOpen, color: '#0f766e', bg: 'bg-teal-50', border: 'border-teal-200',
    iconBg: 'bg-teal-100', iconColor: 'text-teal-700',
    title: 'أنشئ الفصول الدراسية',
    desc: 'ابدأ بإضافة الفصول وتحديد المرحلة الدراسية لكل فصل — ابتدائي، متوسط أو ثانوي.',
    substeps: ['اذهب إلى قسم الفصول', 'اضغط «إضافة فصل»', 'حدد الاسم والمرحلة والصف', 'احفظ الفصل'],
  },
  {
    num: '02', icon: UserPlus, color: '#1d4ed8', bg: 'bg-blue-50', border: 'border-blue-200',
    iconBg: 'bg-blue-100', iconColor: 'text-blue-700',
    title: 'أضف الطلاب',
    desc: 'أضف الطلاب يدوياً أو ارفع ملف Excel — الرقم والباركود يتولّدان تلقائياً لكل طالب.',
    substeps: ['اذهب إلى قسم الطلاب', 'أضف يدوياً أو ارفع Excel', 'الرقم يتولّد تلقائياً', 'اطبع بطاقات الباركود'],
  },
  {
    num: '03', icon: ScanLine, color: '#b45309', bg: 'bg-amber-50', border: 'border-amber-200',
    iconBg: 'bg-amber-100', iconColor: 'text-amber-700',
    title: 'سجّل الحضور بالمسح',
    desc: 'افتح صفحة المسح وامسح باركود الطالب — يُسجَّل الحضور فوراً مع وقت الدخول واسم الماسح.',
    substeps: ['افتح صفحة المسح', 'امسح باركود الطالب', 'يظهر اسمه وحالته فوراً', 'كرر لجميع الطلاب'],
  },
  {
    num: '04', icon: FileSpreadsheet, color: '#6d28d9', bg: 'bg-violet-50', border: 'border-violet-200',
    iconBg: 'bg-violet-100', iconColor: 'text-violet-700',
    title: 'استعرض التقارير وصدّرها',
    desc: 'شاهد تقارير الحضور اليومية والشهرية وصدّرها بصيغة Excel بنقرة واحدة.',
    substeps: ['افتح قسم التقارير', 'اختر الفترة الزمنية', 'فلتر حسب الفصل أو المرحلة', 'صدّر تقرير Excel'],
  },
];

const features = [
  { icon: QrCode,     title: 'مسح الباركود الذكي',   desc: 'تسجيل الحضور في ثوانٍ عبر بطاقة الباركود من أي جهاز.' },
  { icon: BarChart3,  title: 'تقارير فورية ومفصّلة', desc: 'تقارير يومية وشهرية وسنوية بنقرة واحدة.' },
  { icon: Shield,     title: 'عزل كامل للبيانات',    desc: 'كل مدرسة معزولة — لا يرى أحد بيانات مدرسة أخرى.' },
  { icon: Zap,        title: 'استذانات الخروج',       desc: 'إصدار وتتبع الاستذانات رقمياً خلال اليوم.' },
  { icon: Users,      title: 'أدوار وصلاحيات مرنة',  desc: 'مدير ومعلم — كل مستخدم يرى ما يخصه فقط.' },
  { icon: Smartphone, title: 'يعمل على كل الأجهزة',  desc: 'واجهة عربية متجاوبة على الجوال والتابلت والكمبيوتر.' },
];

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={`relative rounded-2xl border ${step.border} ${step.bg} p-6 transition-all duration-700`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transitionDelay: `${index * 120}ms`,
      }}
    >
      <div className="absolute -top-4 -right-2 text-6xl font-black opacity-[0.07] select-none" style={{ color: step.color }}>
        {step.num}
      </div>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl ${step.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <step.icon className={`w-6 h-6 ${step.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-black opacity-50" style={{ color: step.color }}>الخطوة {step.num}</span>
          <h3 className="text-base font-black text-gray-900 mb-2 mt-1">{step.title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">{step.desc}</p>
          <div className="space-y-1.5">
            {step.substeps.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: step.color }}>
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs text-gray-600 font-medium">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const { ref: workflowRef, visible: workflowVisible } = useInView(0.1);
  const { ref: stepsRef,    visible: stepsVisible    } = useInView();
  const { ref: featRef,     visible: featVisible     } = useInView();

  useEffect(() => {
    document.title = 'كيف يعمل النظام — مجموعة المالكي التعليمية';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-[#f8fafb] font-sans overflow-x-hidden">

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-teal-700 transition-colors font-medium">
            <ArrowRight className="w-4 h-4" />
            العودة للصفحة الرئيسية
          </Link>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-teal-600 text-white font-bold">
            <PlayCircle className="w-3.5 h-3.5" />
            كيف يعمل النظام؟
          </span>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-950 to-black py-20">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-teal-500/10 blur-3xl rounded-full" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 font-medium mb-5">
            <PlayCircle className="w-3.5 h-3.5 text-teal-400" />
            دليل الاستخدام
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4">كيف يعمل النظام؟</h1>
          <p className="text-white/50 text-sm max-w-md mx-auto leading-relaxed">
            خمس خطوات بسيطة من إعداد المدرسة حتى الحصول على تقارير احترافية
          </p>
        </div>
      </section>

      {/* ─── Workflow Infographic ─── */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 pb-20 pt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div ref={workflowRef} className="flex flex-wrap justify-center items-center gap-2 mb-16">
            {workflow.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="flex flex-col items-center gap-2 transition-all duration-700"
                  style={{
                    opacity: workflowVisible ? 1 : 0,
                    transform: workflowVisible ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(20px)',
                    transitionDelay: `${i * 150}ms`,
                  }}
                >
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${w.bg} flex items-center justify-center shadow-lg ring-2 ring-white/10`}>
                    <w.icon className={`w-7 h-7 sm:w-9 sm:h-9 ${w.color}`} />
                  </div>
                  <span className="text-xs text-white/70 font-bold text-center whitespace-nowrap">{w.label}</span>
                </div>
                {i < workflow.length - 1 && (
                  <div
                    className="flex items-center mb-5 transition-all duration-700"
                    style={{ opacity: workflowVisible ? 1 : 0, transitionDelay: `${i * 150 + 100}ms` }}
                  >
                    <div className="flex gap-0.5 mx-1">
                      {[0, 1, 2].map((d) => (
                        <div key={d} className="w-1.5 h-1.5 rounded-full bg-teal-500/60" />
                      ))}
                    </div>
                    <ArrowDown className="w-3 h-3 text-teal-400/60 rotate-[-90deg]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { val: '< 5', unit: 'ثوانٍ',   label: 'لتسجيل حضور طالب' },
              { val: '100%', unit: 'تلقائي', label: 'توليد الأرقام والباركود' },
              { val: 'Excel', unit: 'تصدير', label: 'التقارير بنقرة واحدة' },
              { val: '24/7', unit: 'متاح',   label: 'من أي جهاز وأي مكان' },
            ].map((s, i) => (
              <div
                key={i}
                className="text-center p-4 rounded-2xl bg-white/5 border border-white/10 transition-all duration-700"
                style={{ opacity: workflowVisible ? 1 : 0, transform: workflowVisible ? 'translateY(0)' : 'translateY(24px)', transitionDelay: `${600 + i * 100}ms` }}
              >
                <div className="text-xl font-black text-teal-400">{s.val}</div>
                <div className="text-xs text-white/40 font-medium">{s.unit}</div>
                <div className="text-xs text-white/60 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Steps ─── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div
            ref={stepsRef}
            className="text-center mb-16 transition-all duration-700"
            style={{ opacity: stepsVisible ? 1 : 0, transform: stepsVisible ? 'translateY(0)' : 'translateY(24px)' }}
          >
            <span className="inline-block px-4 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-bold mb-4">خطوة بخطوة</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">دليل البدء السريع</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">من أول دخول حتى أول تقرير — كل شيء واضح وسهل</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step, i) => <StepCard key={i} step={step} index={i} />)}
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: '💡', title: 'نصيحة', text: 'ابدأ بإضافة الفصول قبل الطلاب لتتمكن من تعيين كل طالب لفصله.' },
              { icon: '📋', title: 'رفع Excel', text: 'يمكنك رفع قائمة الطلاب دفعة واحدة — الأرقام تتولّد تلقائياً.' },
              { icon: '🔒', title: 'أمان', text: 'كل معلم يرى فقط مرحلته الدراسية — المدير يرى الكل.' },
            ].map((tip, i) => (
              <div key={i} className="flex gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-xl flex-shrink-0">{tip.icon}</span>
                <div>
                  <div className="text-xs font-black text-gray-700 mb-1">{tip.title}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{tip.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="bg-[#f8fafb] border-y border-gray-100 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div
            ref={featRef}
            className="text-center mb-14 transition-all duration-700"
            style={{ opacity: featVisible ? 1 : 0, transform: featVisible ? 'translateY(0)' : 'translateY(24px)' }}
          >
            <span className="inline-block px-4 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold mb-3">لماذا نظامنا؟</span>
            <h2 className="text-2xl font-black text-gray-900 mb-2">مميزات النظام</h2>
            <p className="text-gray-400 text-sm">ما يجعل نظام مجموعة المالكي مختلفاً</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className="group flex gap-4 p-5 rounded-2xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all duration-300 bg-white"
                style={{ opacity: featVisible ? 1 : 0, transform: featVisible ? 'translateY(0)' : 'translateY(20px)', transition: `all 0.6s ease ${i * 80}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-200 transition-colors">
                  <f.icon className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="bg-gradient-to-l from-teal-600 to-teal-800 py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">جاهز للبدء؟</h2>
          <p className="text-white/70 text-sm mb-8">ادخل الآن وابدأ تسجيل الحضور الذكي</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-teal-700 font-black text-sm hover:bg-teal-50 transition-all duration-200 hover:scale-105 shadow-lg"
          >
            <ArrowRight className="w-4 h-4" />
            سجّل الدخول الآن
          </Link>
        </div>
      </section>

    </div>
  );
}
